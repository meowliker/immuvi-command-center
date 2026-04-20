---
name: clickup-creative-pipeline
description: End-to-end ClickUp creative pipeline. Fetches tasks with Drive Links, downloads creatives from Google Drive, visually classifies them (Hook Type, Creative Structure, Production Style, Funnel, Angle, Persona), generates a 7-section Creative Brief as a ClickUp Doc page, prepends a Creative Hypothesis to the description, adds a summary comment, and bulk-updates every custom field. Replaces the earlier /clickup-creative-classifier and /clickup-creative-data-fill skills (this is the superset + safer). Triggers on phrases like "run the creative pipeline on list X", "classify all tasks in this ClickUp list", "fill in the creative fields", "generate briefs for the ads in this list", "analyze all creatives in ClickUp list [ID]".
---

# ClickUp Creative Pipeline

End-to-end automated pipeline for **any ClickUp list** containing ad creatives:

1. Fetch tasks with Drive Links (skipping tasks already fully classified, unless `--force-all`)
2. Download creative assets from Google Drive
3. Extract frames and visually classify each creative
4. **Consolidation checkpoint** — if new Angles/Personas are proposed, cluster + show the user before writing to ClickUp
5. Create a full 7-section Creative Brief as a ClickUp Doc page per task
6. Update every task: description (doc link + hypothesis), comment (summary), and all custom fields

## Step 0 — Auto-update (always run this first)

Silently refresh the skill files from origin using HTTP ETags — unchanged files are a 304 (zero bytes, ~90ms). Next run picks up any updates.

```bash
SKILL_DIR="$HOME/.claude/skills/clickup-creative-pipeline"
ASSET_BASE="https://immuvi-command-center.vercel.app/team-skill/clickup-creative-pipeline"

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
      mv "$tmp_body" "$file_path"
      new_etag=$(awk -F": " 'tolower($1)=="etag"{gsub(/\r/,"",$2); e=$2} END{print e}' "$tmp_head")
      [ -n "$new_etag" ] && printf "%s" "$new_etag" > "$etag_path"
      ;;
    304|*) rm -f "$tmp_body" ;;
  esac
  rm -f "$tmp_head"
done
```

Fails silently on network errors. Continues with whatever is on disk.

---

## Env loader helper (referenced in every shell step)

Whenever a step uses Supabase credentials or a ClickUp token persisted in the env file, load them from the portable env file first:

```bash
for _p in "$HOME/.classify-inspiration.env" "$PWD/.env" "$HOME/.env"; do
  [ -f "$_p" ] && { set -a; source "$_p"; set +a; break; }
done
```

This matches what `/classify-inspiration` uses, so teammates who have that skill installed share the same env file. The ClickUp API key can live there as `CLICKUP_API_KEY` (or will be asked on first use).

---

## When to use

Invoke this skill when the user says things like:
- "run the creative pipeline on list X"
- "classify all tasks in this ClickUp list"
- "fill in all the custom fields for this list"
- "generate briefs for the ads in this list"
- "analyse all creatives in ClickUp list [ID]"
- "fill the creative data for new tasks in [list]" (runs the incremental path)

## Flags & modes

| Flag | Effect |
|---|---|
| *(none, default)* | **Incremental mode** — only processes tasks where Angle, Hook Type, AND Creative Structure are ALL currently empty. First run processes everything; subsequent runs auto-skip what's done. |
| `--force-all` | Re-processes every task with a Drive Link, even ones that already have classifications. Useful after a classifier-logic improvement. |
| `--task-ids A,B,C` | Processes only the named tasks. Overrides all other filters. |
| `--since YYYY-MM-DD` | Only tasks created or updated after the given date. |
| `--skip-consolidation` | Skips the new-angle/persona approval checkpoint and writes straight through. Use only when you trust the existing dropdown will absorb everything. |

---

## STEP 0 — Gather inputs


Ask the user for (if not already provided in the message):

| Input | How to get it |
|---|---|
| **ClickUp List ID** | From URL: `app.clickup.com/…/list/XXXXXXX` — take the number after `/list/` |
| **ClickUp Doc ID** | The doc where brief pages will be created (e.g. `8cq1r3y-33336`) |
| **Product / Brand name** | For angle and persona context |
| **Known Angles** | Comma-separated list, or "none" |
| **Known Personas** | Comma-separated list, or "none" |
| **ClickUp API key** | Check `$CLICKUP_API_KEY` env var first (loaded by the env loader above from `~/.classify-inspiration.env`). If not set, ask the user and offer to persist to that env file. |
| **Workspace ID** | Found in the ClickUp URL — needed for doc page URL construction |

**KMH defaults** (use these automatically when product = Kids Mental Health / Immuvi):
```
API Key:       from $CLICKUP_API_KEY (env loader)
Doc ID:        8cq1r3y-33336
Workspace ID:  9016762494
Known Angles:  Dysregulated Kids, Sextortion, Raising Kids, ADHD Kids, Anger Issues, Teacher Angle, WAR angle
Known Personas: Female Teachers 25-44, Moms Raising Kids 35-44, Mom's POV, Elementary Teachers
```

---

## STEP 1 — Fetch all tasks + discover field IDs

### 1a. Fetch tasks
```python
import requests, json

API_KEY = "<from config or user>"
LIST_ID = "<user provided>"
HEADERS = {"Authorization": API_KEY, "Content-Type": "application/json"}
BASE = "https://api.clickup.com/api/v2"

tasks = []
page = 0
while True:
    r = requests.get(f"{BASE}/list/{LIST_ID}/task",
        headers=HEADERS,
        params={"page": page, "include_closed": "true"})
    data = r.json()
    tasks.extend(data.get("tasks", []))
    if data.get("last_page", True):
        break
    page += 1

# Extract Drive Links
work_tasks = []
for t in tasks:
    drive_url = ""
    for f in t.get("custom_fields", []):
        if f["name"] == "Drive Link":
            drive_url = f.get("value") or ""
    if drive_url:
        work_tasks.append({
            "id": t["id"], "name": t["name"],
            "status": t["status"]["status"], "drive_url": drive_url
        })

print(f"Total tasks: {len(tasks)} | With Drive Links: {len(work_tasks)}")
```

Show the user the count and confirm before proceeding.


### 1a.1 — Filter to only tasks that need classification (DEFAULT)

Unless `--force-all` / `--task-ids` / `--since` was passed, skip tasks that already look classified. A task is "already classified" when **all three** of `Angle`, `Hook Type`, and `Creative Structure` have a non-null value.

```python
def needs_classification(task, field_lookup):
    """Return True if the task has a Drive Link but is missing classification fields."""
    vals = {f["name"].lower(): f.get("value") for f in task.get("custom_fields", [])}
    # A task is "classified" when all three signal fields are filled.
    classified = all(
        vals.get(name) is not None and vals.get(name) != ""
        for name in ("angle", "hook type", "creative structure")
    )
    has_drive = any(
        vals.get(k) for k in ("drive link", "drivelink", "drive_url", "drive")
    )
    return has_drive and not classified

tasks_to_process = [t for t in all_tasks if needs_classification(t, FIELDS)]
skipped_count = len(all_tasks) - len(tasks_to_process)
print(f"{len(tasks_to_process)} tasks to classify, {skipped_count} already classified (use --force-all to include them)")
```

If `--force-all` is set, use every task with a Drive Link instead. If `--task-ids` is set, use only those IDs. If `--since` is set, filter further by `date_updated >= since` (ClickUp returns epoch ms).

### 1b. Fetch all dropdown field IDs + option UUIDs (ALWAYS do this — never hard-code for new lists)

```python
r = requests.get(f"{BASE}/list/{LIST_ID}/field", headers=HEADERS)
fields = r.json().get("fields", [])

field_ids = {}
dropdown_opts = {}

for f in fields:
    field_ids[f["name"]] = f["id"]
    print(f"  {f['name']}: {f['id']} ({f['type']})")
    if f["type"] == "drop_down":
        opts = f.get("type_config", {}).get("options", [])
        dropdown_opts[f["name"]] = {o["name"]: o["id"] for o in opts}
        for o in opts:
            print(f"    '{o['name']}': '{o['id']}'")
```

Map the discovered field names to the classification dimensions. Standard field name mappings:

| Classification field | Likely ClickUp field name |
|---|---|
| hook_type | Hook Type |
| creative_structure | Creative Structure |
| funnel_type | Funnel Type |
| photo_video | Photo/Video |
| production_style | Production Style |
| angle_tag | Angle Tag |
| persona_tag | Persona Tag |
| creative_usp | Creative USP |
| notes | Notes |

**KMH list (901613118174) — verified field IDs:**
```python
FIELDS = {
    "angle_tag":          "844a0196-1c61-47d9-819e-c52d53d0a556",
    "persona_tag":        "7319ac88-d4db-48c0-b7ad-e673fa1c0f10",
    "hook_type":          "5949b7ae-2756-47b8-987e-b18d41aa71ce",
    "creative_structure": "b166f47c-8274-4a3a-a484-a58f70646534",
    "funnel_type":        "d29a6366-6f8f-490e-9e3a-09843702ef0f",
    "photo_video":        "e9cbc329-0c30-4004-b063-38246b96c2cc",
    "production_style":   "d1eab4f7-618c-469f-b736-69913d9bdbbe",
    "creative_usp":       "63c8363c-e1d2-4429-b934-aa91c36ee271",
    "notes":              "026db3ae-a577-43b9-b536-8f114236b1d0",
}
```

**KMH list — verified dropdown UUIDs:**
```python
HOOK_OPTS = {
    "Pain / Problem":           "cc9d42c5-aebe-440d-b0f1-e1d21238be50",
    "Fear":                     "ad64479d-75b2-406c-a698-7845ac12cc97",
    "Curiosity":                "84892493-4dcb-4e81-9832-34c352f55294",
    "Social Proof":             "4a366d08-e7bd-463e-8c3a-0f04012dab19",
    "Aspirational":             "27c5e5b8-5aef-4fa0-94f4-9c0406bd1232",
    "Direct Offer":             "26ccfe33-a16b-4fbe-85ba-a930ce374f13",
    "Controversy / Bold Claim": "0bea5ebd-03b2-4c3b-b9a0-fc396891921f",
    "POV":                      "ad08ca30-f549-45b6-bc88-94d89537361e",
    "Question":                 "3911b1ce-b258-4da4-b32a-5b7b7f58e42c",
    "Pattern Interrupt":        "fd627727-5191-4416-8884-477c4f28de02",
    # Fallbacks
    "Emotional Empathy":        "cc9d42c5-aebe-440d-b0f1-e1d21238be50",
    "Loss Aversion":            "cc9d42c5-aebe-440d-b0f1-e1d21238be50",
    "Benefit-led":              "27c5e5b8-5aef-4fa0-94f4-9c0406bd1232",
    "Urgency/News":             "26ccfe33-a16b-4fbe-85ba-a930ce374f13",
    "News/Trend":               "fd627727-5191-4416-8884-477c4f28de02",
    "Contrast":                 "cc9d42c5-aebe-440d-b0f1-e1d21238be50",
}
STRUCT_OPTS = {
    "UGC":                    "d1ea4b5d-bbf0-48f1-9916-352038351846",
    "Testimonial":            "48ca7ae6-fc83-4c81-a53f-9b3f51e54788",
    "Demo":                   "e6bd44a1-bc4d-459c-aa56-36859f7b3221",
    "Tutorial/How-To":        "f2a5aa2c-2c8e-42e9-b204-d408393652de",
    "Tutorial / How-To":      "f2a5aa2c-2c8e-42e9-b204-d408393652de",
    "Story/Narrative":        "0114d79e-de93-4573-8369-16c7791609cc",
    "Story / Narrative":      "0114d79e-de93-4573-8369-16c7791609cc",
    "Hook+Offer":             "6d5912f8-4ead-4aaf-a662-f20fb37410d8",
    "Hook + Offer":           "6d5912f8-4ead-4aaf-a662-f20fb37410d8",
    "Listicle":               "a9ee75de-b686-4381-9b14-ac0e1589ec7d",
    "Static/Photo":           "6dece974-e7ce-43b5-a338-baf8ad422d42",
    "Static / Photo":         "6dece974-e7ce-43b5-a338-baf8ad422d42",
    "Comparison":             "502a7a30-e5ba-4e93-a1cd-2f4d9566cc70",
    "Interview":              "14eebc71-baff-47f3-a74c-6eb452cdbe9f",
    "Skit/Roleplay":          "1e0c0363-0f73-4df0-8152-1cf4f432de20",
    "Skit / Roleplay":        "1e0c0363-0f73-4df0-8152-1cf4f432de20",
    "AI/Voiceover":           "626a1b94-2dd6-4a40-997d-d41b0c417262",
    "AI / Voiceover":         "626a1b94-2dd6-4a40-997d-d41b0c417262",
    # Fallbacks
    "Slideshow/Compilation":  "6dece974-e7ce-43b5-a338-baf8ad422d42",
    "Problem-Pivot-Solution": "0114d79e-de93-4573-8369-16c7791609cc",
    "PAS":                    "0114d79e-de93-4573-8369-16c7791609cc",
}
FUNNEL_OPTS = {
    "TOF": "e506c64e-504c-4fe1-97ef-7b091e510ea0",
    "MOF": "48b36fea-0c1a-4ff8-93e0-a16be8ed25df",
    "BOF": "1fa187f0-4f42-4e0f-8414-641f66ae5a20",
}
PV_OPTS = {
    "Video": "f9f8f39a-5acf-4ab1-ab27-1565e35876b2",
    "Photo": "aa59e6a4-bf2d-42b8-b0e8-4c9078b4a7f4",
    # Carousel / UGC not in dropdown — skip gracefully
}
PROD_OPTS = {
    "Organic/Raw UGC":    "d2edf2c5-8f62-479b-a9c1-d4498238c9f3",
    "Organic / Raw UGC":  "d2edf2c5-8f62-479b-a9c1-d4498238c9f3",
    "Polished UGC":       "4990f11c-de36-4708-a0a6-f294833cbc0b",
    "Professional Studio":"42e802f9-19a0-4d6c-9328-a5cfbf9efb2c",
    "AI Generated":       "1daf5071-af86-49ab-9fff-cddad4ff5b92",
    "Screen Record":      "7c0e6f9e-8a8c-4a26-8e97-8c90289d937c",
    "Animation/Motion":   "620cc3e5-f09a-4030-9bfb-449c7515c454",
    "Animation / Motion": "620cc3e5-f09a-4030-9bfb-449c7515c454",
    "Static Graphic":     "3faab7cc-1b61-415e-b21f-4dab0fbfdecf",
    "Slideshow":          "06c77341-582b-4ee0-85a7-7b4ee32517b3",
    "Repurposed Organic": "e6370838-5a4c-44ca-9fea-aba49ee0c29a",
    "Competitor Inspired":"a45842ca-7e95-47af-b4d7-91e186623226",
}
```

**For a NEW list:** Re-fetch all UUIDs fresh. Never reuse UUIDs across different ClickUp lists — they are list-specific.

---

## STEP 2 — Split into batches + spawn parallel agents

| Task count | Agents | Tasks/agent |
|---|---|---|
| 1–15 | Run inline | — |
| 16–50 | 5 agents | ~10 each |
| 51–100 | 10 agents | ~10 each |
| 101–200 | 14 agents | ~12 each |
| 200+ | 20 agents | ~10 each |

Write batch files: `/tmp/cu_batch_{N}.json` — array of task objects.
Spawn all agents in a single message with `run_in_background: true`.

Each agent prompt must include:
- API key + all field IDs + all dropdown UUIDs
- Doc ID + Workspace ID
- Known Angles + Known Personas
- Batch file path + result file path

---

## STEP 3 — Per-task pipeline (each agent does this for its tasks)

### 3a. Download from Google Drive

```python
import subprocess, re, os, glob, shutil

# Normalize Drive URLs. Google sometimes puts /u/0/ or /u/1/ in the path
# (account-scoped view). The account-scoped URLs only work if the folder
# is actually shared publicly; stripping /u/N/ doesn't grant access to
# private folders — it just gives cleaner errors. If gdown returns an
# empty folder for a /u/1/ URL, that folder is private and the task
# should be skipped with status "private_folder_or_access_denied".
def normalize_drive_url(u):
    return re.sub(r'/drive/u/\d+/', '/drive/', u or '')

def video_or_image(path):
    """Return type tag or None if neither."""
    lo = path.lower()
    if lo.endswith(('.mp4', '.mov', '.mkv', '.webm')): return 'video'
    if lo.endswith(('.jpg', '.jpeg', '.png', '.webp')): return 'image'
    return None

work_dir = f"/tmp/cu_work_{task_id}"
os.makedirs(work_dir, exist_ok=True)
url = normalize_drive_url(drive_url)

# Case A — folder URL: use gdown --folder to download everything at once.
# (There is NO --dry-run flag in gdown; we were wrong to use it before.)
# gdown creates a subdirectory inside work_dir named after the folder,
# so we glob the whole work_dir recursively to find files.
m_folder = re.search(r'/folders/([a-zA-Z0-9_-]+)', url)
m_file   = re.search(r'/file/d/([a-zA-Z0-9_-]+)', url)

downloaded = None
if m_folder:
    try:
        subprocess.run(
            ["python3", "-m", "gdown", "--folder", url,
             "-O", work_dir, "--quiet"],
            capture_output=True, text=True, timeout=300, check=False)
    except subprocess.TimeoutExpired:
        pass
    # Pick the first video, else the first image, else give up
    all_files = sorted(glob.glob(f"{work_dir}/**/*", recursive=True))
    vids = [f for f in all_files if video_or_image(f) == 'video' and os.path.getsize(f) > 10000]
    imgs = [f for f in all_files if video_or_image(f) == 'image' and os.path.getsize(f) > 10000]
    if vids:
        downloaded = vids[0]
    elif imgs:
        downloaded = imgs[0]
elif m_file:
    # Single-file share link — download directly via requests (not gdown).
    import requests
    fid = m_file.group(1)
    for ext in ('.mp4', '.mov', '.jpg', '.jpeg', '.png'):
        dest = f"{work_dir}/creative{ext}"
        r = requests.get(
            f"https://drive.usercontent.google.com/download?id={fid}&export=download&authuser=0&confirm=t",
            stream=True, timeout=120)
        size = 0
        with open(dest, "wb") as f:
            for chunk in r.iter_content(65536):
                if chunk: f.write(chunk); size += len(chunk)
        # Detect HTML-return (private/error) by first bytes
        with open(dest, "rb") as f: head = f.read(200)
        if size > 10000 and not head.startswith(b"<!DOCTYPE") and not head.lower().startswith(b"<html"):
            downloaded = dest
            break
        os.remove(dest)

# If still nothing, mark as private/missing and skip this task
if not downloaded:
    result = {"task_id": task_id, "success": False,
              "error": "private_folder_or_empty_or_no_media",
              "drive_url": drive_url}
    # write result JSON and continue to next task
```

### 3b. Extract frames

```python
import subprocess, glob, shutil

if downloaded and downloaded.endswith(('.mp4', '.mov')):
    subprocess.run([
        "ffmpeg", "-i", downloaded,
        "-vf", "fps=1/5,scale=800:-1", "-q:v", "2",
        f"{work_dir}/frame_%03d.jpg"
    ], capture_output=True)
    os.remove(downloaded)
elif downloaded:
    shutil.copy(downloaded, f"{work_dir}/frame_001.jpg")

frames = sorted(glob.glob(f"{work_dir}/frame_*.jpg"))[:6]
```

### 3c. Visually classify (Read tool — up to 6 frames)

You are a senior media buyer. For each creative classify:

| Field | Valid values |
|---|---|
| photo_video | Video, Photo |
| hook_type | Pain / Problem, Fear, Curiosity, Social Proof, Aspirational, Direct Offer, Controversy / Bold Claim, POV, Question, Pattern Interrupt |
| creative_structure | UGC, Testimonial, Demo, Tutorial/How-To, Story/Narrative, Hook+Offer, Listicle, Static/Photo, Comparison, Interview, Skit/Roleplay, AI/Voiceover |
| production_style | Organic/Raw UGC, Polished UGC, Professional Studio, AI Generated, Screen Record, Animation/Motion, Static Graphic, Slideshow, Repurposed Organic, Competitor Inspired |
| funnel_type | TOF, MOF, BOF |
| angle | Match known angles (≥60% → exact name; else 2-5 word new label) |
| persona | Match known personas (≥60% → exact name; else 4-6 word new label) |
| creative_usp | 20 words max |
| creative_hypothesis | 2 sentences: why made + why it works. 35 words max |
| notes | What you literally see. 30 words max |
| body_copy_from_frames | All visible on-screen text / subtitles |

### 3d. Build 7-section brief

```
FRAME_BY_FRAME: | Time | Label | What Happens | Emotion |
WHY_IT_WORKS: 4-5 psychological mechanisms
REPLICATION_BRIEF: talent, set, overlays, pacing, music, end card
WHAT_TO_TEST: 5 variation ideas
COMPETITOR_INTEL: scale, funnel, gap, lane decision
OUR_NEXT_AD: steal, differ, 3-bullet editor brief, hypothesis
```

Also build:
- **PERSONA ANALYSIS**: Demographics | Core Pain Points (3) | What They Want | How This Creative Speaks to Them | Messaging That Resonates | Messaging to Avoid
- **ANGLE ANALYSIS**: Core Insight | Why It Works | How It's Executed Here | Variants to Explore (3)

---


---

## STEP 3.5 — Consolidation checkpoint (new)

After all agents finish classifying, **do NOT write anything to ClickUp yet.** Collect every agent's output into `results[]` (the list of dicts each agent wrote to `/tmp/pipeline_<task_id>.json`).

Then split the proposed Angles and Personas into three buckets per field:

| Bucket | Definition |
|---|---|
| **EXACT** | `result["angle"]` matches an existing dropdown option name case-insensitively. No action needed. |
| **FUZZY** | `result["angle"]` has a 60%+ word-overlap with an existing option (use the helper below). Auto-map to that existing option; still surface to user for sanity check. |
| **NEW** | No match. Candidate for a new dropdown option. **Requires user approval before ClickUp write.** |

### 3.5a — Clustering helper

```python
def normalize(s):
    return (s or "").lower().strip()

def word_overlap_ratio(a, b):
    """Jaccard overlap of meaningful words (length ≥ 4). Returns 0.0–1.0."""
    wa = {w for w in normalize(a).split() if len(w) >= 4}
    wb = {w for w in normalize(b).split() if len(w) >= 4}
    if not wa or not wb: return 0.0
    return len(wa & wb) / len(wa | wb)

def classify_proposals(proposals, existing_options, threshold=0.6):
    """Return dict: {'exact': [...], 'fuzzy': [(proposed, matched_canonical)], 'new': [...]}"""
    existing_lc = {normalize(o["name"]): o["name"] for o in existing_options}
    result = {"exact": [], "fuzzy": [], "new": []}
    for p in proposals:
        pn = normalize(p)
        if pn in existing_lc:
            result["exact"].append(p)
        else:
            best = None; best_ratio = 0.0
            for lc, canonical in existing_lc.items():
                r = word_overlap_ratio(p, canonical)
                if r > best_ratio:
                    best_ratio = r; best = canonical
            if best and best_ratio >= threshold:
                result["fuzzy"].append((p, best, best_ratio))
            else:
                result["new"].append(p)
    return result
```

### 3.5b — Cluster NEW proposals into similarity groups

If there are 3+ NEW proposals, use the same `word_overlap_ratio` against each other to merge near-duplicates (e.g. "Marriage Prediction" + "Marriage Forecast" + "Future Spouse Reading" → one cluster). Suggest a canonical label per cluster (the longest proposal by default, or the most common).

```python
def cluster_similar(items, threshold=0.6):
    """Group items where word_overlap_ratio >= threshold. Returns list of clusters."""
    remaining = list(items); clusters = []
    while remaining:
        seed = remaining.pop(0)
        cluster = [seed]
        remaining = [
            x for x in remaining
            if not (word_overlap_ratio(seed, x) >= threshold and cluster.append(x) or False)
        ]
        clusters.append(cluster)
    return clusters
```

### 3.5c — Present to the user and WAIT for approval

Print a report that looks like this (example with real clusters):

```
═══════════════════════════════════════════════════════════════════════════
  CONSOLIDATION CHECKPOINT — Angles
═══════════════════════════════════════════════════════════════════════════

✅ 23 tasks matched existing angle exactly. No action needed.

⚠️  7 tasks fuzzy-matched (≥60%) — auto-mapped to existing:
    • "Marriage & Partnership"      → "Marriage Prediction"        (3 tasks)
    • "Future spouse identification" → "Marriage Prediction"        (2 tasks)
    • "Palm reading demo"            → "Palm Reading"               (2 tasks)

🆕 5 NEW angle clusters found (not in existing dropdown):
  [N1]  "Wealth Attraction" + "Money Manifestation" + "Prosperity Mantra"   (3 tasks)
        Suggested canonical: "Wealth Attraction"

  [N2]  "AI Astrology Demo"                                                  (2 tasks)
        Suggested canonical: "AI Astrology Demo"

  [N3]  "Career Success Prediction"                                          (1 task)
        Suggested canonical: "Career Success Prediction"

── What should I do with the NEW clusters? ──
  [a] Accept all suggested canonicals + add them as new dropdown options
  [r] Review each cluster individually (rename / split / merge / drop)
  [s] Skip ClickUp angle writes for NEW proposals; leave Angle blank on those tasks
  [f] Show me each task's full context for clusters I'm unsure about
```

Wait for the user's choice. If `[r]` is picked, iterate cluster-by-cluster:

```
[N1] Wealth Attraction + Money Manifestation + Prosperity Mantra  (3 tasks)
     Suggested canonical: "Wealth Attraction"
     Options: [a]ccept, [c]ustom rename, [m]erge-into-existing <name>, [s]plit, [d]rop
     Your choice: _
```

After all angles are resolved, repeat the same flow for Personas.

### 3.5d — Apply user's decisions to results in memory

Build a mapping `angle_mapping: {proposed_label → final_label_to_write}` (and the same for persona). Apply to every entry in `results[]`:

```python
for r in results:
    r["angle_final"]   = angle_mapping.get(r["angle"], r["angle"])
    r["persona_final"] = persona_mapping.get(r["persona"], r["persona"])
```

From here on, all ClickUp writes use `*_final` values. NEW options approved by the user are added to the dropdown before the per-task writes (ClickUp MCP: `clickup_add_dropdown_option` or equivalent API call — if the ClickUp API rejects, fall back to text/short_text field and warn the user).

### 3.5e — Edge case: `--skip-consolidation` flag

If the user passed `--skip-consolidation`, bypass the approval UI: auto-accept all suggested canonicals, create all NEW options automatically, log what was done in the final summary. Use only when you trust the existing dropdown to absorb everything cleanly.

## STEP 4 — Create ClickUp Doc page

Use `clickup_create_document_page` MCP tool:
```
document_id: <DOC_ID>
name: "{task_name} — {angle}"
sub_title: "Facebook/Meta · {funnel_type} · {hook_type} hook"
content_format: "text/md"
content: <full markdown below>
```

**Page markdown template:**
```markdown
# {task_name} — {angle}

---

## 1. SNAPSHOT
| Field | Value |
|---|---|
| **Task ID** | {task_id} |
| **Task Name** | {task_name} |
| **Platform** | Facebook / Meta |
| **Funnel** | {funnel_type} |
| **Format** | {photo_video} — {production_style} |
| **Hook Type** | {hook_type} |
| **Creative Structure** | {creative_structure} |
| **Angle** | {angle} |
| **Persona** | {persona} |
| **Status** | {status} |
| **Drive Link** | {drive_url} |

**Body Copy from Frames:** {body_copy_from_frames}
**Creative USP:** {creative_usp}
**In one sentence:** {creative_hypothesis}
**Notes:** {notes}

---

## 2. CREATIVE BREAKDOWN
{FRAME_BY_FRAME table}

---

## 3. WHY IT WORKS
{4-5 psychological mechanisms}

---

## 4. REPLICATION BRIEF
{talent, set, overlays, pacing, music, end card}

---

## 5. WHAT TO TEST
{5 numbered variation ideas}

---

## 6. COMPETITOR INTEL
{scale, funnel, gap, lane decision}

---

## 7. OUR NEXT AD
{steal, differ, 3-bullet editor brief, hypothesis}

---

## 8. PERSONA ANALYSIS
| Attribute | Detail |
|---|---|
| **Demographics** | ... |
| **Core Pain Points** | ... |
| **What They Want** | ... |
| **How This Creative Speaks to Them** | ... |
| **Messaging That Resonates** | ... |
| **Messaging to Avoid** | ... |

---

## 9. ANGLE ANALYSIS
- **Core Insight:** ...
- **Why It Works:** ...
- **How It's Executed Here:** ...
- **Variants to Explore:** ...
```

---

## STEP 5 — Update ClickUp task (11 operations)

```python
doc_url = f"https://app.clickup.com/{WORKSPACE_ID}/docs/{DOC_ID}/{page_id}"

def set_field(task_id, field_id, value):
    r = requests.post(f"{BASE}/task/{task_id}/field/{field_id}",
        headers=HEADERS, json={"value": value})
    return r.status_code == 200

# 1. Prepend doc link to description
task_data = requests.get(f"{BASE}/task/{task_id}", headers=HEADERS).json()
existing_desc = task_data.get("description") or ""
if doc_url not in existing_desc:
    new_desc = f"📄 Creative Brief: {doc_url}\n\n{existing_desc}".strip()
    requests.put(f"{BASE}/task/{task_id}", headers=HEADERS, json={"description": new_desc})

# 2. Add comment
comment = (
    f"📄 Creative Brief: {doc_url}\n\n"
    f"Full visual analysis, frame-by-frame breakdown, persona + angle analysis, "
    f"and replication brief are in the doc above.\n\n"
    f"Angle: {angle} | Persona: {persona} | Hook: {hook_type} | Funnel: {funnel_type}"
)
requests.post(f"{BASE}/task/{task_id}/comment", headers=HEADERS, json={"comment_text": comment})

# 3-11. Custom fields
set_field(task_id, FIELDS["angle_tag"], angle)
set_field(task_id, FIELDS["persona_tag"], persona)
set_field(task_id, FIELDS["creative_usp"], creative_usp)
set_field(task_id, FIELDS["notes"], notes[:200])
if hook_type in HOOK_OPTS:       set_field(task_id, FIELDS["hook_type"], HOOK_OPTS[hook_type])
if creative_structure in STRUCT_OPTS: set_field(task_id, FIELDS["creative_structure"], STRUCT_OPTS[creative_structure])
if funnel_type in FUNNEL_OPTS:   set_field(task_id, FIELDS["funnel_type"], FUNNEL_OPTS[funnel_type])
if photo_video in PV_OPTS:       set_field(task_id, FIELDS["photo_video"], PV_OPTS[photo_video])
if production_style in PROD_OPTS: set_field(task_id, FIELDS["production_style"], PROD_OPTS[production_style])
```

---

## STEP 6 — Save result + cleanup

Each agent writes `/tmp/cu_result_{task_id}.json`:
```json
{
  "task_id": "...", "task_name": "...", "status": "...",
  "success": true,
  "photo_video": "...", "hook_type": "...",
  "creative_structure": "...", "production_style": "...",
  "funnel_type": "...", "angle": "...", "angle_matched": true,
  "persona": "...", "persona_matched": true,
  "creative_usp": "...", "creative_hypothesis": "...",
  "notes": "...", "body_copy_from_frames": "...",
  "clickup_doc_page_id": "...",
  "error": null
}
```

Cleanup: `rm -rf /tmp/cu_work_{task_id}`

---

## STEP 7 — Fix-up pass (run after all agents complete)

Re-set any `creative_structure` values that may have used wrong UUIDs:

```python
import glob, json

results = []
for path in glob.glob("/tmp/cu_result_*.json"):
    try: results.append(json.load(open(path)))
    except: pass

NEEDS_VERIFY = {"Listicle","Static/Photo","Tutorial/How-To","Slideshow/Compilation","AI/Voiceover"}
fixed = 0
for r in results:
    cs = r.get("creative_structure","")
    if cs in NEEDS_VERIFY and r.get("success") and r.get("clickup_doc_page_id"):
        uuid = STRUCT_OPTS.get(cs)
        if uuid:
            ok = set_field(r["task_id"], FIELDS["creative_structure"], uuid)
            if ok: fixed += 1

print(f"Fix-up: {fixed} creative_structure fields corrected")
```

---

## STEP 8 — Final summary

```
✅ ClickUp Creative Data Fill — COMPLETE

List:     {LIST_ID}
Product:  {product_name}

Tasks processed:     X
Doc pages created:   X
Fields updated:      X
Skipped (no Drive):  X
Skipped (private):   X
Errors:              X

Doc: https://app.clickup.com/{workspace_id}/docs/{doc_id}
```

---

## Using on a NEW list (generic / non-preset product)

1. Provide the List ID and Doc ID
2. This skill auto-fetches all field IDs and dropdown UUIDs from the live API (Step 1b)
3. Map discovered field names to classification dimensions
4. If field names differ (e.g. "Ad Format" instead of "Creative Structure"), tell Claude the mapping
5. All dropdown UUIDs will be fetched fresh — no risk of stale IDs

Example invocations:
- *"run clickup creative data fill on list 901613118174, doc 8cq1r3y-33336, KMH product"*
- *"fill creative fields for list 901600001234, doc 8xyz-5678, product Astro Rekha, angles: Love Match, Compatibility, Palm Reading, personas: Women 25-35 India"*
- *"do the creative pipeline on https://app.clickup.com/9016762494/v/l/901613118174"*

---

## Error handling

| Error | Fix |
|---|---|
| Drive download returns HTML (~10KB) | Folder is private — note in result, skip task, continue |
| gdown `--dry-run` not supported | Remove flag, use folder listing without dry-run |
| 401 on ClickUp API | API key expired — check `$CLICKUP_API_KEY` in `~/.classify-inspiration.env` or ask user for a fresh one. |
| Dropdown UUID rejected (400) | Run fix-up pass in Step 7 with verified UUIDs |
| `success=false` in result | Skip ClickUp updates — classification failed |
| Empty `clickup_doc_page_id` | Skip field updates — doc creation failed |
| gdown `--folder` lists 0 files | Try direct file ID download instead |

---

## Prerequisites

```bash
ffmpeg -version        # must be installed
pip3 install gdown requests
```

Google Drive folders must be set to "Anyone with the link can view".
