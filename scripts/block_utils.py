#!/usr/bin/env python3
"""
block_utils.py - Deck Spec blocks/legacy 호환 유틸리티

목적:
- slide.blocks(신규)와 bullets/content_blocks/columns(레거시)를 함께 지원
- 레이아웃 alias를 공통 규칙으로 정규화
- 불릿/텍스트 추출 로직을 단일화
"""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional

LAYOUT_ALIASES: Dict[str, str] = {
    "chart_focus": "chart_insight",
    "strategy_options": "strategy_cards",
}

NO_BULLET_LAYOUTS = {"cover", "section_divider", "thank_you", "quote"}
PRACTICAL_LAYOUT_SET = {
    "cover",
    "exec_summary",
    "two_column",
    "chart_insight",
    "competitor_2x2",
    "strategy_cards",
    "timeline",
    "kpi_cards",
}


def normalize_layout_name(layout: str) -> str:
    key = str(layout or "").strip().lower()
    return LAYOUT_ALIASES.get(key, key)


def _as_bullet_obj(item) -> Optional[dict]:
    if isinstance(item, str):
        text = " ".join(item.split()).strip()
        if not text:
            return None
        return {"text": text}

    if isinstance(item, dict):
        text = " ".join(str(item.get("text", "")).split()).strip()
        if not text:
            return None
        obj = dict(item)
        obj["text"] = text
        return obj

    return None


def _extract_items_from_block(block: dict) -> List[dict]:
    items = block.get("items")
    if isinstance(items, list):
        normalized = []
        for it in items:
            obj = _as_bullet_obj(it)
            if obj:
                normalized.append(obj)
        if normalized:
            return normalized

    bullets = block.get("bullets")
    if isinstance(bullets, list):
        normalized = []
        for it in bullets:
            obj = _as_bullet_obj(it)
            if obj:
                normalized.append(obj)
        if normalized:
            return normalized

    return []


def _clean_evidence_field(obj: dict) -> dict:
    if not isinstance(obj, dict):
        return obj
    evidence = obj.get("evidence")
    if evidence is None:
        obj.pop("evidence", None)
    elif not isinstance(evidence, dict):
        obj.pop("evidence", None)
    return obj


def normalize_slide_blocks(slide: dict) -> List[dict]:
    """
    slide.blocks를 우선 사용하고, 없으면 레거시 필드를 blocks 형태로 승격한다.
    headline/key_message는 렌더러가 title/governing_message에서 처리하므로 여기서는 본문 중심 블록만 생성한다.
    """
    blocks = slide.get("blocks")
    normalized_blocks: List[dict] = []

    if isinstance(blocks, list) and blocks:
        for block in blocks:
            if not isinstance(block, dict):
                continue
            b = dict(block)
            b_type = str(b.get("type", "")).strip().lower()
            b["type"] = b_type

            if b_type in {"bullets", "action_list"}:
                items = _extract_items_from_block(b)
                if items:
                    b["items"] = items
                else:
                    b.setdefault("items", [])
            normalized_blocks.append(_clean_evidence_field(b))

        if normalized_blocks:
            return normalized_blocks

    # 레거시 변환
    top_bullets = slide.get("bullets", [])
    if isinstance(top_bullets, list) and top_bullets:
        items = []
        for it in top_bullets:
            obj = _as_bullet_obj(it)
            if obj:
                items.append(obj)
        if items:
            normalized_blocks.append({"type": "bullets", "slot": "main_bullets", "items": items})

    content_blocks = slide.get("content_blocks", [])
    if isinstance(content_blocks, list):
        for block in content_blocks:
            if not isinstance(block, dict):
                continue
            b = dict(block)
            b_type = str(b.get("type", "")).strip().lower()
            if b_type == "bullets":
                items = []
                for it in b.get("bullets", []):
                    obj = _as_bullet_obj(it)
                    if obj:
                        items.append(obj)
                if items:
                    out = {
                        "type": "bullets",
                        "slot": b.get("slot") or b.get("position") or "main_bullets",
                        "items": items,
                    }
                    if isinstance(b.get("evidence"), dict):
                        out["evidence"] = b.get("evidence")
                    normalized_blocks.append(out)
            elif b_type == "chart":
                out = {
                    "type": "chart",
                    "slot": b.get("slot") or b.get("position") or "chart_box",
                    "chart": b.get("chart", {}),
                }
                if isinstance(b.get("evidence"), dict):
                    out["evidence"] = b.get("evidence")
                normalized_blocks.append(out)
            elif b_type == "image":
                out = {
                    "type": "image",
                    "slot": b.get("slot") or b.get("position") or "image_box",
                    "image": b.get("image", {}),
                }
                if isinstance(b.get("evidence"), dict):
                    out["evidence"] = b.get("evidence")
                normalized_blocks.append(out)
            elif b_type == "kpi":
                out = {
                    "type": "kpi_cards",
                    "slot": b.get("slot") or b.get("position") or "kpi_cards",
                    "cards": [b.get("kpi", {})],
                }
                if isinstance(b.get("evidence"), dict):
                    out["evidence"] = b.get("evidence")
                normalized_blocks.append(out)
            elif b_type == "text":
                out = {
                    "type": "text",
                    "slot": b.get("slot") or b.get("position") or "narrative_box",
                    "text": b.get("text", ""),
                }
                if isinstance(b.get("evidence"), dict):
                    out["evidence"] = b.get("evidence")
                normalized_blocks.append(out)
            elif b_type == "callout":
                callout = b.get("callout", {}) if isinstance(b.get("callout", {}), dict) else {}
                out = {
                    "type": "action_list",
                    "slot": b.get("slot") or b.get("position") or "insight_box",
                    "items": [{"text": str(callout.get("text", "")).strip()}] if callout.get("text") else [],
                }
                if isinstance(b.get("evidence"), dict):
                    out["evidence"] = b.get("evidence")
                normalized_blocks.append(out)

    columns = slide.get("columns", [])
    if isinstance(columns, list) and columns:
        for idx, col in enumerate(columns):
            if not isinstance(col, dict):
                continue
            slot = "left_column" if idx == 0 else "right_column" if idx == 1 else f"column_{idx + 1}"
            items = []
            heading = str(col.get("heading", "")).strip()
            if heading:
                items.append({"text": heading, "emphasis": "bold"})
            for it in col.get("bullets", []):
                obj = _as_bullet_obj(it)
                if obj:
                    items.append(obj)
            for block in col.get("content_blocks", []):
                if isinstance(block, dict) and block.get("type") == "bullets":
                    for it in block.get("bullets", []):
                        obj = _as_bullet_obj(it)
                        if obj:
                            items.append(obj)
            if items:
                normalized_blocks.append({"type": "bullets", "slot": slot, "items": items})

    return normalized_blocks


def block_types_in_slide(slide: dict) -> List[str]:
    types: List[str] = []

    if isinstance(slide.get("blocks"), list):
        for b in slide.get("blocks", []):
            if isinstance(b, dict):
                b_type = str(b.get("type", "")).strip().lower()
                if b_type:
                    types.append(b_type)

    if isinstance(slide.get("bullets"), list) and slide.get("bullets"):
        types.append("bullets")

    for block in slide.get("content_blocks", []) if isinstance(slide.get("content_blocks", []), list) else []:
        if isinstance(block, dict):
            b_type = str(block.get("type", "")).strip().lower()
            if b_type:
                types.append(b_type)

    for visual in slide.get("visuals", []) if isinstance(slide.get("visuals", []), list) else []:
        if not isinstance(visual, dict):
            continue
        v_type = str(visual.get("type", "")).strip().lower()
        if v_type:
            if "chart" in v_type or v_type in {"bar_chart", "line_chart", "pie_chart", "stacked_bar", "scatter"}:
                types.append("chart")
            elif v_type in {"image", "photo", "illustration"}:
                types.append("image")

    if isinstance(slide.get("columns"), list) and slide.get("columns"):
        types.append("columns")

    # 정규화
    out: List[str] = []
    seen = set()
    for t in types:
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def iter_bullet_texts(slide: dict, include_action_list: bool = False) -> List[str]:
    texts: List[str] = []

    def _append(items: Iterable):
        for item in items:
            obj = _as_bullet_obj(item)
            if obj:
                texts.append(str(obj.get("text", "")).strip())

    _append(slide.get("bullets", []) if isinstance(slide.get("bullets", []), list) else [])

    for col in slide.get("columns", []) if isinstance(slide.get("columns", []), list) else []:
        if not isinstance(col, dict):
            continue
        _append(col.get("bullets", []))
        for block in col.get("content_blocks", []) if isinstance(col.get("content_blocks", []), list) else []:
            if isinstance(block, dict) and str(block.get("type", "")).strip().lower() == "bullets":
                _append(block.get("bullets", []))

    for block in slide.get("content_blocks", []) if isinstance(slide.get("content_blocks", []), list) else []:
        if isinstance(block, dict) and str(block.get("type", "")).strip().lower() == "bullets":
            _append(block.get("bullets", []))

    # 신규 blocks
    for block in normalize_slide_blocks(slide):
        b_type = str(block.get("type", "")).strip().lower()
        if b_type == "bullets" or (include_action_list and b_type == "action_list"):
            _append(block.get("items", []))

    return [t for t in texts if t]


def governing_message_quality(message: str) -> Dict[str, int]:
    text = " ".join(str(message or "").split()).strip()
    sentence_count = 0
    if text:
        sentence_count = sum(text.count(ch) for ch in [".", "!", "?"]) or 1
    return {
        "length": len(text),
        "sentence_count": sentence_count,
    }


def bullet_quality(text: str) -> Dict[str, int]:
    value = " ".join(str(text or "").split()).strip()
    return {"length": len(value)}
