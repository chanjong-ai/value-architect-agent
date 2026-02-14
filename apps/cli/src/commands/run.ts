import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BriefInput,
  QAIssue,
  ResearchPack,
  SlideSpec,
  buildExecutionClock,
  createDeterministicRunId,
  hashJson,
  logger,
  Manifest,
  PipelineError,
  createRunId,
  nowIso
} from "@consulting-ppt/shared";
import { renderPptxFromSpec } from "@consulting-ppt/making";
import {
  evolveBriefWithRules,
  initRunStore,
  loadProjectLearningRules,
  writeJson,
  writeManifest,
  writeText
} from "@consulting-ppt/memory";
import { runQa } from "@consulting-ppt/qa";
import { normalizeBrief, runThinking, validateSchema } from "@consulting-ppt/thinking";
import { normalizePath, readJson, workspaceRoot } from "../io";
import { buildDetailedProvenance } from "../provenance";

export interface RunCommandOptions {
  brief: string;
  project?: string;
  threshold?: string;
  deterministic?: boolean;
  seed?: string;
  research?: string;
}

const MAX_CLAIM_CHARS = 170;
const MAX_GOVERNING_MESSAGE_CHARS = 92;
const MAX_CLAIMS_ON_OVERFLOW = 4;

function normalizeMessageKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function ensureSoWhat(text: string): string {
  return text.includes("So What:")
    ? text
    : `${text} (So What: 의사결정과 실행 우선순위를 명확히 한다)`;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 3)}...`;
}

function collectFallbackEvidenceIds(researchPack: ResearchPack): string[] {
  const selected: string[] = [];
  const sourceIds = new Set<string>();

  for (const evidence of researchPack.evidences) {
    if (sourceIds.has(evidence.source_id)) {
      continue;
    }
    selected.push(evidence.evidence_id);
    sourceIds.add(evidence.source_id);
    if (selected.length === 2) {
      return selected;
    }
  }

  return researchPack.evidences.slice(0, 2).map((item) => item.evidence_id);
}

function rebuildSourceFooter(
  claimEvidenceIds: string[],
  evidenceById: Map<string, ResearchPack["evidences"][number]>,
  sourceById: Map<string, ResearchPack["sources"][number]>
): string[] {
  const footer = new Set<string>();
  for (const evidenceId of claimEvidenceIds) {
    const evidence = evidenceById.get(evidenceId);
    const source = evidence ? sourceById.get(evidence.source_id) : undefined;
    if (!source) {
      continue;
    }
    footer.add(`${source.publisher} (${source.date})`);
  }
  return Array.from(footer).sort();
}

function validateTableDataRefs(spec: SlideSpec, researchPack: ResearchPack): void {
  const tableIds = new Set(researchPack.normalized_tables.map((table) => table.table_id));
  for (const slide of spec.slides) {
    for (const visual of slide.visuals) {
      if (visual.kind !== "table") {
        continue;
      }
      if (!visual.data_ref) {
        throw new PipelineError(`Slide ${slide.id} has table visual without data_ref`);
      }
      if (!tableIds.has(visual.data_ref)) {
        throw new PipelineError(
          `Slide ${slide.id} references unknown table data_ref '${visual.data_ref}'. Available: ${Array.from(tableIds).join(", ")}`
        );
      }
    }
  }
}

function applyPostQaAutoFix(spec: SlideSpec, researchPack: ResearchPack, issues: QAIssue[]): { applied: boolean; rules: string[] } {
  const fixableRules = new Set([
    "missing_so_what",
    "claim_too_long",
    "overflow_risk",
    "claim_without_evidence",
    "numeric_cross_validation_missing",
    "single_source_numeric_claim",
    "missing_source_footer",
    "governing_message_length",
    "governing_message_duplicate"
  ]);

  const triggeredRules = Array.from(new Set(issues.map((issue) => issue.rule))).filter((rule) => fixableRules.has(rule));
  if (triggeredRules.length === 0) {
    return { applied: false, rules: [] };
  }

  const fallbackEvidenceIds = collectFallbackEvidenceIds(researchPack);
  if (fallbackEvidenceIds.length < 2) {
    return { applied: false, rules: [] };
  }

  const evidenceById = new Map(researchPack.evidences.map((item) => [item.evidence_id, item]));
  const sourceById = new Map(researchPack.sources.map((item) => [item.source_id, item]));
  const issueRulesBySlide = new Map<string, Set<string>>();
  let changed = false;

  for (const issue of issues) {
    const slideKey = issue.slide_id ?? "__global__";
    const bucket = issueRulesBySlide.get(slideKey) ?? new Set<string>();
    bucket.add(issue.rule);
    issueRulesBySlide.set(slideKey, bucket);
  }

  for (const slide of spec.slides) {
    const scopedRules = new Set([
      ...(issueRulesBySlide.get("__global__") ?? new Set<string>()),
      ...(issueRulesBySlide.get(slide.id) ?? new Set<string>())
    ]);

    const overflowFix = scopedRules.has("overflow_risk");
    if (overflowFix && slide.claims.length > MAX_CLAIMS_ON_OVERFLOW) {
      slide.claims = slide.claims.slice(0, MAX_CLAIMS_ON_OVERFLOW);
      changed = true;
    }

    const normalizedGm = truncate(slide.governing_message, MAX_GOVERNING_MESSAGE_CHARS);
    if (normalizedGm !== slide.governing_message) {
      slide.governing_message = normalizedGm;
      changed = true;
    }

    for (const claim of slide.claims) {
      const updatedText = ensureSoWhat(truncate(claim.text, MAX_CLAIM_CHARS));
      if (updatedText !== claim.text) {
        claim.text = updatedText;
        changed = true;
      }

      const requiresMultiEvidence = /\d/.test(claim.text) || claim.evidence_ids.length < 2;
      if (requiresMultiEvidence && claim.evidence_ids.length < 2) {
        claim.evidence_ids = [...fallbackEvidenceIds];
        changed = true;
      }

      const dedupedEvidenceIds = Array.from(new Set(claim.evidence_ids)).slice(0, 2);
      if (dedupedEvidenceIds.length < 2) {
        dedupedEvidenceIds.push(...fallbackEvidenceIds.filter((id) => !dedupedEvidenceIds.includes(id)).slice(0, 2));
      }
      if (dedupedEvidenceIds.join("|") !== claim.evidence_ids.join("|")) {
        claim.evidence_ids = dedupedEvidenceIds.slice(0, 2);
        changed = true;
      }
    }

    const claimEvidenceIds = slide.claims.flatMap((claim) => claim.evidence_ids);
    const rebuiltFooter = rebuildSourceFooter(claimEvidenceIds, evidenceById, sourceById);
    if (rebuiltFooter.length > 0 && rebuiltFooter.join("|") !== slide.source_footer.join("|")) {
      slide.source_footer = rebuiltFooter;
      changed = true;
    }
  }

  const seenGoverningMessages = new Set<string>();
  for (const slide of spec.slides) {
    const key = normalizeMessageKey(slide.governing_message);
    if (!seenGoverningMessages.has(key)) {
      seenGoverningMessages.add(key);
      continue;
    }

    const deduped = truncate(`${slide.governing_message} | ${slide.title}`, MAX_GOVERNING_MESSAGE_CHARS);
    if (deduped !== slide.governing_message) {
      slide.governing_message = deduped;
      changed = true;
    }
  }

  return { applied: changed, rules: triggeredRules };
}

export async function runCommand(options: RunCommandOptions): Promise<{ runRoot: string; qaScore: number }> {
  const briefPath = normalizePath(options.brief);
  const rawBrief = JSON.parse(readFileSync(briefPath, "utf8")) as BriefInput;
  const inputHash = hashJson(rawBrief);
  const root = workspaceRoot();

  const normalizedBrief = normalizeBrief(rawBrief, options.project);
  const learningRules = loadProjectLearningRules(normalizedBrief.project_id, root);
  const evolvedBrief = learningRules.length > 0 ? evolveBriefWithRules(normalizedBrief, learningRules) : normalizedBrief;

  const clock = buildExecutionClock({
    deterministic: options.deterministic,
    seed: options.seed,
    inputHash
  });

  const startedAt = clock.deterministic ? clock.nowIso : nowIso();
  const runId = clock.deterministic ? createDeterministicRunId(inputHash, clock.seed) : createRunId(clock.now);
  const researchOverride = options.research
    ? readJson<import("@consulting-ppt/shared").ResearchPack>(normalizePath(options.research))
    : undefined;
  const thinking = runThinking(rawBrief, runId, options.project, {
    clock,
    researchPackOverride: researchOverride,
    briefOverride: evolvedBrief
  });
  const runPaths = initRunStore(thinking.brief.project_id, runId, root, clock.now);

  writeJson(path.join(runPaths.inputDir, "brief.raw.json"), rawBrief);
  writeJson(path.join(runPaths.inputDir, "brief.normalized.json"), thinking.brief);
  writeJson(path.join(runPaths.inputDir, "learning.rules.json"), {
    project_id: thinking.brief.project_id,
    rules: learningRules
  });
  writeJson(path.join(runPaths.researchDir, "research.pack.json"), thinking.researchPack);
  writeJson(path.join(runPaths.specDir, "slidespec.json"), thinking.slideSpec);

  validateTableDataRefs(thinking.slideSpec, thinking.researchPack);
  let rendering = await renderPptxFromSpec(thinking.slideSpec, runPaths.outputDir, root, thinking.researchPack);

  const writeProvenance = (): void => {
    const provenance = buildDetailedProvenance(
      runId,
      thinking.slideSpec,
      thinking.researchPack,
      clock.deterministic ? clock.nowIso : nowIso()
    );
    writeJson(path.join(runPaths.outputDir, "provenance.json"), provenance);
  };
  writeProvenance();

  const threshold = options.threshold ? Number(options.threshold) : 80;
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 100) {
    throw new PipelineError(`Invalid threshold value: ${options.threshold}`);
  }
  let qa = runQa(runId, thinking.slideSpec, thinking.researchPack, { threshold });
  let autoFixRulesApplied: string[] = [];

  if (!qa.report.passed) {
    const autoFix = applyPostQaAutoFix(thinking.slideSpec, thinking.researchPack, qa.report.issues);
    if (autoFix.applied) {
      autoFixRulesApplied = autoFix.rules;
      validateTableDataRefs(thinking.slideSpec, thinking.researchPack);
      writeJson(path.join(runPaths.specDir, "slidespec.json"), thinking.slideSpec);

      rendering = await renderPptxFromSpec(thinking.slideSpec, runPaths.outputDir, root, thinking.researchPack);
      writeProvenance();
      qa = runQa(runId, thinking.slideSpec, thinking.researchPack, { threshold });
    }
  }

  writeJson(path.join(runPaths.qaDir, "qa.report.json"), qa.report);
  writeText(path.join(runPaths.qaDir, "qa.summary.md"), qa.summaryMarkdown);
  writeJson(path.join(runPaths.qaDir, "autofix.json"), {
    applied: autoFixRulesApplied.length > 0,
    rules: autoFixRulesApplied
  });

  const manifest: Manifest = {
    run_id: runId,
    started_at: startedAt,
    ended_at: clock.deterministic ? clock.nowIso : nowIso(),
    input_hash: inputHash,
    research_hash: hashJson(thinking.researchPack),
    spec_hash: hashJson(thinking.slideSpec),
    renderer_version: rendering.rendererVersion,
    qa_score: qa.report.qa_score,
    status: qa.report.passed ? "success" : "failed",
    deterministic_mode: clock.deterministic,
    deterministic_seed: clock.seed
  };

  validateSchema("manifest.schema.json", manifest, "manifest");
  writeManifest(runPaths, manifest);

  logger.info(
    {
      runId,
      runRoot: runPaths.runRoot,
      report: rendering.reportPath,
      qaScore: qa.report.qa_score,
      passed: qa.report.passed,
      autoFixRulesApplied
    },
    "Pipeline completed"
  );

  if (!qa.report.passed) {
    throw new PipelineError(`QA score ${qa.report.qa_score} is below threshold ${qa.report.threshold}`);
  }

  return {
    runRoot: runPaths.runRoot,
    qaScore: qa.report.qa_score
  };
}
