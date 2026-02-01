#!/usr/bin/env python3
"""
render_ppt.py - 고도화된 PPTX 렌더러

기능:
- 레이아웃별 렌더링 전략
- 컬럼 기반 레이아웃 지원
- 구조화된 불릿 (레벨, 강조) 지원
- 차트/이미지 플레이스홀더 지원
- 디자인 토큰 기반 스타일 적용
"""

import sys
from pathlib import Path
from typing import Optional, List, Union

import yaml
from pptx import Presentation
from pptx.util import Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE


def load_yaml(path: Path) -> dict:
    """YAML 파일 로드"""
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def hex_to_rgb(hex_str: str) -> RGBColor:
    """HEX 색상을 RGB로 변환"""
    hex_str = hex_str.strip().lstrip("#")
    if len(hex_str) != 6:
        return RGBColor(0, 0, 0)
    r = int(hex_str[0:2], 16)
    g = int(hex_str[2:4], 16)
    b = int(hex_str[4:6], 16)
    return RGBColor(r, g, b)


class DeckRenderer:
    """PPTX 렌더러 클래스"""

    def __init__(self, tokens: dict, layouts: dict):
        self.tokens = tokens
        self.layouts = layouts
        self.layout_map = layouts.get("layout_map", {})
        self.prs: Optional[Presentation] = None

    def _get_font_config(self, font_key: str) -> dict:
        """폰트 설정 가져오기"""
        fonts = self.tokens.get("fonts", {})
        return fonts.get(font_key, {
            "name": "Noto Sans KR",
            "size_pt": 12,
            "bold": False
        })

    def _get_color(self, color_key: str) -> str:
        """색상 가져오기"""
        colors = self.tokens.get("colors", {})
        return colors.get(color_key, "1A1A1A")

    def _apply_text_style(
        self,
        text_frame,
        font_key: str,
        color_key: str = "text_dark",
        alignment: PP_ALIGN = PP_ALIGN.LEFT
    ):
        """텍스트 프레임에 스타일 적용"""
        font_cfg = self._get_font_config(font_key)
        color = self._get_color(color_key)

        for p in text_frame.paragraphs:
            p.alignment = alignment
            if not p.runs:
                run = p.add_run()
                run.text = p.text if p.text else ""

            for run in p.runs:
                run.font.name = font_cfg.get("name", "Noto Sans KR")
                run.font.size = Pt(font_cfg.get("size_pt", 12))
                run.font.bold = font_cfg.get("bold", False)
                run.font.color.rgb = hex_to_rgb(color)

    def _set_title(self, slide, title_text: str):
        """슬라이드 제목 설정"""
        if slide.shapes.title:
            slide.shapes.title.text = title_text
            self._apply_text_style(
                slide.shapes.title.text_frame,
                "title",
                "text_dark"
            )
        else:
            # 폴백: 텍스트박스 추가
            tx = slide.shapes.add_textbox(Pt(43), Pt(20), Pt(860), Pt(50))
            tf = tx.text_frame
            tf.text = title_text
            self._apply_text_style(tf, "title", "text_dark")

    def _add_governing_message(self, slide, msg: str, top_pt: int = 75):
        """거버닝 메시지 추가"""
        tx = slide.shapes.add_textbox(Pt(43), Pt(top_pt), Pt(860), Pt(40))
        tf = tx.text_frame
        tf.text = msg
        tf.word_wrap = True
        self._apply_text_style(tf, "governing", "text_muted")

    def _add_bullets(
        self,
        slide,
        bullets: List[Union[str, dict]],
        left_pt: int = 43,
        top_pt: int = 130,
        width_pt: int = 860,
        height_pt: int = 350
    ):
        """불릿 포인트 추가"""
        if not bullets:
            return

        tx = slide.shapes.add_textbox(
            Pt(left_pt), Pt(top_pt),
            Pt(width_pt), Pt(height_pt)
        )
        tf = tx.text_frame
        tf.word_wrap = True

        for i, bullet in enumerate(bullets):
            # 불릿 파싱
            if isinstance(bullet, str):
                text = bullet
                level = 0
                emphasis = "normal"
            else:
                text = bullet.get("text", "")
                level = bullet.get("level", 0)
                emphasis = bullet.get("emphasis", "normal")

            # 첫 번째 불릿은 기존 paragraph 사용
            if i == 0:
                p = tf.paragraphs[0]
            else:
                p = tf.add_paragraph()

            p.text = text
            p.level = level
            p.alignment = PP_ALIGN.LEFT

            # 스타일 적용
            font_cfg = self._get_font_config("body")
            color = self._get_color("text_dark")

            for run in p.runs if p.runs else [p.add_run()]:
                if not p.runs:
                    run.text = text
                run.font.name = font_cfg.get("name", "Noto Sans KR")

                # 레벨에 따른 폰트 크기 조정
                base_size = font_cfg.get("size_pt", 12)
                if level == 1:
                    run.font.size = Pt(base_size - 1)
                elif level == 2:
                    run.font.size = Pt(base_size - 2)
                else:
                    run.font.size = Pt(base_size)

                # 강조 처리
                if emphasis == "bold":
                    run.font.bold = True
                elif emphasis == "highlight":
                    run.font.bold = True
                    run.font.color.rgb = hex_to_rgb(self._get_color("primary_blue"))
                else:
                    run.font.bold = font_cfg.get("bold", False)
                    run.font.color.rgb = hex_to_rgb(color)

    def _add_notes(self, slide, notes: str):
        """발표자 노트 추가"""
        if not notes:
            return
        notes_slide = slide.notes_slide
        tf = notes_slide.notes_text_frame
        tf.text = notes

    def _pick_layout(self, layout_name: str):
        """레이아웃 선택"""
        layout_cfg = self.layout_map.get(layout_name, {"slide_layout_index": 1})
        layout_index = int(layout_cfg.get("slide_layout_index", 1))

        if layout_index < 0 or layout_index >= len(self.prs.slide_layouts):
            # 안전한 폴백
            return self.prs.slide_layouts[1] if len(self.prs.slide_layouts) > 1 else self.prs.slide_layouts[0]

        return self.prs.slide_layouts[layout_index]

    # =========================================================================
    # 레이아웃별 렌더링 메서드
    # =========================================================================

    def _render_cover(self, slide, slide_data: dict):
        """커버 슬라이드 렌더링"""
        self._set_title(slide, slide_data.get("title", ""))

        # 부제목 또는 거버닝 메시지를 서브타이틀로
        subtitle = slide_data.get("subtitle") or slide_data.get("governing_message", "")
        if subtitle:
            # 서브타이틀 위치 (커버 중앙 하단)
            tx = slide.shapes.add_textbox(Pt(43), Pt(280), Pt(860), Pt(60))
            tf = tx.text_frame
            tf.text = subtitle
            tf.word_wrap = True
            self._apply_text_style(tf, "governing", "text_muted", PP_ALIGN.CENTER)

        self._add_notes(slide, slide_data.get("notes", ""))

    def _render_section_divider(self, slide, slide_data: dict):
        """섹션 구분 슬라이드 렌더링"""
        title = slide_data.get("title", "")
        governing = slide_data.get("governing_message", "")

        # 중앙 정렬 제목
        tx = slide.shapes.add_textbox(Pt(43), Pt(200), Pt(860), Pt(80))
        tf = tx.text_frame
        tf.text = title
        tf.word_wrap = True
        self._apply_text_style(tf, "title", "primary_blue", PP_ALIGN.CENTER)

        # 부제목
        if governing:
            tx2 = slide.shapes.add_textbox(Pt(43), Pt(290), Pt(860), Pt(50))
            tf2 = tx2.text_frame
            tf2.text = governing
            tf2.word_wrap = True
            self._apply_text_style(tf2, "governing", "text_muted", PP_ALIGN.CENTER)

        self._add_notes(slide, slide_data.get("notes", ""))

    def _render_exec_summary(self, slide, slide_data: dict):
        """Executive Summary 슬라이드 렌더링"""
        self._set_title(slide, slide_data.get("title", ""))
        self._add_governing_message(slide, slide_data.get("governing_message", ""))
        self._add_bullets(slide, slide_data.get("bullets", []))
        self._add_notes(slide, slide_data.get("notes", ""))

    def _render_content(self, slide, slide_data: dict):
        """일반 컨텐츠 슬라이드 렌더링"""
        self._set_title(slide, slide_data.get("title", ""))
        self._add_governing_message(slide, slide_data.get("governing_message", ""))
        self._add_bullets(slide, slide_data.get("bullets", []))
        self._add_notes(slide, slide_data.get("notes", ""))

    def _render_two_column(self, slide, slide_data: dict):
        """2컬럼 레이아웃 렌더링"""
        self._set_title(slide, slide_data.get("title", ""))
        self._add_governing_message(slide, slide_data.get("governing_message", ""))

        columns = slide_data.get("columns", [])

        if columns and len(columns) >= 2:
            # columns 데이터 사용
            left_col = columns[0]
            right_col = columns[1]

            # 왼쪽 컬럼 헤딩
            tx_left_head = slide.shapes.add_textbox(Pt(43), Pt(125), Pt(400), Pt(30))
            tf = tx_left_head.text_frame
            tf.text = left_col.get("heading", "")
            self._apply_text_style(tf, "governing", "primary_blue")

            # 왼쪽 컬럼 불릿
            self._add_bullets(
                slide,
                left_col.get("bullets", []),
                left_pt=43, top_pt=160, width_pt=400, height_pt=300
            )

            # 오른쪽 컬럼 헤딩
            tx_right_head = slide.shapes.add_textbox(Pt(480), Pt(125), Pt(400), Pt(30))
            tf = tx_right_head.text_frame
            tf.text = right_col.get("heading", "")
            self._apply_text_style(tf, "governing", "primary_blue")

            # 오른쪽 컬럼 불릿
            self._add_bullets(
                slide,
                right_col.get("bullets", []),
                left_pt=480, top_pt=160, width_pt=400, height_pt=300
            )
        else:
            # columns가 없으면 bullets에서 [Left]/[Right] 파싱
            bullets = slide_data.get("bullets", [])
            left_bullets = []
            right_bullets = []

            for b in bullets:
                text = b if isinstance(b, str) else b.get("text", "")
                if text.startswith("[Left]"):
                    left_bullets.append(text.replace("[Left]", "").strip())
                elif text.startswith("[Right]"):
                    right_bullets.append(text.replace("[Right]", "").strip())
                else:
                    left_bullets.append(text)

            self._add_bullets(
                slide, left_bullets,
                left_pt=43, top_pt=130, width_pt=400, height_pt=330
            )
            self._add_bullets(
                slide, right_bullets,
                left_pt=480, top_pt=130, width_pt=400, height_pt=330
            )

        self._add_notes(slide, slide_data.get("notes", ""))

    def _render_three_column(self, slide, slide_data: dict):
        """3컬럼 레이아웃 렌더링"""
        self._set_title(slide, slide_data.get("title", ""))
        self._add_governing_message(slide, slide_data.get("governing_message", ""))

        columns = slide_data.get("columns", [])

        col_width = 270
        col_positions = [43, 330, 617]

        for i, col in enumerate(columns[:3]):
            # 컬럼 헤딩
            tx_head = slide.shapes.add_textbox(
                Pt(col_positions[i]), Pt(125),
                Pt(col_width), Pt(30)
            )
            tf = tx_head.text_frame
            tf.text = col.get("heading", "")
            self._apply_text_style(tf, "governing", "primary_blue")

            # 컬럼 불릿
            self._add_bullets(
                slide,
                col.get("bullets", []),
                left_pt=col_positions[i], top_pt=160,
                width_pt=col_width, height_pt=300
            )

        self._add_notes(slide, slide_data.get("notes", ""))

    def _render_comparison(self, slide, slide_data: dict):
        """비교 레이아웃 렌더링 (As-Is / To-Be 등)"""
        self._set_title(slide, slide_data.get("title", ""))
        self._add_governing_message(slide, slide_data.get("governing_message", ""))

        columns = slide_data.get("columns", [])

        if len(columns) >= 2:
            # 왼쪽 (As-Is)
            left_col = columns[0]
            # 배경 박스
            shape_left = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE,
                Pt(43), Pt(125), Pt(400), Pt(340)
            )
            shape_left.fill.solid()
            shape_left.fill.fore_color.rgb = hex_to_rgb(self._get_color("light_blue"))
            shape_left.line.fill.background()

            # 헤딩
            tx_left_head = slide.shapes.add_textbox(Pt(53), Pt(135), Pt(380), Pt(30))
            tf = tx_left_head.text_frame
            tf.text = left_col.get("heading", "As-Is")
            self._apply_text_style(tf, "governing", "dark_blue")

            # 불릿
            self._add_bullets(
                slide,
                left_col.get("bullets", []),
                left_pt=53, top_pt=175, width_pt=380, height_pt=280
            )

            # 오른쪽 (To-Be)
            right_col = columns[1]
            shape_right = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE,
                Pt(480), Pt(125), Pt(400), Pt(340)
            )
            shape_right.fill.solid()
            shape_right.fill.fore_color.rgb = hex_to_rgb(self._get_color("primary_blue"))
            shape_right.line.fill.background()

            # 헤딩
            tx_right_head = slide.shapes.add_textbox(Pt(490), Pt(135), Pt(380), Pt(30))
            tf = tx_right_head.text_frame
            tf.text = right_col.get("heading", "To-Be")
            self._apply_text_style(tf, "governing", "background")

            # 불릿
            self._add_bullets(
                slide,
                right_col.get("bullets", []),
                left_pt=490, top_pt=175, width_pt=380, height_pt=280
            )

        self._add_notes(slide, slide_data.get("notes", ""))

    def _render_chart_focus(self, slide, slide_data: dict):
        """차트 중심 슬라이드 렌더링"""
        self._set_title(slide, slide_data.get("title", ""))
        self._add_governing_message(slide, slide_data.get("governing_message", ""))

        visuals = slide_data.get("visuals", [])

        if visuals:
            visual = visuals[0]
            visual_type = visual.get("type", "placeholder")

            # 플레이스홀더로 차트 영역 표시
            shape = slide.shapes.add_shape(
                MSO_SHAPE.RECTANGLE,
                Pt(43), Pt(130), Pt(600), Pt(330)
            )
            shape.fill.solid()
            shape.fill.fore_color.rgb = hex_to_rgb(self._get_color("light_blue"))
            shape.line.color.rgb = hex_to_rgb(self._get_color("divider_gray"))

            # 플레이스홀더 텍스트
            tf = shape.text_frame
            tf.text = f"[{visual_type}]\n{visual.get('title', '')}"
            tf.paragraphs[0].alignment = PP_ALIGN.CENTER

            # 캡션
            caption = visual.get("caption", "")
            if caption:
                tx_cap = slide.shapes.add_textbox(Pt(43), Pt(465), Pt(600), Pt(25))
                tf = tx_cap.text_frame
                tf.text = caption
                self._apply_text_style(tf, "footnote", "text_muted")

        # 오른쪽 불릿 (선택적)
        bullets = slide_data.get("bullets", [])
        if bullets:
            self._add_bullets(
                slide, bullets,
                left_pt=670, top_pt=130, width_pt=250, height_pt=330
            )

        self._add_notes(slide, slide_data.get("notes", ""))

    def _render_timeline(self, slide, slide_data: dict):
        """타임라인 슬라이드 렌더링"""
        self._set_title(slide, slide_data.get("title", ""))
        self._add_governing_message(slide, slide_data.get("governing_message", ""))

        # 타임라인 화살표 기본 도형
        arrow = slide.shapes.add_shape(
            MSO_SHAPE.RIGHT_ARROW,
            Pt(43), Pt(250), Pt(860), Pt(40)
        )
        arrow.fill.solid()
        arrow.fill.fore_color.rgb = hex_to_rgb(self._get_color("primary_blue"))
        arrow.line.fill.background()

        # 불릿을 타임라인 단계로 표시
        bullets = slide_data.get("bullets", [])
        if bullets:
            step_width = 860 // len(bullets)
            for i, bullet in enumerate(bullets):
                text = bullet if isinstance(bullet, str) else bullet.get("text", "")

                # 단계 박스
                tx = slide.shapes.add_textbox(
                    Pt(43 + i * step_width), Pt(300),
                    Pt(step_width - 10), Pt(80)
                )
                tf = tx.text_frame
                tf.text = f"Phase {i + 1}\n{text}"
                tf.word_wrap = True
                self._apply_text_style(tf, "body", "text_dark", PP_ALIGN.CENTER)

        self._add_notes(slide, slide_data.get("notes", ""))

    def _render_thank_you(self, slide, slide_data: dict):
        """마무리 슬라이드 렌더링"""
        title = slide_data.get("title", "Thank You")
        governing = slide_data.get("governing_message", "")

        # 중앙 큰 제목
        tx = slide.shapes.add_textbox(Pt(43), Pt(200), Pt(860), Pt(80))
        tf = tx.text_frame
        tf.text = title
        tf.word_wrap = True
        self._apply_text_style(tf, "title", "primary_blue", PP_ALIGN.CENTER)

        # 서브 메시지
        if governing:
            tx2 = slide.shapes.add_textbox(Pt(43), Pt(290), Pt(860), Pt(50))
            tf2 = tx2.text_frame
            tf2.text = governing
            tf2.word_wrap = True
            self._apply_text_style(tf2, "governing", "text_muted", PP_ALIGN.CENTER)

        self._add_notes(slide, slide_data.get("notes", ""))

    def _render_appendix(self, slide, slide_data: dict):
        """부록 슬라이드 렌더링"""
        self._render_content(slide, slide_data)

    def _render_default(self, slide, slide_data: dict):
        """기본 렌더링 (알 수 없는 레이아웃)"""
        self._render_content(slide, slide_data)

    # =========================================================================
    # 메인 렌더링 로직
    # =========================================================================

    def render(
        self,
        spec: dict,
        template_path: Path,
        output_path: Path
    ):
        """덱 스펙을 PPTX로 렌더링"""

        # 프레젠테이션 로드/생성
        if template_path.exists():
            self.prs = Presentation(str(template_path))
            # 기존 슬라이드 제거 (템플릿의 슬라이드 마스터/레이아웃만 유지)
            # 슬라이드는 역순으로 제거해야 인덱스 문제 방지
            while len(self.prs.slides) > 0:
                rId = self.prs.slides._sldIdLst[0].rId
                self.prs.part.drop_rel(rId)
                del self.prs.slides._sldIdLst[0]
        else:
            self.prs = Presentation()
            print(f"Warning: 템플릿 없음, 빈 프레젠테이션 사용: {template_path}")

        # 레이아웃별 렌더러 매핑
        layout_renderers = {
            "cover": self._render_cover,
            "exec_summary": self._render_exec_summary,
            "section_divider": self._render_section_divider,
            "content": self._render_content,
            "two_column": self._render_two_column,
            "three_column": self._render_three_column,
            "comparison": self._render_comparison,
            "timeline": self._render_timeline,
            "process_flow": self._render_timeline,  # 재사용
            "chart_focus": self._render_chart_focus,
            "image_focus": self._render_chart_focus,  # 재사용
            "quote": self._render_section_divider,  # 재사용
            "appendix": self._render_appendix,
            "thank_you": self._render_thank_you,
        }

        # 슬라이드 렌더링
        for slide_data in spec.get("slides", []):
            layout_name = slide_data.get("layout", "content")

            # 슬라이드 레이아웃 선택
            slide_layout = self._pick_layout(layout_name)
            slide = self.prs.slides.add_slide(slide_layout)

            # 레이아웃별 렌더러 호출
            renderer = layout_renderers.get(layout_name, self._render_default)
            renderer(slide, slide_data)

        # 저장
        output_path.parent.mkdir(parents=True, exist_ok=True)
        self.prs.save(str(output_path))


def render(
    spec_path: Path,
    template_pptx: Path,
    output_pptx: Path,
    tokens_path: Path,
    layouts_path: Path
):
    """렌더링 실행 함수 (외부 호출용)"""
    spec = load_yaml(spec_path)
    tokens = load_yaml(tokens_path)
    layouts = load_yaml(layouts_path)

    renderer = DeckRenderer(tokens, layouts)
    renderer.render(spec, template_pptx, output_pptx)


def main():
    if len(sys.argv) != 5:
        print("Usage: python scripts/render_ppt.py <deck_spec.yaml> <template.pptx> <output.pptx> <templates_dir>")
        print("Example: python scripts/render_ppt.py clients/acme-demo/deck_spec.yaml templates/company/base-template.pptx clients/acme-demo/outputs/acme-demo.pptx templates/company")
        sys.exit(1)

    spec_path = Path(sys.argv[1]).resolve()
    template_pptx = Path(sys.argv[2]).resolve()
    output_pptx = Path(sys.argv[3]).resolve()
    tokens_dir = Path(sys.argv[4]).resolve()

    tokens_path = tokens_dir / "tokens.yaml"
    layouts_path = tokens_dir / "layouts.yaml"

    # 파일 존재 확인
    if not spec_path.exists():
        print(f"Error: deck_spec not found: {spec_path}")
        sys.exit(1)
    if not tokens_path.exists():
        print(f"Error: tokens.yaml not found: {tokens_path}")
        sys.exit(1)
    if not layouts_path.exists():
        print(f"Error: layouts.yaml not found: {layouts_path}")
        sys.exit(1)

    render(spec_path, template_pptx, output_pptx, tokens_path, layouts_path)
    print(f"✓ Rendered PPTX: {output_pptx}")


if __name__ == "__main__":
    main()
