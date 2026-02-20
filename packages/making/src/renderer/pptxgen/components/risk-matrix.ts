import { SlideSpecSlide } from "@consulting-ppt/shared";
import { SlideLike } from "../types";
import { ThemeTokens } from "../theme";
import { Box } from "../layout-engine";

export function addRiskMatrix(slide: SlideLike, slideSpec: SlideSpecSlide, box: Box, theme: ThemeTokens): void {
  const cellW = box.w / 2;
  const cellH = box.h / 2;

  // McKinsey 리스크 매트릭스: warn_bg(위험), blue_bg(주의), card_bg(낮음) — 표준 색상 팔레트 사용
  const labels = [
    { x: 0, y: 0, title: "High Impact / High Likelihood", fill: theme.colors.warn_bg, border: theme.colors.warn_border },
    { x: 1, y: 0, title: "High Impact / Low Likelihood", fill: theme.colors.blue_bg, border: theme.colors.gray3 },
    { x: 0, y: 1, title: "Low Impact / High Likelihood", fill: theme.colors.blue_bg, border: theme.colors.gray3 },
    { x: 1, y: 1, title: "Low Impact / Low Likelihood", fill: theme.colors.card_bg, border: theme.colors.gray3 }
  ];

  for (const label of labels) {
    const x = box.x + label.x * cellW;
    const y = box.y + label.y * cellH;

    slide.addShape("rect", {
      x,
      y,
      w: cellW,
      h: cellH,
      fill: { color: label.fill },
      line: { color: label.border, pt: 0.75 }
    });

    slide.addText(label.title, {
      x: x + 0.08,
      y: y + 0.06,
      w: cellW - 0.16,
      h: 0.25,
      fontFace: theme.fonts.body,
      fontSize: theme.typography.detail_size,
      color: theme.colors.secondary,
      bold: true,
      fit: "shrink"
    });
  }

  slideSpec.claims.slice(0, 4).forEach((claim, index) => {
    const quadrant = labels[index % labels.length];
    const x = box.x + quadrant.x * cellW + 0.12;
    const y = box.y + quadrant.y * cellH + 0.34 + index * 0.18;

    slide.addText(`• ${claim.text.slice(0, 36)}`, {
      x,
      y,
      w: cellW - 0.2,
      h: 0.2,
      fontFace: theme.fonts.body,
      fontSize: theme.typography.detail_size,
      color: theme.colors.text,
      fit: "shrink"
    });
  });
}
