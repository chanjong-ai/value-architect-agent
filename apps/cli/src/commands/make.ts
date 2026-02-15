import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { logger, PipelineError, ResearchPack, SlideSpec } from "@consulting-ppt/shared";
import { renderPptxFromSpec } from "@consulting-ppt/making";
import { writeJson } from "@consulting-ppt/memory";
import { ensureDir, normalizePath, workspaceRoot } from "../io";
import { buildDetailedProvenance } from "../provenance";

export interface MakeCommandOptions {
  spec: string;
  layoutProvider?: string;
  layoutModel?: string;
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

  const provider = options.layoutProvider?.trim().toLowerCase();
  if (provider && provider !== "agentic" && provider !== "heuristic" && provider !== "openai" && provider !== "anthropic") {
    throw new PipelineError(`Invalid layout provider: ${options.layoutProvider}`);
  }
  const normalizedProvider =
    provider === "agentic" || provider === "heuristic" || provider === "openai" || provider === "anthropic"
      ? (provider as "agentic" | "heuristic" | "openai" | "anthropic")
      : undefined;

  const result = await renderPptxFromSpec(spec, outputDir, workspaceRoot(), researchPack, {
    layoutPlanner: {
      provider: normalizedProvider,
      model: options.layoutModel?.trim() || undefined
    }
  });
  const effectiveSpec = result.effectiveSpec;
  const specDir = path.join(runRoot, "spec");
  ensureDir(specDir);
  writeJson(path.join(specDir, "slidespec.effective.json"), effectiveSpec);
  const provenance = buildDetailedProvenance(effectiveSpec.meta.run_id, effectiveSpec, researchPack);
  writeJson(path.join(outputDir, "provenance.json"), provenance);
  logger.info({ reportPath: result.reportPath }, "Making completed");

  return {
    runRoot,
    output: result.reportPath
  };
}
