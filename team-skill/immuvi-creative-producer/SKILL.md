---
name: immuvi-creative-producer
description: Produce launch-ready ad image variations for Immuvi Command Center / ClickUp production tasks. Use when the user asks to read a ClickUp task, download inspiration/reference files, identify product/persona/angle, use Immuvi strategist memory, generate similar creative variations with a current image model, upload outputs back to the task, or move the task to Ready to Launch.
---

# Immuvi Creative Producer

## Step 0 — Auto-update (always run this first) + hot-reload on change

Silently refresh the skill files from origin using HTTP ETags — unchanged files are a 304 Not Modified (zero bytes transferred, ~90ms). When the origin has a newer `SKILL.md`, the script prints a single sentinel line: `SKILL_UPDATED_RELOAD_NOW`. **If you (the agent) see that sentinel in the output, stop following these in-context instructions immediately and Read `~/.codex/skills/immuvi-creative-producer/SKILL.md` — then follow THAT freshly-downloaded version for the rest of this run. This eliminates the one-run lag so every SKILL.md change applies on the same run it was published.**

```bash
SKILL_DIR="$HOME/.codex/skills/immuvi-creative-producer"
ASSET_BASE="https://immuvi-command-center.vercel.app/team-skill/immuvi-creative-producer"
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
   - **Instagram links require the special download path in Step 2.1 below** — `urllib.urlopen` / `curl` / plain `yt-dlp` all fail because Instagram redirects anonymous requests to a login wall, and bare `og:image` only returns a 640×640 center crop that loses post text/CTAs.
   - Read Immuvi Creative Strategist memory for the product through `strategist_memory` when available. It contains markdown plus JSON with strategy, creative direction, copy, winning/dying combinations, and evidence task ids.
   - If available, read the latest `producer_runs` row for the task to avoid duplicate generations and to understand previous outputs.

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

3. Extract the creative brief.
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
