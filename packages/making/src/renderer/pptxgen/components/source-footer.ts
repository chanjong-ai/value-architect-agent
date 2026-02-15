import { SlideSpecSlide } from "@consulting-ppt/shared";
import { SlideLike } from "../types";
import { ThemeTokens } from "../theme";
import { Box } from "../layout-engine";

export function addSourceFooter(slide: SlideLike, slideSpec: SlideSpecSlide, box: Box, theme: ThemeTokens): void {
  const sourceText = slideSpec.source_footer.length
    ? `Source: ${slideSpec.source_footer.join(" | ")}`
    : "Source: N/A";

  slide.addText(sourceText, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: theme.fonts.body,
    fontSize: theme.typography.footer_size,
    color: theme.colors.source,
    align: "left",
    valign: "mid"
  });
}
