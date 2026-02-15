import { ThemeTokens } from "../theme";
import { Box } from "../layout-engine";
import { SlideLike } from "../types";
import { estimateCharCapacity, fitTextToCapacity } from "../text-fit";

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripTitlePrefix(takeaway: string): string {
  const normalized = compact(takeaway);
  const colonIndex = normalized.indexOf(":");
  if (colonIndex < 0) {
    return normalized;
  }
  const head = normalized.slice(0, colonIndex);
  if (head.length < 18 || !/[가-힣a-z0-9]/i.test(head)) {
    return normalized;
  }
  return compact(normalized.slice(colonIndex + 1));
}

function formatTakeaway(takeaway: string): string {
  const normalized = stripTitlePrefix(takeaway).replace(/\s*\|\s*.+$/g, "").replace(/[.。]+$/g, "").trim();
  if (!normalized) {
    return "결론 — 핵심 지표 기준 우선순위 재정렬";
  }

  if (normalized.includes("—") || normalized.includes("=")) {
    return normalized;
  }

  const metrics = normalized.match(/\d+(?:\.\d+)?\s*(?:%|조원|지수|배|ppt)?/g) ?? [];
  if (metrics.length >= 2) {
    return `팩트 ${metrics[0]} + ${metrics[1]} = 우선순위 재정렬`;
  }

  return `결론 — ${normalized}`;
}

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
    breakLine: true,
    fit: "shrink",
    valign: "top"
  });
}

export function addTakeaway(slide: SlideLike, takeaway: string, box: Box, theme: ThemeTokens): void {
  const formatted = formatTakeaway(takeaway);
  const capacity = estimateCharCapacity(box, theme.typography.takeaway_size, {
    minCapacity: 52,
    fillRatio: 0.8
  });
  const fitted = fitTextToCapacity(formatted, capacity);

  slide.addText(fitted.text, {
    x: box.x,
    y: box.y + 0.01,
    w: box.w,
    h: box.h - 0.02,
    fontFace: theme.fonts.body,
    fontSize: theme.typography.takeaway_size,
    bold: true,
    color: theme.colors.primary,
    breakLine: true,
    valign: "top",
    fit: "shrink"
  });
}

export function addSource(slide: SlideLike, sourceFooter: string[], box: Box, theme: ThemeTokens): void {
  const sourceText = sourceFooter.length > 0 ? sourceFooter.join(" | ") : "N/A";
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
