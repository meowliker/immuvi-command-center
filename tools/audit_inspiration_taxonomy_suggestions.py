#!/usr/bin/env python3
"""Recompute angle/persona suggestions for all Immuvi inspirations.

This is intentionally suggestion-only:
- does not requeue inspirations
- does not reclassify media
- does not overwrite the selected angle/persona
- updates only suggestion/review metadata in inspirations.data

Use:
  source ~/.classify-inspiration.env
  python3 tools/audit_inspiration_taxonomy_suggestions.py --dry-run
  python3 tools/audit_inspiration_taxonomy_suggestions.py --apply
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import os
import re
import sys
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import psycopg2
import psycopg2.extras


WINNING_STATUSES = {"winner", "mild winner", "scale", "complete"}
ACTIVE_INS_STATUSES = {
    "classified",
    "approved",
    "testing",
    "winner",
    "mild winner",
    "scale",
    "loser",
    "ready to launch",
    "untested",
}

EXCLUSIVE_SIGNALS = {
    "adhd",
    "nurse",
    "medical",
    "quilter",
    "sewing",
    "teacher",
    "designer",
    "seller",
    "therapy",
    "yoga",
    "diabetic",
    "horse",
    "phonics",
    "astrology",
    "architect",
    "instagram",
}

STOP_WORDS = {
    "the", "a", "an", "and", "or", "of", "in", "for", "to", "is", "are",
    "was", "were", "be", "been", "by", "with", "from", "that", "this",
    "it", "as", "at", "on", "into", "about", "around", "who", "when",
    "while", "using", "use", "uses", "used", "have", "has", "had", "do",
    "does", "did", "can", "could", "should", "would", "will", "just",
    "then", "than", "them", "their", "they", "you", "your", "i", "me",
    "my", "we", "our", "us", "not", "no", "yes", "get", "got", "give",
    "gives", "make", "makes", "made", "take", "takes", "see", "show",
    "shows", "open", "opens", "close", "shot", "shots", "frame", "frames",
    "scene", "scenes", "hook", "bridge", "proof", "demo", "cta", "caption",
    "voice", "over", "script", "text", "screen", "timing", "headline",
    "one", "two", "three", "first", "second", "third", "free", "today",
    "download", "comment", "link", "source", "full", "exact", "available",
    "unavailable", "video", "photo", "image", "static", "graphic", "reel",
    "instagram", "facebook", "tiktok", "youtube", "clickup", "winner",
    "testing", "tested", "untested", "scale", "mild", "ready", "launch",
    "age", "aged", "adult", "adults", "women", "woman", "men", "man",
    "male", "female", "kids", "kid", "child", "children", "parent",
    "parents", "mom", "moms", "mother", "dad", "dads", "father",
}

SYNONYMS = {
    "sellers": "seller",
    "selling": "seller",
    "sell": "seller",
    "hustlers": "hustler",
    "hustles": "hustle",
    "tools": "tool",
    "toolkit": "tool",
    "toolkits": "tool",
    "resources": "tool",
    "resource": "tool",
    "worksheets": "worksheet",
    "workbook": "worksheet",
    "workbooks": "worksheet",
    "printables": "printable",
    "pages": "page",
    "helps": "help",
    "supporting": "support",
    "supports": "support",
    "solutions": "solution",
    "medicationfree": "medication",
    "meds": "medication",
    "adhders": "adhd",
    "adhder": "adhd",
    "dysregulated": "dysregulation",
    "dysregulate": "dysregulation",
    "procrastinating": "procrastination",
    "procrastinate": "procrastination",
    "quilters": "quilter",
    "quilting": "quilt",
    "quilts": "quilt",
    "teachers": "teacher",
    "classrooms": "classroom",
    "nurses": "nurse",
    "nursing": "nurse",
    "diabetes": "diabetic",
}

BADGE_RE = re.compile(r"\s*(?:[\u2b50\u2605*]\s*)?(?:Mild\s+Winner|Winner|Loser|Scale|Killed|Complete)\s*$", re.I)
AGE_RE = re.compile(r"\b(?:ages?|aged|year(?:s)?\s*old|yrs?|yo)\b|\b\d{1,3}\s*(?:-|to)\s*\d{1,3}\b|\b\d{1,3}\+\b", re.I)


@dataclass
class Product:
    id: str
    name: str
    config: Dict[str, Any]
    signals: List[str]


@dataclass
class TaxonomyItem:
    product_id: str
    id: str
    name: str
    status: str
    archived_at: Optional[str]


@dataclass
class Inspiration:
    id: str
    product_id: str
    status: str
    title: str
    platform: str
    data: Dict[str, Any]
    evidence: str = ""


def normalize_name(name: Any) -> str:
    s = str(name or "").strip()
    s = re.sub(r"^\s*(?:[-\u2013\u2014\u2022*]\s*)+", "", s)
    for _ in range(3):
        nxt = BADGE_RE.sub("", s)
        if nxt == s:
            break
        s = nxt
    return re.sub(r"\s+", " ", s).strip()


def lookup_key(name: Any) -> str:
    return normalize_name(name).lower()


def stringify(value: Any, depth: int = 0) -> str:
    if value is None or value is False:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    if isinstance(value, list):
        return " ".join(filter(None, (stringify(v, depth + 1) for v in value)))
    if isinstance(value, dict):
        if depth > 2:
            return ""
        chunks = []
        for k, v in value.items():
            if re.search(r"^(id|url|sourceUrl|adLink|driveLink|clickup|created|updated|deleted|_)", k, re.I):
                continue
            if re.search(r"^(angle|persona|detectedAngle|detectedPersona)$", k, re.I):
                continue
            chunks.append(stringify(v, depth + 1))
        return " ".join(filter(None, chunks))
    return ""


def evidence_text(ins: Inspiration) -> str:
    d = ins.data or {}
    fields = [
        d.get("formatName"),
        d.get("creativeUSP"),
        d.get("creativeHypothesis"),
        d.get("notes"),
        d.get("variationNotes"),
        d.get("hookText"),
        d.get("bodyCopy"),
        d.get("adCopy"),
        d.get("captionTranscript"),
        d.get("voiceOver") if str(d.get("voiceOver") or "").strip().lower() != "no voice over" else "",
        d.get("voiceOverTimeline"),
        d.get("captionTimeline"),
        d.get("nextAdScripts"),
        d.get("hookType"),
        d.get("creativeStructure"),
        d.get("productionStyle"),
        d.get("funnelStage"),
        d.get("adType"),
        ins.title,
        ins.platform,
    ]
    return " ".join(stringify(v) for v in fields if stringify(v)).strip()[:24000]


@lru_cache(maxsize=20000)
def tokens(text: str) -> Tuple[str, ...]:
    s = str(text or "").lower()
    if not s:
        return tuple()
    s = re.sub(r"https?://\S+", " ", s)
    s = re.sub(r"[\u2b50\u2605*_`~|<>\[\]{}]", " ", s)
    s = AGE_RE.sub(" ", s)
    s = s.replace("overwelmed", "overwhelmed")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    counts: Dict[str, int] = {}
    for raw in s.split():
        token = SYNONYMS.get(raw, raw)
        if len(token) > 5 and token.endswith("ing"):
            token = token[:-3]
        if len(token) > 4 and token.endswith("ies"):
            token = token[:-3] + "y"
        elif len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
            token = token[:-1]
        token = SYNONYMS.get(token, token)
        if len(token) <= 2 or token in STOP_WORDS:
            continue
        counts[token] = counts.get(token, 0) + 1
    return tuple(sorted(counts, key=lambda t: (-counts[t], t)))


@lru_cache(maxsize=20000)
def signals(text: str) -> Tuple[str, ...]:
    s = str(text or "").lower()
    out: List[str] = []

    def add(sig: str, pattern: str) -> None:
        if re.search(pattern, s, re.I) and sig not in out:
            out.append(sig)

    add("mom", r"\b(mom|moms|mother|mothers|mama|mamas|mum|mums)\b")
    add("parent", r"\b(parent|parents|parenting|caregiver|caregivers)\b")
    add("teacher", r"\b(teacher|teachers|classroom|students?|school|kindergarten|preschool)\b")
    add("child", r"\b(child|children|kid|kids|toddler|toddlers)\b")
    add("adhd", r"\badhd\b")
    add("nurse", r"\b(nurse|nurses|nursing|nclex|rn)\b")
    add("medical", r"\b(medical|medicine|doctor|doctors|patient|patients|clinical|paramedic|pharmacology|pharmacy)\b")
    add("quilter", r"\b(quilt|quilting|quilter|quilters|fabric|patchwork)\b")
    add("sewing", r"\b(sew|sewing|seamstress|stitch|stitching|tailor|fabric)\b")
    add("designer", r"\b(canva|template|templates|designer|designers|freelancer|freelancers|creative\s+business)\b")
    add("seller", r"\b(side\s*hustle|seller|sellers|digital\s*product|etsy|income|passive\s+income)\b")
    add("therapy", r"\b(therapy|therapist|therapists|mental\s*health|emotion|emotional|anxiety|anxious|calm|grief)\b")
    add("yoga", r"\b(yoga|pose|asana|flexibility|stretch|pranayama)\b")
    add("diabetic", r"\b(diabetic|diabetes|blood\s*sugar|glucose|insulin)\b")
    add("horse", r"\b(horse|horses|equestrian|riding|rider)\b")
    add("phonics", r"\b(phonics|reading|letters?|alphabet|sight\s+words?)\b")
    add("astrology", r"\b(astrology|zodiac|kundli|horoscope|birth\s+chart|compatibility)\b")
    add("architect", r"\b(architect|architecture|cad|revit|sketchup|floor\s+plan)\b")
    add("instagram", r"\b(instagram|reels?|followers?|content\s+creator|social\s+media)\b")
    return tuple(out)


def product_signal_text(product: Product) -> str:
    cfg = product.config or {}
    pieces = [
        product.name,
        product.id,
        cfg.get("name"),
        cfg.get("ins_prefix"),
        cfg.get("insPrefix"),
        cfg.get("clickup_list_name"),
        cfg.get("clickupListName"),
        cfg.get("offer"),
        cfg.get("description"),
    ]
    return " ".join(str(p) for p in pieces if p)


def product_signals(product: Product) -> List[str]:
    sigs = list(signals(product_signal_text(product)))
    name = product.name.lower()
    aliases = {
        "quilting": ["quilter"],
        "patchwork": ["quilter", "sewing"],
        "sewing": ["sewing"],
        "canva": ["designer", "seller"],
        "adhd": ["adhd"],
        "nclex": ["nurse", "medical"],
        "medical": ["medical", "nurse"],
        "paramedic": ["medical"],
        "pharmacology": ["medical"],
        "therapy": ["therapy"],
        "mental health": ["therapy"],
        "yoga": ["yoga"],
        "diabetic": ["diabetic", "medical"],
        "horse": ["horse"],
        "phonics": ["phonics", "teacher", "child"],
        "astro": ["astrology"],
        "architect": ["architect"],
        "instagram": ["instagram"],
    }
    for needle, vals in aliases.items():
        if needle in name:
            for v in vals:
                if v not in sigs:
                    sigs.append(v)
    return sigs


def creative_score(left: str, right: str, kind: str = "angle") -> Dict[str, Any]:
    lt = tokens(left)
    rt = tokens(right)
    if not lt or not rt:
        return {"score": 0.0, "shared": []}
    lset, rset = set(lt), set(rt)
    shared = [t for t in lt if t in rset]
    union_count = len(lset | rset) or 1
    coverage = len(shared) / max(1, min(len(lset), len(rset)))
    jaccard = len(shared) / union_count
    score = max(jaccard * 1.15, coverage * 0.72)
    if len(shared) >= 8:
        score += 0.08
    if len(shared) >= 14:
        score += 0.06
    if kind == "persona":
        ls, rs = signals(left), signals(right)
        shared_sig = [s for s in ls if s in rs]
        if shared_sig:
            score += min(0.24, 0.12 + len(shared_sig) * 0.04)
            shared = shared_sig + shared
    return {"score": min(1.0, round(score, 3)), "shared": shared[:10]}


def semantic_tokens(name: str) -> List[str]:
    return list(tokens(normalize_name(name)))


def similarity(a: str, b: str) -> float:
    at, bt = semantic_tokens(a), semantic_tokens(b)
    if not at or not bt:
        return 0.0
    aset, bset = set(at), set(bt)
    shared = aset & bset
    union = aset | bset
    score = len(shared) / max(1, len(union))
    coverage = len(shared) / max(1, min(len(aset), len(bset)))
    score = max(score, coverage * 0.78)
    astr, bstr = " ".join(at), " ".join(bt)
    if astr and bstr and (astr in bstr or bstr in astr):
        score = max(score, 0.88)
    if coverage == 1 and min(len(aset), len(bset)) >= 2:
        score = max(score, 0.9)
    return min(1.0, round(score, 3))


def label_fits_product(name: str, product: Product) -> bool:
    product_exclusive = [s for s in product.signals if s in EXCLUSIVE_SIGNALS]
    if not product_exclusive:
        return True
    name_exclusive = [s for s in signals(name) if s in EXCLUSIVE_SIGNALS]
    if not name_exclusive:
        return True
    return any(s in product_exclusive for s in name_exclusive)


def suggestion_fits_product(kind: str, name: str, product: Product) -> bool:
    return label_fits_product(name, product)


def clean_new_name(kind: str, name: str, evidence: str, product: Product) -> str:
    name = normalize_name(name)
    name = AGE_RE.sub(" ", name)
    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        return ""
    fallback = fallback_name(kind, evidence, product, "")
    if fallback and (similarity(name, fallback) >= 0.52 or set(signals(name)) & set(signals(fallback))):
        return fallback
    return name


def fallback_name(kind: str, evidence: str, product: Product, source_name: str = "") -> str:
    s = str(evidence or "").lower()
    ps = set(product.signals)
    if kind == "persona":
        if re.search(r"\b(mom|moms|mother|mothers|mama|mamas|mum|mums)\b", s):
            return "Moms"
        if re.search(r"\b(parent|parents|parenting|caregiver|caregivers)\b", s) and re.search(r"\b(child|children|kid|kids|toddler|toddlers)\b", s):
            return "Parents of Kids"
        if "quilter" in ps and re.search(r"\b(beginner|new|started|start|first|simple|easy|learn)\b", s):
            return "Beginner Quilter"
        if "quilter" in ps and re.search(r"\b(quilt|quilting|quilter|fabric|patchwork)\b", s):
            return "Quilters"
        if "sewing" in ps and re.search(r"\b(sew|sewing|stitch|fabric|tailor)\b", s):
            return "Sewing Beginners"
        if "designer" in ps and re.search(r"\b(canva|template|design|designer)\b", s):
            return "Canva Creators"
        if "seller" in ps and re.search(r"\b(side\s*hustle|seller|digital\s*product|etsy|income)\b", s):
            return "Side-Hustle Sellers"
        if "adhd" in ps and re.search(r"\badhd\b", s):
            return "ADHD Adults"
        if "teacher" in ps and re.search(r"\b(teacher|classroom|students?|school)\b", s):
            return "Teachers"
        if "nurse" in ps and re.search(r"\b(nurse|nursing|nclex|rn)\b", s):
            return "Nursing Students"
        if "medical" in ps and re.search(r"\b(medical|patient|clinical|doctor|paramedic|pharmacology)\b", s):
            return "Medical Learners"
        if "therapy" in ps and re.search(r"\b(therapy|therapist|mental\s*health|emotion|anxiety|grief|calm)\b", s):
            return "People Seeking Emotional Support"
        if "yoga" in ps and re.search(r"\b(yoga|pose|asana|flexibility|stretch)\b", s):
            return "Yoga Learners"
        if "diabetic" in ps and re.search(r"\b(diabetic|diabetes|blood\s*sugar|glucose)\b", s):
            return "People Managing Diabetes"
        if "horse" in ps and re.search(r"\b(horse|horses|equestrian|riding)\b", s):
            return "Horse Owners"
        if "phonics" in ps and re.search(r"\b(phonics|reading|alphabet|sight\s+words?)\b", s):
            return "Parents Teaching Reading"
        if "astrology" in ps and re.search(r"\b(astrology|zodiac|kundli|horoscope|compatibility)\b", s):
            return "Astrology Seekers"
        if "architect" in ps and re.search(r"\b(architect|architecture|cad|revit|sketchup)\b", s):
            return "Architecture Professionals"
    else:
        if re.search(r"\b(last\s*chance|deadline|ends?\s*today|closing|midnight|before\s+it\s+disappears|scarcity|limited)\b", s):
            return "Last-Chance Regret Avoidance"
        if re.search(r"\b(free|bundle|download|giveaway|lead\s*magnet|template|pack)\b", s):
            return "Free Resource Offer"
        if re.search(r"\b(testimonial|review|proof|result|results|before\s+and\s+after|case\s*study)\b", s):
            return "Social Proof"
        if re.search(r"\b(how\s*to|tutorial|step|steps|guide|walkthrough|learn)\b", s):
            return "Step-by-Step Learning"
        if re.search(r"\b(mistake|avoid|stop|wrong|problem|pain|struggle|hard)\b", s):
            return "Problem / Mistake Avoidance"
        if re.search(r"\b(secret|hidden|nobody|didn'?t\s+know|surprising|unknown)\b", s):
            return "Hidden Shortcut"
        if re.search(r"\b(beginner|simple|easy|first|starter)\b", s):
            return "Beginner Simplicity"
        if re.search(r"\b(transform|before|after|upgrade|makeover)\b", s):
            return "Transformation"
        if re.search(r"\b(challenge|test|quiz|try\s+this)\b", s):
            return "Challenge / Test"
    return normalize_name(source_name)


def active_items(items: Sequence[TaxonomyItem], product_id: str) -> List[TaxonomyItem]:
    return [i for i in items if i.product_id == product_id and i.name and not i.archived_at]


def active_item_by_name(items: Sequence[TaxonomyItem], product_id: str, name: str) -> Optional[TaxonomyItem]:
    key = lookup_key(name)
    if not key:
        return None
    for item in active_items(items, product_id):
        if lookup_key(item.name) == key:
            return item
    return None


def build_profiles(kind: str, product_id: str, items: Sequence[TaxonomyItem], inspirations: Sequence[Inspiration]) -> Dict[str, str]:
    field = "persona" if kind == "persona" else "angle"
    profiles: Dict[str, List[str]] = collections.defaultdict(list)
    for item in items:
        if item.product_id == product_id and item.name and not item.archived_at:
            profiles[lookup_key(item.name)].append(item.name)
    for ins in inspirations:
        if ins.product_id != product_id:
            continue
        label = normalize_name((ins.data or {}).get(field))
        if not label:
            continue
        key = lookup_key(label)
        profiles[key].append(ins.evidence)
    return {k: " ".join(filter(None, v)) for k, v in profiles.items()}


def strong_existing(s: Dict[str, Any]) -> bool:
    shared = len(s.get("shared") or [])
    if s.get("evidenceScore", 0) >= 0.38 and shared >= 5:
        return True
    if s.get("evidenceScore", 0) >= 0.34 and shared >= 4 and s.get("score", 0) >= 0.72:
        return True
    return False


def current_support(
    kind: str,
    ins: Inspiration,
    product: Product,
    items: Sequence[TaxonomyItem],
    profiles: Dict[str, str],
    current: str,
) -> Dict[str, Any]:
    if not current:
        return {"good": False, "score": 0.0, "reason": "missing"}
    if not suggestion_fits_product(kind, current, product):
        return {"good": False, "score": 0.0, "reason": "off-product"}
    item = active_item_by_name(items, product.id, current)
    if not item:
        if name_fits_evidence(kind, current, ins.evidence):
            return {"good": True, "score": 0.55, "reason": "custom-fits-evidence"}
        return {"good": False, "score": 0.0, "reason": "custom-unmatched"}
    profile = profiles.get(lookup_key(current), current)
    ev = creative_score(ins.evidence, profile + " " + current, kind)
    if ev["score"] >= 0.24 and len(ev["shared"]) >= 2:
        return {"good": True, "score": ev["score"], "reason": "evidence"}
    if name_fits_evidence(kind, current, ins.evidence):
        return {"good": True, "score": max(0.50, ev["score"]), "reason": "name-fits-evidence"}
    fallback = fallback_name(kind, ins.evidence, product, "")
    if fallback and similarity(current, fallback) >= 0.45:
        return {"good": True, "score": max(0.48, ev["score"]), "reason": "same-as-fallback"}
    return {"good": False, "score": ev["score"], "reason": "weak-current"}


def evidence_matches(
    kind: str,
    ins: Inspiration,
    product: Product,
    items: Sequence[TaxonomyItem],
    profiles: Dict[str, str],
    current: str,
    incoming: str,
    limit: int = 4,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    current_key = lookup_key(current)
    for item in active_items(items, product.id):
        name = normalize_name(item.name)
        if not name or lookup_key(name) == current_key:
            continue
        if not suggestion_fits_product(kind, name, product):
            continue
        profile = profiles.get(lookup_key(name), name)
        ev = creative_score(ins.evidence, profile + " " + name, kind)
        name_score = similarity(incoming, name) * 0.08 if incoming else 0
        score = min(1.0, round(ev["score"] + name_score, 3))
        suggestion = {
            "name": name,
            "score": score,
            "evidenceScore": ev["score"],
            "shared": ev["shared"],
            "status": item.status or "Untested",
            "creativeCount": 0,
            "source": "existing-evidence",
        }
        if strong_existing(suggestion):
            out.append(suggestion)
    out.sort(key=lambda s: (-s["evidenceScore"], -s["score"], s["name"]))
    return out[:limit]


def name_matches(kind: str, incoming: str, product: Product, items: Sequence[TaxonomyItem], current: str, limit: int = 4) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    if not incoming:
        return out
    current_key = lookup_key(current)
    for item in active_items(items, product.id):
        name = normalize_name(item.name)
        if not name or lookup_key(name) == current_key:
            continue
        if not suggestion_fits_product(kind, name, product):
            continue
        score = similarity(incoming, name)
        if score < 0.78:
            continue
        out.append({
            "name": name,
            "score": score,
            "evidenceScore": 0,
            "shared": list(set(tokens(incoming)) & set(tokens(name)))[:8],
            "status": item.status or "Untested",
            "creativeCount": 0,
            "source": "existing-name",
        })
    out.sort(key=lambda s: (-s["score"], s["name"]))
    return out[:limit]


def name_fits_evidence(kind: str, name: str, evidence: str) -> bool:
    nts = semantic_tokens(name)
    ets = set(tokens(evidence))
    shared = [t for t in nts if t in ets]
    if shared and len(shared) >= min(2, len(nts)):
        return True
    if kind == "persona":
        return bool(set(signals(name)) & set(signals(evidence)))
    return False


def new_suggestion(
    kind: str,
    ins: Inspiration,
    product: Product,
    product_inspos: Sequence[Inspiration],
    current: str,
    incoming: str,
) -> Optional[Dict[str, Any]]:
    peers = []
    for peer in product_inspos:
        if peer.id == ins.id:
            continue
        if (peer.status or "").lower() not in ACTIVE_INS_STATUSES:
            continue
        ev = creative_score(ins.evidence, peer.evidence, kind)
        if ev["score"] < 0.32 or len(ev["shared"]) < 3:
            continue
        peers.append({
            "name": normalize_name((peer.data or {}).get("detectedPersona" if kind == "persona" else "detectedAngle")
                                   or (peer.data or {}).get("persona" if kind == "persona" else "angle")
                                   or ""),
            "text": peer.evidence,
            "score": ev["score"],
            "shared": ev["shared"],
        })
    peers.sort(key=lambda p: -p["score"])
    combined = " ".join([ins.evidence] + [p["text"] for p in peers[:6]])
    name = clean_new_name(kind, fallback_name(kind, combined, product, ""), combined, product)
    if not name:
        counts: Dict[str, Dict[str, Any]] = {}

        def add(n: str, weight: int = 1) -> None:
            n = clean_new_name(kind, n, combined, product)
            if not n or not name_fits_evidence(kind, n, combined):
                return
            key = lookup_key(n)
            counts.setdefault(key, {"name": n, "count": 0})
            counts[key]["count"] += weight

        add(incoming, 1)
        for p in peers:
            add(p["name"], 1)
        if counts:
            best = sorted(counts.values(), key=lambda v: (-v["count"], v["name"]))[0]
            if best["count"] >= 2:
                name = best["name"]
    if not name or lookup_key(name) == lookup_key(current):
        return None
    if not suggestion_fits_product(kind, name, product):
        return None
    shared: List[str] = []
    for p in peers[:4]:
        for token in p["shared"]:
            if token not in shared:
                shared.append(token)
    if not shared:
        shared = signals(ins.evidence)
    confidence = min(0.84, 0.60 + min(len(peers), 4) * 0.04 + (0.08 if shared else 0))
    return {
        "name": name,
        "score": round(confidence, 3),
        "evidenceScore": round(confidence, 3),
        "shared": shared[:8],
        "status": "New",
        "creativeCount": 0,
        "winnerCount": 0,
        "products": [product.name],
        "source": "new-cluster" if len(peers) >= 2 else "new-evidence",
        "isNew": True,
        "clusterCount": len(peers) + 1,
    }


def suggestions_for(
    kind: str,
    ins: Inspiration,
    product: Product,
    items: Sequence[TaxonomyItem],
    profiles: Dict[str, str],
    product_inspos: Sequence[Inspiration],
) -> List[Dict[str, Any]]:
    field = "persona" if kind == "persona" else "angle"
    detected_field = "detectedPersona" if kind == "persona" else "detectedAngle"
    current = normalize_name((ins.data or {}).get(field))
    incoming = normalize_name((ins.data or {}).get(detected_field) or current)
    support = current_support(kind, ins, product, items, profiles, current)

    existing = evidence_matches(kind, ins, product, items, profiles, current, incoming, 4)
    names = name_matches(kind, incoming, product, items, current, 4)
    new = new_suggestion(kind, ins, product, product_inspos, current, incoming)

    out: List[Dict[str, Any]] = []
    if new and not existing:
        out.append(new)
    out.extend(existing)
    out.extend(names)
    if new and existing and new["score"] > existing[0]["score"] + 0.08:
        out.insert(0, new)

    seen = set()
    deduped = []
    for s in out:
        key = lookup_key(s.get("name"))
        if not key or key in seen:
            continue
        seen.add(key)
        if key == lookup_key(current):
            continue
        deduped.append(s)
    if support["good"]:
        deduped = [
            s for s in deduped
            if (s.get("score", 0) >= support["score"] + 0.20 and similarity(current, s.get("name", "")) < 0.52)
        ]
    return deduped[:4]


def fetch_all(conn) -> Tuple[Dict[str, Product], List[TaxonomyItem], List[TaxonomyItem], List[Inspiration]]:
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("select id, name, coalesce(config,'{}'::jsonb) as config from public.products order by name")
    products = {}
    for row in cur.fetchall():
        p = Product(row["id"], row["name"], row["config"] or {}, [])
        p.signals = product_signals(p)
        products[p.id] = p

    def load_items(table: str) -> List[TaxonomyItem]:
        cur.execute(f"select product_id, id, name, status, archived_at::text as archived_at from public.{table} order by product_id, name")
        return [TaxonomyItem(r["product_id"], r["id"], r["name"], r["status"], r["archived_at"]) for r in cur.fetchall()]

    angles = load_items("angles")
    personas = load_items("personas")
    cur.execute("""
      select id, product_id, status, coalesce(title,'') as title, coalesce(platform,'') as platform,
             coalesce(data,'{}'::jsonb) as data
      from public.inspirations
      order by product_id, id
    """)
    inspirations = []
    for r in cur.fetchall():
        ins = Inspiration(r["id"], r["product_id"], r["status"] or "", r["title"], r["platform"], r["data"] or {})
        ins.evidence = evidence_text(ins)
        inspirations.append(ins)
    enrich_imported_inspiration_evidence(inspirations)
    cur.close()
    return products, angles, personas, inspirations


def enrich_imported_inspiration_evidence(inspirations: Sequence[Inspiration]) -> None:
    by_product_id: Dict[Tuple[str, str], Inspiration] = {}
    by_product_url: Dict[Tuple[str, str], Inspiration] = {}
    for ins in inspirations:
        by_product_id[(ins.product_id, ins.id)] = ins
        d = ins.data or {}
        for url in (d.get("sourceUrl"), d.get("url")):
            if url:
                by_product_url[(ins.product_id, str(url))] = ins

    for ins in inspirations:
        d = ins.data or {}
        source_product_id = d.get("_sourceProductId")
        if not source_product_id or source_product_id == ins.product_id:
            continue
        source = None
        for source_id in (d.get("_sourceInsId"), d.get("_fromInspoId"), d.get("fromInspoId"), d.get("inspirationId")):
            if source_id:
                source = by_product_id.get((source_product_id, str(source_id)))
                if source:
                    break
        if not source:
            for url in (d.get("sourceUrl"), d.get("url")):
                if url:
                    source = by_product_url.get((source_product_id, str(url)))
                    if source:
                        break
        if source and source.evidence:
            ins.evidence = (ins.evidence + " " + source.evidence).strip()[:48000]


def changed_patch(ins: Inspiration, angle_sugs: List[Dict[str, Any]], persona_sugs: List[Dict[str, Any]]) -> Dict[str, Any]:
    d = ins.data or {}
    patch = {
        "_angleSuggestions": angle_sugs,
        "_personaSuggestions": persona_sugs,
        "_suggestedAngle": angle_sugs[0]["name"] if angle_sugs else "",
        "_suggestedPersona": persona_sugs[0]["name"] if persona_sugs else "",
        "_needsAngleReview": bool(angle_sugs),
        "_needsPersonaReview": bool(persona_sugs),
    }
    if angle_sugs:
        patch["_anglePromptDone"] = True
    if persona_sugs:
        patch["_personaPromptDone"] = True
    if all(d.get(k) == v for k, v in patch.items()):
        return {}
    return patch


def backup_rows(conn, rows: Sequence[Inspiration]) -> str:
    ts = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    path = f"/tmp/immuvi-taxonomy-suggestions-backup-{ts}.json"
    payload = [{"id": r.id, "product_id": r.product_id, "status": r.status, "data": r.data} for r in rows]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
    return path


def apply_updates(conn, updates: Sequence[Tuple[Inspiration, Dict[str, Any]]]) -> None:
    cur = conn.cursor()
    for ins, patch in updates:
        cur.execute(
            """
            update public.inspirations
            set data = coalesce(data,'{}'::jsonb) || %s::jsonb
            where id = %s and product_id = %s
            """,
            (json.dumps(patch), ins.id, ins.product_id),
        )
    conn.commit()
    cur.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write suggestion metadata to Supabase")
    ap.add_argument("--dry-run", action="store_true", help="compute and print without writing")
    ap.add_argument("--product-id", action="append", default=[], help="restrict to product id")
    ap.add_argument("--limit", type=int, default=0, help="only process first N rows after filtering")
    args = ap.parse_args()
    if not args.apply and not args.dry_run:
        args.dry_run = True

    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("SUPABASE_DB_URL is not set. Source ~/.classify-inspiration.env first.", file=sys.stderr)
        return 2

    conn = psycopg2.connect(db_url)
    products, angles, personas, inspirations = fetch_all(conn)
    if args.product_id:
        wanted = set(args.product_id)
        inspirations = [i for i in inspirations if i.product_id in wanted]
    if args.limit:
        inspirations = inspirations[: args.limit]

    by_product: Dict[str, List[Inspiration]] = collections.defaultdict(list)
    for ins in inspirations:
        by_product[ins.product_id].append(ins)

    angle_profiles_by_product = {
        pid: build_profiles("angle", pid, angles, by_product.get(pid, []))
        for pid in by_product
    }
    persona_profiles_by_product = {
        pid: build_profiles("persona", pid, personas, by_product.get(pid, []))
        for pid in by_product
    }

    updates: List[Tuple[Inspiration, Dict[str, Any]]] = []
    report: Dict[str, Dict[str, int]] = collections.defaultdict(lambda: collections.defaultdict(int))
    examples: List[Tuple[str, str, str, str, str, str]] = []

    for product_id, rows in by_product.items():
        product = products.get(product_id)
        if not product:
            continue
        for ins in rows:
            if not ins.evidence or (ins.status or "").lower() not in ACTIVE_INS_STATUSES:
                continue
            angle_sugs = suggestions_for("angle", ins, product, angles, angle_profiles_by_product[product_id], rows)
            persona_sugs = suggestions_for("persona", ins, product, personas, persona_profiles_by_product[product_id], rows)
            patch = changed_patch(ins, angle_sugs, persona_sugs)
            report[product.name]["scanned"] += 1
            if angle_sugs:
                report[product.name]["angle_suggestions"] += 1
            if persona_sugs:
                report[product.name]["persona_suggestions"] += 1
            if patch:
                updates.append((ins, patch))
                if len(examples) < 30:
                    examples.append((
                        product.name,
                        ins.id,
                        normalize_name((ins.data or {}).get("angle")),
                        angle_sugs[0]["name"] if angle_sugs else "",
                        normalize_name((ins.data or {}).get("persona")),
                        persona_sugs[0]["name"] if persona_sugs else "",
                    ))

    backup = ""
    if args.apply and updates:
        backup = backup_rows(conn, [u[0] for u in updates])
        apply_updates(conn, updates)

    total_scanned = sum(v["scanned"] for v in report.values())
    print(("APPLIED" if args.apply else "DRY RUN") + f": scanned {total_scanned} inspirations, {len(updates)} rows need suggestion metadata updates")
    if backup:
        print(f"backup: {backup}")
    print("\nBy product:")
    for name in sorted(report):
        r = report[name]
        print(f"- {name}: scanned={r['scanned']} angle_suggestions={r['angle_suggestions']} persona_suggestions={r['persona_suggestions']}")
    if examples:
        print("\nExamples:")
        for product, ins_id, cur_a, sug_a, cur_p, sug_p in examples:
            print(f"- {product} {ins_id}: angle {cur_a or '-'} -> {sug_a or '-'} | persona {cur_p or '-'} -> {sug_p or '-'}")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
