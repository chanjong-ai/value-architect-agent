#!/usr/bin/env python3
"""
densify_spec.py - Deck Spec 블록/밀도 자동 보강기

핵심 역할:
1) 레거시 bullets/content_blocks/columns를 blocks 중심으로 정규화
2) 실무 8개 레이아웃(cover/exec_summary/two_column/chart_insight/competitor_2x2/strategy_cards/timeline/kpi_cards)
   기반으로 필수 블록을 보강
3) 제목/거버닝/본문 문장 길이와 밀도를 컨설팅 톤으로 보정
4) 이후 고객사에도 동일하게 반영되도록 공통 규칙으로 동작
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import yaml

try:
    from block_utils import normalize_layout_name, normalize_slide_blocks
except ImportError:
    def normalize_layout_name(layout: str) -> str:
        key = str(layout or "").strip().lower()
        return {"chart_focus": "chart_insight", "strategy_options": "strategy_cards"}.get(key, key)

    def normalize_slide_blocks(slide: dict) -> List[dict]:
        blocks = slide.get("blocks", [])
        return blocks if isinstance(blocks, list) else []


AUTO_BULLET_MAX_CHARS = 180
AUTO_BULLET_SOFT_MAX_CHARS = 110
AUTO_BULLET_MIN_CHARS = 18
AUTO_GOVERNING_MIN_CHARS = 28
AUTO_GOVERNING_MAX_CHARS = 45

NO_BULLET_LAYOUTS = {"cover", "section_divider", "thank_you", "quote"}
PRACTICAL_LAYOUTS = {
    "cover",
    "exec_summary",
    "two_column",
    "chart_insight",
    "competitor_2x2",
    "strategy_cards",
    "timeline",
    "kpi_cards",
}

ANCHOR_CATALOG: List[str] = []

ANCHOR_ROLE_DEFAULT = {
    "market": "sources.md#market",
    "policy": "sources.md#policy",
    "competitors": "sources.md#competitors",
    "tech-trends": "sources.md#tech-trends",
    "client": "sources.md#client",
}

ANCHOR_ROLE_KEYWORDS = {
    "market": ["market", "industry", "demand", "수요", "시장", "산업", "outlook"],
    "policy": ["policy", "regulation", "ira", "eu", "정책", "규제"],
    "competitors": ["competitor", "peer", "benchmark", "경쟁"],
    "tech-trends": ["tech", "technology", "ai", "cloud", "기술"],
    "client": ["client", "company", "context", "내부", "기업", "실적"],
}

LAYOUT_REMAP_TO_PRACTICAL = {
    "chart_focus": "chart_insight",
    "image_focus": "chart_insight",
    "comparison": "competitor_2x2",
    "three_column": "strategy_cards",
    "process_flow": "timeline",
    "content": "two_column",
}

TARGET_MAX_BULLETS_BY_LAYOUT = {
    "exec_summary": 7,
    "two_column": 10,
    "chart_insight": 8,
    "competitor_2x2": 8,
    "strategy_cards": 7,
    "timeline": 8,
    "kpi_cards": 8,
}


def load_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_yaml(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False)


def parse_sources_anchors(sources_path: Path) -> List[str]:
    if not sources_path.exists():
        return []
    anchors: List[str] = []
    for raw in sources_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line.startswith("## "):
            continue
        title = line[3:].strip().lower()
        if not title:
            continue
        slug = re.sub(r"[^\w\s-]", "", title)
        slug = re.sub(r"[\s]+", "-", slug).strip("-")
        anchor = f"sources.md#{slug}"
        if anchor not in anchors:
            anchors.append(anchor)
    return anchors


def _normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _trim_text(text: str, max_len: int = AUTO_BULLET_MAX_CHARS) -> str:
    value = _normalize_ws(text)
    if len(value) <= max_len:
        return value
    return value[: max(1, max_len - 1)].rstrip() + "…"


def _single_sentence(text: str) -> str:
    value = _normalize_ws(text)
    if not value:
        return ""
    # 첫 문장만 남김 (한글 문장부호 포함)
    parts = re.split(r"(?<=[\.\!\?。！？])\s+", value)
    value = parts[0] if parts else value
    return _normalize_ws(value)


def _normalize_anchor_list(values) -> List[str]:
    anchors: List[str] = []
    for val in values if isinstance(values, list) else []:
        text = _normalize_ws(val)
        if not text.startswith("sources.md#"):
            continue
        if text not in anchors:
            anchors.append(text)
    return anchors


def _infer_anchor_role(layout: str, title: str = "") -> str:
    low = f"{layout} {title}".lower()
    if any(k in low for k in ["market", "시장", "industry", "수요", "전망"]):
        return "market"
    if any(k in low for k in ["policy", "규제", "ira", "eu"]):
        return "policy"
    if any(k in low for k in ["competitor", "peer", "경쟁", "benchmark"]):
        return "competitors"
    if any(k in low for k in ["technology", "ai", "cloud", "기술"]):
        return "tech-trends"
    return "client"


def _pick_anchor_by_role(role: str, catalog: List[str]) -> str:
    desired = ANCHOR_ROLE_DEFAULT.get(role, ANCHOR_ROLE_DEFAULT["client"])
    if not catalog:
        return desired

    if desired in catalog:
        return desired

    keywords = ANCHOR_ROLE_KEYWORDS.get(role, [])
    for anchor in catalog:
        low = anchor.lower()
        if any(key in low for key in keywords):
            return anchor

    # role 매칭 실패 시 catalog 첫 앵커로 폴백
    return catalog[0]


def _slide_anchor_catalog(slide: Optional[dict] = None) -> List[str]:
    catalog = list(ANCHOR_CATALOG)
    if not isinstance(slide, dict):
        return catalog

    metadata = slide.get("metadata", {}) if isinstance(slide.get("metadata"), dict) else {}
    refs = _normalize_anchor_list(metadata.get("source_refs", []))
    if not refs:
        return catalog

    if catalog:
        refs = [r for r in refs if r in catalog]
        ordered = refs + [a for a in catalog if a not in refs]
        return ordered or catalog
    return refs


def _default_anchor(layout: str, title: str = "", slide: Optional[dict] = None) -> str:
    role = _infer_anchor_role(layout, title)
    catalog = _slide_anchor_catalog(slide)
    return _pick_anchor_by_role(role, catalog)


def _governing_seed(layout: str, title: str) -> str:
    key = _normalize_ws(title) or "핵심 과제"
    seeds = {
        "cover": f"{key}의 성장성과 수익성을 동시에 달성할 실행 프레임을 제시합니다.",
        "exec_summary": f"{key}는 우선순위·재무효과·실행조건을 한 프레임으로 통합해야 합니다.",
        "two_column": f"{key}는 현황과 해법을 같은 기준선으로 비교해 우선순위를 확정해야 합니다.",
        "chart_insight": f"{key}는 수요·원가·정책의 결합 신호로 해석해야 합니다.",
        "competitor_2x2": f"{key}는 시장 매력도와 실행 역량을 함께 평가해 자원배분을 정렬해야 합니다.",
        "strategy_cards": f"{key}의 전략 옵션은 효과·난이도·리스크를 함께 비교해 조합 설계해야 합니다.",
        "timeline": f"{key}는 단계 목표와 의사결정 게이트를 분기 단위로 보정해야 성과를 냅니다.",
        "kpi_cards": f"{key}는 KPI·가정·검증조건을 함께 관리해 투자 우선순위를 확정해야 합니다.",
        "default": f"{key}는 근거 기반 분석과 실행 설계를 동시에 충족해야 합니다.",
    }
    return seeds.get(layout, seeds["default"])


def _normalize_governing_message(slide: dict, layout: str) -> bool:
    changed = False
    current = _normalize_ws(slide.get("governing_message", ""))
    if not current:
        current = _governing_seed(layout, slide.get("title", ""))
        changed = True

    current = _single_sentence(current)
    if len(current) < AUTO_GOVERNING_MIN_CHARS:
        current = _normalize_ws(
            f"{current} 핵심 지표와 실행책임을 함께 정의해야 합니다."
        )
        changed = True

    if len(current) > AUTO_GOVERNING_MAX_CHARS:
        current = _trim_text(current, AUTO_GOVERNING_MAX_CHARS)
        changed = True

    if slide.get("governing_message") != current:
        slide["governing_message"] = current
        changed = True

    return changed


def _as_item(text: str, anchor: str, icon: str = "insight") -> dict:
    return {
        "text": _trim_text(text, AUTO_BULLET_SOFT_MAX_CHARS),
        "icon": icon,
        "emphasis": "normal",
        "evidence": {
            "source_anchor": anchor,
            "confidence": "medium",
        },
    }


def _item_text(item) -> str:
    if isinstance(item, str):
        return _normalize_ws(item)
    if isinstance(item, dict):
        return _normalize_ws(item.get("text", ""))
    return ""


def _dedupe_items(items: Iterable) -> List[dict]:
    seen = set()
    deduped: List[dict] = []
    for item in items:
        text = _item_text(item)
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        if isinstance(item, dict):
            obj = dict(item)
            obj["text"] = _trim_text(text)
            ev = obj.get("evidence")
            if not isinstance(ev, dict):
                obj["evidence"] = {
                    "source_anchor": "sources.md#client",
                    "confidence": "medium",
                }
            else:
                if not obj["evidence"].get("source_anchor"):
                    obj["evidence"]["source_anchor"] = "sources.md#client"
                if not obj["evidence"].get("confidence"):
                    obj["evidence"]["confidence"] = "medium"
            if not obj.get("icon"):
                obj["icon"] = "insight"
            if not obj.get("emphasis"):
                obj["emphasis"] = "normal"
            deduped.append(obj)
        else:
            deduped.append(_as_item(text, "sources.md#client"))
    return deduped


def _collect_legacy_items(slide: dict) -> List[dict]:
    items: List[dict] = []

    for b in slide.get("bullets", []) if isinstance(slide.get("bullets", []), list) else []:
        text = _item_text(b)
        if text:
            items.append(_as_item(text, "sources.md#client"))

    for col in slide.get("columns", []) if isinstance(slide.get("columns", []), list) else []:
        if not isinstance(col, dict):
            continue
        heading = _normalize_ws(col.get("heading", ""))
        if heading:
            items.append(_as_item(f"{heading}: 핵심 과제와 KPI를 동일 프레임으로 관리해야 실행 일관성을 확보할 수 있습니다.", "sources.md#client"))
        for b in col.get("bullets", []) if isinstance(col.get("bullets", []), list) else []:
            text = _item_text(b)
            if text:
                items.append(_as_item(text, "sources.md#client"))

    for block in slide.get("content_blocks", []) if isinstance(slide.get("content_blocks", []), list) else []:
        if not isinstance(block, dict):
            continue
        b_type = str(block.get("type", "")).strip().lower()
        if b_type == "bullets":
            for b in block.get("bullets", []) if isinstance(block.get("bullets", []), list) else []:
                text = _item_text(b)
                if text:
                    items.append(_as_item(text, "sources.md#client"))
        elif b_type == "text":
            text = _normalize_ws(block.get("text", ""))
            if text:
                items.append(_as_item(text, "sources.md#client"))
        elif b_type == "callout":
            c = block.get("callout", {}) if isinstance(block.get("callout", {}), dict) else {}
            text = _normalize_ws(c.get("text", ""))
            if text:
                items.append(_as_item(text, "sources.md#client"))

    return _dedupe_items(items)


def _generate_dense_items(slide: dict, layout: str, count: int, start_idx: int = 0) -> List[dict]:
    title = _normalize_ws(slide.get("title", "")) or "핵심 과제"
    gm = _normalize_ws(slide.get("governing_message", ""))
    anchor = _default_anchor(layout, title, slide)

    templates = [
        f"{title}는 단기 성과와 중장기 경쟁력 목표를 같은 KPI 체계로 관리해야 실행 편차를 줄일 수 있습니다.",
        f"수요·원가·정책 신호를 월간으로 통합 점검해 {title} 우선순위를 빠르게 재조정해야 합니다.",
        f"{title} 실행안은 과제 오너·검증 지표·투자 조건을 함께 명시해야 의사결정 속도를 높일 수 있습니다.",
        f"{gm or '핵심 전략 방향'}을 실행으로 연결하려면 사업·재무·운영 데이터의 기준선을 통일해야 합니다.",
        f"경쟁사 대비 차별화 포인트를 가치사슬 단위로 재해석해 {title} 실행 범위를 단계적으로 확장해야 합니다.",
        f"핵심 리스크는 연쇄적으로 발생하므로, {title} 과제는 조기 경보 기준과 대응 액션을 함께 관리해야 합니다.",
    ]

    items: List[dict] = []
    icon_cycle = ["insight", "check", "arrow", "risk"]
    for idx in range(count):
        text = templates[(start_idx + idx) % len(templates)]
        if len(text) < AUTO_BULLET_MIN_CHARS:
            text = text + " 실행 조건과 검증 지표를 명확히 제시해야 합니다."
        items.append(_as_item(text, anchor, icon_cycle[idx % len(icon_cycle)]))
    return items


def _coerce_items(items: List[dict], slide: dict, layout: str, min_count: int, max_count: int) -> List[dict]:
    deduped = _dedupe_items(items)

    normalized: List[dict] = []
    for it in deduped:
        text = _item_text(it)
        if not text:
            continue
        if len(text) < AUTO_BULLET_MIN_CHARS:
            text = _normalize_ws(text + " 실행 기준을 함께 정의해야 합니다.")
        normalized.append(_as_item(text, _default_anchor(layout, slide.get("title", ""), slide), it.get("icon", "insight") if isinstance(it, dict) else "insight"))

    if len(normalized) < min_count:
        normalized.extend(_generate_dense_items(slide, layout, min_count - len(normalized), start_idx=len(normalized)))

    if len(normalized) > max_count:
        normalized = normalized[:max_count]

    return normalized


def _generate_action_items(slide: dict, layout: str, count: int, start_idx: int = 0) -> List[dict]:
    title = _normalize_ws(slide.get("title", "")) or "핵심 과제"
    anchor = _default_anchor(layout, title, slide)
    templates = [
        f"{title} 핵심 KPI 기준선을 확정하고 월간 리뷰를 즉시 시작합니다.",
        "우선순위 과제별 오너·기한·검증지표를 명시해 실행 책임을 고정합니다.",
        "분기별 투자 게이트를 운영해 성과 편차 발생 시 즉시 보정합니다.",
        "리스크 조기경보 지표를 정의하고 대응 시나리오를 정례 점검합니다.",
        "핵심 의사결정 안건을 경영회의 고정 트랙으로 편입해 실행 속도를 높입니다.",
    ]
    items: List[dict] = []
    for idx in range(count):
        text = templates[(start_idx + idx) % len(templates)]
        items.append(_as_item(text, anchor, "check"))
    return items


def _coerce_action_items(items: List[dict], slide: dict, layout: str, min_count: int = 2, max_count: int = 3) -> List[dict]:
    deduped = _dedupe_items(items)
    anchor = _default_anchor(layout, slide.get("title", ""), slide)
    normalized: List[dict] = []

    for it in deduped:
        text = _item_text(it)
        if not text:
            continue
        if len(text) < 14:
            text = _normalize_ws(text + " 실행 계획으로 즉시 전환합니다.")
        elif not re.search(r"(합니다|하십시오|구축|확정|정렬|점검|관리|시행|운영|추진)$", text):
            text = _normalize_ws(text + " 실행으로 연결합니다.")
        normalized.append(_as_item(text, anchor, it.get("icon", "check") if isinstance(it, dict) else "check"))

    if len(normalized) < min_count:
        normalized.extend(_generate_action_items(slide, layout, min_count - len(normalized), start_idx=len(normalized)))

    if len(normalized) > max_count:
        normalized = normalized[:max_count]

    return normalized


def _find_block(blocks: List[dict], b_type: str, slot: Optional[str] = None) -> Optional[dict]:
    b_type = str(b_type or "").strip().lower()
    slot_norm = str(slot or "").strip().lower()
    for block in blocks:
        if not isinstance(block, dict):
            continue
        if str(block.get("type", "")).strip().lower() != b_type:
            continue
        if slot and str(block.get("slot", "")).strip().lower() != slot_norm:
            continue
        return block
    return None


def _upsert_block(blocks: List[dict], block: dict) -> None:
    b_type = str(block.get("type", "")).strip().lower()
    slot = str(block.get("slot", "")).strip().lower()
    for idx, cur in enumerate(blocks):
        if not isinstance(cur, dict):
            continue
        if str(cur.get("type", "")).strip().lower() != b_type:
            continue
        if str(cur.get("slot", "")).strip().lower() != slot:
            continue
        blocks[idx] = block
        return
    blocks.append(block)


def _prune_blocks_for_layout(layout: str, blocks: List[dict]) -> List[dict]:
    allowed: Dict[str, set] = {
        "exec_summary": {("bullets", "main_bullets"), ("action_list", "action_box")},
        "two_column": {("bullets", "left_column"), ("bullets", "right_column"), ("action_list", "action_box")},
        "chart_insight": {("chart", "chart_box"), ("bullets", "insight_box"), ("action_list", "action_box")},
        "competitor_2x2": {("matrix_2x2", "matrix_box"), ("bullets", "insight_box"), ("action_list", "action_box")},
        "strategy_cards": {("kpi_cards", "kpi_cards"), ("action_list", "action_box")},
        "timeline": {("timeline_steps", "timeline_box"), ("action_list", "action_box")},
        "kpi_cards": {("kpi_cards", "kpi_cards"), ("action_list", "assumptions_box")},
    }
    allowed_set = allowed.get(layout)
    if not allowed_set:
        return [b for b in blocks if isinstance(b, dict)]

    pruned: List[dict] = []
    seen = set()
    for block in blocks:
        if not isinstance(block, dict):
            continue
        key = (str(block.get("type", "")).strip().lower(), str(block.get("slot", "")).strip().lower())
        if key not in allowed_set:
            continue
        if key in seen:
            continue
        seen.add(key)
        pruned.append(block)

    # 허용 슬롯이 모두 채워지지 않았더라도 현재 확보한 블록만 유지
    return pruned


def _find_chart_candidate(slide: dict, blocks: List[dict]) -> Optional[dict]:
    existing = _find_block(blocks, "chart")
    if existing and isinstance(existing.get("chart"), dict):
        return dict(existing.get("chart", {}))

    for block in slide.get("content_blocks", []) if isinstance(slide.get("content_blocks", []), list) else []:
        if isinstance(block, dict) and str(block.get("type", "")).strip().lower() == "chart":
            chart = block.get("chart", {}) if isinstance(block.get("chart", {}), dict) else {}
            if chart:
                return dict(chart)

    for visual in slide.get("visuals", []) if isinstance(slide.get("visuals", []), list) else []:
        if not isinstance(visual, dict):
            continue
        v_type = str(visual.get("type", "")).strip().lower()
        if "chart" in v_type or v_type in {"bar_chart", "line_chart", "pie_chart", "stacked_bar", "scatter"}:
            return dict(visual)

    return None


def _ensure_exec_summary(slide: dict, blocks: List[dict]) -> None:
    base = _collect_legacy_items(slide)
    main = _find_block(blocks, "bullets", "main_bullets") or _find_block(blocks, "bullets")
    items = []
    if main and isinstance(main.get("items", []), list):
        items.extend(main.get("items", []))
    items.extend(base)
    items = _coerce_items(items, slide, "exec_summary", min_count=3, max_count=5)
    _upsert_block(blocks, {"type": "bullets", "slot": "main_bullets", "items": items})

    action = _find_block(blocks, "action_list", "action_box")
    action_items = action.get("items", []) if action and isinstance(action.get("items", []), list) else []
    action_items = _coerce_action_items(action_items, slide, "exec_summary", min_count=2, max_count=3)
    _upsert_block(blocks, {"type": "action_list", "slot": "action_box", "items": action_items})


def _split_items_for_two_column(items: List[dict], slide: dict) -> Tuple[List[dict], List[dict]]:
    if not items:
        items = _generate_dense_items(slide, "two_column", 8)
    if len(items) < 6:
        items.extend(_generate_dense_items(slide, "two_column", 6 - len(items), start_idx=len(items)))

    mid = max(3, len(items) // 2)
    left = _coerce_items(items[:mid], slide, "two_column", min_count=3, max_count=5)
    right = _coerce_items(items[mid:], slide, "two_column", min_count=3, max_count=5)
    return left, right


def _ensure_two_column(slide: dict, blocks: List[dict]) -> None:
    base = _collect_legacy_items(slide)

    left_block = _find_block(blocks, "bullets", "left_column")
    right_block = _find_block(blocks, "bullets", "right_column")

    if left_block and right_block:
        left_items = _coerce_items(left_block.get("items", []), slide, "two_column", min_count=3, max_count=5)
        right_items = _coerce_items(right_block.get("items", []), slide, "two_column", min_count=3, max_count=5)
    else:
        left_items, right_items = _split_items_for_two_column(base, slide)

    _upsert_block(blocks, {"type": "bullets", "slot": "left_column", "items": left_items})
    _upsert_block(blocks, {"type": "bullets", "slot": "right_column", "items": right_items})

    action = _find_block(blocks, "action_list", "action_box")
    action_items = action.get("items", []) if action and isinstance(action.get("items", []), list) else []
    action_items = _coerce_action_items(action_items, slide, "two_column", min_count=2, max_count=3)
    _upsert_block(blocks, {"type": "action_list", "slot": "action_box", "items": action_items})


def _ensure_chart_insight(slide: dict, blocks: List[dict]) -> None:
    chart = _find_chart_candidate(slide, blocks)
    if not chart:
        chart = {
            "type": "bar_chart",
            "title": f"{_normalize_ws(slide.get('title', '핵심 지표'))} 핵심 지표 추이",
            "caption": "단위/기준시점/출처 확정 후 실데이터로 교체",
            "evidence": {
            "source_anchor": _default_anchor("chart_insight", slide.get("title", ""), slide),
                "confidence": "medium",
            },
        }
    _upsert_block(blocks, {"type": "chart", "slot": "chart_box", "chart": chart})

    bullet_block = _find_block(blocks, "bullets", "insight_box") or _find_block(blocks, "bullets")
    items = bullet_block.get("items", []) if bullet_block and isinstance(bullet_block.get("items", []), list) else []
    items = _coerce_items(items + _collect_legacy_items(slide), slide, "chart_insight", min_count=3, max_count=5)
    _upsert_block(blocks, {"type": "bullets", "slot": "insight_box", "items": items})

    action = _find_block(blocks, "action_list", "action_box")
    action_items = action.get("items", []) if action and isinstance(action.get("items", []), list) else []
    action_items = _coerce_action_items(action_items, slide, "chart_insight", min_count=2, max_count=3)
    _upsert_block(blocks, {"type": "action_list", "slot": "action_box", "items": action_items})


def _ensure_competitor_2x2(slide: dict, blocks: List[dict]) -> None:
    matrix = _find_block(blocks, "matrix_2x2", "matrix_box")
    matrix_data = matrix.get("matrix_2x2", {}) if matrix and isinstance(matrix.get("matrix_2x2"), dict) else {}
    if not matrix_data:
        matrix_data = {
            "x_axis": "시장 매력도",
            "y_axis": "실행 역량",
            "quadrants": ["Defend", "Harvest", "Build", "Invest"],
            "points": [
                {"label": "Client", "x": 62, "y": 58, "color": "#008FD3"},
                {"label": "Peer A", "x": 74, "y": 72, "color": "#0A5E9C"},
                {"label": "Peer B", "x": 48, "y": 64, "color": "#3C8DBC"},
                {"label": "Peer C", "x": 38, "y": 44, "color": "#6EAAD2"},
            ],
        }
    _upsert_block(blocks, {"type": "matrix_2x2", "slot": "matrix_box", "matrix_2x2": matrix_data})

    insight = _find_block(blocks, "bullets", "insight_box") or _find_block(blocks, "bullets")
    items = insight.get("items", []) if insight and isinstance(insight.get("items", []), list) else []
    items = _coerce_items(items + _collect_legacy_items(slide), slide, "competitor_2x2", min_count=3, max_count=5)
    _upsert_block(blocks, {"type": "bullets", "slot": "insight_box", "items": items})

    action = _find_block(blocks, "action_list", "action_box")
    action_items = action.get("items", []) if action and isinstance(action.get("items", []), list) else []
    action_items = _coerce_action_items(action_items, slide, "competitor_2x2", min_count=2, max_count=3)
    _upsert_block(blocks, {"type": "action_list", "slot": "action_box", "items": action_items})


def _default_strategy_cards(slide: dict) -> List[dict]:
    return [
        {
            "label": "Option A: 수익성 방어",
            "value": "단기 마진 안정화",
            "comparison": "원가·판가·믹스 동시 최적화",
        },
        {
            "label": "Option B: 성장 확장",
            "value": "중기 CAPA 고도화",
            "comparison": "고객/제품 포트폴리오 전환",
        },
        {
            "label": "Option C: 포트폴리오 재편",
            "value": "투자 우선순위 재배열",
            "comparison": "리스크-수익 균형 최적화",
        },
    ]


def _ensure_strategy_cards(slide: dict, blocks: List[dict]) -> None:
    cards_block = _find_block(blocks, "kpi_cards", "kpi_cards")
    cards = cards_block.get("cards", []) if cards_block and isinstance(cards_block.get("cards", []), list) else []

    if len(cards) < 3:
        defaults = _default_strategy_cards(slide)
        for card in defaults:
            if len(cards) >= 3:
                break
            cards.append(card)

    cards = cards[:3]
    _upsert_block(blocks, {"type": "kpi_cards", "slot": "kpi_cards", "cards": cards})

    action = _find_block(blocks, "action_list", "action_box")
    action_items = action.get("items", []) if action and isinstance(action.get("items", []), list) else []
    action_items = _coerce_action_items(action_items, slide, "strategy_cards", min_count=2, max_count=3)
    _upsert_block(blocks, {"type": "action_list", "slot": "action_box", "items": action_items})


def _default_timeline(slide: dict) -> List[dict]:
    return [
        {
            "phase": "Phase 1",
            "title": "0-100일",
            "description": "핵심 과제 우선순위 확정 및 PMO·KPI 기준선 정렬",
        },
        {
            "phase": "Phase 2",
            "title": "3-6개월",
            "description": "파일럿 실행과 운영 데이터 통합, 조기 성과 검증",
        },
        {
            "phase": "Phase 3",
            "title": "6-12개월",
            "description": "핵심 프로세스 표준화와 조직/거버넌스 내재화",
        },
        {
            "phase": "Phase 4",
            "title": "12개월+",
            "description": "전사 확산 및 투자/성과 체계 고도화",
        },
    ]


def _ensure_timeline(slide: dict, blocks: List[dict]) -> None:
    timeline_block = _find_block(blocks, "timeline_steps", "timeline_box") or _find_block(blocks, "timeline_steps")
    timeline = timeline_block.get("timeline", []) if timeline_block and isinstance(timeline_block.get("timeline", []), list) else []
    if len(timeline) < 3:
        timeline = _default_timeline(slide)
    _upsert_block(blocks, {"type": "timeline_steps", "slot": "timeline_box", "timeline": timeline[:5]})

    action = _find_block(blocks, "action_list", "action_box")
    action_items = action.get("items", []) if action and isinstance(action.get("items", []), list) else []
    action_items = _coerce_action_items(action_items, slide, "timeline", min_count=2, max_count=3)
    _upsert_block(blocks, {"type": "action_list", "slot": "action_box", "items": action_items})


def _default_kpi_cards(slide: dict) -> List[dict]:
    return [
        {"label": "Revenue Uplift", "value": "+6~10%", "comparison": "3Y cumulative"},
        {"label": "EBITDA Margin", "value": "+1.5~2.5%p", "comparison": "Year 3"},
        {"label": "Inventory Turn", "value": "+12~18%", "comparison": "Year 2"},
        {"label": "Payback", "value": "24~30M", "comparison": "scenario range"},
    ]


def _ensure_kpi_cards(slide: dict, blocks: List[dict]) -> None:
    cards_block = _find_block(blocks, "kpi_cards", "kpi_cards") or _find_block(blocks, "kpi_cards")
    cards = cards_block.get("cards", []) if cards_block and isinstance(cards_block.get("cards", []), list) else []

    if len(cards) < 4:
        defaults = _default_kpi_cards(slide)
        for card in defaults:
            if len(cards) >= 4:
                break
            cards.append(card)

    _upsert_block(blocks, {"type": "kpi_cards", "slot": "kpi_cards", "cards": cards[:4]})

    action = _find_block(blocks, "action_list", "assumptions_box") or _find_block(blocks, "action_list", "action_box")
    action_items = action.get("items", []) if action and isinstance(action.get("items", []), list) else []
    action_items = _coerce_action_items(action_items, slide, "kpi_cards", min_count=2, max_count=3)
    _upsert_block(blocks, {"type": "action_list", "slot": "assumptions_box", "items": action_items})


def _normalize_slide_constraints(slide: dict, layout: str) -> bool:
    changed = False
    raw = slide.get("slide_constraints")
    sc = dict(raw) if isinstance(raw, dict) else {}

    if layout in NO_BULLET_LAYOUTS:
        if "max_bullets" in sc:
            sc.pop("max_bullets", None)
            changed = True
        if "max_chars_per_bullet" in sc:
            sc.pop("max_chars_per_bullet", None)
            changed = True
        if sc:
            slide["slide_constraints"] = sc
        elif "slide_constraints" in slide:
            slide.pop("slide_constraints", None)
            changed = True
        return changed

    target_max = TARGET_MAX_BULLETS_BY_LAYOUT.get(layout, 8)
    if int(sc.get("max_bullets", 0) or 0) != target_max:
        sc["max_bullets"] = target_max
        changed = True

    if int(sc.get("max_chars_per_bullet", 0) or 0) < AUTO_BULLET_MAX_CHARS:
        sc["max_chars_per_bullet"] = AUTO_BULLET_MAX_CHARS
        changed = True

    if slide.get("slide_constraints") != sc:
        slide["slide_constraints"] = sc
        changed = True

    return changed


def _normalize_global_constraints(spec: dict) -> bool:
    gc = spec.get("global_constraints")
    if not isinstance(gc, dict):
        gc = {}
        spec["global_constraints"] = gc

    changed = False
    if int(gc.get("default_max_bullets", 0) or 0) < 8:
        gc["default_max_bullets"] = 8
        changed = True
    if int(gc.get("default_max_chars_per_bullet", 0) or 0) < AUTO_BULLET_MAX_CHARS:
        gc["default_max_chars_per_bullet"] = AUTO_BULLET_MAX_CHARS
        changed = True
    if int(gc.get("max_slides", 0) or 0) < 30:
        gc["max_slides"] = 35
        changed = True
    desired_sections = ["cover", "exec_summary"]
    if gc.get("required_sections") != desired_sections:
        gc["required_sections"] = desired_sections
        changed = True
    return changed


def _sanitize_block_evidence(block: dict, layout: str, title: str, slide: Optional[dict] = None) -> None:
    anchor = _default_anchor(layout, title, slide)
    if "evidence" in block and not isinstance(block.get("evidence"), dict):
        block.pop("evidence", None)

    if isinstance(block.get("evidence"), dict):
        if not block["evidence"].get("source_anchor"):
            block["evidence"]["source_anchor"] = anchor
        if not block["evidence"].get("confidence"):
            block["evidence"]["confidence"] = "medium"

    for item in block.get("items", []) if isinstance(block.get("items", []), list) else []:
        if not isinstance(item, dict):
            continue
        ev = item.get("evidence")
        if not isinstance(ev, dict):
            item["evidence"] = {"source_anchor": anchor, "confidence": "medium"}
        else:
            if not ev.get("source_anchor"):
                ev["source_anchor"] = anchor
            if not ev.get("confidence"):
                ev["confidence"] = "medium"


def densify_spec(spec: dict, available_anchors: Optional[List[str]] = None) -> Dict[str, int]:
    global ANCHOR_CATALOG
    slides = spec.get("slides", [])
    anchor_catalog = _normalize_anchor_list(spec.get("sources_ref", []))
    if isinstance(available_anchors, list):
        for anchor in _normalize_anchor_list(available_anchors):
            if anchor not in anchor_catalog:
                anchor_catalog.append(anchor)
    for slide in slides if isinstance(slides, list) else []:
        metadata = slide.get("metadata", {}) if isinstance(slide.get("metadata"), dict) else {}
        for anchor in _normalize_anchor_list(metadata.get("source_refs", [])):
            if anchor not in anchor_catalog:
                anchor_catalog.append(anchor)
    ANCHOR_CATALOG = anchor_catalog

    stats = {
        "slides_total": len(slides),
        "slides_touched": 0,
        "constraints_normalized": 0,
        "layout_remapped": 0,
        "blocks_materialized": 0,
        "required_blocks_filled": 0,
    }

    if _normalize_global_constraints(spec):
        stats["constraints_normalized"] += 1

    for slide in slides:
        changed = False
        original_layout = str(slide.get("layout", "")).strip().lower()
        layout = normalize_layout_name(original_layout)
        remapped = LAYOUT_REMAP_TO_PRACTICAL.get(layout, layout)
        if remapped != layout:
            layout = remapped
            slide["layout"] = remapped
            stats["layout_remapped"] += 1
            changed = True
        elif slide.get("layout") != layout:
            slide["layout"] = layout
            changed = True

        if _normalize_governing_message(slide, layout):
            changed = True

        if _normalize_slide_constraints(slide, layout):
            stats["constraints_normalized"] += 1
            changed = True

        if layout in NO_BULLET_LAYOUTS:
            if slide.get("blocks"):
                slide["blocks"] = []
                changed = True
            if isinstance(slide.get("bullets"), list) and slide.get("bullets"):
                slide["bullets"] = []
                changed = True
            if isinstance(slide.get("content_blocks"), list) and slide.get("content_blocks"):
                slide["content_blocks"] = []
                changed = True
            if "columns" in slide:
                slide.pop("columns", None)
                changed = True
            if changed:
                stats["slides_touched"] += 1
            continue

        blocks = normalize_slide_blocks(slide)
        if not isinstance(blocks, list):
            blocks = []

        # 블록이 비어 있으면 최소 bullets 블록 생성
        if not blocks:
            base = _collect_legacy_items(slide)
            base = _coerce_items(base, slide, layout, min_count=4, max_count=6)
            blocks = [{"type": "bullets", "slot": "main_bullets", "items": base}]
            stats["blocks_materialized"] += 1
            changed = True

        if layout == "exec_summary":
            _ensure_exec_summary(slide, blocks)
            stats["required_blocks_filled"] += 1
        elif layout == "two_column":
            _ensure_two_column(slide, blocks)
            stats["required_blocks_filled"] += 1
        elif layout == "chart_insight":
            _ensure_chart_insight(slide, blocks)
            stats["required_blocks_filled"] += 1
        elif layout == "competitor_2x2":
            _ensure_competitor_2x2(slide, blocks)
            stats["required_blocks_filled"] += 1
        elif layout == "strategy_cards":
            _ensure_strategy_cards(slide, blocks)
            stats["required_blocks_filled"] += 1
        elif layout == "timeline":
            _ensure_timeline(slide, blocks)
            stats["required_blocks_filled"] += 1
        elif layout == "kpi_cards":
            _ensure_kpi_cards(slide, blocks)
            stats["required_blocks_filled"] += 1

        pruned_blocks = _prune_blocks_for_layout(layout, blocks)
        if pruned_blocks != blocks:
            blocks = pruned_blocks
            changed = True

        for block in blocks:
            if isinstance(block, dict):
                _sanitize_block_evidence(block, layout, slide.get("title", ""), slide)

        # canonical blocks 모드로 전환: 중복 검증/중복 렌더 방지
        if slide.get("blocks") != blocks:
            slide["blocks"] = blocks
            changed = True

        if isinstance(slide.get("bullets"), list) and slide.get("bullets"):
            slide["bullets"] = []
            changed = True

        if isinstance(slide.get("content_blocks"), list) and slide.get("content_blocks"):
            slide["content_blocks"] = []
            changed = True

        if "columns" in slide:
            slide.pop("columns", None)
            changed = True

        if changed:
            stats["slides_touched"] += 1

    spec["slides"] = slides
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="deck_spec 블록/밀도 자동 보강")
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
    source_anchors = parse_sources_anchors(spec_path.parent / "sources.md")
    stats = densify_spec(spec, available_anchors=source_anchors)

    print(
        "✓ densify 완료: slides={slides_total}, touched={slides_touched}, constraints_normalized={constraints_normalized}, "
        "layout_remapped={layout_remapped}, blocks_materialized={blocks_materialized}, required_blocks_filled={required_blocks_filled}".format(**stats)
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
