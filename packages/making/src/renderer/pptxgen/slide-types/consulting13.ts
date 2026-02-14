import { SlideSpecSlide } from "@consulting-ppt/shared";
import { addSlideTitle, addTakeaway } from "../components/slide-frame";
import { makeAltCellOpts, makeCellOpts, makeHeaderOpts } from "../components/table-style";
import { RenderContext, SlideLike } from "../types";

function extractNumber(text: string): string {
  const matched = text.match(/-?\d+[\d.,]*/);
  return matched ? matched[0] : "N/A";
}

function shortText(value: string, max = 64): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

function addBlueInsightBox(slide: SlideLike, x: number, y: number, w: number, h: number, text: string, context: RenderContext): void {
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    fill: { color: context.theme.colors.blue_bg },
    line: { color: context.theme.colors.primary, pt: 0.5 }
  });
  slide.addShape("rect", {
    x,
    y,
    w: 0.06,
    h,
    fill: { color: context.theme.colors.primary },
    line: { color: context.theme.colors.primary, pt: 0 }
  });
  slide.addText("Analysis Insight", {
    x: x + 0.1,
    y: y + 0.04,
    w: w - 0.16,
    h: 0.16,
    fontFace: context.theme.fonts.body,
    fontSize: context.theme.typography.section_head_size,
    bold: true,
    color: context.theme.colors.primary
  });
  slide.addText(shortText(text, 180), {
    x: x + 0.1,
    y: y + 0.22,
    w: w - 0.14,
    h: h - 0.26,
    fontFace: context.theme.fonts.body,
    fontSize: 7.5,
    color: context.theme.colors.text,
    fit: "shrink"
  });
}

function addYellowInsightBox(slide: SlideLike, x: number, y: number, w: number, h: number, text: string, context: RenderContext): void {
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    fill: { color: context.theme.colors.warn_bg },
    line: { color: context.theme.colors.warn_border, pt: 0.5 }
  });
  slide.addText("Key Insight", {
    x: x + 0.08,
    y: y + 0.04,
    w: w - 0.16,
    h: 0.16,
    fontFace: context.theme.fonts.body,
    fontSize: 8,
    bold: true,
    color: context.theme.colors.yellow
  });
  slide.addText(shortText(text, 260), {
    x: x + 0.08,
    y: y + 0.22,
    w: w - 0.14,
    h: h - 0.26,
    fontFace: context.theme.fonts.body,
    fontSize: 7,
    color: context.theme.colors.text,
    fit: "shrink"
  });
}

function addKpiBoxes(slide: SlideLike, claims: string[], x: number, y: number, w: number, h: number, count: number, context: RenderContext): void {
  const gap = 0.08;
  const boxW = (w - gap * (count - 1)) / count;

  for (let i = 0; i < count; i += 1) {
    const claim = claims[i % Math.max(claims.length, 1)] ?? "";
    const boxX = x + i * (boxW + gap);

    slide.addShape("roundRect", {
      x: boxX,
      y,
      w: boxW,
      h,
      radius: 0.04,
      fill: { color: context.theme.colors.gray4 },
      line: { color: context.theme.colors.gray3, pt: 0.5 }
    });
    slide.addText(`KPI ${i + 1}`, {
      x: boxX + 0.06,
      y: y + 0.05,
      w: boxW - 0.12,
      h: 0.14,
      fontFace: context.theme.fonts.body,
      fontSize: 7,
      bold: true,
      color: context.theme.colors.gray1
    });
    slide.addText(extractNumber(claim), {
      x: boxX + 0.06,
      y: y + 0.22,
      w: boxW - 0.12,
      h: 0.24,
      fontFace: context.theme.fonts.title,
      fontSize: 24,
      bold: true,
      color: context.theme.colors.primary
    });
    slide.addText(shortText(claim, 58), {
      x: boxX + 0.06,
      y: y + 0.5,
      w: boxW - 0.12,
      h: h - 0.54,
      fontFace: context.theme.fonts.body,
      fontSize: 7,
      color: context.theme.colors.text,
      fit: "shrink"
    });
  }
}

function addBulletChecklist(slide: SlideLike, claims: string[], x: number, y: number, w: number, h: number, context: RenderContext): void {
  const lines = claims.slice(0, 6).map((claim) => `✓ ${shortText(claim, 94)}`);
  slide.addText(lines.join("\n"), {
    x,
    y,
    w,
    h,
    fontFace: context.theme.fonts.body,
    fontSize: 8,
    color: context.theme.colors.text,
    breakLine: true,
    fit: "shrink"
  });
}

function addSimpleBarChart(
  slide: SlideLike,
  title: string,
  x: number,
  y: number,
  w: number,
  h: number,
  values: number[],
  context: RenderContext
): void {
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    fill: { color: "FFFFFF", transparency: 100 },
    line: { color: context.theme.colors.gray3, pt: 0.5 }
  });
  slide.addText(title, {
    x: x + 0.04,
    y: y + 0.02,
    w: w - 0.08,
    h: 0.14,
    fontFace: context.theme.fonts.body,
    fontSize: 8,
    bold: true,
    color: context.theme.colors.primary
  });

  const baseY = y + h - 0.26;
  const maxValue = Math.max(...values, 1);
  const barW = (w - 0.24) / values.length;

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    const barH = ((h - 0.58) * value) / maxValue;
    const barX = x + 0.12 + i * barW;
    const barY = baseY - barH;
    const color = i % 3 === 0 ? context.theme.colors.primary : i % 3 === 1 ? context.theme.colors.secondary : context.theme.colors.gray1;

    slide.addShape("rect", {
      x: barX,
      y: barY,
      w: barW - 0.06,
      h: barH,
      fill: { color },
      line: { color, pt: 0.25 }
    });
    slide.addText(String(value), {
      x: barX,
      y: barY - 0.11,
      w: barW - 0.06,
      h: 0.08,
      fontFace: context.theme.fonts.body,
      fontSize: 7,
      color: context.theme.colors.gray1,
      align: "center"
    });
  }
}

function tableRowsFromClaims(claims: string[], columns: string[], rowCount: number): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [columns];
  for (let i = 0; i < rowCount; i += 1) {
    const claim = claims[i % Math.max(claims.length, 1)] ?? "핵심 지표";
    rows.push([`항목 ${i + 1}`, shortText(claim, 30), "비교값", extractNumber(claim)]);
  }
  return rows;
}

function tableRowsFromData(
  columns: string[],
  dataRows: Array<Record<string, string | number>>,
  maxRows: number
): Array<Array<string | number>> {
  const limitedRows = dataRows.slice(0, maxRows);
  const rows: Array<Array<string | number>> = [columns];

  for (const row of limitedRows) {
    rows.push(
      columns.map((column) => {
        const value = row[column];
        if (value === undefined || value === null) {
          return "-";
        }
        return typeof value === "number" ? Number(value.toFixed(2)) : value;
      })
    );
  }

  return rows;
}

function resolveTableRows(
  slideSpec: SlideSpecSlide,
  claims: string[],
  fallbackColumns: string[],
  fallbackRowCount: number,
  context: RenderContext
): Array<Array<string | number>> {
  const tableVisual = slideSpec.visuals.find((visual) => visual.kind === "table");
  const tableId = tableVisual?.data_ref;
  if (!tableId) {
    return tableRowsFromClaims(claims, fallbackColumns, fallbackRowCount);
  }

  const table = context.tablesById?.get(tableId);
  if (!table || table.columns.length === 0) {
    return tableRowsFromClaims(claims, fallbackColumns, fallbackRowCount);
  }

  return tableRowsFromData(table.columns, table.rows, fallbackRowCount);
}

function addStyledTable(
  slide: SlideLike,
  rows: Array<Array<string | number>>,
  x: number,
  y: number,
  w: number,
  h: number,
  context: RenderContext
): void {
  const [headerRow, ...bodyRows] = rows;
  const styledRows = [
    headerRow.map((cell) => ({ text: String(cell), options: makeHeaderOpts(context.theme) })),
    ...bodyRows.map((row, index) =>
      row.map((cell) => ({
        text: String(cell),
        options: index % 2 === 1 ? makeAltCellOpts(context.theme) : makeCellOpts(context.theme)
      }))
    )
  ];

  slide.addTable(styledRows, {
    x,
    y,
    w,
    h,
    border: { type: "solid", pt: 0.5, color: context.theme.colors.gray3 },
    fill: "FFFFFF"
  });
}

function addPositioningMatrix(slide: SlideLike, x: number, y: number, w: number, h: number, context: RenderContext): void {
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    fill: { color: "FFFFFF", transparency: 100 },
    line: { color: context.theme.colors.gray2, pt: 0.5 }
  });
  slide.addShape("line", { x, y: y + h / 2, w, h: 0, line: { color: context.theme.colors.gray2, pt: 0.5 } });
  slide.addShape("line", { x: x + w / 2, y, w: 0, h, line: { color: context.theme.colors.gray2, pt: 0.5 } });
  slide.addText("기술력 ↑", {
    x: x + 0.02,
    y: y + 0.02,
    w: 1.2,
    h: 0.12,
    fontFace: context.theme.fonts.body,
    fontSize: 7,
    color: context.theme.colors.gray1
  });
  slide.addText("시장 점유율 ↑", {
    x: x + w - 1.3,
    y: y + h - 0.14,
    w: 1.25,
    h: 0.12,
    fontFace: context.theme.fonts.body,
    fontSize: 7,
    color: context.theme.colors.gray1
  });

  const markers = [
    { x: 0.72, y: 0.24, color: context.theme.colors.primary, label: "KR-A" },
    { x: 0.58, y: 0.48, color: context.theme.colors.red, label: "CN-B" },
    { x: 0.38, y: 0.62, color: context.theme.colors.gray1, label: "JP-C" },
    { x: 0.21, y: 0.34, color: context.theme.colors.secondary, label: "KR-D" }
  ];

  for (const marker of markers) {
    const markerX = x + w * marker.x;
    const markerY = y + h * marker.y;
    slide.addShape("ellipse", {
      x: markerX - 0.055,
      y: markerY - 0.055,
      w: 0.11,
      h: 0.11,
      fill: { color: marker.color },
      line: { color: marker.color, pt: 0.4 }
    });
    slide.addText(marker.label, {
      x: markerX + 0.06,
      y: markerY - 0.03,
      w: 0.42,
      h: 0.08,
      fontFace: context.theme.fonts.body,
      fontSize: 7,
      color: context.theme.colors.text
    });
  }
}

function addFlowBlocks(slide: SlideLike, x: number, y: number, w: number, h: number, context: RenderContext): void {
  const steps = ["원료", "전구체", "양극재", "음극재", "셀/팩", "고객/OEM"];
  const blockW = (w - 0.3) / steps.length;
  for (let i = 0; i < steps.length; i += 1) {
    const stepX = x + i * blockW;
    const isHighlight = i === 2 || i === 3;
    const fillColor = isHighlight ? context.theme.colors.primary : context.theme.colors.card_bg;
    const textColor = isHighlight ? "FFFFFF" : context.theme.colors.text;

    slide.addShape("roundRect", {
      x: stepX,
      y,
      w: blockW - 0.05,
      h,
      radius: 0.03,
      fill: { color: fillColor },
      line: { color: context.theme.colors.gray3, pt: 0.5 }
    });
    slide.addText(steps[i], {
      x: stepX + 0.02,
      y: y + 0.07,
      w: blockW - 0.09,
      h: h - 0.14,
      fontFace: context.theme.fonts.body,
      fontSize: 7.5,
      color: textColor,
      bold: true,
      align: "center",
      valign: "mid"
    });

    if (i < steps.length - 1) {
      slide.addText(">", {
        x: stepX + blockW - 0.03,
        y: y + h / 2 - 0.05,
        w: 0.05,
        h: 0.1,
        fontFace: context.theme.fonts.body,
        fontSize: 10,
        color: context.theme.colors.gray2,
        bold: true,
        align: "center"
      });
    }
  }
}

function addThreeColumnSoWhat(slide: SlideLike, x: number, y: number, w: number, h: number, claims: string[], context: RenderContext): void {
  const headers = ["시장 구조", "기업 전략", "기술·투자"];
  const colW = (w - 0.16) / 3;

  for (let i = 0; i < 3; i += 1) {
    const colX = x + i * (colW + 0.08);
    slide.addShape("rect", {
      x: colX,
      y,
      w: colW,
      h,
      fill: { color: context.theme.colors.card_bg },
      line: { color: context.theme.colors.gray3, pt: 0.5 }
    });
    slide.addShape("rect", {
      x: colX,
      y,
      w: colW,
      h: 0.2,
      fill: { color: context.theme.colors.primary },
      line: { color: context.theme.colors.primary, pt: 0.1 }
    });
    slide.addText(headers[i], {
      x: colX + 0.03,
      y: y + 0.03,
      w: colW - 0.06,
      h: 0.14,
      fontFace: context.theme.fonts.body,
      fontSize: 8,
      bold: true,
      color: "FFFFFF",
      align: "center"
    });
    const columnLines = claims.slice(i, i + 4).map((claim) => `✓ ${shortText(claim, 48)}`).join("\n");
    slide.addText(columnLines, {
      x: colX + 0.04,
      y: y + 0.26,
      w: colW - 0.08,
      h: h - 0.3,
      fontFace: context.theme.fonts.body,
      fontSize: 7.5,
      color: context.theme.colors.text,
      breakLine: true,
      fit: "shrink"
    });
  }
}

function addThreeStageRoadmap(slide: SlideLike, x: number, y: number, w: number, context: RenderContext): void {
  const stages = [
    { title: "단기", color: context.theme.colors.primary },
    { title: "중기", color: context.theme.colors.secondary },
    { title: "장기", color: context.theme.colors.purple }
  ];
  const stageW = w / stages.length;
  const lineY = y + 0.24;

  slide.addShape("line", {
    x,
    y: lineY,
    w,
    h: 0,
    line: { color: context.theme.colors.gray2, pt: 0.6 }
  });

  for (let i = 0; i < stages.length; i += 1) {
    const stageX = x + i * stageW;
    slide.addShape("ellipse", {
      x: stageX + stageW / 2 - 0.07,
      y: lineY - 0.07,
      w: 0.14,
      h: 0.14,
      fill: { color: stages[i].color },
      line: { color: stages[i].color, pt: 0.2 }
    });
    slide.addText(stages[i].title, {
      x: stageX + stageW / 2 - 0.35,
      y: lineY + 0.1,
      w: 0.7,
      h: 0.12,
      fontFace: context.theme.fonts.body,
      fontSize: 8,
      bold: true,
      color: stages[i].color,
      align: "center"
    });

    for (let j = 0; j < 4; j += 1) {
      const cardY = y + 0.36 + j * 0.22;
      slide.addShape("roundRect", {
        x: stageX + 0.06,
        y: cardY,
        w: stageW - 0.12,
        h: 0.18,
        radius: 0.02,
        fill: { color: context.theme.colors.card_bg },
        line: { color: context.theme.colors.gray3, pt: 0.4 }
      });
      slide.addShape("rect", {
        x: stageX + 0.06,
        y: cardY,
        w: stageW - 0.12,
        h: 0.02,
        fill: { color: stages[i].color },
        line: { color: stages[i].color, pt: 0 }
      });
      slide.addText(`Action ${j + 1}`, {
        x: stageX + 0.09,
        y: cardY + 0.05,
        w: stageW - 0.18,
        h: 0.1,
        fontFace: context.theme.fonts.body,
        fontSize: 7,
        color: context.theme.colors.text,
        bold: true
      });
    }
  }
}

function renderCover(slide: SlideLike, slideSpec: SlideSpecSlide, context: RenderContext): void {
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { color: context.theme.colors.primary },
    line: { color: context.theme.colors.primary, pt: 0 }
  });
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 10,
    h: 0.06,
    fill: { color: context.theme.colors.secondary },
    line: { color: context.theme.colors.secondary, pt: 0 }
  });

  slide.addText(slideSpec.title, {
    x: 0.55,
    y: 1.35,
    w: 8.9,
    h: 0.88,
    fontFace: context.theme.fonts.title,
    fontSize: 36,
    bold: true,
    color: "FFFFFF",
    fit: "shrink"
  });
  slide.addText(shortText(slideSpec.governing_message, 120), {
    x: 0.55,
    y: 2.32,
    w: 8.9,
    h: 0.36,
    fontFace: context.theme.fonts.body,
    fontSize: 11,
    color: "FFFFFF"
  });
  slide.addText("Confidential | For Discussion Purposes Only", {
    x: 0.55,
    y: 4.95,
    w: 8.9,
    h: 0.14,
    fontFace: context.theme.fonts.body,
    fontSize: 8,
    color: "FFFFFF"
  });
}

export function renderConsultingSlide(slide: SlideLike, slideSpec: SlideSpecSlide, context: RenderContext): void {
  if (slideSpec.id === "s01") {
    renderCover(slide, slideSpec, context);
    return;
  }

  addSlideTitle(slide, slideSpec.title, context.layout.title, context.theme);
  addTakeaway(slide, slideSpec.governing_message, context.layout.takeaway, context.theme);

  if (slideSpec.id === "s02") {
    addKpiBoxes(slide, slideSpec.claims.map((claim) => claim.text), context.layout.content.x, 1.02, context.layout.content.w, 1.05, 4, context);
    addBulletChecklist(slide, slideSpec.claims.map((claim) => claim.text), context.layout.content.x, 2.14, context.layout.content.w, 2.9, context);
    return;
  }

  if (slideSpec.id === "s03") {
    addSimpleBarChart(slide, "Main Market Growth (2022-2032)", context.layout.leftBody.x, 1.0, 4.55, 1.6, [12, 15, 18, 22, 26], context);
    addSimpleBarChart(slide, "Sub Market Growth (2022-2032)", context.layout.rightBody.x, 1.0, 4.5, 1.6, [8, 10, 13, 17, 21], context);
    addKpiBoxes(slide, slideSpec.claims.map((claim) => claim.text), 0.35, 2.72, 9.3, 0.95, 4, context);
    addBlueInsightBox(slide, 0.35, 3.8, 9.3, 1.2, slideSpec.claims[0]?.text ?? "", context);
    return;
  }

  if (slideSpec.id === "s04") {
    addPositioningMatrix(slide, 0.35, 1.02, 4.45, 2.9, context);
    addStyledTable(
      slide,
      resolveTableRows(
        slideSpec,
        slideSpec.claims.map((claim) => claim.text),
        ["순위", "기업", "지표", "비고"],
        10,
        context
      ),
      4.95,
      1.02,
      4.7,
      2.9,
      context
    );
    addBlueInsightBox(slide, 0.35, 4.05, 9.3, 0.95, slideSpec.claims[1]?.text ?? "", context);
    return;
  }

  if (slideSpec.id === "s05") {
    addStyledTable(
      slide,
      resolveTableRows(
        slideSpec,
        slideSpec.claims.map((claim) => claim.text),
        ["구분", "2022", "2023", "2024"],
        5,
        context
      ),
      0.35,
      1.02,
      4.6,
      1.65,
      context
    );
    addShapeCards(slide, 0.35, 2.76, 4.6, 1.24, 5, context, "Strategy");
    addPiePlaceholder(slide, 5.1, 1.02, 2.0, 2.0, context);
    addYellowInsightBox(slide, 7.22, 1.02, 2.43, 2.98, slideSpec.claims[0]?.text ?? "", context);
    return;
  }

  if (slideSpec.id === "s06") {
    addStyledTable(
      slide,
      resolveTableRows(
        slideSpec,
        slideSpec.claims.map((claim) => claim.text),
        ["구분", "기업A", "기업B", "기업C"],
        10,
        context
      ),
      0.35,
      1.0,
      9.3,
      4.1,
      context
    );
    return;
  }

  if (slideSpec.id === "s07") {
    addStyledTable(
      slide,
      resolveTableRows(
        slideSpec,
        slideSpec.claims.map((claim) => claim.text),
        ["항목", "제품A", "제품B", "제품C"],
        6,
        context
      ),
      0.35,
      1.0,
      4.55,
      2.9,
      context
    );
    addStyledTable(
      slide,
      tableRowsFromClaims(slideSpec.claims.map((claim) => claim.text), ["세부항목", "A", "B", "C"], 6),
      5.0,
      1.0,
      4.65,
      2.9,
      context
    );
    addThreeStageRoadmap(slide, 0.35, 3.95, 9.3, context);
    return;
  }

  if (slideSpec.id === "s08") {
    addFlowBlocks(slide, 0.35, 1.2, 9.3, 0.72, context);
    addBlueInsightBox(slide, 0.35, 2.06, 9.3, 2.9, slideSpec.claims[0]?.text ?? "", context);
    return;
  }

  if (slideSpec.id === "s09") {
    addSimpleBarChart(slide, "Revenue Comparison", 0.35, 1.0, 4.5, 2.2, [18, 22, 25], context);
    addStyledTable(
      slide,
      resolveTableRows(
        slideSpec,
        slideSpec.claims.map((claim) => claim.text),
        ["지표", "기업A", "기업B", "기업C"],
        10,
        context
      ),
      5.0,
      1.0,
      4.65,
      2.2,
      context
    );
    addYellowInsightBox(slide, 0.35, 3.35, 9.3, 1.65, slideSpec.claims[1]?.text ?? "", context);
    return;
  }

  if (slideSpec.id === "s10") {
    addTrendCards(slide, 0.35, 1.0, 9.3, 3.95, slideSpec.claims.map((claim) => claim.text), context);
    return;
  }

  if (slideSpec.id === "s11") {
    addPositioningMatrix(slide, 0.35, 1.0, 4.5, 3.95, context);
    addBulletChecklist(slide, slideSpec.claims.map((claim) => claim.text), 5.0, 1.0, 4.65, 3.95, context);
    return;
  }

  if (slideSpec.id === "s12") {
    addThreeColumnSoWhat(slide, 0.35, 1.0, 9.3, 3.2, slideSpec.claims.map((claim) => claim.text), context);
    slide.addShape("roundRect", {
      x: 0.35,
      y: 4.35,
      w: 9.3,
      h: 0.62,
      radius: 0.03,
      fill: { color: context.theme.colors.secondary },
      line: { color: context.theme.colors.secondary, pt: 0.2 }
    });
    slide.addText(shortText(slideSpec.claims[0]?.text ?? "핵심 전략 방향", 110), {
      x: 0.5,
      y: 4.54,
      w: 9.0,
      h: 0.22,
      fontFace: context.theme.fonts.body,
      fontSize: 9,
      bold: true,
      color: "FFFFFF",
      align: "center"
    });
    return;
  }

  if (slideSpec.id === "s13") {
    addThreeStageRoadmap(slide, 0.35, 1.0, 9.3, context);
    return;
  }

  addBulletChecklist(slide, slideSpec.claims.map((claim) => claim.text), context.layout.content.x, context.layout.content.y, context.layout.content.w, context.layout.content.h, context);
}

function addShapeCards(
  slide: SlideLike,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  context: RenderContext,
  labelPrefix: string
): void {
  const gap = 0.05;
  const cardW = (w - gap * (count - 1)) / count;
  for (let i = 0; i < count; i += 1) {
    const cardX = x + i * (cardW + gap);
    slide.addShape("roundRect", {
      x: cardX,
      y,
      w: cardW,
      h,
      radius: 0.02,
      fill: { color: context.theme.colors.card_bg },
      line: { color: context.theme.colors.gray3, pt: 0.4 }
    });
    slide.addText(`${labelPrefix} ${i + 1}`, {
      x: cardX + 0.03,
      y: y + 0.06,
      w: cardW - 0.06,
      h: 0.12,
      fontFace: context.theme.fonts.body,
      fontSize: 7,
      bold: true,
      color: context.theme.colors.primary,
      align: "center"
    });
  }
}

function addPiePlaceholder(slide: SlideLike, x: number, y: number, w: number, h: number, context: RenderContext): void {
  const size = Math.min(w, h);
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  slide.addShape("ellipse", {
    x: centerX - size / 2,
    y: centerY - size / 2,
    w: size,
    h: size,
    fill: { color: context.theme.colors.primary },
    line: { color: context.theme.colors.gray3, pt: 0.4 }
  });
  slide.addShape("ellipse", {
    x: centerX - size / 2 + 0.08,
    y: centerY - size / 2 + 0.08,
    w: size - 0.16,
    h: size - 0.16,
    fill: { color: context.theme.colors.secondary },
    line: { color: context.theme.colors.secondary, pt: 0.4 }
  });
}

function addTrendCards(
  slide: SlideLike,
  x: number,
  y: number,
  w: number,
  h: number,
  claims: string[],
  context: RenderContext
): void {
  const rows = 5;
  const rowH = h / rows;
  for (let i = 0; i < rows; i += 1) {
    const rowY = y + i * rowH;
    slide.addShape("line", {
      x,
      y: rowY + rowH - 0.02,
      w,
      h: 0,
      line: { color: context.theme.colors.gray3, pt: 0.3 }
    });
    slide.addShape("ellipse", {
      x: x + 0.04,
      y: rowY + 0.07,
      w: 0.16,
      h: 0.16,
      fill: { color: i % 2 === 0 ? context.theme.colors.primary : context.theme.colors.secondary },
      line: { color: context.theme.colors.gray3, pt: 0.3 }
    });
    slide.addText(`Trend ${i + 1}`, {
      x: x + 0.24,
      y: rowY + 0.06,
      w: 1.0,
      h: 0.12,
      fontFace: context.theme.fonts.body,
      fontSize: 8,
      bold: true,
      color: context.theme.colors.primary
    });
    slide.addText(shortText(claims[i % Math.max(claims.length, 1)] ?? "핵심 트렌드", 100), {
      x: x + 1.25,
      y: rowY + 0.06,
      w: 6.7,
      h: 0.14,
      fontFace: context.theme.fonts.body,
      fontSize: 7.5,
      color: context.theme.colors.text
    });
    slide.addShape("roundRect", {
      x: x + w - 1.2,
      y: rowY + 0.05,
      w: 1.1,
      h: 0.16,
      radius: 0.02,
      fill: { color: context.theme.colors.green_bg },
      line: { color: context.theme.colors.green_border, pt: 0.4 }
    });
    slide.addText("Opportunity", {
      x: x + w - 1.16,
      y: rowY + 0.08,
      w: 1.02,
      h: 0.1,
      fontFace: context.theme.fonts.body,
      fontSize: 7,
      color: context.theme.colors.green,
      bold: true,
      align: "center"
    });
  }
}
