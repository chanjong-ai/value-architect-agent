import { writeFileSync } from "node:fs";
import path from "node:path";
import PptxGenJS from "pptxgenjs";
import { PipelineError, ResearchPack, SlideSpec, nowIso } from "@consulting-ppt/shared";
import { validateSchema } from "@consulting-ppt/thinking";
import { buildLayout } from "./layout-engine";
import { loadTheme } from "./theme";
import { RenderContext, SlideRenderer } from "./types";
import { addPageNumber, addSource } from "./components/slide-frame";
import { renderCover } from "./slide-types/cover";
import { renderExecSummary } from "./slide-types/exec-summary";
import { renderMarketLandscape } from "./slide-types/market-landscape";
import { renderBenchmark } from "./slide-types/benchmark";
import { renderRisksIssues } from "./slide-types/risks-issues";
import { renderRoadmap } from "./slide-types/roadmap";
import { renderAppendix } from "./slide-types/appendix";

export const RENDERER_VERSION = "pptxgenjs-3.12.0";
const CUSTOM_LAYOUT_NAME = "LAYOUT_16x9_CUSTOM";

export interface RenderResult {
  reportPath: string;
  provenancePath: string;
  rendererVersion: string;
}

function sanitizeSpec(spec: SlideSpec, researchPack?: ResearchPack): SlideSpec {
  const tableIds = new Set(researchPack?.normalized_tables.map((table) => table.table_id) ?? []);

  for (const slide of spec.slides) {
    if (!slide.title.trim()) {
      throw new PipelineError(`Slide ${slide.id} has empty title`);
    }

    if (slide.claims.length > 6) {
      slide.claims = slide.claims.slice(0, 6);
    }

    for (const claim of slide.claims) {
      if (claim.evidence_ids.length === 0) {
        throw new PipelineError(`Slide ${slide.id} has claim without evidence mapping`);
      }

      if (/\d/.test(claim.text) && claim.evidence_ids.length < 2) {
        throw new PipelineError(`Slide ${slide.id} numeric claim requires at least 2 evidence mappings`);
      }

      if (claim.text.length > 180) {
        claim.text = `${claim.text.slice(0, 177)}...`;
      }
    }

    for (const visual of slide.visuals) {
      if (visual.kind === "table" && !visual.data_ref) {
        throw new PipelineError(`Slide ${slide.id} has table visual without data_ref`);
      }

      if (visual.kind === "table" && researchPack && visual.data_ref && !tableIds.has(visual.data_ref)) {
        throw new PipelineError(`Slide ${slide.id} references unknown table data_ref '${visual.data_ref}'`);
      }

      if (visual.kind === "table" && !researchPack) {
        throw new PipelineError("Research pack is required to validate table visuals during rendering");
      }
    }

    if (slide.source_footer.length === 0) {
      slide.source_footer = ["Source required"];
    }
  }

  return spec;
}

function rendererByType(type: SlideSpec["slides"][number]["type"]): SlideRenderer {
  switch (type) {
    case "cover":
      return renderCover;
    case "exec-summary":
      return renderExecSummary;
    case "market-landscape":
      return renderMarketLandscape;
    case "benchmark":
      return renderBenchmark;
    case "risks-issues":
      return renderRisksIssues;
    case "roadmap":
      return renderRoadmap;
    case "appendix":
      return renderAppendix;
    default:
      return renderExecSummary;
  }
}

function writeProvenance(spec: SlideSpec, target: string): void {
  const provenance = {
    run_id: spec.meta.run_id,
    generated_at: nowIso(),
    slides: spec.slides.map((slide) => ({
      slide_id: slide.id,
      claims: slide.claims.map((claim) => ({
        text: claim.text,
        evidence_ids: claim.evidence_ids
      })),
      source_footer: slide.source_footer
    }))
  };

  writeFileSync(target, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
}

export async function renderPptxFromSpec(
  spec: SlideSpec,
  outputDir: string,
  cwd = process.cwd(),
  researchPack?: ResearchPack
): Promise<RenderResult> {
  validateSchema("slidespec.schema.json", spec, "slidespec for rendering");
  const safeSpec = sanitizeSpec(spec, researchPack);
  const theme = loadTheme(safeSpec.meta.theme, cwd);
  const tablesById = new Map((researchPack?.normalized_tables ?? []).map((table) => [table.table_id, table]));

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: CUSTOM_LAYOUT_NAME, width: 10, height: 5.625 });
  pptx.layout = CUSTOM_LAYOUT_NAME as unknown as typeof pptx.layout;
  pptx.author = "consulting-ppt-agent";
  pptx.subject = safeSpec.meta.project_id;
  pptx.title = `${safeSpec.meta.project_id} consulting report`;

  for (const [index, slideSpec] of safeSpec.slides.entries()) {
    const slide = pptx.addSlide();

    slide.background = { color: theme.colors.background };

    const context: RenderContext = {
      theme,
      layout: buildLayout(slideSpec.type),
      tablesById
    };

    const renderer = rendererByType(slideSpec.type);
    renderer(slide as unknown as import("./types").SlideLike, slideSpec, context);
    if (slideSpec.id !== "s01") {
      addSource(
        slide as unknown as import("./types").SlideLike,
        slideSpec.source_footer,
        context.layout.source,
        theme
      );
    }
    addPageNumber(slide as unknown as import("./types").SlideLike, index + 1, safeSpec.slides.length, context.layout.pageNumber, theme);
  }

  const reportPath = path.join(outputDir, "report.pptx");
  const provenancePath = path.join(outputDir, "provenance.json");

  await pptx.writeFile({ fileName: reportPath });
  writeProvenance(safeSpec, provenancePath);

  return {
    reportPath,
    provenancePath,
    rendererVersion: RENDERER_VERSION
  };
}
