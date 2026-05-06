"""Tests for tools/strategist/renderer.py."""
from unittest.mock import patch, MagicMock
from tools.strategist import renderer


def _result(stdout, code=0, stderr=""):
    r = MagicMock(); r.returncode = code; r.stdout = stdout; r.stderr = stderr
    return r


def test_render_markdown_returns_stdout_when_claude_succeeds():
    md = "# Strategist Memory — Test Product\n\nWhat's winning right now\n..."
    with patch("tools.strategist.renderer.subprocess.run") as run:
        run.return_value = _result(md)
        out = renderer.render_markdown(memory_json={"product_name": "Test"})
    assert out.startswith("# Strategist Memory")


def test_render_markdown_strips_leading_trailing_whitespace():
    with patch("tools.strategist.renderer.subprocess.run") as run:
        run.return_value = _result("\n\n# Hi\n\n")
        assert renderer.render_markdown({"product_name": "x"}) == "# Hi"


def test_render_markdown_raises_on_nonzero_exit():
    with patch("tools.strategist.renderer.subprocess.run") as run:
        run.return_value = _result("", code=1, stderr="oops")
        try:
            renderer.render_markdown({"product_name": "x"})
        except renderer.RenderError as e:
            assert "exit 1" in str(e) or "oops" in str(e)
        else:
            assert False, "expected RenderError"


def test_render_markdown_uses_bypass_perms():
    with patch("tools.strategist.renderer.subprocess.run") as run:
        run.return_value = _result("# Hi")
        renderer.render_markdown({"product_name": "x"})
    cmd = run.call_args[0][0]
    assert cmd[0] == "claude"
    assert "bypassPermissions" in cmd
