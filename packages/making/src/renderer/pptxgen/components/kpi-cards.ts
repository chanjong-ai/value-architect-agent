import { SlideSpecSlide } from "@consulting-ppt/shared";
import { SlideLike } from "../types";
import { ThemeTokens } from "../theme";
import { Box } from "../layout-engine";

function extractNumber(text: string): string {
  const matched = text.match(/\d+[\d.,]*/);
  return matched ? matched[0] : "N/A";
}

export function addKpiCards(slide: SlideLike, slideSpec: SlideSpecSlide, box: Box, theme: ThemeTokens): void {
  const cardCount = Math.min(3, slideSpec.claims.length || 1);
  const gap = 0.18;
  const cardW = (box.w - gap * (cardCount - 1)) / cardCount;

  for (let i = 0; i < cardCount; i += 1) {
    const claim = slideSpec.claims[i] ?? slideSpec.claims[0];
    const x = box.x + (cardW + gap) * i;
    const y = box.y;

    slide.addShape("roundRect", {
      x,
      y,
      w: cardW,
      h: box.h,
      radius: 0.06,
      line: { color: "C6D7EA", pt: 1 },
      fill: { color: "F7FAFF" }
    });

    slide.addText(`KPI ${i + 1}`, {
      x: x + 0.15,
      y: y + 0.12,
      w: cardW - 0.3,
      h: 0.3,
      fontFace: theme.fonts.body,
      fontSize: theme.typography.section_head_size,
      color: theme.colors.gray1,
      bold: true
    });

    slide.addText(extractNumber(claim?.text ?? ""), {
      x: x + 0.15,
      y: y + 0.42,
      w: cardW - 0.3,
      h: 0.45,
      fontFace: theme.fonts.title,
      fontSize: theme.typography.kpi_size,
      color: theme.colors.primary,
      bold: true
    });

    slide.addText(claim?.text ?? "핵심 지표", {
      x: x + 0.15,
      y: y + 0.9,
      w: cardW - 0.3,
      h: box.h - 1.0,
      fontFace: theme.fonts.body,
      fontSize: theme.typography.body_size,
      color: theme.colors.text,
      fit: "shrink"
    });
  }
}
