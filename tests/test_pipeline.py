"""Integration test for the strategist pipeline orchestrator.
All external boundaries are mocked at the module level."""
from unittest.mock import patch, MagicMock
from tools.strategist import pipeline


_PRODUCT = {
    "id": "prod-1", "name": "Test Product",
    "config": {"clickup_list_id": "L1"},
}


def _make_task(task_id, status, fields_by_name=None, comments_n=0):
    return {
        "id": task_id,
        "name": f"task {task_id}",
        "description": f"desc {task_id}",
        "status": {"status": status},
        "custom_fields": [{"name": k, "type": "short_text", "value": v}
                          for k, v in (fields_by_name or {}).items()],
        "url": f"https://app.clickup.com/t/{task_id}",
    }


def _mocks(get_product, list_tasks, get_task_full, get_task_comments,
           load_processed, synthesise, render_markdown,
           upsert_processed, upsert_memory, write_snapshot,
           claim_run, finish_run):
    return patch.multiple("tools.strategist.pipeline",
        get_product=get_product, list_tasks=list_tasks,
        get_task_full=get_task_full, get_task_comments=get_task_comments,
        load_processed_rows=load_processed,
        synthesise_task=synthesise,
        render_markdown=render_markdown,
        upsert_processed_row=upsert_processed,
        upsert_memory=upsert_memory,
        write_snapshot=write_snapshot,
        claim_run=claim_run, finish_run=finish_run)


def test_pipeline_processes_only_changed_tasks():
    judged_tasks = [
        _make_task("t1", "winner",      {"Persona Tag": "p"}),
        _make_task("t2", "loser",       {"Persona Tag": "p"}),
        _make_task("t3", "testing",     {}),  # excluded — not judged
    ]
    fetched_full = {
        "t1": _make_task("t1", "winner", {"Persona Tag": "p", "Spend": 10, "Revenue": 40}),
        "t2": _make_task("t2", "loser",  {"Persona Tag": "p"}),
    }
    cached = [{
        "product_id": "prod-1", "clickup_task_id": "t1",
        "content_hash": "stale-hash", "brief_json": {},
        "is_winner": True, "status": "winner",
        "spend": 10.0, "revenue": 40.0,
        "last_synthesized": "2026-05-05",
    }]

    synth_calls = []
    def synth(bundle):
        synth_calls.append(bundle["task_id"])
        return {"strategy": {}, "creative": {}, "copy": {},
                "production": {}, "why_it_won": "x", "why_it_died": "x"}

    upserts = []
    def up_processed(supabase_url, service_key, row):
        upserts.append(row["clickup_task_id"])

    memory_writes = []
    def up_mem(supabase_url, service_key, product_id, memory_json, markdown):
        memory_writes.append((product_id, len(memory_json["winner_briefs"]),
                              len(memory_json["loser_briefs"])))

    snap_writes = []
    def snap(slug, memory_json, markdown, out_dir):
        snap_writes.append(slug)
        return {"md": "x", "json": "y"}

    runs_claimed = []
    def claim(*a, **kw):
        runs_claimed.append(kw.get("run_id"))
        return {"id": kw.get("run_id"), "status": "running"}

    runs_finished = []
    def finish(*, supabase_url, service_key, run_id, status,
               tasks_processed, tasks_skipped, error):
        runs_finished.append((run_id, status, tasks_processed, error))
        return {"status": status}

    # The pipeline reloads processed rows after synthesis to build the
    # aggregate. Provide a load_processed that returns cached on first call
    # and the full set (with new entries) on second call.
    load_calls = {"n": 0}
    def load(supabase_url, service_key, product_id):
        load_calls["n"] += 1
        if load_calls["n"] == 1:
            return cached
        # After synthesis, processed table contains both t1 (re-synthesised)
        # and t2 (newly synthesised).
        return [
            {"product_id": "prod-1", "clickup_task_id": "t1",
             "content_hash": "h1", "brief_json": synth({"task_id": "t1"}),
             "is_winner": True, "status": "winner",
             "spend": 10.0, "revenue": 40.0, "last_synthesized": "x"},
            {"product_id": "prod-1", "clickup_task_id": "t2",
             "content_hash": "h2", "brief_json": synth({"task_id": "t2"}),
             "is_winner": False, "status": "loser",
             "spend": None, "revenue": None, "last_synthesized": "x"},
        ]

    with _mocks(
        get_product       = MagicMock(return_value=_PRODUCT),
        list_tasks        = MagicMock(return_value=judged_tasks),
        get_task_full     = MagicMock(side_effect=lambda **kw: fetched_full[kw["task_id"]]),
        get_task_comments = MagicMock(return_value=[]),
        load_processed    = MagicMock(side_effect=load),
        synthesise        = MagicMock(side_effect=synth),
        render_markdown   = MagicMock(return_value="# memo"),
        upsert_processed  = MagicMock(side_effect=up_processed),
        upsert_memory     = MagicMock(side_effect=up_mem),
        write_snapshot    = MagicMock(side_effect=snap),
        claim_run         = MagicMock(side_effect=claim),
        finish_run        = MagicMock(side_effect=finish),
    ):
        pipeline.run_strategist_for_product(
            supabase_url="https://x.supabase.co",
            service_key="K",
            clickup_api_key="CK",
            run_id=42, product_id="prod-1", worker_id="wkr-1",
            snapshot_dir="/tmp/snap")

    # t1's content hash changed (it now has Spend/Revenue) → re-synthesised.
    # t2 is new → synthesised.
    # t3 is excluded (testing).
    # Note: synth_calls also includes the helper invocations from `load`,
    # so just check both real task IDs are present.
    assert "t1" in synth_calls
    assert "t2" in synth_calls
    assert sorted(upserts) == ["t1", "t2"]

    # Memory written with 1 winner + 1 loser.
    assert memory_writes == [("prod-1", 1, 1)]

    # Snapshot named with slug.
    assert snap_writes == ["test-product"]

    # Run finished done.
    assert runs_finished == [(42, "done", 2, None)]


def test_pipeline_marks_run_failed_on_synthesis_error():
    judged_tasks = [_make_task("t1", "winner", {})]
    fetched = {"t1": _make_task("t1", "winner", {})}

    finishes = []
    def finish(**kw):
        finishes.append(kw)
        return {"status": kw["status"]}

    def synth(bundle):
        from tools.strategist.synthesis import SynthesisError
        raise SynthesisError("claude exit 1: ratelimited")

    with _mocks(
        get_product       = MagicMock(return_value=_PRODUCT),
        list_tasks        = MagicMock(return_value=judged_tasks),
        get_task_full     = MagicMock(return_value=fetched["t1"]),
        get_task_comments = MagicMock(return_value=[]),
        load_processed    = MagicMock(return_value=[]),
        synthesise        = MagicMock(side_effect=synth),
        render_markdown   = MagicMock(return_value="# m"),
        upsert_processed  = MagicMock(),
        upsert_memory     = MagicMock(),
        write_snapshot    = MagicMock(return_value=None),
        claim_run         = MagicMock(return_value={"id": 7}),
        finish_run        = MagicMock(side_effect=finish),
    ):
        pipeline.run_strategist_for_product(
            supabase_url="u", service_key="k", clickup_api_key="ck",
            run_id=7, product_id="prod-1", worker_id="w",
            snapshot_dir="/tmp")

    # Per-task failure: skip task, run still completes done with tasks_skipped=1.
    assert len(finishes) == 1
    assert finishes[0]["status"]          == "done"
    assert finishes[0]["tasks_processed"] == 0
    assert finishes[0]["tasks_skipped"]   == 1
