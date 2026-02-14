import { SlideSpecSlide } from "@consulting-ppt/shared";
import { SlideLike } from "../types";
import { ThemeTokens } from "../theme";
import { Box } from "../layout-engine";

function clampBullet(text: string): string {
  if (text.length <= 95) {
    return text;
  }
  return `${text.slice(0, 92)}...`;
}

export function addInsightBullets(slide: SlideLike, slideSpec: SlideSpecSlide, box: Box, theme: ThemeTokens): void {
  const bullets = slideSpec.claims.slice(0, 5).map((claim) => `• ${clampBullet(claim.text)}`);
  const text = bullets.length > 0 ? bullets.join("\n") : "• 핵심 인사이트 없음";

  slide.addText(text, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: theme.fonts.body,
    fontSize: theme.typography.body_size,
    color: theme.colors.text,
    breakLine: true,
    fit: "resize"
  });
}
