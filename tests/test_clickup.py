"""Tests for tools/strategist/clickup.py."""
import json
from unittest.mock import patch
from tools.strategist import clickup


def _mock_response(payload):
    """Patch helper — returns a response-like context-manager."""
    class _Resp:
        def read(self_inner):
            return json.dumps(payload).encode()
        def __enter__(self_inner):
            return self_inner
        def __exit__(self_inner, *a):
            return False
    return _Resp()


def test_list_tasks_paginates_until_empty():
    pages = [
        {"tasks": [{"id": "t1", "status": {"status": "winner"}}]},
        {"tasks": [{"id": "t2", "status": {"status": "loser"}}]},
        {"tasks": []},
    ]
    with patch("tools.strategist.clickup.urllib.request.urlopen") as m:
        m.side_effect = [_mock_response(p) for p in pages]
        out = clickup.list_tasks(api_key="k", list_id="L1", include_closed=True)
    assert [t["id"] for t in out] == ["t1", "t2"]
    assert m.call_count == 3


def test_list_tasks_uses_correct_url_and_headers():
    with patch("tools.strategist.clickup.urllib.request.urlopen") as m:
        m.return_value = _mock_response({"tasks": []})
        clickup.list_tasks(api_key="my-key", list_id="L1", include_closed=True)
    req = m.call_args[0][0]
    assert "list/L1/task" in req.full_url
    assert "include_closed=true" in req.full_url
    assert req.headers["Authorization"] == "my-key"


def test_get_task_full_returns_payload():
    with patch("tools.strategist.clickup.urllib.request.urlopen") as m:
        m.return_value = _mock_response({"id": "t1", "name": "task one"})
        out = clickup.get_task_full(api_key="k", task_id="t1")
    assert out["id"] == "t1"


def test_get_task_comments_returns_comments_list():
    with patch("tools.strategist.clickup.urllib.request.urlopen") as m:
        m.return_value = _mock_response({"comments": [
            {"comment_text": "hi"}, {"comment_text": "bye"}]})
        out = clickup.get_task_comments(api_key="k", task_id="t1")
    assert [c["comment_text"] for c in out] == ["hi", "bye"]


def test_get_custom_fields_returns_fields_list():
    with patch("tools.strategist.clickup.urllib.request.urlopen") as m:
        m.return_value = _mock_response({"fields": [
            {"id": "f1", "name": "Hook Type"},
            {"id": "f2", "name": "Spend"}]})
        out = clickup.get_list_custom_fields(api_key="k", list_id="L1")
    assert {f["name"] for f in out} == {"Hook Type", "Spend"}


def test_extract_doc_url_from_description():
    desc = "see brief at https://app.clickup.com/9016762494/v/dc/abc-123 thanks"
    assert clickup.extract_clickup_doc_url(desc) == \
        "https://app.clickup.com/9016762494/v/dc/abc-123"


def test_extract_doc_url_returns_none_when_absent():
    assert clickup.extract_clickup_doc_url("no link here") is None
    assert clickup.extract_clickup_doc_url(None) is None


def test_compute_content_hash_stable_across_runs():
    h1 = clickup.compute_content_hash(
        status="winner",
        description="desc",
        comments=[{"comment_text": "hi"}],
        custom_fields={"Hook Type": "Curiosity", "Spend": 100.0},
    )
    h2 = clickup.compute_content_hash(
        status="winner",
        description="desc",
        comments=[{"comment_text": "hi"}],
        custom_fields={"Spend": 100.0, "Hook Type": "Curiosity"},  # reordered
    )
    assert h1 == h2


def test_compute_content_hash_changes_on_status_change():
    h1 = clickup.compute_content_hash(
        status="winner", description="d", comments=[], custom_fields={})
    h2 = clickup.compute_content_hash(
        status="loser", description="d", comments=[], custom_fields={})
    assert h1 != h2
