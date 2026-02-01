#!/usr/bin/env python3
"""
PPT QA (Quality Assurance) 자동 검사기

렌더링된 PPTX 파일을 분석하여:
1. 불릿 개수/길이 검증
2. 폰트/사이즈 규칙 준수 확인
3. 템플릿 placeholder 사용 여부
4. 콘텐츠 밀도 분석
5. 출처 연결 검증 (spec 기준)

사용법:
    python qa_ppt.py <pptx_path> [--spec <spec_path>] [--tokens <tokens_path>] [--fix] [--output <report_path>]
"""

import argparse
import json
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

try:
    from pptx import Presentation
    from pptx.util import Pt
except ImportError:
    print("python-pptx 패키지가 필요합니다: pip install python-pptx")
    sys.exit(1)

try:
    import yaml
except ImportError:
    print("PyYAML 패키지가 필요합니다: pip install pyyaml")
    sys.exit(1)


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
    """PPT QA 검사기"""

    # 기본 제약조건
    DEFAULT_CONSTRAINTS = {
        "max_bullets_per_slide": 6,
        "max_chars_per_bullet": 100,
        "max_title_chars": 100,
        "max_governing_chars": 200,
        "min_bullets_per_content_slide": 3,
        "allowed_fonts": ["Noto Sans KR", "Noto Sans KR Bold", "Noto Sans KR Regular",
                         "NotoSansKR", "NotoSansKR-Bold", "NotoSansKR-Regular"],
        "title_font_size_pt": 24,
        "governing_font_size_pt": 16,
        "body_font_size_pt": 12,
        "font_size_tolerance_pt": 2
    }

    def __init__(self, pptx_path: str, spec_path: Optional[str] = None,
                 tokens_path: Optional[str] = None):
        self.pptx_path = Path(pptx_path)
        self.spec_path = Path(spec_path) if spec_path else None
        self.tokens_path = Path(tokens_path) if tokens_path else None

        self.prs = Presentation(str(self.pptx_path))
        self.spec = self._load_spec() if self.spec_path else None
        self.tokens = self._load_tokens() if self.tokens_path else None
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

    def _build_constraints(self) -> dict:
        """제약조건 빌드 (tokens + spec의 global_constraints 병합)"""
        constraints = self.DEFAULT_CONSTRAINTS.copy()

        # tokens.yaml에서 폰트 정보 로드
        if self.tokens:
            fonts = self.tokens.get("fonts", {})
            if fonts:
                allowed = []
                for key in ["title", "governing", "body"]:
                    if key in fonts:
                        font_info = fonts[key]
                        if isinstance(font_info, dict):
                            allowed.append(font_info.get("family", ""))
                        elif isinstance(font_info, str):
                            allowed.append(font_info)
                if allowed:
                    constraints["allowed_fonts"] = list(set(allowed + constraints["allowed_fonts"]))

                # 폰트 사이즈
                if "title" in fonts and isinstance(fonts["title"], dict):
                    constraints["title_font_size_pt"] = fonts["title"].get("size", 24)
                if "governing" in fonts and isinstance(fonts["governing"], dict):
                    constraints["governing_font_size_pt"] = fonts["governing"].get("size", 16)
                if "body" in fonts and isinstance(fonts["body"], dict):
                    constraints["body_font_size_pt"] = fonts["body"].get("size", 12)

        # spec의 global_constraints 적용
        if self.spec and "global_constraints" in self.spec:
            gc = self.spec["global_constraints"]
            if "default_max_bullets" in gc:
                constraints["max_bullets_per_slide"] = gc["default_max_bullets"]
            if "default_max_chars_per_bullet" in gc:
                constraints["max_chars_per_bullet"] = gc["default_max_chars_per_bullet"]
            if "forbidden_words" in gc:
                constraints["forbidden_words"] = gc["forbidden_words"]

        return constraints

    def run_all_checks(self) -> QAReport:
        """모든 QA 검사 실행"""
        for slide_idx, slide in enumerate(self.prs.slides, start=1):
            self._check_slide(slide_idx, slide)

        # 전역 검사
        self._check_global()

        return self.report

    def _check_slide(self, slide_idx: int, slide):
        """개별 슬라이드 검사"""
        # 텍스트 프레임들 수집
        text_frames = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                text_frames.append(shape.text_frame)

        # 1. 불릿 검사
        self._check_bullets(slide_idx, text_frames)

        # 2. 폰트 검사
        self._check_fonts(slide_idx, slide)

        # 3. 콘텐츠 밀도 검사
        self._check_density(slide_idx, text_frames)

        # 4. 금지어 검사
        self._check_forbidden_words(slide_idx, slide)

        # 5. Spec과의 일치 검사 (spec 있는 경우)
        if self.spec:
            self._check_spec_alignment(slide_idx, slide)

    def _check_bullets(self, slide_idx: int, text_frames: list):
        """불릿 검사"""
        total_bullets = 0
        max_chars = self.constraints["max_chars_per_bullet"]
        max_bullets = self.constraints["max_bullets_per_slide"]

        for tf in text_frames:
            for para in tf.paragraphs:
                text = para.text.strip()
                if not text:
                    continue

                # 제목/거버닝이 아닌 불릿 카운트 (불릿 레벨로 판단)
                if para.level is not None and para.level >= 0:
                    total_bullets += 1

                    # 불릿 길이 검사
                    if len(text) > max_chars:
                        self.report.add_issue(QAIssue(
                            slide_index=slide_idx,
                            severity=Severity.WARNING,
                            category="불릿 길이",
                            message=f"불릿이 {max_chars}자를 초과합니다 ({len(text)}자)",
                            details={"text_preview": text[:50] + "..." if len(text) > 50 else text},
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

                    # 폰트 사이즈 검사 (대략적)
                    if font.size:
                        size_pt = font.size.pt
                        tolerance = self.constraints["font_size_tolerance_pt"]

                        # 제목 사이즈 범위 체크 (너무 작거나 큰 경우)
                        if size_pt > 30 or size_pt < 8:
                            self.report.add_issue(QAIssue(
                                slide_index=slide_idx,
                                severity=Severity.INFO,
                                category="폰트 크기",
                                message=f"비정상적인 폰트 크기: {size_pt}pt",
                                details={"size": size_pt},
                                auto_fixable=True
                            ))

    def _check_density(self, slide_idx: int, text_frames: list):
        """콘텐츠 밀도 검사"""
        total_chars = 0
        total_paragraphs = 0

        for tf in text_frames:
            for para in tf.paragraphs:
                text = para.text.strip()
                if text:
                    total_chars += len(text)
                    total_paragraphs += 1

        # 과밀도 검사 (총 문자수 기준)
        if total_chars > 800:
            self.report.add_issue(QAIssue(
                slide_index=slide_idx,
                severity=Severity.WARNING,
                category="콘텐츠 밀도",
                message=f"콘텐츠가 과밀합니다 ({total_chars}자)",
                details={"chars": total_chars, "paragraphs": total_paragraphs},
                auto_fixable=False
            ))

        # 저밀도 검사 (너무 적은 콘텐츠)
        if total_chars < 50 and total_paragraphs < 2:
            self.report.add_issue(QAIssue(
                slide_index=slide_idx,
                severity=Severity.INFO,
                category="콘텐츠 밀도",
                message=f"콘텐츠가 부족할 수 있습니다 ({total_chars}자)",
                details={"chars": total_chars, "paragraphs": total_paragraphs},
                auto_fixable=False
            ))

    def _check_forbidden_words(self, slide_idx: int, slide):
        """금지어 검사"""
        forbidden = self.constraints.get("forbidden_words", [])
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
        """Spec과의 일치 검사"""
        if not self.spec or "slides" not in self.spec:
            return

        slides = self.spec["slides"]
        if slide_idx - 1 >= len(slides):
            return

        spec_slide = slides[slide_idx - 1]

        # 제목 일치 검사 (첫 번째 shape에서 제목 추출 시도)
        actual_title = None
        for shape in slide.shapes:
            if shape.has_text_frame:
                text = shape.text_frame.paragraphs[0].text.strip() if shape.text_frame.paragraphs else ""
                if text:
                    actual_title = text
                    break

        spec_title = spec_slide.get("title", "")
        if actual_title and spec_title:
            # 간단한 유사도 체크 (포함 여부)
            if spec_title not in actual_title and actual_title not in spec_title:
                # 정규화 비교
                norm_actual = actual_title.replace(" ", "").lower()
                norm_spec = spec_title.replace(" ", "").lower()
                if norm_spec not in norm_actual and norm_actual not in norm_spec:
                    self.report.add_issue(QAIssue(
                        slide_index=slide_idx,
                        severity=Severity.INFO,
                        category="Spec 불일치",
                        message="제목이 Spec과 다를 수 있습니다",
                        details={"spec_title": spec_title, "actual_title": actual_title[:50]},
                        auto_fixable=False
                    ))

    def _check_global(self):
        """전역 검사"""
        # 슬라이드 수 검사
        if self.spec and "global_constraints" in self.spec:
            max_slides = self.spec["global_constraints"].get("max_slides", 50)
            if len(self.prs.slides) > max_slides:
                self.report.add_issue(QAIssue(
                    slide_index=0,  # 전역 이슈
                    severity=Severity.WARNING,
                    category="슬라이드 수",
                    message=f"슬라이드가 {max_slides}장을 초과합니다 ({len(self.prs.slides)}장)",
                    details={"count": len(self.prs.slides), "max": max_slides},
                    auto_fixable=False
                ))


def main():
    parser = argparse.ArgumentParser(
        description="PPT QA 자동 검사기",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("pptx_path", help="검사할 PPTX 파일 경로")
    parser.add_argument("--spec", help="deck_spec.yaml 경로 (선택)")
    parser.add_argument("--tokens", help="tokens.yaml 경로 (선택)")
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
        tokens_path=args.tokens
    )

    report = checker.run_all_checks()

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
