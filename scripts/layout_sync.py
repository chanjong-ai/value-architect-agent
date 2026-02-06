#!/usr/bin/env python3
"""
layout_sync.py - layout_preferences.yaml 기반 Deck Spec 레이아웃 동기화

기능:
1. layout_sequence로 슬라이드 레이아웃 순서 강제
2. slide_overrides로 특정 슬라이드 레이아웃/intent 강제
3. default_layout_intent / layout_intents 적용
"""

import argparse
import copy
from pathlib import Path
from typing import Dict, List, Tuple

import yaml


VALID_LAYOUTS = {
    "cover",
    "exec_summary",
    "section_divider",
    "content",
    "two_column",
    "three_column",
    "comparison",
    "timeline",
    "process_flow",
    "chart_focus",
    "image_focus",
    "quote",
    "appendix",
    "thank_you",
}


def load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_yaml(path: Path, data: dict):
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def _merge_layout_intent(target: dict, patch: dict):
    if not patch:
        return
    target.setdefault("layout_intent", {})
    if not isinstance(target["layout_intent"], dict):
        target["layout_intent"] = {}
    for k, v in patch.items():
        target["layout_intent"][k] = v


def _normalize_index(index_key) -> int:
    # 1-based 입력을 0-based로 변환
    if isinstance(index_key, int):
        return index_key - 1
    return int(str(index_key).strip()) - 1


def apply_layout_preferences(spec: dict, pref: dict) -> Tuple[dict, List[str], List[str]]:
    """
    Returns: (updated_spec, changes, warnings)
    """
    updated = copy.deepcopy(spec)
    slides = updated.get("slides", [])
    changes: List[str] = []
    warnings: List[str] = []

    global_cfg = pref.get("global", {}) if isinstance(pref.get("global", {}), dict) else {}
    default_intent = global_cfg.get("default_layout_intent", {})
    layout_sequence = pref.get("layout_sequence", []) or []
    title_keyword_overrides = pref.get("title_keyword_overrides", []) or []
    slide_overrides = pref.get("slide_overrides", {}) or {}
    layout_intents = pref.get("layout_intents", {}) or {}
    sequence_locked_indices = set()

    # 1) layout_sequence 적용
    if layout_sequence:
        if len(layout_sequence) != len(slides):
            warnings.append(
                f"layout_sequence 길이({len(layout_sequence)})와 slide 수({len(slides)})가 다릅니다. 공통 구간만 적용합니다."
            )
        count = min(len(layout_sequence), len(slides))
        for i in range(count):
            desired = str(layout_sequence[i]).strip()
            if desired not in VALID_LAYOUTS:
                warnings.append(f"layout_sequence[{i}] 유효하지 않은 레이아웃: {desired}")
                continue
            current = slides[i].get("layout")
            if current != desired:
                slides[i]["layout"] = desired
                changes.append(f"slide {i+1}: layout {current} -> {desired}")
            sequence_locked_indices.add(i)

    # 2) title_keyword_overrides 적용
    # 규칙 예시:
    # - keyword: "로드맵"
    #   layout: "timeline"
    #   layout_intent:
    #     emphasis: "balanced"
    if title_keyword_overrides:
        if not isinstance(title_keyword_overrides, list):
            warnings.append("title_keyword_overrides는 list여야 합니다.")
        else:
            for i, slide in enumerate(slides):
                if i in sequence_locked_indices:
                    # 명시적 순서(layout_sequence)가 지정된 슬라이드는 키워드 규칙보다 우선
                    continue
                title = str(slide.get("title", "")).strip().lower()
                if not title:
                    continue

                for rule_idx, rule in enumerate(title_keyword_overrides, start=1):
                    if not isinstance(rule, dict):
                        warnings.append(f"title_keyword_overrides[{rule_idx}]는 object여야 함")
                        continue

                    if "keyword" in rule:
                        keywords = [str(rule.get("keyword", "")).strip().lower()]
                    else:
                        raw_keywords = rule.get("keywords", [])
                        if isinstance(raw_keywords, list):
                            keywords = [str(k).strip().lower() for k in raw_keywords if str(k).strip()]
                        else:
                            warnings.append(f"title_keyword_overrides[{rule_idx}].keywords는 list여야 함")
                            continue

                    if not keywords:
                        warnings.append(f"title_keyword_overrides[{rule_idx}] 키워드가 비어 있음")
                        continue

                    if not any(k in title for k in keywords):
                        continue

                    desired_layout = rule.get("layout")
                    if desired_layout:
                        desired_layout = str(desired_layout).strip()
                        if desired_layout not in VALID_LAYOUTS:
                            warnings.append(
                                f"title_keyword_overrides[{rule_idx}].layout 유효하지 않은 레이아웃: {desired_layout}"
                            )
                        else:
                            current = slides[i].get("layout")
                            if current != desired_layout:
                                slides[i]["layout"] = desired_layout
                                changes.append(
                                    f"slide {i+1}: title-keyword rule applied ({current} -> {desired_layout})"
                                )

                    if isinstance(rule.get("layout_intent"), dict):
                        before = (
                            dict(slides[i].get("layout_intent", {}))
                            if isinstance(slides[i].get("layout_intent"), dict)
                            else {}
                        )
                        _merge_layout_intent(slides[i], rule.get("layout_intent"))
                        after = slides[i].get("layout_intent", {})
                        if before != after:
                            changes.append(f"slide {i+1}: title-keyword layout_intent updated")

                    # 첫 매칭 규칙만 적용
                    break

    # 3) slide_overrides 적용 (최우선)
    for key, override in slide_overrides.items():
        try:
            idx = _normalize_index(key)
        except (TypeError, ValueError):
            warnings.append(f"slide_overrides 인덱스 파싱 실패: {key}")
            continue

        if idx < 0 or idx >= len(slides):
            warnings.append(f"slide_overrides[{key}]는 유효 범위를 벗어남 (1..{len(slides)})")
            continue

        if not isinstance(override, dict):
            warnings.append(f"slide_overrides[{key}]는 object여야 함")
            continue

        desired_layout = override.get("layout")
        if desired_layout:
            desired_layout = str(desired_layout).strip()
            if desired_layout not in VALID_LAYOUTS:
                warnings.append(f"slide_overrides[{key}].layout 유효하지 않은 레이아웃: {desired_layout}")
            else:
                current = slides[idx].get("layout")
                if current != desired_layout:
                    slides[idx]["layout"] = desired_layout
                    changes.append(f"slide {idx+1}: layout {current} -> {desired_layout}")

        if isinstance(override.get("layout_intent"), dict):
            before = dict(slides[idx].get("layout_intent", {})) if isinstance(slides[idx].get("layout_intent"), dict) else {}
            _merge_layout_intent(slides[idx], override.get("layout_intent"))
            after = slides[idx].get("layout_intent", {})
            if before != after:
                changes.append(f"slide {idx+1}: layout_intent updated")

    # 4) default_layout_intent 적용
    if isinstance(default_intent, dict) and default_intent:
        for i, slide in enumerate(slides):
            before = dict(slide.get("layout_intent", {})) if isinstance(slide.get("layout_intent"), dict) else {}
            _merge_layout_intent(slide, default_intent)
            after = slide.get("layout_intent", {})
            if before != after:
                changes.append(f"slide {i+1}: default layout_intent merged")

    # 5) layout_intents(layout별 intent) 적용
    if isinstance(layout_intents, dict) and layout_intents:
        for i, slide in enumerate(slides):
            layout = str(slide.get("layout", "")).strip()
            intent_patch = layout_intents.get(layout)
            if isinstance(intent_patch, dict) and intent_patch:
                before = dict(slide.get("layout_intent", {})) if isinstance(slide.get("layout_intent"), dict) else {}
                _merge_layout_intent(slide, intent_patch)
                after = slide.get("layout_intent", {})
                if before != after:
                    changes.append(f"slide {i+1}: layout-based intent merged ({layout})")

    updated["slides"] = slides
    return updated, changes, warnings


def main():
    parser = argparse.ArgumentParser(description="layout_preferences.yaml 기반 Deck Spec 동기화")
    parser.add_argument("spec_path", help="deck_spec.yaml 경로")
    parser.add_argument("pref_path", help="layout_preferences.yaml 경로")
    parser.add_argument("--output", "-o", help="출력 경로 (기본: spec 파일 덮어쓰기)")
    parser.add_argument("--dry-run", action="store_true", help="파일 저장 없이 변경사항만 출력")
    args = parser.parse_args()

    spec_path = Path(args.spec_path).resolve()
    pref_path = Path(args.pref_path).resolve()

    if not spec_path.exists():
        print(f"Error: spec file not found: {spec_path}")
        return 1
    if not pref_path.exists():
        print(f"Error: preference file not found: {pref_path}")
        return 1

    spec = load_yaml(spec_path)
    pref = load_yaml(pref_path)
    updated, changes, warnings = apply_layout_preferences(spec, pref)

    for w in warnings:
        print(f"⚠ {w}")

    if not changes:
        print("✓ 변경사항 없음")
        return 0

    print(f"✓ 변경사항 {len(changes)}건")
    for line in changes[:30]:
        print(f"  - {line}")

    if args.dry_run:
        return 0

    output_path = Path(args.output).resolve() if args.output else spec_path
    save_yaml(output_path, updated)
    print(f"✓ 저장 완료: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
