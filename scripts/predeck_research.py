#!/usr/bin/env python3
"""
predeck_research.py - 덱 생성 전 컨설팅형 리서치 구조화 리포트 생성기

출력:
- research_report.md
- research_report.json

목적:
1) brief/sources를 기반으로 핵심 질문과 이슈트리 구조를 고정
2) 근거 섹션별 커버리지와 데이터 갭을 사전에 점검
3) deck_spec 작성 전에 논리적 골격(파트별 메시지/검증 항목)을 확정
"""

import argparse
import json
import re
import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List

import yaml

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
CLIENTS_DIR = REPO_ROOT / "clients"


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def parse_brief(brief_text: str) -> dict:
    def _extract(pattern: str) -> str:
        match = re.search(pattern, brief_text, flags=re.IGNORECASE | re.MULTILINE)
        return match.group(1).strip() if match else ""

    return {
        "client_name": _extract(r"^- Client name:\s*(.+)$"),
        "industry": _extract(r"^- Industry:\s*(.+)$"),
        "audience": _extract(r"^- Target audience:\s*(.+)$"),
        "objective": _extract(r"^- Primary deliverable:\s*(.+)$"),
        "slide_range": _extract(r"^- Expected slide count range:\s*(.+)$"),
        "duration": _extract(r"^- Presentation duration:\s*(.+)$"),
        "internal_data": _extract(r"^- Internal data available:\s*(.+)$"),
        "q1": _extract(r"^- Q1:\s*(.+)$"),
        "q2": _extract(r"^- Q2:\s*(.+)$"),
        "q3": _extract(r"^- Q3:\s*(.+)$"),
    }


def parse_sources_sections(sources_text: str) -> Dict[str, List[str]]:
    sections: Dict[str, List[str]] = {}
    current = None
    for line in sources_text.splitlines():
        if line.startswith("## "):
            current = line[3:].strip().lower()
            sections[current] = []
            continue
        if current and line.strip().startswith("-"):
            sections[current].append(line.strip())
    return sections


def source_quality_score(sections: Dict[str, List[str]]) -> dict:
    """
    출처 신뢰도 점수 산출 (간단 휴리스틱)
    - 공식기관/기업 IR 링크 비율
    - 섹션 커버리지
    """
    official_domains = (
        "iea.org",
        "treasury.gov",
        "eur-lex.europa.eu",
        "ecopro.co.kr",
        "usgs.gov",
        "poscofuturem.com",
        "umicore.com",
        "lgchem.com",
    )

    total_items = 0
    official_items = 0
    url_items = 0

    for items in sections.values():
        for item in items:
            total_items += 1
            if "http://" in item or "https://" in item:
                url_items += 1
            lowered = item.lower()
            if any(domain in lowered for domain in official_domains):
                official_items += 1

    required = ["market", "client", "competitors", "tech-trends", "policy"]
    required_hit = sum(1 for sec in required if sections.get(sec))

    quality = 0
    if total_items:
        quality += int((official_items / total_items) * 50)
        quality += int((url_items / total_items) * 20)
    quality += int((required_hit / len(required)) * 30)
    quality = min(100, quality)

    return {
        "total_items": total_items,
        "official_items": official_items,
        "url_items": url_items,
        "required_hit": required_hit,
        "score": quality,
    }


def _pdf_sort_key(pdf_path: Path) -> tuple:
    """
    파일명에서 분기 우선순위 추정 (ex: 2025q4 > 2025q3 > 2024q4)
    """
    stem = pdf_path.stem.lower()
    year = 0
    quarter = 0

    m = re.search(r"(20\d{2})\s*[._-]?\s*q([1-4])", stem)
    if m:
        year = int(m.group(1))
        quarter = int(m.group(2))
    else:
        # 25.4Q 형태 대응
        m2 = re.search(r"(\d{2})[._-]?([1-4])q", stem)
        if m2:
            year = 2000 + int(m2.group(1))
            quarter = int(m2.group(2))
    return (year, quarter, stem)


def _is_useful_fact_line(line: str) -> bool:
    """PDF 추출 문장 중 리포트에 실을 만한 라인만 선별"""
    text = (line or "").strip()
    if len(text) < 14 or len(text) > 180:
        return False

    # 제목/잡음 라인 제거
    noisy_tokens = [
        "keywords경영실적참고표",
        "appendixkeywords",
        "financial resultskeywords",
        "future outlookkeywords",
    ]
    lowered = text.lower().replace(" ", "")
    if any(token in lowered for token in noisy_tokens):
        return False

    letters = len(re.findall(r"[A-Za-z가-힣]", text))
    digits = len(re.findall(r"[0-9]", text))
    if letters < 6:
        return False

    key_terms = [
        "매출", "영업이익", "ebitda", "재고", "부채", "차입금",
        "흑자", "적자", "전망", "실적", "수익성", "가동률",
    ]
    has_key = any(term in text.lower() for term in key_terms)

    digit_ratio = digits / max(len(text), 1)
    if digit_ratio > 0.6 and not has_key:
        return False

    return has_key


def extract_financial_snapshot(client_dir: Path) -> List[str]:
    """
    clients/<name>/data/*rev_op*.csv 에서 최근 분기 스냅샷 생성
    """
    data_dir = client_dir / "data"
    if not data_dir.exists():
        return []

    candidates = sorted(data_dir.glob("*rev_op*.csv"), reverse=True)
    if not candidates:
        return []

    path = candidates[0]
    rows = []
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)
    except Exception:
        return []

    if len(rows) < 1:
        return []

    def _to_float(v):
        try:
            return float(str(v).replace(",", "").strip())
        except Exception:
            return 0.0

    latest = rows[-1]
    prev = rows[-2] if len(rows) >= 2 else None
    latest_q = latest.get("quarter", "Latest")
    latest_rev = _to_float(latest.get("revenue"))
    latest_op = _to_float(latest.get("operating_profit"))

    lines = [
        f"{latest_q} 매출 {latest_rev:.3f}조원, 영업이익 {latest_op:.3f}조원 (CSV 기준)",
    ]

    if prev:
        prev_q = prev.get("quarter", "Prev")
        prev_rev = _to_float(prev.get("revenue"))
        prev_op = _to_float(prev.get("operating_profit"))
        if prev_rev:
            rev_qoq = ((latest_rev - prev_rev) / abs(prev_rev)) * 100
            lines.append(f"{latest_q} vs {prev_q} 매출 증감: {rev_qoq:+.1f}%")
        lines.append(f"{prev_q} 영업이익 {prev_op:.3f}조원 -> {latest_q} {latest_op:.3f}조원")

    return lines


def extract_pdf_key_lines(raw_dir: Path, limit: int = 20) -> List[str]:
    if not raw_dir.exists() or not PdfReader:
        return []

    lines: List[str] = []
    patterns = [
        r"매출액",
        r"영업이익",
        r"EBITDA",
        r"부채비율",
        r"재고자산",
        r"QoQ",
        r"YoY",
        r"capacity|capa|톤|TWh|%",
    ]
    compiled = [re.compile(pat, flags=re.IGNORECASE) for pat in patterns]

    pdf_paths = sorted(raw_dir.glob("*.pdf"), key=_pdf_sort_key, reverse=True)
    for pdf_path in pdf_paths:
        try:
            reader = PdfReader(str(pdf_path))
        except Exception:
            continue

        page_count = min(len(reader.pages), 20)
        seen_in_file = set()
        collected_in_file = 0
        for i in range(page_count):
            text = reader.pages[i].extract_text() or ""
            for raw_line in text.splitlines():
                line = " ".join(raw_line.split()).strip()
                if len(line) < 12 or not _is_useful_fact_line(line):
                    continue
                if any(p.search(line) for p in compiled):
                    candidate = f"{pdf_path.name}: {line}"
                    # 동일 파일 내 중복/과도한 반복 제거
                    normalized = re.sub(r"\s+", " ", line.lower())
                    if normalized not in seen_in_file and candidate not in lines:
                        lines.append(candidate)
                        seen_in_file.add(normalized)
                        collected_in_file += 1
                if collected_in_file >= 8:
                    break
                if len(lines) >= limit:
                    return lines
            if collected_in_file >= 8:
                break
    return lines


def infer_issue_tree(brief: dict, sections: Dict[str, List[str]]) -> List[dict]:
    # 컨설팅형 기본 이슈트리 골격
    root = "에코프로의 중장기 성장성과 수익성을 동시에 높이기 위한 최적 전략은 무엇인가?"
    if brief.get("q1"):
        root = brief["q1"]

    return [
        {
            "branch": "A. 시장/정책 적합성",
            "key_questions": [
                "배터리 수요 성장률과 화학조성 전환(LFP/High-Ni)의 방향성은?",
                "IRA/EU 규제가 제품/거점/원료 전략에 주는 제약은?"
            ],
            "evidence_anchor": "market / policy",
        },
        {
            "branch": "B. 사업 포트폴리오 경쟁력",
            "key_questions": [
                "고니켈/미드니켈/LFP/전구체 포트폴리오 균형은 적정한가?",
                "고객/지역/제품 믹스가 수익성 복원에 충분한가?"
            ],
            "evidence_anchor": "client / tech-trends",
        },
        {
            "branch": "C. 재무·운영 실행력",
            "key_questions": [
                "CAPA/재고/원가/환율 민감도 관리는 체계적인가?",
                "투자 우선순위와 실행 거버넌스가 명확한가?"
            ],
            "evidence_anchor": "client / competitors",
        },
    ]


def build_report(
    client_name: str,
    brief: dict,
    sections: Dict[str, List[str]],
    pdf_lines: List[str],
    financial_snapshot: List[str],
) -> dict:
    key_questions = [q for q in [brief.get("q1"), brief.get("q2"), brief.get("q3")] if q]
    issue_tree = infer_issue_tree(brief, sections)
    quality = source_quality_score(sections)

    source_counts = {sec: len(items) for sec, items in sections.items()}
    required = ["market", "client", "competitors", "tech-trends"]
    missing_required = [sec for sec in required if source_counts.get(sec, 0) == 0]

    coverage_score = min(100, int(
        min(sum(source_counts.values()) * 2.5, 40)
        + (len(required) - len(missing_required)) * 8
        + min(len(pdf_lines), 20)
        + (quality.get("score", 0) * 0.24)
    ))

    evidence_map = [
        {"section": sec, "checked_sources": cnt, "anchor": f"sources.md#{sec}"}
        for sec, cnt in sorted(source_counts.items())
    ]

    hypotheses = [
        {
            "name": "H1 공격 시나리오",
            "thesis": "Hi-Ni 리더십 유지 + LFP/HVM 조기확장 + 인니 원료축 고도화 시 수익성 동시 개선 가능",
            "required_evidence": "제품별 공헌이익, CAPA 가동률, 고객별 수요 확정치",
            "risk": "메탈 가격 재하락 시 재고/스프레드 동시 악화",
        },
        {
            "name": "H2 방어 시나리오",
            "thesis": "변동성 확대 국면에서 CAPEX 절제와 재고 방어가 우선이며 성장 투자 속도는 후행",
            "required_evidence": "현금흐름 민감도, 차입구조, 공급계약 안정성",
            "risk": "시장 회복 구간에서 점유율 선점 기회 상실",
        },
        {
            "name": "H3 균형 시나리오",
            "thesis": "정책·수요 신호 기반의 단계투자와 포트폴리오 믹스 최적화가 성공확률이 가장 높음",
            "required_evidence": "정책 트리거 지표, 파이프라인 전환율, 제품별 램프업 리드타임",
            "risk": "의사결정 지연 시 실행 타이밍 손실",
        },
    ]

    report = {
        "client_name": client_name,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "brief_summary": {
            "industry": brief.get("industry", ""),
            "audience": brief.get("audience", ""),
            "objective": brief.get("objective", ""),
            "slide_range": brief.get("slide_range", ""),
            "duration": brief.get("duration", ""),
            "internal_data": brief.get("internal_data", ""),
        },
        "key_questions": key_questions,
        "issue_tree": issue_tree,
        "evidence_map": evidence_map,
        "financial_snapshot": financial_snapshot,
        "pdf_fact_lines": pdf_lines,
        "hypotheses": hypotheses,
        "source_quality": quality,
        "quality": {
            "coverage_score": coverage_score,
            "missing_required_sections": missing_required,
            "recommended_actions": [
                "핵심 주장마다 sources.md 앵커를 1개 이상 연결",
                "재무 슬라이드에는 QoQ/YoY/재고/차입금 지표를 분리 표기",
                "시장 슬라이드에는 수요·공급·정책 3축을 분리해 메시지 작성",
                "덱 작성 전 섹션별 반증 가설(리스크 시나리오) 1개 이상 확보",
                "최신 분기 IR 수치와 deck CSV/슬라이드 문구 간 일치 여부를 렌더 직전 재검증",
            ],
        },
    }
    return report


def render_markdown(report: dict) -> str:
    b = report["brief_summary"]
    q = report["quality"]
    sq = report.get("source_quality", {})
    lines = [
        f"# Pre-Deck Research Report: {report['client_name']}",
        "",
        f"- Generated at: {report['generated_at']}",
        f"- Industry: {b.get('industry') or 'N/A'}",
        f"- Audience: {b.get('audience') or 'N/A'}",
        f"- Objective: {b.get('objective') or 'N/A'}",
        f"- Data availability: {b.get('internal_data') or 'N/A'}",
        "",
        "## 1) Executive Mandate",
        "",
        f"- Slide range target: {b.get('slide_range') or 'N/A'}",
        f"- Presentation duration: {b.get('duration') or 'N/A'}",
        "",
        "## 2) Key Questions",
        "",
    ]

    if report["key_questions"]:
        for item in report["key_questions"]:
            lines.append(f"- {item}")
    else:
        lines.append("- 핵심 질문이 brief에 충분히 정의되지 않았습니다. (Q1~Q3 보강 필요)")

    lines.extend([
        "",
        "## 3) Source Reliability Snapshot",
        "",
        f"- Source quality score: **{sq.get('score', 0)}/100**",
        f"- Total listed sources: {sq.get('total_items', 0)}",
        f"- Official domain sources: {sq.get('official_items', 0)}",
        f"- URL-explicit sources: {sq.get('url_items', 0)}",
        f"- Required section coverage: {sq.get('required_hit', 0)}/5",
        "",
        "## 4) Consulting Issue Tree",
        "",
    ])
    for branch in report["issue_tree"]:
        lines.append(f"### {branch['branch']}")
        for qq in branch["key_questions"]:
            lines.append(f"- {qq}")
        lines.append(f"- Evidence anchor: {branch['evidence_anchor']}")
        lines.append("")

    lines.extend([
        "## 5) Competing Hypotheses",
        "",
        "| Hypothesis | Thesis | Required evidence | Key risk |",
        "|---|---|---|---|",
    ])
    for row in report.get("hypotheses", []):
        lines.append(
            f"| {row.get('name', '')} | {row.get('thesis', '')} | {row.get('required_evidence', '')} | {row.get('risk', '')} |"
        )

    lines.extend([
        "",
        "## 6) Evidence Map",
        "",
        "| Section | Checked Sources | Anchor |",
        "|---|---:|---|",
    ])
    for row in report["evidence_map"]:
        lines.append(f"| {row['section']} | {row['checked_sources']} | `{row['anchor']}` |")

    lines.extend([
        "",
        "## 7) Financial/Operational Fact Lines (from IR PDFs)",
        "",
    ])
    if report.get("financial_snapshot"):
        lines.append("### Curated Financial Snapshot")
        lines.append("")
        for line in report["financial_snapshot"]:
            lines.append(f"- {line}")
        lines.append("")
        lines.append("### Extracted Fact Lines")
        lines.append("")

    if report["pdf_fact_lines"]:
        for fact in report["pdf_fact_lines"]:
            lines.append(f"- {fact}")
    else:
        lines.append("- 추출된 IR 핵심 팩트가 없습니다. `research/raw/*.pdf` 점검 필요")

    lines.extend([
        "",
        "## 8) Research Quality Gate",
        "",
        f"- Coverage score: **{q['coverage_score']}/100**",
        f"- Missing required sections: {', '.join(q['missing_required_sections']) if q['missing_required_sections'] else 'None'}",
        "",
        "### Recommended Actions Before Deck",
        "",
    ])
    for action in q["recommended_actions"]:
        lines.append(f"- {action}")

    lines.extend([
        "",
        "## 9) Recommended Slide Architecture (30p 기준)",
        "",
        "- Section A (1~8p): 시장/정책 변화와 수요 구조",
        "- Section B (9~18p): 회사 진단 및 경쟁력 분해",
        "- Section C (19~25p): 전략 옵션과 가치검증",
        "- Section D (26~30p): 실행 로드맵, 거버넌스, 리스크 대응",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="덱 생성 전 컨설팅형 리서치 리포트 생성")
    parser.add_argument("client_name", help="클라이언트 이름")
    parser.add_argument("--output", "-o", help="Markdown 출력 경로")
    parser.add_argument("--json", dest="json_output", help="JSON 출력 경로")
    args = parser.parse_args()

    client_dir = CLIENTS_DIR / args.client_name
    if not client_dir.exists():
        print(f"Error: client not found: {client_dir}")
        return 1

    brief_path = client_dir / "brief.md"
    sources_path = client_dir / "sources.md"
    raw_dir = client_dir / "research" / "raw"

    brief = parse_brief(read_text(brief_path))
    sections = parse_sources_sections(read_text(sources_path))
    pdf_lines = extract_pdf_key_lines(raw_dir, limit=25)
    financial_snapshot = extract_financial_snapshot(client_dir)

    report = build_report(args.client_name, brief, sections, pdf_lines, financial_snapshot)
    md = render_markdown(report)

    output_path = Path(args.output).resolve() if args.output else (client_dir / "research_report.md")
    json_path = Path(args.json_output).resolve() if args.json_output else (client_dir / "research_report.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.parent.mkdir(parents=True, exist_ok=True)

    output_path.write_text(md + "\n", encoding="utf-8")
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"✓ predeck report: {output_path}")
    print(f"✓ predeck json: {json_path}")
    print(f"  - coverage score: {report['quality']['coverage_score']}/100")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
