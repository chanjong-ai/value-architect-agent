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

AUTO_BULLET_MAX_CHARS = 180
AUTO_TITLE_KEY_MAX_CHARS = 34
AUTO_DEFAULT_MAX_BULLETS = 9
AUTO_CONTENT_MAX_BULLETS = 10
AUTO_VISUAL_MIN_BULLETS = 4
AUTO_VISUAL_MAX_BULLETS = 8
NO_BULLET_LAYOUTS = {"cover", "section_divider", "thank_you", "quote"}
VISUAL_LAYOUTS = {"chart_focus", "image_focus"}
DENSE_CONTENT_LAYOUTS = {"content", "exec_summary", "comparison", "two_column", "three_column", "process_flow", "timeline"}


def load_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_yaml(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False)


def _as_bullet(text: str, icon: str = "insight", source_anchor: str = "sources.md#client") -> dict:
    text = _trim_text(text, max_len=AUTO_BULLET_MAX_CHARS)
    return {
        "text": text.strip(),
        "emphasis": "normal",
        "icon": icon,
        "evidence": {
            "source_anchor": source_anchor,
            "confidence": "medium",
        },
    }


def _trim_text(text: str, max_len: int = AUTO_BULLET_MAX_CHARS) -> str:
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
    return _trim_text(key, max_len=AUTO_TITLE_KEY_MAX_CHARS)


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
            _as_bullet("Base/Upside/Downside별 전환 트리거와 대응 액션을 사전에 확정하고, 트리거 발생 즉시 CAPA·판가·재고 정책이 자동 전환되도록 운영 원칙을 고정해야 실행 편차를 구조적으로 줄일 수 있습니다.", icon="insight", source_anchor=source_anchor),
            _as_bullet("수요·메탈가격·정책 강도 변동은 단일 지표로 판단하지 말고 월간 Scenario Room에서 복합 신호로 동시 점검해, 조기 경보가 실제 투자·생산 의사결정으로 연결되는 체계를 만들어야 합니다.", icon="check", source_anchor=source_anchor),
            _as_bullet("시나리오 전환 시 책임조직·재무영향·고객 커뮤니케이션까지 한 번에 재정렬되도록 의사결정 게이트를 명확히 설계해야 분기 성과 변동성을 통제할 수 있습니다.", icon="arrow", source_anchor=source_anchor),
        ][:count]

    if "subsidiary" in title_lower or "snapshot" in title_lower:
        return [
            _as_bullet("가족사별 KPI를 가동률·재고일수·현금전환지표로 통일해 비교 가능성을 확보하고, 동일 기준선에서 성과 편차를 해석해야 경영진의 자본 재배분 판단이 일관되게 유지됩니다.", icon="insight", source_anchor=source_anchor),
            _as_bullet("수익성 편차는 사업별 원인(수율·판가·고정비·수급 계약)을 동일 프레임으로 분해해 관리하고, 반복적으로 발생하는 구조적 손실 요인을 분리해 개선해야 합니다.", icon="check", source_anchor=source_anchor),
            _as_bullet("월간 경영회의에서 저성과 법인의 단기 지원안과 중장기 포트폴리오 재편안을 동시에 검토해, 단기 방어와 구조 개선이 충돌하지 않도록 의사결정 리듬을 고정해야 합니다.", icon="arrow", source_anchor=source_anchor),
        ][:count]

    if "capex" in title_lower or "funding" in title_lower:
        return [
            _as_bullet("투자 게이트는 확정물량·수익성·규제적합성 3개 기준을 동시에 충족할 때만 통과시키고, 기준 미달 과제는 재검증 루프를 거친 뒤에만 재상정하도록 원칙을 명문화해야 합니다.", icon="risk", source_anchor=source_anchor),
            _as_bullet("Hi-Ni/LFP/HVM과 원료·리사이클 축을 분리 평가해 기술·시장·정책 리스크를 각각 계량화하면, 단기 수요 변동 국면에서도 자본 배분의 일관성을 유지할 수 있습니다.", icon="insight", source_anchor=source_anchor),
            _as_bullet("분기 리뷰에서 KPI 미달 과제는 즉시 보류하고 고성과 과제로 자본을 재배분해, 투자 포트폴리오가 실행 성과를 중심으로 동적으로 최적화되도록 관리해야 합니다.", icon="check", source_anchor=source_anchor),
        ][:count]

    if table_keywords:
        key_join = "·".join(table_keywords[:3])
        bullets.append(
            _as_bullet(
                f"{key_join} 관점의 의사결정 기준을 동일 프레임으로 적용하고, 예외 케이스 처리 기준까지 사전에 정의해야 실행 편차를 지속적으로 줄일 수 있습니다.",
                icon="insight",
                source_anchor=source_anchor,
            )
        )
    if governing:
        bullets.append(
            _as_bullet(
                "거버닝 메시지를 실행 KPI로 전환해 월간 운영회의에서 선행지표와 결과지표를 함께 점검하고, 편차가 발생하는 즉시 과제 오너와 보정 일정을 재지정해야 합니다.",
                icon="check",
                source_anchor=source_anchor,
            )
        )
    if title:
        bullets.append(
            _as_bullet(
                f"{title_key} 과제는 우선순위·투자·리스크 통제를 하나의 의사결정 보드로 통합해, 단기 실적과 중장기 경쟁력 목표가 같은 기준으로 관리되도록 설계해야 합니다.",
                icon="arrow",
                source_anchor=source_anchor,
            )
        )

    fallback = [
        _as_bullet(
            "시나리오별 트리거(수요·가격·정책) 발생 시 대응 액션과 책임조직, 실행 기한을 사전에 매핑해 실제 운영에서 의사결정 지연이 발생하지 않도록 해야 합니다.",
            icon="risk",
            source_anchor=source_anchor,
        ),
        _as_bullet(
            "분기 단위 재무성과와 현업 운영지표를 연결해 전략의 실행력을 계량적으로 관리하고, KPI 간 상충 구간을 분기별로 조정하는 운영 체계를 유지해야 합니다.",
            icon="insight",
            source_anchor=source_anchor,
        ),
        _as_bullet(
            "핵심 과제는 단계별 게이트를 통과할 때만 다음 투자로 진입하는 원칙을 유지해, 제한된 자본과 인력이 가장 높은 효과 구간에 집중되도록 해야 합니다.",
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


def _bullet_text(item) -> str:
    if isinstance(item, str):
        return " ".join(item.split()).strip()
    if isinstance(item, dict):
        return " ".join(str(item.get("text", "")).split()).strip()
    return ""


def _dedupe_bullets(items: List) -> List:
    seen = set()
    result = []
    for item in items or []:
        text = _bullet_text(item)
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def _sanitize_bullet_dict(item: dict, default_anchor: str = "sources.md#client") -> None:
    """불릿 dict 기본키 보정 (evidence None 방지 포함)"""
    if "text" in item:
        item["text"] = _trim_text(item.get("text", ""), max_len=AUTO_BULLET_MAX_CHARS)
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


def _remove_all_bullets_for_layout(slide: dict) -> bool:
    """no-bullet 레이아웃에서 bullets 관련 콘텐츠를 제거"""
    changed = False
    if isinstance(slide.get("bullets"), list) and slide.get("bullets"):
        slide["bullets"] = []
        changed = True

    for col in slide.get("columns", []) if isinstance(slide.get("columns", []), list) else []:
        if isinstance(col.get("bullets"), list) and col.get("bullets"):
            col["bullets"] = []
            changed = True
        if isinstance(col.get("content_blocks"), list):
            filtered = [b for b in col.get("content_blocks", []) if not (isinstance(b, dict) and b.get("type") == "bullets")]
            if len(filtered) != len(col.get("content_blocks", [])):
                col["content_blocks"] = filtered
                changed = True

    if isinstance(slide.get("content_blocks"), list):
        filtered = [b for b in slide.get("content_blocks", []) if not (isinstance(b, dict) and b.get("type") == "bullets")]
        if len(filtered) != len(slide.get("content_blocks", [])):
            slide["content_blocks"] = filtered
            changed = True
    return changed


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
        return 700
    if layout in {"comparison", "two_column", "three_column"}:
        return 680
    if layout in {"chart_focus", "image_focus"}:
        return 620
    if layout in {"timeline", "process_flow"}:
        return 560
    if layout in {"cover", "section_divider", "thank_you", "quote"}:
        return 0
    return 620


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_global_constraints(spec: dict) -> bool:
    gc = spec.get("global_constraints")
    if not isinstance(gc, dict):
        gc = {}
        spec["global_constraints"] = gc

    changed = False
    if _safe_int(gc.get("default_max_bullets"), 0) < AUTO_DEFAULT_MAX_BULLETS:
        gc["default_max_bullets"] = AUTO_DEFAULT_MAX_BULLETS
        changed = True
    if _safe_int(gc.get("default_max_chars_per_bullet"), 0) < AUTO_BULLET_MAX_CHARS:
        gc["default_max_chars_per_bullet"] = AUTO_BULLET_MAX_CHARS
        changed = True
    return changed


def _normalize_slide_constraints(slide: dict, layout: str) -> bool:
    changed = False
    raw_sc = slide.get("slide_constraints")
    sc = dict(raw_sc) if isinstance(raw_sc, dict) else {}

    if layout in NO_BULLET_LAYOUTS:
        if "max_bullets" in sc:
            sc.pop("max_bullets", None)
            changed = True
        if "max_chars_per_bullet" in sc:
            sc.pop("max_chars_per_bullet", None)
            changed = True

        if sc:
            if slide.get("slide_constraints") != sc:
                slide["slide_constraints"] = sc
                changed = True
        elif "slide_constraints" in slide:
            slide.pop("slide_constraints", None)
            changed = True
        return changed

    if layout in VISUAL_LAYOUTS:
        target_max_bullets = AUTO_VISUAL_MAX_BULLETS
    elif layout in DENSE_CONTENT_LAYOUTS:
        target_max_bullets = AUTO_CONTENT_MAX_BULLETS
    else:
        target_max_bullets = AUTO_DEFAULT_MAX_BULLETS

    desired_max_bullets = max(_safe_int(sc.get("max_bullets"), 0), target_max_bullets)
    desired_max_chars = max(_safe_int(sc.get("max_chars_per_bullet"), 0), AUTO_BULLET_MAX_CHARS)

    if sc.get("max_bullets") != desired_max_bullets:
        sc["max_bullets"] = desired_max_bullets
        changed = True
    if sc.get("max_chars_per_bullet") != desired_max_chars:
        sc["max_chars_per_bullet"] = desired_max_chars
        changed = True

    if slide.get("slide_constraints") != sc:
        slide["slide_constraints"] = sc
        changed = True

    return changed


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
        return (388, 120)
    if layout in {"chart_focus", "image_focus"}:
        return (396, 118)
    if layout in {"comparison", "two_column", "three_column"}:
        return (382, 126)
    return (380, 128)


def _build_narrative_text(slide: dict, variant: int = 1) -> str:
    title = _short_title_key(str(slide.get("title", "")).strip())
    governing = str(slide.get("governing_message", "")).strip()

    paragraph_1 = (
        f"{title} 과제는 단기 실적 개선 논리와 중장기 포트폴리오 전환 논리를 분리하지 않고 동일한 실행 프레임으로 관리해야 하며, "
        "각 의사결정은 매출·원가·자본효율·정책적합성 지표를 동시에 충족하는 조건에서만 확정되어야 합니다."
    )
    paragraph_2 = (
        "경영진은 월간 리뷰에서 수요·메탈가격·규제변화의 선행 신호를 공통 템플릿으로 점검하고, 편차 발생 시 과제 오너·보정 일정·자본 배분안을 즉시 재정렬해야 하며, "
        "이 운영 원칙을 통해 단일 분기 성과를 넘어 구조적 수익성 복원과 공급망 탄력성 제고를 동시에 달성해야 합니다."
    )
    base = f"{paragraph_1}\n{paragraph_2}"

    if variant == 2 and governing:
        return (
            f"{governing}\n이를 실행으로 연결하려면 사업부·재무·구매·생산 KPI를 통합 대시보드로 운영하고, "
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
        "단일 분기 성과를 넘어 구조적 수익성 복원",
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
        "constraints_normalized": 0,
        "bullet_blocks_added": 0,
        "icons_added": 0,
        "layout_balanced": 0,
        "narrative_blocks_added": 0,
    }

    if _normalize_global_constraints(spec):
        stats["constraints_normalized"] += 1

    for slide in slides:
        layout = str(slide.get("layout", "")).strip().lower()
        changed = False

        if _normalize_slide_constraints(slide, layout):
            stats["constraints_normalized"] += 1
            changed = True

        if layout in NO_BULLET_LAYOUTS:
            if _remove_all_bullets_for_layout(slide):
                changed = True

        # top-level bullets 아이콘 보강
        if isinstance(slide.get("bullets"), list):
            slide["bullets"] = _dedupe_bullets(slide.get("bullets", []))
        for b in slide.get("bullets", []):
            if isinstance(b, dict):
                _sanitize_bullet_dict(b)

        before_icon_missing = sum(
            1 for b in slide.get("bullets", []) if isinstance(b, dict) and not b.get("icon")
        )
        _ensure_icons(slide.get("bullets", []))

        # columns bullets 아이콘 보강
        for col in slide.get("columns", []):
            if isinstance(col.get("bullets"), list):
                col["bullets"] = _dedupe_bullets(col.get("bullets", []))
            for b in col.get("bullets", []):
                if isinstance(b, dict):
                    _sanitize_bullet_dict(b)
            _ensure_icons(col.get("bullets", []))
            for block in col.get("content_blocks", []):
                if block.get("type") == "bullets":
                    if isinstance(block.get("bullets"), list):
                        block["bullets"] = _dedupe_bullets(block.get("bullets", []))
                    for b in block.get("bullets", []):
                        if isinstance(b, dict):
                            _sanitize_bullet_dict(b)
                    _ensure_icons(block.get("bullets", []))

        # content blocks bullets 아이콘 보강
        for block in slide.get("content_blocks", []):
            if block.get("type") == "bullets":
                if isinstance(block.get("bullets"), list):
                    block["bullets"] = _dedupe_bullets(block.get("bullets", []))
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
        if layout in VISUAL_LAYOUTS:
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

            # visual block이 없으면 placeholder block 자동 추가
            if layout == "chart_focus":
                for block in slide.get("content_blocks", []):
                    if isinstance(block, dict) and block.get("type") == "chart" and isinstance(block.get("chart"), dict):
                        if not str(block["chart"].get("type", "")).strip():
                            block["chart"]["type"] = "bar_chart"
                            changed = True
                has_chart = any(
                    isinstance(block, dict) and block.get("type") == "chart"
                    for block in slide.get("content_blocks", [])
                ) or any(
                    isinstance(v, dict) and str(v.get("type", "")).lower() in {"chart", "bar_chart", "line_chart", "pie_chart", "stacked_bar", "scatter"}
                    for v in slide.get("visuals", [])
                )
                if not has_chart:
                    slide.setdefault("content_blocks", []).insert(
                        0,
                        {
                            "type": "chart",
                            "position": "main",
                            "chart": {
                                "type": "bar_chart",
                                "title": "핵심 지표 변화 (임시 플레이스홀더)",
                                "caption": "데이터 확정 시 실제 수치로 교체",
                            },
                        },
                    )
                    changed = True
            else:
                for block in slide.get("content_blocks", []):
                    if isinstance(block, dict) and block.get("type") == "image" and isinstance(block.get("image"), dict):
                        if not str(block["image"].get("type", "")).strip():
                            block["image"]["type"] = "image"
                            changed = True
                has_image = any(
                    isinstance(block, dict) and block.get("type") == "image"
                    for block in slide.get("content_blocks", [])
                ) or any(
                    isinstance(v, dict) and str(v.get("type", "")).lower() in {"image", "photo", "illustration"}
                    for v in slide.get("visuals", [])
                )
                if not has_image:
                    slide.setdefault("content_blocks", []).insert(
                        0,
                        {
                            "type": "image",
                            "position": "main",
                            "image": {
                                "type": "image",
                                "title": "핵심 비주얼 (임시 플레이스홀더)",
                                "caption": "시각 자료 확정 시 교체",
                            },
                        },
                    )
                    changed = True

            # visual layout 기본 불릿 4개 목표, 최대 8개 허용
            bullets = slide.get("bullets", [])
            if isinstance(bullets, list) and len(bullets) < AUTO_VISUAL_MIN_BULLETS:
                pad = _generate_consulting_bullets(slide, count=AUTO_VISUAL_MIN_BULLETS - len(bullets))
                slide["bullets"] = list(bullets) + pad
                changed = True
            elif isinstance(bullets, list) and len(bullets) > AUTO_VISUAL_MAX_BULLETS:
                slide["bullets"] = list(bullets[:AUTO_VISUAL_MAX_BULLETS])
                changed = True

            # visual 레이아웃의 bullets block도 최대 8개로 맞춤
            for block in slide.get("content_blocks", []):
                if isinstance(block, dict) and block.get("type") == "bullets" and isinstance(block.get("bullets"), list):
                    if len(block["bullets"]) > AUTO_VISUAL_MAX_BULLETS:
                        block["bullets"] = block["bullets"][:AUTO_VISUAL_MAX_BULLETS]
                        changed = True
            columns = slide.get("columns", []) if isinstance(slide.get("columns", []), list) else []
            for col in columns:
                if isinstance(col.get("bullets"), list) and len(col.get("bullets", [])) > AUTO_VISUAL_MAX_BULLETS:
                    col["bullets"] = col.get("bullets", [])[:AUTO_VISUAL_MAX_BULLETS]
                    changed = True
                col_blocks = col.get("content_blocks", []) if isinstance(col.get("content_blocks", []), list) else []
                for block in col_blocks:
                    if isinstance(block, dict) and block.get("type") == "bullets" and isinstance(block.get("bullets"), list) and len(block.get("bullets", [])) > AUTO_VISUAL_MAX_BULLETS:
                        block["bullets"] = block.get("bullets", [])[:AUTO_VISUAL_MAX_BULLETS]
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
                    # 여전히 부족하면 bullet 문장을 최대 2회 보강
                    for _ in range(2):
                        if current_chars >= target_chars:
                            break
                        extension = _generate_consulting_bullets(slide, count=1)
                        if not extension:
                            break

                        if isinstance(slide.get("bullets"), list) and slide.get("bullets"):
                            slide["bullets"] = _dedupe_bullets(list(slide.get("bullets", [])) + extension)
                        else:
                            bullet_block = next(
                                (b for b in slide.get("content_blocks", []) if isinstance(b, dict) and b.get("type") == "bullets"),
                                None
                            )
                            if bullet_block is not None:
                                bullet_block["bullets"] = _dedupe_bullets(list(bullet_block.get("bullets", [])) + extension)
                            else:
                                slide.setdefault("content_blocks", []).append(
                                    {
                                        "type": "bullets",
                                        "position": "main",
                                        "left_pt": 43,
                                        "width_pt": 860,
                                        "top_pt": 200,
                                        "bullets": extension,
                                    }
                                )

                        current_chars = _collect_slide_body_chars(slide)
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
        "✓ densify 완료: slides={slides_total}, touched={slides_touched}, constraints_normalized={constraints_normalized}, "
        "bullet_blocks_added={bullet_blocks_added}, icons_added={icons_added}, layout_balanced={layout_balanced}, "
        "narrative_blocks_added={narrative_blocks_added}".format(**stats)
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
