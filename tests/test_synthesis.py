"""Tests for tools/strategist/synthesis.py."""
from unittest.mock import patch, MagicMock
from tools.strategist import synthesis


_TASK_BUNDLE = {
    "task_id": "t1",
    "title": "AT-114 Pediatrician UGC",
    "status": "winner",
    "description": "...",
    "comments": [{"comment_text": "talent change to mom worked"}],
    "custom_fields": {
        "Persona Tag": "tired-mom",
        "Angle Tag": "pediatrician-recommended",
        "Hook Type": "Social Proof",
        "Creative Structure": "UGC",
        "Production Style": "Polished UGC",
        "Funnel Type": "TOF",
        "Spend": 320.50,
        "Revenue": 1240.0,
    },
    "doc_page_text": "7-section brief content here",
}


def _ok_subprocess_result(stdout: str):
    r = MagicMock()
    r.returncode = 0
    r.stdout = stdout
    r.stderr = ""
    return r


def test_synthesise_task_returns_brief_json_when_claude_returns_json():
    expected = {
        "strategy": {"angle_tag": "pediatrician-recommended",
                     "persona_tag": "tired-mom",
                     "emotion": "relief"},
        "creative": {"creative_structure": "UGC",
                     "production_style": "Polished UGC",
                     "funnel_type": "TOF",
                     "hook_type": "Social Proof"},
        "copy":     {"hook": "...", "lingo": ["doctor-tested"]},
        "production": {"talent": "mom"},
        "why_it_won": "resonated with tired moms because pediatrician framing",
    }
    import json
    fake_stdout = "garbage\n```json\n" + json.dumps(expected) + "\n```\nOK"
    with patch("tools.strategist.synthesis.subprocess.run") as run:
        run.return_value = _ok_subprocess_result(fake_stdout)
        got = synthesis.synthesise_task(_TASK_BUNDLE)
    assert got == expected


def test_synthesise_task_raises_on_nonzero_exit():
    err = MagicMock(); err.returncode = 1
    err.stdout = ""; err.stderr = "boom"
    with patch("tools.strategist.synthesis.subprocess.run") as run:
        run.return_value = err
        try:
            synthesis.synthesise_task(_TASK_BUNDLE)
        except synthesis.SynthesisError as e:
            assert "exit 1" in str(e) or "boom" in str(e)
        else:
            assert False, "expected SynthesisError"


def test_synthesise_task_raises_on_unparseable_output():
    with patch("tools.strategist.synthesis.subprocess.run") as run:
        run.return_value = _ok_subprocess_result("no json fence here at all")
        try:
            synthesis.synthesise_task(_TASK_BUNDLE)
        except synthesis.SynthesisError as e:
            assert "parse" in str(e).lower()
        else:
            assert False, "expected SynthesisError"


def test_synthesise_task_invokes_claude_with_bypass_perms():
    import json
    valid = {"strategy": {}, "creative": {}, "copy": {}, "production": {},
             "why_it_won": "x"}
    with patch("tools.strategist.synthesis.subprocess.run") as run:
        run.return_value = _ok_subprocess_result("```json\n" +
                                                 json.dumps(valid) + "\n```")
        synthesis.synthesise_task(_TASK_BUNDLE)
    cmd = run.call_args[0][0]
    assert cmd[0] == "claude"
    assert "-p" in cmd
    assert "--permission-mode" in cmd
    assert "bypassPermissions" in cmd


def test_extract_json_block_handles_fenced_and_unfenced():
    fenced = synthesis._extract_json_block('```json\n{"a": 1}\n```')
    assert fenced == {"a": 1}
    unfenced = synthesis._extract_json_block('blah\n{"a": 2}\nblah')
    assert unfenced == {"a": 2}
