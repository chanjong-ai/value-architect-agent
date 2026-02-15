import {
  BriefInput,
  BriefNormalized,
  buildExecutionClock,
  ExecutionClock,
  ResearchPack,
  SlideSpec
} from "@consulting-ppt/shared";
import { normalizeBrief } from "./brief-normalizer";
import { enrichResearchPack, orchestrateResearch } from "./research-orchestrator";
import { PlannedSlide, planNarrative } from "./narrative-planner";
import { buildSlideSpec } from "./spec-builder";
import { runSelfCritic } from "./self-critic";
import { validateSchema } from "./validator";
import { ContentQualityReport, runContentQualityGate } from "./content-quality-gate";

const MIN_NARRATIVE_REVIEW_ROUNDS = 3;
const MIN_CONTENT_REVIEW_ROUNDS = 3;
const MAX_NARRATIVE_FOCUS_CHARS = 190;

type NarrativeIssueType = "duplicate_title" | "focus_repetition" | "section_regression" | "focus_overflow";
type ContentIssueType =
  | "duplicate_gm"
  | "duplicate_claim"
  | "storyline_gap"
  | "generic_title"
  | "weak_gm_tone"
  | "weak_claim_specificity";

interface NarrativeIssue {
  type: NarrativeIssueType;
  slideIndex: number;
  relatedSlideIndex?: number;
  message: string;
}

interface ContentIssue {
  type: ContentIssueType;
  slideIndex: number;
  claimIndex?: number;
  relatedSlideIndex?: number;
  message: string;
}

export interface ThinkingReviewRound {
  round: number;
  narrative_issue_count: number;
  content_issue_count: number;
  notes: string[];
}

export interface ThinkingReviewReport {
  narrative_rounds: number;
  content_rounds: number;
  rounds: ThinkingReviewRound[];
}

export interface ThinkingResult {
  brief: BriefNormalized;
  researchPack: ResearchPack;
  narrativePlan: PlannedSlide[];
  slideSpec: SlideSpec;
  clock: ExecutionClock;
  reviewReport: ThinkingReviewReport;
  contentQualityReport: ContentQualityReport;
}

export interface ThinkingOptions {
  clock?: ExecutionClock;
  researchPackOverride?: ResearchPack;
  briefOverride?: BriefNormalized;
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateSmart(value: string, maxChars: number): string {
  const normalized = compact(value);
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const sentences = normalized
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  let built = "";
  for (const sentence of sentences) {
    const candidate = built ? `${built} ${sentence}` : sentence;
    if (candidate.length <= maxChars - 3) {
      built = candidate;
      continue;
    }
    break;
  }

  if (built.length >= Math.min(48, maxChars - 3)) {
    return `${built.replace(/[.。]+$/g, "")}...`;
  }

  return `${normalized.slice(0, Math.max(16, maxChars - 3)).trim()}...`;
}

function appendFocusClause(focus: string, clause: string, maxChars = MAX_NARRATIVE_FOCUS_CHARS): string {
  const cleanFocus = compact(focus);
  const cleanClause = compact(clause);
  if (!cleanClause) {
    return truncateSmart(cleanFocus, maxChars);
  }

  const normalizedFocus = normalizeText(cleanFocus);
  if (normalizedFocus.includes(normalizeText(cleanClause))) {
    return truncateSmart(cleanFocus, maxChars);
  }

  return truncateSmart(`${cleanFocus}. ${cleanClause}`, maxChars);
}

function fitFocusLength(focus: string): string {
  return truncateSmart(focus, MAX_NARRATIVE_FOCUS_CHARS);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(?\s*so what:\s*([^)]+)\)?/gi, "")
    .replace(/[^a-z0-9가-힣\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function tokenJaccard(left: string[], right: string[]): number {
  const setLeft = new Set(left);
  const setRight = new Set(right);
  if (setLeft.size === 0 || setRight.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of setLeft) {
    if (setRight.has(token)) {
      intersection += 1;
    }
  }

  const union = setLeft.size + setRight.size - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function sectionRank(section: PlannedSlide["section"]): number {
  switch (section) {
    case "problem":
      return 1;
    case "insight":
      return 2;
    case "option":
      return 3;
    case "recommendation":
      return 4;
    case "execution":
      return 5;
    case "appendix":
      return 6;
    default:
      return 9;
  }
}

function sectionLabel(section: PlannedSlide["section"]): string {
  switch (section) {
    case "problem":
      return "문제정의";
    case "insight":
      return "인사이트";
    case "option":
      return "대안";
    case "recommendation":
      return "권고";
    case "execution":
      return "실행";
    case "appendix":
      return "부록";
    default:
      return "핵심";
  }
}

function analyzeNarrativePlan(plan: PlannedSlide[]): NarrativeIssue[] {
  const issues: NarrativeIssue[] = [];
  const seenTitle = new Map<string, number>();

  for (const [index, slide] of plan.entries()) {
    const titleKey = normalizeText(slide.title);
    if (seenTitle.has(titleKey)) {
      issues.push({
        type: "duplicate_title",
        slideIndex: index,
        relatedSlideIndex: seenTitle.get(titleKey),
        message: `title duplicate: ${slide.title}`
      });
    } else {
      seenTitle.set(titleKey, index);
    }

    if (compact(slide.focus).length > MAX_NARRATIVE_FOCUS_CHARS) {
      issues.push({
        type: "focus_overflow",
        slideIndex: index,
        message: `focus overflow ${slide.focus.length}`
      });
    }
  }

  for (let index = 1; index < plan.length; index += 1) {
    const prev = plan[index - 1];
    const current = plan[index];
    if (sectionRank(current.section) + 1 < sectionRank(prev.section)) {
      issues.push({
        type: "section_regression",
        slideIndex: index,
        relatedSlideIndex: index - 1,
        message: `${prev.section} -> ${current.section}`
      });
    }

    const similarity = tokenJaccard(tokenize(prev.focus), tokenize(current.focus));
    if (similarity >= 0.88) {
      issues.push({
        type: "focus_repetition",
        slideIndex: index,
        relatedSlideIndex: index - 1,
        message: `focus similarity ${similarity.toFixed(2)}`
      });
    }
  }

  return issues;
}

function refineNarrativePlan(plan: PlannedSlide[], issues: NarrativeIssue[], round: number, brief: BriefNormalized): PlannedSlide[] {
  const cloned = plan.map((slide) => ({ ...slide }));
  const issuesBySlide = new Map<number, NarrativeIssue[]>();
  for (const issue of issues) {
    const bucket = issuesBySlide.get(issue.slideIndex) ?? [];
    bucket.push(issue);
    issuesBySlide.set(issue.slideIndex, bucket);
  }

  for (const [index, slide] of cloned.entries()) {
    const scopedIssues = issuesBySlide.get(index) ?? [];
    for (const issue of scopedIssues) {
      if (issue.type === "duplicate_title") {
        slide.title = `${slide.title} - ${sectionLabel(slide.section)}`;
      } else if (issue.type === "focus_repetition") {
        slide.focus = appendFocusClause(slide.focus, `전장 대비 ${brief.target_company} 의사결정 쟁점을 분리한다`);
      } else if (issue.type === "section_regression") {
        slide.focus = appendFocusClause(slide.focus, `스토리라인 전개상 ${sectionLabel(slide.section)} 단계의 판단 축을 보강한다`);
      } else if (issue.type === "focus_overflow") {
        slide.focus = fitFocusLength(slide.focus);
      }
    }

    if (!slide.focus.includes("의사결정")) {
      slide.focus = appendFocusClause(slide.focus, "경영진 의사결정에 직접 연결한다");
    }

    if (round > 1 && !slide.focus.includes("근거")) {
      slide.focus = appendFocusClause(slide.focus, "정량 근거 기반으로 우선순위를 검증한다");
    }

    slide.focus = fitFocusLength(slide.focus);
  }

  return cloned;
}

function ensureNarrativeCoverage(plan: PlannedSlide[], brief: BriefNormalized): PlannedSlide[] {
  if (brief.must_include.length === 0) {
    return plan;
  }

  const cloned = plan.map((slide) => ({ ...slide }));
  const corpus = normalizeText(cloned.map((slide) => `${slide.title} ${slide.focus}`).join(" "));
  const uncovered = brief.must_include.filter((item) => !corpus.includes(normalizeText(item)));
  if (uncovered.length === 0) {
    return cloned.map((slide) => ({
      ...slide,
      focus: fitFocusLength(slide.focus)
    }));
  }

  const bySectionOrder: PlannedSlide["section"][] = ["insight", "option", "recommendation", "execution", "problem", "appendix"];
  let cursor = 0;

  for (const keyword of uncovered) {
    const orderedSlides = bySectionOrder
      .flatMap((section) => cloned.filter((slide) => slide.section === section))
      .filter((slide) => !normalizeText(`${slide.title} ${slide.focus}`).includes(normalizeText(keyword)));

    if (orderedSlides.length === 0) {
      continue;
    }

    const selected = orderedSlides[cursor % orderedSlides.length] ?? orderedSlides[0];
    if (!selected) {
      continue;
    }

    const clause = `${keyword}을 핵심 검토 항목으로 포함한다`;
    selected.focus = appendFocusClause(selected.focus, clause);
    cursor += 1;
  }

  return cloned.map((slide) => ({
    ...slide,
    focus: fitFocusLength(slide.focus)
  }));
}

function extractSoWhat(text: string): string {
  const matched = text.match(/\(?\s*So What:\s*([^)]+)\)?/i);
  return compact(matched?.[1] ?? "의사결정과 실행 우선순위를 명확히 한다");
}

function normalizeClaimSoWhat(text: string, fallback: string): string {
  const body = compact(text.replace(/\(?\s*So What:\s*([^)]+)\)?/gi, "").replace(/[.。]+$/g, ""));
  const soWhat = extractSoWhat(text) || fallback;
  return `${body} (So What: ${soWhat})`;
}

function hasConsultingDecisionTone(value: string): boolean {
  return /(우선순위|재정렬|재설계|전환|구체화|강화|고도화|필요|해야)/.test(value);
}

function genericTitle(value: string): boolean {
  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }
  return /^(executive summary|시장 개요|경쟁 환경|재무 성과 비교|리스크 분석|전략적 시사점|트렌드 기회)$/.test(normalized);
}

function weakClaimSpecificity(value: string, brief: BriefNormalized): boolean {
  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }

  const hasNumeric = /\d/.test(value) || /kpi/i.test(value);
  const entityTerms = [brief.target_company, ...brief.competitors, "시장", "고객", "수익성", "포지셔닝"]
    .map((term) => normalizeText(term))
    .filter((term) => term.length >= 2);
  const hasEntity = entityTerms.some((term) => normalized.includes(term));

  return !hasNumeric || !hasEntity;
}

function analyzeContent(spec: SlideSpec, brief: BriefNormalized): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const gmSeen = new Map<string, number>();
  const claims: Array<{ slideIndex: number; claimIndex: number; tokens: string[] }> = [];

  spec.slides.forEach((slide, slideIndex) => {
    if (genericTitle(slide.title)) {
      issues.push({
        type: "generic_title",
        slideIndex,
        message: "generic title tone"
      });
    }

    if (!hasConsultingDecisionTone(slide.governing_message)) {
      issues.push({
        type: "weak_gm_tone",
        slideIndex,
        message: "governing message lacks consulting decision tone"
      });
    }

    const gmKey = normalizeText(slide.governing_message);
    if (gmSeen.has(gmKey)) {
      issues.push({
        type: "duplicate_gm",
        slideIndex,
        relatedSlideIndex: gmSeen.get(gmKey),
        message: "governing message duplicated"
      });
    } else {
      gmSeen.set(gmKey, slideIndex);
    }

    slide.claims.forEach((claim, claimIndex) => {
      if (weakClaimSpecificity(claim.text, brief)) {
        issues.push({
          type: "weak_claim_specificity",
          slideIndex,
          claimIndex,
          message: "claim specificity is weak"
        });
      }
      claims.push({
        slideIndex,
        claimIndex,
        tokens: tokenize(claim.text)
      });
    });
  });

  for (let i = 0; i < claims.length; i += 1) {
    for (let j = i + 1; j < claims.length; j += 1) {
      const similarity = tokenJaccard(claims[i].tokens, claims[j].tokens);
      if (similarity < 0.86) {
        continue;
      }
      issues.push({
        type: "duplicate_claim",
        slideIndex: claims[j].slideIndex,
        claimIndex: claims[j].claimIndex,
        relatedSlideIndex: claims[i].slideIndex,
        message: `claim similarity ${similarity.toFixed(2)}`
      });
    }
  }

  for (let index = 1; index < spec.slides.length; index += 1) {
    const prev = spec.slides[index - 1];
    const current = spec.slides[index];
    const similarity = tokenJaccard(
      tokenize(`${prev.title} ${prev.governing_message}`),
      tokenize(`${current.title} ${current.governing_message}`)
    );
    if (similarity < 0.03) {
      issues.push({
        type: "storyline_gap",
        slideIndex: index,
        relatedSlideIndex: index - 1,
        message: `storyline gap ${similarity.toFixed(2)}`
      });
    }
  }

  return issues;
}

function refineContent(spec: SlideSpec, issues: ContentIssue[], round: number): SlideSpec {
  const cloned = JSON.parse(JSON.stringify(spec)) as SlideSpec;
  const issuesBySlide = new Map<number, ContentIssue[]>();
  for (const issue of issues) {
    const bucket = issuesBySlide.get(issue.slideIndex) ?? [];
    bucket.push(issue);
    issuesBySlide.set(issue.slideIndex, bucket);
  }

  for (const [slideIndex, slide] of cloned.slides.entries()) {
    const scoped = issuesBySlide.get(slideIndex) ?? [];
    for (const issue of scoped) {
      if (issue.type === "duplicate_gm") {
        slide.governing_message = `${compact(slide.governing_message)} | ${slide.title} 기준 핵심 판단`;
      } else if (issue.type === "duplicate_claim") {
        const claim = slide.claims[issue.claimIndex ?? 0];
        if (!claim) {
          continue;
        }
        const soWhat = extractSoWhat(claim.text);
        claim.text = normalizeClaimSoWhat(
          `${claim.text}. ${slide.title}에서 ${(issue.claimIndex ?? 0) + 1}순위 실행 과제로 재정의한다`,
          soWhat
        );
      } else if (issue.type === "storyline_gap") {
        const prevTitle = cloned.slides[slideIndex - 1]?.title ?? "전장";
        slide.governing_message = `${compact(slide.governing_message)} | 전장(${prevTitle}) 인사이트를 실행 축으로 연결`;
      } else if (issue.type === "generic_title") {
        const labelByType: Record<SlideSpec["slides"][number]["type"], string> = {
          cover: "오프닝",
          "exec-summary": "핵심결론",
          "market-landscape": "시장진단",
          benchmark: "경쟁비교",
          "risks-issues": "리스크",
          roadmap: "실행",
          appendix: "부록"
        };
        slide.title = `${slide.title} - ${labelByType[slide.type]}`;
      } else if (issue.type === "weak_gm_tone") {
        slide.governing_message = `${compact(slide.governing_message)}. 경영진 의사결정을 위해 우선순위 재정렬이 필요하다`;
      } else if (issue.type === "weak_claim_specificity") {
        const claim = slide.claims[issue.claimIndex ?? 0];
        if (!claim) {
          continue;
        }
        const soWhat = extractSoWhat(claim.text);
        claim.text = normalizeClaimSoWhat(
          `${claim.text}. ${slide.title} 기준 핵심 지표와 비교 대상을 명시해 ${round}차 검증에서 재확인한다`,
          soWhat
        );
      }
    }

    slide.governing_message = compact(slide.governing_message);
    for (let claimIndex = 0; claimIndex < slide.claims.length; claimIndex += 1) {
      const claim = slide.claims[claimIndex];
      claim.text = normalizeClaimSoWhat(claim.text, "의사결정 연결성을 강화한다");
    }
  }

  return cloned;
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
    ? enrichResearchPack(brief, runId, clock, options.researchPackOverride)
    : orchestrateResearch(brief, runId, clock);
  validateSchema("research-pack.schema.json", researchPack, "research pack");

  const rounds: ThinkingReviewRound[] = [];
  let narrativePlan = planNarrative(brief, researchPack);

  for (let round = 1; round <= MIN_NARRATIVE_REVIEW_ROUNDS; round += 1) {
    const issues = analyzeNarrativePlan(narrativePlan);
    narrativePlan = refineNarrativePlan(narrativePlan, issues, round, brief);
    narrativePlan = ensureNarrativeCoverage(narrativePlan, brief);
    rounds.push({
      round,
      narrative_issue_count: issues.length,
      content_issue_count: 0,
      notes: [`narrative-round-${round}`, `issues:${issues.length}`]
    });
  }

  let revisedSpec = buildSlideSpec(brief, researchPack, narrativePlan, runId, clock);
  for (let round = 1; round <= MIN_CONTENT_REVIEW_ROUNDS; round += 1) {
    revisedSpec = runSelfCritic(revisedSpec, brief, researchPack);
    const contentIssues = analyzeContent(revisedSpec, brief);
    revisedSpec = refineContent(revisedSpec, contentIssues, round);

    const target = rounds[round - 1] ?? {
      round,
      narrative_issue_count: 0,
      content_issue_count: 0,
      notes: []
    };
    target.content_issue_count = contentIssues.length;
    target.notes = [...target.notes, `content-round-${round}`, `issues:${contentIssues.length}`];
    rounds[round - 1] = target;
  }

  revisedSpec = runSelfCritic(revisedSpec, brief, researchPack);
  const contentQuality = runContentQualityGate(revisedSpec, brief, researchPack);
  revisedSpec = contentQuality.spec;
  validateSchema("slidespec.schema.json", revisedSpec, "slidespec");

  const reviewReport: ThinkingReviewReport = {
    narrative_rounds: MIN_NARRATIVE_REVIEW_ROUNDS,
    content_rounds: MIN_CONTENT_REVIEW_ROUNDS,
    rounds
  };

  return {
    brief,
    researchPack,
    narrativePlan,
    slideSpec: revisedSpec,
    clock,
    reviewReport,
    contentQualityReport: contentQuality.report
  };
}

export { normalizeBrief } from "./brief-normalizer";
export { orchestrateResearch } from "./research-orchestrator";
export { enrichResearchPack } from "./research-orchestrator";
export { planNarrative } from "./narrative-planner";
export type { PlannedSlide } from "./narrative-planner";
export { buildSlideSpec } from "./spec-builder";
export { runSelfCritic } from "./self-critic";
export { validateSchema } from "./validator";
export { runContentQualityGate } from "./content-quality-gate";
export type { ContentQualityReport } from "./content-quality-gate";
export { buildTrustedWebResearchPack } from "./web-research";
export { buildTrustedWebResearchPlan } from "./web-research";
export { mergeResearchPacks } from "./web-research";
export type {
  TrustedResearchTarget,
  TrustedWebResearchOptions,
  TrustedWebResearchResult,
  WebResearchAttempt,
  WebResearchReport,
  WebResearchRoundSummary
} from "./web-research";
