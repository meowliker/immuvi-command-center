#!/usr/bin/env python3
"""
Audit winner angle/persona assignments from actual video media.

This is an operator tool, not part of the browser bundle. It:
  - pulls all Winner / Mild Winner / Scale parent creatives from Supabase
  - resolves Google Drive file/folder links
  - downloads videos to a temp cache
  - transcribes full audio with local Whisper
  - samples frames across the full video and OCRs them with macOS Vision
  - compares each creative against winner buckets inside the same product
  - writes a JSON + Markdown suggestion report
"""

from __future__ import annotations

import argparse
import collections
import contextlib
import datetime as dt
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras


WIN_STATUSES = {"Winner", "Mild Winner", "Scale"}
VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm"}
DRIVE_FOLDER_RE = re.compile(r"/folders/([a-zA-Z0-9_-]+)|[?&]folders/([a-zA-Z0-9_-]+)")
DRIVE_FILE_RE = re.compile(r"/file/d/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)")


def load_env() -> None:
    for raw in [Path.home() / ".classify-inspiration.env", Path.cwd() / ".env", Path.home() / ".env"]:
        if not raw.exists():
            continue
        for line in raw.read_text(errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip("'\""))
        break


def run(cmd: list[str], timeout: int | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)


def slug(value: str, fallback: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9._-]+", "-", value or "").strip("-")
    return s[:90] or fallback


def parse_drive_id(url: str) -> tuple[str, str] | tuple[None, None]:
    if not url:
        return None, None
    m = DRIVE_FOLDER_RE.search(url)
    if m:
        return "folder", next(g for g in m.groups() if g)
    m = DRIVE_FILE_RE.search(url)
    if m:
        return "file", next(g for g in m.groups() if g)
    return None, None


def load_rows(product: str | None = None) -> tuple[list[dict[str, Any]], dict[str, str], dict[str, list[str]], dict[str, list[str]]]:
    db_url = os.environ.get("SUPABASE_DB_URL")
    db_password = os.environ.get("SUPABASE_DB_PASSWORD")
    if not db_url:
        raise SystemExit("SUPABASE_DB_URL missing")
    if db_password:
        os.environ["PGPASSWORD"] = db_password
    with psycopg2.connect(db_url) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("select id, name from public.products order by name")
            products = {r["id"]: r["name"] for r in cur.fetchall()}
            cur.execute("select product_id, name from public.angles where archived_at is null order by name")
            angles: dict[str, list[str]] = collections.defaultdict(list)
            for r in cur.fetchall():
                angles[r["product_id"]].append(r["name"])
            cur.execute("select product_id, name from public.personas where archived_at is null order by name")
            personas: dict[str, list[str]] = collections.defaultdict(list)
            for r in cur.fetchall():
                personas[r["product_id"]].append(r["name"])

            params: list[Any] = []
            product_filter = ""
            if product:
                product_filter = " and (a.product_id = %s or lower(p.name) = lower(%s))"
                params += [product, product]
            cur.execute(
                """
                select
                  p.name as product_name,
                  a.product_id,
                  a.id,
                  a.format_name,
                  a.status,
                  a.angle,
                  a.persona,
                  a.ad_link,
                  a.drive_link,
                  a.ad_type,
                  a.funnel_stage,
                  a.meta,
                  a.created_at,
                  a.updated_at
                from public.ads a
                join public.products p on p.id = a.product_id
                where a.status = any(%s)
                  and a.parent_ad_id is null
                  and a.deleted_at is null
                """ + product_filter + " order by p.name, a.id",
                [list(WIN_STATUSES)] + params,
            )
            rows = [dict(r) for r in cur.fetchall()]
    return rows, products, dict(angles), dict(personas)


def resolve_drive_videos(urls: list[str], max_files_per_folder: int) -> list[dict[str, str]]:
    import gdown

    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for url in urls:
        kind, drive_id = parse_drive_id(url)
        if not drive_id:
            continue
        try:
            if kind == "file":
                if drive_id not in seen:
                    seen.add(drive_id)
                    out.append({"id": drive_id, "name": drive_id + ".mp4", "url": f"https://drive.google.com/file/d/{drive_id}/view"})
            elif kind == "folder":
                files = gdown.download_folder(id=drive_id, output="/tmp/immuvi-drive-list", quiet=True, skip_download=True)
                videos = []
                for f in files or []:
                    name = getattr(f, "path", "") or ""
                    fid = getattr(f, "id", "") or ""
                    if Path(name).suffix.lower() in VIDEO_EXTS and fid:
                        videos.append({"id": fid, "name": Path(name).name, "url": f"https://drive.google.com/file/d/{fid}/view"})
                videos.sort(key=lambda x: x["name"])
                for video in videos[:max_files_per_folder]:
                    if video["id"] in seen:
                        continue
                    seen.add(video["id"])
                    out.append(video)
        except Exception as e:
            out.append({"id": "", "name": "", "url": url, "error": str(e)})
    return out


def download_drive_file(file_id: str, out_path: Path) -> bool:
    import gdown

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists() and out_path.stat().st_size > 1024 * 1024:
        return True
    try:
        gdown.download(id=file_id, output=str(out_path), quiet=True, fuzzy=False)
    except Exception:
        pass
    if out_path.exists() and out_path.stat().st_size > 1024 * 1024:
        return True
    with contextlib.suppress(Exception):
        if out_path.exists():
            out_path.unlink()
    direct = f"https://drive.google.com/uc?export=download&id={file_id}"
    proc = run(["curl", "-L", "--fail", "--max-time", "180", "-o", str(out_path), direct], timeout=210)
    if out_path.exists() and out_path.stat().st_size > 1024 * 1024:
        return True
    with contextlib.suppress(Exception):
        if out_path.exists():
            out_path.unlink()
    if proc.stderr:
        print(f"[audit] curl download failed for {file_id}: {proc.stderr.strip()[:240]}")
    return False


def media_duration(path: Path) -> float:
    proc = run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], timeout=30)
    with contextlib.suppress(Exception):
        return float(proc.stdout.strip())
    return 0.0


def extract_frames(video: Path, frames_dir: Path, max_frames: int) -> list[Path]:
    frames_dir.mkdir(parents=True, exist_ok=True)
    duration = media_duration(video)
    if duration <= 0:
        duration = 30
    fps = max_frames / max(duration, 1)
    fps = min(1.0, max(1 / 8, fps))
    pattern = str(frames_dir / "frame_%03d.jpg")
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(video),
        "-vf", f"fps={fps:.4f},scale=540:-1", "-frames:v", str(max_frames), "-q:v", "3", pattern
    ], timeout=120)
    return sorted(frames_dir.glob("frame_*.jpg"))


def ensure_ocr_helper(path: Path) -> None:
    path.write_text(
        r'''import Foundation
import Vision
import AppKit

let args = Array(CommandLine.arguments.dropFirst())
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["en-US"]

func esc(_ s: String) -> String {
    let data = try! JSONEncoder().encode(s)
    return String(data: data, encoding: .utf8)!
}

for path in args {
    autoreleasepool {
        let url = URL(fileURLWithPath: path)
        guard let image = NSImage(contentsOf: url),
              let tiff = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff),
              let cgImage = bitmap.cgImage else {
            print("{\"path\":\(esc(path)),\"text\":\"\"}")
            return
        }
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do {
            try handler.perform([request])
            let text = (request.results ?? [])
                .compactMap { $0.topCandidates(1).first?.string }
                .joined(separator: " ")
            print("{\"path\":\(esc(path)),\"text\":\(esc(text))}")
        } catch {
            print("{\"path\":\(esc(path)),\"text\":\"\"}")
        }
    }
}
''',
        encoding="utf-8",
    )


def ocr_frames(frames: list[Path], helper: Path) -> str:
    if not frames:
        return ""
    proc = run(["swift", str(helper), *map(str, frames)], timeout=max(60, 12 * len(frames)))
    texts = []
    for line in proc.stdout.splitlines():
        with contextlib.suppress(Exception):
            item = json.loads(line)
            text = item.get("text") or ""
            if text:
                texts.append(text)
    return "\n".join(texts)


def transcribe(video: Path, model_name: str) -> str:
    import whisper

    if not hasattr(transcribe, "_model"):
        transcribe._model = whisper.load_model(model_name)  # type: ignore[attr-defined]
    result = transcribe._model.transcribe(str(video), fp16=False, verbose=False)  # type: ignore[attr-defined]
    return (result.get("text") or "").strip()


STOPWORDS = set("""
the a an and or of in for to is are was were be been by with from that this it as at on into about around who when
while using use uses used have has had do does did can could should would will just then than them their they you your
i me my we our us not no yes get got give gives make makes made take takes see show shows open opens close cut cuts shot
shots frame frames scene scenes hook bridge proof demo cta caption voice over script text screen timing headline one two
three first second third free today download comment link source full exact available unavailable ad ads ugc tof mof bof
video photo image static graphic reel instagram facebook tiktok youtube clickup winner testing tested untested scale mild
ready launch age aged male female women woman men man adult adults kids kid child children parent parents mom moms mother
dad dads father but thi com below above here grab want wants need needs like really very more much many most few some own
same different thing things one two three four five six seven eight nine ten
""".split())

SYN = {
    "sellers": "seller", "selling": "seller", "sell": "seller",
    "hustlers": "hustler", "hustles": "hustle",
    "tools": "tool", "toolkit": "tool", "toolkits": "tool", "resources": "tool", "resource": "tool",
    "worksheets": "worksheet", "workbook": "worksheet", "workbooks": "worksheet", "printables": "printable", "pages": "page",
    "helps": "help", "supporting": "support", "supports": "support", "solutions": "solution",
    "medicationfree": "medication", "meds": "medication",
    "adhders": "adhd", "adhder": "adhd",
    "dysregulated": "dysregulation", "dysregulate": "dysregulation",
    "procrastinating": "procrastination", "procrastinate": "procrastination",
    "quilters": "quilter", "quilting": "quilt", "quilts": "quilt",
    "teachers": "teacher", "classrooms": "classroom",
    "nurses": "nurse", "nursing": "nurse",
}


def evidence_text(row: dict[str, Any], media: dict[str, Any] | None = None) -> str:
    meta = row.get("meta") if isinstance(row.get("meta"), dict) else {}
    parts = [
        row.get("format_name"), row.get("angle"), row.get("persona"), row.get("ad_type"), row.get("funnel_stage"),
        meta.get("creativeUSP"), meta.get("creativeHypothesis"), meta.get("notes"), meta.get("hookText"),
        meta.get("bodyCopy"), meta.get("captionTranscript"), meta.get("voiceOver"), meta.get("voiceOverTimeline"),
        meta.get("nextAdScripts"), meta.get("hookType"), meta.get("creativeStructure"), meta.get("productionStyle"),
    ]
    if media:
        parts += [media.get("transcript"), media.get("ocr")]
    return " ".join(json.dumps(p, ensure_ascii=False) if isinstance(p, (dict, list)) else str(p or "") for p in parts)


def tokens(text: str) -> collections.Counter[str]:
    s = text.lower()
    s = re.sub(r"https?://\S+", " ", s)
    s = re.sub(r"[⭐★*_`~|<>\[\]{}]", " ", s)
    s = re.sub(r"\b\d{1,4}(?:\s*(?:to|-)\s*\d{1,4})?\+?\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    out: collections.Counter[str] = collections.Counter()
    for raw in s.split():
        tok = SYN.get(raw, raw)
        if len(tok) > 5 and tok.endswith("ing"):
            tok = tok[:-3]
        if len(tok) > 4 and tok.endswith("ies"):
            tok = tok[:-3] + "y"
        elif len(tok) > 3 and tok.endswith("s") and not tok.endswith("ss"):
            tok = tok[:-1]
        tok = SYN.get(tok, tok)
        if len(tok) <= 2 or tok in STOPWORDS:
            continue
        out[tok] += 1
    return out


def cosine(a: collections.Counter[str], b: collections.Counter[str]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(a[k] * b.get(k, 0) for k in a)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def top_terms(a: collections.Counter[str], b: collections.Counter[str], n: int = 8) -> list[str]:
    shared = [(k, min(v, b[k])) for k, v in a.items() if k in b]
    return [k for k, _ in sorted(shared, key=lambda x: (-x[1], x[0]))[:n]]


def analyze_assignments(rows: list[dict[str, Any]], media_by_ad: dict[str, dict[str, Any]]) -> dict[str, Any]:
    row_tokens = {}
    for row in rows:
        row_tokens[row["id"]] = tokens(evidence_text(row, media_by_ad.get(row["id"])))

    by_product = collections.defaultdict(list)
    for row in rows:
        by_product[row["product_id"]].append(row)

    moves = []
    merges = []
    for pid, prod_rows in by_product.items():
        for kind, field in [("angle", "angle"), ("persona", "persona")]:
            buckets: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
            for row in prod_rows:
                if row.get(field):
                    buckets[str(row[field])].append(row)
            bucket_tokens: dict[str, collections.Counter[str]] = {}
            for name, bucket_rows in buckets.items():
                total = collections.Counter()
                for row in bucket_rows:
                    total.update(row_tokens[row["id"]])
                bucket_tokens[name] = total

            names = list(buckets)
            for i, left in enumerate(names):
                for right in names[i + 1:]:
                    score = cosine(bucket_tokens[left], bucket_tokens[right])
                    label_score = cosine(tokens(left), tokens(right))
                    smaller = min(len(buckets[left]), len(buckets[right]))
                    if score < 0.58:
                        continue
                    if smaller < 2 and label_score < 0.45:
                        continue
                    keep = left if len(buckets[left]) >= len(buckets[right]) else right
                    merge = right if keep == left else left
                    merges.append({
                        "product": prod_rows[0]["product_name"],
                        "kind": kind,
                        "merge": merge,
                        "keep": keep,
                        "score": round(score, 3),
                        "merge_winners": len(buckets[merge]),
                        "keep_winners": len(buckets[keep]),
                        "shared": top_terms(bucket_tokens[left], bucket_tokens[right]),
                    })

            for row in prod_rows:
                current = row.get(field) or ""
                if not current or current not in bucket_tokens:
                    continue
                own_bucket = collections.Counter(bucket_tokens[current])
                own_bucket.subtract(row_tokens[row["id"]])
                own_bucket = +own_bucket
                own_score = cosine(row_tokens[row["id"]], own_bucket) if own_bucket else 0.0
                best = None
                for name, btoks in bucket_tokens.items():
                    if name == current:
                        continue
                    score = cosine(row_tokens[row["id"]], btoks)
                    if score < 0.44 or score < own_score + 0.16:
                        continue
                    candidate = {
                        "product": row["product_name"],
                        "kind": kind,
                        "creative_id": row["id"],
                        "creative_name": row.get("format_name") or row["id"],
                        "from": current,
                        "to": name,
                        "score": round(score, 3),
                        "own_score": round(own_score, 3),
                        "shared": top_terms(row_tokens[row["id"]], btoks),
                    }
                    if best is None or candidate["score"] > best["score"]:
                        best = candidate
                if best:
                    moves.append(best)

    merges.sort(key=lambda x: (-x["score"], x["product"], x["kind"]))
    moves.sort(key=lambda x: (-x["score"], x["product"], x["creative_id"], x["kind"]))
    return {"merge_suggestions": merges, "move_suggestions": moves}


def write_report(path: Path, rows: list[dict[str, Any]], media_by_ad: dict[str, dict[str, Any]], analysis: dict[str, Any]) -> None:
    lines = []
    lines.append("# Winner Taxonomy Video Audit")
    lines.append("")
    lines.append(f"Generated: {dt.datetime.now().isoformat(timespec='seconds')}")
    lines.append(f"Winners scanned: {len(rows)}")
    lines.append(f"Winners with downloaded video evidence: {sum(1 for r in rows if media_by_ad.get(r['id'], {}).get('videos'))}")
    lines.append("")
    lines.append("## Merge Whole Angle/Persona Buckets")
    if analysis["merge_suggestions"]:
        for s in analysis["merge_suggestions"][:80]:
            lines.append(f"- **{s['product']} · {s['kind']}**: merge `{s['merge']}` into `{s['keep']}` ({int(s['score']*100)}%). Shared evidence: {', '.join(s['shared']) or 'overlap'}; winners {s['merge_winners']} -> {s['keep_winners']}.")
    else:
        lines.append("- No full-bucket merge suggestions crossed the evidence threshold.")
    lines.append("")
    lines.append("## Move Specific Creatives")
    if analysis["move_suggestions"]:
        for s in analysis["move_suggestions"][:160]:
            lines.append(f"- **{s['product']} · {s['creative_name']} ({s['creative_id']}) · {s['kind']}**: move `{s['from']}` -> `{s['to']}` ({int(s['score']*100)}% vs own {int(s['own_score']*100)}%). Shared evidence: {', '.join(s['shared']) or 'overlap'}.")
    else:
        lines.append("- No individual creative moves crossed the evidence threshold.")
    lines.append("")
    lines.append("## Media Coverage Notes")
    missing = [r for r in rows if not media_by_ad.get(r["id"], {}).get("videos")]
    if missing:
        lines.append(f"- {len(missing)} winners did not have downloadable Drive video evidence in this run. They were scored from stored text only.")
        for r in missing[:80]:
            lines.append(f"  - {r['product_name']} · {r.get('format_name') or r['id']} ({r['id']})")
    else:
        lines.append("- Every winner had downloadable Drive video evidence.")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", help="Product id or exact product name to audit")
    ap.add_argument("--limit", type=int, default=0, help="Limit winner rows for a test run")
    ap.add_argument("--max-files-per-folder", type=int, default=3)
    ap.add_argument("--max-frames", type=int, default=10)
    ap.add_argument("--whisper-model", default="tiny")
    ap.add_argument("--out-dir", default="reports/winner-taxonomy-video-audit")
    ap.add_argument("--skip-media", action="store_true")
    ap.add_argument("--keep-media", action="store_true", help="Keep downloaded videos and extracted frames in the temp cache")
    args = ap.parse_args()

    load_env()
    rows, _products, _angles, _personas = load_rows(args.product)
    if args.limit:
        rows = rows[: args.limit]
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    cache = Path(os.environ.get("IMMUVI_WINNER_AUDIT_CACHE", "/tmp/immuvi_winner_video_audit"))
    cache.mkdir(parents=True, exist_ok=True)
    ocr_helper = cache / "ocr.swift"
    ensure_ocr_helper(ocr_helper)

    media_by_ad: dict[str, dict[str, Any]] = {}
    media_json = out_dir / "media_evidence.json"
    if media_json.exists():
        with contextlib.suppress(Exception):
            media_by_ad = json.loads(media_json.read_text())

    print(f"[audit] winners={len(rows)}")
    for idx, row in enumerate(rows, 1):
        ad_id = row["id"]
        if media_by_ad.get(ad_id, {}).get("done"):
            print(f"[audit] {idx}/{len(rows)} cached {ad_id}")
            continue
        links = [row.get("drive_link") or "", row.get("ad_link") or ""]
        videos = resolve_drive_videos([u for u in links if "drive.google.com" in u], args.max_files_per_folder)
        item = {"videos": [], "errors": [], "done": False}
        if args.skip_media:
            item["done"] = True
            media_by_ad[ad_id] = item
            continue
        for v in videos:
            if v.get("error") or not v.get("id"):
                item["errors"].append(v.get("error") or v.get("url") or "unresolved drive file")
                continue
            ext = Path(v["name"]).suffix.lower() or ".mp4"
            local = cache / slug(row.get("product_name") or "product", "product") / ad_id / (slug(v["name"], v["id"]) + ext)
            ok = download_drive_file(v["id"], local)
            if not ok:
                item["errors"].append(f"download failed: {v['name']} {v['id']}")
                continue
            frame_dir = cache / "frames" / ad_id / hashlib.sha1(v["id"].encode()).hexdigest()[:12]
            frames = extract_frames(local, frame_dir, args.max_frames)
            transcript = ""
            with contextlib.suppress(Exception):
                transcript = transcribe(local, args.whisper_model)
            ocr = ""
            with contextlib.suppress(Exception):
                ocr = ocr_frames(frames, ocr_helper)
            item["videos"].append({
                "id": v["id"],
                "name": v["name"],
                "duration": round(media_duration(local), 2),
                "transcript": transcript,
                "ocr": ocr,
            })
            print(f"[audit] {idx}/{len(rows)} {ad_id} video={v['name']} transcript={len(transcript)} ocr={len(ocr)}")
            if not args.keep_media:
                with contextlib.suppress(Exception):
                    local.unlink()
                with contextlib.suppress(Exception):
                    shutil.rmtree(frame_dir)
        if item["videos"]:
            item["transcript"] = "\n".join(v.get("transcript", "") for v in item["videos"])
            item["ocr"] = "\n".join(v.get("ocr", "") for v in item["videos"])
        item["done"] = True
        media_by_ad[ad_id] = item
        media_json.write_text(json.dumps(media_by_ad, ensure_ascii=False, indent=2), encoding="utf-8")

    analysis = analyze_assignments(rows, media_by_ad)
    (out_dir / "analysis.json").write_text(json.dumps({"rows": rows, "media": media_by_ad, "analysis": analysis}, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    write_report(out_dir / "suggestions.md", rows, media_by_ad, analysis)
    print(f"[audit] merge_suggestions={len(analysis['merge_suggestions'])} move_suggestions={len(analysis['move_suggestions'])}")
    print(f"[audit] report={out_dir / 'suggestions.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
