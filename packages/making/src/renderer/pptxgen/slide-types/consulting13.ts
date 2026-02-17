import { SlideSpecSlide } from "@consulting-ppt/shared";
import { addSlideTitle, addTakeaway } from "../components/slide-frame";
import { makeAltCellOpts, makeCellOpts, makeHeaderOpts } from "../components/table-style";
import { resolveSemanticIcon } from "../icon-library";
import { Box } from "../layout-engine";
import { estimateCharCapacity, fitClaimPreserveSoWhat, fitTextByArea, fitTextToCapacity } from "../text-fit";
import { RenderContext, SlideLike } from "../types";

const MIN_FONT_PT = 7;
const ICON_CONTAINER = 0.34;
const ICON_SIZE = 0.28;
const CHART_GRID = "E8E8E8";
function isEntityLabelCell(text: string, colIndex: number): boolean {
  if (colIndex !== 0) {
    return false;
  }
  const normalized = text.trim();
  if (!normalized || normalized.length > 36) {
    return false;
  }
  if (/^-?\d+(?:[.,]\d+)?%?$/.test(normalized)) {
    return false;
  }
  return /^[\p{L}\p{N}\s()\-&/+.]+$/u.test(normalized);
}

type SlideVisual = SlideSpecSlide["visuals"][number];

type InsightVariant = "key" | "analysis";

function extractNumbersFromClaims(claims: string[]): number[] {
  const numbers: number[] = [];
  for (const claim of claims) {
    const matches = claim.match(/-?\d+(?:\.\d+)?/g) ?? [];
    for (const match of matches) {
      const parsed = Number(match);
      if (Number.isFinite(parsed)) {
        numbers.push(parsed);
      }
    }
  }
  return numbers;
}

function safeArea(area: Box): Box {
  return {
    x: area.x,
    y: area.y,
    w: Math.max(area.w, 0.3),
    h: Math.max(area.h, 0.2)
  };
}

function splitAreaVertical(area: Box, count: number): Box[] {
  if (count <= 1) {
    return [safeArea(area)];
  }
  const gap = 0.06;
  const sectionH = (area.h - gap * (count - 1)) / count;
  const output: Box[] = [];
  for (let i = 0; i < count; i += 1) {
    output.push(
      safeArea({
        x: area.x,
        y: area.y + i * (sectionH + gap),
        w: area.w,
        h: sectionH
      })
    );
  }
  return output;
}

function sortVisuals(slideSpec: SlideSpecSlide): SlideVisual[] {
  return [...slideSpec.visuals].sort((a, b) => {
    const priorityA = typeof a.options?.priority === "number" ? a.options.priority : 99;
    const priorityB = typeof b.options?.priority === "number" ? b.options.priority : 99;
    return priorityA - priorityB;
  });
}

function resolveAreasForVisuals(contentAreas: Box[], visualCount: number): Box[] {
  if (visualCount <= 0) {
    return [safeArea(contentAreas[0])];
  }

  if (contentAreas.length === 0) {
    return [];
  }

  if (visualCount <= contentAreas.length) {
    return contentAreas.slice(0, visualCount).map(safeArea);
  }

  const pinned = contentAreas.slice(0, contentAreas.length - 1).map(safeArea);
  const last = contentAreas[contentAreas.length - 1];
  const extraCount = visualCount - pinned.length;
  const split = splitAreaVertical(last, extraCount);
  return [...pinned, ...split];
}

function addPanel(
  slide: SlideLike,
  area: Box,
  context: RenderContext,
  options: { fill?: string; border?: string; borderPt?: number } = {}
): void {
  slide.addShape("roundRect", {
    x: area.x,
    y: area.y,
    w: area.w,
    h: area.h,
    radius: 0.015,
    fill: { color: options.fill ?? context.theme.colors.card_bg },
    line: { color: options.border ?? context.theme.colors.gray3, pt: options.borderPt ?? 0.5 }
  });
}

function fitContentToBox(
  text: string,
  box: Box,
  fontSize: number,
  useClaimFitter = false,
  minCapacity = 24,
  fillRatio = 0.88
): string {
  const safeFontSize = Math.max(MIN_FONT_PT, fontSize);
  if (useClaimFitter) {
    const cap = estimateCharCapacity(box, safeFontSize, { minCapacity, fillRatio });
    return fitClaimPreserveSoWhat(text, cap).text;
  }
  return fitTextByArea(text, box, safeFontSize, { minCapacity, fillRatio }).text;
}

function addIconBadge(
  slide: SlideLike,
  x: number,
  y: number,
  claimText: string,
  index: number,
  context: RenderContext,
  forcedColor?: string
): void {
  const semanticIcon = resolveSemanticIcon(claimText, index, context.theme);
  const color = forcedColor ?? semanticIcon.color;

  slide.addShape("roundRect", {
    x,
    y,
    w: ICON_CONTAINER,
    h: ICON_CONTAINER,
    radius: 0.03,
    fill: { color: "FFFFFF" },
    line: { color, pt: 0.5 }
  });

  const iconData = context.iconAssets?.get(semanticIcon.assetKey);
  if (iconData && slide.addImage) {
    slide.addImage({
      data: iconData,
      x: x + (ICON_CONTAINER - ICON_SIZE) / 2,
      y: y + (ICON_CONTAINER - ICON_SIZE) / 2,
      w: ICON_SIZE,
      h: ICON_SIZE
    });
    return;
  }

  slide.addText(semanticIcon.marker, {
    x: x + 0.09,
    y: y + 0.1,
    w: ICON_CONTAINER - 0.18,
    h: ICON_CONTAINER - 0.18,
    fontFace: context.theme.fonts.body,
    fontSize: MIN_FONT_PT,
    bold: true,
    color,
    align: "center",
    valign: "mid"
  });
}

function renderCover(slide: SlideLike, slideSpec: SlideSpecSlide, context: RenderContext): void {
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { color: context.theme.colors.background },
    line: { color: context.theme.colors.background, pt: 0 }
  });

  slide.addShape("rect", {
    x: 0.55,
    y: 0.72,
    w: 0.08,
    h: 3.76,
    fill: { color: context.theme.colors.primary },
    line: { color: context.theme.colors.primary, pt: 0 }
  });

  slide.addText(slideSpec.title, {
    x: 0.82,
    y: 1.08,
    w: 8.6,
    h: 1,
    fontFace: context.theme.fonts.body,
    fontSize: 28,
    bold: true,
    color: context.theme.colors.text,
    fit: "shrink",
    breakLine: true
  });

  const coverBodyBox: Box = { x: 0.82, y: 2.18, w: 8.2, h: 1.38 };
  slide.addText(fitContentToBox(slideSpec.governing_message, coverBodyBox, 11, false, 70, 0.9), {
    x: 0.82,
    y: 2.18,
    w: 8.2,
    h: 1.38,
    fontFace: context.theme.fonts.body,
    fontSize: 11,
    color: context.theme.colors.text,
    breakLine: true,
    fit: "shrink"
  });

  slide.addShape("roundRect", {
    x: 0.82,
    y: 3.74,
    w: 3.7,
    h: 0.54,
    radius: 0.02,
    fill: { color: context.theme.colors.blue_bg },
    line: { color: context.theme.colors.primary, pt: 0.5 }
  });
  slide.addText("Executive Strategy Brief", {
    x: 0.98,
    y: 3.92,
    w: 3.4,
    h: 0.18,
    fontFace: context.theme.fonts.body,
    fontSize: 9,
    bold: true,
    color: context.theme.colors.primary,
    align: "left"
  });

  slide.addText("Confidential | Strategy Discussion Draft", {
    x: 0.82,
    y: 5.02,
    w: 8.6,
    h: 0.16,
    fontFace: context.theme.fonts.body,
    fontSize: 8,
    color: context.theme.colors.gray1
  });
}

function resolveTableRows(slideSpec: SlideSpecSlide, context: RenderContext): Array<Array<string | number>> {
  const tableVisual = slideSpec.visuals.find((visual) => visual.kind === "table");
  const tableId = tableVisual?.data_ref;
  const table = tableId ? context.tablesById?.get(tableId) : undefined;

  if (table && table.columns.length > 0) {
    const rows: Array<Array<string | number>> = [table.columns];
    for (const row of table.rows.slice(0, 8)) {
      rows.push(
        table.columns.map((column) => {
          const value = row[column];
          if (value === undefined || value === null) {
            return "-";
          }
          return typeof value === "number" ? Number(value.toFixed(2)) : String(value);
        })
      );
    }
    return rows;
  }

  const fallbackRows: Array<Array<string | number>> = [["항목", "핵심 관찰", "시사점", "우선순위"]];
  slideSpec.claims.slice(0, 6).forEach((claim, index) => {
    fallbackRows.push([`항목 ${index + 1}`, fitTextToCapacity(claim.text, 56).text, "실행 필요", index < 2 ? "High" : "Mid"]);
  });

  return fallbackRows;
}

function parseNumericValue(raw: string): number | undefined {
  const normalized = raw.replace(/[,\s]/g, "");
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized.replace(/(억원|조원|%|x|배|ppt)/g, ""));
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function isDataVisual(kind: SlideVisual["kind"]): boolean {
  return kind === "table" || kind === "bar-chart" || kind === "pie-chart" || kind === "matrix" || kind === "timeline" || kind === "flow";
}

function hasDataVisual(visuals: SlideVisual[]): boolean {
  return visuals.some((visual) => isDataVisual(visual.kind));
}

function renderBullets(slide: SlideLike, slideSpec: SlideSpecSlide, area: Box, context: RenderContext): void {
  addPanel(slide, area, context);

  const lines = slideSpec.claims.slice(0, 5);
  const lineGap = Math.max(0.44, (area.h - 0.28) / Math.max(lines.length, 1));

  lines.forEach((claim, index) => {
    const y = area.y + 0.12 + index * lineGap;
    addIconBadge(slide, area.x + 0.1, y + 0.02, claim.text, index, context, context.theme.colors.secondary);

    const rowBox: Box = {
      x: area.x + 0.5,
      y,
      w: area.w - 0.58,
      h: lineGap - 0.04
    };

    slide.addText(fitContentToBox(claim.text, rowBox, 8, true, 52, 0.86), {
      x: area.x + 0.5,
      y,
      w: area.w - 0.58,
      h: lineGap - 0.04,
      fontFace: context.theme.fonts.body,
      fontSize: 8,
      color: context.theme.colors.text,
      breakLine: true,
      fit: "shrink",
      valign: "mid"
    });
  });
}

function renderIconList(slide: SlideLike, slideSpec: SlideSpecSlide, area: Box, context: RenderContext): void {
  addPanel(slide, area, context);

  const claims = slideSpec.claims.slice(0, 4);
  const rowH = (area.h - 0.2) / Math.max(claims.length, 1);

  claims.forEach((claim, index) => {
    const rowY = area.y + 0.08 + index * rowH;
    const color = index % 2 === 0 ? context.theme.colors.primary : context.theme.colors.secondary;
    addIconBadge(slide, area.x + 0.08, rowY + 0.02, claim.text, index, context, color);

    const rowBox: Box = {
      x: area.x + 0.5,
      y: rowY,
      w: area.w - 0.58,
      h: rowH - 0.03
    };

    slide.addText(fitContentToBox(claim.text, rowBox, 8, true, 46, 0.85), {
      x: area.x + 0.5,
      y: rowY,
      w: area.w - 0.58,
      h: rowH - 0.03,
      fontFace: context.theme.fonts.body,
      fontSize: 8,
      color: context.theme.colors.text,
      breakLine: true,
      fit: "shrink",
      valign: "mid"
    });
  });
}

function renderKpiCards(slide: SlideLike, slideSpec: SlideSpecSlide, area: Box, context: RenderContext): void {
  const claims = slideSpec.claims.map((claim) => claim.text);
  const values = extractNumbersFromClaims(claims);
  const cardCount = Math.min(4, Math.max(3, claims.length));
  const gap = 0.08;
  const cardW = (area.w - gap * (cardCount - 1)) / cardCount;

  for (let i = 0; i < cardCount; i += 1) {
    const cardX = area.x + i * (cardW + gap);
    const cardArea: Box = { x: cardX, y: area.y, w: cardW, h: area.h };
    addPanel(slide, cardArea, context, { fill: context.theme.colors.gray4 });

    const claimText = claims[i % Math.max(claims.length, 1)] ?? "핵심 KPI";
    const value = values[i % Math.max(values.length, 1)] ?? (18 + i * 6);

    addIconBadge(slide, cardX + 0.08, area.y + 0.1, claimText, i, context, context.theme.colors.primary);

    slide.addText(`KPI ${i + 1}`, {
      x: cardX + 0.48,
      y: area.y + 0.16,
      w: cardW - 0.56,
      h: 0.12,
      fontFace: context.theme.fonts.body,
      fontSize: MIN_FONT_PT,
      color: context.theme.colors.gray1,
      bold: true
    });

    slide.addText(String(value), {
      x: cardX + 0.08,
      y: area.y + 0.44,
      w: cardW - 0.16,
      h: 0.35,
      fontFace: context.theme.fonts.title,
      fontSize: context.theme.typography.kpi_size,
      bold: true,
      color: context.theme.colors.primary,
      align: "left"
    });

    const claimBox: Box = {
      x: cardX + 0.08,
      y: area.y + 0.86,
      w: cardW - 0.16,
      h: area.h - 0.92
    };

    slide.addText(fitContentToBox(claimText, claimBox, 7.5, true, 36, 0.86), {
      x: cardX + 0.08,
      y: area.y + 0.86,
      w: cardW - 0.16,
      h: area.h - 0.92,
      fontFace: context.theme.fonts.body,
      fontSize: 7.5,
      color: context.theme.colors.text,
      fit: "shrink",
      breakLine: true
    });
  }
}

function renderBarChart(slide: SlideLike, slideSpec: SlideSpecSlide, area: Box, context: RenderContext): void {
  addPanel(slide, area, context, { fill: "FFFFFF" });

  const values = extractNumbersFromClaims(slideSpec.claims.map((claim) => claim.text)).slice(0, 6);
  const chartValues = values.length >= 4 ? values : [18, 22, 25, 29, 33];
  const labels = chartValues.map((_, index) => `P${index + 1}`);
  const maxValue = Math.max(...chartValues, 1);

  const chartX = area.x + 0.32;
  const chartY = area.y + 0.34;
  const chartW = Math.max(0.8, area.w - 0.52);
  const chartH = Math.max(0.7, area.h - 0.78);
  const axisBottom = chartY + chartH;
  const colors = [context.theme.colors.primary, context.theme.colors.secondary, context.theme.colors.gray1];

  slide.addText("Data Trend", {
    x: area.x + 0.08,
    y: area.y + 0.08,
    w: area.w - 0.16,
    h: 0.14,
    fontFace: context.theme.fonts.body,
    fontSize: 8,
    bold: true,
    color: context.theme.colors.primary
  });

  for (let step = 1; step <= 3; step += 1) {
    const gy = chartY + (chartH * step) / 4;
    slide.addShape("line", {
      x: chartX,
      y: gy,
      w: chartW,
      h: 0,
      line: { color: CHART_GRID, pt: 0.5 }
    });
  }

  slide.addShape("line", {
    x: chartX,
    y: axisBottom,
    w: chartW,
    h: 0,
    line: { color: context.theme.colors.gray2, pt: 0.5 }
  });

  const barW = chartW / chartValues.length;
  chartValues.forEach((value, index) => {
    const normalized = (chartH * value) / maxValue;
    const h = Math.max(0.05, normalized);
    const x = chartX + index * barW + 0.04;
    const y = axisBottom - h;
    const color = colors[index % colors.length];

    slide.addShape("rect", {
      x,
      y,
      w: Math.max(0.06, barW - 0.08),
      h,
      fill: { color },
      line: { color, pt: 0.2 }
    });

    slide.addText(String(value), {
      x,
      y: y - 0.11,
      w: Math.max(0.06, barW - 0.08),
      h: 0.1,
      fontFace: context.theme.fonts.body,
      fontSize: 7,
      color: context.theme.colors.gray1,
      align: "center"
    });

    slide.addText(labels[index], {
      x,
      y: axisBottom + 0.04,
      w: Math.max(0.06, barW - 0.08),
      h: 0.1,
      fontFace: context.theme.fonts.body,
      fontSize: 8,
      color: context.theme.colors.gray1,
      align: "center"
    });
  });

  const legendY = area.y + area.h - 0.2;
  [
    { label: "Primary", color: context.theme.colors.primary },
    { label: "Secondary", color: context.theme.colors.secondary },
    { label: "Reference", color: context.theme.colors.gray1 }
  ].forEach((legend, index) => {
    const lx = area.x + 0.18 + index * 1.1;
    slide.addShape("rect", {
      x: lx,
      y: legendY,
      w: 0.12,
      h: 0.08,
      fill: { color: legend.color },
      line: { color: legend.color, pt: 0 }
    });
    slide.addText(legend.label, {
      x: lx + 0.15,
      y: legendY - 0.02,
      w: 0.85,
      h: 0.12,
      fontFace: context.theme.fonts.body,
      fontSize: 8,
      color: context.theme.colors.gray1
    });
  });
}

function renderTable(slide: SlideLike, slideSpec: SlideSpecSlide, area: Box, context: RenderContext): void {
  const rows = resolveTableRows(slideSpec, context);
  const [headerRow, ...bodyRows] = rows;
  const styledRows = [
    headerRow.map((cell, index) => ({
      text: String(cell),
      options: makeHeaderOpts(context.theme, { align: index === 0 ? "left" : "center" })
    })),
    ...bodyRows.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        const rawText = String(cell);
        const numericValue = typeof cell === "number" ? cell : parseNumericValue(rawText);
        const align = numericValue !== undefined ? "right" : "left";
        const positive = numericValue !== undefined && numericValue > 0;
        const negative = numericValue !== undefined && numericValue < 0;
        const isCompany = isEntityLabelCell(rawText, colIndex);
        const color = negative
          ? context.theme.colors.red
          : positive
            ? context.theme.colors.secondary
            : isCompany
              ? context.theme.colors.primary
              : context.theme.colors.text;

        const cellOptions = {
          align,
          color,
          bold: isCompany
        } as const;

        return {
          text: rawText,
          options: rowIndex % 2 === 1 ? makeAltCellOpts(context.theme, cellOptions) : makeCellOpts(context.theme, cellOptions)
        };
      })
    )
  ];

  slide.addTable(styledRows, {
    x: area.x,
    y: area.y,
    w: area.w,
    h: area.h,
    border: { type: "solid", pt: 0.5, color: context.theme.colors.gray3 },
    fill: "FFFFFF"
  });
}

function renderMatrix(slide: SlideLike, slideSpec: SlideSpecSlide, area: Box, context: RenderContext): void {
  addPanel(slide, area, context, { fill: "FFFFFF" });

  const cellW = (area.w - 0.1) / 2;
  const cellH = (area.h - 0.16) / 2;
  const labels = [
    "High Impact / High Likelihood",
    "High Impact / Low Likelihood",
    "Low Impact / High Likelihood",
    "Low Impact / Low Likelihood"
  ];

  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const idx = row * 2 + col;
      const x = area.x + 0.02 + col * (cellW + 0.04);
      const y = area.y + 0.08 + row * (cellH + 0.06);

      slide.addShape("rect", {
        x,
        y,
        w: cellW,
        h: cellH,
        fill: { color: idx % 2 === 0 ? "FFFFFF" : context.theme.colors.alt_row },
        line: { color: context.theme.colors.gray3, pt: 0.5 }
      });

      slide.addText(labels[idx], {
        x: x + 0.04,
        y: y + 0.03,
        w: cellW - 0.08,
        h: 0.14,
        fontFace: context.theme.fonts.body,
        fontSize: MIN_FONT_PT,
        bold: true,
        color: context.theme.colors.gray1,
        fit: "shrink"
      });

      const claim = slideSpec.claims[idx % Math.max(slideSpec.claims.length, 1)]?.text ?? "핵심 리스크";
      const claimBox: Box = {
        x: x + 0.04,
        y: y + 0.2,
        w: cellW - 0.08,
        h: cellH - 0.24
      };
      slide.addText(fitContentToBox(claim, claimBox, MIN_FONT_PT, true, 34, 0.84), {
        x: x + 0.04,
        y: y + 0.2,
        w: cellW - 0.08,
        h: cellH - 0.24,
        fontFace: context.theme.fonts.body,
        fontSize: MIN_FONT_PT,
        color: context.theme.colors.text,
        breakLine: true,
        fit: "shrink"
      });
    }
  }
}

function renderTimeline(slide: SlideLike, slideSpec: SlideSpecSlide, area: Box, context: RenderContext): void {
  addPanel(slide, area, context, { fill: "FFFFFF" });

  const stages = [
    { label: "단기", color: context.theme.colors.primary },
    { label: "중기", color: context.theme.colors.secondary },
    { label: "장기", color: context.theme.colors.purple }
  ];
  const stageW = area.w / stages.length;
  const lineY = area.y + 0.38;

  slide.addShape("line", {
    x: area.x + 0.2,
    y: lineY,
    w: area.w - 0.4,
    h: 0,
    line: { color: context.theme.colors.gray2, pt: 0.8 }
  });

  for (let i = 0; i < stages.length; i += 1) {
    const stageX = area.x + i * stageW;
    const stage = stages[i];

    slide.addShape("ellipse", {
      x: stageX + stageW / 2 - 0.08,
      y: lineY - 0.08,
      w: 0.16,
      h: 0.16,
      fill: { color: stage.color },
      line: { color: stage.color, pt: 0.2 }
    });

    slide.addText(stage.label, {
      x: stageX + 0.04,
      y: lineY + 0.1,
      w: stageW - 0.08,
      h: 0.14,
      fontFace: context.theme.fonts.body,
      fontSize: 8,
      bold: true,
      color: stage.color,
      align: "center"
    });

    const claim = slideSpec.claims[i % Math.max(slideSpec.claims.length, 1)]?.text ?? "핵심 실행 과제";
    slide.addShape("roundRect", {
      x: stageX + 0.06,
      y: lineY + 0.26,
      w: stageW - 0.12,
      h: area.h - 0.7,
      radius: 0.02,
      fill: { color: context.theme.colors.card_bg },
      line: { color: context.theme.colors.gray3, pt: 0.5 }
    });
    const claimBox: Box = {
      x: stageX + 0.1,
      y: lineY + 0.34,
      w: stageW - 0.2,
      h: area.h - 0.84
    };
    slide.addText(fitContentToBox(claim, claimBox, MIN_FONT_PT, true, 34, 0.86), {
      x: stageX + 0.1,
      y: lineY + 0.34,
      w: stageW - 0.2,
      h: area.h - 0.84,
      fontFace: context.theme.fonts.body,
      fontSize: MIN_FONT_PT,
      color: context.theme.colors.text,
      breakLine: true,
      fit: "shrink"
    });
  }
}

function renderFlow(slide: SlideLike, slideSpec: SlideSpecSlide, area: Box, context: RenderContext): void {
  addPanel(slide, area, context, { fill: "FFFFFF" });

  const rawSteps = slideSpec.claims.slice(0, 4).map((claim) => claim.text);
  while (rawSteps.length < 4) {
    rawSteps.push(`Step ${rawSteps.length + 1}`);
  }

  const stepW = (area.w - 0.3) / rawSteps.length;

  for (let i = 0; i < rawSteps.length; i += 1) {
    const x = area.x + i * stepW;
    const active = i === 1 || i === 2;
    const fillColor = active ? context.theme.colors.blue_bg : "FFFFFF";

    slide.addShape("roundRect", {
      x,
      y: area.y + 0.32,
      w: stepW - 0.06,
      h: area.h - 0.52,
      radius: 0.02,
      fill: { color: fillColor },
      line: { color: context.theme.colors.gray3, pt: 0.5 }
    });

    const stepBox: Box = {
      x: x + 0.04,
      y: area.y + 0.4,
      w: stepW - 0.14,
      h: area.h - 0.68
    };

    slide.addText(fitContentToBox(rawSteps[i], stepBox, MIN_FONT_PT, true, 28, 0.84), {
      x: x + 0.04,
      y: area.y + 0.4,
      w: stepW - 0.14,
      h: area.h - 0.68,
      fontFace: context.theme.fonts.body,
      fontSize: MIN_FONT_PT,
      color: context.theme.colors.text,
      breakLine: true,
      fit: "shrink",
      align: "center",
      valign: "mid"
    });

    if (i < rawSteps.length - 1) {
      slide.addText(">", {
        x: x + stepW - 0.07,
        y: area.y + area.h / 2 - 0.07,
        w: 0.06,
        h: 0.14,
        fontFace: context.theme.fonts.body,
        fontSize: 11,
        bold: true,
        color: context.theme.colors.gray2,
        align: "center"
      });
    }
  }
}

function renderPie(slide: SlideLike, area: Box, context: RenderContext): void {
  addPanel(slide, area, context, { fill: "FFFFFF" });

  const sections = [
    { label: "Premium", value: 42, color: context.theme.colors.primary },
    { label: "Mid", value: 35, color: context.theme.colors.secondary },
    { label: "Entry", value: 23, color: context.theme.colors.gray1 }
  ];

  slide.addText("Portfolio Mix (%)", {
    x: area.x + 0.08,
    y: area.y + 0.08,
    w: area.w - 0.16,
    h: 0.14,
    fontFace: context.theme.fonts.body,
    fontSize: 8,
    bold: true,
    color: context.theme.colors.primary
  });

  const total = sections.reduce((acc, section) => acc + section.value, 0);
  const barX = area.x + 0.1;
  const barY = area.y + 0.34;
  const barW = area.w - 0.2;

  let cursor = barX;
  for (const section of sections) {
    const w = (barW * section.value) / total;
    slide.addShape("rect", {
      x: cursor,
      y: barY,
      w,
      h: 0.28,
      fill: { color: section.color },
      line: { color: section.color, pt: 0 }
    });
    cursor += w;
  }

  sections.forEach((section, index) => {
    const y = area.y + 0.8 + index * 0.28;
    slide.addShape("rect", {
      x: area.x + 0.16,
      y,
      w: 0.12,
      h: 0.12,
      fill: { color: section.color },
      line: { color: section.color, pt: 0 }
    });
    slide.addText(`${section.label} ${section.value}%`, {
      x: area.x + 0.34,
      y,
      w: area.w - 0.44,
      h: 0.12,
      fontFace: context.theme.fonts.body,
      fontSize: 8,
      color: context.theme.colors.text
    });
  });
}

function renderActionCards(slide: SlideLike, slideSpec: SlideSpecSlide, area: Box, context: RenderContext): void {
  const cardCount = 3;
  const gap = 0.08;
  const cardW = (area.w - gap * (cardCount - 1)) / cardCount;

  for (let i = 0; i < cardCount; i += 1) {
    const cardX = area.x + i * (cardW + gap);
    const color = i === 0 ? context.theme.colors.primary : context.theme.colors.secondary;

    addPanel(slide, { x: cardX, y: area.y, w: cardW, h: area.h }, context, { fill: "FFFFFF" });
    const claim = slideSpec.claims[i % Math.max(slideSpec.claims.length, 1)]?.text ?? "핵심 실행 과제";
    addIconBadge(slide, cardX + 0.08, area.y + 0.1, claim, i, context, color);

    slide.addText(`Action ${i + 1}`, {
      x: cardX + 0.5,
      y: area.y + 0.18,
      w: cardW - 0.58,
      h: 0.13,
      fontFace: context.theme.fonts.body,
      fontSize: 8,
      bold: true,
      color
    });

    const claimBox: Box = {
      x: cardX + 0.08,
      y: area.y + 0.5,
      w: cardW - 0.16,
      h: area.h - 0.58
    };
    slide.addText(fitContentToBox(claim, claimBox, MIN_FONT_PT, true, 38, 0.86), {
      x: cardX + 0.08,
      y: area.y + 0.5,
      w: cardW - 0.16,
      h: area.h - 0.58,
      fontFace: context.theme.fonts.body,
      fontSize: MIN_FONT_PT,
      color: context.theme.colors.text,
      breakLine: true,
      fit: "shrink"
    });
  }
}

function renderSoWhatGrid(slide: SlideLike, slideSpec: SlideSpecSlide, area: Box, context: RenderContext): void {
  addPanel(slide, area, context, { fill: "FFFFFF" });

  const [top, bottom] = splitAreaVertical({ x: area.x + 0.02, y: area.y + 0.06, w: area.w - 0.04, h: area.h - 0.1 }, 2);

  renderInsightVariant(slide, slideSpec, top, context, "analysis");

  slide.addShape("roundRect", {
    x: bottom.x,
    y: bottom.y,
    w: bottom.w,
    h: bottom.h,
    radius: 0.02,
    fill: { color: context.theme.colors.green_bg },
    line: { color: context.theme.colors.green_border, pt: 0.5 }
  });
  slide.addText("Opportunity Tag", {
    x: bottom.x + 0.04,
    y: bottom.y + 0.04,
    w: bottom.w - 0.08,
    h: 0.14,
    fontFace: context.theme.fonts.body,
    fontSize: 8,
    bold: true,
    color: context.theme.colors.green
  });
  const priorityText = slideSpec.claims[1]?.text ?? slideSpec.claims[0]?.text ?? "실행 우선순위";
  const priorityBox: Box = {
    x: bottom.x + 0.04,
    y: bottom.y + 0.22,
    w: bottom.w - 0.08,
    h: bottom.h - 0.26
  };
  slide.addText(fitContentToBox(priorityText, priorityBox, 7.5, true, 48, 0.87), {
    x: bottom.x + 0.04,
    y: bottom.y + 0.22,
    w: bottom.w - 0.08,
    h: bottom.h - 0.26,
    fontFace: context.theme.fonts.body,
    fontSize: 7.5,
    color: context.theme.colors.text,
    breakLine: true,
    fit: "shrink"
  });
}

function renderInsightVariant(
  slide: SlideLike,
  slideSpec: SlideSpecSlide,
  area: Box,
  context: RenderContext,
  variant: InsightVariant
): void {
  if (variant === "key") {
    slide.addShape("roundRect", {
      x: area.x,
      y: area.y,
      w: area.w,
      h: area.h,
      radius: 0.015,
      fill: { color: context.theme.colors.warn_bg },
      line: { color: context.theme.colors.warn_border, pt: 0.5 }
    });

    slide.addText("Key Insight", {
      x: area.x + 0.08,
      y: area.y + 0.06,
      w: area.w - 0.16,
      h: 0.14,
      fontFace: context.theme.fonts.body,
      fontSize: 8,
      bold: true,
      color: context.theme.colors.yellow
    });

    const insightText = fitTextToCapacity(
      [slideSpec.claims[0]?.text, slideSpec.claims[1]?.text, slideSpec.claims[2]?.text].filter(Boolean).join("\n"),
      260
    ).text;
    const insightBox: Box = {
      x: area.x + 0.08,
      y: area.y + 0.24,
      w: area.w - 0.16,
      h: area.h - 0.3
    };
    slide.addText(fitContentToBox(insightText, insightBox, MIN_FONT_PT, false, 90, 0.92), {
      x: area.x + 0.08,
      y: area.y + 0.24,
      w: area.w - 0.16,
      h: area.h - 0.3,
      fontFace: context.theme.fonts.body,
      fontSize: MIN_FONT_PT,
      color: context.theme.colors.text,
      breakLine: true,
      fit: "shrink"
    });
    return;
  }

  slide.addShape("roundRect", {
    x: area.x,
    y: area.y,
    w: area.w,
    h: area.h,
    radius: 0.015,
    fill: { color: context.theme.colors.blue_bg },
    line: { color: context.theme.colors.primary, pt: 0.5 }
  });
  slide.addShape("rect", {
    x: area.x + 0.02,
    y: area.y + 0.04,
    w: 0.06,
    h: area.h - 0.08,
    fill: { color: context.theme.colors.primary },
    line: { color: context.theme.colors.primary, pt: 0 }
  });

  slide.addText("분석 인사이트", {
    x: area.x + 0.12,
    y: area.y + 0.06,
    w: area.w - 0.2,
    h: 0.16,
    fontFace: context.theme.fonts.body,
    fontSize: 10,
    bold: true,
    color: context.theme.colors.primary
  });

  const insightText = slideSpec.claims[0]?.text ?? "핵심 인사이트";
  const insightBox: Box = {
    x: area.x + 0.12,
    y: area.y + 0.26,
    w: area.w - 0.2,
    h: area.h - 0.34
  };
  slide.addText(fitContentToBox(insightText, insightBox, 7.5, true, 72, 0.9), {
    x: area.x + 0.12,
    y: area.y + 0.26,
    w: area.w - 0.2,
    h: area.h - 0.34,
    fontFace: context.theme.fonts.body,
    fontSize: 7.5,
    color: context.theme.colors.text,
    breakLine: true,
    fit: "shrink"
  });
}

function resolveInsightVariantByVisual(visual: SlideVisual): InsightVariant {
  const variant = visual.options?.variant;
  if (typeof variant === "string" && variant.toLowerCase().includes("analysis")) {
    return "analysis";
  }
  return "key";
}

function renderVisual(slide: SlideLike, slideSpec: SlideSpecSlide, visual: SlideVisual, area: Box, context: RenderContext): void {
  if (visual.kind === "bullets") {
    renderBullets(slide, slideSpec, area, context);
    return;
  }

  if (visual.kind === "table") {
    renderTable(slide, slideSpec, area, context);
    return;
  }

  if (visual.kind === "kpi-cards") {
    renderKpiCards(slide, slideSpec, area, context);
    return;
  }

  if (visual.kind === "matrix") {
    renderMatrix(slide, slideSpec, area, context);
    return;
  }

  if (visual.kind === "timeline") {
    renderTimeline(slide, slideSpec, area, context);
    return;
  }

  if (visual.kind === "bar-chart") {
    renderBarChart(slide, slideSpec, area, context);
    return;
  }

  if (visual.kind === "pie-chart") {
    renderPie(slide, area, context);
    return;
  }

  if (visual.kind === "flow") {
    renderFlow(slide, slideSpec, area, context);
    return;
  }

  if (visual.kind === "icon-list") {
    renderIconList(slide, slideSpec, area, context);
    return;
  }

  if (visual.kind === "action-cards") {
    renderActionCards(slide, slideSpec, area, context);
    return;
  }

  if (visual.kind === "so-what-grid") {
    renderSoWhatGrid(slide, slideSpec, area, context);
    return;
  }

  renderInsightVariant(slide, slideSpec, area, context, resolveInsightVariantByVisual(visual));
}

function addLayoutMetaBadge(slide: SlideLike, context: RenderContext): void {
  if (process.env.PPT_SHOW_LAYOUT_BADGE !== "1") {
    return;
  }

  const plan = context.layoutPlan;
  if (!plan) {
    return;
  }

  slide.addShape("roundRect", {
    x: 8.12,
    y: 0.07,
    w: 1.52,
    h: 0.22,
    radius: 0.02,
    fill: { color: context.theme.colors.gray4 },
    line: { color: context.theme.colors.gray3, pt: 0.3 }
  });

  slide.addText(`${plan.template} / ${plan.provider}`, {
    x: 8.16,
    y: 0.11,
    w: 1.44,
    h: 0.13,
    fontFace: context.theme.fonts.body,
    fontSize: MIN_FONT_PT,
    color: context.theme.colors.gray1,
    align: "center"
  });
}

export function renderConsultingSlide(slide: SlideLike, slideSpec: SlideSpecSlide, context: RenderContext): void {
  if (slideSpec.type === "cover" || slideSpec.id === "s01") {
    renderCover(slide, slideSpec, context);
    return;
  }

  addSlideTitle(slide, slideSpec.title, context.layout.title, context.theme);
  addTakeaway(slide, slideSpec.governing_message, context.layout.takeaway, context.theme);
  addLayoutMetaBadge(slide, context);

  const visuals = sortVisuals(slideSpec);
  const renderVisuals: SlideVisual[] = [...visuals];

  if (renderVisuals.length === 0) {
    renderVisuals.push({ kind: "bullets", options: { priority: 1 } });
    renderVisuals.push({ kind: "bar-chart", options: { priority: 99 } });
  } else if (!hasDataVisual(renderVisuals)) {
    renderVisuals.push({ kind: "bar-chart", options: { priority: 99 } });
  }

  const areas = resolveAreasForVisuals(context.layout.contentAreas, renderVisuals.length);
  renderVisuals.forEach((visual, index) => {
    const area = areas[index] ?? areas[areas.length - 1] ?? context.layout.content;
    renderVisual(slide, slideSpec, visual, area, context);
  });
}
