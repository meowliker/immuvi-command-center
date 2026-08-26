---
name: classify-inspiration
description: Classify competitor ad URLs for the Immuvi Command Center. Reads pending items from the Supabase `inspiration_queue` table, downloads video/frames, classifies using Claude vision, creates ClickUp doc pages with 8-section creative briefs, writes results to Supabase `inspiration_results`. Bridge/localhost/JSON files are deprecated as of April 2026.
---

# Classify Inspiration Skill (Supabase-native)

This skill reads the queue and writes results directly to Supabase — no more local bridge, no `/tmp` JSON files. Anyone on the team can queue a URL from the live dashboard; you (running Claude locally with ffmpeg) classify; results stream back to the team's browser in real time.

## Prerequisites (installed by `install-skill.sh`)

- **System:** `ffmpeg`, `yt-dlp` (`brew install ffmpeg yt-dlp`)
- **Python:** `psycopg2-binary`, `requests`, `playwright` (`pip3 install --user`) and `python3 -m playwright install chromium`
- **Env file:** `~/.classify-inspiration.env` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_DB_PASSWORD`
- **Bundled:** `fb_ad_classifier.py` must sit next to this `SKILL.md` in the active agent skill directory (`~/.codex/skills/classify-inspiration/` for Codex, `~/.claude/skills/classify-inspiration/` for Claude).

---

## Step 0 — Auto-update (always run this first) + hot-reload on change

Silently refresh the skill files from origin into both Codex and Claude skill homes. When the origin has a newer `SKILL.md`, the script prints a single sentinel line: `SKILL_UPDATED_RELOAD_NOW`. **If you (the agent) see that sentinel in the output, stop following these in-context instructions immediately and Read the refreshed `SKILL.md` from your active agent home (`~/.codex/skills/classify-inspiration/SKILL.md` for Codex, `~/.claude/skills/classify-inspiration/SKILL.md` for Claude) — then follow THAT freshly-downloaded version for the rest of this run. This eliminates the one-run lag so every SKILL.md change applies on the same run it was published.** (`fb_ad_classifier.py` is re-imported every run anyway, so Python changes take effect immediately with no reload needed.)

```bash
ASSET_BASE="https://immuvi-command-center.vercel.app/team-skill"
SKILL_MD_UPDATED=0
SKILL_DIRS="$HOME/.codex/skills/classify-inspiration $HOME/.claude/skills/classify-inspiration"

for f in SKILL.md fb_ad_classifier.py; do
  tmp_body="/tmp/classify-inspiration.$f.body.$$"
  http=$(curl -sS --max-time 10 -o "$tmp_body" -w "%{http_code}" "$ASSET_BASE/$f" 2>/dev/null) || http=""
  [ "$http" = "200" ] || { rm -f "$tmp_body"; continue; }
  for SKILL_DIR in $SKILL_DIRS; do
    mkdir -p "$SKILL_DIR"
    file_path="$SKILL_DIR/$f"
    if [ ! -f "$file_path" ] || ! cmp -s "$tmp_body" "$file_path"; then
      cp "$tmp_body" "$file_path"
      [ "$f" = "SKILL.md" ] && SKILL_MD_UPDATED=1
    fi
  done
  rm -f "$tmp_body"
done

if [ "$SKILL_MD_UPDATED" = "1" ]; then
  echo "SKILL_UPDATED_RELOAD_NOW"
  echo "[skill-update] A newer SKILL.md was downloaded to Codex/Claude skill homes — reload the active agent copy before continuing."
fi
```

Fails silently on network errors and continues with the on-disk copy.

**Agent reload protocol when you see `SKILL_UPDATED_RELOAD_NOW`:**

1. Call `Read` on the refreshed active-agent copy: `~/.codex/skills/classify-inspiration/SKILL.md` for Codex or `~/.claude/skills/classify-inspiration/SKILL.md` for Claude (the full file — no offset/limit).
2. Discard the version of the instructions currently in your context from Steps 1–8; follow the freshly-read file end-to-end instead.
3. Do not re-run Step 0 after the reload (it just ran — no ETag drift in the same second).
4. Continue from Step 1 of the newly-read instructions.

**One-time lag disclaimer:** this reload protocol only activates once a teammate has already picked up *this* version of Step 0. The first update after introducing the reload protocol still takes one run to propagate (their old Step 0 silently downloads the new file but doesn't print the sentinel). Every update after that applies on the same run it was published.

---

## Env loader helper (referenced in every shell step below)

Whenever a step says `source_env` (or shows the env-loader block), it means:

```bash
for _p in "$HOME/.classify-inspiration.env" "$PWD/.env" "$HOME/.env"; do
  [ -f "$_p" ] && { set -a; source "$_p"; set +a; break; }
done
```

This finds the first `.env` file in the fallback chain and exports all its
non-comment variables. Installed by `install-skill.sh` into
`~/.classify-inspiration.env`.

---

## Connection details

- **Supabase URL:** `https://hdniumnkprkadlrrataz.supabase.co`
- **Service role key:** loaded by the installer into `~/.classify-inspiration.env` (key `SUPABASE_SERVICE_ROLE_KEY`). Never commit this key.
- **Direct Postgres connection string:** stored in same `.env` as `SUPABASE_DB_URL` (host: `db.hdniumnkprkadlrrataz.supabase.co`).

Throughout this skill, export the env vars at the start of every shell step:

```bash
# Portable env loader — reads from ~/.classify-inspiration.env (set by installer).
# Fallback chain: ~/.classify-inspiration.env → $PWD/.env → ~/.env.
for _p in "$HOME/.classify-inspiration.env" "$PWD/.env" "$HOME/.env"; do
  [ -f "$_p" ] && { set -a; source "$_p"; set +a; break; }
done
```

## ClickUp constants (shared across all product docs)

- **Workspace ID:** `9016762494`
- **Inspiration Library folder ID:** `90169348848` (inside space `90162807791`). **ALL product inspiration-library docs created by this skill MUST be parented here** so the team has one clean folder view.
- **Parent payload for `clickup_create_document`:** `{"id": "90169348848", "type": "5"}` — type 5 = folder.
- **Naming convention for new product libs:** `"[PRODUCT_NAME_UPPERCASE] — Inspiration Library"`
- **Default page created by `clickup_create_document` with `create_page=true`:** starts unnamed. Always rename it to `"📋 Master Tracker"` and seed it with the empty-tracker template (see Step 6.5) before creating any inspiration pages.

---

## Step 1 — Pull the queue from Supabase

```bash
# Portable env loader — reads from ~/.classify-inspiration.env (set by installer).
# Fallback chain: ~/.classify-inspiration.env → $PWD/.env → ~/.env.
for _p in "$HOME/.classify-inspiration.env" "$PWD/.env" "$HOME/.env"; do
  [ -f "$_p" ] && { set -a; source "$_p"; set +a; break; }
done

# Get pending items — all of them, across products. Each row has product_id, ins_id, url, platform.
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$SUPABASE_DB_URL" -At -F$'\t' -c "
  select q.ins_id, q.product_id, q.url, q.platform, p.name as product_name, p.config->>'doc_id' as doc_id
  from public.inspiration_queue q
  join public.products p on p.id = q.product_id
  where q.status = 'pending'
  order by q.queued_at asc
" 2>/dev/null
```

Parse the TSV: each line is `ins_id\tproduct_id\turl\tplatform\tproduct_name\tdoc_id`.

**Exclude items already classified** — skip any queue row whose `ins_id` + `product_id` combo already exists in `inspiration_results`:

```bash
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$SUPABASE_DB_URL" -At -F$'\t' -c "
  select ins_id, product_id from public.inspiration_results
"
```

Remove from the work list any items whose `(ins_id, product_id)` appears in the results set.

**Load the product's angles and personas** so you can classify with context:

```bash
# For the product_id(s) being processed, fetch angle + persona name lists
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$SUPABASE_DB_URL" -At -c "
  select string_agg(name, ', ') from public.angles where product_id = '<PRODUCT_ID>'
"
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$SUPABASE_DB_URL" -At -c "
  select string_agg(name, ', ') from public.personas where product_id = '<PRODUCT_ID>'
"
```

**Print status and stop early if nothing to do:**
- Empty queue → tell user "No pending items in inspiration_queue. Queue some URLs from the dashboard." Stop.
- All items already classified → "All queued items already processed. Nothing new to do." Stop.
- Otherwise → print the N items to be processed with their IDs + truncated URLs.

**Do not mark items as `processing` manually.** The worker owns queue state
(`pending` → `claimed` → `classifying` → `classified`/`failed`) so multiple
machines can safely split work without stranding rows.

---

## Step 2 — Dispatch parallel agents (one per item)

**1 item** → process inline (Steps 3–4 directly).

**2+ items** → spawn one agent per item in parallel using the Agent tool. Each agent handles Steps 3–4 (classification + frames + result write). Paste this self-contained prompt per agent, filling in real values:

```
You are classifying a single competitor ad creative.

YOUR ITEM:
- INS_ID:     [INS-XXX]
- PRODUCT_ID: [prod-XXX]
- URL:        [url]
- Platform:   [facebook/instagram/tiktok/etc]

CONTEXT:
- Angles:   [comma-separated list or "none provided"]
- Personas: [comma-separated list or "none provided"]

ENVIRONMENT:
Before running shell commands, export env:
  # Portable env loader — reads from ~/.classify-inspiration.env (set by installer).
# Fallback chain: ~/.classify-inspiration.env → $PWD/.env → ~/.env.
for _p in "$HOME/.classify-inspiration.env" "$PWD/.env" "$HOME/.env"; do
  [ -f "$_p" ] && { set -a; source "$_p"; set +a; break; }
done

TASK:
1. Save the pipeline script (see below) to /tmp/ins_pipeline_[INS_ID].py
2. Run it: python3 /tmp/ins_pipeline_[INS_ID].py "[URL]" "/tmp/ins_work_[INS_ID]"
3. Read each produced frame with the Read tool (up to 6 frames)
4. Classify using the dimensions in Step 4
5. Insert the classification into Supabase `public.inspiration_results` via psql
6. If you were invoked by the worker, do not update `public.inspiration_queue`;
   the worker verifies the result and marks the row classified. If you are
   running this skill manually without the worker, update the row to
   status='classified', processed_at=now().
7. Clean up: rm -rf /tmp/ins_work_[INS_ID] /tmp/ins_pipeline_[INS_ID].py
8. Print: "DONE [INS_ID]: [hook_type] | [creative_structure] | [funnel_type]"

[paste full pipeline script from Step 3]
[paste classification dimensions from Step 4]
[paste result-write SQL from Step 5]
```

Wait for ALL agents to complete before moving to Step 6 (doc page creation).

---

## Step 3 — Pipeline script (unchanged from bridge version)

Same Python script as before — downloads the video/image, extracts frames, returns metadata. Save to `/tmp/ins_pipeline_[INS_ID].py`:

```python
import asyncio, json, os, re, shutil, subprocess, sys, urllib.request

for _SKILL_DIR in (
    os.path.expanduser('~/.codex/skills/classify-inspiration'),
    os.path.expanduser('~/.claude/skills/classify-inspiration'),
):
    if os.path.isdir(_SKILL_DIR) and _SKILL_DIR not in sys.path:
        sys.path.insert(0, _SKILL_DIR)
from fb_ad_classifier import fetch_ad_snapshot, download_instagram_media, download_tiktok_media, download_video, extract_frames, extract_ad_id, decode_unicode, USER_AGENT, OUTPUT_BASE

def detect_platform(url):
    u = url.lower()
    if "facebook.com/ads/library" in u: return "facebook"
    if "fbcdn.net" in u or "video.xx.fbcdn" in u or "scontent." in u: return "fbcdn_direct"
    if "instagram.com" in u: return "instagram"
    if "tiktok.com" in u: return "tiktok"
    if "youtube.com" in u or "youtu.be" in u: return "youtube"
    return "other"

def get_duration(vp):
    try:
        r = subprocess.run(["ffprobe","-v","quiet","-print_format","json","-show_streams",vp], capture_output=True, text=True, timeout=15)
        for s in json.loads(r.stdout).get("streams",[]):
            if "duration" in s: return float(s["duration"])
    except: pass
    return 0.0

def _fmt_time(seconds):
    try:
        seconds = max(0, float(seconds))
    except Exception:
        seconds = 0
    minutes = int(seconds // 60)
    secs = int(round(seconds % 60))
    return f"{minutes}:{secs:02d}"

def transcribe_audio(wav_path):
    try:
        import whisper
        model_name = os.environ.get("WHISPER_MODEL", "base")
        model = whisper.load_model(model_name)
        result = model.transcribe(wav_path, fp16=False, verbose=False)
        segments = []
        for seg in result.get("segments") or []:
            text = (seg.get("text") or "").strip()
            if not text:
                continue
            segments.append({
                "time": f"{_fmt_time(seg.get('start', 0))}-{_fmt_time(seg.get('end', 0))}",
                "voice_over": text,
            })
        transcript = " ".join(s["voice_over"] for s in segments).strip()
        return transcript, segments, f"whisper:{model_name}" if transcript else f"whisper:{model_name}:empty"
    except Exception as e:
        return "", [], f"unavailable:{str(e)[:160]}"

def probe_and_transcribe_audio(video_path, work_dir):
    probe = {
        "has_audio": False,
        "has_voice": None,
        "transcript_source": "",
        "error": "",
    }
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", video_path],
            capture_output=True, text=True, timeout=20,
        )
        streams = json.loads(r.stdout or "{}").get("streams", [])
        probe["has_audio"] = any(s.get("codec_type") == "audio" for s in streams)
    except Exception as e:
        probe["error"] = f"ffprobe:{str(e)[:120]}"
    if not probe["has_audio"]:
        probe["has_voice"] = False
        return probe, "No voice over", []

    wav = os.path.join(work_dir, "audio.wav")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", video_path, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", wav],
            capture_output=True, text=True, timeout=60, check=True,
        )
    except Exception as e:
        probe["error"] = f"ffmpeg-audio:{str(e)[:120]}"
        return probe, "", []

    transcript, timeline, source = transcribe_audio(wav)
    probe["transcript_source"] = source
    probe["has_voice"] = bool(transcript) if transcript else None
    return probe, transcript, timeline

def download_ytdlp(url, outdir):
    os.makedirs(outdir, exist_ok=True)
    vp = os.path.join(outdir, "video.mp4")
    subprocess.run(["yt-dlp","--quiet","-f","mp4/best[height<=720]/best","-o",vp,url], capture_output=True, timeout=90, check=True)
    return vp

url = sys.argv[1]
work_dir = sys.argv[2]
os.makedirs(work_dir, exist_ok=True)

platform = detect_platform(url)
snapshot = {}
frames = []
duration = 0.0
audio_probe = {"has_audio": False, "has_voice": False, "transcript_source": "", "error": ""}
voice_over = "No voice over"
voice_over_timeline = []

try:
    if platform == "facebook":
        ad_id = extract_ad_id(url)
        snapshot = asyncio.run(fetch_ad_snapshot(ad_id))
        snapshot["ad_id"] = ad_id
        video_url = snapshot.get("video_hd_url") or snapshot.get("video_sd_url")
        if video_url:
            vp = os.path.join(work_dir, "video.mp4")
            download_video(video_url, vp)
            duration = get_duration(vp)
            frames = extract_frames(vp, work_dir)
            audio_probe, voice_over, voice_over_timeline = probe_and_transcribe_audio(vp, work_dir)
            os.remove(vp)
        elif snapshot.get("image_url"):
            ip = os.path.join(work_dir, "frame_001.jpg")
            req = urllib.request.Request(snapshot["image_url"], headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as r, open(ip,"wb") as f: f.write(r.read())
            frames = [ip]
        else:
            raise RuntimeError("No media found")
    elif platform == "fbcdn_direct":
        # Raw Facebook CDN URL (video.xx.fbcdn.net / scontent.*.fbcdn.net).
        # These are short-lived signed URLs but if still alive, download directly
        # using the same UA + helper as the Ads-Library path.
        is_image = any(url.lower().split("?",1)[0].endswith(ext) for ext in (".jpg",".jpeg",".png",".webp"))
        if is_image:
            ip = os.path.join(work_dir, "frame_001.jpg")
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Referer":"https://www.facebook.com/"})
            with urllib.request.urlopen(req, timeout=30) as r, open(ip,"wb") as f: f.write(r.read())
            frames = [ip]
        else:
            vp = os.path.join(work_dir, "video.mp4")
            try:
                download_video(url, vp)
            except Exception:
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Referer":"https://www.facebook.com/"})
                with urllib.request.urlopen(req, timeout=60) as r, open(vp,"wb") as f: f.write(r.read())
            duration = get_duration(vp)
            frames = extract_frames(vp, work_dir)
            audio_probe, voice_over, voice_over_timeline = probe_and_transcribe_audio(vp, work_dir)
            os.remove(vp)
    elif platform == "instagram":
        # Instagram public media uses the shared robust chain:
        # gallery-dl with browser cookies -> snapinsta via off-screen Playwright
        # -> Open Graph video fallback only. Never accept OG image previews as
        # final media; reels/videos can expose only a preview image with a play
        # icon, which would publish a Video as Photo.
        ig = download_instagram_media(url, work_dir)
        snapshot = ig["metadata"]
        frames = ig["frames"]
        duration = ig["duration"]
        if ig.get("media_path"):
            audio_probe, voice_over, voice_over_timeline = probe_and_transcribe_audio(ig["media_path"], work_dir)
        print(f"[instagram] downloaded via {ig['via']} ({len(frames)} frame(s))", file=sys.stderr)
    elif platform == "tiktok":
        # Do not use browser automation for TikTok downloads. TikTok's web UI
        # commonly blocks automated/browser-save flows behind login or bot
        # checks. Use the helper's non-browser chain instead:
        # direct mp4 resolver -> yt-dlp without cookies -> yt-dlp with Chrome cookies
        # resolver fallback.
        tt = download_tiktok_media(url, work_dir)
        snapshot = tt["metadata"]
        frames = tt["frames"]
        duration = tt["duration"]
        if tt.get("media_path"):
            audio_probe, voice_over, voice_over_timeline = probe_and_transcribe_audio(tt["media_path"], work_dir)
        print(f"[tiktok] downloaded via {tt['via']} ({len(frames)} frame(s))", file=sys.stderr)
    else:
        vp = download_ytdlp(url, work_dir)
        duration = get_duration(vp)
        frames = extract_frames(vp, work_dir)
        audio_probe, voice_over, voice_over_timeline = probe_and_transcribe_audio(vp, work_dir)
        os.remove(vp)

    result = {
        "frames": frames,
        "duration": round(duration, 1),
        "metadata": {
            "body_text": decode_unicode(snapshot.get("body_text") or ""),
            "caption": decode_unicode(snapshot.get("caption") or snapshot.get("body_text") or ""),
            "title": decode_unicode(snapshot.get("title") or ""),
            "page_name": decode_unicode(snapshot.get("page_name") or ""),
            "cta_text": decode_unicode(snapshot.get("cta_text") or ""),
            "cta_type": snapshot.get("cta_type") or "",
            "link_url": snapshot.get("link_url") or snapshot.get("caption") or "",
            "ad_id": snapshot.get("ad_id",""),
            "audio_probe": audio_probe,
            "voice_over": voice_over,
            "voice_over_timeline": voice_over_timeline,
        },
        "error": None
    }
except Exception as e:
    result = {"frames": [], "duration": 0, "metadata": {}, "error": str(e)}

print(json.dumps(result))
```

---

## Step 4 — Visually classify the frames

Read each frame with the **Read tool** (up to 6 frames). You are a senior media buyer. Classify:

| Field | Options |
|---|---|
| media_kind | video, image, carousel — factual downloaded media kind from pipeline output; do not infer this from marketing style |
| photo_video | Video, Photo, Carousel, UGC, VSL, AI Style |
| hook_type | Pain/Problem, Fear, Curiosity, Social Proof, Aspirational, Direct Offer, Controversy/Bold Claim, POV, Question, News/Trend, Pattern Interrupt |
| creative_structure | UGC, Testimonial, Demo, Tutorial/How-To, Story/Narrative, Hook+Offer, Listicle, Static/Photo, Comparison, Interview, Skit/Roleplay, AI/Voiceover, Slideshow/Compilation |
| production_style | Organic/Raw UGC, Polished UGC, Professional Studio, AI Generated, Screen Record, Animation/Motion, Static Graphic, Slideshow, Repurposed Organic, Competitor Inspired |
| funnel_type | TOF, MOF, BOF |
| persona | Exact name from personas list if match ≥60%, else short label (4–6 words) |
| angle | Exact name from angles list if match ≥60%, else short label (2–5 words) |
| creative_usp | "Format Name — scroll-stopping mechanic" in 20 words |
| creative_hypothesis | 2 sentences: why made + why it works. Max 35 words. |
| notes | What you literally see. Max 30 words. |
| hook_text | Primary static hook overlay/card shown on the creative, e.g. a top bubble like "Can your child answer this?". Do not copy this into caption_timeline unless it is the changing subtitle itself. |
| body_copy_from_frames | Backward-compatible visible text summary. Prefer `hook_text + caption_transcript` only; do not use this as voice-over. |
| caption_transcript | Full transcript of changing visible captions/subtitles in reading order. Exclude static hook cards, UI chrome, and platform ad copy. |
| caption_timeline | Array of `{ "time": "0:00-0:03", "caption": "..." }` for every changing visible caption/subtitle. Split the time ranges whenever bottom/active caption text changes. Static hook cards belong in `hook_text`, not here. |
| audio_probe | Pipeline metadata showing whether an audio track exists and whether Whisper produced a transcript. Use this to decide `voice_over`; do not invent audio from frames. |
| voice_over | Transcript of spoken voice-over/narration extracted from audio/transcription if present. Prefer `metadata.voice_over` from the pipeline because it is Whisper/audio-derived. Only include words you can attribute to spoken audio. Do not copy standalone hook text, overlays, or captions into this field. If there is no spoken voice-over, write exactly `No voice over`. If video speech exists but the exact words cannot be verified, leave this blank, explain the uncertainty in `notes`, and treat the item as not ready to mark OK; do not print an unavailable-transcript placeholder in the brief or frame table. |
| voice_over_timeline | Array of `{ "time": "0:00-0:04", "voice_over": "..." }` from audio transcription segments when available. Empty array if no voice-over or transcript unavailable. |
| page_name | From pipeline page_name metadata, or visually identified brand name if pipeline returned empty (Instagram/TikTok). **IMPORTANT:** dashboard reads `metadata.page_name` for the Brand column — always populate this field, even if the pipeline didn't. |
| brand | Same value as page_name (human-readable alias) |
| body_text | From platform ad copy/caption metadata. For Instagram and TikTok this must be the post caption/description when available, not a placeholder telling the user to open the source. |
| title / headline | From title metadata (dashboard reads both keys — write the same value to both) |
| cta_text | English CTA display text. If Facebook supplies a localized `cta_text` but `cta_type` is available, normalize from `cta_type` (example: `SHOP_NOW` → `Shop now`). Keep Hindi or another language only when the ad's CTA is genuinely custom/on-creative in that language and there is no reliable platform CTA type. |
| cta_type | From platform metadata when available |
| landing_url / link_url | From link_url metadata (write to both keys) |
| duration_seconds | From pipeline output |
| media_kind | From pipeline output (`media_kind` / `is_video`); used to guard against Photo/Video inversions |

**Media-type guardrail:** `photo_video` must match `media_kind` for factual media:
- `media_kind=image` → `photo_video` must be `Photo` unless the pipeline explicitly says carousel.
- `media_kind=carousel` → `photo_video` should be `Carousel` or `Photo`, never `Video`.
- `media_kind=video` → `photo_video` must not be `Photo` or `Carousel`.
- Do not use `duration_seconds` alone to decide media kind; TikTok photo posts can have a duration and Instagram reels can sometimes probe as `0`.

**Also build the full 8-section brief data**:

```
FRAME_BY_FRAME: timestamped breakdown with label (HOOK/TENSION/PROOF/BRIDGE/CTA) + one caption/voice-over line + what happens + emotion triggered. Time ranges should follow the spoken transcript when voice-over exists, and split only when a new creative beat starts. If the audio transcript is blank/unverified, use visible caption text or a concise visual beat in the Caption / Voice Over column; never write placeholders such as "audio present; exact transcript not verified".
VOICE_OVER: the spoken voice-over transcript from audio or exactly "No voice over". Never reconstruct voice-over from visible captions unless they are clearly word-for-word subtitles for heard speech. If video speech exists but the exact words cannot be verified, do not mark the item OK; omit the Voice Over line from the brief and explain the uncertainty in notes so the worker can fail/retry instead of publishing a bad brief.
ON_SCREEN_TEXT_TIMING: compact note before the breakdown table for static hook cards or important overlay text that is not part of the spoken script.
WHY_IT_WORKS: 4–5 psychological mechanisms in plain English
REPLICATION_BRIEF: talent, set, key overlay, subtitle style, pacing, music, mid-video, end card
WHAT_TO_TEST: 5 specific variation ideas (one line each: what changes + why)
COMPETITOR_INTEL: brand scale, funnel strategy, our gap, compete or find lane
OUR_NEXT_AD: what to steal, what to do differently, 3-bullet editor brief, hypothesis sentence
NEXT_AD_SCRIPTS: exactly 3 complete next-ad variation scripts for OUR selected product, not the inspiration/competitor product. First extract an `inspiration_script_skeleton`: the opening phrase pattern, beat order, sentence rhythm, time ranges, repeated phrasing, CTA rhythm, and proof/offer sequence from the inspiration's Voice Over or Caption / Voice Over table. Borrow the inspiration's creative mechanic, pacing, emotional trigger, proof structure, table format, and script skeleton. Variation 1 is the reference-faithful script: keep the same opening construction and beat order as the inspiration while swapping only product-specific nouns, problem, proof, offer, and CTA into our product. If the inspiration starts "What to do during [moment] and what to avoid", Variation 1 must start with the same construction for our product. Variations 2 and 3 may change wording moderately, but must stay close to the same format/skeleton and must not become generic new scripts. Each variation must include a name, strategic intent, hook text, source_format_match, full voice-over script, a timed script_breakdown table plan that mirrors the inspiration's beat order/time ranges where possible, CTA, what to change from the competitor, and why it should work. Do not collapse Section 8 into loose paragraphs or standalone `Hook text:` and `CTA:` lines; the Strategy Snapshot and Script Breakdown tables are mandatory. For Variation 1, build the Script Breakdown row-by-row from the inspiration's breakdown: preserve row count, time ranges, labels, and visual beat shape where possible, and rewrite only the `Caption / Voice Over` cells for our product.
```

---

## Step 5 — Write result to Supabase

For each classified item, insert a row into `inspiration_results` and mark the queue row done:

```bash
# Portable env loader — reads from ~/.classify-inspiration.env (set by installer).
# Fallback chain: ~/.classify-inspiration.env → $PWD/.env → ~/.env.
for _p in "$HOME/.classify-inspiration.env" "$PWD/.env" "$HOME/.env"; do
  [ -f "$_p" ] && { set -a; source "$_p"; set +a; break; }
done

# Build JSON payloads (use a temp file so quoting doesn't break)
cat > /tmp/result_[INS_ID].json <<'JSON'
{
  "metadata": {
    "page_name": "...",
    "brand": "...",
    "body_text": "...",
    "title": "...",
    "headline": "...",
    "cta_text": "...",
    "cta_type": "...",
    "landing_url": "...",
    "link_url": "...",
    "ad_id": "...",
    "media_kind": "video|image|carousel",
    "hook_text": "...",
    "body_copy_from_frames": "...",
    "caption_transcript": "...",
    "caption_timeline": [{"time":"0:00-0:03","caption":"..."}],
    "voice_over": "spoken transcript, No voice over, or blank when speech is unverified",
    "voice_over_timeline": [{"time":"0:00-0:04","voice_over":"..."}]
  },
  "classification": {
    "media_kind": "video|image|carousel",
    "photo_video": "...",
    "hook_type": "...",
    "creative_structure": "...",
    "production_style": "...",
    "funnel_type": "...",
    "persona": "...",
    "persona_matched": true,
    "angle": "...",
    "angle_matched": true,
    "creative_usp": "...",
    "creative_hypothesis": "...",
    "notes": "...",
    "voice_over": "spoken transcript, No voice over, or blank when speech is unverified",
    "voice_over_timeline": [{"time":"0:00-0:04","voice_over":"..."}],
    "detected_angle": "raw detected angle before matching",
    "detected_persona": "raw detected persona before matching"
  },
  "brief": {
    "frame_by_frame": [ ... ],
    "voice_over": "spoken transcript, No voice over, or blank when speech is unverified",
    "caption_transcript": "...",
    "voice_over_timeline": [{"time":"0:00-0:04","voice_over":"..."}],
    "inspiration_script_skeleton": "Opening phrase pattern + beat order + sentence rhythm + CTA rhythm extracted from the inspiration",
    "why_it_works": "...",
    "replication_brief": "...",
    "what_to_test": "...",
    "competitor_intel": "...",
    "our_next_ad": "...",
    "next_ad_scripts": [
      {"variation": "Variation 1 name", "intent": "...", "hook_text": "...", "source_format_match": "Reference-faithful: uses the same opening construction, beat order, sentence rhythm, and CTA rhythm as the inspiration", "voice_over_script": "...", "script_breakdown": [{"time":"0:00-0:03","label":"HOOK","caption_voice_over":"...","visual_beat":"...","editor_note":"..."}], "cta": "...", "what_to_change": "...", "why_it_should_work": "..."},
      {"variation": "Variation 2 name", "intent": "...", "hook_text": "...", "source_format_match": "Close format: keeps the same skeleton/beat order while changing the angle slightly", "voice_over_script": "...", "script_breakdown": [{"time":"0:00-0:03","label":"HOOK","caption_voice_over":"...","visual_beat":"...","editor_note":"..."}], "cta": "...", "what_to_change": "...", "why_it_should_work": "..."},
      {"variation": "Variation 3 name", "intent": "...", "hook_text": "...", "source_format_match": "Close format: keeps the same skeleton/beat order while changing the emotional emphasis slightly", "voice_over_script": "...", "script_breakdown": [{"time":"0:00-0:03","label":"HOOK","caption_voice_over":"...","visual_beat":"...","editor_note":"..."}], "cta": "...", "what_to_change": "...", "why_it_should_work": "..."}
    ]
  }
}
JSON

PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<SQL
insert into public.inspiration_results
  (ins_id, product_id, source_url, platform, metadata, classification, brief,
   duration_seconds, frames_extracted, classified_at)
values
  ('[INS_ID]', '[PRODUCT_ID]', '[URL]', '[PLATFORM]',
   (select metadata from json_populate_record(null::record, pg_read_file('/tmp/result_[INS_ID].json')::json)),  -- easier: use jsonb literal below instead
   '...'::jsonb, '...'::jsonb,
   [duration_seconds], [frames_count], now())
on conflict (ins_id, product_id) do update
  set metadata = excluded.metadata,
      classification = excluded.classification,
      brief = excluded.brief,
      classified_at = now();
SQL
```

**Simpler recommended form** — use Python with `psycopg2` or the Supabase REST API (with the service_role key) to insert. Example via REST:

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/inspiration_results" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  --data @/tmp/result_[INS_ID].json
```

Where the JSON file has the full shape:

```json
{
  "ins_id": "[INS_ID]",
  "product_id": "[PRODUCT_ID]",
  "source_url": "[URL]",
  "platform": "[PLATFORM]",
  "metadata": { ... },
  "classification": { ... },
  "brief": { ... },
  "duration_seconds": 12.5,
  "frames_extracted": 6
}
```

If running manually without the worker, mark the queue row classified. If this
skill was invoked by the worker, skip this step because the worker owns queue
state:

```bash
curl -s -X PATCH "$SUPABASE_URL/rest/v1/inspiration_queue?ins_id=eq.[INS_ID]&product_id=eq.[PRODUCT_ID]" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  --data '{"status":"classified","processed_at":"now()"}'
```

---

## Step 5b — Write DIRECTLY to `public.inspirations.data` (avoid poller race)

**Why:** The dashboard polls `inspiration_results` every 6 s, maps fields into `inspirations.data`, then DELETES the source row (`DB.clearResults`). If the poller tab isn't open, or a second row update arrives before the next poll, fields get lost or overwritten with defaults. Writing directly to `inspirations.data` is lossless and triggers the dashboard's realtime subscription on the `inspirations` table within 1–2 s.

The dashboard's `applyClassificationResults` function expects these **camelCase** keys inside `inspirations.data`:

| data jsonb key | Source in your classification |
|---|---|
| `brand` | metadata.page_name |
| `hookType` | classification.hook_type (normalized to UI options) |
| `creativeStructure` | classification.creative_structure |
| `productionStyle` | classification.production_style |
| `funnelStage` | classification.funnel_type |
| `adType` | classification.photo_video |
| `mediaKind` | classification.media_kind OR metadata.media_kind |
| `persona` | classification.persona |
| `angle` | classification.angle |
| `creativeUSP` | classification.creative_usp |
| `formatName` | first phrase of creative_usp before " — " |
| `creativeHypothesis` | classification.creative_hypothesis |
| `notes` | classification.notes |
| `hookText` | metadata.hook_text OR classification.hook_text |
| `bodyCopy` | metadata.body_text OR metadata.caption OR metadata.body_copy_from_frames |
| `captionTranscript` | metadata.caption_transcript OR brief.caption_transcript |
| `voiceOver` | classification.voice_over OR metadata.voice_over OR `"No voice over"` |
| `voiceOverTimeline` | classification.voice_over_timeline OR metadata.voice_over_timeline OR brief.voice_over_timeline |
| `captionTimeline` | metadata.caption_timeline OR brief.caption_timeline |
| `nextAdScripts` | brief.next_ad_scripts |
| `headline` | metadata.title |
| `ctaText` | normalized CTA display text from metadata.cta_type when possible, else metadata.cta_text |
| `landingUrl` | metadata.link_url |
| `duration_seconds` | pipeline output |
| `status` | `"Classified"` literal |
| `classifiedAt` | `Date.now()` equivalent (epoch ms) |
| `_needsAngleReview` | `true` if angle_matched=false and no fuzzy match ≥60%, else `false` |
| `_needsPersonaReview` | same logic for persona |
| `detectedAngle` / `detectedPersona` | raw detected labels before matching |
| `_angleScope` / `_personaScope` | `"product"` for matched existing labels, `"inspiration"` for inspiration-local labels |
| `_angleLocked` / `_personaLocked` | `true` once the classifier has set the inspiration-local or product-matched identity |
| `_anglePromptDone` | `true` after this skill has tried to match |
| `_personaPromptDone` | `true` after this skill has tried to match |
| `_clickupDocPageUrl` | set in Step 6 after page create/update |
| `_clickupDocId` | set in Step 6 after page create/update |
| `_inspoDocCreated` | `true` after Step 6 |

Use `psycopg2` (simpler than curl with JSON escaping):

```bash
# Portable env loader — reads from ~/.classify-inspiration.env (set by installer).
# Fallback chain: ~/.classify-inspiration.env → $PWD/.env → ~/.env.
for _p in "$HOME/.classify-inspiration.env" "$PWD/.env" "$HOME/.env"; do
  [ -f "$_p" ] && { set -a; source "$_p"; set +a; break; }
done
python3 <<'PYEOF'
import json, os, psycopg2, time
result = json.load(open('/tmp/result_[INS_ID].json'))
md = result['metadata']
cls = result['classification']

brand = md.get('page_name') or md.get('brand') or ''
hook_text = md.get('hook_text') or cls.get('hook_text') or ''
caption_transcript = md.get('caption_transcript') or (result.get('brief') or {}).get('caption_transcript') or ''
body_copy = md.get('body_text') or md.get('caption') or md.get('body_copy_from_frames') or ''
voice_over = cls.get('voice_over') or md.get('voice_over') or (result.get('brief') or {}).get('voice_over') or ''
if voice_over.strip().lower() in ('voice over present - transcript unavailable', 'voiceover present - transcript unavailable', 'transcript unavailable', 'n/a', 'na', 'none'):
  voice_over = ''
cta_type = (md.get('cta_type') or cls.get('cta_type') or '').upper()
cta_map = {
  'SHOP_NOW': 'Shop now',
  'LEARN_MORE': 'Learn more',
  'SIGN_UP': 'Sign up',
  'SUBSCRIBE': 'Subscribe',
  'DOWNLOAD': 'Download',
  'GET_OFFER': 'Get offer',
  'GET_QUOTE': 'Get quote',
  'CONTACT_US': 'Contact us',
  'BOOK_NOW': 'Book now',
  'APPLY_NOW': 'Apply now',
  'WATCH_MORE': 'Watch more',
  'LISTEN_NOW': 'Listen now',
  'ORDER_NOW': 'Order now',
  'BUY_NOW': 'Buy now',
  'SEND_MESSAGE': 'Send message',
}
cta_text = cta_map.get(cta_type) or md.get('cta_text') or ''
usp = cls.get('creative_usp') or ''
format_name = usp.split(' — ')[0].strip() if ' — ' in usp else usp
media_kind = (cls.get('media_kind') or md.get('media_kind') or result.get('media_kind') or '').lower()
if not media_kind and result.get('is_video') is True:
  media_kind = 'video'
elif not media_kind and result.get('is_video') is False:
  media_kind = 'image'
ad_type = cls.get('photo_video') or ''
if media_kind == 'image' and ad_type in ('', 'Video', 'VSL'):
  ad_type = 'Photo'
elif media_kind == 'carousel' and ad_type in ('', 'Video', 'VSL'):
  ad_type = 'Carousel'
elif media_kind == 'video' and ad_type in ('', 'Photo', 'Carousel'):
  ad_type = 'Video'

patch = {
  'brand': brand,
  'hookType': cls.get('hook_type') or '',
  'creativeStructure': cls.get('creative_structure') or '',
  'productionStyle': cls.get('production_style') or '',
  'funnelStage': cls.get('funnel_type') or 'TOF',
  'adType': ad_type,
  'mediaKind': media_kind,
  'persona': cls.get('persona') or '',
  'angle': cls.get('angle') or '',
  'creativeUSP': usp,
  'formatName': format_name,
  'creativeHypothesis': cls.get('creative_hypothesis') or '',
  'notes': cls.get('notes') or '',
  'hookText': hook_text,
  'bodyCopy': body_copy,
  'captionTranscript': caption_transcript,
  'voiceOver': voice_over,
  'voiceOverTimeline': cls.get('voice_over_timeline') or md.get('voice_over_timeline') or (result.get('brief') or {}).get('voice_over_timeline') or [],
  'captionTimeline': md.get('caption_timeline') or (result.get('brief') or {}).get('caption_timeline') or [],
  'nextAdScripts': (result.get('brief') or {}).get('next_ad_scripts') or [],
  'headline': md.get('title') or '',
  'ctaText': cta_text,
  'ctaType': cta_type,
  'landingUrl': md.get('link_url') or '',
  'duration_seconds': result.get('duration_seconds') or 0,
  'status': 'Classified',
  'classifiedAt': int(time.time() * 1000),
  '_needsAngleReview': False,
  '_needsPersonaReview': False,
  'detectedAngle': cls.get('detected_angle') or cls.get('angle') or '',
  'detectedPersona': cls.get('detected_persona') or cls.get('persona') or '',
  '_angleScope': 'product' if cls.get('angle_matched', False) else 'inspiration',
  '_personaScope': 'product' if cls.get('persona_matched', False) else 'inspiration',
  '_angleLocked': True,
  '_personaLocked': True,
  '_anglePromptDone': True,
  '_personaPromptDone': True,
}

conn = psycopg2.connect(os.environ['SUPABASE_DB_URL']); cur = conn.cursor()
# Merge patch into existing data jsonb (JSONB || operator, right wins)
cur.execute("""
  update public.inspirations
  set data = coalesce(data,'{}'::jsonb) || %s::jsonb,
      status = 'Classified'
  where id = %s and product_id = %s
  returning id
""", (json.dumps(patch), '[INS_ID]', '[PRODUCT_ID]'))
print('updated:', cur.fetchone())
conn.commit(); cur.close(); conn.close()
PYEOF
```

The dashboard sees this within 1–2 s via its realtime subscription on `public.inspirations`.

---

## Step 6 — Create or UPDATE ClickUp Doc Page (8-section brief)

Uses the `doc_id` from `products.config->>'doc_id'` (pulled in Step 1). **IMPORTANT:** always list existing pages first. If a page already starts with `[INS_ID]` (same ins_id, regardless of old/stale title), UPDATE it instead of creating a duplicate.

### 6-pre — Resolve library doc (discover → create) + heal product config

**Always** run this block, even when `products.config->>'doc_id'` already looks set. The `products.config` jsonb can be clobbered by the ClickUp list-sync job (which replaces fields like `last_synced_at_ms`), so `doc_id`/`master_tracker_page_id` can silently go missing between runs. This block is idempotent: it re-verifies both IDs against ClickUp and writes them back if they're wrong, missing, or pointing at a deleted page.

Do this **once per distinct product_id in the batch**, before any 6a/6b work for that product:

```text
1. CONFIG CHECK
   • If config has both doc_id AND master_tracker_page_id → verify both still resolve:
       - GET  https://api.clickup.com/api/v3/workspaces/9016762494/docs/{doc_id}/pages
       - If that returns 200 AND page_id appears in the list AND its name starts with "📋 Master Tracker"
         → config is healthy, skip to 6a with these IDs.
   • Otherwise → fall through to step 2 (discover).

2. DISCOVER EXISTING LIBRARY DOC (never create if one already exists)
   • Search the Inspiration Library folder (90169348848) for an existing doc whose name matches this product:
       clickup_search({
         workspace_id: "9016762494",
         keywords: "[PRODUCT_NAME] Inspiration Library",
         filters: { asset_types: ["doc"], location: { categories: ["90169348848"] } }
       })
   • Accept a hit when the doc name, case-insensitively, contains both the product name AND "inspiration library". Prefer exact "[PRODUCT_NAME uppercased] — Inspiration Library".
   • If found → use its id as doc_id. Then list pages and find the one whose name is exactly "📋 Master Tracker"
     (or starts with "📋 Master Tracker" / "Master Tracker"). Use its id as master_tracker_page_id.
   • Go to step 4 (heal config).

3. CREATE (only reached when nothing was discovered)
   Call: clickup_create_document
     workspace_id: "9016762494"
     name: "[PRODUCT_NAME uppercased] — Inspiration Library"
     parent: {"id": "90169348848", "type": "5"}   ← Inspiration Lib folder (type 5 = folder)
     visibility: "PUBLIC"
     create_page: true

   Response → capture document_id as doc_id.

   Call: clickup_list_document_pages(document_id)
   → grab the single auto-created page's id; that becomes master_tracker_page_id.

   Call: clickup_update_document_page to rename + seed content
     document_id: <new doc_id>
     page_id: <that page id>
     name: "📋 Master Tracker"
     sub_title: "All [PRODUCT_NAME] inspirations — status, decision, quick reference"
     content_format: "text/md"
     content: empty-tracker markdown (see Step 6.5 for the seed template — use the empty state with "_empty — run the skill to populate_" row)

4. HEAL CONFIG (runs after discover OR create, not after the healthy-check path)
   Always merge the verified IDs back into products.config so future runs don't rediscover them.
```
```bash
python3 <<PYEOF
import os, psycopg2, json
conn = psycopg2.connect(os.environ['SUPABASE_DB_URL']); cur = conn.cursor()
# jsonb || merges; right-hand wins. Doesn't clobber other config keys like clickup_list_id, color, ins_prefix, etc.
cur.execute("""
  update public.products
  set config = coalesce(config,'{}'::jsonb) || %s::jsonb
  where id = %s
""", (json.dumps({'doc_id': '[RESOLVED_DOC_ID]', 'master_tracker_page_id': '[RESOLVED_TRACKER_PAGE_ID]'}), '[PRODUCT_ID]'))
conn.commit(); cur.close(); conn.close()
PYEOF
```

**Why discover before create:** without discovery, a wiped `doc_id` causes the skill to create a *second* library doc in the Inspiration Library folder — leaving the team with split briefs across two docs and broken historical brief URLs in `inspirations.data`. The Apr-2026 AT-INS-008 incident is exactly this failure mode: Art Therapy had its config cleared by a list-sync, and only the self-heal step (6.7) rescued the brief link because the page happened to already exist. Discovery prevents the duplicate entirely.

After this, proceed to 6a with the resolved `doc_id` + `master_tracker_page_id`. Note the existing KLS/KMH/Astro/Art-Therapy docs were created manually for the first batch; every new product after today will be discovered or auto-created here by the skill — zero manual setup.

⚠️ **Known MCP quirk:** parent type `"5"` (folder) currently works against folder `90169348848`. Earlier attempts against OTHER folders returned "Resource not found" — auth is per-folder. If create fails after discovery returned nothing: fall back to parent `{"id": "90162807791", "type": "4"}` (space root), then tell the user to drag the new doc into the folder manually.

### 6a — List existing pages + decide create vs update

Use `clickup_list_document_pages` MCP tool with `document_id = [DOC_ID]`. Scan returned pages for one whose `name` starts with `[INS_ID] ` or equals `[INS_ID]`. If found → capture its `id` for update. If not → create new.

### 6b — Create OR update the inspiration page

**If existing page found:** call `clickup_update_document_page` with:
- `document_id`: [DOC_ID]
- `page_id`: found page id
- `name`: `[INS_ID] — [Brand] | [Angle]`
- `sub_title`: `[Platform] · [Duration]s · [Funnel] · [Hook Type] hook`
- `content_format`: `text/md`
- `content`: the full 8-section markdown (see template below)

**If no existing page:** call `clickup_create_document_page` with the same fields (use `document_id` + no `page_id`).

### 6c — 8-section page content template

The `content` field should be markdown with these 8 H2 sections — format matches existing pages in the doc for consistency:

```markdown
# [INS_ID] — [Brand] | [Angle]
* * *

## 1\. SNAPSHOT
> _Media Buyer — 30 second read_

| Field | Value |
| ---| --- |
| Brand | [metadata.page_name] |
| Platform | [Platform] |
| Duration | [duration_seconds]s |
| Funnel | [funnel_type] |
| Format | [photo_video] — [production_style] |
| Hook Type | [hook_type] |
| Angle | [angle] |
| Persona | [persona] |
| Status | Classified |
| Decision | — |
| Reference | [[source_url]]([source_url]) |

**Ad Copy:** [body_text/platform caption or "(not available)"]
[If `voice_over` is a real transcript or exactly `No voice over`, render `**Voice Over:** [voice_over]`. If `voice_over` is blank/unverified, omit the Voice Over line entirely.]
**On-screen Text Timing:** [compact timing note for static hook cards / important overlay text, e.g. `0:00-0:04 top hook card: "Can your child answer this?"`. Omit if no meaningful overlay text.]
**Headline:** [title or "(not available)"]
**CTA:** [cta_text or "(not available)"]

**In one sentence:** [creative_hypothesis condensed to one sentence]
* * *

## 2\. CREATIVE BREAKDOWN
> _Strategist + Editor — frame by frame_

| Time | Label | Caption / Voice Over | What Happens | Emotion Triggered |
| ---| ---| ---| ---| --- |
[render each frame_by_frame row as table row]

* * *

## 3\. WHY IT WORKS
> _Strategist — the psychology_

[why_it_works as bulleted list]
* * *

## 4\. REPLICATION BRIEF
> _Editor / Video Producer — exactly what to make_

[replication_brief broken into bullets: Talent, Set, Key overlay, Subtitle style, Pacing, Music, Mid-video, End card]
* * *

## 5\. WHAT TO TEST
> _Media Buyer + Strategist — variations_

[what_to_test as numbered list]
* * *

## 6\. COMPETITOR INTEL
> _Strategist + Media Buyer_

[competitor_intel as bullets: Brand scale, Funnel strategy, Our gap, Compete or find lane]
* * *

## 7\. OUR NEXT AD
> _Everyone — the actionable output_

[our_next_ad — include: What we're stealing, What we're doing differently, 3-line editor brief, Hypothesis]
* * *

## 8\. NEXT AD SCRIPTS
> _Editor + Strategist — three complete variation scripts_

[next_ad_scripts — render exactly 3 complete ad variation scripts for OUR selected product, not for the inspiration/competitor product. Use `[PRODUCT_NAME]` and its offer/config; borrow the winning structure/mechanic AND the inspiration's script skeleton. Before the variations, render:

**Inspiration Script Skeleton:** [opening phrase pattern + beat order + sentence rhythm + CTA rhythm extracted from the inspiration]

Variation 1 must be reference-faithful: same opening construction, same beat order, same sentence rhythm, same time ranges where possible, same CTA rhythm; swap only our product/problem/proof/offer. Variations 2 and 3 can move wording 20–35%, but must remain close to the same format and cannot become unrelated generic scripts. For each variation render:
1. Variation heading
2. Strategy Snapshot table: `Field | Direction` with Strategic intent, Hook Text, Source Format Match, CTA, What to change, Why it should work
3. Full `Voice-over Script` paragraph
4. Script Breakdown table: `Time | Label | Caption / Voice Over | Visual Beat | Editor Notes`

Do not render Caption Timeline and Visual Beats as separate bullet lists in section 8; combine them into the Script Breakdown table. Do not replace the tables with loose `Hook text:` or `CTA:` paragraphs. Keep the existing table structure; only the product-specific script content should change.]
```

### 6d — Write the doc page URL back to `inspirations.data`

After create/update, capture the page URL (format: `https://app.clickup.com/[workspace_id]/docs/[doc_id]/[page_id]`) and the page id. Update `inspirations.data` so the dashboard renders the 📄 Brief link:

```bash
# Portable env loader — reads from ~/.classify-inspiration.env (set by installer).
# Fallback chain: ~/.classify-inspiration.env → $PWD/.env → ~/.env.
for _p in "$HOME/.classify-inspiration.env" "$PWD/.env" "$HOME/.env"; do
  [ -f "$_p" ] && { set -a; source "$_p"; set +a; break; }
done
python3 <<'PYEOF'
import json, os, psycopg2
conn = psycopg2.connect(os.environ['SUPABASE_DB_URL']); cur = conn.cursor()
cur.execute("""
  update public.inspirations
  set data = coalesce(data,'{}'::jsonb) || %s::jsonb
  where id = %s and product_id = %s
""", (json.dumps({
  '_clickupDocPageUrl': '[PAGE_URL]',
  '_clickupDocId':      '[PAGE_ID]',
  '_inspoDocCreated':   True,
}), '[INS_ID]', '[PRODUCT_ID]'))
conn.commit(); cur.close(); conn.close()
PYEOF
```

---

## Step 6.5 — Rebuild the Master Tracker page

Product config stores `master_tracker_page_id`. If absent, skip this step and tell the user to add it (same pattern as `doc_id`).

**Strategy:** regenerate the entire tracker table from Supabase on every classify — cleaner than parsing/merging existing markdown. The `inspirations` table for this product IS the source of truth.

```bash
# Portable env loader — reads from ~/.classify-inspiration.env (set by installer).
# Fallback chain: ~/.classify-inspiration.env → $PWD/.env → ~/.env.
for _p in "$HOME/.classify-inspiration.env" "$PWD/.env" "$HOME/.env"; do
  [ -f "$_p" ] && { set -a; source "$_p"; set +a; break; }
done
python3 <<'PYEOF' > /tmp/tracker_[PRODUCT_ID].md
import os, psycopg2, datetime
conn = psycopg2.connect(os.environ['SUPABASE_DB_URL']); cur = conn.cursor()
cur.execute("""
  select id, platform, status,
         coalesce(data->>'brand',''),
         coalesce(data->>'angle',''),
         coalesce(data->>'persona',''),
         coalesce(data->>'hookType',''),
         coalesce(data->>'funnelStage',''),
         coalesce(data->>'_clickupDocPageUrl','')
  from public.inspirations
  where product_id = %s
  order by id asc
""", ('[PRODUCT_ID]',))
rows = cur.fetchall()
today = datetime.date.today().isoformat()
print("# 📋 Master Tracker — [PRODUCT_NAME] Inspirations\n")
print(f"Last updated: {today}")
print("* * *\n")
print("| ID | Brand | Platform | Angle | Persona | Hook | Funnel | Status | Brief |")
print("| ---| ---| ---| ---| ---| ---| ---| ---| --- |")
for (ins_id, platform, status, brand, angle, persona, hook, funnel, brief_url) in rows:
    brief = f"[Open]({brief_url})" if brief_url else "—"
    print(f"| {ins_id} | {brand or '—'} | {platform or '—'} | {angle or '—'} | {persona or '—'} | {hook or '—'} | {funnel or '—'} | {status or 'Saved'} | {brief} |")
print("\n* * *\n")
print("**Status options:** `Saved` · `Testing` · `Winner` · `Loser` · `Replicated` · `Archived`")
cur.close(); conn.close()
PYEOF
```

Then write the file contents as the new page content via `clickup_update_document_page`:

- `document_id`: [DOC_ID]
- `page_id`: [MASTER_TRACKER_PAGE_ID] from products.config
- `name`: `📋 Master Tracker`
- `sub_title`: `All [PRODUCT_NAME] inspirations — status, decision, quick reference`
- `content_format`: `text/md`
- `content`: contents of `/tmp/tracker_[PRODUCT_ID].md`

---

## Step 6.7 — Self-heal wiped brief URLs (NEW — run after every batch)

**Why:** Even though we write `_clickupDocPageUrl` directly to `inspirations.data`, the dashboard's frontend `saveInspirations` historically did a full-object upsert using its in-memory copy, which could overwrite the URL with an empty string if the frontend's copy was stale (e.g. realtime event arrived after the save was queued). The dashboard code was fixed in April 2026 to server-win for server-owned keys, but older dashboard deploys may still exhibit the bug. This self-heal step makes every run idempotently repair URLs — so even if something wipes the URL between runs, the next run fixes it.

Run this at the end of every classify batch, AFTER all per-item writes and doc page creates are done:

```bash
export $(grep -v '^#' "/Users/gauravpataila/Documents/Claude/Clickup /.env" | xargs)
python3 <<'PYEOF'
import os, json, psycopg2, requests, re
conn = psycopg2.connect(os.environ['SUPABASE_DB_URL']); cur = conn.cursor()

# Find all classified rows missing a brief URL, grouped by product
cur.execute("""
  select i.product_id,
         coalesce(p.config->>'doc_id','') as doc_id,
         i.id,
         (coalesce(i.data->>'brand','') || ' | ' || coalesce(i.data->>'angle','')) as search_hint
  from public.inspirations i
  join public.products p on p.id = i.product_id
  where i.status = 'Classified'
    and coalesce(i.data->>'_clickupDocPageUrl','') = ''
    and coalesce(p.config->>'doc_id','') <> ''
""")
orphans = cur.fetchall()
print(f'[self-heal] {len(orphans)} rows missing brief URLs')

# Group by doc_id → list doc's pages once, match by ins_id prefix
from collections import defaultdict
by_doc = defaultdict(list)
for product_id, doc_id, ins_id, hint in orphans:
    by_doc[doc_id].append((product_id, ins_id, hint))

CLICKUP_TOKEN = os.environ.get('CLICKUP_API_KEY','')
WS_ID = '9016762494'
headers = {'Authorization': CLICKUP_TOKEN}
repaired = 0

for doc_id, items in by_doc.items():
    # List all pages in this doc
    r = requests.get(f'https://api.clickup.com/api/v3/workspaces/{WS_ID}/docs/{doc_id}/pages',
                     headers=headers, timeout=30)
    if r.status_code != 200:
        print(f'  [self-heal] could not list pages for doc {doc_id}: {r.status_code}')
        continue
    pages = r.json() if isinstance(r.json(), list) else r.json().get('pages', [])
    # Build ins_id → page_id lookup from page names (they start with "INS-XXX" or "[INS-XXX]")
    page_by_ins = {}
    for p in pages:
        name = p.get('name','') or ''
        m = re.match(r'^\[?([A-Z0-9-]+)[\]\s]', name)
        if m: page_by_ins[m.group(1)] = p.get('id')

    for product_id, ins_id, hint in items:
        page_id = page_by_ins.get(ins_id)
        if not page_id: continue
        url = f'https://app.clickup.com/{WS_ID}/docs/{doc_id}/{page_id}'
        cur.execute("""
          update public.inspirations
          set data = coalesce(data,'{}'::jsonb) || %s::jsonb
          where id = %s and product_id = %s
        """, (json.dumps({
          '_clickupDocPageUrl': url,
          '_clickupDocId': page_id,
          '_inspoDocCreated': True,
        }), ins_id, product_id))
        repaired += 1
        print(f'  [self-heal] repaired {ins_id} -> {url}')

conn.commit(); cur.close(); conn.close()
print(f'[self-heal] done: repaired {repaired} row(s)')
PYEOF
```

This step is cheap (one ClickUp API call per doc, one UPDATE per orphan row) and guarantees that by the time Step 8 prints the summary, no classified inspiration is missing its brief link in the dashboard.

---

## Step 7 — Clean up

```bash
rm -rf /tmp/ins_work_* /tmp/ins_pipeline_*.py /tmp/result_*.json /tmp/tracker_*.md
```

No more bridge cleanup — there is no bridge.

---

## Step 8 — Print summary

```
✅ Classified N inspiration(s) across K products

 INS_ID   | Product              | Platform | Brand     | Hook         | Funnel | Doc   | Status
----------|----------------------|----------|-----------|--------------|--------|-------|--------
 INS-003  | ASTRO REKHA          | Instagram| AstroTalk | Aspirational | TOF    | ✓     | ✓ done
 INS-004  | Kids Mental Health   | Facebook | Brand XYZ | Curiosity    | TOF    | ✗     | ✓ done
 INS-005  | KIDS LIFE SKILL      | TikTok   | —         | —            | —      | —     | ✗ error
```

Tell the user: "Done. The dashboard auto-updates via Supabase realtime — check the Vercel URL, rows will have filled in and each classified inspo has a 📄 Brief link to its ClickUp doc page."

---

## Error handling

- **Supabase connection fails**: print the error, stop, tell the user to check `.env` and internet connectivity.
- **Queue empty**: print "No pending items in inspiration_queue. Queue some URLs from the dashboard." Stop.
- **Product has empty `doc_id`**: Step 6-pre now auto-discovers an existing library doc in folder `90169348848` by name match, and only creates a new one if none is found. It also heals `products.config` on every run so a clobbered config self-repairs. If both discovery and creation fail, skip doc creation for that product, still write the classification result, and tell the user to check that the Inspiration Library folder is reachable via the ClickUp MCP.
- **Doc page creation fails**: still save the classification result. Just leave `clickup_doc_page_url` empty.
- **Facebook ad not found / yt-dlp fails / no frames**: update queue row with `status='error'` and `error_message='<message>'`; do NOT write a result row; continue with other items.
- **Prerequisites missing**: `brew install ffmpeg` · `pip3 install psycopg2-binary requests playwright` · `python3 -m playwright install chromium`

---

## Migration notes

- As of April 2026, the bridge at `localhost:5002` is deprecated. If you find references to `INS_BRIDGE`, `/tmp/immuvi_pending.json`, or `/tmp/immuvi_classification_results.json` anywhere, they can be removed.
- The dashboard at `https://immuvi-command-center.vercel.app` reads/writes Supabase directly. Teammates can queue URLs; only Gaurav (on this Mac) runs the classifier due to ffmpeg/yt-dlp/Playwright requirements.
