import { SlideSpec, SlideSpecSlide } from "@consulting-ppt/shared";
import { classifySemanticIconCategory } from "./icon-library";
import { AdaptiveLayoutTemplate, Box, buildLayout } from "./layout-engine";
import { LayoutPlan, LayoutPlannerOptions, planLayoutForSlide } from "./layout-planner";
import {
  estimateCharCapacity,
  fitClaimPreserveSoWhat,
  fitGoverningMessagePreserveDecision,
  fitTextToCapacity
} from "./text-fit";

export interface SlideLayoutDecision extends LayoutPlan {
  slide_id: string;
  slide_type: SlideSpecSlide["type"];
  page: number;
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
}

export interface PreparedLayoutSpecResult {
  effectiveSpec: SlideSpec;
  decisions: SlideLayoutDecision[];
}

interface TemplateSelectionContext {
  round: number;
  totalSlides: number;
  usage: Map<AdaptiveLayoutTemplate, number>;
  previousTemplate: AdaptiveLayoutTemplate | null;
  previousStreak: number;
}

type DeckReviewIssueType =
  | "claim_repetition"
  | "governing_message_repetition"
  | "governing_tone"
  | "storyline_gap"
  | "icon_imbalance"
  | "template_imbalance"
  | "layout_content_mismatch";

interface DeckReviewIssue {
  type: DeckReviewIssueType;
  slideIndex: number;
  claimIndex?: number;
  template?: AdaptiveLayoutTemplate;
  message: string;
}

interface DeckReviewResult {
  score: number;
  issues: DeckReviewIssue[];
}

const TEMPLATE_CANDIDATES_BY_TYPE: Record<SlideSpecSlide["type"], AdaptiveLayoutTemplate[]> = {
  cover: ["cover-hero", "single-panel"],
  "exec-summary": ["kpi-dashboard", "top-bottom", "two-column", "left-focus"],
  "market-landscape": ["left-focus", "right-focus", "two-column", "top-bottom", "single-panel"],
  benchmark: ["two-column", "left-focus", "right-focus", "quad", "single-panel"],
  "risks-issues": ["quad", "top-bottom", "two-column", "single-panel"],
  roadmap: ["timeline", "top-bottom", "left-focus", "single-panel"],
  appendix: ["single-panel", "two-column", "left-focus"]
};

const CLAIM_REPETITION_THRESHOLD_BY_ROUND = [0.82, 0.8, 0.79, 0.78];
const MIN_LAYOUT_REVIEW_ROUNDS = 3;

function normalizeScore(value: number): number {
  return Number(value.toFixed(4));
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

function tokenJaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let inter = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      inter += 1;
    }
  }

  const union = setA.size + setB.size - inter;
  return union <= 0 ? 0 : inter / union;
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanupSentenceEnd(value: string): string {
  return compact(value).replace(/[.。]+$/g, "");
}

function extractSoWhat(value: string): string | null {
  const matched = value.match(/\(?\s*So What:\s*([^)]+)\)?/i);
  if (!matched) {
    return null;
  }
  return cleanupSentenceEnd(matched[1] ?? "");
}

function normalizeClaimSoWhat(value: string, fallbackSoWhat = "의사결정 연결성을 강화한다"): string {
  const normalized = compact(value);
  if (!normalized) {
    return `(So What: ${fallbackSoWhat})`;
  }

  const soWhat = extractSoWhat(normalized) ?? fallbackSoWhat;
  const body = cleanupSentenceEnd(normalized.replace(/\(?\s*So What:\s*([^)]+)\)?/gi, ""));
  return `${body} (So What: ${soWhat})`;
}

function keepSingleSoWhatSegment(text: string): string {
  return normalizeClaimSoWhat(text);
}

function detectClaimPhase(text: string, claimIndex: number): "diagnosis" | "implication" | "action" {
  if (claimIndex === 0) {
    return "diagnosis";
  }
  if (claimIndex === 1) {
    return "implication";
  }
  if (claimIndex >= 2) {
    return "action";
  }

  const normalized = normalizeText(text);
  if (normalized.includes("진단")) {
    return "diagnosis";
  }
  if (normalized.includes("해석")) {
    return "implication";
  }
  if (normalized.includes("실행")) {
    return "action";
  }

  return "action";
}

function phaseFallbackSoWhat(phase: "diagnosis" | "implication" | "action"): string {
  if (phase === "diagnosis") {
    return "핵심 이슈를 정량 근거와 함께 재정렬한다";
  }
  if (phase === "implication") {
    return "대안 간 트레이드오프를 명확히 한다";
  }
  return "우선순위 실행과 책임 체계를 구체화한다";
}

function rewriteClaimForUniqueness(
  slide: SlideSpecSlide,
  claim: string,
  claimIndex: number,
  round: number
): string {
  const phase = detectClaimPhase(claim, claimIndex);
  const soWhat = extractSoWhat(claim) ?? phaseFallbackSoWhat(phase);
  const body = cleanupSentenceEnd(claim.replace(/\(?\s*So What:\s*([^)]+)\)?/gi, ""));
  const shortTitle = slide.title.length > 18 ? `${slide.title.slice(0, 18).trim()}...` : slide.title;
  const differentiation =
    phase === "diagnosis"
      ? "핵심 원인 축"
      : phase === "implication"
        ? "대안별 트레이드오프"
        : "실행 오너십/KPI";

  if (body.includes(shortTitle) && body.includes(differentiation)) {
    return normalizeClaimSoWhat(body, soWhat);
  }

  return normalizeClaimSoWhat(
    `${body}. ${shortTitle} 기준 ${differentiation}를 ${round}차 검증으로 확정한다`,
    soWhat
  );
}

function applyUniqueSuffix(value: string, suffix: string): string {
  if (!suffix.trim() || value.includes(suffix)) {
    return value;
  }
  return `${value} | ${suffix}`;
}

function resolveReviewRounds(): number {
  const raw = Number(process.env.PPT_PRE_RENDER_REVIEW_ROUNDS ?? "4");
  if (!Number.isFinite(raw)) {
    return 4;
  }
  return Math.max(3, Math.min(8, Math.floor(raw)));
}

function safeArea(area: Box): Box {
  return {
    x: area.x,
    y: area.y,
    w: Math.max(area.w, 0.3),
    h: Math.max(area.h, 0.2)
  };
}

function splitAreaVertical(area: Box, count: number): Box[] {
  if (count <= 1) {
    return [safeArea(area)];
  }
  const gap = 0.06;
  const sectionH = (area.h - gap * (count - 1)) / count;
  const output: Box[] = [];
  for (let i = 0; i < count; i += 1) {
    output.push(
      safeArea({
        x: area.x,
        y: area.y + i * (sectionH + gap),
        w: area.w,
        h: sectionH
      })
    );
  }
  return output;
}

function sortVisuals(slideSpec: SlideSpecSlide): SlideSpecSlide["visuals"] {
  return [...slideSpec.visuals].sort((a, b) => {
    const priorityA = typeof a.options?.priority === "number" ? a.options.priority : 99;
    const priorityB = typeof b.options?.priority === "number" ? b.options.priority : 99;
    return priorityA - priorityB;
  });
}

function resolveAreasForVisuals(contentAreas: Box[], visualCount: number): Box[] {
  if (visualCount <= 0) {
    return [safeArea(contentAreas[0])];
  }

  if (contentAreas.length === 0) {
    return [];
  }

  if (visualCount <= contentAreas.length) {
    return contentAreas.slice(0, visualCount).map(safeArea);
  }

  const pinned = contentAreas.slice(0, contentAreas.length - 1).map(safeArea);
  const last = contentAreas[contentAreas.length - 1];
  const extraCount = visualCount - pinned.length;
  const split = splitAreaVertical(last, extraCount);
  return [...pinned, ...split];
}

function estimateTitleCapacity(slide: SlideSpecSlide, template: AdaptiveLayoutTemplate): number {
  const layout = buildLayout(slide.type, template);
  return estimateCharCapacity(layout.title, 20, {
    fillRatio: 0.82,
    minCapacity: 28
  });
}

function estimateGoverningMessageCapacity(slide: SlideSpecSlide, template: AdaptiveLayoutTemplate): number {
  const layout = buildLayout(slide.type, template);
  return estimateCharCapacity(layout.takeaway, 11, {
    fillRatio: 0.84,
    minCapacity: 42
  });
}

function estimateClaimCapacityByVisual(kind: string, area: Box, claimCount: number): number | null {
  const claims = Math.max(1, claimCount);

  if (kind === "bullets") {
    const rows = Math.min(5, claims);
    const lineGap = Math.max(0.34, (area.h - 0.38) / Math.max(rows, 1));
    return estimateCharCapacity(
      {
        x: 0,
        y: 0,
        w: Math.max(0.2, area.w - 0.46),
        h: Math.max(0.1, lineGap - 0.04)
      },
      8,
      { fillRatio: 0.84, minCapacity: 56 }
    );
  }

  if (kind === "icon-list") {
    const rows = Math.min(4, claims);
    const rowH = (area.h - 0.26) / Math.max(rows, 1);
    return estimateCharCapacity(
      {
        x: 0,
        y: 0,
        w: Math.max(0.2, area.w - 0.42),
        h: Math.max(0.1, rowH - 0.04)
      },
      7.8,
      { fillRatio: 0.84, minCapacity: 52 }
    );
  }

  if (kind === "kpi-cards") {
    const cardCount = Math.min(4, Math.max(3, claims));
    const gap = 0.08;
    const cardW = (area.w - gap * (cardCount - 1)) / cardCount;
    return estimateCharCapacity(
      {
        x: 0,
        y: 0,
        w: Math.max(0.2, cardW - 0.16),
        h: Math.max(0.12, area.h - 0.84)
      },
      7.2,
      { fillRatio: 0.86, minCapacity: 42 }
    );
  }

  if (kind === "matrix") {
    const cellW = (area.w - 0.08) / 2;
    const cellH = (area.h - 0.14) / 2;
    return estimateCharCapacity(
      {
        x: 0,
        y: 0,
        w: Math.max(0.18, cellW - 0.08),
        h: Math.max(0.1, cellH - 0.26)
      },
      7,
      { fillRatio: 0.84, minCapacity: 40 }
    );
  }

  if (kind === "timeline") {
    const stageW = area.w / 3;
    return estimateCharCapacity(
      {
        x: 0,
        y: 0,
        w: Math.max(0.18, stageW - 0.2),
        h: Math.max(0.1, area.h - 0.86)
      },
      7,
      { fillRatio: 0.86, minCapacity: 44 }
    );
  }

  if (kind === "flow") {
    const stepW = (area.w - 0.3) / 4;
    return estimateCharCapacity(
      {
        x: 0,
        y: 0,
        w: Math.max(0.18, stepW - 0.14),
        h: Math.max(0.1, area.h - 0.68)
      },
      7,
      { fillRatio: 0.86, minCapacity: 36 }
    );
  }

  if (kind === "action-cards") {
    const cardCount = 3;
    const gap = 0.08;
    const cardW = (area.w - gap * (cardCount - 1)) / cardCount;
    return estimateCharCapacity(
      {
        x: 0,
        y: 0,
        w: Math.max(0.18, cardW - 0.16),
        h: Math.max(0.1, area.h - 0.5)
      },
      7,
      { fillRatio: 0.86, minCapacity: 44 }
    );
  }

  if (kind === "so-what-grid") {
    const [upper] = splitAreaVertical({ x: area.x, y: area.y + 0.08, w: area.w, h: area.h - 0.12 }, 2);
    return estimateCharCapacity(
      {
        x: 0,
        y: 0,
        w: Math.max(0.18, upper.w - 0.08),
        h: Math.max(0.1, upper.h - 0.26)
      },
      7.4,
      { fillRatio: 0.88, minCapacity: 54 }
    );
  }

  if (kind === "insight-box") {
    return estimateCharCapacity(
      {
        x: 0,
        y: 0,
        w: Math.max(0.18, area.w - 0.2),
        h: Math.max(0.1, area.h - 0.36)
      },
      7.6,
      { fillRatio: 0.88, minCapacity: 70 }
    );
  }

  return null;
}

function estimateClaimCapacity(slide: SlideSpecSlide, template: AdaptiveLayoutTemplate): number {
  const layout = buildLayout(slide.type, template);
  const visuals = sortVisuals(slide);
  const targets = visuals.length === 0 ? [{ kind: "bullets" }] : visuals;
  const areas = resolveAreasForVisuals(layout.contentAreas, targets.length || 1);
  const capacities: number[] = [];

  for (const [index, visual] of targets.entries()) {
    const area = areas[index] ?? areas[areas.length - 1] ?? layout.content;
    const cap = estimateClaimCapacityByVisual(visual.kind, area, slide.claims.length);
    if (typeof cap === "number" && Number.isFinite(cap)) {
      capacities.push(cap);
    }
  }

  if (capacities.length === 0) {
    return 220;
  }

  return Math.max(40, Math.floor(Math.min(...capacities)));
}

function scoreRatio(capacity: number, demand: number): number {
  const safeDemand = Math.max(1, demand);
  return Math.max(0.2, Math.min(1.8, capacity / safeDemand));
}

function estimateFitScore(slide: SlideSpecSlide, template: AdaptiveLayoutTemplate): number {
  const titleCapacity = estimateTitleCapacity(slide, template);
  const gmCapacity = estimateGoverningMessageCapacity(slide, template);
  const claimCapacity = estimateClaimCapacity(slide, template);
  const visibleClaims = slide.claims.slice(0, 4);
  const averageClaimLength =
    visibleClaims.length > 0
      ? visibleClaims.reduce((acc, claim) => acc + claim.text.length, 0) / visibleClaims.length
      : 1;

  const titleScore = scoreRatio(titleCapacity, slide.title.length);
  const gmScore = scoreRatio(gmCapacity, slide.governing_message.length);
  const claimScore = scoreRatio(claimCapacity, averageClaimLength);

  return titleScore * 0.15 + gmScore * 0.35 + claimScore * 0.5;
}

function averageClaimLength(slide: SlideSpecSlide): number {
  if (slide.claims.length === 0) {
    return 0;
  }
  return slide.claims.reduce((sum, claim) => sum + claim.text.length, 0) / slide.claims.length;
}

function hasVisual(slide: SlideSpecSlide, kind: SlideSpecSlide["visuals"][number]["kind"]): boolean {
  return slide.visuals.some((visual) => visual.kind === kind);
}

function isConsultingToneGoverningMessage(value: string): boolean {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  const hasFormulaTone = /([a-z0-9가-힣][^=]{1,40}\+\s*[a-z0-9가-힣][^=]{1,40}=\s*[a-z0-9가-힣])/i.test(normalized);
  if (hasFormulaTone || normalized.includes("결론")) {
    return true;
  }

  return /(우선순위|재정렬|재설계|전환|구체화|강화|고도화|필요|해야)/.test(normalized);
}

function scoreWithTemplateDiversityPenalty(
  rawScore: number,
  template: AdaptiveLayoutTemplate,
  context: TemplateSelectionContext
): number {
  let score = rawScore;
  const usage = context.usage.get(template) ?? 0;
  const usageRatio = usage / Math.max(1, context.totalSlides - 1);

  if (usageRatio > 0.4) {
    if (context.round >= 3) {
      score *= 0.86;
    } else if (context.round === 2) {
      score *= 0.9;
    } else {
      score *= 0.95;
    }
  }

  if (usageRatio > 0.55) {
    score *= context.round >= 3 ? 0.78 : 0.85;
  }

  if (context.previousTemplate === template && context.previousStreak >= 2) {
    const streakPenalty = Math.min(0.18, 0.04 * context.previousStreak);
    score *= 1 - streakPenalty;
  }

  return score;
}

function chooseTemplate(
  slide: SlideSpecSlide,
  plan: LayoutPlan,
  context: TemplateSelectionContext
): { selectedPlan: LayoutPlan; fitBefore: number; templateAdjusted: boolean } {
  const candidates = Array.from(new Set([plan.template, ...(TEMPLATE_CANDIDATES_BY_TYPE[slide.type] ?? [])]));
  const baseRawScore = estimateFitScore(slide, plan.template);
  const baseScored = scoreWithTemplateDiversityPenalty(baseRawScore, plan.template, context);

  let bestTemplate = plan.template;
  let bestScored = baseScored;

  for (const candidate of candidates) {
    const raw = estimateFitScore(slide, candidate);
    const scored = scoreWithTemplateDiversityPenalty(raw, candidate, context);
    if (scored > bestScored) {
      bestTemplate = candidate;
      bestScored = scored;
    }
  }

  const canSwitch = bestTemplate !== plan.template && bestScored > baseScored * 1.04;
  if (!canSwitch) {
    return {
      selectedPlan: plan,
      fitBefore: baseRawScore,
      templateAdjusted: false
    };
  }

  return {
    selectedPlan: {
      ...plan,
      template: bestTemplate,
      rationale: `${plan.rationale} | content-fit+design 보정(${plan.template}→${bestTemplate})`
    },
    fitBefore: baseRawScore,
    templateAdjusted: true
  };
}

function adjustTexts(slide: SlideSpecSlide, template: AdaptiveLayoutTemplate): { title: boolean; governing_message: boolean; claims: number } {
  const titleCapacity = estimateTitleCapacity(slide, template);
  const gmCapacity = estimateGoverningMessageCapacity(slide, template);
  const claimCapacity = Math.min(165, estimateClaimCapacity(slide, template));

  const fittedTitle = slide.title.length > titleCapacity + 6 ? fitTextToCapacity(slide.title, titleCapacity) : { text: slide.title };
  const fittedGm =
    slide.governing_message.length > gmCapacity + 10
      ? fitGoverningMessagePreserveDecision(slide.governing_message, gmCapacity)
      : { text: slide.governing_message };

  const titleChanged = fittedTitle.text !== slide.title;
  const gmChanged = fittedGm.text !== slide.governing_message;

  if (titleChanged) {
    slide.title = fittedTitle.text;
  }
  if (gmChanged) {
    slide.governing_message = fittedGm.text;
  }

  let claimsChanged = 0;
  for (const claim of slide.claims) {
    const fallbackSoWhat = extractSoWhat(claim.text) ?? "의사결정 연결성을 강화한다";
    const normalizedClaim = normalizeClaimSoWhat(keepSingleSoWhatSegment(claim.text), fallbackSoWhat);
    const fittedClaim = normalizedClaim.length > claimCapacity ? fitClaimPreserveSoWhat(normalizedClaim, claimCapacity) : { text: normalizedClaim };
    const finalClaim = normalizeClaimSoWhat(fittedClaim.text, fallbackSoWhat);
    if (finalClaim !== claim.text) {
      claim.text = finalClaim;
      claimsChanged += 1;
    }
  }

  return {
    title: titleChanged,
    governing_message: gmChanged,
    claims: claimsChanged
  };
}

function resolveClaimRepetitionThreshold(round: number): number {
  const index = Math.max(0, Math.min(CLAIM_REPETITION_THRESHOLD_BY_ROUND.length - 1, round - 1));
  return CLAIM_REPETITION_THRESHOLD_BY_ROUND[index] ?? 0.78;
}

function reviewClaimRepetition(spec: SlideSpec, round: number): DeckReviewIssue[] {
  const issues: DeckReviewIssue[] = [];
  const seen = new Set<string>();
  const crossSlideThreshold = resolveClaimRepetitionThreshold(round);
  const sameSlideThreshold = Math.max(crossSlideThreshold + 0.08, 0.86);

  const claimPool: Array<{ slideIndex: number; claimIndex: number; tokens: string[] }> = [];
  spec.slides.forEach((slide, slideIndex) => {
    slide.claims.forEach((claim, claimIndex) => {
      claimPool.push({
        slideIndex,
        claimIndex,
        tokens: tokenize(claim.text)
      });
    });
  });

  for (let i = 0; i < claimPool.length; i += 1) {
    for (let j = i + 1; j < claimPool.length; j += 1) {
      const sameSlide = claimPool[i].slideIndex === claimPool[j].slideIndex;
      const similarity = tokenJaccard(claimPool[i].tokens, claimPool[j].tokens);
      const threshold = sameSlide ? sameSlideThreshold : crossSlideThreshold;
      if (similarity < threshold) {
        continue;
      }

      const key = `${claimPool[j].slideIndex}:${claimPool[j].claimIndex}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      issues.push({
        type: "claim_repetition",
        slideIndex: claimPool[j].slideIndex,
        claimIndex: claimPool[j].claimIndex,
        message: `claim 유사도 과다(${similarity.toFixed(2)} / threshold ${threshold.toFixed(2)})`
      });
    }
  }

  return issues;
}

function reviewGoverningMessageRepetition(spec: SlideSpec): DeckReviewIssue[] {
  const issues: DeckReviewIssue[] = [];
  const history: Array<{ index: number; tokens: string[] }> = [];

  spec.slides.forEach((slide, index) => {
    const currentTokens = tokenize(slide.governing_message);
    const repeated = history.find((item) => tokenJaccard(item.tokens, currentTokens) >= 0.87);
    if (repeated) {
      issues.push({
        type: "governing_message_repetition",
        slideIndex: index,
        message: "거버닝 메시지 중복/유사"
      });
    }
    history.push({ index, tokens: currentTokens });
  });

  return issues;
}

function reviewGoverningTone(spec: SlideSpec): DeckReviewIssue[] {
  const issues: DeckReviewIssue[] = [];

  spec.slides.forEach((slide, slideIndex) => {
    if (isConsultingToneGoverningMessage(slide.governing_message)) {
      return;
    }

    issues.push({
      type: "governing_tone",
      slideIndex,
      message: "거버닝 메시지 톤이 컨설팅 의사결정 문체와 다소 거리가 있음"
    });
  });

  return issues;
}

function reviewLayoutContentMatch(spec: SlideSpec, decisions: SlideLayoutDecision[]): DeckReviewIssue[] {
  const issues: DeckReviewIssue[] = [];

  for (const decision of decisions) {
    const slide = spec.slides[decision.page - 1];
    if (!slide) {
      continue;
    }

    const avgClaim = averageClaimLength(slide);
    const visualCount = slide.visuals.length;
    const hasExecutionVisual = hasVisual(slide, "timeline") || hasVisual(slide, "action-cards") || hasVisual(slide, "flow");
    const hasDataCombo = hasVisual(slide, "table") && (hasVisual(slide, "bar-chart") || hasVisual(slide, "matrix"));

    if (decision.fit_score_after < 1.06) {
      issues.push({
        type: "layout_content_mismatch",
        slideIndex: decision.page - 1,
        template: decision.template,
        message: `텍스트/레이아웃 적합도 낮음(${decision.fit_score_after.toFixed(2)})`
      });
      continue;
    }

    if ((decision.template === "kpi-dashboard" || decision.template === "quad") && avgClaim > 150) {
      issues.push({
        type: "layout_content_mismatch",
        slideIndex: decision.page - 1,
        template: decision.template,
        message: `밀집형 템플릿(${decision.template}) 대비 본문 길이가 길어 과밀 가능성 높음`
      });
      continue;
    }

    if (decision.template === "single-panel" && visualCount >= 3) {
      issues.push({
        type: "layout_content_mismatch",
        slideIndex: decision.page - 1,
        template: decision.template,
        message: "단일 패널 템플릿 대비 시각요소 수가 많아 분산 배치가 필요함"
      });
      continue;
    }

    if (slide.type === "roadmap" && !hasExecutionVisual) {
      issues.push({
        type: "layout_content_mismatch",
        slideIndex: decision.page - 1,
        template: decision.template,
        message: "로드맵 슬라이드에 실행형 시각요소(timeline/action/flow)가 부족함"
      });
      continue;
    }

    if (hasDataCombo && decision.template === "single-panel") {
      issues.push({
        type: "layout_content_mismatch",
        slideIndex: decision.page - 1,
        template: decision.template,
        message: "표+차트/매트릭스 조합은 분할 템플릿이 더 적합함"
      });
    }
  }

  return issues;
}

function reviewStorylineContinuity(spec: SlideSpec): DeckReviewIssue[] {
  const issues: DeckReviewIssue[] = [];

  for (let index = 1; index < spec.slides.length; index += 1) {
    const prev = spec.slides[index - 1];
    const current = spec.slides[index];
    const prevTokens = tokenize(`${prev.title} ${prev.governing_message}`);
    const currentTokens = tokenize(`${current.title} ${current.governing_message}`);
    const similarity = tokenJaccard(prevTokens, currentTokens);

    if (similarity < 0.04) {
      issues.push({
        type: "storyline_gap",
        slideIndex: index,
        message: `전후 슬라이드 연결 약함(${similarity.toFixed(2)})`
      });
    }
  }

  return issues;
}

function reviewIconBalance(spec: SlideSpec): DeckReviewIssue[] {
  const categories: Array<{ slideIndex: number; category: string }> = [];

  spec.slides.forEach((slide, slideIndex) => {
    slide.claims.forEach((claim) => {
      const category = classifySemanticIconCategory(claim.text);
      categories.push({ slideIndex, category });
    });
  });

  if (categories.length < 9) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const item of categories) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0];
  const uniqueCount = sorted.filter(([category]) => category !== "default").length;

  if (!dominant) {
    return [];
  }

  const dominantRatio = dominant[1] / categories.length;
  if (dominantRatio < 0.58 && uniqueCount >= 3) {
    return [];
  }

  const impactedSlides = new Set<number>();
  for (const item of categories) {
    if (item.category === dominant[0]) {
      impactedSlides.add(item.slideIndex);
    }
    if (impactedSlides.size >= 4) {
      break;
    }
  }

  return Array.from(impactedSlides).map((slideIndex) => ({
    type: "icon_imbalance",
    slideIndex,
    message: `아이콘 카테고리 편중(${dominant[0]} ${Math.round(dominantRatio * 100)}%)`
  }));
}

function reviewTemplateBalance(decisions: SlideLayoutDecision[]): DeckReviewIssue[] {
  if (decisions.length < 8) {
    return [];
  }

  const countByTemplate = new Map<AdaptiveLayoutTemplate, number>();
  for (const decision of decisions) {
    countByTemplate.set(decision.template, (countByTemplate.get(decision.template) ?? 0) + 1);
  }

  const dominant = Array.from(countByTemplate.entries()).sort((a, b) => b[1] - a[1])[0];
  if (!dominant) {
    return [];
  }

  const dominantRatio = dominant[1] / decisions.length;
  if (dominantRatio < 0.52) {
    return [];
  }

  const impactedSlides = decisions.filter((decision) => decision.template === dominant[0]).slice(2, 6);
  return impactedSlides.map((decision) => ({
    type: "template_imbalance",
    slideIndex: decision.page - 1,
    template: dominant[0],
    message: `레이아웃 템플릿 편중(${dominant[0]} ${Math.round(dominantRatio * 100)}%)`
  }));
}

function runDeckReview(spec: SlideSpec, round: number, decisions: SlideLayoutDecision[]): DeckReviewResult {
  const issues = [
    ...reviewClaimRepetition(spec, round),
    ...reviewGoverningMessageRepetition(spec),
    ...reviewGoverningTone(spec),
    ...reviewStorylineContinuity(spec),
    ...reviewIconBalance(spec),
    ...reviewTemplateBalance(decisions),
    ...reviewLayoutContentMatch(spec, decisions)
  ];

  const deduction = issues.reduce((acc, issue) => {
    if (issue.type === "claim_repetition" || issue.type === "governing_message_repetition") {
      return acc + 6;
    }
    if (issue.type === "governing_tone") {
      return acc + 4;
    }
    if (issue.type === "storyline_gap") {
      return acc + 4;
    }
    if (issue.type === "template_imbalance" || issue.type === "layout_content_mismatch") {
      return acc + 3;
    }
    return acc + 3;
  }, 0);

  return {
    score: Math.max(0, 100 - deduction),
    issues
  };
}

function pickAlternativeTemplate(
  slide: SlideSpecSlide,
  currentTemplate: AdaptiveLayoutTemplate | undefined,
  round: number
): AdaptiveLayoutTemplate | null {
  const candidates = TEMPLATE_CANDIDATES_BY_TYPE[slide.type] ?? [];
  const alternatives = candidates.filter((candidate) => candidate !== currentTemplate);
  if (alternatives.length === 0) {
    return null;
  }
  return alternatives[(round - 1) % alternatives.length] ?? alternatives[0];
}

function applyTemplateHint(slide: SlideSpecSlide, template: AdaptiveLayoutTemplate): void {
  for (const visual of slide.visuals) {
    visual.options = {
      ...(visual.options ?? {}),
      layout_hint: template
    };
  }
}

function rewriteGoverningMessageForTone(slide: SlideSpecSlide): string {
  const normalized = cleanupSentenceEnd(slide.governing_message.replace(/\s*\+\s*/g, " 및 ").replace(/\s*=\s*/g, ", "));
  const titleAnchor = slide.title.endsWith(":") ? slide.title : `${slide.title}:`;
  const hasDecisionVerb = /(우선순위|재정렬|재설계|전환|구체화|강화|고도화|필요|해야)/.test(normalized);

  if (hasDecisionVerb && normalized.includes(slide.title)) {
    return normalized;
  }

  const stripped = cleanupSentenceEnd(
    normalized
      .replace(slide.title, "")
      .replace(/^[\s:;,-]+/, "")
  );
  const focus = fitTextToCapacity(stripped || "핵심 판단 축", 46).text.replace(/\.\.\.$/, "");
  const compacted = `${titleAnchor} ${focus} 기준으로 우선순위를 재정렬해야 한다`;
  if (/(우선순위|재정렬|재설계|전환|구체화|강화|고도화|필요|해야)/.test(compacted)) {
    return compacted;
  }
  return `${titleAnchor} 경영진 의사결정을 위해 우선순위 재정렬이 필요하다`;
}

function pickBestTemplateForLayoutContent(
  slide: SlideSpecSlide,
  currentTemplate: AdaptiveLayoutTemplate | undefined
): AdaptiveLayoutTemplate | null {
  const candidates = TEMPLATE_CANDIDATES_BY_TYPE[slide.type] ?? [];
  if (candidates.length === 0) {
    return null;
  }

  let bestTemplate: AdaptiveLayoutTemplate | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  const avgClaim = averageClaimLength(slide);

  for (const candidate of candidates) {
    if (candidate === currentTemplate) {
      continue;
    }

    let score = estimateFitScore(slide, candidate);
    if ((candidate === "top-bottom" || candidate === "two-column") && avgClaim > 130) {
      score += 0.06;
    }
    if ((candidate === "kpi-dashboard" || candidate === "quad") && avgClaim > 150) {
      score -= 0.08;
    }
    if (slide.type === "roadmap" && candidate === "timeline") {
      score += 0.08;
    }
    if ((hasVisual(slide, "table") && hasVisual(slide, "bar-chart")) && (candidate === "left-focus" || candidate === "right-focus")) {
      score += 0.05;
    }

    if (score > bestScore) {
      bestScore = score;
      bestTemplate = candidate;
    }
  }

  return bestTemplate;
}

function tightenClaimsForLayout(slide: SlideSpecSlide, maxChars = 150): number {
  let changed = 0;
  for (const claim of slide.claims) {
    const fallbackSoWhat = extractSoWhat(claim.text) ?? "의사결정 연결성을 강화한다";
    const normalized = normalizeClaimSoWhat(claim.text, fallbackSoWhat);
    const fitted = normalized.length > maxChars ? fitClaimPreserveSoWhat(normalized, maxChars) : { text: normalized };
    const final = normalizeClaimSoWhat(fitted.text, fallbackSoWhat);
    if (final !== claim.text) {
      claim.text = final;
      changed += 1;
    }
  }
  return changed;
}

function applyDeckReviewFixes(
  spec: SlideSpec,
  issues: DeckReviewIssue[],
  round: number,
  decisionsBySlide: Map<number, SlideLayoutDecision>
): Map<number, string[]> {
  const notes = new Map<number, string[]>();

  const addNote = (slideIndex: number, note: string): void => {
    const bucket = notes.get(slideIndex) ?? [];
    if (!bucket.includes(note)) {
      bucket.push(note);
      notes.set(slideIndex, bucket);
    }
  };

  for (const issue of issues) {
    const slide = spec.slides[issue.slideIndex];
    if (!slide) {
      continue;
    }

    if (issue.type === "claim_repetition") {
      const claimIndex = issue.claimIndex ?? 0;
      const claim = slide.claims[claimIndex];
      if (!claim) {
        continue;
      }
      claim.text = rewriteClaimForUniqueness(slide, claim.text, claimIndex, round);
      addNote(issue.slideIndex, `round${round}: 반복 claim 재작성`);
      continue;
    }

    if (issue.type === "governing_message_repetition") {
      slide.governing_message = applyUniqueSuffix(
        slide.governing_message,
        `${slide.title} 관점의 우선순위 재정의`
      );
      addNote(issue.slideIndex, `round${round}: 거버닝 메시지 차별화`);
      continue;
    }

    if (issue.type === "governing_tone") {
      slide.governing_message = rewriteGoverningMessageForTone(slide);
      addNote(issue.slideIndex, `round${round}: 거버닝 메시지 컨설팅 톤 보정`);
      continue;
    }

    if (issue.type === "storyline_gap") {
      const prevTitle = spec.slides[issue.slideIndex - 1]?.title;
      const bridge = prevTitle ? `전장(${prevTitle}) 인사이트를 ${slide.title} 판단 축으로 연결` : "전후 맥락 연결";
      slide.governing_message = applyUniqueSuffix(slide.governing_message, bridge);
      addNote(issue.slideIndex, `round${round}: 스토리라인 연결 문구 보강`);
      continue;
    }

    if (issue.type === "template_imbalance") {
      const currentTemplate = decisionsBySlide.get(issue.slideIndex)?.template;
      const alternative = pickAlternativeTemplate(slide, currentTemplate, round);
      if (alternative) {
        applyTemplateHint(slide, alternative);
        addNote(issue.slideIndex, `round${round}: 레이아웃 템플릿 분산 보정(${currentTemplate ?? "na"}→${alternative})`);
      }
      continue;
    }

    if (issue.type === "layout_content_mismatch") {
      const currentTemplate = decisionsBySlide.get(issue.slideIndex)?.template;
      const alternative = pickBestTemplateForLayoutContent(slide, currentTemplate);
      if (alternative) {
        applyTemplateHint(slide, alternative);
        addNote(issue.slideIndex, `round${round}: 레이아웃-본문 정합 보정(${currentTemplate ?? "na"}→${alternative})`);
      }

      const claimAdjusted = tightenClaimsForLayout(slide, 150);
      if (claimAdjusted > 0) {
        addNote(issue.slideIndex, `round${round}: 레이아웃 기준 claim 길이 보정(${claimAdjusted}건)`);
      }
      continue;
    }

    const firstClaim = slide.claims[0];
    if (firstClaim) {
      firstClaim.text = rewriteClaimForUniqueness(slide, firstClaim.text, 0, round + 1);
      addNote(issue.slideIndex, `round${round}: 아이콘/디자인 의미 균형 보강`);
    }
  }

  return notes;
}

function mergeReviewNotes(target: Map<number, Set<string>>, source: Map<number, string[]>): void {
  for (const [slideIndex, notes] of source.entries()) {
    const bucket = target.get(slideIndex) ?? new Set<string>();
    for (const note of notes) {
      bucket.add(note);
    }
    target.set(slideIndex, bucket);
  }
}

function buildRoundDecisions(
  baseDecisions: SlideLayoutDecision[],
  reviewScore: number,
  reviewRound: number,
  notesBySlide: Map<number, Set<string>>,
  unresolvedIssues: DeckReviewIssue[] = []
): SlideLayoutDecision[] {
  const unresolvedBySlide = new Map<number, string[]>();
  for (const issue of unresolvedIssues) {
    const bucket = unresolvedBySlide.get(issue.slideIndex) ?? [];
    const text = `unresolved:${issue.type}`;
    if (!bucket.includes(text)) {
      bucket.push(text);
      unresolvedBySlide.set(issue.slideIndex, bucket);
    }
  }

  return baseDecisions.map((decision, slideIndex) => {
    const notes = new Set<string>(notesBySlide.get(slideIndex) ?? []);
    for (const unresolved of unresolvedBySlide.get(slideIndex) ?? []) {
      notes.add(unresolved);
    }

    return {
      ...decision,
      deck_review_score: normalizeScore(reviewScore),
      review_round: reviewRound,
      review_notes: Array.from(notes)
    };
  });
}

export async function prepareSpecWithLayoutValidation(
  spec: SlideSpec,
  options: LayoutPlannerOptions = {}
): Promise<PreparedLayoutSpecResult> {
  const effectiveSpec = JSON.parse(JSON.stringify(spec)) as SlideSpec;
  const reviewRounds = resolveReviewRounds();
  const minimumRounds = Math.min(reviewRounds, MIN_LAYOUT_REVIEW_ROUNDS);
  const notesBySlide = new Map<number, Set<string>>();

  let finalDecisions: SlideLayoutDecision[] = [];

  for (let round = 1; round <= reviewRounds; round += 1) {
    const roundDecisions: SlideLayoutDecision[] = [];
    const templateUsage = new Map<AdaptiveLayoutTemplate, number>();
    let previousTemplate: AdaptiveLayoutTemplate | null = null;
    let previousStreak = 0;

    for (const [index, slide] of effectiveSpec.slides.entries()) {
      const initialPlan = await planLayoutForSlide(slide, index + 1, effectiveSpec.slides.length, options);
      const selected = chooseTemplate(slide, initialPlan, {
        round,
        totalSlides: effectiveSpec.slides.length,
        usage: templateUsage,
        previousTemplate,
        previousStreak
      });

      const selectedTemplate = selected.selectedPlan.template;
      const usage = templateUsage.get(selectedTemplate) ?? 0;
      templateUsage.set(selectedTemplate, usage + 1);

      if (previousTemplate === selectedTemplate) {
        previousStreak += 1;
      } else {
        previousTemplate = selectedTemplate;
        previousStreak = 1;
      }

      const adjustments = adjustTexts(slide, selectedTemplate);
      const fitAfter = estimateFitScore(slide, selectedTemplate);

      roundDecisions.push({
        ...selected.selectedPlan,
        slide_id: slide.id,
        slide_type: slide.type,
        page: index + 1,
        fit_score_before: normalizeScore(selected.fitBefore),
        fit_score_after: normalizeScore(fitAfter),
        template_adjusted: selected.templateAdjusted,
        text_adjustments: adjustments,
        deck_review_score: 0,
        review_round: round,
        review_notes: []
      });
    }

    const decisionsBySlide = new Map<number, SlideLayoutDecision>();
    for (const decision of roundDecisions) {
      decisionsBySlide.set(decision.page - 1, decision);
    }

    const review = runDeckReview(effectiveSpec, round, roundDecisions);
    if (review.issues.length === 0 && round >= minimumRounds) {
      finalDecisions = buildRoundDecisions(roundDecisions, review.score, round, notesBySlide);
      break;
    }

    if (review.issues.length === 0 && round < minimumRounds) {
      finalDecisions = buildRoundDecisions(roundDecisions, review.score, round, notesBySlide);
      continue;
    }

    if (round === reviewRounds) {
      finalDecisions = buildRoundDecisions(roundDecisions, review.score, round, notesBySlide, review.issues);
      break;
    }

    const applied = applyDeckReviewFixes(effectiveSpec, review.issues, round, decisionsBySlide);
    mergeReviewNotes(notesBySlide, applied);
  }

  return {
    effectiveSpec,
    decisions: finalDecisions
  };
}
