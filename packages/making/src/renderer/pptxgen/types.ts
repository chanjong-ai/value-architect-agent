import { NormalizedTable, SlideSpecSlide } from "@consulting-ppt/shared";
import { ThemeTokens } from "./theme";
import { LayoutSlots } from "./layout-engine";

export interface SlideLike {
  addText: (text: string | string[], options?: Record<string, unknown>) => void;
  addShape: (shapeName: string, options?: Record<string, unknown>) => void;
  addTable: (rows: Array<Array<unknown>>, options?: Record<string, unknown>) => void;
}

export interface RenderContext {
  theme: ThemeTokens;
  layout: LayoutSlots;
  tablesById?: Map<string, NormalizedTable>;
}

export interface SlideRenderer {
  (slide: SlideLike, slideSpec: SlideSpecSlide, context: RenderContext): void;
}
