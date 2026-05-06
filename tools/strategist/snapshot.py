"""Repo snapshot writer.

Writes tools/strategist_memory/<slug>.{md,json} after each successful run.
Best-effort: any IO error returns None and is logged by the caller.
"""

import json
from pathlib import Path
from typing import Optional


def _atomic_write(path: Path, content: str) -> None:
    """Write atomically — temp file + rename."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content)
    tmp.replace(path)


def write_snapshot(slug: str, memory_json: dict, markdown: str,
                   out_dir: Path) -> Optional[dict]:
    """Write the .md and .json snapshot files. Return paths dict or None."""
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
        md_path   = out_dir / f"{slug}.md"
        json_path = out_dir / f"{slug}.json"
        _atomic_write(md_path,   markdown)
        _atomic_write(json_path, json.dumps(memory_json, indent=2))
        return {"md": md_path, "json": json_path}
    except OSError:
        return None
