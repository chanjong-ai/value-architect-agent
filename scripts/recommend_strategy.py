#!/usr/bin/env python3
"""
recommend_strategy.py - 고객 요건 입력 기반 맞춤 전략/레이아웃 추천기

기능:
1) strategy_input.yaml 기반으로 고객사별 집중 포인트 정량화
2) 집중 포인트에 맞는 분석 모듈/슬라이드 레이아웃 추천
3) 실행 가능한 결과물 생성:
   - strategy_report.md/json
   - layout_preferences.generated.yaml
"""

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
CLIENTS_DIR = REPO_ROOT / "clients"

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

MODULE_LIBRARY = {
    "M1": {"name": "Issue Tree & Hypothesis", "stage": "문제정의"},
    "M2": {"name": "External Context & Market Drivers", "stage": "외부환경"},
    "M3": {"name": "Current State Diagnostic", "stage": "현황진단"},
    "M4": {"name": "Benchmark & Competitive Gap", "stage": "벤치마크"},
    "M5": {"name": "Option Design & Value Case", "stage": "가치검증"},
    "M6": {"name": "Roadmap, Governance, and Risks", "stage": "실행설계"},
}

FOCUS_LIBRARY = {
    "cost_reduction": {
        "label": "비용 절감/수익성 개선",
        "aliases": ["cost", "cost_reduction", "원가", "비용", "opex", "마진", "수익성"],
        "module_ids": ["M3", "M5", "M6"],
        "layouts": ["comparison", "chart_focus", "timeline"],
        "guidance": "원가 구조 분해, 손실 구간 식별, 시나리오 기반 절감안 우선순위화",
    },
    "revenue_growth": {
        "label": "매출 성장/시장 확대",
        "aliases": ["revenue", "growth", "매출", "성장", "확장", "시장점유율"],
        "module_ids": ["M2", "M4", "M5"],
        "layouts": ["content", "comparison", "chart_focus"],
        "guidance": "수요/세그먼트/채널 레버를 계량화하고 성장 옵션별 수익성을 비교",
    },
    "risk_control": {
        "label": "리스크 통제/컴플라이언스",
        "aliases": ["risk", "compliance", "리스크", "규제", "감사", "통제"],
        "module_ids": ["M4", "M6", "M2"],
        "layouts": ["comparison", "process_flow", "timeline"],
        "guidance": "통제 사각지대와 규제 영향도를 반영한 단계별 리스크 완화 계획 수립",
    },
    "customer_experience": {
        "label": "고객 경험/서비스 품질",
        "aliases": ["cx", "customer", "experience", "고객", "서비스", "nps"],
        "module_ids": ["M3", "M5"],
        "layouts": ["content", "chart_focus", "process_flow"],
        "guidance": "고객 여정 병목과 서비스 성과 지표를 연결해 개선 우선순위 정의",
    },
    "operational_excellence": {
        "label": "운영 효율/프로세스 혁신",
        "aliases": ["operations", "efficiency", "process", "운영", "효율", "생산성", "프로세스"],
        "module_ids": ["M3", "M6", "M5"],
        "layouts": ["process_flow", "timeline", "comparison"],
        "guidance": "현업 프로세스 병목과 의사결정 리드타임을 함께 개선하는 실행 시나리오 설계",
    },
    "data_foundation": {
        "label": "데이터 기반/거버넌스",
        "aliases": ["data", "foundation", "governance", "데이터", "거버넌스", "품질", "마스터데이터"],
        "module_ids": ["M3", "M6"],
        "layouts": ["content", "process_flow", "timeline"],
        "guidance": "데이터 표준/소유권/품질관리 체계를 설계해 분석 신뢰도 확보",
    },
    "ai_scaling": {
        "label": "AI 확산/자동화",
        "aliases": ["ai", "ml", "automation", "자동화", "모델", "ai_scaling"],
        "module_ids": ["M2", "M5", "M6"],
        "layouts": ["chart_focus", "timeline", "content"],
        "guidance": "우선 유스케이스를 선별하고 효과/난이도 기반으로 확산 순서를 설계",
    },
}

INDUSTRY_BIAS = {
    "manufacturing": {"operational_excellence": 2, "cost_reduction": 1},
    "retail": {"revenue_growth": 2, "customer_experience": 1},
    "financial": {"risk_control": 2, "revenue_growth": 1},
    "healthcare": {"risk_control": 2, "customer_experience": 1},
    "public": {"risk_control": 2, "data_foundation": 1},
    "technology": {"ai_scaling": 2, "data_foundation": 1, "revenue_growth": 1},
}

STORY_MODE_LAYOUTS = {
    "decision_first": [
        "cover",
        "exec_summary",
        "section_divider",
        "content",
        "comparison",
        "content",
        "section_divider",
        "chart_focus",
        "timeline",
        "process_flow",
        "appendix",
        "thank_you",
    ],
    "diagnostic_first": [
        "cover",
        "content",
        "comparison",
        "content",
        "exec_summary",
        "section_divider",
        "content",
        "chart_focus",
        "timeline",
        "process_flow",
        "appendix",
        "thank_you",
    ],
    "opportunity_first": [
        "cover",
        "exec_summary",
        "content",
        "chart_focus",
        "comparison",
        "section_divider",
        "content",
        "timeline",
        "process_flow",
        "appendix",
        "thank_you",
    ],
}


def load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_yaml(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def to_int(value, default: int) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def parse_brief(brief_text: str) -> dict:
    def _extract(pattern: str) -> str:
        match = re.search(pattern, brief_text, flags=re.IGNORECASE | re.MULTILINE)
        return match.group(1).strip() if match else ""

    return {
        "industry": _extract(r"^- Industry:\s*(.+)$"),
        "audience": _extract(r"^- Target audience:\s*(.+)$"),
        "objective": _extract(r"^- Primary deliverable:\s*(.+)$"),
        "slide_range": _extract(r"^- Expected slide count range:\s*(.+)$"),
    }


def infer_industry_bucket(industry: str) -> str:
    value = (industry or "").strip().lower()
    if any(token in value for token in ["manufact", "factory", "plant", "제조"]):
        return "manufacturing"
    if any(token in value for token in ["retail", "commerce", "유통"]):
        return "retail"
    if any(token in value for token in ["bank", "insurance", "financial", "금융"]):
        return "financial"
    if any(token in value for token in ["health", "medical", "hospital", "헬스", "의료"]):
        return "healthcare"
    if any(token in value for token in ["public", "government", "공공", "정부"]):
        return "public"
    if any(token in value for token in ["tech", "software", "saas", "it"]):
        return "technology"
    return "generic"


def normalize_focus(raw_focus: str) -> Optional[str]:
    token = (raw_focus or "").strip().lower()
    if not token:
        return None
    for focus_id, cfg in FOCUS_LIBRARY.items():
        if token == focus_id:
            return focus_id
        for alias in cfg["aliases"]:
            if alias.lower() == token:
                return focus_id
        if token.replace(" ", "_") == focus_id:
            return focus_id
    return None


def infer_focus_from_questions(questions: List[str]) -> Dict[str, int]:
    score: Dict[str, int] = {}
    rules = [
        (["비용", "원가", "수익성", "opex", "margin"], "cost_reduction"),
        (["매출", "성장", "점유율", "revenue", "growth"], "revenue_growth"),
        (["리스크", "규제", "컴플라이언스", "risk", "compliance"], "risk_control"),
        (["고객", "서비스", "경험", "nps", "cx"], "customer_experience"),
        (["운영", "효율", "생산성", "process"], "operational_excellence"),
        (["데이터", "거버넌스", "품질", "master"], "data_foundation"),
        (["ai", "자동화", "모델", "ml"], "ai_scaling"),
    ]
    for question in questions:
        value = (question or "").strip().lower()
        if not value:
            continue
        for keywords, focus_id in rules:
            if any(keyword in value for keyword in keywords):
                score[focus_id] = score.get(focus_id, 0) + 1
    return score


def build_focus_scores(input_data: dict, industry_bucket: str) -> Dict[str, int]:
    scores: Dict[str, int] = {}

    raw_focus = input_data.get("priorities", {}).get("focus_areas", []) or []
    for item in raw_focus:
        focus_id = normalize_focus(str(item))
        if focus_id:
            scores[focus_id] = scores.get(focus_id, 0) + 3

    questions = input_data.get("priorities", {}).get("must_answer_questions", []) or []
    inferred = infer_focus_from_questions([str(q) for q in questions])
    for focus_id, add_score in inferred.items():
        scores[focus_id] = scores.get(focus_id, 0) + add_score

    for focus_id, add_score in INDUSTRY_BIAS.get(industry_bucket, {}).items():
        scores[focus_id] = scores.get(focus_id, 0) + add_score

    if not scores:
        scores = {"data_foundation": 1, "operational_excellence": 1}

    return dict(sorted(scores.items(), key=lambda item: item[1], reverse=True))


def build_module_priorities(focus_scores: Dict[str, int]) -> List[dict]:
    module_scores: Dict[str, int] = {module_id: 0 for module_id in MODULE_LIBRARY}
    module_scores["M1"] = 2  # 모든 프로젝트 공통 기초 모듈

    for focus_id, score in focus_scores.items():
        cfg = FOCUS_LIBRARY.get(focus_id, {})
        for module_id in cfg.get("module_ids", []):
            module_scores[module_id] = module_scores.get(module_id, 0) + score

    ranked = sorted(module_scores.items(), key=lambda item: item[1], reverse=True)
    result = []
    for module_id, score in ranked:
        if score <= 0:
            continue
        result.append({
            "id": module_id,
            "name": MODULE_LIBRARY.get(module_id, {}).get("name", module_id),
            "stage": MODULE_LIBRARY.get(module_id, {}).get("stage", ""),
            "score": score,
        })
    return result


def _sanitize_layouts(raw_layouts: List[str]) -> List[str]:
    items = []
    for layout in raw_layouts:
        value = str(layout).strip()
        if value in VALID_LAYOUTS:
            items.append(value)
    return items


def build_layout_sequence(input_data: dict, focus_scores: Dict[str, int]) -> Tuple[List[str], List[str]]:
    warnings: List[str] = []
    deck_pref = input_data.get("deck_preferences", {}) or {}
    engagement = input_data.get("engagement", {}) or {}

    mode = str(deck_pref.get("storytelling_mode", "decision_first")).strip()
    if mode not in STORY_MODE_LAYOUTS:
        warnings.append(f"storytelling_mode 미지원: {mode} (decision_first로 대체)")
        mode = "decision_first"

    base = list(STORY_MODE_LAYOUTS[mode])
    target_count = to_int(engagement.get("expected_slide_count", len(base)), len(base))
    target_count = max(8, min(20, target_count))

    sequence = list(base)
    while len(sequence) < target_count:
        sequence.insert(-1, "content")
    if len(sequence) > target_count:
        sequence = sequence[:target_count]
        sequence[0] = "cover"
        sequence[-1] = "thank_you"

    must_layouts = _sanitize_layouts(deck_pref.get("must_have_layouts", []) or [])
    avoid_layouts = _sanitize_layouts(deck_pref.get("avoid_layouts", []) or [])

    for i, layout in enumerate(sequence):
        if layout in avoid_layouts and layout not in {"cover", "thank_you"}:
            sequence[i] = "content"

    for required in must_layouts:
        if required in {"cover", "thank_you"}:
            if required == "cover":
                sequence[0] = "cover"
            else:
                sequence[-1] = "thank_you"
            continue
        if required in sequence:
            continue
        replacement_idx = next(
            (idx for idx in range(1, len(sequence) - 1) if sequence[idx] == "content"),
            len(sequence) - 2,
        )
        sequence[replacement_idx] = required

    top_focus = list(focus_scores.keys())[:2]
    preferred_layouts = []
    for focus_id in top_focus:
        preferred_layouts.extend(FOCUS_LIBRARY.get(focus_id, {}).get("layouts", []))
    for layout in preferred_layouts:
        if layout in {"cover", "thank_you"}:
            continue
        if layout not in sequence:
            replacement_idx = next(
                (idx for idx in range(1, len(sequence) - 1) if sequence[idx] == "content"),
                None,
            )
            if replacement_idx is not None:
                sequence[replacement_idx] = layout

    return sequence, warnings


def build_keyword_overrides(sequence: List[str]) -> List[dict]:
    overrides = []
    if "exec_summary" in sequence:
        overrides.append({
            "keywords": ["Executive Summary", "요약"],
            "layout": "exec_summary",
        })
    if "comparison" in sequence:
        overrides.append({
            "keywords": ["Benchmark", "비교", "Gap", "경쟁"],
            "layout": "comparison",
        })
    if "timeline" in sequence:
        overrides.append({
            "keywords": ["Roadmap", "로드맵", "실행 계획"],
            "layout": "timeline",
        })
    if "chart_focus" in sequence:
        overrides.append({
            "keywords": ["Value Case", "ROI", "기대 효과", "효과"],
            "layout": "chart_focus",
            "layout_intent": {"visual_position": "right", "emphasis": "balanced"},
        })
    return overrides


def build_generated_layout_pref(input_data: dict, sequence: List[str]) -> dict:
    deck_pref = input_data.get("deck_preferences", {}) or {}
    visual_emphasis = str(deck_pref.get("visual_emphasis", "balanced")).strip()
    if visual_emphasis not in {"content", "balanced", "visual"}:
        visual_emphasis = "balanced"
    content_density = str(deck_pref.get("content_density", "normal")).strip()
    if content_density not in {"sparse", "normal", "dense"}:
        content_density = "normal"

    return {
        "meta": {
            "version": "1.0",
            "description": "strategy_input 기반 자동 생성 레이아웃 선호 설정",
            "generated_at": datetime.now().isoformat(timespec="seconds"),
        },
        "global": {
            "default_layout_intent": {
                "emphasis": visual_emphasis,
                "content_density": content_density,
            }
        },
        "layout_sequence": sequence,
        "slide_overrides": {},
        "title_keyword_overrides": build_keyword_overrides(sequence),
        "layout_intents": {
            "chart_focus": {"visual_position": "right", "emphasis": visual_emphasis},
            "image_focus": {"visual_position": "right", "emphasis": "visual"},
        },
    }


def build_slide_map(sequence: List[str], focus_scores: Dict[str, int]) -> List[dict]:
    focus_labels = [FOCUS_LIBRARY[k]["label"] for k in focus_scores.keys() if k in FOCUS_LIBRARY]
    if not focus_labels:
        focus_labels = ["핵심 과제"]

    result = []
    focus_idx = 0
    for i, layout in enumerate(sequence, start=1):
        if layout == "cover":
            theme = "프로젝트 목적과 경영진 의사결정 주제"
        elif layout == "exec_summary":
            theme = "핵심 결론과 결정 포인트"
        elif layout == "section_divider":
            theme = "분석 파트 전환"
        elif layout == "comparison":
            theme = "As-Is vs To-Be / 경쟁사 격차"
        elif layout == "chart_focus":
            theme = "정량 효과/ROI/민감도"
        elif layout == "timeline":
            theme = "단계별 로드맵"
        elif layout == "process_flow":
            theme = "실행 운영모델/거버넌스"
        elif layout == "appendix":
            theme = "가정/데이터 상세"
        elif layout == "thank_you":
            theme = "의사결정 요청 및 다음 단계"
        else:
            theme = focus_labels[focus_idx % len(focus_labels)]
            focus_idx += 1

        result.append({"slide": i, "layout": layout, "theme": theme})
    return result


def build_actions(client_name: str, generated_pref_path: Path, data_level: str) -> List[str]:
    actions = [
        f"`python scripts/deck_cli.py sync-layout {client_name} --pref {generated_pref_path}`",
        f"`python scripts/deck_cli.py analyze {client_name}`",
        f"`python scripts/deck_cli.py full-pipeline {client_name} --sync-layout --enrich-evidence --polish`",
    ]
    if data_level == "none":
        actions.append("내부 데이터 미보유: Value Case를 보수/기준/공격 3개 시나리오로 제시")
    elif data_level == "partial":
        actions.append("내부 데이터 부분 보유: KPI 정의/기간/단위 표준화 후 민감도 분석")
    else:
        actions.append("내부 데이터 충분: 투자안별 NPV/Payback을 섹션별로 정량 제시")
    return actions


def render_markdown(report: dict) -> str:
    lines = [
        f"# Strategy Recommendation Report: {report['client_name']}",
        "",
        f"- Generated at: {report['generated_at']}",
        f"- Industry: {report['industry'] or 'N/A'}",
        f"- Audience: {report['audience'] or 'N/A'}",
        f"- Objective: {report['objective'] or 'N/A'}",
        f"- Internal data level: {report['data_readiness_level']}",
        "",
        "## 1) Input Summary",
        "",
        f"- Focus areas (input): {', '.join(report['input_focus_areas']) if report['input_focus_areas'] else 'N/A'}",
        f"- Must-answer questions: {len(report['must_answer_questions'])}",
        f"- Expected slides: {report['expected_slide_count']}",
        f"- Storytelling mode: {report['storytelling_mode']}",
        "",
        "## 2) Priority Focus Score",
        "",
        "| Focus | Score | 권장 관점 |",
        "|---|---:|---|",
    ]

    for row in report["focus_priority"]:
        lines.append(f"| {row['label']} | {row['score']} | {row['guidance']} |")

    lines.extend([
        "",
        "## 3) Recommended Analysis Modules",
        "",
        "| Module | Stage | Priority Score |",
        "|---|---|---:|",
    ])
    for row in report["module_priority"]:
        lines.append(f"| {row['name']} | {row['stage']} | {row['score']} |")

    lines.extend([
        "",
        "## 4) Recommended Slide Architecture",
        "",
        "| Slide | Layout | Recommended Theme |",
        "|---:|---|---|",
    ])
    for row in report["recommended_slide_map"]:
        lines.append(f"| {row['slide']} | {row['layout']} | {row['theme']} |")

    lines.extend([
        "",
        "## 5) Generated Artifacts",
        "",
        f"- Strategy report (json): `{report['json_path']}`",
        f"- Generated layout preference: `{report['generated_pref_path']}`",
        "",
        "## 6) Execution Actions",
        "",
    ])
    for action in report["actions"]:
        lines.append(f"- {action}")

    if report["warnings"]:
        lines.extend(["", "## 7) Warnings", ""])
        for warning in report["warnings"]:
            lines.append(f"- {warning}")

    return "\n".join(lines) + "\n"


def recommend_for_client(client_name: str, input_path: Optional[Path] = None) -> Tuple[dict, dict]:
    client_dir = CLIENTS_DIR / client_name
    if not client_dir.exists():
        raise FileNotFoundError(f"client not found: {client_name}")

    strategy_input_path = input_path or (client_dir / "strategy_input.yaml")
    if not strategy_input_path.exists():
        raise FileNotFoundError(f"strategy input not found: {strategy_input_path}")

    input_data = load_yaml(strategy_input_path)
    brief = parse_brief(read_text(client_dir / "brief.md"))

    profile = input_data.get("client_profile", {}) or {}
    engagement = input_data.get("engagement", {}) or {}
    priorities = input_data.get("priorities", {}) or {}
    data_readiness = input_data.get("data_readiness", {}) or {}
    deck_pref = input_data.get("deck_preferences", {}) or {}

    industry = str(profile.get("industry") or brief.get("industry") or "").strip()
    audience = str(profile.get("audience") or brief.get("audience") or "").strip()
    objective = str(engagement.get("objective") or brief.get("objective") or "").strip()
    expected_slide_count = to_int(engagement.get("expected_slide_count", 12), 12)
    storytelling_mode = str(deck_pref.get("storytelling_mode", "decision_first"))
    data_level = str(data_readiness.get("internal_data_level", "partial")).strip().lower()
    if data_level not in {"none", "partial", "full"}:
        data_level = "partial"

    industry_bucket = infer_industry_bucket(industry)
    focus_scores = build_focus_scores(input_data, industry_bucket)
    module_priority = build_module_priorities(focus_scores)
    sequence, warnings = build_layout_sequence(input_data, focus_scores)
    generated_pref = build_generated_layout_pref(input_data, sequence)
    slide_map = build_slide_map(sequence, focus_scores)

    focus_priority = []
    for focus_id, score in focus_scores.items():
        cfg = FOCUS_LIBRARY.get(focus_id)
        if not cfg:
            continue
        focus_priority.append({
            "id": focus_id,
            "label": cfg["label"],
            "score": score,
            "guidance": cfg["guidance"],
        })

    generated_pref_path = client_dir / "layout_preferences.generated.yaml"
    actions = build_actions(client_name, generated_pref_path, data_level)

    report = {
        "client_name": client_name,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "input_path": str(strategy_input_path),
        "industry": industry,
        "industry_bucket": industry_bucket,
        "audience": audience,
        "objective": objective,
        "data_readiness_level": data_level,
        "input_focus_areas": [str(x) for x in (priorities.get("focus_areas", []) or [])],
        "must_answer_questions": [str(x) for x in (priorities.get("must_answer_questions", []) or [])],
        "expected_slide_count": expected_slide_count,
        "storytelling_mode": storytelling_mode,
        "focus_priority": focus_priority,
        "module_priority": module_priority,
        "recommended_layout_sequence": sequence,
        "recommended_slide_map": slide_map,
        "generated_pref_path": str(generated_pref_path),
        "warnings": warnings,
        "actions": actions,
    }

    return report, generated_pref


def write_outputs(report: dict, generated_pref: dict, md_path: Path, json_path: Path, pref_path: Path) -> None:
    md_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    pref_path.parent.mkdir(parents=True, exist_ok=True)

    report["json_path"] = str(json_path)
    report["generated_pref_path"] = str(pref_path)
    md_path.write_text(render_markdown(report), encoding="utf-8")
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    save_yaml(pref_path, generated_pref)


def main() -> int:
    parser = argparse.ArgumentParser(description="고객 요건 기반 전략/레이아웃 추천")
    parser.add_argument("client_name", help="클라이언트 이름")
    parser.add_argument("--input", help="strategy_input.yaml 경로")
    parser.add_argument("--output", help="리포트(Markdown) 출력 경로")
    parser.add_argument("--json", dest="json_output", help="리포트(JSON) 출력 경로")
    parser.add_argument("--pref-output", help="생성 layout_preferences 출력 경로")
    args = parser.parse_args()

    input_path = Path(args.input).resolve() if args.input else None
    try:
        report, generated_pref = recommend_for_client(args.client_name, input_path)
    except FileNotFoundError as exc:
        print(f"Error: {exc}")
        return 1

    client_dir = CLIENTS_DIR / args.client_name
    md_path = Path(args.output).resolve() if args.output else (client_dir / "strategy_report.md")
    json_path = Path(args.json_output).resolve() if args.json_output else (client_dir / "strategy_report.json")
    pref_path = Path(args.pref_output).resolve() if args.pref_output else (client_dir / "layout_preferences.generated.yaml")

    write_outputs(report, generated_pref, md_path, json_path, pref_path)

    print(f"✓ 전략 리포트 생성: {md_path}")
    print(f"✓ 전략 리포트 JSON: {json_path}")
    print(f"✓ 생성 레이아웃 선호: {pref_path}")
    print(f"  - Top focus: {', '.join([x['label'] for x in report['focus_priority'][:3]])}")
    print(f"  - Recommended slides: {len(report['recommended_layout_sequence'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
