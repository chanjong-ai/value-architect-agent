#!/usr/bin/env python3
"""
validate_spec.py - Deck Spec 검증기 v2.1

기능:
1. JSON Schema (Draft 2020-12) 기반 구조 검증
2. 비즈니스 규칙 검증 (불릿 개수/길이, columns 불릿 등)
3. global_constraints + slide_constraints 적용
4. Evidence 앵커 포맷 검증

사용법:
    python scripts/validate_spec.py <deck_spec.yaml> <schema.json> [--strict]
"""

import json
import re
import sys
from pathlib import Path
from typing import List

import yaml
from jsonschema import Draft202012Validator

# 상수 임포트 시도
try:
    from constants import (
        BULLET_MAX_CHARS, BULLET_MAX_COUNT, BULLET_MIN_COUNT,
        BULLET_CHARS_PER_LINE, BULLET_MAX_LINES,
        TITLE_MAX_CHARS, GOVERNING_MAX_CHARS,
        NO_BULLET_LAYOUTS, COLUMN_LAYOUTS, EVIDENCE_ANCHOR_PATTERN,
        get_max_bullets, get_max_chars_per_bullet, get_forbidden_words, get_bullet_bounds
    )
except ImportError:
    # 폴백 상수
    BULLET_MAX_CHARS = 100
    BULLET_MAX_COUNT = 6
    BULLET_MIN_COUNT = 3
    BULLET_CHARS_PER_LINE = 42
    BULLET_MAX_LINES = 2
    TITLE_MAX_CHARS = 100
    GOVERNING_MAX_CHARS = 200
    NO_BULLET_LAYOUTS = ["cover", "section_divider", "thank_you", "quote"]
    COLUMN_LAYOUTS = ["two_column", "three_column", "comparison"]
    EVIDENCE_ANCHOR_PATTERN = r"^sources\.md#[\w-]+$"

    def get_max_bullets(gc=None, sc=None):
        if sc and "max_bullets" in sc:
            return sc["max_bullets"]
        if gc and "default_max_bullets" in gc:
            return gc["default_max_bullets"]
        return BULLET_MAX_COUNT

    def get_max_chars_per_bullet(gc=None, sc=None):
        if sc and "max_chars_per_bullet" in sc:
            return sc["max_chars_per_bullet"]
        if gc and "default_max_chars_per_bullet" in gc:
            return gc["default_max_chars_per_bullet"]
        return BULLET_MAX_CHARS

    def get_forbidden_words(gc=None, sc=None):
        words = []
        if gc and "forbidden_words" in gc:
            words.extend(gc["forbidden_words"])
        if sc and "forbidden_words" in sc:
            words.extend(sc["forbidden_words"])
        return list(set(words))

    def get_bullet_bounds(layout, gc=None, sc=None):
        layout = (layout or "").strip().lower()
        max_bullets = get_max_bullets(gc, sc)
        min_bullets = BULLET_MIN_COUNT
        if layout in NO_BULLET_LAYOUTS:
            return 0, 0
        if layout in ("chart_focus", "image_focus"):
            return 0, min(max_bullets, 4)
        return min_bullets, max_bullets


def load_yaml(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


class ValidationIssue:
    """검증 이슈"""
    def __init__(self, severity: str, path: str, message: str):
        self.severity = severity  # "error", "warning", "info"
        self.path = path
        self.message = message

    def __str__(self):
        icon = {"error": "❌", "warning": "⚠️", "info": "ℹ️"}.get(self.severity, "•")
        return f"{icon} [{self.severity.upper()}] {self.path}: {self.message}"


def validate_schema(spec: dict, schema: dict) -> List[ValidationIssue]:
    """JSON Schema 기반 구조 검증"""
    issues = []
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(spec), key=lambda e: e.path)

    for e in errors:
        path = ".".join([str(p) for p in e.path]) if e.path else "(root)"
        issues.append(ValidationIssue("error", path, e.message))

    return issues


def validate_business_rules(spec: dict) -> List[ValidationIssue]:
    """
    비즈니스 규칙 검증
    - 불릿 개수/길이 (bullets, columns[].bullets, content_blocks 포함)
    - 제목/거버닝 메시지 길이
    - Evidence 앵커 포맷
    - global_constraints + slide_constraints 적용
    """
    issues = []
    global_constraints = spec.get("global_constraints", {})
    evidence_pattern = re.compile(EVIDENCE_ANCHOR_PATTERN)
    slides = spec.get("slides", [])

    # 전역 슬라이드 수 검사
    max_slides = global_constraints.get("max_slides")
    if isinstance(max_slides, int) and len(slides) > max_slides:
        issues.append(ValidationIssue(
            "warning",
            "slides",
            f"슬라이드 수가 global_constraints.max_slides({max_slides})를 초과합니다 ({len(slides)}장)"
        ))

    # top-level sources_ref 포맷 검사
    for ref_idx, ref in enumerate(spec.get("sources_ref", [])):
        if not evidence_pattern.match(ref):
            issues.append(ValidationIssue(
                "warning",
                f"sources_ref[{ref_idx}]",
                f"잘못된 앵커 포맷: '{ref}' (expected: sources.md#anchor-name)"
            ))

    # required_sections 검사 (layout 또는 metadata.section 기준)
    required_sections = global_constraints.get("required_sections", [])
    if isinstance(required_sections, list) and required_sections:
        available_layouts = {str(slide.get("layout", "")).strip().lower() for slide in slides}
        available_sections = set()
        for slide in slides:
            metadata = slide.get("metadata", {})
            section_name = metadata.get("section")
            if section_name:
                available_sections.add(str(section_name).strip().lower())

        for idx, section in enumerate(required_sections):
            section_norm = str(section).strip().lower()
            if not section_norm:
                continue
            if section_norm not in available_layouts and section_norm not in available_sections:
                issues.append(ValidationIssue(
                    "warning",
                    f"global_constraints.required_sections[{idx}]",
                    f"필수 섹션 미존재: '{section}' (layout 또는 metadata.section에서 찾지 못함)"
                ))

    for slide_idx, slide in enumerate(slides, start=1):
        slide_path = f"slides[{slide_idx-1}]"
        layout = slide.get("layout", "content")
        slide_constraints = slide.get("slide_constraints", {})
        columns = slide.get("columns", [])
        content_blocks = slide.get("content_blocks", [])
        top_bullets = slide.get("bullets", [])

        # 제약조건 계산 (global + slide override)
        min_bullets, max_bullets = get_bullet_bounds(layout, global_constraints, slide_constraints)
        max_chars = get_max_chars_per_bullet(global_constraints, slide_constraints)
        forbidden_words = get_forbidden_words(global_constraints, slide_constraints)
        all_bullet_texts = _collect_slide_bullet_texts(slide)

        # 1. 제목 길이 검사
        title = slide.get("title", "")
        if len(title) > TITLE_MAX_CHARS:
            issues.append(ValidationIssue(
                "warning",
                f"{slide_path}.title",
                f"제목이 {TITLE_MAX_CHARS}자를 초과합니다 ({len(title)}자)"
            ))

        # 2. 거버닝 메시지 길이 검사
        governing = slide.get("governing_message", "")
        if len(governing) > GOVERNING_MAX_CHARS:
            issues.append(ValidationIssue(
                "warning",
                f"{slide_path}.governing_message",
                f"거버닝 메시지가 {GOVERNING_MAX_CHARS}자를 초과합니다 ({len(governing)}자)"
            ))

        # 3. 레이아웃 구조 검사
        if layout in COLUMN_LAYOUTS and len(columns) < 2:
            issues.append(ValidationIssue(
                "warning",
                f"{slide_path}.columns",
                f"{layout} 레이아웃에는 최소 2개 컬럼이 권장됩니다"
            ))
        if layout in {"two_column", "comparison"} and len(columns) not in (0, 2):
            issues.append(ValidationIssue(
                "warning",
                f"{slide_path}.columns",
                f"{layout} 레이아웃에는 2개 컬럼 사용이 권장됩니다 (현재 {len(columns)}개)"
            ))
        if layout == "three_column" and len(columns) not in (0, 3):
            issues.append(ValidationIssue(
                "warning",
                f"{slide_path}.columns",
                f"three_column 레이아웃에는 3개 컬럼 사용이 권장됩니다 (현재 {len(columns)}개)"
            ))

        # chart/image focus 최소 구조 검사
        if layout == "chart_focus":
            has_chart = any(
                isinstance(v, dict) and str(v.get("type", "")).lower() in {
                    "chart", "bar_chart", "line_chart", "pie_chart", "stacked_bar", "scatter"
                }
                for v in slide.get("visuals", [])
            ) or any(
                isinstance(b, dict) and b.get("type") == "chart" for b in content_blocks
            ) or any(
                isinstance(v, dict) and (
                    v.get("data_inline") or v.get("data_path") or v.get("values") or v.get("series")
                )
                for v in slide.get("visuals", [])
            )
            if not has_chart:
                issues.append(ValidationIssue(
                    "warning",
                    slide_path,
                    "chart_focus 레이아웃에는 visuals 또는 chart content_block이 필요합니다"
                ))
        if layout == "image_focus":
            has_image = any(
                isinstance(v, dict) and str(v.get("type", "")).lower() in {
                    "image", "photo", "illustration"
                }
                for v in slide.get("visuals", [])
            ) or any(
                isinstance(b, dict) and b.get("type") == "image" for b in content_blocks
            )
            if not has_image:
                issues.append(ValidationIssue(
                    "warning",
                    slide_path,
                    "image_focus 레이아웃에는 visuals 또는 image content_block이 필요합니다"
                ))

        # 4. 슬라이드 단위 불릿 개수 검증
        # 컬럼/테이블 중심 슬라이드에서 불릿 총합 기준 오탐이 잦아 레이아웃별로 분기
        bullet_count = len(all_bullet_texts)
        has_non_bullet_blocks = _slide_has_non_bullet_content(slide)

        if layout in COLUMN_LAYOUTS and columns:
            # 컬럼 레이아웃은 "슬라이드 총합" 대신 "컬럼별 과밀" 중심으로 점검
            per_column_limit = max(3, min(5, max_bullets))
            for col_idx, col in enumerate(columns):
                col_bullets = _collect_column_bullet_texts(col)
                col_count = len(col_bullets)
                col_has_non_bullet = _column_has_non_bullet_content(col)

                if col_count > per_column_limit:
                    issues.append(ValidationIssue(
                        "warning",
                        f"{slide_path}.columns[{col_idx}]",
                        f"컬럼 불릿이 {per_column_limit}개를 초과합니다 ({col_count}개)"
                    ))
                if col_count == 0 and not col_has_non_bullet:
                    issues.append(ValidationIssue(
                        "warning",
                        f"{slide_path}.columns[{col_idx}]",
                        "컬럼 내 설명 불릿 또는 대체 콘텐츠(content_blocks)가 없습니다"
                    ))

        elif max_bullets == 0 and bullet_count > 0:
            issues.append(ValidationIssue(
                "warning",
                slide_path,
                f"{layout} 레이아웃에는 불릿이 없어야 합니다 ({bullet_count}개)"
            ))
        else:
            if bullet_count > max_bullets:
                issues.append(ValidationIssue(
                    "warning",
                    slide_path,
                    f"불릿이 {max_bullets}개를 초과합니다 ({bullet_count}개)"
                ))
            # 테이블/차트/콜아웃 등 대체 콘텐츠가 있으면 최소 불릿 규칙 완화
            if bullet_count < min_bullets and not has_non_bullet_blocks:
                issues.append(ValidationIssue(
                    "warning",
                    slide_path,
                    f"불릿이 {min_bullets}개 미만입니다 ({bullet_count}개)"
                ))

        # 4b. 불릿 길이/금지어 검증
        if layout not in NO_BULLET_LAYOUTS:
            # 4a. 일반 bullets 검사
            if top_bullets:
                _validate_bullets(
                    issues, top_bullets, max_bullets, max_chars,
                    f"{slide_path}.bullets", forbidden_words, check_count=False
                )

            # 4b. columns[].bullets 검사
            for col_idx, col in enumerate(columns):
                col_bullets = col.get("bullets", [])
                if col_bullets:
                    _validate_bullets(
                        issues, col_bullets, max_bullets, max_chars,
                        f"{slide_path}.columns[{col_idx}].bullets", forbidden_words, check_count=False
                    )

                # columns[].content_blocks 내 bullets 검사
                for block_idx, block in enumerate(col.get("content_blocks", [])):
                    if block.get("type") == "bullets":
                        block_bullets = block.get("bullets", [])
                        if block_bullets:
                            _validate_bullets(
                                issues, block_bullets, max_bullets, max_chars,
                                f"{slide_path}.columns[{col_idx}].content_blocks[{block_idx}].bullets",
                                forbidden_words,
                                check_count=False
                            )

            # 4c. content_blocks 내 bullets 검사
            for block_idx, block in enumerate(content_blocks):
                if block.get("type") == "bullets":
                    block_bullets = block.get("bullets", [])
                    if block_bullets:
                        _validate_bullets(
                            issues, block_bullets, max_bullets, max_chars,
                            f"{slide_path}.content_blocks[{block_idx}].bullets", forbidden_words, check_count=False
                        )

        # 5. Evidence 검사 (모든 슬라이드)
        # 5a. bullets 내 evidence
        for bullet_idx, bullet in enumerate(slide.get("bullets", [])):
            if isinstance(bullet, dict) and "evidence" in bullet:
                _validate_evidence(
                    issues, bullet["evidence"], evidence_pattern,
                    f"{slide_path}.bullets[{bullet_idx}].evidence"
                )

        # 5b. columns 내 evidence
        for col_idx, col in enumerate(slide.get("columns", [])):
            for bullet_idx, bullet in enumerate(col.get("bullets", [])):
                if isinstance(bullet, dict) and "evidence" in bullet:
                    _validate_evidence(
                        issues, bullet["evidence"], evidence_pattern,
                        f"{slide_path}.columns[{col_idx}].bullets[{bullet_idx}].evidence"
                    )

            # columns[].visual evidence
            if col.get("visual"):
                _validate_visual_evidence(
                    issues, col["visual"], evidence_pattern,
                    f"{slide_path}.columns[{col_idx}].visual"
                )

            # columns[].content_blocks nested evidence
            for block_idx, block in enumerate(col.get("content_blocks", [])):
                _validate_content_block_evidence(
                    issues,
                    block,
                    evidence_pattern,
                    f"{slide_path}.columns[{col_idx}].content_blocks[{block_idx}]"
                )

        # 5c. slide visuals evidence
        for visual_idx, visual in enumerate(slide.get("visuals", [])):
            _validate_visual_evidence(
                issues, visual, evidence_pattern,
                f"{slide_path}.visuals[{visual_idx}]"
            )

        # 5d. content_blocks nested evidence 검사
        for block_idx, block in enumerate(content_blocks):
            _validate_content_block_evidence(
                issues,
                block,
                evidence_pattern,
                f"{slide_path}.content_blocks[{block_idx}]"
            )

        # 5e. footnotes evidence
        for footnote_idx, footnote in enumerate(slide.get("footnotes", [])):
            if isinstance(footnote, dict) and "evidence" in footnote:
                _validate_evidence(
                    issues, footnote["evidence"], evidence_pattern,
                    f"{slide_path}.footnotes[{footnote_idx}].evidence"
                )

        # 5f. metadata.source_refs 검사
        metadata = slide.get("metadata", {})
        for ref_idx, ref in enumerate(metadata.get("source_refs", [])):
            if not evidence_pattern.match(ref):
                issues.append(ValidationIssue(
                    "warning",
                    f"{slide_path}.metadata.source_refs[{ref_idx}]",
                    f"잘못된 앵커 포맷: '{ref}' (expected: sources.md#anchor-name)"
                ))

        # 6. 금지어 검사
        if forbidden_words:
            all_text_lower = _collect_slide_text(slide).lower()
            for word in forbidden_words:
                if word.lower() in all_text_lower:
                    issues.append(ValidationIssue(
                        "error",
                        slide_path,
                        f"금지어 발견: '{word}'"
                    ))

    return issues


def _collect_slide_text(slide: dict) -> str:
    """금지어 검사용 슬라이드 텍스트 수집"""
    chunks = [
        str(slide.get("title", "")),
        str(slide.get("subtitle", "")),
        str(slide.get("governing_message", "")),
        str(slide.get("notes", "")),
    ]

    def _append_bullet_text(items):
        for bullet in items:
            if isinstance(bullet, str):
                chunks.append(bullet)
            elif isinstance(bullet, dict):
                chunks.append(str(bullet.get("text", "")))

    _append_bullet_text(slide.get("bullets", []))

    for col in slide.get("columns", []):
        chunks.append(str(col.get("heading", "")))
        chunks.append(str(col.get("subheading", "")))
        _append_bullet_text(col.get("bullets", []))
        for block in col.get("content_blocks", []):
            _append_content_block_text(chunks, block)

    for block in slide.get("content_blocks", []):
        _append_content_block_text(chunks, block)

    return " ".join(c for c in chunks if c)


def _collect_slide_bullet_texts(slide: dict) -> List[str]:
    """슬라이드 전체 bullets/columns/content_blocks의 불릿 텍스트 수집"""
    texts: List[str] = []

    def _append_bullets(items):
        for bullet in items:
            if isinstance(bullet, str):
                text = bullet.strip()
            elif isinstance(bullet, dict):
                text = str(bullet.get("text", "")).strip()
            else:
                text = ""
            if text:
                texts.append(text)

    _append_bullets(slide.get("bullets", []))

    for col in slide.get("columns", []):
        _append_bullets(col.get("bullets", []))
        for block in col.get("content_blocks", []):
            if block.get("type") == "bullets":
                _append_bullets(block.get("bullets", []))

    for block in slide.get("content_blocks", []):
        if block.get("type") == "bullets":
            _append_bullets(block.get("bullets", []))

    return texts


def _collect_column_bullet_texts(column: dict) -> List[str]:
    """컬럼 내 bullets + content_blocks(bullets) 텍스트 수집"""
    texts: List[str] = []

    def _append(items):
        for bullet in items:
            if isinstance(bullet, str):
                text = bullet.strip()
            elif isinstance(bullet, dict):
                text = str(bullet.get("text", "")).strip()
            else:
                text = ""
            if text:
                texts.append(text)

    _append(column.get("bullets", []))
    for block in column.get("content_blocks", []):
        if block.get("type") == "bullets":
            _append(block.get("bullets", []))
    return texts


def _column_has_non_bullet_content(column: dict) -> bool:
    """컬럼 내 bullets 외 콘텐츠 존재 여부"""
    for block in column.get("content_blocks", []):
        if str(block.get("type", "")).strip().lower() != "bullets":
            return True
    return False


def _slide_has_non_bullet_content(slide: dict) -> bool:
    """슬라이드 내 bullets 외 콘텐츠 블록 존재 여부"""
    for block in slide.get("content_blocks", []):
        if str(block.get("type", "")).strip().lower() != "bullets":
            return True
    for col in slide.get("columns", []):
        if _column_has_non_bullet_content(col):
            return True
    return False


def _append_content_block_text(chunks: List[str], block: dict):
    """content_block 텍스트 수집"""
    block_type = block.get("type")
    if block_type == "bullets":
        for bullet in block.get("bullets", []):
            if isinstance(bullet, str):
                chunks.append(bullet)
            elif isinstance(bullet, dict):
                chunks.append(str(bullet.get("text", "")))
    elif block_type == "text":
        chunks.append(str(block.get("text", "")))
    elif block_type == "quote":
        quote = block.get("quote", {})
        chunks.append(str(quote.get("text", "")))
        chunks.append(str(quote.get("author", "")))
    elif block_type == "callout":
        callout = block.get("callout", {})
        chunks.append(str(callout.get("text", "")))
    elif block_type == "kpi":
        kpi = block.get("kpi", {})
        chunks.append(str(kpi.get("label", "")))
        chunks.append(str(kpi.get("value", "")))


def _validate_bullets(
    issues: List[ValidationIssue],
    bullets: list,
    max_bullets: int,
    max_chars: int,
    path: str,
    forbidden_words: list = None,
    check_count: bool = True
):
    """불릿 리스트 검증 헬퍼"""
    # 개수 검사
    if check_count and len(bullets) > max_bullets:
        issues.append(ValidationIssue(
            "warning",
            path,
            f"불릿이 {max_bullets}개를 초과합니다 ({len(bullets)}개)"
        ))

    # 길이 검사
    for i, bullet in enumerate(bullets):
        text = bullet if isinstance(bullet, str) else bullet.get("text", "")
        text = str(text)

        if len(text) > max_chars:
            issues.append(ValidationIssue(
                "warning",
                f"{path}[{i}]",
                f"불릿이 {max_chars}자를 초과합니다 ({len(text)}자)"
            ))

        # 2줄 초과 가능성 검사 (휴리스틱)
        estimated_lines = max(1, (len(text) - 1) // BULLET_CHARS_PER_LINE + 1)
        if estimated_lines > BULLET_MAX_LINES:
            issues.append(ValidationIssue(
                "warning",
                f"{path}[{i}]",
                f"불릿이 {BULLET_MAX_LINES}줄 초과 가능성이 높습니다 (추정 {estimated_lines}줄)"
            ))

        # 금지어 검사
        if forbidden_words:
            text_lower = text.lower()
            for word in forbidden_words:
                if word.lower() in text_lower:
                    issues.append(ValidationIssue(
                        "error",
                        f"{path}[{i}]",
                        f"금지어 발견: '{word}'"
                    ))


def _validate_content_block_evidence(
    issues: List[ValidationIssue],
    block: dict,
    pattern: re.Pattern,
    path: str
):
    """content_block 내부 evidence 검사"""
    if not isinstance(block, dict):
        return

    if "evidence" in block:
        _validate_evidence(issues, block["evidence"], pattern, f"{path}.evidence")

    for bullet_idx, bullet in enumerate(block.get("bullets", [])):
        if isinstance(bullet, dict) and "evidence" in bullet:
            _validate_evidence(
                issues,
                bullet["evidence"],
                pattern,
                f"{path}.bullets[{bullet_idx}].evidence"
            )

    if block.get("table"):
        _validate_table_evidence(issues, block["table"], pattern, f"{path}.table")
    if block.get("chart"):
        _validate_visual_evidence(issues, block["chart"], pattern, f"{path}.chart")
    if block.get("image"):
        _validate_visual_evidence(issues, block["image"], pattern, f"{path}.image")
    if block.get("quote"):
        _validate_quote_evidence(issues, block["quote"], pattern, f"{path}.quote")
    if block.get("kpi"):
        _validate_kpi_evidence(issues, block["kpi"], pattern, f"{path}.kpi")


def _validate_evidence(
    issues: List[ValidationIssue],
    evidence: dict,
    pattern: re.Pattern,
    path: str
):
    """Evidence 객체 검증"""
    if not isinstance(evidence, dict):
        issues.append(ValidationIssue(
            "warning",
            path,
            "evidence는 object 형태여야 합니다"
        ))
        return
    source_anchor = evidence.get("source_anchor", "")
    if source_anchor and not pattern.match(source_anchor):
        issues.append(ValidationIssue(
            "warning",
            f"{path}.source_anchor",
            f"잘못된 앵커 포맷: '{source_anchor}' (expected: sources.md#anchor-name)"
        ))


def _validate_visual_evidence(
    issues: List[ValidationIssue],
    visual: dict,
    pattern: re.Pattern,
    path: str
):
    """visual 객체의 evidence 검사"""
    if isinstance(visual, dict) and "evidence" in visual:
        _validate_evidence(issues, visual["evidence"], pattern, f"{path}.evidence")


def _validate_table_evidence(
    issues: List[ValidationIssue],
    table_def: dict,
    pattern: re.Pattern,
    path: str
):
    """table 정의의 evidence 검사"""
    if isinstance(table_def, dict) and "evidence" in table_def:
        _validate_evidence(issues, table_def["evidence"], pattern, f"{path}.evidence")


def _validate_quote_evidence(
    issues: List[ValidationIssue],
    quote_def: dict,
    pattern: re.Pattern,
    path: str
):
    """quote 정의의 evidence 검사"""
    if isinstance(quote_def, dict) and "evidence" in quote_def:
        _validate_evidence(issues, quote_def["evidence"], pattern, f"{path}.evidence")


def _validate_kpi_evidence(
    issues: List[ValidationIssue],
    kpi_def: dict,
    pattern: re.Pattern,
    path: str
):
    """kpi 정의의 evidence 검사"""
    if isinstance(kpi_def, dict) and "evidence" in kpi_def:
        _validate_evidence(issues, kpi_def["evidence"], pattern, f"{path}.evidence")


def parse_sources_anchors(sources_path: Path) -> set:
    """sources.md에서 GitHub 스타일 앵커 파싱"""
    if not sources_path.exists():
        return set()

    content = sources_path.read_text(encoding="utf-8")
    anchors = set()
    heading_pattern = r'^#+\s+(.+)$'
    for match in re.finditer(heading_pattern, content, re.MULTILINE):
        heading = match.group(1).strip()
        anchor = re.sub(r"[^\w\s-]", "", heading.lower())
        anchor = re.sub(r"[\s]+", "-", anchor)
        anchors.add(f"sources.md#{anchor}")
    return anchors


def validate_evidence_existence(spec: dict, sources_anchors: set) -> List[ValidationIssue]:
    """
    sources.md 앵커 존재 여부 검증
    - 포맷 자체는 validate_business_rules에서 처리하고 여기서는 존재 여부만 확인
    """
    issues: List[ValidationIssue] = []
    if not sources_anchors:
        return issues

    def _check_anchor(anchor: str, path: str):
        if isinstance(anchor, str) and anchor.startswith("sources.md#") and anchor not in sources_anchors:
            issues.append(ValidationIssue(
                "info",
                path,
                f"sources.md에 앵커가 없습니다: '{anchor}'"
            ))

    for ref_idx, ref in enumerate(spec.get("sources_ref", [])):
        _check_anchor(ref, f"sources_ref[{ref_idx}]")

    for slide_idx, slide in enumerate(spec.get("slides", []), start=1):
        slide_path = f"slides[{slide_idx-1}]"

        metadata = slide.get("metadata", {})
        for ref_idx, ref in enumerate(metadata.get("source_refs", [])):
            _check_anchor(ref, f"{slide_path}.metadata.source_refs[{ref_idx}]")

        def _check_evidence_dict(evidence_obj, path):
            if isinstance(evidence_obj, dict):
                _check_anchor(evidence_obj.get("source_anchor"), f"{path}.source_anchor")

        # top-level bullets
        for bullet_idx, bullet in enumerate(slide.get("bullets", [])):
            if isinstance(bullet, dict) and "evidence" in bullet:
                _check_evidence_dict(bullet["evidence"], f"{slide_path}.bullets[{bullet_idx}].evidence")

        # columns and visuals
        for col_idx, col in enumerate(slide.get("columns", [])):
            for bullet_idx, bullet in enumerate(col.get("bullets", [])):
                if isinstance(bullet, dict) and "evidence" in bullet:
                    _check_evidence_dict(
                        bullet["evidence"],
                        f"{slide_path}.columns[{col_idx}].bullets[{bullet_idx}].evidence"
                    )

            if isinstance(col.get("visual"), dict):
                _check_evidence_dict(col["visual"].get("evidence"), f"{slide_path}.columns[{col_idx}].visual.evidence")

            for block_idx, block in enumerate(col.get("content_blocks", [])):
                _check_content_block_anchor(
                    _check_evidence_dict, block, f"{slide_path}.columns[{col_idx}].content_blocks[{block_idx}]"
                )

        for visual_idx, visual in enumerate(slide.get("visuals", [])):
            if isinstance(visual, dict):
                _check_evidence_dict(visual.get("evidence"), f"{slide_path}.visuals[{visual_idx}].evidence")

        for block_idx, block in enumerate(slide.get("content_blocks", [])):
            _check_content_block_anchor(_check_evidence_dict, block, f"{slide_path}.content_blocks[{block_idx}]")

        for footnote_idx, footnote in enumerate(slide.get("footnotes", [])):
            if isinstance(footnote, dict) and "evidence" in footnote:
                _check_evidence_dict(
                    footnote["evidence"], f"{slide_path}.footnotes[{footnote_idx}].evidence"
                )

    return issues


def _check_content_block_anchor(checker, block: dict, base_path: str):
    """content_block 내 evidence anchor 검사 헬퍼"""
    if not isinstance(block, dict):
        return

    if "evidence" in block:
        checker(block["evidence"], f"{base_path}.evidence")

    for bullet_idx, bullet in enumerate(block.get("bullets", [])):
        if isinstance(bullet, dict) and "evidence" in bullet:
            checker(bullet["evidence"], f"{base_path}.bullets[{bullet_idx}].evidence")

    table_def = block.get("table")
    if isinstance(table_def, dict) and "evidence" in table_def:
        checker(table_def["evidence"], f"{base_path}.table.evidence")

    for key in ("chart", "image"):
        visual = block.get(key)
        if isinstance(visual, dict) and "evidence" in visual:
            checker(visual["evidence"], f"{base_path}.{key}.evidence")

    quote_def = block.get("quote")
    if isinstance(quote_def, dict) and "evidence" in quote_def:
        checker(quote_def["evidence"], f"{base_path}.quote.evidence")

    kpi_def = block.get("kpi")
    if isinstance(kpi_def, dict) and "evidence" in kpi_def:
        checker(kpi_def["evidence"], f"{base_path}.kpi.evidence")


def print_validation_report(issues: List[ValidationIssue], spec_path: str) -> bool:
    """검증 보고서 출력"""
    errors = [i for i in issues if i.severity == "error"]
    warnings = [i for i in issues if i.severity == "warning"]
    infos = [i for i in issues if i.severity == "info"]

    print(f"\n{'='*60}")
    print(f"Deck Spec 검증 보고서: {spec_path}")
    print(f"{'='*60}")

    if not issues:
        print("\n✅ 모든 검증 통과!")
        return True

    print(f"\n요약: 오류 {len(errors)} | 경고 {len(warnings)} | 참고 {len(infos)}")

    if errors:
        print(f"\n❌ 오류 ({len(errors)}):")
        for issue in errors:
            print(f"  {issue}")

    if warnings:
        print(f"\n⚠️ 경고 ({len(warnings)}):")
        for issue in warnings:
            print(f"  {issue}")

    if infos:
        print(f"\nℹ️ 참고 ({len(infos)}):")
        for issue in infos:
            print(f"  {issue}")

    print(f"\n{'='*60}")

    if errors:
        print("❌ Deck Spec validation FAILED.")
        return False
    else:
        print("✅ Deck Spec validation PASSED (with warnings).")
        return True


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Deck Spec 검증기 v2.1",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("spec_path", help="deck_spec.yaml 파일 경로")
    parser.add_argument("schema_path", help="JSON Schema 파일 경로")
    parser.add_argument("--sources", help="sources.md 파일 경로 (앵커 존재 검증)")
    parser.add_argument("--strict", action="store_true", help="경고도 오류로 처리")
    parser.add_argument("--json", action="store_true", help="JSON 형식으로 출력")

    args = parser.parse_args()

    spec_path = Path(args.spec_path).resolve()
    schema_path = Path(args.schema_path).resolve()

    if not spec_path.exists():
        print(f"Error: spec file not found: {spec_path}")
        sys.exit(1)
    if not schema_path.exists():
        print(f"Error: schema file not found: {schema_path}")
        sys.exit(1)

    spec = load_yaml(spec_path)
    schema = load_json(schema_path)

    # 1. Schema 검증
    schema_issues = validate_schema(spec, schema)

    # 2. 비즈니스 규칙 검증
    business_issues = validate_business_rules(spec)

    # 3. sources anchor 존재 검증 (선택)
    evidence_existence_issues = []
    if args.sources:
        sources_path = Path(args.sources).resolve()
        if sources_path.exists():
            anchors = parse_sources_anchors(sources_path)
            evidence_existence_issues = validate_evidence_existence(spec, anchors)
        else:
            evidence_existence_issues.append(ValidationIssue(
                "warning",
                "sources",
                f"sources file not found: {sources_path}"
            ))

    # 전체 이슈 병합
    all_issues = schema_issues + business_issues + evidence_existence_issues

    # JSON 출력
    if args.json:
        result = {
            "spec_path": str(spec_path),
            "passed": all(i.severity != "error" for i in all_issues),
            "summary": {
                "errors": len([i for i in all_issues if i.severity == "error"]),
                "warnings": len([i for i in all_issues if i.severity == "warning"]),
                "info": len([i for i in all_issues if i.severity == "info"])
            },
            "issues": [
                {"severity": i.severity, "path": i.path, "message": i.message}
                for i in all_issues
            ]
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))

        if args.strict:
            has_issues = any(i.severity in ["error", "warning"] for i in all_issues)
        else:
            has_issues = any(i.severity == "error" for i in all_issues)

        sys.exit(1 if has_issues else 0)

    # 일반 출력
    passed = print_validation_report(all_issues, str(spec_path))

    if args.strict:
        # strict 모드: 경고도 실패 처리
        has_warnings = any(i.severity == "warning" for i in all_issues)
        if has_warnings:
            print("\n[--strict] 경고가 있어 실패 처리됩니다.")
            sys.exit(2)

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
