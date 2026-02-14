import { ThemeTokens } from "../theme";
import { Box } from "../layout-engine";
import { SlideLike } from "../types";

export function addSlideTitle(slide: SlideLike, title: string, box: Box, theme: ThemeTokens): void {
  slide.addText(title, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: theme.fonts.title,
    fontSize: theme.typography.title_size,
    bold: true,
    color: theme.colors.text,
    valign: "top"
  });
}

export function addTakeaway(slide: SlideLike, takeaway: string, box: Box, theme: ThemeTokens): void {
  slide.addText(takeaway, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: theme.fonts.body,
    fontSize: theme.typography.takeaway_size,
    bold: true,
    color: theme.colors.primary,
    valign: "top",
    fit: "shrink"
  });
}

export function addSource(slide: SlideLike, sourceFooter: string[], box: Box, theme: ThemeTokens): void {
  const sourceText = sourceFooter.length > 0 ? sourceFooter.join(" | ") : "Source: N/A";
  slide.addText(`Source: ${sourceText}`, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: theme.fonts.body,
    fontSize: theme.typography.footer_size,
    italic: true,
    color: theme.colors.source,
    align: "left",
    valign: "mid"
  });
}

export function addPageNumber(slide: SlideLike, page: number, total: number, box: Box, theme: ThemeTokens): void {
  slide.addText(`${page}/${total}`, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: theme.fonts.body,
    fontSize: 8,
    color: theme.colors.gray1,
    align: "right",
    valign: "mid"
  });
}
