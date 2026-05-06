"""Strategist pipeline orchestrator.

One entry point: run_strategist_for_product(...). Wires together db,
clickup, synthesis, aggregate, renderer, snapshot. All collaborators
are imported by name so tests can patch.multiple at this module level.
"""

from pathlib import Path
from typing import Optional

from tools.strategist.taxonomy import (
    is_judged, classify_status, slugify, extract_field_value,
    CANONICAL_FIELD_KEYS,
)
from tools.strategist.clickup import (
    list_tasks, get_task_full, get_task_comments, get_list_custom_fields,
    extract_clickup_doc_url, compute_content_hash,
)
from tools.strategist.db import (
    get_product, load_processed_rows, upsert_processed_row,
    upsert_memory, claim_run, finish_run,
)
from tools.strategist.synthesis import synthesise_task, SynthesisError
from tools.strategist.aggregate import build_memory_json
from tools.strategist.renderer import render_markdown, RenderError
from tools.strategist.snapshot import write_snapshot


def _flatten_custom_fields(task: dict) -> dict:
    """Convert ClickUp's array-of-fields shape into name → value dict.

    Only canonical names are kept; unknown fields are dropped.
    """
    out = {}
    canonical = set(CANONICAL_FIELD_KEYS)
    for f in task.get("custom_fields", []) or []:
        name = f.get("name")
        if name not in canonical:
            continue
        val = extract_field_value(f)
        if val is not None:
            out[name] = val
    return out


def _bundle_for_synthesis(task_full: dict, comments: list) -> dict:
    fields = _flatten_custom_fields(task_full)
    return {
        "task_id":       task_full["id"],
        "title":         task_full.get("name") or "",
        "status":        (task_full.get("status") or {}).get("status") or "",
        "description":   task_full.get("description") or "",
        "comments":      comments,
        "custom_fields": fields,
        "doc_page_text": None,  # extracted from description if present, future
    }


def run_strategist_for_product(*, supabase_url: str, service_key: str,
                               clickup_api_key: str,
                               run_id: int, product_id: str,
                               worker_id: str, snapshot_dir: str,
                               log=print) -> None:
    """Execute the full strategist pipeline for one product."""
    log(f"[strategist] claim run_id={run_id} product={product_id}")
    claim_run(supabase_url=supabase_url, service_key=service_key,
              run_id=run_id, worker_id=worker_id)

    tasks_processed = 0
    tasks_skipped   = 0
    err: Optional[str] = None

    try:
        product = get_product(supabase_url=supabase_url,
                              service_key=service_key,
                              product_id=product_id)
        if not product:
            raise RuntimeError(f"product {product_id} not found")
        list_id = (product.get("config") or {}).get("clickup_list_id")
        if not list_id:
            raise RuntimeError(
                f"product {product_id} has no clickup_list_id in config")

        log(f"[strategist] list tasks from list_id={list_id}")
        all_tasks = list_tasks(api_key=clickup_api_key, list_id=list_id,
                               include_closed=True)
        judged = [t for t in all_tasks
                  if is_judged((t.get("status") or {}).get("status"))]
        log(f"[strategist] {len(all_tasks)} total, {len(judged)} judged")

        cached = load_processed_rows(supabase_url=supabase_url,
                                     service_key=service_key,
                                     product_id=product_id)
        cache_by_id = {r["clickup_task_id"]: r for r in cached}

        for short in judged:
            task_id = short["id"]
            try:
                full = get_task_full(api_key=clickup_api_key, task_id=task_id)
                comments = get_task_comments(api_key=clickup_api_key,
                                             task_id=task_id, max_comments=30)
                bundle = _bundle_for_synthesis(full, comments)
                fields = bundle["custom_fields"]
                hash_now = compute_content_hash(
                    status=bundle["status"],
                    description=bundle["description"],
                    comments=comments,
                    custom_fields=fields,
                )
                cached_row = cache_by_id.get(task_id)
                if cached_row and cached_row["content_hash"] == hash_now:
                    continue  # unchanged — keep cached brief

                brief = synthesise_task(bundle)
                spend   = fields.get("Spend")
                revenue = fields.get("Revenue")
                upsert_processed_row(supabase_url=supabase_url,
                                     service_key=service_key,
                                     row={
                    "product_id":      product_id,
                    "clickup_task_id": task_id,
                    "content_hash":    hash_now,
                    "brief_json":      brief,
                    "is_winner":       classify_status(bundle["status"])
                                       == "winner_group",
                    "status":          bundle["status"].strip().lower(),
                    "spend":           spend,
                    "revenue":         revenue,
                })
                tasks_processed += 1
            except SynthesisError as e:
                log(f"[strategist] task {task_id} synthesis FAIL: {e}")
                tasks_skipped += 1

        # Reload cache (now includes anything newly synthesised) for aggregate.
        cached_after = load_processed_rows(supabase_url=supabase_url,
                                           service_key=service_key,
                                           product_id=product_id)
        # Filter to only judged tasks still present in ClickUp.
        present_ids = {t["id"] for t in judged}
        rows = [r for r in cached_after
                if r["clickup_task_id"] in present_ids]

        memory_json = build_memory_json(product_id=product_id,
                                        product_name=product["name"],
                                        processed_rows=rows)

        try:
            markdown = render_markdown(memory_json)
        except RenderError as e:
            log(f"[strategist] render FAIL: {e}")
            markdown = (f"# Strategist Memory — {product['name']}\n\n"
                        f"_render failed: {e}_\n")

        upsert_memory(supabase_url=supabase_url, service_key=service_key,
                      product_id=product_id, memory_json=memory_json,
                      markdown=markdown)

        slug = slugify(product["name"])
        snap = write_snapshot(slug=slug, memory_json=memory_json,
                              markdown=markdown,
                              out_dir=Path(snapshot_dir))
        if snap is None:
            log(f"[strategist] snapshot write failed (non-fatal)")

    except Exception as e:
        err = f"{type(e).__name__}: {e}"
        log(f"[strategist] FATAL: {err}")
        finish_run(supabase_url=supabase_url, service_key=service_key,
                   run_id=run_id, status="failed",
                   tasks_processed=tasks_processed,
                   tasks_skipped=tasks_skipped, error=err)
        return

    finish_run(supabase_url=supabase_url, service_key=service_key,
               run_id=run_id, status="done",
               tasks_processed=tasks_processed,
               tasks_skipped=tasks_skipped, error=None)
    log(f"[strategist] DONE processed={tasks_processed} "
        f"skipped={tasks_skipped}")
