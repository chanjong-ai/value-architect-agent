import { SlideSpecSlide } from "@consulting-ppt/shared";
import { SlideLike } from "../types";
import { ThemeTokens } from "../theme";
import { Box } from "../layout-engine";

export function addGoverningMessage(slide: SlideLike, slideSpec: SlideSpecSlide, box: Box, theme: ThemeTokens): void {
  slide.addText(slideSpec.governing_message, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: theme.fonts.body,
    fontSize: theme.typography.takeaway_size,
    bold: true,
    color: theme.colors.primary,
    valign: "mid",
    fit: "shrink"
  });
}
