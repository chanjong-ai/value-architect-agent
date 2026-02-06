#!/usr/bin/env python3
"""
analyze_client.py - 고객사별 분석 전략/덱 준비도 진단 리포터

기능:
1. brief/sources/outline/spec/outputs를 종합 진단
2. 산업/데이터 가용성 기반 분석 모듈 추천
3. 분석 결과를 PPT 슬라이드 구조로 매핑
4. 실행 가능한 수정 액션리스트 생성

사용법:
    python scripts/analyze_client.py <client-name> [--output <report.md>] [--json <report.json>]
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

import yaml

try:
    from validate_spec import (
        load_json as load_schema_json,
        validate_schema,
        validate_business_rules,
        parse_sources_anchors,
        validate_evidence_existence,
    )
except ImportError:
    validate_schema = None
    validate_business_rules = None
    parse_sources_anchors = None
    validate_evidence_existence = None
    load_schema_json = None


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
CLIENTS_DIR = REPO_ROOT / "clients"
SCHEMA_PATH = REPO_ROOT / "schema" / "deck_spec.schema.json"

EXPECTED_SOURCE_SECTIONS = ["market", "client", "competitors", "tech-trends"]
TARGET_EVIDENCE_COVERAGE = 0.8


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def slugify(text: str) -> str:
    value = re.sub(r"[^\w\s-]", "", (text or "").strip().lower())
    return re.sub(r"[\s]+", "-", value)


def parse_markdown_sections(text: str, level: int = 2) -> Dict[str, List[str]]:
    """
    Markdown 헤딩 기반 섹션 파싱.
    반환: {section_title_lower: [line1, line2, ...]}
    """
    lines = text.splitlines()
    sections: Dict[str, List[str]] = {}
    current = None
    prefix = "#" * level + " "

    for line in lines:
        if line.startswith(prefix):
            current = line[len(prefix):].strip().lower()
            sections[current] = []
            continue
        if current is not None:
            sections[current].append(line)

    return sections


def parse_brief(brief_text: str) -> dict:
    def _extract(pattern: str) -> str:
        match = re.search(pattern, brief_text, flags=re.IGNORECASE | re.MULTILINE)
        return match.group(1).strip() if match else ""

    client_name = _extract(r"^- Client name:\s*(.+)$")
    industry = _extract(r"^- Industry:\s*(.+)$")
    audience = _extract(r"^- Target audience:\s*(.+)$")
    slide_range = _extract(r"^- Expected slide count range:\s*(.+)$")
    duration = _extract(r"^- Presentation duration:\s*(.+)$")
    objective = _extract(r"^- Primary deliverable:\s*(.+)$")
    internal_data = _extract(r"^- Internal data available:\s*(.+)$")
    key_questions = re.findall(r"^- Q\d+:\s*(.+)$", brief_text, flags=re.MULTILINE)

    return {
        "client_name": client_name,
        "industry": industry,
        "audience": audience,
        "slide_range": slide_range,
        "duration": duration,
        "objective": objective,
        "internal_data": internal_data,
        "key_questions": key_questions,
    }


def parse_slide_range(range_text: str) -> Tuple[int, int]:
    if not range_text:
        return (0, 0)
    match = re.search(r"(\d+)\s*[-~]\s*(\d+)", range_text)
    if not match:
        return (0, 0)
    return (int(match.group(1)), int(match.group(2)))


def parse_sources(sources_text: str) -> dict:
    sections = parse_markdown_sections(sources_text, level=2)
    normalized = {}
    total_checked = 0
    total_items = 0
    anchors = []

    for title, lines in sections.items():
        normalized_title = title.strip().lower()
        anchors.append(f"sources.md#{slugify(normalized_title)}")
        checked = len([ln for ln in lines if re.match(r"^\s*-\s*\[x\]\s+", ln, flags=re.IGNORECASE)])
        items = len([ln for ln in lines if re.match(r"^\s*-\s+", ln)])
        total_checked += checked
        total_items += items
        normalized[normalized_title] = {
            "checked": checked,
            "items": items,
            "lines": [ln.strip() for ln in lines if ln.strip()],
        }

    return {
        "sections": normalized,
        "total_checked": total_checked,
        "total_items": total_items,
        "anchors": anchors,
    }


def parse_outline(outline_text: str) -> dict:
    slide_headers = re.findall(r"^##\s+Slide\s+\d+\s+—\s+(.+)$", outline_text, flags=re.MULTILINE)
    governing_msgs = re.findall(r"^- Governing message:\s*(.+)$", outline_text, flags=re.MULTILINE)
    return {
        "slide_headers": slide_headers,
        "governing_messages": governing_msgs,
        "slide_count": len(slide_headers),
        "governing_count": len(governing_msgs),
    }


def collect_slide_bullets(slide: dict) -> List[dict]:
    bullets: List[dict] = []

    def _append(items):
        for item in items:
            if isinstance(item, str):
                bullets.append({"text": item.strip(), "has_evidence": False})
            elif isinstance(item, dict):
                bullets.append({
                    "text": str(item.get("text", "")).strip(),
                    "has_evidence": bool(item.get("evidence")),
                })

    _append(slide.get("bullets", []))

    for col in slide.get("columns", []):
        _append(col.get("bullets", []))
        for block in col.get("content_blocks", []):
            if block.get("type") == "bullets":
                _append(block.get("bullets", []))

    for block in slide.get("content_blocks", []):
        if block.get("type") == "bullets":
            _append(block.get("bullets", []))

    return [b for b in bullets if b.get("text")]


def collect_spec_metrics(spec: dict) -> dict:
    slides = spec.get("slides", [])
    layout_counts: Dict[str, int] = {}
    bullet_total = 0
    bullet_with_evidence = 0
    slides_with_metadata_sources = 0
    slides_without_governing = 0

    for slide in slides:
        layout = str(slide.get("layout", "unknown"))
        layout_counts[layout] = layout_counts.get(layout, 0) + 1

        if not str(slide.get("governing_message", "")).strip():
            slides_without_governing += 1

        if slide.get("metadata", {}).get("source_refs"):
            slides_with_metadata_sources += 1

        bullets = collect_slide_bullets(slide)
        bullet_total += len(bullets)
        bullet_with_evidence += len([b for b in bullets if b.get("has_evidence")])

    coverage = (bullet_with_evidence / bullet_total) if bullet_total else 0
    return {
        "slide_count": len(slides),
        "layout_counts": layout_counts,
        "bullet_total": bullet_total,
        "bullet_with_evidence": bullet_with_evidence,
        "bullet_evidence_coverage": round(coverage, 3),
        "slides_with_metadata_sources": slides_with_metadata_sources,
        "slides_without_governing": slides_without_governing,
    }


def run_spec_validation(spec_path: Path, sources_path: Path) -> dict:
    if not spec_path.exists() or not SCHEMA_PATH.exists():
        return {"errors": 0, "warnings": 0, "info": 0, "issues": []}

    if not (validate_schema and validate_business_rules and load_schema_json):
        return {"errors": 0, "warnings": 0, "info": 0, "issues": []}

    spec = load_yaml(spec_path)
    schema = load_schema_json(SCHEMA_PATH)
    issues = []

    issues.extend(validate_schema(spec, schema))
    issues.extend(validate_business_rules(spec))

    if parse_sources_anchors and validate_evidence_existence and sources_path.exists():
        anchors = parse_sources_anchors(sources_path)
        issues.extend(validate_evidence_existence(spec, anchors))

    return {
        "errors": len([i for i in issues if i.severity == "error"]),
        "warnings": len([i for i in issues if i.severity == "warning"]),
        "info": len([i for i in issues if i.severity == "info"]),
        "issues": [{"severity": i.severity, "path": i.path, "message": i.message} for i in issues],
    }


def latest_qa_report(outputs_dir: Path) -> dict:
    if not outputs_dir.exists():
        return {}

    reports = sorted(outputs_dir.glob("*_qa_report.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not reports:
        return {}

    latest = reports[0]
    try:
        data = json.loads(latest.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    data["_path"] = str(latest)
    data["_mtime"] = datetime.fromtimestamp(latest.stat().st_mtime).isoformat(timespec="seconds")
    return data


def build_analysis_modules(industry: str, internal_data_available: bool) -> List[dict]:
    modules = [
        {
            "id": "M1",
            "name": "Issue Tree & Hypothesis",
            "priority": "HIGH",
            "objective": "경영진 질문을 이슈 트리로 구조화하고 검증 가설을 정의",
            "methods": "Issue Tree, Pyramid Principle, Hypothesis Backlog",
            "required_data": "brief, 핵심 질문, 경영진 의사결정 포인트",
            "slides": "Exec Summary / Section Divider / Storyline backbone",
        },
        {
            "id": "M2",
            "name": "External Context & Market Drivers",
            "priority": "HIGH",
            "objective": "시장/기술/규제 요인이 고객사의 전략 선택에 미치는 영향 정량화",
            "methods": "Market sizing, trend decomposition, scenario framing",
            "required_data": "시장 리포트, 거시/산업 데이터, 기술 채택 지표",
            "slides": "Industry Context / Strategic Implications",
        },
        {
            "id": "M3",
            "name": "Current State Diagnostic",
            "priority": "HIGH",
            "objective": "As-Is 운영/데이터/조직의 병목과 손실 구간 파악",
            "methods": "KPI baseline, process bottleneck mapping, maturity assessment",
            "required_data": "내부 KPI, 프로세스 현황, 시스템 인터페이스",
            "slides": "Current State / Pain Points",
        },
        {
            "id": "M4",
            "name": "Benchmark & Competitive Gap",
            "priority": "HIGH",
            "objective": "선도사와의 격차를 capability 및 KPI 관점으로 계량화",
            "methods": "Peer benchmarking, capability heatmap, gap scoring",
            "required_data": "경쟁사 공개자료, 벤치마크 KPI, 사례 비교",
            "slides": "Competitive Landscape / Comparison",
        },
        {
            "id": "M5",
            "name": "Option Design & Value Case",
            "priority": "HIGH",
            "objective": "실행 옵션별 효과/비용/리스크를 비교해 우선순위 도출",
            "methods": "Option matrix, cost-benefit model, sensitivity analysis",
            "required_data": "투자비, 운영비, 기대효과, 가정 파라미터",
            "slides": "Value Case / Recommendation",
        },
        {
            "id": "M6",
            "name": "Roadmap, Governance, and Risks",
            "priority": "MEDIUM",
            "objective": "실행 로드맵, PMO, 리스크 대응 체계 구체화",
            "methods": "Wave planning, milestone design, risk-control matrix",
            "required_data": "프로젝트 일정, 조직 구조, 의사결정 체계",
            "slides": "Timeline / Process Flow / Closing",
        },
    ]

    industry_norm = (industry or "").lower()
    addon = []
    if "manufactur" in industry_norm:
        addon.append({
            "id": "X1",
            "name": "Manufacturing Operations Analytics",
            "priority": "HIGH",
            "objective": "생산성/품질/설비가동률 관점의 개선 레버 정의",
            "methods": "OEE decomposition, quality loss tree, downtime analysis",
            "required_data": "설비가동, 불량, 재작업, 납기 지표",
            "slides": "Current State / Value Case / Roadmap",
        })
    elif "retail" in industry_norm:
        addon.append({
            "id": "X1",
            "name": "Retail Demand & Margin Analytics",
            "priority": "HIGH",
            "objective": "카테고리/채널별 수요 및 마진 개선 포인트 도출",
            "methods": "Basket analysis, margin waterfall, assortment optimization",
            "required_data": "SKU 판매/마진, 채널별 재고, 프로모션 성과",
            "slides": "Context / Comparison / Value Case",
        })
    elif "financial" in industry_norm or "bank" in industry_norm:
        addon.append({
            "id": "X1",
            "name": "Financial Portfolio & Risk Analytics",
            "priority": "HIGH",
            "objective": "수익성 개선과 리스크 통제를 동시에 만족하는 실행안 도출",
            "methods": "Portfolio segmentation, loss analysis, compliance impact",
            "required_data": "상품별 수익성, 손실률, 규제 기준 데이터",
            "slides": "Current State / Strategic Implications / Value Case",
        })
    elif "health" in industry_norm or "medical" in industry_norm:
        addon.append({
            "id": "X1",
            "name": "Healthcare Service & Outcome Analytics",
            "priority": "HIGH",
            "objective": "진료/운영 효율과 서비스 품질 지표를 동시 개선",
            "methods": "Patient flow mapping, resource utilization, outcome KPI",
            "required_data": "진료 프로세스, 대기시간, 자원투입, 품질지표",
            "slides": "Current State / Process Flow / Value Case",
        })

    modules = modules + addon

    if not internal_data_available:
        for module in modules:
            if module["id"] in {"M3", "M5", "X1"}:
                module["risk_note"] = "내부 데이터 미제공 시 가정 기반 산출로 신뢰도 제한"

    return modules


def infer_internal_data_available(internal_data_text: str) -> bool:
    """
    brief.md의 내부데이터 가용성 문구를 해석.
    """
    value = (internal_data_text or "").strip().lower()
    if not value:
        return False

    negative_markers = [
        "no",
        "none",
        "n/a",
        "not available",
        "미제공",
        "없음",
        "부재",
        "가정",
    ]
    return not any(marker in value for marker in negative_markers)


def score_readiness(
    brief: dict,
    sources: dict,
    outline: dict,
    spec_metrics: dict,
    spec_validation: dict,
    qa: dict,
) -> dict:
    # 1) Brief 점수
    brief_fields = [
        bool(brief.get("client_name")),
        bool(brief.get("industry")),
        bool(brief.get("audience")),
        bool(brief.get("slide_range")),
        bool(brief.get("objective")),
        len(brief.get("key_questions", [])) >= 3,
    ]
    brief_score = int(sum(brief_fields) / len(brief_fields) * 100)

    # 2) Sources 점수
    source_sections_present = len([s for s in EXPECTED_SOURCE_SECTIONS if s in sources.get("sections", {})])
    section_ratio = (source_sections_present / len(EXPECTED_SOURCE_SECTIONS)) if EXPECTED_SOURCE_SECTIONS else 0
    checked = sources.get("total_checked", 0)
    checked_ratio = min(checked / 12, 1.0)
    source_score = int((section_ratio * 60) + (checked_ratio * 40))

    # 3) Storyline 점수
    outline_count = outline.get("slide_count", 0)
    spec_count = spec_metrics.get("slide_count", 0)
    storyline_score = 0
    if outline_count > 0:
        storyline_score += 50
    if spec_count > 0:
        storyline_score += 30
    if outline_count > 0 and spec_count > 0 and abs(outline_count - spec_count) <= 1:
        storyline_score += 20

    # 4) Spec 점수
    spec_score = 100
    spec_score -= spec_validation.get("errors", 0) * 40
    spec_score -= spec_validation.get("warnings", 0) * 5
    spec_score -= spec_metrics.get("slides_without_governing", 0) * 10
    coverage = spec_metrics.get("bullet_evidence_coverage", 0)
    if coverage < TARGET_EVIDENCE_COVERAGE:
        # 컨설팅 산출물 품질 기준(기본 80%) 미달 시 최대 45점 감점
        penalty = int(round(((TARGET_EVIDENCE_COVERAGE - coverage) / TARGET_EVIDENCE_COVERAGE) * 45))
        spec_score -= penalty
    if coverage < 0.5:
        spec_score -= 10
    spec_score = max(0, min(100, spec_score))

    # 5) Execution 점수
    execution_score = 0
    if qa:
        execution_score += 40
        if qa.get("passed"):
            execution_score += 45
        execution_score -= qa.get("summary", {}).get("warnings", 0) * 2
        execution_score -= qa.get("summary", {}).get("errors", 0) * 15
    if spec_metrics.get("slide_count", 0) > 0:
        execution_score += 15
    if coverage < TARGET_EVIDENCE_COVERAGE:
        # 렌더/QA 통과와 별개로 근거 추적성 미달을 Execution에도 반영
        execution_score -= 20
    execution_score = max(0, min(100, execution_score))

    weighted = (
        brief_score * 0.2
        + source_score * 0.2
        + storyline_score * 0.2
        + spec_score * 0.2
        + execution_score * 0.2
    )
    overall = int(round(weighted))

    quality_gate_failed = (
        spec_validation.get("errors", 0) > 0
        or (qa and not qa.get("passed", False))
        or coverage < TARGET_EVIDENCE_COVERAGE
    )

    if overall >= 85 and not quality_gate_failed:
        maturity = "READY_FOR_EXEC_DECK"
    elif overall >= 70:
        maturity = "READY_WITH_REFINEMENT"
    elif overall >= 50:
        maturity = "PARTIAL_READY"
    else:
        maturity = "NEEDS_BASELINE_WORK"

    return {
        "brief_score": brief_score,
        "source_score": source_score,
        "storyline_score": storyline_score,
        "spec_score": spec_score,
        "execution_score": execution_score,
        "overall_score": overall,
        "maturity": maturity,
        "quality_gate_failed": quality_gate_failed,
        "target_evidence_coverage": TARGET_EVIDENCE_COVERAGE,
    }


def build_gap_items(
    client_dir: Path,
    brief: dict,
    sources: dict,
    outline: dict,
    spec_metrics: dict,
    spec_validation: dict,
    qa: dict,
) -> List[dict]:
    gaps = []

    required_files = ["brief.md", "constraints.md", "sources.md", "deck_outline.md", "deck_spec.yaml"]
    for name in required_files:
        if not (client_dir / name).exists():
            gaps.append({"severity": "HIGH", "item": f"필수 파일 누락: {name}"})

    if len(brief.get("key_questions", [])) < 3:
        gaps.append({"severity": "HIGH", "item": "brief.md의 핵심 질문(Q1~Q3) 보강 필요"})

    missing_sections = [s for s in EXPECTED_SOURCE_SECTIONS if s not in sources.get("sections", {})]
    if missing_sections:
        gaps.append({
            "severity": "HIGH",
            "item": f"sources.md 섹션 누락: {', '.join(missing_sections)}",
        })

    evidence_coverage = spec_metrics.get("bullet_evidence_coverage", 0)
    if evidence_coverage < TARGET_EVIDENCE_COVERAGE:
        coverage_pct = int(spec_metrics.get("bullet_evidence_coverage", 0) * 100)
        target_pct = int(TARGET_EVIDENCE_COVERAGE * 100)
        severity = "HIGH" if evidence_coverage < 0.5 else "MEDIUM"
        gaps.append({
            "severity": severity,
            "item": f"불릿 evidence 연결률 보강 필요 (현재 {coverage_pct}%, 목표 {target_pct}%+)",
        })

    if spec_validation.get("errors", 0) > 0:
        gaps.append({
            "severity": "HIGH",
            "item": f"Deck Spec 검증 오류 {spec_validation['errors']}건 해결 필요",
        })
    elif spec_validation.get("warnings", 0) > 0:
        gaps.append({
            "severity": "MEDIUM",
            "item": f"Deck Spec 경고 {spec_validation['warnings']}건 정리 권장",
        })

    if outline.get("slide_count", 0) and spec_metrics.get("slide_count", 0):
        if abs(outline["slide_count"] - spec_metrics["slide_count"]) > 1:
            gaps.append({
                "severity": "MEDIUM",
                "item": "deck_outline.md와 deck_spec.yaml 슬라이드 수 정합성 확인 필요",
            })

    if qa and not qa.get("passed", False):
        gaps.append({"severity": "HIGH", "item": "최신 QA가 실패 상태이므로 오류 우선 수정 필요"})

    if not qa:
        gaps.append({"severity": "MEDIUM", "item": "QA 보고서가 없어 품질 게이트 확인 불가"})

    return gaps


def build_actions(client_name: str, gaps: List[dict], has_internal_data: bool) -> List[str]:
    actions = []

    actions.append(
        f"`clients/{client_name}/brief.md`에 의사결정 질문, 성과 KPI, 발표 목적을 수치 중심으로 명확화"
    )
    actions.append(
        f"`clients/{client_name}/sources.md` 각 항목에 발행일/URL/접근일 추가 (감사 추적성 확보)"
    )
    actions.append(
        f"`clients/{client_name}/deck_spec.yaml`의 핵심 불릿에 evidence/source_anchor 우선 연결"
    )
    actions.append(
        f"`python scripts/deck_cli.py full-pipeline {client_name} --sync-layout --enrich-evidence --polish`로 품질 게이트 재확인"
    )

    if not has_internal_data:
        actions.append(
            "내부 KPI 미제공 상태이므로 Value Case는 범위형 시나리오(보수/기준/공격)로 명시"
        )

    high_gaps = [g for g in gaps if g["severity"] == "HIGH"]
    if high_gaps:
        actions.append("HIGH 갭 항목부터 우선 해소 후 슬라이드 미세편집 진행")

    return actions


def render_markdown(report: dict) -> str:
    readiness = report["readiness"]
    expected_sections_found = len(
        [s for s in EXPECTED_SOURCE_SECTIONS if s in report["sources"].get("sections", {})]
    )
    extra_sections = len(report["sources"].get("sections", {})) - expected_sections_found
    lines = [
        f"# Client Analysis Report: {report['client_name']}",
        "",
        f"- Generated at: {report['generated_at']}",
        f"- Industry: {report['brief'].get('industry') or report['spec_meta'].get('industry') or 'N/A'}",
        f"- Audience: {report['brief'].get('audience') or report['spec_meta'].get('audience') or 'N/A'}",
        f"- Maturity: **{readiness['maturity']}**",
        "",
        "## 1) Readiness Scorecard",
        "",
        f"- Overall: **{readiness['overall_score']}/100**",
        f"- Brief: {readiness['brief_score']}",
        f"- Sources: {readiness['source_score']}",
        f"- Storyline: {readiness['storyline_score']}",
        f"- Spec: {readiness['spec_score']}",
        f"- Execution: {readiness['execution_score']}",
        f"- Quality gate: {'FAIL' if readiness.get('quality_gate_failed') else 'PASS'}",
        "",
        "## 2) Current Artifact Diagnostics",
        "",
        f"- Slides in spec: {report['spec_metrics'].get('slide_count', 0)}",
        f"- Outline slide count: {report['outline'].get('slide_count', 0)}",
        f"- Total bullets: {report['spec_metrics'].get('bullet_total', 0)}",
        f"- Bullet evidence coverage: {int(report['spec_metrics'].get('bullet_evidence_coverage', 0) * 100)}%",
        f"- Source sections found: {expected_sections_found}/{len(EXPECTED_SOURCE_SECTIONS)} (extra: {max(extra_sections, 0)})",
        f"- Checked source entries: {report['sources'].get('total_checked', 0)}",
    ]

    if report["latest_qa"]:
        qa = report["latest_qa"]
        lines.extend([
            f"- Latest QA: {'PASS' if qa.get('passed') else 'FAIL'}",
            f"- QA summary: errors {qa.get('summary', {}).get('errors', 0)}, warnings {qa.get('summary', {}).get('warnings', 0)}, info {qa.get('summary', {}).get('info', 0)}",
            f"- QA report: `{qa.get('_path', '')}`",
        ])
    else:
        lines.append("- Latest QA: N/A")

    lines.extend([
        "",
        "## 3) Recommended Analysis Modules (Client-Specific)",
        "",
    ])

    for module in report["analysis_modules"]:
        lines.extend([
            f"### {module['id']}. {module['name']} ({module['priority']})",
            f"- 분석 목적: {module['objective']}",
            f"- 수행 방법: {module['methods']}",
            f"- 필요 데이터: {module['required_data']}",
            f"- PPT 반영: {module['slides']}",
        ])
        if module.get("risk_note"):
            lines.append(f"- 리스크: {module['risk_note']}")
        lines.append("")

    lines.extend([
        "## 4) Analysis-to-Slide Mapping",
        "",
        "| 분석 단계 | 핵심 산출물 | 권장 레이아웃 |",
        "|---|---|---|",
        "| 이슈 구조화 | 의사결정 질문, 가설 트리 | exec_summary / section_divider |",
        "| 외부환경 분석 | 시장/기술/규제 드라이버 | content / two_column |",
        "| As-Is 진단 | 병목, KPI baseline | content / comparison |",
        "| 벤치마크 | 경쟁사 대비 갭 | comparison / three_column |",
        "| 가치 검증 | 옵션별 효과/비용, 민감도 | chart_focus / content |",
        "| 실행 설계 | 단계별 로드맵, 거버넌스 | timeline / process_flow |",
        "",
        "## 5) Gap & Risk Items",
        "",
    ])

    if report["gaps"]:
        for gap in report["gaps"]:
            lines.append(f"- [{gap['severity']}] {gap['item']}")
    else:
        lines.append("- 주요 갭 없음")

    lines.extend([
        "",
        "## 6) Immediate Action Plan",
        "",
    ])
    for action in report["actions"]:
        lines.append(f"- {action}")

    lines.extend([
        "",
        "## 7) Consulting-Grade Quality Gates",
        "",
        f"- 주장-근거 연결(evidence/source_anchor) {int(TARGET_EVIDENCE_COVERAGE * 100)}% 이상",
        "- 레이아웃별 불릿 규칙 준수 (일반 3-6, 시각중심 0-4, no-bullet 0)",
        "- 최신 QA 보고서 오류 0 유지",
        "- Value Case 수치는 시나리오/가정/근거를 슬라이드 노트에 명시",
    ])

    return "\n".join(lines) + "\n"


def analyze_client(client_name: str) -> dict:
    client_dir = CLIENTS_DIR / client_name
    if not client_dir.exists():
        raise FileNotFoundError(f"client not found: {client_name}")

    brief_path = client_dir / "brief.md"
    constraints_path = client_dir / "constraints.md"
    sources_path = client_dir / "sources.md"
    outline_path = client_dir / "deck_outline.md"
    spec_path = client_dir / "deck_spec.yaml"
    outputs_dir = client_dir / "outputs"

    brief = parse_brief(read_text(brief_path))
    sources = parse_sources(read_text(sources_path))
    outline = parse_outline(read_text(outline_path))
    spec = load_yaml(spec_path)
    spec_metrics = collect_spec_metrics(spec) if spec else {}
    spec_validation = run_spec_validation(spec_path, sources_path)
    qa = latest_qa_report(outputs_dir)

    spec_meta = spec.get("client_meta", {}) if spec else {}
    industry = brief.get("industry") or spec_meta.get("industry", "")
    internal_data_text = brief.get("internal_data", "")
    has_internal_data = infer_internal_data_available(internal_data_text)

    modules = build_analysis_modules(industry, has_internal_data)
    readiness = score_readiness(brief, sources, outline, spec_metrics, spec_validation, qa)
    gaps = build_gap_items(client_dir, brief, sources, outline, spec_metrics, spec_validation, qa)
    actions = build_actions(client_name, gaps, has_internal_data)

    report = {
        "client_name": client_name,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "client_dir": str(client_dir),
        "brief": brief,
        "constraints_exists": constraints_path.exists(),
        "sources": sources,
        "outline": outline,
        "spec_meta": spec_meta,
        "spec_metrics": spec_metrics,
        "spec_validation": spec_validation,
        "latest_qa": qa,
        "analysis_modules": modules,
        "readiness": readiness,
        "gaps": gaps,
        "actions": actions,
    }

    return report


def write_reports(report: dict, md_path: Path, json_path: Path):
    md_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.parent.mkdir(parents=True, exist_ok=True)

    md_path.write_text(render_markdown(report), encoding="utf-8")
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="고객사 분석 리포트 생성기")
    parser.add_argument("client_name", help="클라이언트 이름")
    parser.add_argument("--output", help="마크다운 리포트 출력 경로")
    parser.add_argument("--json", dest="json_output", help="JSON 리포트 출력 경로")
    args = parser.parse_args()

    try:
        report = analyze_client(args.client_name)
    except FileNotFoundError as exc:
        print(f"Error: {exc}")
        return 1

    client_dir = Path(report["client_dir"])
    md_path = Path(args.output).resolve() if args.output else (client_dir / "analysis_report.md")
    json_path = Path(args.json_output).resolve() if args.json_output else (client_dir / "analysis_report.json")

    write_reports(report, md_path, json_path)

    readiness = report["readiness"]
    print(f"✓ 분석 리포트 생성: {md_path}")
    print(f"✓ JSON 리포트 생성: {json_path}")
    print(
        f"  - Readiness: {readiness['overall_score']}/100 ({readiness['maturity']}) | "
        f"Spec 오류 {report['spec_validation'].get('errors', 0)} / "
        f"경고 {report['spec_validation'].get('warnings', 0)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
