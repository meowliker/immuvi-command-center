"""Tests for tools/strategist/db.py."""
import json
from unittest.mock import patch
from tools.strategist import db


def _mock_resp(payload, code=200):
    class _R:
        status = code
        def read(self): return json.dumps(payload).encode()
        def __enter__(self): return self
        def __exit__(self, *a): return False
    return _R()


def test_load_processed_returns_rows():
    rows = [{"product_id": "p", "clickup_task_id": "t1",
             "content_hash": "h", "brief_json": {"a": 1},
             "is_winner": True, "status": "winner",
             "spend": None, "revenue": None,
             "last_synthesized": "2026-05-06T..."}]
    with patch("tools.strategist.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp(rows)
        out = db.load_processed_rows(supabase_url="u", service_key="k",
                                     product_id="p")
    assert len(out) == 1
    assert out[0]["clickup_task_id"] == "t1"


def test_upsert_processed_sends_correct_body():
    with patch("tools.strategist.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp([])
        db.upsert_processed_row(
            supabase_url="u", service_key="k",
            row={
                "product_id": "p", "clickup_task_id": "t1",
                "content_hash": "h", "brief_json": {"x": 1},
                "is_winner": True, "status": "winner",
                "spend": 10.0, "revenue": 40.0,
            },
        )
    req = m.call_args[0][0]
    sent = json.loads(req.data.decode())
    assert sent["clickup_task_id"] == "t1"
    assert "Prefer" in req.headers
    assert "merge-duplicates" in req.headers["Prefer"]


def test_upsert_memory_sets_updated_at():
    with patch("tools.strategist.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp([])
        db.upsert_memory(
            supabase_url="u", service_key="k",
            product_id="p", memory_json={"a": 1}, markdown="md")
    body = json.loads(m.call_args[0][0].data.decode())
    assert body["product_id"] == "p"
    assert body["json"]       == {"a": 1}
    assert body["markdown"]   == "md"


def test_claim_run_marks_status_running():
    """claim_run should atomically flip status pending → running with worker_id."""
    updated = [{"id": 7, "product_id": "p", "status": "running",
                "trigger": "daily", "run_date": "2026-05-06",
                "worker_id": "wkr-1"}]
    with patch("tools.strategist.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp(updated)
        out = db.claim_run(supabase_url="u", service_key="k",
                           run_id=7, worker_id="wkr-1")
    assert out["status"]    == "running"
    assert out["worker_id"] == "wkr-1"


def test_finish_run_sets_done():
    with patch("tools.strategist.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp([{"id": 7, "status": "done"}])
        out = db.finish_run(
            supabase_url="u", service_key="k",
            run_id=7, status="done", tasks_processed=5,
            tasks_skipped=0, error=None)
    assert out["status"] == "done"


def test_pop_pending_run_returns_none_when_empty():
    with patch("tools.strategist.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp([])
        assert db.pop_pending_run(
            supabase_url="u", service_key="k",
            worker_id="wkr-1") is None
