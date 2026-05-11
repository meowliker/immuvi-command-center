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
   - Read Immuvi Creative Strategist memory for the product through `strategist_memory` when available. It contains markdown plus JSON with strategy, creative direction, copy, winning/dying combinations, and evidence task ids.
   - If available, read the latest `producer_runs` row for the task to avoid duplicate generations and to understand previous outputs.

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
