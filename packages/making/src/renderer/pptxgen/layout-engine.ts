import { SlideType } from "@consulting-ppt/shared";

export type LayoutMode =
  | "cover"
  | "one-column-insights"
  | "two-column-compare"
  | "matrix-2x2"
  | "table-heavy"
  | "roadmap-timeline";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutSlots {
  title: Box;
  takeaway: Box;
  governingMessage: Box;
  content: Box;
  leftBody: Box;
  rightBody: Box;
  footer: Box;
  source: Box;
  pageNumber: Box;
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

function baseLayout(): LayoutSlots {
  const width = PAGE.right - PAGE.left;
  return {
    title: { x: PAGE.left, y: PAGE.titleY, w: width, h: 0.28 },
    takeaway: { x: PAGE.left, y: PAGE.takeawayY, w: width, h: 0.32 },
    governingMessage: { x: PAGE.left, y: PAGE.takeawayY, w: width, h: 0.32 },
    content: { x: PAGE.left, y: PAGE.contentY, w: width, h: PAGE.contentBottom - PAGE.contentY },
    leftBody: { x: PAGE.left, y: PAGE.contentY, w: 4.55, h: PAGE.contentBottom - PAGE.contentY },
    rightBody: { x: 5.0, y: PAGE.contentY, w: 4.5, h: PAGE.contentBottom - PAGE.contentY },
    footer: { x: PAGE.left, y: PAGE.sourceY, w: width, h: 0.12 },
    source: { x: PAGE.left, y: PAGE.sourceY, w: width, h: 0.12 },
    pageNumber: { x: 9.2, y: PAGE.pageY, w: 0.45, h: 0.12 }
  };
}

function forMode(mode: LayoutMode): LayoutSlots {
  const base = baseLayout();

  switch (mode) {
    case "cover":
      return {
        ...base,
        title: { x: 0.6, y: 1.45, w: 8.8, h: 0.62 },
        takeaway: { x: 0.6, y: 2.2, w: 8.8, h: 0.38 },
        governingMessage: { x: 0.6, y: 2.2, w: 8.8, h: 0.38 },
        content: { x: 0.6, y: 2.72, w: 8.8, h: 2.1 },
        leftBody: { x: 0.6, y: 2.72, w: 8.8, h: 2.1 },
        rightBody: { x: 0.6, y: 2.72, w: 8.8, h: 2.1 }
      };
    case "roadmap-timeline":
      return {
        ...base,
        leftBody: { x: 0.35, y: PAGE.contentY, w: 9.3, h: 2.0 },
        rightBody: { x: 0.35, y: 3.05, w: 9.3, h: 2.1 }
      };
    case "table-heavy":
      return {
        ...base,
        leftBody: { x: 0.35, y: PAGE.contentY, w: 9.3, h: 4.2 },
        rightBody: { x: 0.35, y: PAGE.contentY, w: 9.3, h: 4.2 }
      };
    case "two-column-compare":
    case "matrix-2x2":
      return base;
    case "one-column-insights":
    default:
      return {
        ...base,
        leftBody: { x: 0.35, y: PAGE.contentY, w: 9.3, h: 4.2 },
        rightBody: { x: 0.35, y: PAGE.contentY, w: 9.3, h: 4.2 }
      };
  }
}

export function modeBySlideType(type: SlideType): LayoutMode {
  switch (type) {
    case "cover":
      return "cover";
    case "benchmark":
      return "two-column-compare";
    case "market-landscape":
      return "table-heavy";
    case "risks-issues":
      return "matrix-2x2";
    case "roadmap":
      return "roadmap-timeline";
    case "appendix":
      return "table-heavy";
    case "exec-summary":
    default:
      return "one-column-insights";
  }
}

export function buildLayout(type: SlideType): LayoutSlots {
  return forMode(modeBySlideType(type));
}
