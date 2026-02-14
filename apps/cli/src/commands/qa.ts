import { readFileSync } from "node:fs";
import path from "node:path";
import { logger, PipelineError, ResearchPack, SlideSpec } from "@consulting-ppt/shared";
import { writeJson, writeText } from "@consulting-ppt/memory";
import { runQa } from "@consulting-ppt/qa";
import { normalizePath } from "../io";

export interface QaCommandOptions {
  run: string;
  threshold?: string;
}

export async function qaCommand(options: QaCommandOptions): Promise<{ score: number; passed: boolean }> {
  const runRoot = normalizePath(options.run);
  const specPath = path.join(runRoot, "spec", "slidespec.json");
  const researchPath = path.join(runRoot, "research", "research.pack.json");

  const spec = JSON.parse(readFileSync(specPath, "utf8")) as SlideSpec;
  const research = JSON.parse(readFileSync(researchPath, "utf8")) as ResearchPack;

  const threshold = options.threshold ? Number(options.threshold) : 80;
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 100) {
    throw new PipelineError(`Invalid threshold value: ${options.threshold}`);
  }
  const result = runQa(spec.meta.run_id, spec, research, { threshold });

  writeJson(path.join(runRoot, "qa", "qa.report.json"), result.report);
  writeText(path.join(runRoot, "qa", "qa.summary.md"), result.summaryMarkdown);

  logger.info({ runRoot, score: result.report.qa_score, passed: result.report.passed }, "QA completed");

  if (!result.report.passed) {
    throw new PipelineError(`QA score ${result.report.qa_score} is below threshold ${result.report.threshold}`);
  }

  return {
    score: result.report.qa_score,
    passed: result.report.passed
  };
}
