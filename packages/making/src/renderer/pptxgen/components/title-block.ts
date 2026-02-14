import { SlideSpecSlide } from "@consulting-ppt/shared";
import { SlideLike } from "../types";
import { ThemeTokens } from "../theme";
import { Box } from "../layout-engine";

export function addTitleBlock(slide: SlideLike, slideSpec: SlideSpecSlide, box: Box, theme: ThemeTokens): void {
  slide.addText(slideSpec.title, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: theme.fonts.title,
    fontSize: theme.typography.title_size,
    bold: true,
    color: theme.colors.text,
    valign: "mid"
  });
}
