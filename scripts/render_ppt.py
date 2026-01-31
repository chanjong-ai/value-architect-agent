#!/usr/bin/env python3
import sys
from pathlib import Path

import yaml
from pptx import Presentation
from pptx.util import Pt
from pptx.dml.color import RGBColor

def load_yaml(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def hex_to_rgb(hex_str: str):
    hex_str = hex_str.strip().lstrip("#")
    if len(hex_str) != 6:
        return RGBColor(0, 0, 0)
    r = int(hex_str[0:2], 16)
    g = int(hex_str[2:4], 16)
    b = int(hex_str[4:6], 16)
    return RGBColor(r, g, b)

def apply_text_style(text_frame, font_name: str, font_size_pt: int, bold: bool, color_hex: str):
    # Apply style to all runs; create a run if empty.
    if text_frame.text is None:
        text_frame.text = ""

    for p in text_frame.paragraphs:
        if not p.runs:
            run = p.add_run()
            run.text = p.text if p.text else ""
        for run in p.runs:
            run.font.name = font_name
            run.font.size = Pt(font_size_pt)
            run.font.bold = bold
            if color_hex:
                run.font.color.rgb = hex_to_rgb(color_hex)

def set_title(slide, title_text: str, tokens):
    # Prefer title placeholder; else add textbox.
    font = tokens["fonts"]["title"]
    color = tokens["colors"]["text_dark"]
    if slide.shapes.title:
        slide.shapes.title.text = title_text
        apply_text_style(slide.shapes.title.text_frame, font["name"], font["size_pt"], font["bold"], color)
        return

    # Fallback: add textbox
    tx = slide.shapes.add_textbox(Pt(36), Pt(18), Pt(900), Pt(60))
    tf = tx.text_frame
    tf.text = title_text
    apply_text_style(tf, font["name"], font["size_pt"], font["bold"], color)

def add_governing_message(slide, msg: str, tokens):
    # Add governing message as a dedicated textbox near top (template-agnostic)
    font = tokens["fonts"]["governing"]
    color = tokens["colors"]["text_muted"]
    tx = slide.shapes.add_textbox(Pt(36), Pt(80), Pt(900), Pt(48))
    tf = tx.text_frame
    tf.text = msg
    apply_text_style(tf, font["name"], font["size_pt"], font["bold"], color)

def set_body_bullets(slide, bullets, tokens):
    # Prefer content placeholder; else add textbox.
    font = tokens["fonts"]["body"]
    color = tokens["colors"]["text_dark"]

    body_shape = None
    for shape in slide.shapes:
        if shape.has_text_frame and shape != slide.shapes.title:
            # Heuristic: pick the first non-title text frame as body
            body_shape = shape
            break

    if body_shape is None:
        tx = slide.shapes.add_textbox(Pt(60), Pt(140), Pt(860), Pt(360))
        body_shape = tx

    tf = body_shape.text_frame
    tf.clear()

    if not bullets:
        tf.text = ""
        return

    # First paragraph
    tf.text = bullets[0]
    tf.paragraphs[0].level = 0

    # Subsequent bullets
    for b in bullets[1:]:
        p = tf.add_paragraph()
        p.text = b
        p.level = 0

    apply_text_style(tf, font["name"], font["size_pt"], font["bold"], color)

def add_notes(slide, notes: str):
    if not notes:
        return
    notes_slide = slide.notes_slide
    tf = notes_slide.notes_text_frame
    tf.text = notes

def pick_layout(prs: Presentation, layout_index: int):
    # Safe fallback if index out of range
    if layout_index < 0 or layout_index >= len(prs.slide_layouts):
        return prs.slide_layouts[1] if len(prs.slide_layouts) > 1 else prs.slide_layouts[0]
    return prs.slide_layouts[layout_index]

def render(spec_path: Path, template_pptx: Path, output_pptx: Path, tokens_path: Path, layouts_path: Path):
    spec = load_yaml(spec_path)
    tokens = load_yaml(tokens_path)
    layouts = load_yaml(layouts_path)

    if template_pptx.exists():
        prs = Presentation(str(template_pptx))
    else:
        prs = Presentation()

    # Remove existing slides if template contains them and you want clean output.
    # Many enterprise templates come with example slides. We keep them by default off.
    # If you want always clean output, uncomment the following:
    # while len(prs.slides) > 0:
    #     rId = prs.slides._sldIdLst[0].rId
    #     prs.part.drop_rel(rId)
    #     del prs.slides._sldIdLst[0]

    layout_map = layouts.get("layout_map", {})

    for s in spec["slides"]:
        layout_name = s.get("layout", "exec_summary")
        layout_cfg = layout_map.get(layout_name, {"slide_layout_index": 1})
        layout_index = int(layout_cfg.get("slide_layout_index", 1))

        slide_layout = pick_layout(prs, layout_index)
        slide = prs.slides.add_slide(slide_layout)

        title = s.get("title", "")
        governing = s.get("governing_message", "")
        bullets = s.get("bullets", [])
        notes = s.get("notes", "")

        if title:
            set_title(slide, title, tokens)
        if governing:
            add_governing_message(slide, governing, tokens)
        if bullets:
            set_body_bullets(slide, bullets, tokens)
        add_notes(slide, notes)

    output_pptx.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(output_pptx))

def main():
    if len(sys.argv) != 5:
        print("Usage: python scripts/render_ppt.py <deck_spec.yaml> <template.pptx> <output.pptx> <client_dir or tokens_dir>")
        print("Example: python scripts/render_ppt.py clients/acme-demo/deck_spec.yaml templates/company/base-template.pptx clients/acme-demo/outputs/acme-demo.pptx templates/company")
        sys.exit(1)

    spec_path = Path(sys.argv[1]).resolve()
    template_pptx = Path(sys.argv[2]).resolve()
    output_pptx = Path(sys.argv[3]).resolve()
    tokens_dir = Path(sys.argv[4]).resolve()

    tokens_path = tokens_dir / "tokens.yaml"
    layouts_path = tokens_dir / "layouts.yaml"

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
    print(f"Rendered PPTX: {output_pptx}")

if __name__ == "__main__":
    main()
