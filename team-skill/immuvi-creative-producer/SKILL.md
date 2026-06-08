---
name: immuvi-creative-producer
description: Produce launch-ready ad image variations for Immuvi Command Center / ClickUp production tasks. Use when the user asks to read a ClickUp task, download inspiration/reference files, identify product/persona/angle, use Immuvi strategist memory, generate similar creative variations with a current image model, upload outputs back to the task, or move the task to Ready to Launch.
---

# Immuvi Creative Producer

## Step 0 — Auto-update (always run this first) + hot-reload on change

Silently refresh the skill files from origin using HTTP ETags — unchanged files are a 304 Not Modified (zero bytes transferred, ~90ms). When the origin has a newer `SKILL.md`, the script prints a single sentinel line: `SKILL_UPDATED_RELOAD_NOW`. **If you (the agent) see that sentinel in the output, stop following these in-context instructions immediately and Read `~/.codex/skills/immuvi-creative-producer/SKILL.md` — then follow THAT freshly-downloaded version for the rest of this run. This eliminates the one-run lag so every SKILL.md change applies on the same run it was published.**

```bash
SKILL_DIR="$HOME/.codex/skills/immuvi-creative-producer"
ASSET_BASE="${IMMUVI_PRODUCER_SKILL_ASSET_BASE:-https://immuvi-command-center.vercel.app/team-skill/immuvi-creative-producer}"
SKILL_MD_UPDATED=0

mkdir -p "$SKILL_DIR"

for f in SKILL.md; do
  file_path="$SKILL_DIR/$f"
  etag_path="$SKILL_DIR/.$f.etag"
  tmp_body="$SKILL_DIR/.$f.body.tmp"
  tmp_head="$SKILL_DIR/.$f.head.tmp"

  inm_args=()
  if [ -f "$file_path" ] && [ -s "$etag_path" ]; then
    inm_args=(-H "If-None-Match: $(cat "$etag_path")")
  fi

  http=$(curl -sS --max-time 10 "${inm_args[@]}" -D "$tmp_head" -o "$tmp_body" \
    -w "%{http_code}" "$ASSET_BASE/$f" 2>/dev/null) || http=""

  case "$http" in
    200)
      # Only count as "changed" if the new body actually differs from what's on
      # disk — protects against the rare case where origin re-hashed but content
      # is identical.
      if [ ! -f "$file_path" ] || ! cmp -s "$tmp_body" "$file_path"; then
        mv "$tmp_body" "$file_path"
        [ "$f" = "SKILL.md" ] && SKILL_MD_UPDATED=1
      else
        rm -f "$tmp_body"
      fi
      new_etag=$(awk -F': ' 'tolower($1)=="etag"{gsub(/\r/,"",$2); e=$2} END{print e}' "$tmp_head")
      [ -n "$new_etag" ] && printf '%s' "$new_etag" > "$etag_path"
      ;;
    304|*) rm -f "$tmp_body" ;;
  esac
  rm -f "$tmp_head"
done

if [ "$SKILL_MD_UPDATED" = "1" ]; then
  echo "SKILL_UPDATED_RELOAD_NOW"
  echo "[skill-update] A newer SKILL.md was downloaded to $SKILL_DIR/SKILL.md — reload it now before continuing."
fi
```

Fails silently on network errors and continues with the on-disk copy.

**Agent reload protocol when you see `SKILL_UPDATED_RELOAD_NOW`:**

1. Call the Read tool on `~/.codex/skills/immuvi-creative-producer/SKILL.md` (the full file — no offset/limit).
2. Discard the version of the instructions currently in your context from the steps below; follow the freshly-read file end-to-end instead.
3. Do not re-run Step 0 after the reload (it just ran — no ETag drift in the same second).
4. Continue from Step 1 of the newly-read instructions.

**One-time lag disclaimer:** this reload protocol only activates once a teammate has already picked up *this* version of Step 0. The first update after introducing the reload protocol still takes one run to propagate (their old skill silently downloads the new file but doesn't print the sentinel). Every update after that applies on the same run it was published.

---

## Workflow

Use this for Immuvi production tasks, especially tasks visible in the local Command Center at `http://localhost:8102/immuvi-command-center.html`.

## Button / Worker Invocation

Use this skill when an Immuvi app button or background worker asks Codex to generate creatives from a `producer_runs` job.

Expected worker prompt shape:

```text
Use the immuvi-creative-producer skill.
Use model: GPT-5.5.
Use reasoning effort: medium.
Generate images using your native image generation capability (same as Codex chat). Do NOT hard-code a specific model name.
Use image quality: high.
Use image size/aspect ratio: match the inspiration image unless the task specifies another size.

Run producer job:
- task_id: <ClickUp task id>
- product_id: <Immuvi product id or product name>
- producer_run_id: <producer_runs id, if available>
- count: <number of images>
- instruction: <optional user/editor instruction>

Read the ClickUp task, comments, inspiration doc, source image, and Creative Strategist memory.
Generate launch-ready image variations, upload them back to ClickUp, update producer_runs, and only set Ready to Launch after upload succeeds.
```

The app button should not try to pass the whole brief. It only needs to pass the task/job identifiers and optional instruction. Codex must fetch the real source of truth from ClickUp and Immuvi.

If the worker can set runtime config directly, use this default configuration:

```json
{
  "codex_model": "gpt-5.5",
  "reasoning_effort": "medium",
  "image_model": "native",
  "image_quality": "high",
  "image_size_strategy": "match_inspiration"
}
```

`image_model: "native"` means: use whatever native image generation tool the Codex runtime has loaded — same as the Codex chat. Record the actual model used in `producer_runs.outputs.image_model` for traceability.

1. Identify the ClickUp task and product.
   - Prefer a ClickUp task id or URL from the user.
   - If invoked by a worker, read `task_id`, `product_id`, `producer_run_id`, `count`, and `instruction` from the job payload.
   - If the task is only visible in the Command Center, inspect the Action Plan row and capture `task_id`, `product_id`, title, status, angle, persona, product, inspiration/reference links, and any editor brief.
   - Do not proceed to external writes without a ClickUp API key or an existing authenticated tool path.

2. Gather context.
   - Treat the ClickUp task as the primary brief. Fetch name, description, status, custom fields, comments, attachments, linked docs, assignees, due date, and all inspiration/reference links.
   - Download inspiration/reference files from ClickUp attachments, description links, comments, docs, Drive links, or creative URLs.
   - **Route the URL through `detect_platform()` (Step 2.0) before downloading.** Each platform has a different working path — anonymous `urllib.urlopen` / `curl` / plain `yt-dlp` fail on social platforms (Instagram login wall, TikTok signatures, Facebook auth). The router picks the right method:
     - Instagram (`instagram.com/p|reel|tv/…`) → **Step 2.1** (3-method chain)
     - TikTok (`tiktok.com/…`) → **Step 2.2** (yt-dlp)
     - YouTube (`youtube.com|youtu.be/…`) → **Step 2.2** (yt-dlp)
     - Facebook Ad Library (`facebook.com/ads/library`) → **Step 2.3** (Playwright scraper)
     - Raw Facebook CDN (`fbcdn.net`, `scontent.*.fbcdn.net`, `video.xx.fbcdn.net`) → **Step 2.3** (direct + FB referer)
     - Google Drive / ClickUp attachments / generic HTTP → handle inline with `gdown` / `curl` / `urllib`
   - Read Immuvi Creative Strategist memory for the product through `strategist_memory` when available. It contains markdown plus JSON with strategy, creative direction, copy, winning/dying combinations, and evidence task ids.
   - If available, read the latest `producer_runs` row for the task to avoid duplicate generations and to understand previous outputs.

### 2.0 Platform routing — `detect_platform(url)`

Use this tiny router to decide which downloader path to follow. It mirrors the same routing logic that `/classify-inspiration` uses on the Inspirations queue, so behavior stays consistent across the two skills.

```python
def detect_platform(url):
    u = (url or "").lower()
    if "facebook.com/ads/library" in u: return "facebook_adlib"
    if "fbcdn.net" in u or "video.xx.fbcdn" in u or "scontent." in u: return "fbcdn_direct"
    if "instagram.com" in u: return "instagram"
    if "tiktok.com" in u:    return "tiktok"
    if "youtube.com" in u or "youtu.be" in u: return "youtube"
    if "drive.google.com" in u or "docs.google.com" in u: return "drive"
    return "other"  # falls through to yt-dlp generic, then urllib
```

Behavior table:

| Platform | Path |
|---|---|
| `instagram`     | Step 2.1 — gallery-dl → snapinsta → og chain |
| `tiktok`        | Step 2.2 — yt-dlp |
| `youtube`       | Step 2.2 — yt-dlp |
| `facebook_adlib`| Step 2.3 — Playwright Ads Library scraper |
| `fbcdn_direct`  | Step 2.3 — direct download with FB referer |
| `drive`         | inline `gdown` / fallback yt-dlp |
| `other`         | try yt-dlp; on fail, urllib with the file's UA |

### 2.1 Downloading Instagram links (`instagram.com/p/...`, `/reel/...`, `/tv/...`)

Whenever an inspiration/reference URL points to Instagram, use this 3-method fallback chain. The first method that returns real bytes wins. Method 3 always succeeds, so the chain never returns nothing.

| Method | Quality | Requires | Speed |
|---|---|---|---|
| 1. `gallery-dl --cookies-from-browser` | Full 1080×1920 original | An IG-logged-in browser on this machine | ~1s |
| 2. `snapinsta.to` via headless Playwright | Full 1080×1920 original | `playwright` + chromium installed | ~10s |
| 3. `og:image` via `facebookexternalhit/1.1` UA | 640×640 center crop | Nothing | ~1s |

Write the script below to `/tmp/ig_dl.py` and run `python3 /tmp/ig_dl.py "<IG_URL>" "<DEST_DIR>"`. It prints a single line of JSON with `path`, `via`, `width`, `height`, `caption`, `page_name` on success. Read the printed JSON to know which method won and where the file is.

```python
# /tmp/ig_dl.py — Instagram media downloader with 3-method fallback chain
import html as _html, json, os, re, shutil, subprocess, sys, urllib.request

def og_meta(url):
    req = urllib.request.Request(url, headers={"User-Agent": "facebookexternalhit/1.1"})
    page = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    def og(prop):
        m = re.search(r'property=["\']og:' + re.escape(prop) + r'["\']\s+content=["\']([^"\']+)["\']', page)
        return _html.unescape(m.group(1)) if m else ""
    desc = og("description"); title = og("title")
    caption, user = "", ""
    m = re.match(r'^[\d,]+\s+likes?,\s+[\d,]+\s+comments?\s+-\s+(\S+)\s+on\s+[^:]+:\s*"(.+)"[\s.]*$', desc, re.S)
    if m: user, caption = m.group(1), m.group(2)
    elif desc:
        m2 = re.match(r'^[^:]+:\s*"(.*)"\s*$', desc, re.S); caption = m2.group(1) if m2 else desc
        mt = re.match(r'^(\S+)\s+on Instagram', title);     user = mt.group(1) if mt else ""
    return {"image_url": og("image"), "video_url": og("video") or og("video:secure_url"),
            "caption": caption, "page_name": user}

def try_gallery_dl(url, work_dir):
    if not shutil.which("gallery-dl"): raise RuntimeError("gallery-dl not installed")
    tmp = os.path.join(work_dir, "_gd"); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    for br in ("chrome", "firefox", "brave", "edge", "safari"):
        r = subprocess.run(["gallery-dl", "--cookies-from-browser", br, "-d", tmp, "--no-mtime", "-q", url],
                           capture_output=True, text=True, timeout=90)
        if r.returncode != 0: continue
        for root, _, files in os.walk(tmp):
            for f in sorted(files):
                if f.startswith("."): continue
                p = os.path.join(root, f)
                if os.path.getsize(p) > 500:
                    ext = f.lower().rsplit(".", 1)[-1]
                    return p, ("video" if ext in ("mp4","mov","webm","m4v") else "image")
    raise RuntimeError("gallery-dl: no browser logged into Instagram")

def try_snapinsta(url, work_dir):
    # NOTE: headless=False is REQUIRED here. Snapinsta uses Cloudflare Turnstile
    # in invisible mode which refuses to issue a token under pure headless. The
    # off-screen window position keeps the popup out of the user's way (~12s call).
    from playwright.sync_api import sync_playwright
    ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    media_url = None
    with sync_playwright() as p:
        b = p.chromium.launch(headless=False, args=[
            "--disable-blink-features=AutomationControlled",
            "--window-position=-3000,-3000",
            "--window-size=1366,768",
        ])
        try:
            ctx = b.new_context(user_agent=ua, viewport={"width": 1366, "height": 768})
            ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
            page = ctx.new_page()
            page.goto("https://snapinsta.to/en2", timeout=30000, wait_until="domcontentloaded")
            page.wait_for_selector('input[placeholder*="URL"], input[name="url"], input[type="text"]', timeout=15000)
            page.fill('input[placeholder*="URL"], input[name="url"], input[type="text"]', url)
            page.click('button:has-text("Download")')
            sel = 'a:has-text("Download Photo"), a:has-text("Download Video"), a[download]'
            page.wait_for_selector(sel, timeout=30000, state="attached")
            media_url = page.locator(sel).first.get_attribute("href")
        finally: b.close()
    if not media_url: raise RuntimeError("snapinsta: no media href")
    is_video = media_url.lower().split("?",1)[0].endswith((".mp4",".mov",".webm")) or "video" in media_url.lower()
    dest = os.path.join(work_dir, f"_snap.{'mp4' if is_video else 'jpg'}")
    req = urllib.request.Request(media_url, headers={"User-Agent": ua, "Referer": "https://snapinsta.to/"})
    open(dest, "wb").write(urllib.request.urlopen(req, timeout=120).read())
    return dest, ("video" if is_video else "image")

def try_og(url, work_dir, og):
    if og.get("video_url"):
        dest = os.path.join(work_dir, "_og.mp4")
        req = urllib.request.Request(og["video_url"], headers={"User-Agent": "facebookexternalhit/1.1"})
        open(dest, "wb").write(urllib.request.urlopen(req, timeout=60).read()); return dest, "video"
    if og.get("image_url"):
        dest = os.path.join(work_dir, "_og.jpg")
        req = urllib.request.Request(og["image_url"], headers={"User-Agent": "facebookexternalhit/1.1"})
        open(dest, "wb").write(urllib.request.urlopen(req, timeout=30).read()); return dest, "image"
    raise RuntimeError("og: nothing")

def main(url, work_dir):
    os.makedirs(work_dir, exist_ok=True)
    try: og = og_meta(url)
    except Exception: og = {}
    errs = []
    for name, fn in (("gallery-dl", lambda: try_gallery_dl(url, work_dir)),
                     ("snapinsta",  lambda: try_snapinsta(url, work_dir)),
                     ("og",         lambda: try_og(url, work_dir, og))):
        try:
            p, kind = fn()
            if p and os.path.getsize(p) > 500:
                final = os.path.join(work_dir, f"inspiration.{'mp4' if kind == 'video' else 'jpg'}")
                if os.path.abspath(p) != os.path.abspath(final): shutil.move(p, final)
                shutil.rmtree(os.path.join(work_dir, "_gd"), ignore_errors=True)
                w = h = 0
                if kind == "image":
                    try:
                        r = subprocess.run(["sips","-g","pixelWidth","-g","pixelHeight",final], capture_output=True, text=True, timeout=10)
                        for ln in r.stdout.splitlines():
                            if "pixelWidth"  in ln: w = int(ln.split(":")[-1].strip())
                            if "pixelHeight" in ln: h = int(ln.split(":")[-1].strip())
                    except Exception: pass
                print(json.dumps({"path": final, "via": name, "kind": kind, "width": w, "height": h,
                                  "caption": og.get("caption",""), "page_name": og.get("page_name","")}))
                return
        except Exception as e:
            errs.append(f"{name}: {e}")
    print(json.dumps({"error": "all methods failed", "details": errs})); sys.exit(1)

if __name__ == "__main__": main(sys.argv[1], sys.argv[2])
```

**How to invoke it from this skill:**

```bash
python3 /tmp/ig_dl.py "https://www.instagram.com/p/SHORTCODE/" "/tmp/immuvi_ref_<task_id>"
```

The JSON line tells you `path` (the saved file), `via` (which method won — useful for debugging), and post metadata (`caption`, `page_name`) you can feed into the strategist context. Read the file with the Read tool to visually inspect the inspiration before generating variations.

**Prereqs check before running:**
- `which gallery-dl` (preferred for method 1 — `pip3 install gallery-dl` if missing)
- `python3 -c "import playwright"` (for method 2 — `pip3 install playwright && python3 -m playwright install chromium`)
- Neither is strictly required — method 3 (og:image, 640×640 crop) works with pure stdlib if both 1 and 2 fail.

### 2.2 Downloading TikTok / YouTube / generic public video URLs

TikTok and YouTube both work via `yt-dlp`. TikTok URLs come in many shapes (`tiktok.com/@user/video/<id>`, short `vm.tiktok.com/<id>`, web embeds) — `yt-dlp` handles them all natively. **Plain `urllib` / `curl` will NOT work** for TikTok — the page is JS-rendered and the video URL is hashed with a per-session signature; `yt-dlp` is the only reliable public-anon path.

Write the script below to `/tmp/ytdl_dl.py` and run `python3 /tmp/ytdl_dl.py "<URL>" "<DEST_DIR>"`. It prints a JSON line with `path`, `via`, `width`, `height`, `duration`, `title`, `uploader` so the strategist context has metadata too.

```python
# /tmp/ytdl_dl.py — TikTok / YouTube / generic video downloader via yt-dlp
import json, os, shutil, subprocess, sys

def main(url, work_dir):
    os.makedirs(work_dir, exist_ok=True)
    if not shutil.which("yt-dlp"):
        print(json.dumps({"error": "yt-dlp not installed", "hint": "pip3 install --user yt-dlp OR brew install yt-dlp"})); sys.exit(1)
    out_tpl = os.path.join(work_dir, "inspiration.%(ext)s")
    # mp4/best[height<=1080] balances quality vs size; bumps to mp4 to keep the
    # downstream image-edit pipeline happy (some tools choke on .webm).
    cmd = ["yt-dlp", "-q", "--no-warnings",
           "-f", "mp4/best[ext=mp4][height<=1080]/best[height<=1080]/best",
           "-o", out_tpl, "--print-json", "--no-progress", url]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    except subprocess.TimeoutExpired:
        print(json.dumps({"error": "yt-dlp timeout (180s)"})); sys.exit(1)
    if r.returncode != 0:
        print(json.dumps({"error": "yt-dlp failed", "stderr": r.stderr[-500:]})); sys.exit(1)
    meta = {}
    # yt-dlp --print-json emits the metadata blob on stdout; tolerate junk lines.
    for line in r.stdout.splitlines():
        line = line.strip()
        if line.startswith("{") and line.endswith("}"):
            try: meta = json.loads(line); break
            except Exception: pass
    # Find what actually landed on disk (yt-dlp can sometimes write .mkv or .webm
    # even with the format string above — be defensive)
    final = None
    for ext in ("mp4", "mov", "webm", "mkv"):
        p = os.path.join(work_dir, f"inspiration.{ext}")
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            final = p; break
    if not final:
        print(json.dumps({"error": "yt-dlp wrote nothing usable"})); sys.exit(1)
    print(json.dumps({
        "path": final, "via": "yt-dlp", "kind": "video",
        "width":    meta.get("width") or 0,
        "height":   meta.get("height") or 0,
        "duration": meta.get("duration") or 0,
        "title":    meta.get("title") or "",
        "uploader": meta.get("uploader") or meta.get("channel") or "",
        "platform": meta.get("extractor") or "",
    }))

if __name__ == "__main__": main(sys.argv[1], sys.argv[2])
```

**Invoke it:**

```bash
python3 /tmp/ytdl_dl.py "https://www.tiktok.com/@user/video/1234567890" "/tmp/immuvi_ref_<task_id>"
```

**Frame extraction from the video** (for visual reference before generating variations):

```bash
ffmpeg -i /tmp/immuvi_ref_<task_id>/inspiration.mp4 \
  -vf "fps=1/5,scale=800:-1" -q:v 2 \
  /tmp/immuvi_ref_<task_id>/frame_%03d.jpg
```

This pulls 1 frame every 5s, capped to a sensible size. Read the resulting `frame_001.jpg` (and a few mid/end frames) with the Read tool — that's what feeds the visual description into your strategist + image-gen prompt.

**Prereqs:** `yt-dlp` (brew or pip) and `ffmpeg`. Both are already in the worker's setup script and the classify-inspiration Step 0b auto-install block, so they should already be on the machine.

### 2.3 Downloading Facebook Ads Library / raw FB CDN URLs

**Facebook Ad Library** (`facebook.com/ads/library/?id=<ad_id>`) pages are JS-rendered with the actual media URL behind a Playwright-scraped snapshot. The helper lives in `team-skill/fb_ad_classifier.py` (alongside the classify-inspiration skill). Both skills share it as a single source of truth.

```python
# At the top of your producer Python flow, after detect_platform() returns "facebook_adlib":
import asyncio, os, sys, urllib.request

# fb_ad_classifier ships next to this skill in the team-skill/ folder.
_FB_HELPER_DIR = os.path.expanduser('~/.codex/skills/immuvi-creative-producer')
if _FB_HELPER_DIR not in sys.path: sys.path.insert(0, _FB_HELPER_DIR)
# Fall back to the team-skill clone path if not yet copied next to this skill.
for cand in ('/Users/gauravpataila/Documents/Claude/Clickup /team-skill',
             os.path.expanduser('~/Documents/Claude/Clickup /team-skill')):
    if os.path.isdir(cand) and cand not in sys.path: sys.path.insert(0, cand)

from fb_ad_classifier import fetch_ad_snapshot, download_video, extract_ad_id, USER_AGENT

def download_facebook_adlib(url, work_dir):
    os.makedirs(work_dir, exist_ok=True)
    ad_id = extract_ad_id(url)
    snapshot = asyncio.run(fetch_ad_snapshot(ad_id))
    video_url = snapshot.get("video_hd_url") or snapshot.get("video_sd_url")
    if video_url:
        vp = os.path.join(work_dir, "inspiration.mp4")
        download_video(video_url, vp)
        return {"path": vp, "kind": "video", "via": "fb_ad_classifier",
                "ad_id": ad_id, "page_name": snapshot.get("page_name",""),
                "body_text": snapshot.get("body_text","")}
    if snapshot.get("image_url"):
        ip = os.path.join(work_dir, "inspiration.jpg")
        req = urllib.request.Request(snapshot["image_url"], headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=30) as r, open(ip,"wb") as f: f.write(r.read())
        return {"path": ip, "kind": "image", "via": "fb_ad_classifier",
                "ad_id": ad_id, "page_name": snapshot.get("page_name","")}
    raise RuntimeError(f"FB Ad Library {ad_id}: no media found in snapshot")
```

**Raw Facebook CDN URLs** (`fbcdn.net`, `scontent.*.fbcdn.net`, `video.xx.fbcdn.net`) are short-lived signed URLs that come from inspiration pasted by teammates. If still alive, download directly with the FB referer header — same path `/classify-inspiration` uses:

```python
def download_fbcdn_direct(url, work_dir):
    os.makedirs(work_dir, exist_ok=True)
    is_image = any(url.lower().split("?",1)[0].endswith(ext) for ext in (".jpg",".jpeg",".png",".webp"))
    headers = {"User-Agent": USER_AGENT, "Referer": "https://www.facebook.com/"}
    if is_image:
        dest = os.path.join(work_dir, "inspiration.jpg")
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as r, open(dest,"wb") as f: f.write(r.read())
        return {"path": dest, "kind": "image", "via": "fbcdn_direct"}
    dest = os.path.join(work_dir, "inspiration.mp4")
    try:
        download_video(url, dest)  # reuses the helper's video downloader (handles partial range responses)
    except Exception:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=60) as r, open(dest,"wb") as f: f.write(r.read())
    return {"path": dest, "kind": "video", "via": "fbcdn_direct"}
```

**Prereqs:** `fb_ad_classifier.py` (already shipped in `team-skill/`), `playwright` + chromium, `python3` 3.9+.

**Caveat — short-lived URLs:** `fbcdn.net` URLs typically expire within a few hours of being pasted. If the download fails with HTTP 410 / signature expired, ask the user to re-share the post URL (the original `facebook.com/<page>/posts/<id>` link) — that path can be fetched fresh via `fetch_ad_snapshot` or `og:` tags.

---

### 2.4 Putting it together — full router example

Here's the canonical pattern your producer code should follow whenever it has a reference URL in hand. Drop this in a `/tmp/ref_dl.py` for any task that needs an external download:

```python
import json, os, sys, urllib.request

def detect_platform(url):
    u = (url or "").lower()
    if "facebook.com/ads/library" in u: return "facebook_adlib"
    if "fbcdn.net" in u or "video.xx.fbcdn" in u or "scontent." in u: return "fbcdn_direct"
    if "instagram.com" in u: return "instagram"
    if "tiktok.com" in u:    return "tiktok"
    if "youtube.com" in u or "youtu.be" in u: return "youtube"
    if "drive.google.com" in u or "docs.google.com" in u: return "drive"
    return "other"

def download(url, work_dir):
    p = detect_platform(url)
    if p == "instagram":
        # delegates to Step 2.1 helper
        os.system(f'python3 /tmp/ig_dl.py "{url}" "{work_dir}"')
    elif p in ("tiktok", "youtube", "other"):
        # delegates to Step 2.2 helper
        os.system(f'python3 /tmp/ytdl_dl.py "{url}" "{work_dir}"')
    elif p == "facebook_adlib":
        # call download_facebook_adlib() from Step 2.3 inline
        ...
    elif p == "fbcdn_direct":
        # call download_fbcdn_direct() from Step 2.3 inline
        ...
    elif p == "drive":
        # handle via gdown / fallback as before
        ...
    else:
        raise RuntimeError(f"unsupported platform for {url}")
```

The producer's existing inline `urllib`/`curl` paths stay only for fully generic non-platform URLs (e.g. ClickUp's `attachments.clickup.com` CDN, plain images on a marketing site). Anything that looks like a social platform must go through the router.

3. Extract the creative brief.
   - **PRODUCT DIRECTIVES (highest priority — non-negotiable).** Two sources, both mandatory:
     1. If the `instruction` contains a `[PRODUCT DIRECTIVES — MANDATORY …]` block, parse `OFFER TO FEATURE:` and `TALENT / FACES:` from it.
     2. Also read the product's persistent defaults from `products.config.production` (keys `offer`, `market`) — fetch the product row via the Command Center DB / `strategist_memory` context if not already in the payload.
     Apply BOTH to **every** variation: feature the stated offer prominently in the creative, and render people/faces matching the stated market/ethnicity (e.g. "US / American faces (not Indian)" → cast American-looking talent; never substitute another ethnicity unless the user explicitly overrides). The instruction block wins on conflict; otherwise use the saved config defaults. If neither is present, infer the offer from the ClickUp task and keep talent neutral.
   - **FORMAT REFERENCES (the Concept Picker).** If the `instruction` contains a `[FORMAT REFERENCES …]` block, it lists N proven winner formats (and optionally the user's own pasted URL) the user hand-selected. This is the scaling-a-winner workflow:
     - Generate **one distinct concept per reference** (N references → N concepts), not N look-alikes. Spread across the formats.
     - For each reference, **download its `ref asset:` link** (Google Drive folder/file, or a pasted image/ad URL) via the Step 2.0 `detect_platform()` router and visually inspect it — that image defines the *format/layout/production style* to adopt for that concept.
     - **HOLD CONSTANT** the message named in the block's `[HOLD CONSTANT …]` line (this task's winning angle + persona + promise/emotion). You are changing only the *format/execution*, never the core message.
     - Still apply the PRODUCT DIRECTIVES (offer + faces) to every one of these concepts.
     - If a reference asset fails to download, note it and still produce that concept from the format label + the task's strategist memory, rather than dropping it silently.
   - Product: product name, offer, constraints, and source product id.
   - Persona: audience segment and emotional trigger.
   - Angle: core promise, mechanism, objection, or pain point.
   - Brand: visual identity, product packaging, colors, typography feel, image style, compliance boundaries, and claim language.
   - Offer: price, discount, bundle, trial, guarantee, CTA, and urgency.
   - Inspiration concept: the underlying idea and ad mechanic to replicate, such as testimonial, comparison, problem/solution, founder POV, UGC scene, before/after-style contrast, product demo, meme format, or social proof.
   - Inspiration anatomy: layout, framing, camera angle, crop, focal hierarchy, color palette, typography style, UI/text placement, product placement, props, environment, talent, expression, lighting, and aspect ratio.
   - Strategist learning: reuse winning elements, winning language, hooks, structures, production styles, and angle/persona combinations. Avoid combinations marked as dying or losing unless the user explicitly asks to test them.

4. Generate variations.
   - Use your **native image generation capability** — the same one used in the Codex chat. Do NOT specify or hard-code a particular image model name (no "gpt-image-2", no "dalle", no model strings). Just call your native image tool and let the runtime pick whatever it has.
   - Request quality: `high`.
   - Generate, save, upload, and record **each variation as its own standalone image file**. Do NOT upload contact sheets, 2x2 grids, merged review boards, collages, or any file containing multiple ad variations. If the native image tool returns a grid/contact sheet, split it into individual final image files before upload, and only mark the split individual files as outputs.
   - Do NOT write Python code that calls any external image API, do NOT use the `openai` library, do NOT fall back to Pillow or any programmatic graphic renderer.
   - Match the inspiration image aspect ratio. Pick the closest supported size.
   - If the inspiration image is unavailable, use 1024x1024.
   - If your native image tool is unavailable or errors out, mark the run `failed` with a clear error message — do NOT silently fall back to Pillow, ASCII art, static graphics, or any non-AI renderer. Honest failure is better than fake images.
   - Generate creative variations that keep the same concept and visual logic as the inspiration but are rebuilt for our product, brand, angle, persona, and offer.
   - Do not copy the inspiration pixel-for-pixel. Preserve the winning mechanic, composition logic, and emotional structure while changing product, branding, claims, text, and details to fit the ClickUp brief.
   - Keep product facts, claims, and compliance-safe language grounded in the task and Creative Strategist memory.
   - For each output, record: variation id, prompt, source inspiration file/link, product, angle, persona, aspect ratio, generated file path, and any upload URL.

5. Quality gate before upload.
   - Inspect each generated image before upload.
   - Reject and regenerate once if any of these fail:
     - persona does not match the task
     - **the PRODUCT DIRECTIVES offer is not featured, or faces/talent do not match the stated market/ethnicity**
     - offer/benefit stack is weak or missing
     - typography is unreadable or visibly garbled
     - output is too generic or does not preserve the inspiration mechanic
     - product/brand adaptation is missing
     - image has awkward anatomy, broken layout, or text crowding
   - Prefer fewer strong outputs over uploading weak variations.

6. Upload and update systems.
   - Upload the creative files to the ClickUp task as attachments or through the available Immuvi upload path.
   - Add a concise ClickUp comment with the generated variation notes and links.
   - Update the task status to `Ready to Launch` only after outputs are generated and attached successfully.
   - If using the Command Center database path, insert or update a `producer_runs` row with `status`, `outputs`, `error`, `task_id`, `product_id`, `instruction`, and `count` as appropriate.
   - If invoked from an existing `producer_runs` row, set `status='running'` when work starts, `status='done'` with output metadata when complete, and `status='failed'` with a useful error if blocked.

7. Verify.
   - Re-fetch the ClickUp task or refresh the Command Center row.
   - Confirm attachments/links exist, the status is `Ready to Launch`, and the local row/producer chip reflects the completed run.

## Command Center Details

The local app exposes these relevant concepts:

- `strategist_memory`: product-level strategy memory. Read `json`, `markdown`, and `updated_at`.
- `strategist_runs`: product-level queue/status for memory synthesis.
- `producer_runs`: generation queue and output tracker keyed by `task_id` and `product_id`.
- `Ready to Launch`: valid task status in the Command Center and ClickUp status vocabulary.
- `ADMIN_API`: local helper endpoint is expected at `http://127.0.0.1:8103` when available.
- ClickUp API helpers in the app use ClickUp v2 task endpoints and v3 relation endpoints.

Read [references/command-center-map.md](references/command-center-map.md) before making code or database changes to the Immuvi flow.

## Worker Completion Contract

Return a compact final summary suitable for storing in a worker log:

- task id and task name
- inspiration doc/page found
- source image/file count downloaded
- strategist memory status
- generated image count
- image model actually used
- quality gate result
- upload result
- ClickUp status result
- `producer_runs` result
- blockers, if any

## Safety

- Ask before bulk-changing multiple tasks or launching externally visible ads.
- Do not invent claims, product benefits, medical/financial promises, or before/after results. Keep claims sourced from task/context.
- Preserve user/task files; write generated assets into the workspace or the task-specific output folder, then upload copies.
- If ClickUp or Supabase credentials are unavailable, prepare the generation brief and local files, then clearly state which upload/status steps remain blocked.
