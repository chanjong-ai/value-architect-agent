import { writeFileSync } from "node:fs";
import path from "node:path";
import PptxGenJS from "pptxgenjs";
import { PipelineError, ResearchPack, SlideSpec, nowIso } from "@consulting-ppt/shared";
import { validateSchema } from "@consulting-ppt/thinking";
import { buildLayout } from "./layout-engine";
import { LayoutPlannerOptions } from "./layout-planner";
import { prepareSpecWithLayoutValidation } from "./layout-validator";
import { fitClaimPreserveSoWhat } from "./text-fit";
import { loadTheme } from "./theme";
import { RenderContext, SlideRenderer } from "./types";
import { addPageNumber, addSource } from "./components/slide-frame";
import { buildSemanticIconAssetMap } from "./icon-library";
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
  layoutDecisionsPath: string;
  rendererVersion: string;
  effectiveSpec: SlideSpec;
}

export interface RenderOptions {
  layoutPlanner?: LayoutPlannerOptions;
}

function sanitizeSpec(spec: SlideSpec, researchPack?: ResearchPack): SlideSpec {
  const safeSpec = JSON.parse(JSON.stringify(spec)) as SlideSpec;
  const tableIds = new Set(researchPack?.normalized_tables.map((table) => table.table_id) ?? []);

  for (const slide of safeSpec.slides) {
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

      if (claim.text.length > 260) {
        claim.text = fitClaimPreserveSoWhat(claim.text, 260).text;
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

  return safeSpec;
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
  researchPack?: ResearchPack,
  options: RenderOptions = {}
): Promise<RenderResult> {
  validateSchema("slidespec.schema.json", spec, "slidespec for rendering");
  const safeSpec = sanitizeSpec(spec, researchPack);
  const prepared = await prepareSpecWithLayoutValidation(safeSpec, options.layoutPlanner);
  const effectiveSpec = prepared.effectiveSpec;
  const theme = loadTheme(effectiveSpec.meta.theme, cwd);
  const tablesById = new Map((researchPack?.normalized_tables ?? []).map((table) => [table.table_id, table]));
  const iconAssets = await buildSemanticIconAssetMap(theme);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: CUSTOM_LAYOUT_NAME, width: 10, height: 5.625 });
  pptx.layout = CUSTOM_LAYOUT_NAME as unknown as typeof pptx.layout;
  pptx.author = "consulting-ppt-agent";
  pptx.subject = effectiveSpec.meta.project_id;
  pptx.title = `${effectiveSpec.meta.project_id} consulting report`;
  const layoutDecisions: Array<{
    page: number;
    slide_id: string;
    slide_type: string;
    template: string;
    emphasis: string;
    provider: string;
    rationale: string;
    fit_score_before: number;
    fit_score_after: number;
    template_adjusted: boolean;
    text_adjustments: {
      title: boolean;
      governing_message: boolean;
      claims: number;
    };
    deck_review_score: number;
    review_round: number;
    review_notes: string[];
  }> = [];

  for (const [index, slideSpec] of effectiveSpec.slides.entries()) {
    const slide = pptx.addSlide();

    slide.background = { color: theme.colors.background };
    const layoutPlan = prepared.decisions[index];
    if (!layoutPlan) {
      throw new PipelineError(`Missing layout decision for slide ${slideSpec.id}`);
    }

    const context: RenderContext = {
      theme,
      layout: buildLayout(slideSpec.type, layoutPlan.template),
      layoutPlan,
      tablesById,
      iconAssets
    };
    layoutDecisions.push({
      page: layoutPlan.page,
      slide_id: slideSpec.id,
      slide_type: slideSpec.type,
      template: layoutPlan.template,
      emphasis: layoutPlan.emphasis,
      provider: layoutPlan.provider,
      rationale: layoutPlan.rationale,
      fit_score_before: layoutPlan.fit_score_before,
      fit_score_after: layoutPlan.fit_score_after,
      template_adjusted: layoutPlan.template_adjusted,
      text_adjustments: layoutPlan.text_adjustments,
      deck_review_score: layoutPlan.deck_review_score,
      review_round: layoutPlan.review_round,
      review_notes: layoutPlan.review_notes
    });

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
    addPageNumber(slide as unknown as import("./types").SlideLike, index + 1, effectiveSpec.slides.length, context.layout.pageNumber, theme);
  }

  const reportPath = path.join(outputDir, "report.pptx");
  const provenancePath = path.join(outputDir, "provenance.json");
  const layoutDecisionsPath = path.join(outputDir, "layout.decisions.json");

  await pptx.writeFile({ fileName: reportPath });
  writeProvenance(effectiveSpec, provenancePath);
  writeFileSync(
    layoutDecisionsPath,
    `${JSON.stringify({ run_id: effectiveSpec.meta.run_id, decisions: layoutDecisions }, null, 2)}\n`,
    "utf8"
  );

  return {
    reportPath,
    provenancePath,
    layoutDecisionsPath,
    rendererVersion: RENDERER_VERSION,
    effectiveSpec
  };
}
