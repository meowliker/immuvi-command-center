#!/usr/bin/env python3
"""
fb_ad_classifier.py
───────────────────
Background pipeline: Facebook Ads Library URL → video download → frame extraction

Usage:
    python3 fb_ad_classifier.py <ad_id_or_url>

Examples:
    python3 fb_ad_classifier.py 1984581118871631
    python3 fb_ad_classifier.py "https://www.facebook.com/ads/library/?id=1984581118871631"

Output:
    /tmp/fb_ad_<ID>/frame_001.jpg ... frame_NNN.jpg
    Prints ad metadata (copy, CTA, format, video URL) to stdout
    Frames are left on disk for Claude to read and classify visually

Requirements:
    pip3 install playwright requests
    python3 -m playwright install chromium
    brew install ffmpeg   (or: apt-get install ffmpeg)
"""

import asyncio
import html as _html
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────
FRAMES_PER_VIDEO = 8          # max frames to extract
FRAME_INTERVAL_SEC = 3        # 1 frame every N seconds
FRAME_WIDTH_PX = 720          # resize width (height auto)
OUTPUT_BASE = "/tmp"          # frames saved to /tmp/fb_ad_<ID>/
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


# ── Helpers ──────────────────────────────────────────────────────────────────
def extract_ad_id(input_str: str) -> str:
    """Accept raw ID or full URL, return just the numeric ID string."""
    m = re.search(r'[?&]id=(\d+)', input_str)
    if m:
        return m.group(1)
    if re.fullmatch(r'\d+', input_str.strip()):
        return input_str.strip()
    raise ValueError(f"Cannot extract ad ID from: {input_str!r}")


def unescape_fb_url(s: str) -> str:
    """Fix \\/ and HTML-encoded % in URLs embedded in Facebook page HTML."""
    return s.replace('\\/', '/').replace('%25', '%')


def decode_unicode(s: str) -> str:
    """Decode \\uXXXX sequences including surrogate pairs (emoji) from Facebook JSON."""
    if not s:
        return s
    # Handle surrogate pairs first: \\uD83D\\uDD2E → 🔮
    def replace_surrogates(m):
        high = int(m.group(1), 16)
        low  = int(m.group(2), 16)
        code = ((high - 0xD800) << 10) + (low - 0xDC00) + 0x10000
        return chr(code)
    result = re.sub(r'\\u([dD][89aAbB][0-9a-fA-F]{2})\\u([dD][c-fC-F][0-9a-fA-F]{2})',
                    replace_surrogates, s)
    # Then decode remaining \\uXXXX
    result = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), result)
    return result


# ── TikTok: non-browser media download chain ─────────────────────────────────
def _download_url(url: str, dest: str, referer: str = "") -> None:
    if shutil.which("curl"):
        cmd = [
            "curl", "-L", "--fail", "--silent", "--show-error",
            "--max-time", "45",
            "-A", USER_AGENT,
            "-o", dest,
        ]
        if referer:
            cmd[7:7] = ["-e", referer]
        r = subprocess.run(cmd + [url], capture_output=True, text=True, timeout=55)
        size = os.path.getsize(dest) if os.path.exists(dest) else 0
        # TikTok CDN can be painfully slow from worker networks. A timed-out
        # partial MP4 is still useful if ffmpeg can decode the first frames.
        if r.returncode == 0 or (r.returncode == 28 and size > 750_000):
            return
        raise RuntimeError((r.stderr or r.stdout or "curl download failed").strip())

    headers = {"User-Agent": USER_AGENT}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        f.write(r.read())


def _tiktok_download_ytdlp(url: str, work_dir: str, cookies: bool) -> str:
    if not shutil.which("yt-dlp"):
        raise RuntimeError("yt-dlp not installed")

    out = os.path.join(work_dir, "_tiktok.%(ext)s")
    cmd = [
        "yt-dlp",
        "--quiet",
        "--no-warnings",
        "--no-playlist",
        "-f",
        "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/mp4/best",
        "-o",
        out,
        url,
    ]
    if cookies:
        cmd[1:1] = ["--cookies-from-browser", "chrome"]

    r = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
    if r.returncode != 0:
        err = (r.stderr or r.stdout or "unknown yt-dlp failure").strip().splitlines()
        raise RuntimeError(err[-1] if err else "unknown yt-dlp failure")

    for f in sorted(os.listdir(work_dir)):
        if f.startswith("_tiktok.") and f.lower().endswith((".mp4", ".mov", ".webm", ".m4v")):
            p = os.path.join(work_dir, f)
            if os.path.getsize(p) > 1000:
                return p
    raise RuntimeError("yt-dlp finished but no TikTok video file was written")


def _tiktok_download_creative_center(url: str, work_dir: str) -> tuple[str, dict]:
    """
    Resolve and download a TikTok Creative Center / Top Ads page.

    URL shape: https://ads.tiktok.com/business/creativecenter/topads/<material_id>

    tikwm + yt-dlp don't support this path. The page is a Next.js SSR app and
    embeds the (watermarked) signed CDN MP4 URL inside <script id="__NEXT_DATA__">.

    Networks that DNS-poison *.tiktok.com (e.g. Jio in India) still let TCP+TLS
    through to Akamai edge IPs once we bypass DNS via curl --resolve. SNI DPI is
    inconsistent — we try multiple edges and the first non-reset wins.

    Steps:
      1. Resolve ads.tiktok.com via public DNS (1.1.1.1 / 8.8.8.8 / 9.9.9.9).
      2. curl --resolve <each-edge>:443:<ip> until one returns the SSR HTML.
      3. Parse __NEXT_DATA__ → props.pageProps.data.baseDetail.videoInfo.videoUrl.
      4. Resolve the CDN host the same way and download the .mp4.
    """
    import socket
    m = re.search(r"/creativecenter/topads/(\d+)", url)
    if not m:
        raise RuntimeError("creative-center: no material_id in URL")
    material_id = m.group(1)

    def _public_dns(host: str) -> list:
        """Return distinct A records via 1.1.1.1/8.8.8.8/9.9.9.9. Falls back to socket."""
        ips = []
        seen = set()
        for resolver in ("1.1.1.1", "8.8.8.8", "9.9.9.9"):
            try:
                r = subprocess.run(
                    ["dig", "+short", "+time=3", "+tries=1", f"@{resolver}", host],
                    capture_output=True, text=True, timeout=6,
                )
                for line in r.stdout.split():
                    line = line.strip()
                    if re.match(r"^\d+\.\d+\.\d+\.\d+$", line) and line not in seen:
                        ips.append(line); seen.add(line)
            except Exception:
                pass
        if not ips:
            try:
                ips = [socket.gethostbyname(host)]
            except Exception:
                pass
        return ips

    def _curl_resolve(target_url: str, host: str, ip: str, dest: str = "", connect_timeout: int = 6, max_time: int = 30) -> tuple:
        cmd = [
            "curl", "--connect-timeout", str(connect_timeout),
            "--max-time", str(max_time),
            "-sS", "-L",
            "--resolve", f"{host}:443:{ip}",
            "-A", USER_AGENT,
            "-H", "Accept-Language: en-US,en;q=0.9",
            "-H", f"Referer: https://{host}/",
        ]
        if dest:
            cmd += ["-o", dest]
        cmd.append(target_url)
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=max_time + 5)
        return r.returncode, (r.stdout if not dest else ""), r.stderr

    ads_ips = _public_dns("ads.tiktok.com")
    if not ads_ips:
        raise RuntimeError("creative-center: could not resolve ads.tiktok.com via public DNS")

    html = ""
    last_err = ""
    for ip in ads_ips:
        for attempt in range(2):
            rc, body, err = _curl_resolve(url, "ads.tiktok.com", ip, max_time=25)
            if rc == 0 and "__NEXT_DATA__" in body and "videoInfo" in body:
                html = body
                break
            last_err = err.strip().splitlines()[-1] if err else f"rc={rc}"
        if html:
            break
    if not html:
        raise RuntimeError(f"creative-center: SSR fetch failed across {len(ads_ips)} edge IPs ({last_err})")

    nd = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not nd:
        raise RuntimeError("creative-center: __NEXT_DATA__ script not found in SSR HTML")
    try:
        data = json.loads(nd.group(1))
        bd = data["props"]["pageProps"]["data"]["baseDetail"]
        vi = bd["videoInfo"]
        video_urls = vi.get("videoUrl") or {}
        mp4_url = video_urls.get("720P") or video_urls.get("540P") or (next(iter(video_urls.values())) if video_urls else "")
        if not mp4_url:
            raise KeyError("videoUrl empty")
    except (KeyError, ValueError, TypeError) as e:
        raise RuntimeError(f"creative-center: failed to extract videoUrl from __NEXT_DATA__: {e}")

    cdn_host = re.match(r"https?://([^/]+)/", mp4_url)
    if not cdn_host:
        raise RuntimeError(f"creative-center: cannot parse host from CDN URL")
    cdn_host = cdn_host.group(1)

    dest = os.path.join(work_dir, "_creative_center.mp4")
    cdn_ips = _public_dns(cdn_host)
    if not cdn_ips:
        # CDN host might resolve cleanly via system DNS (no sinkhole on CDN); try direct.
        _download_url(mp4_url, dest, referer="https://ads.tiktok.com/")
    else:
        downloaded = False
        cdn_err = ""
        for ip in cdn_ips:
            rc, _, err = _curl_resolve(mp4_url, cdn_host, ip, dest=dest, connect_timeout=5, max_time=90)
            size = os.path.getsize(dest) if os.path.exists(dest) else 0
            if rc == 0 and size > 100_000:
                downloaded = True
                break
            cdn_err = err.strip().splitlines()[-1] if err else f"rc={rc} size={size}"
        if not downloaded:
            raise RuntimeError(f"creative-center: CDN download failed across {len(cdn_ips)} IPs ({cdn_err})")

    if os.path.getsize(dest) <= 1000:
        raise RuntimeError("creative-center: downloaded empty MP4")

    # Build tikwm-shaped meta so the rest of download_tiktok_media works unchanged.
    meta = {
        "id": material_id,
        "title": bd.get("adTitle") or "",
        "desc": bd.get("adTitle") or "",
        "duration": int(vi.get("duration") or 0),
        "author": {
            "unique_id": bd.get("brandName") or "",
            "nickname": bd.get("brandName") or "",
        },
        "_creative_center": {
            "material_id": material_id,
            "industry_key": bd.get("industryKey"),
            "objective_key": bd.get("objectiveKey"),
            "country_codes": bd.get("countryCode"),
            "landing_page": bd.get("landingPage"),
            "ctr": bd.get("ctr"),
            "like": bd.get("like"),
            "share": bd.get("share"),
            "keyword_list": bd.get("keywordList"),
            "watermarked": True,
        },
    }
    return dest, meta


def _tiktok_download_tikwm(url: str, work_dir: str) -> tuple[str, dict]:
    api = "https://www.tikwm.com/api/?" + urllib.parse.urlencode({"url": url})
    req = urllib.request.Request(api, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        payload = json.loads(r.read().decode("utf-8", "ignore"))
    data = payload.get("data") or {}
    media_url = data.get("play") or data.get("wmplay") or data.get("hdplay")
    if not media_url:
        raise RuntimeError(payload.get("msg") or "tikwm returned no playable URL")
    if media_url.startswith("//"):
        media_url = "https:" + media_url
    dest = os.path.join(work_dir, "_tikwm.mp4")
    _download_url(media_url, dest, referer="https://www.tiktok.com/")
    if os.path.getsize(dest) <= 1000:
        raise RuntimeError("tikwm downloaded an empty TikTok video")
    return dest, data


def download_tiktok_media(url: str, work_dir: str) -> dict:
    """
    Download TikTok media without browser automation. Browser download flows are
    unreliable for TikTok because the web UI blocks automation/login popups.

    Chain order:
      0. ads.tiktok.com/business/creativecenter/topads/<id> → SSR __NEXT_DATA__ +
         Akamai-edge --resolve (the only path that works for Creative Center URLs;
         tikwm/yt-dlp don't support that route)
      1. tikwm public resolver API direct mp4 (regular tiktok.com/@user/video/<id>)
      2. yt-dlp without cookies
      3. yt-dlp with Chrome cookies
    """
    os.makedirs(work_dir, exist_ok=True)
    errors = []
    raw_path = None
    via = ""
    meta = {}

    is_creative_center = "ads.tiktok.com/business/creativecenter/topads" in url

    if is_creative_center:
        chain = (
            ("creative-center", lambda: _tiktok_download_creative_center(url, work_dir)),
        )
    else:
        chain = (
            ("tikwm", lambda: _tiktok_download_tikwm(url, work_dir)),
            ("yt-dlp", lambda: (_tiktok_download_ytdlp(url, work_dir, False), {})),
            ("yt-dlp-cookies", lambda: (_tiktok_download_ytdlp(url, work_dir, True), {})),
        )

    for name, fn in chain:
        try:
            raw_path, meta = fn()
            via = name
            break
        except Exception as e:
            errors.append(f"{name}: {e}")

    if not raw_path:
        raise RuntimeError("TikTok download failed without browser: " + " | ".join(errors))

    duration = 0.0
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", raw_path],
            capture_output=True, text=True, timeout=15,
        )
        for s in json.loads(r.stdout).get("streams", []):
            if "duration" in s:
                duration = float(s["duration"])
                break
    except Exception:
        pass

    frames = extract_frames(raw_path, work_dir)
    try:
        os.remove(raw_path)
    except OSError:
        pass

    author = meta.get("author") or {}
    page_name = author.get("unique_id") or author.get("nickname") or ""
    return {
        "frames": frames,
        "duration": round(duration, 1),
        "metadata": {
            "page_name": page_name,
            "body_text": meta.get("title") or meta.get("desc") or "",
            "title": meta.get("title") or "",
            "cta_text": "",
            "link_url": url,
        },
        "via": via,
        "is_video": True,
    }


# ── Instagram: gallery-dl → snapinsta → OG fallback chain ─────────────────────
def fetch_instagram_og(url: str) -> dict:
    """
    Fetch an Instagram post URL using a crawler User-Agent and parse Open Graph
    metadata. This is the final fallback for Instagram media and also provides
    caption/page metadata for the higher-quality download methods.
    """
    req = urllib.request.Request(url, headers={"User-Agent": "facebookexternalhit/1.1"})
    page = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")

    def og(prop: str) -> str:
        m = re.search(
            r'property=["\']og:' + re.escape(prop) + r'["\']\s+content=["\']([^"\']+)["\']',
            page,
            re.I,
        )
        return _html.unescape(m.group(1)) if m else ""

    desc = og("description")
    title = og("title")
    caption = ""
    user = ""
    m = re.match(
        r'^[\d,]+\s+likes?,\s+[\d,]+\s+comments?\s+-\s+(\S+)\s+on\s+[^:]+:\s*"(.+)"[\s.]*$',
        desc,
        re.S,
    )
    if m:
        user, caption = m.group(1), m.group(2)
    elif desc:
        m2 = re.match(r'^[^:]+:\s*"(.*)"\s*$', desc, re.S)
        caption = m2.group(1) if m2 else desc
        mt = re.match(r'^(\S+)\s+on Instagram', title or "")
        user = mt.group(1) if mt else ""

    return {
        "image_url": og("image"),
        "video_url": og("video") or og("video:secure_url"),
        "caption": caption,
        "page_name": user,
        "title": title,
        "body_text": caption,
        "link_url": url,
    }


def _ig_download_gallery_dl(url: str, work_dir: str) -> tuple[str, str]:
    if not shutil.which("gallery-dl"):
        raise RuntimeError("gallery-dl not installed")

    tmp = os.path.join(work_dir, "_ig_gallery_dl")
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp, exist_ok=True)

    last_err = ""
    for browser in ("chrome", "firefox", "brave", "edge", "safari"):
        try:
            r = subprocess.run(
                ["gallery-dl", "--cookies-from-browser", browser, "-d", tmp, "--no-mtime", "-q", url],
                capture_output=True,
                text=True,
                timeout=90,
            )
            if r.returncode != 0:
                last_err = (r.stderr or r.stdout or f"{browser} cookies failed").strip()
                continue
            for root, _, files in os.walk(tmp):
                for filename in sorted(files):
                    if filename.startswith("."):
                        continue
                    path = os.path.join(root, filename)
                    if os.path.getsize(path) <= 500:
                        continue
                    ext = filename.lower().rsplit(".", 1)[-1]
                    kind = "video" if ext in ("mp4", "mov", "webm", "m4v") else "image"
                    return path, kind
        except Exception as e:
            last_err = str(e)

    raise RuntimeError("gallery-dl: no usable Instagram media" + (f" ({last_err})" if last_err else ""))


def _ig_download_snapinsta(url: str, work_dir: str) -> tuple[str, str]:
    """
    Snapinsta uses Cloudflare Turnstile in invisible mode. A real off-screen
    Chromium window is much more reliable than pure headless for this flow.
    """
    from playwright.sync_api import sync_playwright

    ua = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    media_url = None
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--window-position=-3000,-3000",
                "--window-size=1366,768",
            ],
        )
        try:
            ctx = browser.new_context(user_agent=ua, viewport={"width": 1366, "height": 768})
            ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
            page = ctx.new_page()
            page.goto("https://snapinsta.to/en2", timeout=30000, wait_until="domcontentloaded")
            page.wait_for_selector('input[placeholder*="URL"], input[name="url"], input[type="text"]', timeout=15000)
            page.fill('input[placeholder*="URL"], input[name="url"], input[type="text"]', url)
            page.click('button:has-text("Download")')
            selector = 'a:has-text("Download Photo"), a:has-text("Download Video"), a[download]'
            page.wait_for_selector(selector, timeout=30000, state="attached")
            media_url = page.locator(selector).first.get_attribute("href")
        finally:
            browser.close()

    if not media_url:
        raise RuntimeError("snapinsta: no media href")
    is_video = media_url.lower().split("?", 1)[0].endswith((".mp4", ".mov", ".webm", ".m4v")) or "video" in media_url.lower()
    dest = os.path.join(work_dir, "_ig_snap." + ("mp4" if is_video else "jpg"))
    req = urllib.request.Request(media_url, headers={"User-Agent": ua, "Referer": "https://snapinsta.to/"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        f.write(r.read())
    if os.path.getsize(dest) <= 500:
        raise RuntimeError("snapinsta: downloaded empty media")
    return dest, ("video" if is_video else "image")


def _ig_download_og(url: str, work_dir: str, og: dict) -> tuple[str, str]:
    if og.get("video_url"):
        dest = os.path.join(work_dir, "_ig_og.mp4")
        req = urllib.request.Request(og["video_url"], headers={"User-Agent": "facebookexternalhit/1.1"})
        with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
            f.write(r.read())
        if os.path.getsize(dest) > 500:
            return dest, "video"

    if og.get("image_url"):
        dest = os.path.join(work_dir, "_ig_og.jpg")
        req = urllib.request.Request(og["image_url"], headers={"User-Agent": "facebookexternalhit/1.1"})
        with urllib.request.urlopen(req, timeout=30) as r, open(dest, "wb") as f:
            f.write(r.read())
        if os.path.getsize(dest) > 500:
            return dest, "image"

    raise RuntimeError("og: no usable Instagram media")


def _ig_get_duration(path: str) -> float:
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", path],
            capture_output=True,
            text=True,
            timeout=15,
        )
        for stream in json.loads(r.stdout).get("streams", []):
            if "duration" in stream:
                return float(stream["duration"])
    except Exception:
        pass
    return 0.0


def download_instagram_media(url: str, work_dir: str) -> dict:
    """
    Download Instagram media with the robust 3-method chain documented in the
    backlog: gallery-dl with browser cookies, Snapinsta via off-screen Playwright,
    then Open Graph media as the always-available fallback.
    """
    os.makedirs(work_dir, exist_ok=True)
    try:
        og = fetch_instagram_og(url)
    except Exception:
        og = {"link_url": url}

    errors = []
    raw_path = None
    kind = ""
    via = ""
    chain = (
        ("gallery-dl", lambda: _ig_download_gallery_dl(url, work_dir)),
        ("snapinsta", lambda: _ig_download_snapinsta(url, work_dir)),
        ("og", lambda: _ig_download_og(url, work_dir, og)),
    )
    for name, fn in chain:
        try:
            raw_path, kind = fn()
            via = name
            break
        except Exception as e:
            errors.append(f"{name}: {e}")

    if not raw_path:
        raise RuntimeError("Instagram download failed: " + " | ".join(errors))

    final_path = os.path.join(work_dir, "instagram_media." + ("mp4" if kind == "video" else "jpg"))
    if os.path.abspath(raw_path) != os.path.abspath(final_path):
        shutil.move(raw_path, final_path)
    shutil.rmtree(os.path.join(work_dir, "_ig_gallery_dl"), ignore_errors=True)

    duration = _ig_get_duration(final_path) if kind == "video" else 0.0
    if kind == "video":
        frames = extract_frames(final_path, work_dir)
        try:
            os.remove(final_path)
        except OSError:
            pass
    else:
        frame_path = os.path.join(work_dir, "frame_001.jpg")
        if os.path.abspath(final_path) != os.path.abspath(frame_path):
            shutil.move(final_path, frame_path)
        frames = [frame_path]

    return {
        "frames": frames,
        "duration": round(duration, 1),
        "metadata": {
            "page_name": decode_unicode(og.get("page_name") or ""),
            "body_text": decode_unicode(og.get("body_text") or og.get("caption") or ""),
            "title": decode_unicode(og.get("title") or ""),
            "cta_text": "",
            "link_url": og.get("link_url") or url,
        },
        "via": via,
        "is_video": kind == "video",
    }


# ── Step 1: Fetch ad JSON from page ──────────────────────────────────────────
async def fetch_ad_snapshot(ad_id: str) -> dict:
    """
    Use Playwright headless to load the Ads Library page and extract the
    embedded JSON snapshot for the target ad.
    Returns dict with keys: video_hd_url, video_sd_url, video_preview_image_url,
                            body_text, cta_text, cta_type, title, caption, display_format
    """
    from playwright.async_api import async_playwright

    url = f"https://www.facebook.com/ads/library/?id={ad_id}"
    print(f"[1/4] Loading page (headless): {url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=USER_AGENT)
        page = await context.new_page()

        await page.goto(url, wait_until="networkidle", timeout=30000)
        content = await page.content()
        await browser.close()

    # Locate the ad's JSON block — properly bounded to this ad's object only
    marker = f'"ad_archive_id":"{ad_id}"'
    idx = content.find(marker)
    if idx == -1:
        raise RuntimeError(
            f"Ad ID {ad_id} not found in page. "
            "The ad may be inactive or the page may require login."
        )

    # Find the enclosing JSON object by scanning for matching braces
    # This prevents bleeding into neighboring ads on collated pages
    start = idx
    brace_count = 0
    for i in range(idx, max(idx - 5000, 0), -1):
        if content[i] == '}':
            brace_count += 1
        if content[i] == '{':
            brace_count -= 1
            if brace_count < 0:
                start = i
                break

    end = idx
    brace_count = 0
    for i in range(start, min(start + 20000, len(content))):
        if content[i] == '{':
            brace_count += 1
        if content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                end = i + 1
                break

    chunk = content[start:end]

    def _find(pattern, text=chunk):
        m = re.search(pattern, text)
        return unescape_fb_url(m.group(1)) if m else None

    snapshot = {
        "ad_id":              ad_id,
        "video_hd_url":       _find(r'"video_hd_url":"(https:\\/\\/video[^"]+\.mp4[^"]*)"'),
        "video_sd_url":       _find(r'"video_sd_url":"(https:\\/\\/video[^"]+\.mp4[^"]*)"'),
        "video_preview_url":  _find(r'"video_preview_image_url":"(https:\\/\\/scontent[^"]+\.jpg[^"]*)"'),
        "image_url":          _find(r'"original_image_url":"(https:\\/\\/scontent[^"]+)"'),
        "body_text":          _find(r'"body":\{"text":"([^"]+)"'),
        "title":              _find(r'"title":"([^"]+)"'),
        "cta_text":           _find(r'"cta_text":"([^"]+)"'),
        "cta_type":           _find(r'"cta_type":"([^"]+)"'),
        "caption":            _find(r'"caption":"([^"]+)"'),
        "display_format":     _find(r'"display_format":"([^"]+)"'),
        "link_url":           _find(r'"link_url":"(https?:\\/\\/[^"]+)"'),
        "link_description":   _find(r'"link_description":"([^"]+)"'),
        "page_name":          _find(r'"page_name":"([^"]+)"'),
        "collation_count":    _find(r'"collation_count":(\d+)'),
    }

    return snapshot


# ── Step 2: Download video ────────────────────────────────────────────────────
def download_video(url: str, dest: str) -> int:
    """Download video from CDN URL. Returns file size in bytes."""
    print(f"[2/4] Downloading video...")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=90) as resp, open(dest, "wb") as f:
        f.write(resp.read())
    size = os.path.getsize(dest)
    print(f"      {size / 1024:.0f} KB saved to {dest}")
    return size


# ── Step 3: Extract frames ────────────────────────────────────────────────────
def extract_frames(video_path: str, output_dir: str) -> list[str]:
    """
    Extract frames at FRAME_INTERVAL_SEC intervals using ffmpeg.
    Returns sorted list of frame file paths.
    """
    print(f"[3/4] Extracting frames (1 every {FRAME_INTERVAL_SEC}s)...")
    os.makedirs(output_dir, exist_ok=True)
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-i", video_path,
            "-vf", f"fps=1/{FRAME_INTERVAL_SEC},scale={FRAME_WIDTH_PX}:-1",
            "-q:v", "2",
            os.path.join(output_dir, "frame_%03d.jpg"),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"      ffmpeg stderr: {result.stderr[-300:]}")

    frames = sorted(
        str(Path(output_dir) / f)
        for f in os.listdir(output_dir)
        if f.startswith("frame_") and f.endswith(".jpg")
    )

    # Keep only first FRAMES_PER_VIDEO
    if len(frames) > FRAMES_PER_VIDEO:
        for extra in frames[FRAMES_PER_VIDEO:]:
            os.remove(extra)
        frames = frames[:FRAMES_PER_VIDEO]

    print(f"      {len(frames)} frames extracted")
    return frames


# ── Step 4: Print classification prompt ──────────────────────────────────────
def print_classification_prompt(snapshot: dict, frames: list[str]):
    """Print metadata and frame paths for Claude to read and classify."""
    print("\n" + "═" * 60)
    print("  AD METADATA")
    print("═" * 60)
    print(f"  Ad ID       : {snapshot['ad_id']}")
    print(f"  Page        : {snapshot.get('page_name', '?')}")
    print(f"  Format      : {snapshot.get('display_format', '?')}")
    print(f"  Body        : {decode_unicode(snapshot.get('body_text') or '–')[:120]}")
    print(f"  Title       : {decode_unicode(snapshot.get('title') or '–')}")
    print(f"  Description : {decode_unicode(snapshot.get('link_description') or '–')}")
    print(f"  CTA         : {decode_unicode(snapshot.get('cta_text') or '?')} ({snapshot.get('cta_type','?')})")
    print(f"  Landing     : {snapshot.get('link_url', '–')}")
    print(f"  Collations  : {snapshot.get('collation_count', '1')}")
    print()
    print("  FRAMES FOR VISUAL CLASSIFICATION")
    print("─" * 60)
    for f in frames:
        print(f"  {f}")
    print()
    print("  CLASSIFICATION DIMENSIONS")
    print("─" * 60)
    print("  Photo/Video | Hook Type | Creative Structure | Production Style")
    print("  Funnel Type | Persona   | Angle              | Creative Hypothesis")
    print("═" * 60)
    print()
    print("  → Pass frame paths to Claude Read tool to classify visually.")
    print()


# ── Main ──────────────────────────────────────────────────────────────────────
async def run(input_str: str):
    ad_id = extract_ad_id(input_str)
    output_dir = os.path.join(OUTPUT_BASE, f"fb_ad_{ad_id}")
    video_path = os.path.join(OUTPUT_BASE, f"fb_ad_{ad_id}.mp4")

    # Clean any previous run
    if os.path.exists(output_dir):
        import shutil
        shutil.rmtree(output_dir)

    # Step 1: Fetch snapshot JSON
    snapshot = await fetch_ad_snapshot(ad_id)

    # Determine media type
    video_url = snapshot.get("video_hd_url") or snapshot.get("video_sd_url")
    is_video = bool(video_url)

    print(f"      Format: {snapshot.get('display_format', '?')}")
    print(f"      Page  : {snapshot.get('page_name', '?')}")
    print(f"      Body  : {(snapshot.get('body_text') or '')[:80]}")

    frames = []

    if is_video:
        # Step 2: Download
        download_video(video_url, video_path)

        # Step 3: Extract frames
        frames = extract_frames(video_path, output_dir)

        # Clean up video file immediately
        os.remove(video_path)
        print(f"      Video deleted — frames kept at {output_dir}/")

    elif snapshot.get("image_url"):
        # Photo ad — download the image directly
        print("[2/4] Downloading image...")
        os.makedirs(output_dir, exist_ok=True)
        img_path = os.path.join(output_dir, "frame_001.jpg")
        req = urllib.request.Request(
            snapshot["image_url"], headers={"User-Agent": USER_AGENT}
        )
        with urllib.request.urlopen(req, timeout=30) as resp, open(img_path, "wb") as f:
            f.write(resp.read())
        frames = [img_path]
        print(f"      Image saved: {img_path}")

    else:
        print("⚠ No video or image URL found in snapshot. Manual review needed.")

    # Step 4: Summary
    print("[4/4] Done.")
    print_classification_prompt(snapshot, frames)

    # Save snapshot JSON for reference
    meta_path = os.path.join(output_dir, "snapshot.json")
    if frames:  # only if we have something in the dir
        with open(meta_path, "w") as f:
            json.dump(snapshot, f, indent=2, ensure_ascii=False)
        print(f"  Metadata saved: {meta_path}")

    return snapshot, frames


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    asyncio.run(run(sys.argv[1]))
