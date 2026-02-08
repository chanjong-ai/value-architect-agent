#!/usr/bin/env python3
"""
densify_spec.py - deck_spec 본문 밀도 자동 보강기

목적:
1) 표/차트 중심 슬라이드에서 본문 밀도 부족 구간 자동 보강
2) 불릿 아이콘/문장 톤 통일
3) 레이아웃 균형(좌측 시각요소 + 우측 시사점 패널) 자동 배치
"""

import argparse
from pathlib import Path
from typing import List, Dict

import yaml


def load_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_yaml(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False)


def _as_bullet(text: str, icon: str = "insight", source_anchor: str = "sources.md#client") -> dict:
    text = _trim_text(text, max_len=78)
    return {
        "text": text.strip(),
        "emphasis": "normal",
        "icon": icon,
        "evidence": {
            "source_anchor": source_anchor,
            "confidence": "medium",
        },
    }


def _trim_text(text: str, max_len: int = 78) -> str:
    value = " ".join(str(text or "").split()).strip()
    if len(value) <= max_len:
        return value
    return value[: max_len - 1].rstrip() + "…"


def _extract_table_keywords(slide: dict) -> List[str]:
    keywords: List[str] = []
    for block in slide.get("content_blocks", []):
        if block.get("type") != "table":
            continue
        table = block.get("table", {})
        for h in table.get("headers", []):
            h_text = str(h).strip()
            if h_text:
                keywords.append(h_text)
        for row in table.get("rows", []):
            if row:
                keywords.append(str(row[0]).strip())
    # 중복 제거
    seen = set()
    unique = []
    for k in keywords:
        if k and k not in seen:
            unique.append(k)
            seen.add(k)
    return unique


def _short_title_key(title: str) -> str:
    if not title:
        return "해당 과제"
    key = title.split(":")[0].strip()
    return _trim_text(key, max_len=18)


def _generate_consulting_bullets(slide: dict, count: int = 3) -> List[dict]:
    title = str(slide.get("title", "")).strip()
    governing = str(slide.get("governing_message", "")).strip()
    source_anchor = "sources.md#client"
    if "시장" in title or "Market" in title:
        source_anchor = "sources.md#market"
    elif "정책" in title or "Policy" in title:
        source_anchor = "sources.md#policy"
    elif "Value" in title or "CAPEX" in title:
        source_anchor = "sources.md#risk-scenarios"

    bullets: List[dict] = []
    table_keywords = _extract_table_keywords(slide)
    title_key = _short_title_key(title)

    title_lower = title.lower()
    if "scenario" in title_lower:
        return [
            _as_bullet("Base/Upside/Downside별 트리거와 대응 액션을 사전에 확정해 실행 편차를 축소해야 합니다.", icon="insight", source_anchor=source_anchor),
            _as_bullet("수요·메탈가격·정책 강도 변동을 월간 Scenario Room에서 동시 점검해야 합니다.", icon="check", source_anchor=source_anchor),
            _as_bullet("시나리오 전환 시 CAPA·재고·판가 정책이 즉시 전환되도록 의사결정 체계를 고정해야 합니다.", icon="arrow", source_anchor=source_anchor),
        ][:count]

    if "subsidiary" in title_lower or "snapshot" in title_lower:
        return [
            _as_bullet("가족사별 KPI를 가동률·재고일수·현금전환지표로 통일해 비교 가능성을 확보해야 합니다.", icon="insight", source_anchor=source_anchor),
            _as_bullet("수익성 편차는 사업별 원인(수율·판가·고정비)을 동일 프레임으로 분해해 관리해야 합니다.", icon="check", source_anchor=source_anchor),
            _as_bullet("월간 경영회의에서 저성과 법인 지원안과 투자 우선순위를 동시 재조정해야 합니다.", icon="arrow", source_anchor=source_anchor),
        ][:count]

    if "capex" in title_lower or "funding" in title_lower:
        return [
            _as_bullet("투자 게이트는 확정물량·수익성·규제적합성 3개 기준을 충족할 때만 통과시켜야 합니다.", icon="risk", source_anchor=source_anchor),
            _as_bullet("Hi-Ni/LFP/HVM과 원료·리사이클 축을 분리 평가해 자본 배분의 일관성을 높여야 합니다.", icon="insight", source_anchor=source_anchor),
            _as_bullet("분기 리뷰에서 KPI 미달 과제는 보류하고 고성과 과제로 자본을 재배분해야 합니다.", icon="check", source_anchor=source_anchor),
        ][:count]

    if table_keywords:
        key_join = "·".join(table_keywords[:3])
        bullets.append(
            _as_bullet(
                f"{key_join} 관점의 의사결정 기준을 동일 프레임으로 적용해야 실행 편차를 줄일 수 있습니다.",
                icon="insight",
                source_anchor=source_anchor,
            )
        )
    if governing:
        bullets.append(
            _as_bullet(
                f"거버닝 메시지를 실행 KPI로 전환해 월간 운영회의에서 선행지표와 결과지표를 함께 점검해야 합니다.",
                icon="check",
                source_anchor=source_anchor,
            )
        )
    if title:
        bullets.append(
            _as_bullet(
                f"{title_key} 과제는 우선순위·투자·리스크 통제를 하나의 의사결정 보드로 통합해야 합니다.",
                icon="arrow",
                source_anchor=source_anchor,
            )
        )

    fallback = [
        _as_bullet(
            "시나리오별 트리거(수요·가격·정책) 발생 시 대응 액션과 책임조직을 사전에 매핑해야 합니다.",
            icon="risk",
            source_anchor=source_anchor,
        ),
        _as_bullet(
            "분기 단위 재무성과와 현업 운영지표를 연결해 전략의 실행력을 계량적으로 관리해야 합니다.",
            icon="insight",
            source_anchor=source_anchor,
        ),
        _as_bullet(
            "핵심 과제는 단계별 게이트를 통과할 때만 다음 투자로 진입하는 원칙을 유지해야 합니다.",
            icon="check",
            source_anchor=source_anchor,
        ),
    ]

    for b in fallback:
        if len(bullets) >= count:
            break
        bullets.append(b)

    return bullets[:count]


def _ensure_icons(items: List) -> None:
    icon_order = ["check", "insight", "arrow", "risk"]
    idx = 0
    for item in items or []:
        if isinstance(item, dict):
            if not item.get("icon"):
                item["icon"] = icon_order[idx % len(icon_order)]
            idx += 1


def _sanitize_bullet_dict(item: dict, default_anchor: str = "sources.md#client") -> None:
    """불릿 dict 기본키 보정 (evidence None 방지 포함)"""
    if "text" in item:
        item["text"] = _trim_text(item.get("text", ""), max_len=78)
    else:
        item["text"] = ""

    if not item.get("icon"):
        item["icon"] = "insight"

    if not isinstance(item.get("evidence"), dict):
        item["evidence"] = {
            "source_anchor": default_anchor,
            "confidence": "medium",
        }
        return

    if not item["evidence"].get("source_anchor"):
        item["evidence"]["source_anchor"] = default_anchor
    if not item["evidence"].get("confidence"):
        item["evidence"]["confidence"] = "medium"


def _content_has_bullet_block(slide: dict) -> bool:
    for block in slide.get("content_blocks", []):
        if block.get("type") == "bullets" and block.get("bullets"):
            return True
    return False


def _collect_slide_body_chars(slide: dict) -> int:
    total = 0

    for bullet in slide.get("bullets", []):
        if isinstance(bullet, str):
            total += len(bullet)
        elif isinstance(bullet, dict):
            total += len(str(bullet.get("text", "")))

    for column in slide.get("columns", []):
        total += len(str(column.get("heading", "")))
        for bullet in column.get("bullets", []):
            if isinstance(bullet, str):
                total += len(bullet)
            elif isinstance(bullet, dict):
                total += len(str(bullet.get("text", "")))
        for block in column.get("content_blocks", []):
            total += _collect_block_chars(block)

    for block in slide.get("content_blocks", []):
        total += _collect_block_chars(block)

    return total


def _collect_block_chars(block: dict) -> int:
    block_type = str(block.get("type", "")).strip().lower()
    if block_type == "bullets":
        value = 0
        for bullet in block.get("bullets", []):
            if isinstance(bullet, str):
                value += len(bullet)
            elif isinstance(bullet, dict):
                value += len(str(bullet.get("text", "")))
        return value
    if block_type == "text":
        return len(str(block.get("text", "")))
    if block_type == "callout":
        return len(str((block.get("callout") or {}).get("text", "")))
    if block_type == "kpi":
        kpi = block.get("kpi") or {}
        return len(str(kpi.get("label", ""))) + len(str(kpi.get("comparison", "")))
    if block_type == "table":
        # 표 데이터 셀 텍스트는 시각 정보로 간주하고 narrative 밀도 산정에서 제외
        return 0
    return 0


def _target_chars_by_layout(layout: str) -> int:
    if layout in {"content", "exec_summary"}:
        return 560
    if layout in {"comparison", "two_column", "three_column"}:
        return 540
    if layout in {"chart_focus", "image_focus"}:
        return 520
    if layout in {"timeline", "process_flow"}:
        return 500
    if layout in {"cover", "section_divider", "thank_you", "quote"}:
        return 0
    return 500


def _narrative_source_anchor(slide: dict) -> str:
    title = str(slide.get("title", "")).lower()
    if any(token in title for token in ["market", "시장", "demand", "ev"]):
        return "sources.md#market"
    if any(token in title for token in ["policy", "ira", "eu", "규제"]):
        return "sources.md#policy"
    if any(token in title for token in ["value", "capex", "funding", "roadmap"]):
        return "sources.md#risk-scenarios"
    return "sources.md#client"


def _narrative_slot_by_layout(layout: str) -> tuple[int, int]:
    if layout in {"timeline", "process_flow"}:
        return (396, 114)
    if layout in {"chart_focus", "image_focus"}:
        return (408, 108)
    return (412, 108)


def _build_narrative_text(slide: dict, variant: int = 1) -> str:
    title = _short_title_key(str(slide.get("title", "")).strip())
    governing = str(slide.get("governing_message", "")).strip()

    base = (
        f"{title} 과제는 단기 실적 개선 논리와 중장기 포트폴리오 전환 논리를 분리하지 않고 동일한 실행 프레임으로 "
        "관리해야 하며, 각 의사결정은 매출·원가·자본효율·정책적합성 지표를 동시에 충족하는 조건에서만 확정되어야 합니다. "
        "또한 경영진은 월간 리뷰에서 수요·메탈가격·규제변화의 선행 신호를 공통 템플릿으로 점검하고, 편차 발생 시 과제 오너와 "
        "보정 일정이 즉시 재배치되도록 운영체계를 고정해야 합니다. "
        "이 방식은 단일 분기 성과를 넘어 구조적 수익성 복원과 공급망 탄력성 제고를 함께 달성하기 위한 실행 원칙으로 작동합니다."
    )

    if variant == 2 and governing:
        return (
            f"{governing} 이를 실행으로 연결하려면 사업부·재무·구매·생산 KPI를 통합 대시보드로 운영하고, "
            "의사결정 회의에서 목표 대비 편차·원인·보정 액션을 동시 승인하는 관리 리듬을 유지해야 합니다."
        )
    return base


def _is_auto_narrative_text(text: str) -> bool:
    value = str(text or "").strip()
    if not value:
        return False
    markers = [
        "이를 실행으로 연결하려면",
        "단기 실적 개선 논리와 중장기 포트폴리오",
        "단일 분기 성과를 넘어 구조적 수익성",
        "단일 분기 실적 개선을 넘어 구조적 수익성",
    ]
    return any(marker in value for marker in markers)


def _normalize_narrative_blocks(slide: dict, layout: str) -> bool:
    blocks = slide.get("content_blocks", [])
    if not isinstance(blocks, list):
        return False

    narrative_indexes: List[int] = []
    for idx, block in enumerate(blocks):
        if not isinstance(block, dict):
            continue
        if block.get("type") != "text":
            continue
        if _is_auto_narrative_text(block.get("text", "")):
            narrative_indexes.append(idx)

    if not narrative_indexes:
        return False

    changed = False
    primary_idx = narrative_indexes[0]
    primary = blocks[primary_idx]

    # 첫 번째 narrative만 유지하고 나머지는 제거
    for idx in reversed(narrative_indexes[1:]):
        del blocks[idx]
        changed = True

    top_pt, height_pt = _narrative_slot_by_layout(layout)
    refreshed_text = _build_narrative_text(slide, variant=1)
    if refreshed_text and str(primary.get("text", "")).strip() != refreshed_text:
        primary["text"] = refreshed_text
        changed = True
    if primary.get("position") != "main":
        primary["position"] = "main"
        changed = True
    if primary.get("left_pt") != 43:
        primary["left_pt"] = 43
        changed = True
    if primary.get("width_pt") != 860:
        primary["width_pt"] = 860
        changed = True
    if primary.get("top_pt") != top_pt:
        primary["top_pt"] = top_pt
        changed = True
    if primary.get("height_pt") != height_pt:
        primary["height_pt"] = height_pt
        changed = True

    return changed


def _append_narrative_block(slide: dict, layout: str, variant: int) -> bool:
    narrative = _build_narrative_text(slide, variant=variant)
    if not narrative:
        return False

    # 중복 narrative 방지 (반복 실행 안정성)
    for block in slide.get("content_blocks", []):
        if block.get("type") != "text":
            continue
        existing = str(block.get("text", "")).strip()
        if _is_auto_narrative_text(existing):
            return False
        if existing and existing[:28] == narrative[:28]:
            return False

    source_anchor = _narrative_source_anchor(slide)
    top_pt, height_pt = _narrative_slot_by_layout(layout)
    text_block = {
        "type": "text",
        "position": "main",
        "left_pt": 43,
        "width_pt": 860,
        "top_pt": top_pt,
        "height_pt": height_pt,
        "text": narrative,
        "evidence": {
            "source_anchor": source_anchor,
            "confidence": "medium",
        },
    }
    slide.setdefault("content_blocks", []).append(text_block)
    return True


def densify_spec(spec: dict) -> Dict[str, int]:
    slides = spec.get("slides", [])
    stats = {
        "slides_total": len(slides),
        "slides_touched": 0,
        "bullet_blocks_added": 0,
        "icons_added": 0,
        "layout_balanced": 0,
        "narrative_blocks_added": 0,
    }

    for slide in slides:
        layout = str(slide.get("layout", "")).strip().lower()
        changed = False

        # top-level bullets 아이콘 보강
        for b in slide.get("bullets", []):
            if isinstance(b, dict):
                _sanitize_bullet_dict(b)

        before_icon_missing = sum(
            1 for b in slide.get("bullets", []) if isinstance(b, dict) and not b.get("icon")
        )
        _ensure_icons(slide.get("bullets", []))

        # columns bullets 아이콘 보강
        for col in slide.get("columns", []):
            for b in col.get("bullets", []):
                if isinstance(b, dict):
                    _sanitize_bullet_dict(b)
            _ensure_icons(col.get("bullets", []))
            for block in col.get("content_blocks", []):
                if block.get("type") == "bullets":
                    for b in block.get("bullets", []):
                        if isinstance(b, dict):
                            _sanitize_bullet_dict(b)
                    _ensure_icons(block.get("bullets", []))

        # content blocks bullets 아이콘 보강
        for block in slide.get("content_blocks", []):
            if block.get("type") == "bullets":
                for b in block.get("bullets", []):
                    if isinstance(b, dict):
                        _sanitize_bullet_dict(b)
                _ensure_icons(block.get("bullets", []))

        after_icon_missing = sum(
            1 for b in slide.get("bullets", []) if isinstance(b, dict) and not b.get("icon")
        )
        if before_icon_missing > after_icon_missing:
            stats["icons_added"] += (before_icon_missing - after_icon_missing)
            changed = True

        # 핵심: content 슬라이드가 table/callout만 있을 때 우측 시사점 패널 자동 보강
        if layout in {"content", "exec_summary"}:
            has_table = any(block.get("type") == "table" for block in slide.get("content_blocks", []))
            has_bullet_block = _content_has_bullet_block(slide)
            top_bullets = slide.get("bullets", [])

            if has_table and not has_bullet_block and not top_bullets:
                bullets = _generate_consulting_bullets(slide, count=3)
                if bullets:
                    # table 좌측, callout/bullets 우측 배치로 시각-텍스트 균형 강화
                    for block in slide.get("content_blocks", []):
                        if block.get("type") == "table":
                            block["position"] = "left"
                            block["left_pt"] = 43
                            block["width_pt"] = 560
                            block["top_pt"] = 132
                        elif block.get("type") == "callout":
                            block["position"] = "right"
                            block["left_pt"] = 620
                            block["width_pt"] = 270
                            block["top_pt"] = 132

                    slide.setdefault("content_blocks", []).append(
                        {
                            "type": "bullets",
                            "position": "right",
                            "left_pt": 620,
                            "width_pt": 270,
                            "top_pt": 220,
                            "bullets": bullets,
                        }
                    )
                    stats["bullet_blocks_added"] += 1
                    stats["layout_balanced"] += 1
                    changed = True

        # chart/image 중심 슬라이드: 핵심 시사점 callout이 없으면 추가
        if layout in {"chart_focus", "image_focus"}:
            has_callout = any(block.get("type") == "callout" for block in slide.get("content_blocks", []))
            if not has_callout:
                slide.setdefault("content_blocks", []).append(
                    {
                        "type": "callout",
                        "callout": {
                            "type": "key_insight",
                            "icon": "insight",
                            "text": "핵심 지표 변화는 단일 수치가 아닌 수요·원가·정책의 결합 시그널로 해석해야 합니다.",
                        },
                    }
                )
                changed = True

            # visual layout 기본 불릿 4개 목표
            bullets = slide.get("bullets", [])
            if isinstance(bullets, list) and len(bullets) < 4:
                pad = _generate_consulting_bullets(slide, count=4 - len(bullets))
                slide["bullets"] = list(bullets) + pad
                changed = True
            elif isinstance(bullets, list) and len(bullets) > 4:
                slide["bullets"] = list(bullets[:4])
                changed = True

        # 기존 자동 narrative 블록을 단일 슬롯으로 정규화 (반복 실행 시 경계 초과 방지)
        if _normalize_narrative_blocks(slide, layout):
            changed = True

        # 본문 텍스트량 목표치까지 narrative block 확장
        target_chars = _target_chars_by_layout(layout)
        if target_chars > 0:
            current_chars = _collect_slide_body_chars(slide)
            if current_chars < target_chars:
                # 본문 하단 narrative는 1개 슬롯 우선 적용 (가시성과 완결성 중심)
                if _append_narrative_block(slide, layout, variant=1):
                    stats["narrative_blocks_added"] += 1
                    changed = True
                current_chars = _collect_slide_body_chars(slide)
                if current_chars < target_chars and layout not in {"chart_focus", "image_focus"}:
                    # 여전히 부족하면 bullet 문장을 1회 보강
                    extension = _generate_consulting_bullets(slide, count=1)
                    if extension:
                        if isinstance(slide.get("bullets"), list) and slide.get("bullets"):
                            slide["bullets"] = list(slide.get("bullets", [])) + extension
                        else:
                            bullet_block = next(
                                (b for b in slide.get("content_blocks", []) if isinstance(b, dict) and b.get("type") == "bullets"),
                                None
                            )
                            if bullet_block is not None:
                                bullet_block["bullets"] = list(bullet_block.get("bullets", [])) + extension
                            else:
                                slide.setdefault("content_blocks", []).append(
                                    {
                                        "type": "bullets",
                                        "position": "main",
                                        "left_pt": 43,
                                        "width_pt": 860,
                                        "top_pt": 210,
                                        "bullets": extension,
                                    }
                                )
                        changed = True

        if changed:
            stats["slides_touched"] += 1

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="deck_spec 본문 밀도 자동 보강")
    parser.add_argument("client_name", help="클라이언트 이름")
    parser.add_argument("--spec", help="deck_spec.yaml 경로 (기본: clients/<client>/deck_spec.yaml)")
    parser.add_argument("--output", "-o", help="출력 경로 (기본: 원본 덮어쓰기)")
    parser.add_argument("--dry-run", action="store_true", help="파일 저장 없이 요약만 출력")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    default_spec = repo_root / "clients" / args.client_name / "deck_spec.yaml"
    spec_path = Path(args.spec).resolve() if args.spec else default_spec

    if not spec_path.exists():
        print(f"Error: deck_spec.yaml이 없습니다: {spec_path}")
        return 1

    spec = load_yaml(spec_path)
    stats = densify_spec(spec)

    print(
        "✓ densify 완료: slides={slides_total}, touched={slides_touched}, bullet_blocks_added={bullet_blocks_added}, "
        "icons_added={icons_added}, layout_balanced={layout_balanced}, narrative_blocks_added={narrative_blocks_added}".format(**stats)
    )

    if args.dry_run:
        print("(dry-run) 저장 없이 종료")
        return 0

    output_path = Path(args.output).resolve() if args.output else spec_path
    save_yaml(output_path, spec)
    print(f"✓ 저장 완료: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
