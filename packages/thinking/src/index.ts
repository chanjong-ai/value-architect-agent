import {
  BriefInput,
  BriefNormalized,
  buildExecutionClock,
  ExecutionClock,
  ResearchPack,
  SlideSpec
} from "@consulting-ppt/shared";
import { normalizeBrief } from "./brief-normalizer";
import { orchestrateResearch } from "./research-orchestrator";
import { planNarrative } from "./narrative-planner";
import { buildSlideSpec } from "./spec-builder";
import { runSelfCritic } from "./self-critic";
import { validateSchema } from "./validator";

export interface ThinkingResult {
  brief: BriefNormalized;
  researchPack: ResearchPack;
  slideSpec: SlideSpec;
  clock: ExecutionClock;
}

export interface ThinkingOptions {
  clock?: ExecutionClock;
  researchPackOverride?: ResearchPack;
  briefOverride?: BriefNormalized;
}

export function runThinking(
  input: BriefInput,
  runId: string,
  projectIdOverride?: string,
  options: ThinkingOptions = {}
): ThinkingResult {
  const clock = options.clock ?? buildExecutionClock();

  const brief = options.briefOverride ?? normalizeBrief(input, projectIdOverride);
  validateSchema("brief.schema.json", brief, "brief");

  const researchPack = options.researchPackOverride
    ? {
        ...options.researchPackOverride,
        project_id: brief.project_id,
        run_id: runId,
        generated_at: options.researchPackOverride.generated_at || clock.nowIso
      }
    : orchestrateResearch(brief, runId, clock);
  validateSchema("research-pack.schema.json", researchPack, "research pack");

  const narrativePlan = planNarrative(brief);
  const spec = buildSlideSpec(brief, researchPack, narrativePlan, runId, clock);
  const revisedSpec = runSelfCritic(spec, brief, researchPack);
  validateSchema("slidespec.schema.json", revisedSpec, "slidespec");

  return {
    brief,
    researchPack,
    slideSpec: revisedSpec,
    clock
  };
}

export { normalizeBrief } from "./brief-normalizer";
export { orchestrateResearch } from "./research-orchestrator";
export { planNarrative } from "./narrative-planner";
export { buildSlideSpec } from "./spec-builder";
export { runSelfCritic } from "./self-critic";
export { validateSchema } from "./validator";
