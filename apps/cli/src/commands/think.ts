import path from "node:path";
import {
  BriefInput,
  buildExecutionClock,
  createDeterministicRunId,
  createRunId,
  hashJson,
  logger,
  nowIso
} from "@consulting-ppt/shared";
import { evolveBriefWithRules, initRunStore, loadProjectLearningRules, writeJson, writeManifest } from "@consulting-ppt/memory";
import { normalizeBrief, runThinking, validateSchema } from "@consulting-ppt/thinking";
import { readJson, normalizePath, workspaceRoot } from "../io";

export interface ThinkCommandOptions {
  brief: string;
  project?: string;
  runId?: string;
  deterministic?: boolean;
  seed?: string;
  research?: string;
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

  const researchOverride = options.research
    ? readJson<import("@consulting-ppt/shared").ResearchPack>(normalizePath(options.research))
    : undefined;

  const result = runThinking(input, runId, options.project, {
    clock,
    researchPackOverride: researchOverride,
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
  writeJson(path.join(paths.specDir, "slidespec.json"), result.slideSpec);

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

  logger.info({ runId, runRoot: paths.runRoot }, "Thinking completed");
  return { runRoot: paths.runRoot, runId };
}
