import { SlideType } from "@consulting-ppt/shared";

export type AdaptiveLayoutTemplate =
  | "cover-hero"
  | "single-panel"
  | "two-column"
  | "top-bottom"
  | "left-focus"
  | "right-focus"
  | "quad"
  | "timeline"
  | "kpi-dashboard";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutSlots {
  template: AdaptiveLayoutTemplate;
  title: Box;
  takeaway: Box;
  governingMessage: Box;
  content: Box;
  leftBody: Box;
  rightBody: Box;
  footer: Box;
  source: Box;
  pageNumber: Box;
  contentAreas: Box[];
}

const PAGE = {
  left: 0.35,
  right: 9.65,
  titleY: 0.08,
  takeawayY: 0.48,
  contentY: 0.95,
  contentBottom: 5.15,
  sourceY: 5.25,
  pageY: 5.3
};

function baseLayout(): Omit<LayoutSlots, "template" | "contentAreas"> {
  const width = PAGE.right - PAGE.left;
  const content: Box = { x: PAGE.left, y: PAGE.contentY, w: width, h: PAGE.contentBottom - PAGE.contentY };

  return {
    title: { x: PAGE.left, y: PAGE.titleY, w: width, h: 0.28 },
    takeaway: { x: PAGE.left, y: PAGE.takeawayY, w: width, h: 0.34 },
    governingMessage: { x: PAGE.left, y: PAGE.takeawayY, w: width, h: 0.34 },
    content,
    leftBody: { ...content },
    rightBody: { ...content },
    footer: { x: PAGE.left, y: PAGE.sourceY, w: width, h: 0.12 },
    source: { x: PAGE.left, y: PAGE.sourceY, w: width, h: 0.12 },
    pageNumber: { x: 9.2, y: PAGE.pageY, w: 0.45, h: 0.12 }
  };
}

function padBox(box: Box, pad = 0.02): Box {
  return {
    x: box.x + pad,
    y: box.y + pad,
    w: Math.max(0.1, box.w - pad * 2),
    h: Math.max(0.1, box.h - pad * 2)
  };
}

function splitColumns(content: Box, ratio = 0.5, gap = 0.1): [Box, Box] {
  const leftW = content.w * ratio - gap / 2;
  const rightW = content.w - leftW - gap;
  return [
    { x: content.x, y: content.y, w: leftW, h: content.h },
    { x: content.x + leftW + gap, y: content.y, w: rightW, h: content.h }
  ];
}

function splitRows(content: Box, ratio = 0.5, gap = 0.1): [Box, Box] {
  const topH = content.h * ratio - gap / 2;
  const bottomH = content.h - topH - gap;
  return [
    { x: content.x, y: content.y, w: content.w, h: topH },
    { x: content.x, y: content.y + topH + gap, w: content.w, h: bottomH }
  ];
}

function areasForTemplate(template: AdaptiveLayoutTemplate, content: Box): Box[] {
  if (template === "cover-hero") {
    return [
      {
        x: 0.7,
        y: 2.7,
        w: 8.6,
        h: 1.95
      }
    ].map((box) => padBox(box, 0));
  }

  if (template === "single-panel") {
    return [padBox(content, 0.02)];
  }

  if (template === "two-column") {
    const [left, right] = splitColumns(content, 0.5, 0.14);
    return [padBox(left), padBox(right)];
  }

  if (template === "top-bottom") {
    const [top, bottom] = splitRows(content, 0.43, 0.12);
    return [padBox(top), padBox(bottom)];
  }

  if (template === "left-focus") {
    const [left, right] = splitColumns(content, 0.58, 0.14);
    const [rightTop, rightBottom] = splitRows(right, 0.48, 0.1);
    return [padBox(left), padBox(rightTop), padBox(rightBottom)];
  }

  if (template === "right-focus") {
    const [left, right] = splitColumns(content, 0.42, 0.14);
    const [leftTop, leftBottom] = splitRows(left, 0.48, 0.1);
    return [padBox(right), padBox(leftTop), padBox(leftBottom)];
  }

  if (template === "quad") {
    const [top, bottom] = splitRows(content, 0.5, 0.12);
    const [topLeft, topRight] = splitColumns(top, 0.5, 0.12);
    const [bottomLeft, bottomRight] = splitColumns(bottom, 0.5, 0.12);
    return [padBox(topLeft), padBox(topRight), padBox(bottomLeft), padBox(bottomRight)];
  }

  if (template === "timeline") {
    const [top, bottom] = splitRows(content, 0.36, 0.12);
    const [bottomLeft, bottomRight] = splitColumns(bottom, 0.5, 0.12);
    return [padBox(top), padBox(bottomLeft), padBox(bottomRight)];
  }

  const [top, rest] = splitRows(content, 0.36, 0.12);
  const [middle, bottom] = splitRows(rest, 0.52, 0.1);
  const [middleLeft, middleRight] = splitColumns(middle, 0.5, 0.1);
  return [padBox(top), padBox(middleLeft), padBox(middleRight), padBox(bottom)];
}

export function defaultTemplateBySlideType(type: SlideType): AdaptiveLayoutTemplate {
  switch (type) {
    case "cover":
      return "cover-hero";
    case "exec-summary":
      return "kpi-dashboard";
    case "market-landscape":
      return "left-focus";
    case "benchmark":
      return "two-column";
    case "risks-issues":
      return "quad";
    case "roadmap":
      return "timeline";
    case "appendix":
      return "single-panel";
    default:
      return "single-panel";
  }
}

export function buildLayout(type: SlideType, template?: AdaptiveLayoutTemplate): LayoutSlots {
  const base = baseLayout();
  const selectedTemplate = template ?? defaultTemplateBySlideType(type);
  const contentAreas = areasForTemplate(selectedTemplate, base.content);

  const leftBody = contentAreas[0] ?? { ...base.content };
  const rightBody = contentAreas[1] ?? contentAreas[0] ?? { ...base.content };

  return {
    ...base,
    template: selectedTemplate,
    leftBody,
    rightBody,
    contentAreas
  };
}
