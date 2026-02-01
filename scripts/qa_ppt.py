#!/usr/bin/env python3
"""
PPT QA (Quality Assurance) 자동 검사기 v2.1

개선사항:
1. tokens.yaml 파싱 규칙 수정 (name/size_pt 구조 + 레거시 family/size 호환)
2. 불릿 카운트에서 제목/거버닝 메시지 텍스트 박스 제외
3. columns[].bullets도 불릿 수/길이 규칙에 포함
4. evidence 검사: sources.md# 앵커 포맷 검증 및 존재 검사
5. global_constraints + slide_constraints 적용 (로컬 오버라이드 반영)
6. Spec alignment 탐지 로직 고도화 (폰트 크기/위치 기준)
7. 불릿 길이 기준 단일 정책 (constants.py 사용)

사용법:
    python qa_ppt.py <pptx_path> [--spec <spec_path>] [--tokens <tokens_path>] [--sources <sources_path>] [--output <report_path>]
"""

import argparse
import json
import re
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, List, Tuple
from enum import Enum

try:
    from pptx import Presentation
    from pptx.util import Pt, Emu
except ImportError:
    print("python-pptx 패키지가 필요합니다: pip install python-pptx")
    sys.exit(1)

try:
    import yaml
except ImportError:
    print("PyYAML 패키지가 필요합니다: pip install pyyaml")
    sys.exit(1)

# 상수 모듈 임포트
try:
    from constants import (
        BULLET_MAX_CHARS, BULLET_MAX_COUNT, BULLET_MIN_COUNT,
        TITLE_FONT_SIZE_PT, GOVERNING_FONT_SIZE_PT, BODY_FONT_SIZE_PT,
        FONT_SIZE_TOLERANCE_PT, ALLOWED_FONTS,
        DENSITY_MAX_CHARS, DENSITY_MIN_CHARS, DENSITY_MIN_PARAGRAPHS,
        NO_BULLET_LAYOUTS, COLUMN_LAYOUTS, EVIDENCE_ANCHOR_PATTERN,
        get_max_bullets, get_max_chars_per_bullet, get_forbidden_words
    )
except ImportError:
    # 폴백 상수
    BULLET_MAX_CHARS = 100
    BULLET_MAX_COUNT = 6
    BULLET_MIN_COUNT = 3
    TITLE_FONT_SIZE_PT = 24
    GOVERNING_FONT_SIZE_PT = 16
    BODY_FONT_SIZE_PT = 12
    FONT_SIZE_TOLERANCE_PT = 2
    ALLOWED_FONTS = ["Noto Sans KR", "NotoSansKR"]
    DENSITY_MAX_CHARS = 800
    DENSITY_MIN_CHARS = 50
    DENSITY_MIN_PARAGRAPHS = 2
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


class Severity(Enum):
    """QA 이슈 심각도"""
    ERROR = "error"          # 반드시 수정 필요
    WARNING = "warning"      # 권장 수정
    INFO = "info"            # 참고 사항


@dataclass
class QAIssue:
    """QA 이슈"""
    slide_index: int
    severity: Severity
    category: str
    message: str
    details: dict = field(default_factory=dict)
    auto_fixable: bool = False


@dataclass
class QAReport:
    """QA 보고서"""
    pptx_path: str
    total_slides: int
    issues: list[QAIssue] = field(default_factory=list)
    summary: dict = field(default_factory=dict)

    def add_issue(self, issue: QAIssue):
        self.issues.append(issue)

    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == Severity.ERROR)

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == Severity.WARNING)

    @property
    def info_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == Severity.INFO)

    @property
    def passed(self) -> bool:
        return self.error_count == 0

    def to_dict(self) -> dict:
        return {
            "pptx_path": self.pptx_path,
            "total_slides": self.total_slides,
            "passed": self.passed,
            "summary": {
                "errors": self.error_count,
                "warnings": self.warning_count,
                "info": self.info_count
            },
            "issues": [
                {
                    "slide": i.slide_index,
                    "severity": i.severity.value,
                    "category": i.category,
                    "message": i.message,
                    "details": i.details,
                    "auto_fixable": i.auto_fixable
                }
                for i in self.issues
            ]
        }

    def to_markdown(self) -> str:
        """마크다운 형식 보고서"""
        lines = [
            "# PPT QA 보고서",
            "",
            f"**파일**: `{self.pptx_path}`",
            f"**슬라이드 수**: {self.total_slides}",
            f"**결과**: {'✅ 통과' if self.passed else '❌ 실패'}",
            "",
            "## 요약",
            f"- 🔴 오류: {self.error_count}",
            f"- 🟡 경고: {self.warning_count}",
            f"- 🔵 참고: {self.info_count}",
            ""
        ]

        if self.issues:
            lines.append("## 상세 이슈")
            lines.append("")

            # 슬라이드별로 그룹핑
            by_slide: dict[int, list[QAIssue]] = {}
            for issue in self.issues:
                if issue.slide_index not in by_slide:
                    by_slide[issue.slide_index] = []
                by_slide[issue.slide_index].append(issue)

            for slide_idx in sorted(by_slide.keys()):
                if slide_idx == 0:
                    lines.append("### 전역 이슈")
                else:
                    lines.append(f"### 슬라이드 {slide_idx}")
                for issue in by_slide[slide_idx]:
                    icon = {"error": "🔴", "warning": "🟡", "info": "🔵"}[issue.severity.value]
                    fix_tag = " [자동수정가능]" if issue.auto_fixable else ""
                    lines.append(f"- {icon} **[{issue.category}]** {issue.message}{fix_tag}")
                    if issue.details:
                        for k, v in issue.details.items():
                            lines.append(f"  - {k}: {v}")
                lines.append("")
        else:
            lines.append("✅ 모든 검사 통과!")

        return "\n".join(lines)


class PPTQAChecker:
    """PPT QA 검사기 v2.1"""

    def __init__(self, pptx_path: str, spec_path: Optional[str] = None,
                 tokens_path: Optional[str] = None, sources_path: Optional[str] = None):
        self.pptx_path = Path(pptx_path)
        self.spec_path = Path(spec_path) if spec_path else None
        self.tokens_path = Path(tokens_path) if tokens_path else None
        self.sources_path = Path(sources_path) if sources_path else None

        self.prs = Presentation(str(self.pptx_path))
        self.spec = self._load_spec() if self.spec_path else None
        self.tokens = self._load_tokens() if self.tokens_path else None
        self.sources_anchors = self._parse_sources_anchors() if self.sources_path else set()

        # 전역 제약조건
        self.global_constraints = self.spec.get("global_constraints", {}) if self.spec else {}

        # 제약조건 빌드
        self.constraints = self._build_constraints()

        self.report = QAReport(
            pptx_path=str(self.pptx_path),
            total_slides=len(self.prs.slides)
        )

    def _load_spec(self) -> Optional[dict]:
        """deck_spec.yaml 로드"""
        if not self.spec_path or not self.spec_path.exists():
            return None
        with open(self.spec_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def _load_tokens(self) -> Optional[dict]:
        """tokens.yaml 로드"""
        if not self.tokens_path or not self.tokens_path.exists():
            return None
        with open(self.tokens_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def _parse_sources_anchors(self) -> set:
        """sources.md에서 앵커 파싱"""
        anchors = set()
        if not self.sources_path or not self.sources_path.exists():
            return anchors

        with open(self.sources_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 마크다운 헤딩에서 앵커 추출 (# Heading -> heading)
        # GitHub 스타일 앵커: 소문자, 공백은 하이픈
        heading_pattern = r'^#+\s+(.+)$'
        for match in re.finditer(heading_pattern, content, re.MULTILINE):
            heading = match.group(1).strip()
            # 앵커 변환: 소문자, 공백->하이픈, 특수문자 제거
            anchor = re.sub(r'[^\w\s-]', '', heading.lower())
            anchor = re.sub(r'[\s]+', '-', anchor)
            anchors.add(f"sources.md#{anchor}")

        return anchors

    def _get_font_from_tokens(self, font_key: str) -> Tuple[str, int]:
        """
        tokens.yaml에서 폰트 정보 추출
        개선: name/size_pt 구조 및 레거시 family/size 호환
        """
        if not self.tokens:
            return ("Noto Sans KR", BODY_FONT_SIZE_PT)

        fonts = self.tokens.get("fonts", {})
        font_info = fonts.get(font_key, {})

        if isinstance(font_info, dict):
            # 신규 구조: name/size_pt
            name = font_info.get("name") or font_info.get("family", "Noto Sans KR")
            size = font_info.get("size_pt") or font_info.get("size", BODY_FONT_SIZE_PT)
            return (name, size)
        elif isinstance(font_info, str):
            # 단순 문자열인 경우 (레거시)
            return (font_info, BODY_FONT_SIZE_PT)

        return ("Noto Sans KR", BODY_FONT_SIZE_PT)

    def _build_constraints(self) -> dict:
        """제약조건 빌드 (tokens + global_constraints 병합)"""
        constraints = {
            "max_bullets_per_slide": BULLET_MAX_COUNT,
            "max_chars_per_bullet": BULLET_MAX_CHARS,
            "min_bullets_per_content_slide": BULLET_MIN_COUNT,
            "max_title_chars": 100,
            "max_governing_chars": 200,
            "title_font_size_pt": TITLE_FONT_SIZE_PT,
            "governing_font_size_pt": GOVERNING_FONT_SIZE_PT,
            "body_font_size_pt": BODY_FONT_SIZE_PT,
            "font_size_tolerance_pt": FONT_SIZE_TOLERANCE_PT,
            "allowed_fonts": ALLOWED_FONTS.copy(),
            "forbidden_words": [],
        }

        # tokens.yaml에서 폰트 정보 로드 (개선된 파싱)
        if self.tokens:
            fonts = self.tokens.get("fonts", {})
            if fonts:
                # 허용 폰트 목록 구축
                allowed = []
                for key in ["title", "governing", "body", "footnote"]:
                    if key in fonts:
                        name, _ = self._get_font_from_tokens(key)
                        if name:
                            allowed.append(name)
                if allowed:
                    # 기존 목록과 병합
                    constraints["allowed_fonts"] = list(set(allowed + constraints["allowed_fonts"]))

                # 폰트 사이즈 업데이트
                _, title_size = self._get_font_from_tokens("title")
                _, governing_size = self._get_font_from_tokens("governing")
                _, body_size = self._get_font_from_tokens("body")

                constraints["title_font_size_pt"] = title_size
                constraints["governing_font_size_pt"] = governing_size
                constraints["body_font_size_pt"] = body_size

            # density_rules에서 불릿 규칙 로드
            density = self.tokens.get("density_rules", {})
            if density:
                if "bullets_min" in density:
                    constraints["min_bullets_per_content_slide"] = density["bullets_min"]
                if "bullets_max" in density:
                    constraints["max_bullets_per_slide"] = density["bullets_max"]

        # global_constraints 적용
        if self.global_constraints:
            gc = self.global_constraints
            if "default_max_bullets" in gc:
                constraints["max_bullets_per_slide"] = gc["default_max_bullets"]
            if "default_max_chars_per_bullet" in gc:
                constraints["max_chars_per_bullet"] = gc["default_max_chars_per_bullet"]
            if "forbidden_words" in gc:
                constraints["forbidden_words"] = gc["forbidden_words"]

        return constraints

    def _get_slide_constraints(self, slide_idx: int) -> dict:
        """슬라이드별 제약조건 가져오기 (global + slide_constraints 병합)"""
        slide_constraints = {}
        if self.spec and "slides" in self.spec:
            slides = self.spec["slides"]
            if 0 <= slide_idx - 1 < len(slides):
                spec_slide = slides[slide_idx - 1]
                slide_constraints = spec_slide.get("slide_constraints", {})

        return slide_constraints

    def run_all_checks(self) -> QAReport:
        """모든 QA 검사 실행"""
        for slide_idx, slide in enumerate(self.prs.slides, start=1):
            self._check_slide(slide_idx, slide)

        # 전역 검사
        self._check_global()

        # Evidence 검사 (spec 기준)
        if self.spec:
            self._check_evidence()

        return self.report

    def _check_slide(self, slide_idx: int, slide):
        """개별 슬라이드 검사"""
        # 슬라이드별 제약조건 가져오기
        slide_constraints = self._get_slide_constraints(slide_idx)

        # 1. 불릿 검사 (제목/거버닝 메시지 제외)
        self._check_bullets(slide_idx, slide, slide_constraints)

        # 2. 폰트 검사
        self._check_fonts(slide_idx, slide)

        # 3. 콘텐츠 밀도 검사
        self._check_density(slide_idx, slide)

        # 4. 금지어 검사 (slide_constraints 포함)
        self._check_forbidden_words(slide_idx, slide, slide_constraints)

        # 5. Spec과의 일치 검사 (고도화된 로직)
        if self.spec:
            self._check_spec_alignment(slide_idx, slide)

    def _classify_text_boxes(self, slide) -> Tuple[List, List, List]:
        """
        텍스트 박스를 제목/거버닝/불릿으로 분류
        개선: 폰트 크기와 위치 기반 분류
        """
        title_boxes = []
        governing_boxes = []
        bullet_boxes = []

        title_size = self.constraints["title_font_size_pt"]
        governing_size = self.constraints["governing_font_size_pt"]
        tolerance = self.constraints["font_size_tolerance_pt"]

        for shape in slide.shapes:
            if not shape.has_text_frame:
                continue

            tf = shape.text_frame
            if not tf.paragraphs:
                continue

            # 첫 번째 문단의 폰트 크기로 분류
            first_para = tf.paragraphs[0]
            font_size_pt = None

            # 폰트 크기 추출
            for run in first_para.runs:
                if run.font.size:
                    font_size_pt = run.font.size.pt
                    break

            # shape.title 속성 또는 placeholder 타입으로 제목 식별
            is_title = False
            if hasattr(shape, 'is_placeholder') and shape.is_placeholder:
                ph_type = shape.placeholder_format.type
                # TITLE (1), CENTER_TITLE (3), SUBTITLE (4)
                if ph_type in [1, 3]:
                    is_title = True

            # 폰트 크기 기반 분류
            if is_title or (font_size_pt and abs(font_size_pt - title_size) <= tolerance):
                title_boxes.append(tf)
            elif font_size_pt and abs(font_size_pt - governing_size) <= tolerance:
                # 위치 기반 추가 검증: 상단 영역이면 거버닝
                if hasattr(shape, 'top'):
                    # 상단 1/3 영역 (슬라이드 높이 기준)
                    slide_height = self.prs.slide_height
                    if shape.top < slide_height * 0.25:
                        governing_boxes.append(tf)
                    else:
                        bullet_boxes.append(tf)
                else:
                    governing_boxes.append(tf)
            else:
                bullet_boxes.append(tf)

        return title_boxes, governing_boxes, bullet_boxes

    def _check_bullets(self, slide_idx: int, slide, slide_constraints: dict):
        """
        불릿 검사
        개선: 제목/거버닝 메시지 텍스트 박스 제외
        """
        # 텍스트 박스 분류
        _, _, bullet_boxes = self._classify_text_boxes(slide)

        # 슬라이드별 제약 적용
        max_chars = get_max_chars_per_bullet(self.global_constraints, slide_constraints)
        max_bullets = get_max_bullets(self.global_constraints, slide_constraints)

        total_bullets = 0

        for tf in bullet_boxes:
            for para in tf.paragraphs:
                text = para.text.strip()
                if not text:
                    continue

                # 불릿 레벨이 있거나 일반 텍스트면 불릿으로 카운트
                total_bullets += 1

                # 불릿 길이 검사
                if len(text) > max_chars:
                    self.report.add_issue(QAIssue(
                        slide_index=slide_idx,
                        severity=Severity.WARNING,
                        category="불릿 길이",
                        message=f"불릿이 {max_chars}자를 초과합니다 ({len(text)}자)",
                        details={
                            "text_preview": text[:50] + "..." if len(text) > 50 else text,
                            "limit": max_chars
                        },
                        auto_fixable=False
                    ))

        # 불릿 수 검사
        if total_bullets > max_bullets:
            self.report.add_issue(QAIssue(
                slide_index=slide_idx,
                severity=Severity.WARNING,
                category="불릿 개수",
                message=f"불릿이 {max_bullets}개를 초과합니다 ({total_bullets}개)",
                details={"count": total_bullets, "max": max_bullets},
                auto_fixable=False
            ))

    def _check_fonts(self, slide_idx: int, slide):
        """폰트 검사"""
        allowed_fonts = self.constraints["allowed_fonts"]

        for shape in slide.shapes:
            if not shape.has_text_frame:
                continue

            for para in shape.text_frame.paragraphs:
                for run in para.runs:
                    font = run.font
                    font_name = font.name

                    # 폰트 이름 검사
                    if font_name and font_name not in allowed_fonts:
                        # 유사 이름 체크 (NotoSansKR vs Noto Sans KR)
                        normalized = font_name.replace(" ", "").replace("-", "")
                        is_similar = any(
                            normalized.lower() == f.replace(" ", "").replace("-", "").lower()
                            for f in allowed_fonts
                        )
                        if not is_similar:
                            self.report.add_issue(QAIssue(
                                slide_index=slide_idx,
                                severity=Severity.WARNING,
                                category="폰트",
                                message=f"허용되지 않은 폰트: {font_name}",
                                details={"font": font_name, "allowed": allowed_fonts[:3]},
                                auto_fixable=True
                            ))

                    # 폰트 사이즈 검사 (비정상적 크기)
                    if font.size:
                        size_pt = font.size.pt
                        if size_pt > 30 or size_pt < 8:
                            self.report.add_issue(QAIssue(
                                slide_index=slide_idx,
                                severity=Severity.INFO,
                                category="폰트 크기",
                                message=f"비정상적인 폰트 크기: {size_pt}pt",
                                details={"size": size_pt},
                                auto_fixable=True
                            ))

    def _check_density(self, slide_idx: int, slide):
        """콘텐츠 밀도 검사"""
        total_chars = 0
        total_paragraphs = 0

        for shape in slide.shapes:
            if not shape.has_text_frame:
                continue
            for para in shape.text_frame.paragraphs:
                text = para.text.strip()
                if text:
                    total_chars += len(text)
                    total_paragraphs += 1

        # 과밀도 검사
        if total_chars > DENSITY_MAX_CHARS:
            self.report.add_issue(QAIssue(
                slide_index=slide_idx,
                severity=Severity.WARNING,
                category="콘텐츠 밀도",
                message=f"콘텐츠가 과밀합니다 ({total_chars}자)",
                details={"chars": total_chars, "paragraphs": total_paragraphs},
                auto_fixable=False
            ))

        # 저밀도 검사
        if total_chars < DENSITY_MIN_CHARS and total_paragraphs < DENSITY_MIN_PARAGRAPHS:
            self.report.add_issue(QAIssue(
                slide_index=slide_idx,
                severity=Severity.INFO,
                category="콘텐츠 밀도",
                message=f"콘텐츠가 부족할 수 있습니다 ({total_chars}자)",
                details={"chars": total_chars, "paragraphs": total_paragraphs},
                auto_fixable=False
            ))

    def _check_forbidden_words(self, slide_idx: int, slide, slide_constraints: dict):
        """금지어 검사 (global + slide_constraints 병합)"""
        forbidden = get_forbidden_words(self.global_constraints, slide_constraints)
        if not forbidden:
            return

        all_text = ""
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    all_text += para.text + " "

        all_text_lower = all_text.lower()

        for word in forbidden:
            if word.lower() in all_text_lower:
                self.report.add_issue(QAIssue(
                    slide_index=slide_idx,
                    severity=Severity.ERROR,
                    category="금지어",
                    message=f"금지어 발견: '{word}'",
                    details={"word": word},
                    auto_fixable=True
                ))

    def _check_spec_alignment(self, slide_idx: int, slide):
        """
        Spec과의 일치 검사
        개선: 폰트 크기/위치 기준으로 제목 식별 고도화
        """
        if not self.spec or "slides" not in self.spec:
            return

        slides = self.spec["slides"]
        if slide_idx - 1 >= len(slides):
            return

        spec_slide = slides[slide_idx - 1]
        spec_title = spec_slide.get("title", "")

        # 텍스트 박스 분류로 제목 식별
        title_boxes, _, _ = self._classify_text_boxes(slide)

        actual_title = None
        for tf in title_boxes:
            if tf.paragraphs:
                text = tf.paragraphs[0].text.strip()
                if text:
                    actual_title = text
                    break

        # 폴백: 첫 번째 텍스트 shape에서 추출
        if not actual_title:
            for shape in slide.shapes:
                if shape.has_text_frame:
                    text = shape.text_frame.paragraphs[0].text.strip() if shape.text_frame.paragraphs else ""
                    if text:
                        actual_title = text
                        break

        if actual_title and spec_title:
            # 정규화 비교
            norm_actual = re.sub(r'\s+', '', actual_title.lower())
            norm_spec = re.sub(r'\s+', '', spec_title.lower())

            # 부분 일치 허용 (포함 여부)
            if norm_spec not in norm_actual and norm_actual not in norm_spec:
                # 유사도 검사 (간단한 Jaccard)
                actual_words = set(actual_title.lower().split())
                spec_words = set(spec_title.lower().split())
                if actual_words and spec_words:
                    intersection = len(actual_words & spec_words)
                    union = len(actual_words | spec_words)
                    similarity = intersection / union if union > 0 else 0

                    if similarity < 0.5:  # 50% 미만 유사도
                        self.report.add_issue(QAIssue(
                            slide_index=slide_idx,
                            severity=Severity.INFO,
                            category="Spec 불일치",
                            message="제목이 Spec과 다를 수 있습니다",
                            details={
                                "spec_title": spec_title,
                                "actual_title": actual_title[:50] if len(actual_title) > 50 else actual_title,
                                "similarity": f"{similarity:.0%}"
                            },
                            auto_fixable=False
                        ))

    def _check_global(self):
        """전역 검사"""
        # 슬라이드 수 검사
        if self.global_constraints:
            max_slides = self.global_constraints.get("max_slides", 50)
            if len(self.prs.slides) > max_slides:
                self.report.add_issue(QAIssue(
                    slide_index=0,
                    severity=Severity.WARNING,
                    category="슬라이드 수",
                    message=f"슬라이드가 {max_slides}장을 초과합니다 ({len(self.prs.slides)}장)",
                    details={"count": len(self.prs.slides), "max": max_slides},
                    auto_fixable=False
                ))

    def _check_evidence(self):
        """
        Evidence 검사
        개선: sources.md# 앵커 포맷 검증 및 존재 검사
        """
        if not self.spec or "slides" not in self.spec:
            return

        evidence_pattern = re.compile(EVIDENCE_ANCHOR_PATTERN)

        for slide_idx, spec_slide in enumerate(self.spec["slides"], start=1):
            # 슬라이드 레벨 metadata의 source_refs 검사
            metadata = spec_slide.get("metadata", {})
            source_refs = metadata.get("source_refs", [])
            for ref in source_refs:
                self._validate_evidence_anchor(slide_idx, ref, evidence_pattern)

            # bullets 내 evidence 검사
            self._check_bullets_evidence(slide_idx, spec_slide.get("bullets", []), evidence_pattern)

            # columns 내 bullets evidence 검사
            for col in spec_slide.get("columns", []):
                self._check_bullets_evidence(slide_idx, col.get("bullets", []), evidence_pattern)

            # content_blocks 내 evidence 검사
            for block in spec_slide.get("content_blocks", []):
                # 블록 레벨 evidence
                if "evidence" in block:
                    self._validate_evidence(slide_idx, block["evidence"], evidence_pattern)

                # 블록 내 bullets
                self._check_bullets_evidence(slide_idx, block.get("bullets", []), evidence_pattern)

    def _check_bullets_evidence(self, slide_idx: int, bullets: list, pattern):
        """불릿 내 evidence 검사"""
        for bullet in bullets:
            if isinstance(bullet, dict) and "evidence" in bullet:
                self._validate_evidence(slide_idx, bullet["evidence"], pattern)

    def _validate_evidence(self, slide_idx: int, evidence: dict, pattern):
        """evidence 객체 검증"""
        if "source_anchor" in evidence:
            self._validate_evidence_anchor(slide_idx, evidence["source_anchor"], pattern)

    def _validate_evidence_anchor(self, slide_idx: int, anchor: str, pattern):
        """앵커 포맷 및 존재 검사"""
        # 포맷 검사
        if not pattern.match(anchor):
            self.report.add_issue(QAIssue(
                slide_index=slide_idx,
                severity=Severity.WARNING,
                category="Evidence 포맷",
                message=f"잘못된 앵커 포맷: '{anchor}'",
                details={
                    "anchor": anchor,
                    "expected_format": "sources.md#anchor-name"
                },
                auto_fixable=False
            ))
            return

        # 존재 검사 (sources.md가 로드된 경우)
        if self.sources_anchors and anchor not in self.sources_anchors:
            self.report.add_issue(QAIssue(
                slide_index=slide_idx,
                severity=Severity.INFO,
                category="Evidence 참조",
                message=f"앵커를 찾을 수 없음: '{anchor}'",
                details={
                    "anchor": anchor,
                    "available_anchors": list(self.sources_anchors)[:5]
                },
                auto_fixable=False
            ))


def validate_spec_business_rules(spec: dict, global_constraints: dict = None) -> List[QAIssue]:
    """
    Spec 비즈니스 규칙 검증
    개선: columns[].bullets도 포함
    """
    issues = []
    gc = global_constraints or spec.get("global_constraints", {})

    for slide_idx, slide in enumerate(spec.get("slides", []), start=1):
        layout = slide.get("layout", "content")
        slide_constraints = slide.get("slide_constraints", {})

        # 슬라이드별 제약 적용
        max_bullets = get_max_bullets(gc, slide_constraints)
        max_chars = get_max_chars_per_bullet(gc, slide_constraints)

        # 일반 bullets 검사
        bullets = slide.get("bullets", [])
        if bullets:
            _validate_bullets_list(issues, slide_idx, bullets, max_bullets, max_chars, "bullets")

        # columns 내 bullets 검사
        for col_idx, col in enumerate(slide.get("columns", []), start=1):
            col_bullets = col.get("bullets", [])
            if col_bullets:
                _validate_bullets_list(
                    issues, slide_idx, col_bullets, max_bullets, max_chars,
                    f"columns[{col_idx}].bullets"
                )

        # content_blocks 내 bullets 검사
        for block_idx, block in enumerate(slide.get("content_blocks", []), start=1):
            if block.get("type") == "bullets":
                block_bullets = block.get("bullets", [])
                if block_bullets:
                    _validate_bullets_list(
                        issues, slide_idx, block_bullets, max_bullets, max_chars,
                        f"content_blocks[{block_idx}].bullets"
                    )

    return issues


def _validate_bullets_list(issues: List[QAIssue], slide_idx: int, bullets: list,
                           max_bullets: int, max_chars: int, location: str):
    """불릿 리스트 검증 헬퍼"""
    # 개수 검사
    if len(bullets) > max_bullets:
        issues.append(QAIssue(
            slide_index=slide_idx,
            severity=Severity.WARNING,
            category="불릿 개수 (Spec)",
            message=f"{location}: 불릿이 {max_bullets}개를 초과합니다 ({len(bullets)}개)",
            details={"count": len(bullets), "max": max_bullets, "location": location},
            auto_fixable=False
        ))

    # 길이 검사
    for i, bullet in enumerate(bullets):
        text = bullet if isinstance(bullet, str) else bullet.get("text", "")
        if len(text) > max_chars:
            issues.append(QAIssue(
                slide_index=slide_idx,
                severity=Severity.WARNING,
                category="불릿 길이 (Spec)",
                message=f"{location}[{i}]: 불릿이 {max_chars}자를 초과합니다 ({len(text)}자)",
                details={
                    "text_preview": text[:50] + "..." if len(text) > 50 else text,
                    "length": len(text),
                    "max": max_chars
                },
                auto_fixable=False
            ))


def main():
    parser = argparse.ArgumentParser(
        description="PPT QA 자동 검사기 v2.1",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("pptx_path", help="검사할 PPTX 파일 경로")
    parser.add_argument("--spec", help="deck_spec.yaml 경로 (선택)")
    parser.add_argument("--tokens", help="tokens.yaml 경로 (선택)")
    parser.add_argument("--sources", help="sources.md 경로 (Evidence 검증용, 선택)")
    parser.add_argument("--output", "-o", help="보고서 출력 경로 (JSON)")
    parser.add_argument("--markdown", "-m", help="마크다운 보고서 출력 경로")
    parser.add_argument("--fix", action="store_true", help="자동 수정 가능한 이슈 수정 (미구현)")
    parser.add_argument("--verbose", "-v", action="store_true", help="상세 출력")

    args = parser.parse_args()

    # 파일 존재 확인
    if not Path(args.pptx_path).exists():
        print(f"❌ 파일을 찾을 수 없습니다: {args.pptx_path}")
        return 1

    # QA 실행
    checker = PPTQAChecker(
        pptx_path=args.pptx_path,
        spec_path=args.spec,
        tokens_path=args.tokens,
        sources_path=args.sources
    )

    report = checker.run_all_checks()

    # Spec 비즈니스 규칙 검사 (spec이 있는 경우)
    if args.spec and Path(args.spec).exists():
        with open(args.spec, 'r', encoding='utf-8') as f:
            spec = yaml.safe_load(f)
        spec_issues = validate_spec_business_rules(spec)
        for issue in spec_issues:
            report.add_issue(issue)

    # 결과 출력
    if args.verbose or not args.output:
        print(report.to_markdown())

    # JSON 출력
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
        print(f"\n📄 JSON 보고서 저장: {args.output}")

    # 마크다운 출력
    if args.markdown:
        md_path = Path(args.markdown)
        md_path.parent.mkdir(parents=True, exist_ok=True)
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(report.to_markdown())
        print(f"📝 마크다운 보고서 저장: {args.markdown}")

    # 결과 반환
    if report.passed:
        print(f"\n✅ QA 통과 (경고: {report.warning_count}, 참고: {report.info_count})")
        return 0
    else:
        print(f"\n❌ QA 실패 (오류: {report.error_count}, 경고: {report.warning_count})")
        return 1


if __name__ == "__main__":
    sys.exit(main())
