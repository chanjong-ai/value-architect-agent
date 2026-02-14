import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { logger, PipelineError, ResearchPack, SlideSpec } from "@consulting-ppt/shared";
import { renderPptxFromSpec } from "@consulting-ppt/making";
import { writeJson } from "@consulting-ppt/memory";
import { ensureDir, normalizePath, workspaceRoot } from "../io";
import { buildDetailedProvenance } from "../provenance";

export interface MakeCommandOptions {
  spec: string;
}

export async function makeCommand(options: MakeCommandOptions): Promise<{ runRoot: string; output: string }> {
  const specPath = normalizePath(options.spec);
  const spec = JSON.parse(readFileSync(specPath, "utf8")) as SlideSpec;

  const runRoot = path.resolve(specPath, "..", "..");
  const outputDir = path.join(runRoot, "output");
  ensureDir(outputDir);

  const researchPath = path.join(runRoot, "research", "research.pack.json");
  const researchPack = existsSync(researchPath)
    ? (JSON.parse(readFileSync(researchPath, "utf8")) as ResearchPack)
    : undefined;
  const hasTableVisual = spec.slides.some((slide) => slide.visuals.some((visual) => visual.kind === "table"));
  if (hasTableVisual && !researchPack) {
    throw new PipelineError("Research pack is required for make command when table visuals are present");
  }

  const result = await renderPptxFromSpec(spec, outputDir, workspaceRoot(), researchPack);
  const provenance = buildDetailedProvenance(spec.meta.run_id, spec, researchPack);
  writeJson(path.join(outputDir, "provenance.json"), provenance);
  logger.info({ reportPath: result.reportPath }, "Making completed");

  return {
    runRoot,
    output: result.reportPath
  };
}
