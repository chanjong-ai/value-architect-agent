import path from "node:path";
import {
  BriefInput,
  buildExecutionClock,
  createDeterministicRunId,
  createRunId,
  hashJson,
  logger,
  nowIso,
  PipelineError
} from "@consulting-ppt/shared";
import { evolveBriefWithRules, initRunStore, loadProjectLearningRules, writeJson, writeManifest, writeText } from "@consulting-ppt/memory";
import {
  buildTrustedWebResearchPack,
  mergeResearchPacks,
  normalizeBrief,
  runThinking,
  validateSchema
} from "@consulting-ppt/thinking";
import { readJson, normalizePath, workspaceRoot } from "../io";
import { buildStorylineDebugArtifacts } from "../storyline-debug";

export interface ThinkCommandOptions {
  brief: string;
  project?: string;
  runId?: string;
  deterministic?: boolean;
  seed?: string;
  research?: string;
  webResearch?: boolean;
  webResearchAttempts?: string;
  webResearchTimeoutMs?: string;
  webResearchConcurrency?: string;
}

const MIN_WEB_RESEARCH_ATTEMPTS = 30;

function parseIntegerOption(value: string | undefined, optionName: string, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new PipelineError(`Invalid ${optionName}: ${value}`);
  }

  return Math.floor(parsed);
}

function resolveWebResearchConfig(options: ThinkCommandOptions): {
  enabled: boolean;
  minimumAttempts: number;
  timeoutMs: number;
  concurrency: number;
} {
  const enabled = options.webResearch !== false;
  const minimumAttempts = Math.max(
    MIN_WEB_RESEARCH_ATTEMPTS,
    parseIntegerOption(options.webResearchAttempts, "--web-research-attempts", MIN_WEB_RESEARCH_ATTEMPTS)
  );
  const timeoutMs = parseIntegerOption(options.webResearchTimeoutMs, "--web-research-timeout-ms", 12000);
  const concurrency = parseIntegerOption(options.webResearchConcurrency, "--web-research-concurrency", 6);

  return {
    enabled,
    minimumAttempts,
    timeoutMs,
    concurrency
  };
}

export async function thinkCommand(options: ThinkCommandOptions): Promise<{ runRoot: string; runId: string }> {
  const briefPath = normalizePath(options.brief);
  const input = readJson<BriefInput>(briefPath);
  const inputHash = hashJson(input);
  const root = workspaceRoot();

  const normalizedBrief = normalizeBrief(input, options.project);
  const learningRules = loadProjectLearningRules(normalizedBrief.project_id, root);
  const evolvedBrief = learningRules.length > 0 ? evolveBriefWithRules(normalizedBrief, learningRules) : normalizedBrief;

  const clock = buildExecutionClock({
    deterministic: options.deterministic,
    seed: options.seed,
    inputHash
  });
  const startedAt = clock.deterministic ? clock.nowIso : nowIso();
  const runId = options.runId ?? (clock.deterministic ? createDeterministicRunId(inputHash, clock.seed) : createRunId(clock.now));
  const webResearchConfig = resolveWebResearchConfig(options);

  const manualResearchOverride = options.research
    ? readJson<import("@consulting-ppt/shared").ResearchPack>(normalizePath(options.research))
    : undefined;

  const webResearchResult = webResearchConfig.enabled
    ? await buildTrustedWebResearchPack(evolvedBrief, runId, clock, {
      minimumAttempts: webResearchConfig.minimumAttempts,
      timeoutMs: webResearchConfig.timeoutMs,
      concurrency: webResearchConfig.concurrency
    })
    : undefined;

  const requiredWebAttempts = webResearchResult
    ? Math.min(webResearchConfig.minimumAttempts, webResearchResult.report.attempts_planned)
    : webResearchConfig.minimumAttempts;

  if (webResearchResult && webResearchResult.report.attempts_completed < requiredWebAttempts) {
    throw new PipelineError(
      `Live web research attempts are insufficient (${webResearchResult.report.attempts_completed}/${requiredWebAttempts})`
    );
  }

  if (webResearchResult) {
    const minimumRelevantSuccesses = Math.max(6, Math.floor(requiredWebAttempts * 0.25));
    if (webResearchResult.report.relevant_successes < minimumRelevantSuccesses) {
      throw new PipelineError(
        `Live web research relevance is insufficient (${webResearchResult.report.relevant_successes}/${minimumRelevantSuccesses})`
      );
    }

    const coveredAxes = Object.values(webResearchResult.report.per_axis_successes).filter((count) => count > 0).length;
    if (coveredAxes < 4) {
      throw new PipelineError(`Live web research axis coverage is insufficient (${coveredAxes}/6)`);
    }
  }

  const mergedResearchOverride = mergeResearchPacks(evolvedBrief.project_id, runId, clock.nowIso, [
    manualResearchOverride,
    webResearchResult?.researchPack
  ]);

  const result = runThinking(input, runId, options.project, {
    clock,
    researchPackOverride: mergedResearchOverride,
    briefOverride: evolvedBrief
  });
  const paths = initRunStore(result.brief.project_id, runId, root, clock.now);

  writeJson(path.join(paths.inputDir, "brief.raw.json"), input);
  writeJson(path.join(paths.inputDir, "brief.normalized.json"), result.brief);
  writeJson(path.join(paths.inputDir, "learning.rules.json"), {
    project_id: result.brief.project_id,
    rules: learningRules
  });
  writeJson(path.join(paths.researchDir, "research.pack.json"), result.researchPack);
  if (webResearchResult) {
    writeJson(path.join(paths.researchDir, "web.research.report.json"), webResearchResult.report);
    writeJson(path.join(paths.researchDir, "web.research.attempts.json"), webResearchResult.attempts);
  }
  writeJson(path.join(paths.specDir, "slidespec.json"), result.slideSpec);
  writeJson(path.join(paths.specDir, "thinking.review.json"), result.reviewReport);
  writeJson(path.join(paths.specDir, "content.quality.pre-render.json"), result.contentQualityReport);
  const preRenderDebug = buildStorylineDebugArtifacts({
    runId,
    generatedAt: clock.deterministic ? clock.nowIso : nowIso(),
    brief: result.brief,
    researchPack: result.researchPack,
    slideSpec: result.slideSpec,
    reviewReport: result.reviewReport,
    narrativePlan: result.narrativePlan
  });
  writeJson(path.join(paths.specDir, "storyline.pre-render.debug.json"), preRenderDebug.json);
  writeText(path.join(paths.specDir, "storyline.pre-render.debug.md"), preRenderDebug.markdown);

  const manifest = {
    run_id: runId,
    started_at: startedAt,
    ended_at: clock.deterministic ? clock.nowIso : nowIso(),
    input_hash: inputHash,
    research_hash: hashJson(result.researchPack),
    spec_hash: hashJson(result.slideSpec),
    renderer_version: "not-rendered",
    qa_score: 0,
    status: "success" as const,
    deterministic_mode: clock.deterministic,
    deterministic_seed: clock.seed
  };

  validateSchema("manifest.schema.json", manifest, "manifest");
  writeManifest(paths, manifest);

  logger.info({ runId, runRoot: paths.runRoot, webResearch: webResearchResult?.report }, "Thinking completed");
  return { runRoot: paths.runRoot, runId };
}
