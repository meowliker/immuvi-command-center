"""Tests for tools/strategist/snapshot.py."""
import json
from pathlib import Path
from tools.strategist import snapshot


def test_write_snapshot_creates_files(tmp_path):
    out_dir = tmp_path / "strategist_memory"
    paths = snapshot.write_snapshot(
        slug="astro-rekha",
        memory_json={"product_name": "Astro Rekha", "last_updated": "x"},
        markdown="# Hi",
        out_dir=out_dir,
    )
    assert (out_dir / "astro-rekha.md").read_text() == "# Hi"
    parsed = json.loads((out_dir / "astro-rekha.json").read_text())
    assert parsed["product_name"] == "Astro Rekha"
    assert paths == {
        "md":   out_dir / "astro-rekha.md",
        "json": out_dir / "astro-rekha.json",
    }


def test_write_snapshot_overwrites_existing(tmp_path):
    out_dir = tmp_path / "strategist_memory"
    out_dir.mkdir()
    (out_dir / "x.md").write_text("OLD")
    snapshot.write_snapshot(slug="x", memory_json={}, markdown="NEW",
                            out_dir=out_dir)
    assert (out_dir / "x.md").read_text() == "NEW"


def test_write_snapshot_returns_none_on_io_error(tmp_path, monkeypatch):
    out_dir = tmp_path / "strategist_memory"
    def boom(*a, **kw):
        raise OSError("disk full")
    monkeypatch.setattr(snapshot, "_atomic_write", boom)
    assert snapshot.write_snapshot(
        slug="x", memory_json={}, markdown="m", out_dir=out_dir) is None
