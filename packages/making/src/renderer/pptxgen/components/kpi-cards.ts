import { SlideSpecSlide } from "@consulting-ppt/shared";
import { SlideLike } from "../types";
import { ThemeTokens } from "../theme";
import { Box } from "../layout-engine";

function extractNumber(text: string): string {
  const matched = text.match(/\d+[\d.,]*/);
  return matched ? matched[0] : "N/A";
}

// McKinsey KPI 라벨: claim text에서 핵심 키워드 추출 (최대 10자)
function extractKpiLabel(text: string, index: number): string {
  const cleaned = text.replace(/\(?\s*So What:.*$/i, "").replace(/^\s*\[[^\]]*\]\s*/, "").trim();
  const words = cleaned.split(/[\s:·,]+/).filter((w) => w.length >= 2);
  const label = words.slice(0, 2).join(" ");
  if (label.length >= 2) {
    return label.length > 10 ? `${label.slice(0, 10)}…` : label;
  }
  return ["진단", "분석", "실행"][index] ?? "핵심";
}

export function addKpiCards(slide: SlideLike, slideSpec: SlideSpecSlide, box: Box, theme: ThemeTokens): void {
  const cardCount = Math.min(3, slideSpec.claims.length || 1);
  const gap = 0.18;
  const cardW = (box.w - gap * (cardCount - 1)) / cardCount;

  for (let i = 0; i < cardCount; i += 1) {
    const claim = slideSpec.claims[i] ?? slideSpec.claims[0];
    const x = box.x + (cardW + gap) * i;
    const y = box.y;

    // McKinsey: 직각 카드 (roundRect 금지), 테마 색상 사용
    slide.addShape("rect", {
      x,
      y,
      w: cardW,
      h: box.h,
      line: { color: theme.colors.gray3, pt: 0.75 },
      fill: { color: theme.colors.card_bg }
    });

    // KPI 레이블: claim에서 추출한 의미 있는 키워드
    const kpiLabel = extractKpiLabel(claim?.text ?? "", i);
    slide.addText(kpiLabel, {
      x: x + 0.15,
      y: y + 0.12,
      w: cardW - 0.3,
      h: 0.3,
      fontFace: theme.fonts.body,
      fontSize: theme.typography.section_head_size,
      color: theme.colors.secondary,
      bold: true
    });

    // KPI 수치: primary 색상 (McKinsey 강조)
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

    // KPI 설명: text 색상 (McKinsey: 계층적 색상 사용)
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
