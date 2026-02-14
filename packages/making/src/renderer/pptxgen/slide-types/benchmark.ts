import { SlideSpecSlide } from "@consulting-ppt/shared";
import { RenderContext, SlideLike } from "../types";
import { renderConsultingSlide } from "./consulting13";

export function renderBenchmark(slide: SlideLike, slideSpec: SlideSpecSlide, context: RenderContext): void {
  renderConsultingSlide(slide, slideSpec, context);
}
