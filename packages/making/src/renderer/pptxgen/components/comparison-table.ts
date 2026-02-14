import { SlideSpecSlide } from "@consulting-ppt/shared";
import { SlideLike } from "../types";
import { ThemeTokens } from "../theme";
import { Box } from "../layout-engine";

export function addComparisonTable(slide: SlideLike, slideSpec: SlideSpecSlide, box: Box, theme: ThemeTokens): void {
  const rows: Array<Array<string | number>> = [["항목", "현재", "목표", "격차"]];

  slideSpec.claims.slice(0, 3).forEach((claim, index) => {
    rows.push([`이슈 ${index + 1}`, claim.text.slice(0, 22), "개선 필요", "우선 조치"]);
  });

  slide.addTable(rows, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: theme.fonts.body,
    fontSize: theme.typography.body_size,
    color: theme.colors.text,
    border: { type: "solid", pt: 1, color: "C8D2E0" },
    fill: "FFFFFF"
  });
}
