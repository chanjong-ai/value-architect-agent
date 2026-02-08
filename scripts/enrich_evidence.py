#!/usr/bin/env python3
"""
enrich_evidence.py - deck_spec.yaml 불릿 근거(evidence) 자동 보강

기능:
1. evidence가 없는 불릿에 source_anchor/confidence 자동 채움
2. sources.md 앵커를 기준으로 슬라이드별 기본 앵커 추론
3. 문자열 불릿을 객체형 불릿으로 승격해 근거 연결 가능하게 처리
"""

import argparse
import re
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import yaml

try:
    from validate_spec import parse_sources_anchors
except ImportError:
    parse_sources_anchors = None


def load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_yaml(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def _slugify(text: str) -> str:
    value = re.sub(r"[^\w\s-]", "", (text or "").strip().lower())
    return re.sub(r"[\s]+", "-", value)


def parse_anchors_from_sources(sources_path: Path) -> Set[str]:
    if not sources_path.exists():
        return set()

    if parse_sources_anchors:
        return set(parse_sources_anchors(sources_path))

    anchors: Set[str] = set()
    for line in sources_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            title = line[3:].strip()
            anchors.add(f"sources.md#{_slugify(title)}")
    return anchors


def _first_valid_anchor(candidates: List[str], anchors: Set[str]) -> Optional[str]:
    for cand in candidates:
        if cand and cand in anchors:
            return cand
    return None


def _coerce_anchor(anchor: str, anchors: Set[str], default_anchor: Optional[str]) -> Optional[str]:
    value = str(anchor or "").strip()
    if value and value in anchors:
        return value
    if default_anchor and default_anchor in anchors:
        return default_anchor
    if anchors:
        return sorted(list(anchors))[0]
    return None


def infer_default_anchor(slide: dict, anchors: Set[str]) -> Optional[str]:
    if not anchors:
        return None

    meta_refs = slide.get("metadata", {}).get("source_refs", [])
    if isinstance(meta_refs, list):
        anchor = _first_valid_anchor([str(x) for x in meta_refs], anchors)
        if anchor:
            return anchor

    slide_anchor_candidates: List[str] = []

    for bullet in slide.get("bullets", []):
        if isinstance(bullet, dict):
            ev = bullet.get("evidence", {})
            if isinstance(ev, dict):
                slide_anchor_candidates.append(str(ev.get("source_anchor", "")))

    anchor = _first_valid_anchor(slide_anchor_candidates, anchors)
    if anchor:
        return anchor

    title = f"{slide.get('title', '')} {slide.get('governing_message', '')}".lower()

    keyword_map = [
        (["경쟁", "benchmark", "peer", "competitor", "gap"], "sources.md#competitors"),
        (["시장", "industry", "market", "환경", "규제"], "sources.md#market"),
        (["기술", "ai", "cloud", "trend", "tech"], "sources.md#tech-trends"),
        (["현황", "as-is", "current", "pain", "내부", "client"], "sources.md#client"),
        (["가치", "value", "roi", "효과", "impact"], "sources.md#market"),
    ]

    for keywords, mapped_anchor in keyword_map:
        if any(k in title for k in keywords) and mapped_anchor in anchors:
            return mapped_anchor

    preferred = [
        "sources.md#market",
        "sources.md#client",
        "sources.md#competitors",
        "sources.md#tech-trends",
    ]
    anchor = _first_valid_anchor(preferred, anchors)
    if anchor:
        return anchor

    return sorted(list(anchors))[0]


def ensure_evidence(
    item,
    default_anchor: Optional[str],
    confidence: str,
    overwrite: bool,
) -> Tuple[object, bool]:
    """
    Returns: (updated_item, changed)
    """
    if not default_anchor:
        return item, False

    if isinstance(item, str):
        text = item.strip()
        if not text:
            return item, False
        return {
            "text": text,
            "evidence": {
                "source_anchor": default_anchor,
                "confidence": confidence,
            },
        }, True

    if isinstance(item, dict):
        if not str(item.get("text", "")).strip():
            return item, False

        ev = item.get("evidence")
        if not isinstance(ev, dict):
            item["evidence"] = {
                "source_anchor": default_anchor,
                "confidence": confidence,
            }
            return item, True

        changed = False
        if overwrite or not ev.get("source_anchor"):
            ev["source_anchor"] = default_anchor
            changed = True
        if overwrite or not ev.get("confidence"):
            ev["confidence"] = confidence
            changed = True
        item["evidence"] = ev
        return item, changed

    return item, False


def enrich_bullet_list(
    bullet_list: list,
    default_anchor: Optional[str],
    confidence: str,
    overwrite: bool,
) -> Tuple[list, int, int]:
    updated = []
    touched = 0
    total = 0
    for item in bullet_list:
        if isinstance(item, (str, dict)):
            total += 1
        new_item, changed = ensure_evidence(item, default_anchor, confidence, overwrite)
        if changed:
            touched += 1
        updated.append(new_item)
    return updated, touched, total


def enrich_spec(spec: dict, anchors: Set[str], confidence: str, overwrite: bool) -> Tuple[dict, dict]:
    slides = spec.get("slides", [])
    stats = {
        "slides": len(slides),
        "bullets_total": 0,
        "bullets_updated": 0,
        "slides_without_anchor": 0,
    }

    for slide in slides:
        default_anchor = infer_default_anchor(slide, anchors)
        if not default_anchor:
            stats["slides_without_anchor"] += 1

        # metadata.source_refs 정규화
        metadata = slide.get("metadata", {}) if isinstance(slide.get("metadata"), dict) else {}
        refs = metadata.get("source_refs", [])
        if isinstance(refs, list):
            normalized_refs = [str(r) for r in refs if str(r) in anchors]
            if default_anchor and default_anchor not in normalized_refs:
                normalized_refs.append(default_anchor)
            if not normalized_refs and anchors:
                normalized_refs.append(sorted(list(anchors))[0])
            metadata["source_refs"] = normalized_refs[:6]
            slide["metadata"] = metadata

        # top-level bullets
        bullets = slide.get("bullets", [])
        if isinstance(bullets, list):
            new_bullets, touched, total = enrich_bullet_list(bullets, default_anchor, confidence, overwrite)
            slide["bullets"] = new_bullets
            stats["bullets_total"] += total
            stats["bullets_updated"] += touched

        # columns bullets / column content_blocks
        for col in slide.get("columns", []):
            if isinstance(col.get("visual"), dict):
                visual = col["visual"]
                ev = visual.get("evidence")
                if isinstance(ev, dict):
                    new_anchor = _coerce_anchor(ev.get("source_anchor", ""), anchors, default_anchor)
                    if new_anchor and (overwrite or ev.get("source_anchor") not in anchors):
                        ev["source_anchor"] = new_anchor
                    if overwrite or not ev.get("confidence"):
                        ev["confidence"] = confidence
                    visual["evidence"] = ev

            col_bullets = col.get("bullets", [])
            if isinstance(col_bullets, list):
                new_bullets, touched, total = enrich_bullet_list(col_bullets, default_anchor, confidence, overwrite)
                col["bullets"] = new_bullets
                stats["bullets_total"] += total
                stats["bullets_updated"] += touched

            for block in col.get("content_blocks", []):
                if isinstance(block, dict):
                    ev = block.get("evidence")
                    if isinstance(ev, dict):
                        new_anchor = _coerce_anchor(ev.get("source_anchor", ""), anchors, default_anchor)
                        if new_anchor and (overwrite or ev.get("source_anchor") not in anchors):
                            ev["source_anchor"] = new_anchor
                        if overwrite or not ev.get("confidence"):
                            ev["confidence"] = confidence
                        block["evidence"] = ev
                if block.get("type") == "bullets" and isinstance(block.get("bullets", []), list):
                    new_bullets, touched, total = enrich_bullet_list(
                        block["bullets"], default_anchor, confidence, overwrite
                    )
                    block["bullets"] = new_bullets
                    stats["bullets_total"] += total
                    stats["bullets_updated"] += touched

        # slide-level content_blocks bullets
        for block in slide.get("content_blocks", []):
            if isinstance(block, dict):
                ev = block.get("evidence")
                if isinstance(ev, dict):
                    new_anchor = _coerce_anchor(ev.get("source_anchor", ""), anchors, default_anchor)
                    if new_anchor and (overwrite or ev.get("source_anchor") not in anchors):
                        ev["source_anchor"] = new_anchor
                    if overwrite or not ev.get("confidence"):
                        ev["confidence"] = confidence
                    block["evidence"] = ev
            if block.get("type") == "bullets" and isinstance(block.get("bullets", []), list):
                new_bullets, touched, total = enrich_bullet_list(
                    block["bullets"], default_anchor, confidence, overwrite
                )
                block["bullets"] = new_bullets
                stats["bullets_total"] += total
                stats["bullets_updated"] += touched

        visuals = slide.get("visuals", []) if isinstance(slide.get("visuals", []), list) else []
        for visual in visuals:
            if isinstance(visual, dict):
                ev = visual.get("evidence")
                if isinstance(ev, dict):
                    new_anchor = _coerce_anchor(ev.get("source_anchor", ""), anchors, default_anchor)
                    if new_anchor and (overwrite or ev.get("source_anchor") not in anchors):
                        ev["source_anchor"] = new_anchor
                    if overwrite or not ev.get("confidence"):
                        ev["confidence"] = confidence
                    visual["evidence"] = ev

    spec["slides"] = slides
    return spec, stats


def main() -> int:
    parser = argparse.ArgumentParser(description="deck_spec 불릿 evidence 자동 보강")
    parser.add_argument("spec_path", help="deck_spec.yaml 경로")
    parser.add_argument("sources_path", help="sources.md 경로")
    parser.add_argument("--output", "-o", help="출력 경로 (기본: deck_spec 덮어쓰기)")
    parser.add_argument("--confidence", default="medium", help="기본 confidence (default: medium)")
    parser.add_argument("--overwrite", action="store_true", help="기존 evidence 값도 덮어쓰기")
    parser.add_argument("--dry-run", action="store_true", help="변경사항만 확인하고 저장하지 않음")
    args = parser.parse_args()

    spec_path = Path(args.spec_path).resolve()
    sources_path = Path(args.sources_path).resolve()

    if not spec_path.exists():
        print(f"Error: deck_spec not found: {spec_path}")
        return 1
    if not sources_path.exists():
        print(f"Error: sources not found: {sources_path}")
        return 1

    spec = load_yaml(spec_path)
    anchors = parse_anchors_from_sources(sources_path)
    if not anchors:
        print("Error: sources.md에서 사용 가능한 앵커를 찾지 못했습니다.")
        return 1

    updated_spec, stats = enrich_spec(spec, anchors, args.confidence, args.overwrite)
    coverage = 0
    if stats["bullets_total"] > 0:
        coverage = int(round((stats["bullets_updated"] / stats["bullets_total"]) * 100))

    print(f"✓ anchors: {len(anchors)}개")
    print(
        "✓ bullets total: {total}, updated: {updated}, update ratio: {ratio}%".format(
            total=stats["bullets_total"],
            updated=stats["bullets_updated"],
            ratio=coverage,
        )
    )
    if stats["slides_without_anchor"] > 0:
        print(f"⚠ default anchor를 찾지 못한 슬라이드: {stats['slides_without_anchor']}개")

    if args.dry_run:
        print("(dry-run) 저장하지 않고 종료")
        return 0

    output_path = Path(args.output).resolve() if args.output else spec_path
    save_yaml(output_path, updated_spec)
    print(f"✓ 저장 완료: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
