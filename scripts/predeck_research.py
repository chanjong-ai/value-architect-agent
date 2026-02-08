#!/usr/bin/env python3
"""
predeck_research.py - 덱 생성 전 심화 리서치/페이지 블루프린트 생성기

출력:
- research_report.md / research_report.json
- layout_blueprint.md / layout_blueprint.yaml
- layout_preferences.research.yaml (레이아웃 선호 자동 생성)

핵심 목적:
1) 최신성/신뢰도를 고려한 웹+내부 소스 리서치
2) 슬라이드별 상세 레이아웃/콘텐츠 밀도 설계
3) 설계 결과를 deck_spec에 선택 반영해 최종 PPT 품질 향상
"""

import argparse
import csv
import html
import json
import re
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote_plus, urlparse
from urllib.request import Request, urlopen

import yaml

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
CLIENTS_DIR = REPO_ROOT / "clients"

DEFAULT_PAGE_COUNT = 30
DEFAULT_WEB_LIMIT = 48

TRUSTED_DOMAIN_SCORES = {
    # Global regulators / public institutions
    "iea.org": 95,
    "oecd.org": 92,
    "imf.org": 92,
    "worldbank.org": 92,
    "usgs.gov": 93,
    "energy.gov": 92,
    "treasury.gov": 93,
    "europa.eu": 92,
    "eur-lex.europa.eu": 95,
    "ec.europa.eu": 92,
    "kostat.go.kr": 92,
    "fss.or.kr": 92,
    "dart.fss.or.kr": 96,
    # Exchanges / filings
    "sec.gov": 96,
    "krx.co.kr": 94,
    # Large financial media / wire
    "reuters.com": 86,
    "bloomberg.com": 86,
    "wsj.com": 84,
    "ft.com": 84,
    "nikkei.com": 82,
    # Korean mainstream business media
    "hankyung.com": 76,
    "mk.co.kr": 76,
    "sedaily.com": 74,
    "chosun.com": 72,
    "joins.com": 72,
    # Company IR / official
    "ecopro.co.kr": 94,
    "poscofuturem.com": 94,
    "lgchem.com": 94,
    "umicore.com": 94,
    "samsung.com": 94,
    "sap.com": 94,
}

TRUSTED_SOURCE_NAME_SCORES = {
    "reuters": 86,
    "bloomberg": 86,
    "financial times": 84,
    "wall street journal": 84,
    "korea herald": 74,
    "korea times": 74,
    "yonhap": 80,
    "매일경제": 74,
    "한국경제": 74,
    "조선일보": 72,
    "아시아경제": 70,
}

SECTION_KEYWORDS = {
    "market": ["market", "demand", "outlook", "수요", "시장", "성장", "판매"],
    "policy": ["policy", "regulation", "ira", "eu", "규제", "정책", "보조금", "관세"],
    "client": ["earnings", "guidance", "실적", "수익", "가이던스", "ecopro", "포스코", "sap"],
    "competitors": ["peer", "benchmark", "competitor", "경쟁", "점유율", "CATL", "BYD", "LG"],
    "tech-trends": ["technology", "ai", "automation", "lfp", "high-nickel", "semiconductor", "플랫폼"],
    "finance": ["ebitda", "cash flow", "margin", "capex", "재무", "부채", "차입", "영업이익"],
}

LAYOUT_SEQUENCE_30 = [
    "cover",
    "exec_summary",
    "section_divider",
    "chart_focus",
    "chart_focus",
    "comparison",
    "content",
    "content",
    "section_divider",
    "three_column",
    "chart_focus",
    "content",
    "three_column",
    "image_focus",
    "content",
    "comparison",
    "process_flow",
    "content",
    "section_divider",
    "three_column",
    "comparison",
    "chart_focus",
    "chart_focus",
    "content",
    "process_flow",
    "section_divider",
    "timeline",
    "process_flow",
    "content",
    "thank_you",
]


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_yaml(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False)


def slugify(text: str) -> str:
    value = re.sub(r"[^\w\s-]", "", (text or "").strip().lower())
    return re.sub(r"[\s]+", "-", value)


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def safe_int(value, default: int) -> int:
    try:
        return int(str(value).strip())
    except Exception:
        return default


def normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def truncate(text: str, limit: int) -> str:
    value = normalize_ws(text)
    if len(value) <= limit:
        return value
    return value[: max(1, limit - 1)].rstrip() + "…"


def parse_brief(brief_text: str) -> dict:
    def _extract(pattern: str) -> str:
        m = re.search(pattern, brief_text, flags=re.IGNORECASE | re.MULTILINE)
        return normalize_ws(m.group(1)) if m else ""

    questions = re.findall(r"^-\s*Q\d+\s*:\s*(.+)$", brief_text, flags=re.IGNORECASE | re.MULTILINE)

    return {
        "client_name": _extract(r"^-\s*Client name:\s*(.+)$"),
        "industry": _extract(r"^-\s*Industry:\s*(.+)$"),
        "region": _extract(r"^-\s*Region\s*/\s*Operating scope:\s*(.+)$"),
        "audience": _extract(r"^-\s*Target audience:\s*(.+)$"),
        "objective": _extract(r"^-\s*Primary deliverable:\s*(.+)$"),
        "slide_range": _extract(r"^-\s*Expected slide count range:\s*(.+)$"),
        "duration": _extract(r"^-\s*Presentation duration:\s*(.+)$"),
        "internal_data": _extract(r"^-\s*Internal data available\?\s*\(Yes/No\):\s*(.+)$"),
        "language": _extract(r"^-\s*Language\s*\(Korean/English\):\s*(.+)$"),
        "questions": [normalize_ws(q) for q in questions if normalize_ws(q)],
    }


def parse_sources_sections(sources_text: str) -> Dict[str, List[str]]:
    sections: Dict[str, List[str]] = defaultdict(list)
    current = ""
    for raw in sources_text.splitlines():
        line = raw.rstrip("\n")
        if line.strip().startswith("## "):
            current = slugify(line.strip()[3:])
            continue
        if not current:
            continue
        if line.strip().startswith("-"):
            sections[current].append(line.strip())
    return dict(sections)


def parse_source_anchors(sources_text: str) -> List[str]:
    anchors: List[str] = []
    for raw in sources_text.splitlines():
        line = raw.strip()
        if not line.startswith("## "):
            continue
        heading = line[3:].strip()
        if not heading:
            continue
        anchor = f"sources.md#{slugify(heading)}"
        if anchor not in anchors:
            anchors.append(anchor)
    return anchors


def resolve_anchor_by_role(anchors: List[str], role: str) -> str:
    if not anchors:
        return ""

    role_keywords = {
        "market": ["market", "industry", "outlook", "trend", "시장", "동향", "수요", "산업"],
        "client": ["client", "company", "context", "기업", "내부", "현황", "실적", "포스코", "에코프로"],
        "policy": ["policy", "regulation", "ira", "eu", "법", "규제", "정책"],
        "competitors": ["competitor", "peer", "benchmark", "경쟁"],
        "tech-trends": ["tech", "technology", "ai", "cloud", "기술"],
        "finance": ["finance", "financial", "cash", "margin", "재무"],
    }
    keywords = role_keywords.get(role, [])
    if keywords:
        for anchor in anchors:
            low = anchor.lower()
            if any(k in low for k in keywords):
                return anchor

    return anchors[0]


def extract_urls_from_sources(sections: Dict[str, List[str]]) -> List[dict]:
    result: List[dict] = []
    url_re = re.compile(r"https?://[^\s)>]+")
    for section, lines in sections.items():
        for line in lines:
            for url in url_re.findall(line):
                cleaned = url.rstrip(".,);")
                result.append({
                    "section": section,
                    "url": cleaned,
                    "label": truncate(line.replace(cleaned, "").replace("-", ""), 120),
                })
    seen = set()
    deduped = []
    for item in result:
        key = item["url"]
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def domain_of(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().replace("www.", "")
    except Exception:
        return ""


def domain_trust_score(domain: str) -> int:
    if not domain:
        return 45

    for known, score in TRUSTED_DOMAIN_SCORES.items():
        if domain == known or domain.endswith("." + known):
            return score

    if domain.endswith(".gov"):
        return 90
    if domain.endswith(".edu"):
        return 86
    if domain.endswith(".org"):
        return 70
    if domain.endswith(".co.kr"):
        return 64
    return 55


def source_name_trust_score(source_name: str) -> int:
    s = normalize_ws(source_name).lower()
    if not s:
        return 0
    for key, score in TRUSTED_SOURCE_NAME_SCORES.items():
        if key in s:
            return score
    return 0


def trust_tier(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    return "D"


def parse_date(value: str) -> Optional[datetime]:
    v = normalize_ws(value)
    if not v:
        return None

    for fmt in ("%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d", "%Y-%m", "%Y.%m"):
        try:
            dt = datetime.strptime(v, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            pass

    try:
        dt = parsedate_to_datetime(v)
        if dt and dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def freshness_score(published_at: Optional[datetime]) -> int:
    if not published_at:
        return 45
    age_days = max(0, int((utc_now() - published_at.astimezone(timezone.utc)).days))
    if age_days <= 7:
        return 98
    if age_days <= 30:
        return 92
    if age_days <= 90:
        return 82
    if age_days <= 180:
        return 72
    if age_days <= 365:
        return 64
    if age_days <= 730:
        return 56
    return 42


def infer_section(text: str, section_hint: str = "") -> str:
    hint = slugify(section_hint)
    if hint in {"market", "client", "competitors", "tech-trends", "policy", "finance"}:
        return hint

    lowered = normalize_ws(text).lower()
    for section, keys in SECTION_KEYWORDS.items():
        if any(key.lower() in lowered for key in keys):
            return section
    return "client"


def strip_html(raw_html: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", raw_html, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return normalize_ws(text)


def extract_html_title_desc(raw_html: str) -> Tuple[str, str, Optional[datetime]]:
    title = ""
    desc = ""
    pub_date = None

    m_title = re.search(r"<title[^>]*>([\s\S]*?)</title>", raw_html, flags=re.IGNORECASE)
    if m_title:
        title = truncate(strip_html(m_title.group(1)), 220)

    m_desc = re.search(
        r"<meta[^>]+(?:name|property)=[\"'](?:description|og:description)[\"'][^>]+content=[\"']([\s\S]*?)[\"'][^>]*>",
        raw_html,
        flags=re.IGNORECASE,
    )
    if m_desc:
        desc = truncate(strip_html(m_desc.group(1)), 420)

    date_patterns = [
        r"<meta[^>]+(?:name|property)=[\"'](?:article:published_time|publish-date|date|dc.date)[\"'][^>]+content=[\"']([\s\S]*?)[\"'][^>]*>",
        r"\"datePublished\"\s*:\s*\"([^\"]+)\"",
    ]
    for pat in date_patterns:
        m = re.search(pat, raw_html, flags=re.IGNORECASE)
        if not m:
            continue
        parsed = parse_date(m.group(1))
        if parsed:
            pub_date = parsed
            break

    return title, desc, pub_date


def safe_fetch_url(url: str, timeout_sec: int = 10) -> str:
    try:
        req = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; ValueArchitectResearchBot/1.0)",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )
        with urlopen(req, timeout=timeout_sec) as resp:
            data = resp.read()
            return data.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def fetch_google_news_rss(query: str, max_items: int = 8, hl: str = "en-US", gl: str = "US") -> List[dict]:
    rss_url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl={hl}&gl={gl}&ceid={gl}:{hl.split('-')[0]}"
    xml_text = safe_fetch_url(rss_url, timeout_sec=12)
    if not xml_text.strip():
        return []

    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return []

    items: List[dict] = []
    for node in root.findall(".//item"):
        title = normalize_ws(node.findtext("title", default=""))
        link = normalize_ws(node.findtext("link", default=""))
        description = normalize_ws(strip_html(node.findtext("description", default="")))
        pub_date_raw = normalize_ws(node.findtext("pubDate", default=""))
        source_node = node.find("source")
        source_name = normalize_ws(source_node.text if source_node is not None and source_node.text else "")

        if not title or not link:
            continue

        published = parse_date(pub_date_raw)
        domain = domain_of(link)

        items.append({
            "title": truncate(title, 220),
            "url": link,
            "summary": truncate(description, 420),
            "published_at": published,
            "published_raw": pub_date_raw,
            "domain": domain,
            "source_name": source_name,
            "source_kind": "news_rss",
            "query": query,
        })

        if len(items) >= max_items:
            break

    return items


def fetch_source_url_metadata(url_entry: dict) -> Optional[dict]:
    url = url_entry.get("url", "")
    if not url:
        return None

    raw_html = safe_fetch_url(url, timeout_sec=12)
    if not raw_html:
        return None

    title, desc, pub_date = extract_html_title_desc(raw_html)
    text_blob = strip_html(raw_html)

    if not title:
        title = truncate(url, 180)

    if not desc:
        # 본문 앞부분을 보조 요약으로 사용
        desc = truncate(text_blob[:800], 320)

    domain = domain_of(url)

    return {
        "title": title,
        "url": url,
        "summary": desc,
        "published_at": pub_date,
        "published_raw": pub_date.strftime("%Y-%m-%d") if pub_date else "",
        "domain": domain,
        "source_name": domain,
        "source_kind": "listed_source",
        "query": "",
        "section_hint": url_entry.get("section", ""),
    }


def topical_score(item: dict, client_name: str, industry: str, topic: str, key_questions: List[str]) -> int:
    corpus = " ".join([
        item.get("title", ""),
        item.get("summary", ""),
        item.get("source_name", ""),
    ]).lower()

    score = 45
    for token in [client_name, industry, topic]:
        tok = normalize_ws(token).lower()
        if tok and tok in corpus:
            score += 12

    for q in key_questions[:5]:
        for term in re.findall(r"[A-Za-z가-힣0-9]{3,}", q.lower()):
            if term in corpus:
                score += 2

    return min(score, 98)


def evaluate_evidence(item: dict, client_name: str, industry: str, topic: str, key_questions: List[str]) -> dict:
    trust = domain_trust_score(item.get("domain", ""))
    trust = max(trust, source_name_trust_score(item.get("source_name", "")))
    freshness = freshness_score(item.get("published_at"))
    topical = topical_score(item, client_name, industry, topic, key_questions)
    score = int(round((trust * 0.52) + (freshness * 0.28) + (topical * 0.20)))

    merged_text = " ".join([item.get("title", ""), item.get("summary", "")])
    section = infer_section(merged_text, section_hint=item.get("section_hint", ""))

    enriched = dict(item)
    enriched.update({
        "trust_score": trust,
        "freshness_score": freshness,
        "topical_score": topical,
        "evidence_score": score,
        "trust_tier": trust_tier(trust),
        "section": section,
    })
    return enriched


def collect_web_evidence(
    client_name: str,
    industry: str,
    topic: str,
    key_questions: List[str],
    source_urls: List[dict],
    use_web: bool,
    max_web_sources: int,
) -> List[dict]:
    candidates: List[dict] = []

    # 1) sources.md에 명시된 URL 우선 수집
    for entry in source_urls:
        metadata = fetch_source_url_metadata(entry)
        if metadata:
            candidates.append(metadata)

    # 2) 최신 뉴스 RSS 보강
    if use_web:
        query_pool: List[str] = []
        query_pool.extend([q for q in key_questions if q])

        if topic:
            query_pool.extend([
                f"{client_name} {topic}",
                f"{industry} {topic}",
            ])

        query_pool.extend([
            f"{client_name} latest earnings",
            f"{client_name} strategy 2026",
            f"{industry} market outlook 2026",
            f"{industry} policy regulation 2026",
            f"{industry} competitor benchmark",
        ])

        seen_query = set()
        final_queries: List[str] = []
        for q in query_pool:
            sq = normalize_ws(q)
            if not sq or sq.lower() in seen_query:
                continue
            seen_query.add(sq.lower())
            final_queries.append(sq)

        per_query = max(4, min(9, max_web_sources // max(1, len(final_queries)) + 2))
        for query in final_queries[:8]:
            candidates.extend(fetch_google_news_rss(query, max_items=per_query))

    # 3) 중복 제거 + 점수화
    deduped: Dict[str, dict] = {}
    for item in candidates:
        url = normalize_ws(item.get("url", ""))
        if not url:
            continue
        key = url
        current = deduped.get(key)
        if current is None:
            deduped[key] = item
            continue
        # 더 정보가 풍부한 항목 유지
        if len(item.get("summary", "")) > len(current.get("summary", "")):
            deduped[key] = item

    scored = [
        evaluate_evidence(item, client_name=client_name, industry=industry, topic=topic, key_questions=key_questions)
        for item in deduped.values()
    ]

    scored.sort(
        key=lambda x: (
            x.get("evidence_score", 0),
            x.get("published_at") or datetime(1970, 1, 1, tzinfo=timezone.utc),
        ),
        reverse=True,
    )
    return scored[: max_web_sources]


def extract_financial_snapshot(client_dir: Path) -> List[str]:
    data_dir = client_dir / "data"
    if not data_dir.exists():
        return []

    csv_candidates = sorted(data_dir.glob("*rev_op*.csv"), reverse=True)
    if not csv_candidates:
        return []

    path = csv_candidates[0]
    rows = []
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)
    except Exception:
        return []

    if not rows:
        return []

    def _f(v):
        try:
            return float(str(v).replace(",", "").strip())
        except Exception:
            return 0.0

    latest = rows[-1]
    prev = rows[-2] if len(rows) >= 2 else None

    latest_q = latest.get("quarter", "Latest")
    latest_rev = _f(latest.get("revenue"))
    latest_op = _f(latest.get("operating_profit"))

    facts = [f"{latest_q} 기준 매출 {latest_rev:.3f}조원, 영업이익 {latest_op:.3f}조원 (내부 CSV)"]
    if prev:
        prev_q = prev.get("quarter", "Prev")
        prev_rev = _f(prev.get("revenue"))
        prev_op = _f(prev.get("operating_profit"))
        if abs(prev_rev) > 0:
            qoq = ((latest_rev - prev_rev) / abs(prev_rev)) * 100
            facts.append(f"매출 QoQ {qoq:+.1f}% ({prev_q} → {latest_q})")
        facts.append(f"영업이익 {prev_q} {prev_op:.3f}조원 → {latest_q} {latest_op:.3f}조원")

    return facts


def _pdf_sort_key(pdf_path: Path) -> tuple:
    stem = pdf_path.stem.lower()
    year = 0
    quarter = 0

    m = re.search(r"(20\d{2})\s*[._-]?\s*q([1-4])", stem)
    if m:
        year = int(m.group(1))
        quarter = int(m.group(2))
    else:
        m2 = re.search(r"(\d{2})[._-]?([1-4])q", stem)
        if m2:
            year = 2000 + int(m2.group(1))
            quarter = int(m2.group(2))

    return (year, quarter, stem)


def extract_pdf_key_lines(raw_dir: Path, limit: int = 24) -> List[str]:
    if not raw_dir.exists() or not PdfReader:
        return []

    compiled = [
        re.compile(pat, flags=re.IGNORECASE)
        for pat in [
            r"매출", r"영업이익", r"EBITDA", r"마진", r"재고", r"부채", r"CAPEX",
            r"guidance", r"demand", r"capacity", r"가동", r"수율", r"YoY", r"QoQ",
        ]
    ]

    lines: List[str] = []
    for pdf in sorted(raw_dir.glob("*.pdf"), key=_pdf_sort_key, reverse=True):
        try:
            reader = PdfReader(str(pdf))
        except Exception:
            continue

        seen_local = set()
        for page in reader.pages[:20]:
            text = page.extract_text() or ""
            for raw in text.splitlines():
                line = normalize_ws(raw)
                if len(line) < 16 or len(line) > 180:
                    continue
                if not any(p.search(line) for p in compiled):
                    continue
                key = line.lower()
                if key in seen_local:
                    continue
                seen_local.add(key)
                lines.append(f"{pdf.name}: {line}")
                if len(lines) >= limit:
                    return lines

    return lines


def source_quality_score(evidence: List[dict], source_sections: Dict[str, List[str]]) -> dict:
    if not evidence:
        return {
            "score": 0,
            "total_items": 0,
            "avg_trust": 0,
            "avg_freshness": 0,
            "tier_counts": {},
            "required_section_hit": 0,
        }

    avg_trust = round(sum(item.get("trust_score", 0) for item in evidence) / len(evidence), 1)
    avg_freshness = round(sum(item.get("freshness_score", 0) for item in evidence) / len(evidence), 1)
    tier_counter = Counter(item.get("trust_tier", "D") for item in evidence)

    required_sections = ["market", "client", "competitors", "tech-trends", "policy"]
    required_hit = 0
    for sec in required_sections:
        has_section = bool(source_sections.get(sec)) or any(item.get("section") == sec for item in evidence)
        if has_section:
            required_hit += 1

    weighted = min(
        100,
        int((avg_trust * 0.45) + (avg_freshness * 0.25) + ((required_hit / len(required_sections)) * 30)),
    )

    return {
        "score": weighted,
        "total_items": len(evidence),
        "avg_trust": avg_trust,
        "avg_freshness": avg_freshness,
        "tier_counts": dict(tier_counter),
        "required_section_hit": required_hit,
    }


def infer_issue_tree(brief: dict, topic: str) -> List[dict]:
    objective = brief.get("objective") or "성장성과 수익성을 동시에 높이는 전략"
    topic_line = topic or objective

    return [
        {
            "branch": "A. 시장/정책 구조",
            "focus": "수요 성장성, 정책 규제, 글로벌 공급망 변화",
            "key_questions": [
                f"{topic_line}의 외부 성장 가정은 향후 3~5년간 유효한가?",
                "정책(IRA/EU/국내 규제) 변화가 제품·거점·원가에 미치는 영향은 무엇인가?",
                "산업 수급 및 기술 전환(LFP/High-Ni/차세대) 속도는 어느 수준인가?",
            ],
            "evidence_anchor": "sources.md#market",
        },
        {
            "branch": "B. 기업 경쟁력 진단",
            "focus": "포트폴리오, 고객구성, 운영체계, 재무탄력성",
            "key_questions": [
                "현재 제품/고객/지역 포트폴리오가 변동성 구간에서 방어 가능한가?",
                "경쟁사 대비 차별점과 구조적 열위는 무엇이며 얼마나 빠르게 보완 가능한가?",
                "실적 변동의 핵심 드라이버(가격·물량·수율·재고·환율)는 무엇인가?",
            ],
            "evidence_anchor": "sources.md#client",
        },
        {
            "branch": "C. 전략 옵션/실행력",
            "focus": "옵션 우선순위, 가치 검증, 실행 거버넌스",
            "key_questions": [
                "어떤 전략 옵션 조합이 성장성과 수익성의 동시 달성 확률을 높이는가?",
                "CAPEX·운영개선·조직변화의 단계별 우선순위는 무엇인가?",
                "실행 실패를 줄이기 위한 KPI/거버넌스/리스크 통제는 어떻게 설계할 것인가?",
            ],
            "evidence_anchor": "sources.md#policy",
        },
    ]


def build_competing_hypotheses(client_name: str, topic: str) -> List[dict]:
    target = topic or f"{client_name} 중장기 전략"
    return [
        {
            "name": "H1 공격 시나리오",
            "thesis": f"{target}에서 성장 투자(제품/거점)를 선제 확대하면 시장점유율과 장기 수익성 동시 개선 가능",
            "required_evidence": "수요 확정 물량, 고객 계약 강도, 신규 CAPA 램프업 리드타임",
            "risk": "정책/수요 반전 시 고정비 부담 확대",
        },
        {
            "name": "H2 방어 시나리오",
            "thesis": "투자 속도를 낮추고 현금흐름/재고/원가 통제를 우선하면 하방 리스크 방어에 유리",
            "required_evidence": "현금흐름 민감도, 차입 만기구조, 재고회전/가동률",
            "risk": "회복 구간에서 성장 기회 상실",
        },
        {
            "name": "H3 균형 시나리오",
            "thesis": "핵심 성장 축은 유지하되 KPI 게이트 기반 단계투자로 자본 효율성과 민첩성을 동시에 확보",
            "required_evidence": "KPI 트리거 정의, 투자 게이트 기준, 운영개선의 정량 효과",
            "risk": "의사결정 지연 시 실행 타이밍 손실",
        },
    ]


def make_fact_bank(evidence: List[dict], financial_snapshot: List[str], pdf_lines: List[str], limit: int = 36) -> List[dict]:
    facts: List[dict] = []

    for line in financial_snapshot:
        facts.append({
            "fact": line,
            "section": "finance",
            "source": "internal_csv",
            "confidence": "high",
        })

    for line in pdf_lines[:10]:
        facts.append({
            "fact": truncate(line, 240),
            "section": "finance",
            "source": "research/raw PDF",
            "confidence": "medium",
        })

    for item in evidence[: max(0, limit - len(facts))]:
        fact = item.get("title", "")
        summary = item.get("summary", "")
        if summary:
            fact = f"{truncate(fact, 120)} — {truncate(summary, 130)}"
        facts.append({
            "fact": truncate(fact, 260),
            "section": item.get("section", "client"),
            "source": item.get("domain", "web"),
            "confidence": "high" if item.get("trust_score", 0) >= 85 else "medium",
        })

    return facts[:limit]


def section_insights_from_evidence(evidence: List[dict], min_items: int = 3) -> Dict[str, List[str]]:
    grouped: Dict[str, List[dict]] = defaultdict(list)
    for item in evidence:
        grouped[item.get("section", "client")].append(item)

    insights: Dict[str, List[str]] = {}
    for section, items in grouped.items():
        items_sorted = sorted(items, key=lambda x: x.get("evidence_score", 0), reverse=True)
        lines = []
        for it in items_sorted[:max(min_items, 4)]:
            base = it.get("title", "")
            summary = it.get("summary", "")
            if summary:
                lines.append(truncate(f"{base}: {summary}", 220))
            else:
                lines.append(truncate(base, 220))
        insights[section] = lines[:6]
    return insights


def parse_slide_range(range_text: str) -> Tuple[int, int]:
    m = re.search(r"(\d+)\s*[-~]\s*(\d+)", range_text or "")
    if not m:
        return (0, 0)
    return (int(m.group(1)), int(m.group(2)))


def select_layout_sequence(pages: int) -> List[str]:
    if pages <= len(LAYOUT_SEQUENCE_30):
        seq = LAYOUT_SEQUENCE_30[:pages]
        if seq:
            seq[0] = "cover"
            seq[-1] = "thank_you"
        return seq

    sequence = list(LAYOUT_SEQUENCE_30)
    while len(sequence) < pages:
        sequence.insert(-1, "content")
    sequence[0] = "cover"
    sequence[-1] = "thank_you"
    return sequence


def layout_recipe(layout: str) -> List[str]:
    recipes = {
        "cover": [
            "좌측 상단 로고/브랜드, 중앙 좌측 대제목 2줄, 우측 하단 프레임 문구 배치",
            "제목은 문제정의+가치제안이 동시에 보이도록 구성",
        ],
        "exec_summary": [
            "핵심 결론 5~7개를 우선순위 순으로 나열",
            "각 불릿에 숫자/근거 출처를 포함하고 실행 시사점을 문장으로 연결",
            "하단에는 100일 실행항목 2개 이상을 콜아웃으로 배치",
        ],
        "section_divider": [
            "섹션 명칭 + 섹션에서 답해야 할 핵심 질문 1문장",
            "전환 슬라이드이므로 시각 요소는 절제하되 톤 차이를 분명히 설정",
        ],
        "content": [
            "상단 제목/거버닝 메시지 이후 본문 2단(불릿+설명 문장) 또는 표+시사점 구성",
            "본문 문장은 축약형이 아닌 보고서형 문장으로 2~3문단 확보",
            "하단 빈 공간은 내러티브 블록 또는 결론 바(bar)로 채움",
        ],
        "comparison": [
            "좌측 As-Is(문제), 우측 To-Be(해결)를 대비시키고 기준 KPI를 명시",
            "문제 카드(회색/점선)와 해결 카드(블루/강조) 대비를 시각적으로 유지",
            "중앙 연결 화살표/그래프를 통해 변화 경로를 보여줌",
        ],
        "three_column": [
            "3축(시장/경쟁/내부역량 또는 전략옵션 A/B/C) 비교",
            "각 컬럼은 제목+핵심 불릿 2~3개+시사점 1문장으로 균형 구성",
        ],
        "chart_focus": [
            "차트는 핵심 축 1~2개만 강조하고 우측 설명 패널로 해석 제공",
            "데이터 포인트에는 출처/기준시점을 명시",
            "하단에 의사결정 인사이트를 긴 문장으로 서술",
        ],
        "image_focus": [
            "지도/네트워크/아키텍처 이미지를 메인 비주얼로 배치",
            "우측/하단 카드에서 기술적 의미와 실행 시사점을 연결",
        ],
        "timeline": [
            "Phase별 목표/KPI/책임조직을 동시에 표기",
            "100일-1년-3년 등 시간축과 의사결정 게이트를 함께 표시",
        ],
        "process_flow": [
            "문제 발생 지점 → 개선 액션 → 기대효과를 단계 흐름으로 시각화",
            "단계별 소유 조직과 KPI를 병기해 실행 가능성 확보",
        ],
        "thank_you": [
            "결론 1문장 + 즉시 의사결정 요청 1문장",
            "다음 액션/워크숍 일정 등 실무 연결 문구 포함",
        ],
    }
    return recipes.get(layout, recipes["content"])


def default_slide_title(client_name: str, topic: str, section: str, slide_no: int) -> str:
    topic_base = topic or f"{client_name} 중장기 전략"

    if slide_no == 1:
        return f"{client_name} {topic_base}"
    if section == "Executive":
        return "Executive Summary: 핵심 결론과 의사결정 포인트"
    if section == "External":
        external_titles = {
            3: "Section A. 시장·정책·기술 전환 시그널",
            4: "시장 수요 및 성장 경로: 최신 업데이트",
            5: "정책/규제 변화가 수익성에 미치는 영향",
            6: "경쟁구도 및 벤치마크 포지션",
            7: "공급망/원재료 리스크 구조",
            8: "외부 환경 종합 시사점",
        }
        return external_titles.get(slide_no, f"외부 환경 분석 {slide_no}")
    if section == "Diagnosis":
        diagnosis_titles = {
            9: "Section B. 현황 진단과 핵심 문제정의",
            10: "사업 포트폴리오 및 수익 구조 진단",
            11: "재무/운영 KPI 트렌드 점검",
            12: "가치사슬 병목과 개선 여지",
            13: "고객/제품/지역 포트폴리오 평가",
            14: "운영 거점·공급망 구조 시각화",
            15: "자회사/사업부 성과 분해",
            16: "경쟁사 대비 강점/열위 비교",
            17: "핵심 진단 요약 및 전략적 함의",
        }
        return diagnosis_titles.get(slide_no, f"현황 진단 {slide_no}")
    if section == "Options":
        option_titles = {
            18: "Section C. 전략 옵션 설계와 가치 검증",
            19: "전략 옵션 포트폴리오(Option A/B/C)",
            20: "옵션 평가 매트릭스(효과 vs 실행난이도)",
            21: "Value Case: 매출 성장 시나리오",
            22: "Value Case: 수익성 회복 시나리오",
            23: "CAPEX·자본배분 우선순위",
            24: "리스크 완화 아키텍처",
            25: "권고안 통합 및 의사결정 포인트",
        }
        return option_titles.get(slide_no, f"전략 옵션 {slide_no}")
    if section == "Execution":
        execution_titles = {
            26: "Section D. 실행 로드맵과 거버넌스",
            27: "First 100 Days 실행계획",
            28: "2026-2030 단계별 실행 로드맵",
            29: "거버넌스/KPI 대시보드 설계",
            30: "결론 및 다음 단계",
        }
        return execution_titles.get(slide_no, f"실행 설계 {slide_no}")

    return f"{topic_base} - Slide {slide_no}"


def section_for_slide(slide_no: int, total_pages: int) -> str:
    if slide_no == 1:
        return "Cover"
    if slide_no == 2:
        return "Executive"
    if 3 <= slide_no <= min(8, total_pages):
        return "External"
    if 9 <= slide_no <= min(17, total_pages):
        return "Diagnosis"
    if 18 <= slide_no <= min(25, total_pages):
        return "Options"
    if slide_no >= 26:
        return "Execution"
    return "Core"


def governing_message_for_slide(section: str, title: str, client_name: str, topic: str) -> str:
    base_topic = topic or "성장·수익성 동시 달성"

    if section == "Cover":
        return f"2026-2030 구간에서 {client_name}의 {base_topic}를 동시에 달성하기 위한 실행 프레임을 제시합니다."
    if section == "Executive":
        return (
            "핵심 결론은 단일 해법이 아니라 시장·운영·재무를 연결한 포트폴리오형 접근이며, "
            "단기 실적 방어와 중장기 경쟁우위 확보를 같은 의사결정 체계로 통합해야 합니다."
        )
    if section == "External":
        return (
            "외부 환경은 수요/정책/기술 축에서 동시에 변화하고 있으므로, 단일 변수 대응이 아닌 "
            "복합 시그널 기반 전략 조정 메커니즘이 필요합니다."
        )
    if section == "Diagnosis":
        return (
            "현재 성과는 구조적 경쟁력과 일시적 요인이 혼재되어 있어, 제품·고객·거점·운영 KPI를 "
            "같은 프레임에서 재분해해야 실질적 개선 우선순위를 도출할 수 있습니다."
        )
    if section == "Options":
        return (
            "전략 옵션은 상호배타가 아니라 조합 설계 대상이며, 옵션별 기대효과·난이도·리스크를 "
            "정량화해 단계적으로 자본과 실행역량을 배분해야 합니다."
        )
    if section == "Execution":
        return (
            "실행 성패는 계획의 화려함이 아니라 거버넌스·데이터·책임체계의 정합성에 달려 있으므로, "
            "분기별 리뷰와 게이트 의사결정을 통해 전략을 지속 보정해야 합니다."
        )

    return f"{title}은(는) {base_topic} 관점에서 실행 우선순위와 성과지표를 함께 정의해야 합니다."


def content_prompts_for_layout(layout: str) -> List[str]:
    prompts = {
        "cover": [
            "대제목 1개 + 부제 1개 + 기간 프레임 1개",
        ],
        "exec_summary": [
            "핵심 결론 6~8개를 문장형 불릿으로 작성 (각 90~180자)",
            "각 결론은 근거 지표(수치/기간/출처)를 1개 이상 포함",
            "우선 실행 과제(100일) 2~3개를 하단 바에 배치",
        ],
        "section_divider": [
            "해당 섹션에서 답할 질문 2개를 서브텍스트로 명시",
        ],
        "content": [
            "본문 불릿 최소 6개 (각 90~180자)",
            "요약 문단 최소 2개 (각 180~320자)",
            "하단 결론 바 1개 (Expected Value 형식)",
        ],
        "comparison": [
            "좌측 문제(As-Is) 3~4개, 우측 해법(To-Be) 3~4개",
            "중앙 연결 메시지 1개(왜 전환해야 하는지)",
            "하단에 KPI 비교 1줄(현재 vs 목표) + 실행 전환 조건 1문장",
        ],
        "three_column": [
            "컬럼당 핵심 메시지 2~3개 + 실행 시사점 1문장",
            "컬럼 하단에는 공통 KPI 또는 리스크 주석을 추가",
        ],
        "chart_focus": [
            "차트 해석 불릿 4~5개 + 내러티브 문단 1~2개",
            "차트 캡션에 기준 연도/단위/출처 명시",
        ],
        "image_focus": [
            "메인 비주얼 해석 불릿 4~5개 + 내러티브 문단 1~2개",
            "이미지 위/옆에 핵심 라벨(노드/흐름/관계) 부여",
        ],
        "timeline": [
            "Phase 3~5개, 각 Phase별 목표/KPI/오너 표기",
            "리스크 게이트와 의사결정 시점을 함께 표기",
        ],
        "process_flow": [
            "Step 4~5개, 단계별 병목/개선/효과를 한 세트로 작성",
            "마지막 단계에 성과지표 및 모니터링 루프 추가",
        ],
        "thank_you": [
            "결론 1문장 + 다음 단계 1문장 + 연락 포인트",
        ],
    }
    return prompts.get(layout, prompts["content"])


def layout_intent_defaults(layout: str) -> dict:
    if layout in {"chart_focus", "image_focus"}:
        return {"emphasis": "balanced", "visual_position": "right", "content_density": "dense"}
    if layout in {"comparison", "three_column", "two_column", "process_flow", "timeline", "content", "exec_summary"}:
        return {"emphasis": "content", "content_density": "dense"}
    return {"emphasis": "content", "content_density": "normal"}


def top_right_tag_for_slide(section: str, slide_no: int) -> str:
    if section == "Executive":
        return "C-Level Decision Summary"
    if section == "External":
        return "Market & Policy Signal"
    if section == "Diagnosis":
        return "Client Diagnostic"
    if section == "Options":
        return "Option & Value Validation"
    if section == "Execution":
        return "Execution Governance"
    if section == "Cover":
        return "Strategic Proposal"
    return f"Slide {slide_no}"


def build_layout_blueprint(
    client_name: str,
    industry: str,
    objective: str,
    topic: str,
    page_count: int,
    evidence: List[dict],
    key_questions: List[str],
) -> dict:
    pages = max(10, min(50, page_count))
    sequence = select_layout_sequence(pages)

    evidence_by_section = defaultdict(list)
    for item in evidence:
        evidence_by_section[item.get("section", "client")].append(item)

    slides: List[dict] = []

    for idx in range(1, pages + 1):
        layout = sequence[idx - 1] if idx - 1 < len(sequence) else "content"
        section = section_for_slide(idx, pages)
        title = default_slide_title(client_name, topic, section, idx)
        governing = governing_message_for_slide(section, title, client_name, topic)

        # 섹션별 증거 타겟 추천
        section_key_map = {
            "External": ["market", "policy", "tech-trends"],
            "Diagnosis": ["client", "finance", "competitors"],
            "Options": ["client", "market", "policy", "finance"],
            "Execution": ["client", "finance", "policy"],
            "Executive": ["market", "client", "finance"],
        }
        evidence_focus = section_key_map.get(section, ["client"])

        evidence_refs = []
        for sec in evidence_focus:
            candidates = evidence_by_section.get(sec, [])
            if candidates:
                evidence_refs.append(candidates[0].get("url", ""))

        slide_item = {
            "slide_no": idx,
            "section": section,
            "layout": layout,
            "title": title,
            "governing_message": truncate(governing, 190),
            "top_right_tag": top_right_tag_for_slide(section, idx),
            "layout_intent": layout_intent_defaults(layout),
            "density_target": {
                "min_body_chars": 700 if layout in {"content", "comparison", "three_column", "two_column", "exec_summary"} else 560,
                "min_paragraphs": 7 if layout in {"content", "comparison", "three_column", "two_column", "exec_summary"} else 5,
                "min_bullets": 6 if layout not in {"cover", "section_divider", "thank_you"} else 0,
            },
            "layout_recipe": layout_recipe(layout),
            "content_prompts": content_prompts_for_layout(layout),
            "evidence_focus": evidence_focus,
            "evidence_refs": [ref for ref in evidence_refs if ref][:3],
            "quality_checks": [
                "제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인",
                "본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움",
                "아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증",
            ],
        }

        slides.append(slide_item)

    design_system = {
        "tone": "Comparison & Solution",
        "keywords": ["Context Preservation", "Knowledge Graph", "Zero-copy"],
        "color_palette": {
            "problem_zone": "Cool Gray / dashed border / low saturation",
            "solution_zone": "SAP Blue #008FD3 + Teal/Green highlight",
            "graph_zone": "Bright node-link network with glow",
        },
        "global_layout": {
            "header": "15% (title + governing)",
            "body": "70% (problem → visual core → solution)",
            "footer": "15% (impact bar + next step)",
            "top_right_caption": "CIO Priority: Data & AI Foundation",
        },
        "typography": {
            "title": "Noto Sans KR 24pt Regular",
            "box_heading": "Noto Sans KR 16pt Regular",
            "body": "Noto Sans KR 12~14pt Regular",
            "caption": "Noto Sans KR 14pt Regular",
        },
        "visual_rules": [
            "좌측 문제 영역은 정적/단절 느낌, 우측 해결 영역은 연결/확장 느낌으로 대비",
            "중앙 그래프는 추상 점이 아니라 비즈니스 객체 노드(고객/오더/납품/청구/수금)로 구성",
            "우측 해결 카드에는 Zero-copy/Data Product/Semantic Onboarding 3요소를 분리 기재",
        ],
        "one_line_directive": "문제(회색)에서 해결(블루 네트워크)로 시선을 이동시켜, 문맥 보존 데이터가 AI 품질을 결정한다는 메시지를 시각적으로 증명한다.",
    }

    return {
        "meta": {
            "client_name": client_name,
            "industry": industry,
            "objective": objective,
            "topic": topic,
            "generated_at": now_iso(),
            "page_count": pages,
            "method": "web_research + evidence_scoring + page_blueprint",
        },
        "design_system": design_system,
        "slides": slides,
        "key_questions": key_questions,
    }


def blueprint_to_layout_preferences(blueprint: dict) -> dict:
    sequence = [s.get("layout", "content") for s in blueprint.get("slides", [])]

    return {
        "meta": {
            "version": "1.1",
            "description": "predeck_research 자동 생성 레이아웃 선호",
            "generated_at": now_iso(),
        },
        "global": {
            "default_layout_intent": {
                "emphasis": "content",
                "content_density": "dense",
            }
        },
        # 자동 파이프라인에서는 과도한 레이아웃 치환을 피하고 intent 중심으로 반영
        "layout_sequence": [],
        "recommended_layout_sequence": sequence,
        "layout_intents": {
            "chart_focus": {"visual_position": "right", "emphasis": "balanced", "content_density": "dense"},
            "image_focus": {"visual_position": "right", "emphasis": "balanced", "content_density": "dense"},
            "comparison": {"emphasis": "content", "content_density": "dense"},
            "content": {"emphasis": "content", "content_density": "dense"},
        },
        "title_keyword_overrides": [],
        "slide_overrides": {},
    }


def _bullet(text: str, anchor: str) -> dict:
    return {
        "text": truncate(text, 176),
        "icon": "insight",
        "emphasis": "normal",
        "evidence": {
            "source_anchor": anchor,
            "confidence": "medium",
        },
    }


def apply_blueprint_to_spec(
    client_dir: Path,
    blueprint: dict,
    force_layout: bool = False,
) -> dict:
    spec_path = client_dir / "deck_spec.yaml"
    if not spec_path.exists():
        return {"updated": 0, "created": 0, "saved": False, "reason": "deck_spec_missing"}

    spec = load_yaml(spec_path)
    slides = spec.get("slides", [])
    bp_slides = blueprint.get("slides", [])

    sources_text = read_text(client_dir / "sources.md")
    source_anchors = parse_source_anchors(sources_text)
    anchor_market = resolve_anchor_by_role(source_anchors, "market")
    anchor_client = resolve_anchor_by_role(source_anchors, "client")
    anchor_policy = resolve_anchor_by_role(source_anchors, "policy")
    anchor_competitors = resolve_anchor_by_role(source_anchors, "competitors")
    default_refs = [a for a in [anchor_market, anchor_client, anchor_policy] if a]

    updated = 0
    created = 0

    # 본문 밀도 상향: global_constraints 기본값 보정
    global_constraints = spec.get("global_constraints", {}) if isinstance(spec.get("global_constraints"), dict) else {}
    if int(global_constraints.get("default_max_bullets", 0) or 0) < 9:
        global_constraints["default_max_bullets"] = 9
    if int(global_constraints.get("default_max_chars_per_bullet", 0) or 0) < 180:
        global_constraints["default_max_chars_per_bullet"] = 180
    spec["global_constraints"] = global_constraints

    if not isinstance(slides, list):
        slides = []

    # 슬라이드가 비어있으면 블루프린트로 스켈레톤 생성
    if not slides:
        new_slides = []
        for item in bp_slides:
            layout = item.get("layout", "content")
            title = item.get("title", "")
            gm = item.get("governing_message", "")
            prompts = item.get("content_prompts", [])

            slide = {
                "layout": layout,
                "title": title,
                "governing_message": gm,
                "layout_intent": item.get("layout_intent", {"content_density": "dense"}),
                "metadata": {
                    "section": item.get("section", ""),
                    "source_refs": default_refs[:2],
                },
            }

            if layout not in {"cover", "section_divider", "thank_you", "quote"}:
                prompt_text = "; ".join(prompts[:2]) if prompts else "핵심 근거 기반 상세 본문 작성"
                slide["bullets"] = [
                    _bullet(f"핵심 주장 1: {prompt_text}", anchor_client or anchor_market or "sources.md#client"),
                    _bullet("핵심 주장 2: 최신 지표와 추세 변화를 근거로 실행 우선순위를 제시합니다.", anchor_market or anchor_client or "sources.md#market"),
                    _bullet("핵심 주장 3: 반증 시나리오와 리스크 완화 액션을 함께 명시합니다.", anchor_policy or anchor_market or "sources.md#policy"),
                    _bullet("핵심 주장 4: KPI와 책임조직을 연결해 실행 가능성을 높입니다.", anchor_client or anchor_market or "sources.md#client"),
                    _bullet("핵심 주장 5: Expected Value를 수치/기간/검증조건으로 명확히 정의합니다.", anchor_competitors or anchor_market or "sources.md#competitors"),
                ]
            new_slides.append(slide)

        spec["slides"] = new_slides
        created = len(new_slides)
        updated = len(new_slides)
    else:
        for idx, slide in enumerate(slides):
            if idx >= len(bp_slides):
                break
            bp = bp_slides[idx]
            changed = False

            if force_layout and slide.get("layout") != bp.get("layout"):
                slide["layout"] = bp.get("layout")
                changed = True

            if not normalize_ws(slide.get("title", "")):
                slide["title"] = bp.get("title", "")
                changed = True

            if len(normalize_ws(slide.get("governing_message", ""))) < 40:
                slide["governing_message"] = bp.get("governing_message", "")
                changed = True

            # layout_intent 병합 (dense 중심)
            li = slide.get("layout_intent", {}) if isinstance(slide.get("layout_intent"), dict) else {}
            default_li = bp.get("layout_intent", {}) if isinstance(bp.get("layout_intent"), dict) else {}
            merged = dict(default_li)
            merged.update(li)
            if merged != li:
                slide["layout_intent"] = merged
                changed = True

            sc = slide.get("slide_constraints", {}) if isinstance(slide.get("slide_constraints"), dict) else {}
            layout_name = str(slide.get("layout", "")).strip().lower()

            # no-bullet 레이아웃은 기존 불릿 잔재를 제거해 경고 누적을 방지
            if layout_name in {"cover", "section_divider", "thank_you", "quote"}:
                if isinstance(slide.get("bullets"), list) and slide.get("bullets"):
                    slide["bullets"] = []
                    changed = True
                if isinstance(slide.get("content_blocks"), list):
                    filtered_blocks = [b for b in slide.get("content_blocks", []) if not (isinstance(b, dict) and b.get("type") == "bullets")]
                    if len(filtered_blocks) != len(slide.get("content_blocks", [])):
                        slide["content_blocks"] = filtered_blocks
                        changed = True
                if isinstance(slide.get("columns"), list):
                    for col in slide.get("columns", []):
                        if isinstance(col.get("bullets"), list) and col.get("bullets"):
                            col["bullets"] = []
                            changed = True
                        if isinstance(col.get("content_blocks"), list):
                            filtered_col_blocks = [b for b in col.get("content_blocks", []) if not (isinstance(b, dict) and b.get("type") == "bullets")]
                            if len(filtered_col_blocks) != len(col.get("content_blocks", [])):
                                col["content_blocks"] = filtered_col_blocks
                                changed = True

            if layout_name in {"cover", "section_divider", "thank_you", "quote"}:
                target_max_bullets = 0
            elif layout_name in {"chart_focus", "image_focus"}:
                target_max_bullets = 8
            elif layout_name in {"content", "comparison", "two_column", "three_column", "process_flow", "timeline", "exec_summary"}:
                target_max_bullets = 10
            else:
                target_max_bullets = 8

            current_max_bullets = int(sc.get("max_bullets", 0) or 0)
            if target_max_bullets == 0:
                # 스키마상 max_bullets 최소값은 1이므로 no-bullet 레이아웃에서는 키를 제거
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
            else:
                desired_max_bullets = max(current_max_bullets, target_max_bullets)
                desired = {
                    "max_bullets": desired_max_bullets,
                    "max_chars_per_bullet": max(int(sc.get("max_chars_per_bullet", 0) or 0), 180),
                }
                if sc.get("max_bullets") != desired["max_bullets"] or sc.get("max_chars_per_bullet") != desired["max_chars_per_bullet"]:
                    sc.update(desired)
                    slide["slide_constraints"] = sc
                    changed = True

            md = slide.get("metadata", {}) if isinstance(slide.get("metadata"), dict) else {}
            if not md.get("section"):
                md["section"] = bp.get("section", "")
                changed = True

            refs = md.get("source_refs", []) if isinstance(md.get("source_refs"), list) else []
            normalized_refs = [r for r in refs if isinstance(r, str) and (not source_anchors or r in source_anchors)]
            for anchor in default_refs:
                if anchor and anchor not in normalized_refs:
                    normalized_refs.append(anchor)
            if not normalized_refs and source_anchors:
                normalized_refs.append(source_anchors[0])
            md["source_refs"] = normalized_refs[:6]
            slide["metadata"] = md

            if changed:
                updated += 1

        spec["slides"] = slides

    if "client_meta" not in spec:
        spec["client_meta"] = {}
    spec["client_meta"]["date"] = datetime.now().strftime("%Y-%m-%d")

    save_yaml(spec_path, spec)
    return {
        "updated": updated,
        "created": created,
        "saved": True,
        "path": str(spec_path),
    }


def build_report(
    client_name: str,
    brief: dict,
    source_sections: Dict[str, List[str]],
    topic: str,
    evidence: List[dict],
    pdf_lines: List[str],
    financial_snapshot: List[str],
    blueprint: dict,
) -> dict:
    issue_tree = infer_issue_tree(brief, topic)
    hypotheses = build_competing_hypotheses(client_name, topic)
    source_quality = source_quality_score(evidence, source_sections)
    fact_bank = make_fact_bank(evidence, financial_snapshot, pdf_lines, limit=36)
    section_insights = section_insights_from_evidence(evidence)

    key_questions = brief.get("questions") or [
        f"{client_name}의 중장기 성장성과 수익성 동시 달성을 위한 최적 경로는 무엇인가?",
        "외부 환경(시장/정책/기술) 변화가 현재 전략을 얼마나 빠르게 재정의하도록 요구하는가?",
        "실행 로드맵에서 가장 먼저 잠가야 할 KPI와 거버넌스는 무엇인가?",
    ]

    gaps = []
    required_sections = ["market", "client", "competitors", "tech-trends", "policy"]
    for sec in required_sections:
        has_data = bool(source_sections.get(sec)) or any(item.get("section") == sec for item in evidence)
        if not has_data:
            gaps.append(f"{sec}: sources.md 보강 또는 최신 웹 소스 추가 필요")

    if len([e for e in evidence if e.get("published_at") and freshness_score(e.get("published_at")) >= 80]) < 8:
        gaps.append("최근 90일 내 고신뢰 소스 비중이 낮아 최신성 강화 필요")

    research_strength = min(
        100,
        int(
            source_quality["score"] * 0.60
            + min(len(evidence), 40) * 0.6
            + min(len(fact_bank), 36) * 0.5
        ),
    )

    return {
        "client_name": client_name,
        "generated_at": now_iso(),
        "topic": topic,
        "brief_summary": {
            "industry": brief.get("industry", ""),
            "region": brief.get("region", ""),
            "audience": brief.get("audience", ""),
            "objective": brief.get("objective", ""),
            "slide_range": brief.get("slide_range", ""),
            "duration": brief.get("duration", ""),
            "internal_data": brief.get("internal_data", ""),
            "language": brief.get("language", ""),
        },
        "key_questions": key_questions,
        "issue_tree": issue_tree,
        "hypotheses": hypotheses,
        "source_quality": source_quality,
        "evidence_library": evidence,
        "section_insights": section_insights,
        "financial_snapshot": financial_snapshot,
        "pdf_fact_lines": pdf_lines,
        "fact_bank": fact_bank,
        "data_gaps": gaps,
        "research_strength": research_strength,
        "recommended_actions": [
            "핵심 주장마다 최신 출처(발행일/도메인/신뢰등급)를 명시합니다.",
            "슬라이드 작성 전에 layout_blueprint.yaml의 밀도 기준(min_body_chars/min_paragraphs)을 충족하도록 본문을 작성합니다.",
            "As-Is/To-Be 대비 슬라이드에서는 문제-해결-효과의 인과를 한 페이지에서 닫습니다.",
            "렌더 후 QA에서 빈 공간/경계 초과/근거 부족 경고가 0이 될 때까지 반복 검증합니다.",
        ],
        "blueprint_summary": {
            "page_count": len(blueprint.get("slides", [])),
            "layout_distribution": dict(Counter(s.get("layout", "content") for s in blueprint.get("slides", []))),
        },
    }


def render_markdown(report: dict) -> str:
    b = report.get("brief_summary", {})
    sq = report.get("source_quality", {})

    lines = [
        f"# Deep Research Report: {report.get('client_name', '')}",
        "",
        f"- Generated at: {report.get('generated_at', '')}",
        f"- Topic: {report.get('topic', '') or 'N/A'}",
        f"- Industry: {b.get('industry') or 'N/A'}",
        f"- Audience: {b.get('audience') or 'N/A'}",
        f"- Objective: {b.get('objective') or 'N/A'}",
        f"- Research strength score: **{report.get('research_strength', 0)}/100**",
        "",
        "## 1) Executive Mandate",
        "",
        f"- Slide range target: {b.get('slide_range') or 'N/A'}",
        f"- Presentation duration: {b.get('duration') or 'N/A'}",
        f"- Internal data availability: {b.get('internal_data') or 'N/A'}",
        f"- Language: {b.get('language') or 'N/A'}",
        "",
        "## 2) Key Questions",
        "",
    ]

    for q in report.get("key_questions", []):
        lines.append(f"- {q}")

    lines.extend([
        "",
        "## 3) Source Reliability & Freshness",
        "",
        f"- Quality score: **{sq.get('score', 0)}/100**",
        f"- Evidence items: {sq.get('total_items', 0)}",
        f"- Avg trust score: {sq.get('avg_trust', 0)}",
        f"- Avg freshness score: {sq.get('avg_freshness', 0)}",
        f"- Required section hit: {sq.get('required_section_hit', 0)}/5",
        f"- Trust tiers: {sq.get('tier_counts', {})}",
        "",
        "### Top Evidence Library (최신/신뢰 우선)",
        "",
        "| # | Date | Domain | Tier | Score | Section | Evidence |",
        "|---:|---|---|---|---:|---|---|",
    ])

    for idx, item in enumerate(report.get("evidence_library", [])[:20], start=1):
        pub = ""
        if item.get("published_at"):
            pub = item["published_at"].astimezone(timezone.utc).strftime("%Y-%m-%d")
        elif item.get("published_raw"):
            pub = truncate(item.get("published_raw", ""), 10)
        else:
            pub = "N/A"
        title = truncate(item.get("title", ""), 86)
        source_label = item.get("domain", "")
        if source_label == "news.google.com" and item.get("source_name"):
            source_label = f"news:{item.get('source_name')}"
        lines.append(
            f"| {idx} | {pub} | {source_label} | {item.get('trust_tier', 'D')} | "
            f"{item.get('evidence_score', 0)} | {item.get('section', '')} | [{title}]({item.get('url', '')}) |"
        )

    lines.extend([
        "",
        "## 4) Consulting Issue Tree",
        "",
    ])

    for branch in report.get("issue_tree", []):
        lines.append(f"### {branch.get('branch', '')}")
        lines.append(f"- Focus: {branch.get('focus', '')}")
        for kq in branch.get("key_questions", []):
            lines.append(f"- {kq}")
        lines.append(f"- Evidence anchor: {branch.get('evidence_anchor', '')}")
        lines.append("")

    lines.extend([
        "## 5) Section Insights (Evidence-based)",
        "",
    ])

    for sec, insights in report.get("section_insights", {}).items():
        lines.append(f"### {sec}")
        for insight in insights[:6]:
            lines.append(f"- {insight}")
        lines.append("")

    lines.extend([
        "## 6) Competing Hypotheses",
        "",
        "| Hypothesis | Thesis | Required Evidence | Risk |",
        "|---|---|---|---|",
    ])
    for row in report.get("hypotheses", []):
        lines.append(
            f"| {row.get('name', '')} | {row.get('thesis', '')} | {row.get('required_evidence', '')} | {row.get('risk', '')} |"
        )

    lines.extend([
        "",
        "## 7) Financial / Operational Fact Bank",
        "",
    ])

    for fact in report.get("fact_bank", []):
        lines.append(f"- ({fact.get('section', 'client')}) {fact.get('fact', '')} [{fact.get('source', '')}]")

    lines.extend([
        "",
        "## 8) Data Gaps & Validation Plan",
        "",
    ])

    if report.get("data_gaps"):
        for gap in report.get("data_gaps", []):
            lines.append(f"- {gap}")
    else:
        lines.append("- 필수 섹션 커버리지가 확보되었습니다. (정기 최신성 점검 필요)")

    lines.extend([
        "",
        "## 9) Recommended Actions Before Deck",
        "",
    ])

    for action in report.get("recommended_actions", []):
        lines.append(f"- {action}")

    lines.extend([
        "",
        "## 10) Blueprint Summary",
        "",
        f"- Page count: {report.get('blueprint_summary', {}).get('page_count', 0)}",
        f"- Layout distribution: {report.get('blueprint_summary', {}).get('layout_distribution', {})}",
        "- 상세 페이지 설계는 `layout_blueprint.md` / `layout_blueprint.yaml` 참조",
        "",
    ])

    return "\n".join(lines)


def render_blueprint_markdown(blueprint: dict) -> str:
    meta = blueprint.get("meta", {})
    design = blueprint.get("design_system", {})

    lines = [
        f"# Layout Blueprint: {meta.get('client_name', '')}",
        "",
        f"- Generated at: {meta.get('generated_at', '')}",
        f"- Topic: {meta.get('topic', '') or 'N/A'}",
        f"- Page count: {meta.get('page_count', 0)}",
        "",
        "## 1) Design Concept & Tone",
        "",
        f"- Tone: {design.get('tone', '')}",
        f"- Keywords: {', '.join(design.get('keywords', []))}",
        f"- One-line directive: {design.get('one_line_directive', '')}",
        "",
        "## 2) Color / Typography / Layout Guide",
        "",
        f"- Color (problem zone): {design.get('color_palette', {}).get('problem_zone', '')}",
        f"- Color (solution zone): {design.get('color_palette', {}).get('solution_zone', '')}",
        f"- Color (graph zone): {design.get('color_palette', {}).get('graph_zone', '')}",
        f"- Global layout: {design.get('global_layout', {})}",
        f"- Typography: {design.get('typography', {})}",
        "",
        "## 3) Slide-by-Slide Blueprint",
        "",
    ]

    for s in blueprint.get("slides", []):
        lines.append(f"### Slide {s.get('slide_no')} — {s.get('title', '')}")
        lines.append(f"- Section: {s.get('section', '')}")
        lines.append(f"- Layout: `{s.get('layout', '')}`")
        lines.append(f"- Top-right tag: {s.get('top_right_tag', '')}")
        lines.append(f"- Governing message: {s.get('governing_message', '')}")
        lines.append(f"- Layout intent: {s.get('layout_intent', {})}")
        lines.append(f"- Density target: {s.get('density_target', {})}")

        lines.append("- Layout recipe:")
        for recipe in s.get("layout_recipe", []):
            lines.append(f"  - {recipe}")

        lines.append("- Content prompts:")
        for prompt in s.get("content_prompts", []):
            lines.append(f"  - {prompt}")

        if s.get("evidence_refs"):
            lines.append("- Recommended evidence refs:")
            for ref in s.get("evidence_refs", []):
                lines.append(f"  - {ref}")

        lines.append("- Quality checks:")
        for qc in s.get("quality_checks", []):
            lines.append(f"  - {qc}")
        lines.append("")

    lines.extend([
        "## 4) Designer Checklist",
        "",
    ])

    for rule in design.get("visual_rules", []):
        lines.append(f"- {rule}")

    lines.append("")
    return "\n".join(lines)


def build_topic(brief: dict, explicit_topic: str) -> str:
    topic = normalize_ws(explicit_topic)
    if topic:
        return topic

    objective = normalize_ws(brief.get("objective", ""))
    if objective:
        return objective

    questions = brief.get("questions", []) or []
    if questions:
        return truncate(questions[0], 70)

    return "중장기 성장·수익성 동시 달성 프레임"


def main() -> int:
    parser = argparse.ArgumentParser(description="덱 생성 전 심화 리서치 및 페이지 블루프린트 생성")
    parser.add_argument("client_name", help="클라이언트 이름")
    parser.add_argument("--topic", help="동일 고객사 내 이번 과제 주제")
    parser.add_argument("--pages", type=int, default=DEFAULT_PAGE_COUNT, help="목표 페이지 수 (기본 30)")
    parser.add_argument("--max-web-sources", type=int, default=DEFAULT_WEB_LIMIT, help="웹 근거 최대 수집 건수")
    parser.add_argument("--no-web", action="store_true", help="웹 수집 비활성화 (로컬 소스만 사용)")
    parser.add_argument("--output", "-o", help="research_report.md 출력 경로")
    parser.add_argument("--json", dest="json_output", help="research_report.json 출력 경로")
    parser.add_argument("--blueprint-md", help="layout_blueprint.md 출력 경로")
    parser.add_argument("--blueprint-yaml", help="layout_blueprint.yaml 출력 경로")
    parser.add_argument("--layout-pref", help="layout_preferences.research.yaml 출력 경로")
    parser.add_argument("--update-spec", action="store_true", help="생성 블루프린트를 deck_spec에 반영")
    parser.add_argument("--force-layout", action="store_true", help="--update-spec 시 기존 layout도 강제 치환")
    args = parser.parse_args()

    client_dir = CLIENTS_DIR / args.client_name
    if not client_dir.exists():
        print(f"Error: client not found: {client_dir}")
        return 1

    brief = parse_brief(read_text(client_dir / "brief.md"))
    sources_sections = parse_sources_sections(read_text(client_dir / "sources.md"))
    source_urls = extract_urls_from_sources(sources_sections)

    topic = build_topic(brief, args.topic or "")
    industry = brief.get("industry", "")
    objective = brief.get("objective", "")
    key_questions = brief.get("questions", []) or []

    evidence = collect_web_evidence(
        client_name=args.client_name,
        industry=industry,
        topic=topic,
        key_questions=key_questions,
        source_urls=source_urls,
        use_web=(not args.no_web),
        max_web_sources=max(12, min(120, safe_int(args.max_web_sources, DEFAULT_WEB_LIMIT))),
    )

    pdf_lines = extract_pdf_key_lines(client_dir / "research" / "raw", limit=24)
    financial_snapshot = extract_financial_snapshot(client_dir)

    # 페이지 수는 사용자 인자를 최우선으로 사용
    target_pages = max(10, min(50, safe_int(args.pages, DEFAULT_PAGE_COUNT)))

    blueprint = build_layout_blueprint(
        client_name=args.client_name,
        industry=industry,
        objective=objective,
        topic=topic,
        page_count=target_pages,
        evidence=evidence,
        key_questions=key_questions,
    )

    report = build_report(
        client_name=args.client_name,
        brief=brief,
        source_sections=sources_sections,
        topic=topic,
        evidence=evidence,
        pdf_lines=pdf_lines,
        financial_snapshot=financial_snapshot,
        blueprint=blueprint,
    )

    md_output = Path(args.output).resolve() if args.output else (client_dir / "research_report.md")
    json_output = Path(args.json_output).resolve() if args.json_output else (client_dir / "research_report.json")
    bp_md_output = Path(args.blueprint_md).resolve() if args.blueprint_md else (client_dir / "layout_blueprint.md")
    bp_yaml_output = Path(args.blueprint_yaml).resolve() if args.blueprint_yaml else (client_dir / "layout_blueprint.yaml")
    pref_output = Path(args.layout_pref).resolve() if args.layout_pref else (client_dir / "layout_preferences.research.yaml")

    md_output.parent.mkdir(parents=True, exist_ok=True)
    json_output.parent.mkdir(parents=True, exist_ok=True)
    bp_md_output.parent.mkdir(parents=True, exist_ok=True)
    bp_yaml_output.parent.mkdir(parents=True, exist_ok=True)
    pref_output.parent.mkdir(parents=True, exist_ok=True)

    md_output.write_text(render_markdown(report) + "\n", encoding="utf-8")

    # datetime 객체 직렬화 처리
    report_json = dict(report)
    report_json["evidence_library"] = []
    for item in report.get("evidence_library", []):
        copied = dict(item)
        dt = copied.get("published_at")
        if isinstance(dt, datetime):
            copied["published_at"] = dt.isoformat()
        report_json["evidence_library"].append(copied)

    json_output.write_text(json.dumps(report_json, ensure_ascii=False, indent=2), encoding="utf-8")
    bp_md_output.write_text(render_blueprint_markdown(blueprint) + "\n", encoding="utf-8")
    save_yaml(bp_yaml_output, blueprint)

    layout_pref = blueprint_to_layout_preferences(blueprint)
    save_yaml(pref_output, layout_pref)

    spec_apply_result = None
    if args.update_spec:
        spec_apply_result = apply_blueprint_to_spec(
            client_dir=client_dir,
            blueprint=blueprint,
            force_layout=bool(args.force_layout),
        )

    print(f"✓ deep research report: {md_output}")
    print(f"✓ deep research json: {json_output}")
    print(f"✓ layout blueprint md: {bp_md_output}")
    print(f"✓ layout blueprint yaml: {bp_yaml_output}")
    print(f"✓ layout preference: {pref_output}")
    print(
        "  - evidence items: {items}, quality score: {score}/100, pages: {pages}".format(
            items=report.get("source_quality", {}).get("total_items", 0),
            score=report.get("source_quality", {}).get("score", 0),
            pages=len(blueprint.get("slides", [])),
        )
    )

    if spec_apply_result:
        print(
            "✓ deck_spec updated: {path} (updated={updated}, created={created})".format(
                path=spec_apply_result.get("path", "N/A"),
                updated=spec_apply_result.get("updated", 0),
                created=spec_apply_result.get("created", 0),
            )
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
