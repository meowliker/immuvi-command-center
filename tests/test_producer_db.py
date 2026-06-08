"""Tests for tools/producer/db.py."""
import json
from unittest.mock import patch
from tools.producer import db


def _mock_resp(payload, code=200):
    class _R:
        status = code
        def read(self): return json.dumps(payload).encode()
        def __enter__(self): return self
        def __exit__(self, *a): return False
    return _R()


def test_pop_pending_run_returns_first_pending():
    rows = [{"id": 7, "task_id": "ck-t1", "product_id": "prod-1",
             "status": "pending", "count": 5,
             "instruction": "make it pop", "trigger": "manual"}]
    with patch("tools.producer.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp(rows)
        out = db.pop_pending_run(supabase_url="https://x.supabase.co", service_key="k",
                                 worker_id="w-1")
    assert out["id"] == 7
    assert out["task_id"] == "ck-t1"


def test_pop_pending_run_returns_none_when_empty():
    with patch("tools.producer.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp([])
        assert db.pop_pending_run(supabase_url="https://x.supabase.co", service_key="k",
                                  worker_id="w-1") is None


def test_pop_pending_run_strict_mode_requires_preferred_worker():
    rows = [{"id": 8, "task_id": "ck-dev", "product_id": "prod-dev",
             "status": "pending", "preferred_worker_id": "dev-worker"}]
    with patch("tools.producer.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp(rows)
        out = db.pop_pending_run(
            supabase_url="https://x.supabase.co",
            service_key="k",
            worker_id="dev-worker",
            require_preferred_worker=True,
        )
    assert out["id"] == 8
    req = m.call_args[0][0]
    assert "preferred_worker_id=eq.dev-worker" in req.full_url
    assert "preferred_worker_id.is.null" not in req.full_url


def test_claim_run_flips_pending_to_running():
    out_rows = [{"id": 7, "status": "running", "worker_id": "w-1"}]
    with patch("tools.producer.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp(out_rows)
        out = db.claim_run(supabase_url="https://x.supabase.co", service_key="k",
                           run_id=7, worker_id="w-1")
    assert out["status"] == "running"
    assert out["worker_id"] == "w-1"


def test_claim_run_raises_when_already_claimed():
    """If another worker claimed it, PATCH returns [] (no rows matched)."""
    with patch("tools.producer.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp([])
        try:
            db.claim_run(supabase_url="https://x.supabase.co", service_key="k",
                         run_id=7, worker_id="w-1")
        except RuntimeError:
            pass
        else:
            assert False, "expected RuntimeError on lost claim race"


def test_finish_run_done_sends_outputs_and_finished_at():
    with patch("tools.producer.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp([{"id": 7, "status": "done"}])
        out = db.finish_run(
            supabase_url="https://x.supabase.co", service_key="k", run_id=7,
            status="done",
            outputs=[{"drive_url": "https://drive.google.com/x",
                      "clickup_attachment_id": "abc",
                      "prompt": "doctor angle hero shot"}],
            error=None,
        )
    assert out["status"] == "done"
    body = json.loads(m.call_args[0][0].data.decode())
    assert body["status"] == "done"
    assert body["outputs"][0]["drive_url"] == "https://drive.google.com/x"
    assert "finished_at" in body


def test_finish_run_failed_sets_error():
    with patch("tools.producer.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp([{"id": 7, "status": "failed"}])
        db.finish_run(supabase_url="https://x.supabase.co", service_key="k", run_id=7,
                      status="failed", outputs=None,
                      error="nano-banana exit 1: ratelimited")
    body = json.loads(m.call_args[0][0].data.decode())
    assert body["status"] == "failed"
    assert "ratelimited" in body["error"]
