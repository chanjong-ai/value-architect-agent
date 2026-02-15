import { logger, SlideSpecSlide } from "@consulting-ppt/shared";
import { AdaptiveLayoutTemplate, defaultTemplateBySlideType } from "./layout-engine";

export type LayoutProvider = "agentic" | "heuristic" | "openai" | "anthropic";

export interface LayoutPlan {
  template: AdaptiveLayoutTemplate;
  emphasis: "data" | "narrative" | "execution";
  rationale: string;
  provider: LayoutProvider;
}

export interface LayoutPlannerOptions {
  provider?: LayoutProvider;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
}

interface LlmLayoutPayload {
  template?: string;
  emphasis?: string;
  rationale?: string;
}

interface TemplateReason {
  delta: number;
  reason: string;
}

const ALL_TEMPLATES: AdaptiveLayoutTemplate[] = [
  "cover-hero",
  "single-panel",
  "two-column",
  "top-bottom",
  "left-focus",
  "right-focus",
  "quad",
  "timeline",
  "kpi-dashboard"
];

const VALID_TEMPLATES = new Set<AdaptiveLayoutTemplate>(ALL_TEMPLATES);
const VALID_EMPHASIS = new Set<LayoutPlan["emphasis"]>(["data", "narrative", "execution"]);

const RISK_KEYWORDS = ["risk", "리스크", "변동성", "영향도", "발생확률", "위험"];
const EXECUTION_KEYWORDS = ["execution", "action", "roadmap", "실행", "로드맵", "단기", "중기", "장기", "우선순위"];
const COMPARISON_KEYWORDS = ["compare", "comparison", "benchmark", "vs", "경쟁", "비교", "포지셔닝", "매트릭스"];
const SUMMARY_KEYWORDS = ["executive", "summary", "요약", "핵심", "kpi", "지표", "성과"];
const ANALYSIS_KEYWORDS = ["insight", "분석", "시사점", "가설", "진단", "해석"];

const TEMPLATE_CANDIDATES_BY_TYPE: Record<SlideSpecSlide["type"], AdaptiveLayoutTemplate[]> = {
  cover: ["cover-hero", "single-panel"],
  "exec-summary": ["kpi-dashboard", "top-bottom", "two-column", "left-focus", "right-focus", "single-panel"],
  "market-landscape": ["left-focus", "right-focus", "two-column", "top-bottom", "single-panel", "quad"],
  benchmark: ["two-column", "left-focus", "right-focus", "quad", "top-bottom", "single-panel"],
  "risks-issues": ["quad", "top-bottom", "two-column", "left-focus", "single-panel"],
  roadmap: ["timeline", "top-bottom", "left-focus", "two-column", "single-panel"],
  appendix: ["single-panel", "two-column", "left-focus", "top-bottom"]
};

const TYPE_PRIOR: Record<SlideSpecSlide["type"], Partial<Record<AdaptiveLayoutTemplate, number>>> = {
  cover: {
    "cover-hero": 3.2,
    "single-panel": 1.2,
    "two-column": -1.2,
    "top-bottom": -1.2,
    "left-focus": -1.4,
    "right-focus": -1.4,
    quad: -1.4,
    timeline: -1.6,
    "kpi-dashboard": -1.6
  },
  "exec-summary": {
    "kpi-dashboard": 1.5,
    "top-bottom": 1.2,
    "two-column": 1.0,
    "left-focus": 0.9,
    "right-focus": 0.8,
    "single-panel": 0.4,
    timeline: -0.8,
    "cover-hero": -2.8
  },
  "market-landscape": {
    "left-focus": 1.3,
    "right-focus": 1.2,
    "two-column": 1.0,
    "top-bottom": 0.9,
    "single-panel": 0.5,
    quad: 0.4,
    timeline: -0.6,
    "cover-hero": -3
  },
  benchmark: {
    "two-column": 1.4,
    "left-focus": 1.2,
    "right-focus": 1.1,
    quad: 1,
    "top-bottom": 0.7,
    "single-panel": 0.4,
    timeline: -0.7,
    "cover-hero": -3
  },
  "risks-issues": {
    quad: 1.6,
    "top-bottom": 1.2,
    "two-column": 0.9,
    "left-focus": 0.6,
    "single-panel": 0.4,
    timeline: 0.2,
    "cover-hero": -3
  },
  roadmap: {
    timeline: 1.8,
    "top-bottom": 1.3,
    "left-focus": 0.8,
    "two-column": 0.6,
    "single-panel": 0.4,
    quad: 0.2,
    "cover-hero": -3
  },
  appendix: {
    "single-panel": 1.4,
    "two-column": 1.1,
    "left-focus": 0.8,
    "top-bottom": 0.6,
    "right-focus": 0.4,
    quad: 0.2,
    timeline: -0.6,
    "cover-hero": -3
  }
};

function lower(value: string): string {
  return value.toLowerCase();
}

function normalizeTemplate(value: string | undefined): AdaptiveLayoutTemplate | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (VALID_TEMPLATES.has(normalized as AdaptiveLayoutTemplate)) {
    return normalized as AdaptiveLayoutTemplate;
  }
  return null;
}

function normalizeEmphasis(value: string | undefined): LayoutPlan["emphasis"] {
  if (!value) {
    return "narrative";
  }
  const normalized = value.trim().toLowerCase();
  if (VALID_EMPHASIS.has(normalized as LayoutPlan["emphasis"])) {
    return normalized as LayoutPlan["emphasis"];
  }
  if (normalized.includes("data")) {
    return "data";
  }
  if (normalized.includes("exec") || normalized.includes("action")) {
    return "execution";
  }
  return "narrative";
}

function parseJsonLoose(raw: string): LlmLayoutPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as LlmLayoutPayload;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return null;
    }
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as LlmLayoutPayload;
    } catch {
      return null;
    }
  }
}

function requestTimeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

function readHintTemplates(slide: SlideSpecSlide): AdaptiveLayoutTemplate[] {
  const hints: AdaptiveLayoutTemplate[] = [];
  for (const visual of slide.visuals) {
    const hint = visual.options?.layout_hint;
    if (typeof hint !== "string") {
      continue;
    }
    const mapped = normalizeTemplate(hint);
    if (mapped && !hints.includes(mapped)) {
      hints.push(mapped);
    }
  }
  return hints;
}

function keywordHits(corpus: string, keywords: string[]): number {
  let hit = 0;
  for (const keyword of keywords) {
    if (corpus.includes(lower(keyword))) {
      hit += 1;
    }
  }
  return hit;
}

function numericDensity(corpus: string): number {
  const numericCount = (corpus.match(/-?\d+(?:[.,]\d+)?/g) ?? []).length;
  const tokenCount = Math.max(1, corpus.split(/\s+/).filter((token) => token.length > 0).length);
  return numericCount / tokenCount;
}

function averageClaimLength(slide: SlideSpecSlide): number {
  if (slide.claims.length === 0) {
    return 0;
  }
  const total = slide.claims.reduce((sum, claim) => sum + claim.text.length, 0);
  return total / slide.claims.length;
}

function visualCount(slide: SlideSpecSlide, kind: SlideSpecSlide["visuals"][number]["kind"]): number {
  return slide.visuals.filter((visual) => visual.kind === kind).length;
}

function addScore(
  scores: Map<AdaptiveLayoutTemplate, number>,
  reasons: Map<AdaptiveLayoutTemplate, TemplateReason[]>,
  template: AdaptiveLayoutTemplate,
  delta: number,
  reason: string
): void {
  scores.set(template, (scores.get(template) ?? 0) + delta);
  if (Math.abs(delta) < 0.0001) {
    return;
  }
  const bucket = reasons.get(template) ?? [];
  bucket.push({ delta, reason });
  reasons.set(template, bucket);
}

function inferEmphasis(slide: SlideSpecSlide, corpus: string): LayoutPlan["emphasis"] {
  if (slide.type === "cover") {
    return "narrative";
  }

  const dataScore =
    visualCount(slide, "table") * 1.3 +
    visualCount(slide, "bar-chart") * 1.2 +
    visualCount(slide, "pie-chart") * 1.0 +
    visualCount(slide, "kpi-cards") * 1.4 +
    visualCount(slide, "matrix") * 1.1 +
    numericDensity(corpus) * 8;

  const executionScore =
    visualCount(slide, "timeline") * 1.5 +
    visualCount(slide, "action-cards") * 1.4 +
    visualCount(slide, "flow") * 1.2 +
    keywordHits(corpus, EXECUTION_KEYWORDS) * 0.45;

  const narrativeScore =
    visualCount(slide, "bullets") * 1.1 +
    visualCount(slide, "icon-list") * 1.0 +
    visualCount(slide, "insight-box") * 0.9 +
    keywordHits(corpus, ANALYSIS_KEYWORDS) * 0.35 +
    Math.min(1.4, averageClaimLength(slide) / 120);

  if (executionScore >= dataScore && executionScore >= narrativeScore) {
    return "execution";
  }
  if (dataScore >= narrativeScore) {
    return "data";
  }
  return "narrative";
}

function selectTopReasons(entries: TemplateReason[]): string {
  const selected = entries
    .filter((entry) => entry.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.reason.localeCompare(b.reason))
    .slice(0, 3)
    .map((entry) => `${entry.reason}(+${entry.delta.toFixed(2)})`);

  return selected.join(" | ");
}

function heuristicPlan(slide: SlideSpecSlide): LayoutPlan {
  const hintTemplate = readHintTemplates(slide)[0] ?? null;
  const visualKinds = new Set(slide.visuals.map((visual) => visual.kind));

  if (hintTemplate) {
    return {
      template: hintTemplate,
      emphasis: visualKinds.has("table") || visualKinds.has("bar-chart") ? "data" : "narrative",
      rationale: `visual.options.layout_hint=${hintTemplate} 우선 적용`,
      provider: "heuristic"
    };
  }

  if (slide.type === "cover") {
    return {
      template: "cover-hero",
      emphasis: "narrative",
      rationale: "cover는 hero 메시지 중심 배치",
      provider: "heuristic"
    };
  }

  if (visualKinds.has("timeline")) {
    return {
      template: "timeline",
      emphasis: "execution",
      rationale: "timeline visual 존재로 실행형 레이아웃 선택",
      provider: "heuristic"
    };
  }

  if (visualKinds.has("matrix") && visualKinds.has("table")) {
    return {
      template: "two-column",
      emphasis: "data",
      rationale: "matrix+table 조합은 비교형 2단 레이아웃 적합",
      provider: "heuristic"
    };
  }

  if (visualKinds.has("kpi-cards")) {
    return {
      template: "kpi-dashboard",
      emphasis: "data",
      rationale: "kpi-cards 포함으로 대시보드형 레이아웃 선택",
      provider: "heuristic"
    };
  }

  if (visualKinds.has("bar-chart") && visualKinds.has("table")) {
    return {
      template: "left-focus",
      emphasis: "data",
      rationale: "차트+표 동시 배치는 좌측핵심형 레이아웃 적합",
      provider: "heuristic"
    };
  }

  if (visualKinds.has("action-cards") && slide.claims.length >= 3) {
    return {
      template: "top-bottom",
      emphasis: "execution",
      rationale: "액션 카드와 다수 claim 조합에 상하 분할 적용",
      provider: "heuristic"
    };
  }

  return {
    template: defaultTemplateBySlideType(slide.type),
    emphasis: slide.type === "roadmap" ? "execution" : "narrative",
    rationale: `슬라이드 타입(${slide.type}) 기본 템플릿 적용`,
    provider: "heuristic"
  };
}

function agenticPlan(slide: SlideSpecSlide, page: number, total: number): LayoutPlan {
  if (slide.type === "cover") {
    const coverHint = readHintTemplates(slide)[0];
    const selected = coverHint && (coverHint === "cover-hero" || coverHint === "single-panel") ? coverHint : "cover-hero";
    return {
      template: selected,
      emphasis: "narrative",
      rationale: `agentic-local: cover 메시지 구조에 맞춰 ${selected} 선택`,
      provider: "agentic"
    };
  }

  const corpus = lower([slide.title, slide.governing_message, ...slide.claims.map((claim) => claim.text)].join(" "));
  const hints = readHintTemplates(slide);
  const scores = new Map<AdaptiveLayoutTemplate, number>();
  const reasons = new Map<AdaptiveLayoutTemplate, TemplateReason[]>();
  for (const template of ALL_TEMPLATES) {
    scores.set(template, 0);
    reasons.set(template, []);
  }

  const priors = TYPE_PRIOR[slide.type] ?? {};
  for (const [template, delta] of Object.entries(priors) as Array<[AdaptiveLayoutTemplate, number]>) {
    addScore(scores, reasons, template, delta, `type-prior:${slide.type}`);
  }

  if (!priors["cover-hero"]) {
    addScore(scores, reasons, "cover-hero", -2.5, "non-cover-penalty");
  }

  if (hints.length > 0) {
    for (const hint of hints) {
      addScore(scores, reasons, hint, 0.75, `layout_hint:${hint}`);
    }
  }

  const tableCount = visualCount(slide, "table");
  const matrixCount = visualCount(slide, "matrix");
  const barCount = visualCount(slide, "bar-chart") + visualCount(slide, "pie-chart");
  const kpiCount = visualCount(slide, "kpi-cards");
  const timelineCount = visualCount(slide, "timeline");
  const flowCount = visualCount(slide, "flow");
  const actionCount = visualCount(slide, "action-cards");
  const insightCount = visualCount(slide, "insight-box") + visualCount(slide, "bullets") + visualCount(slide, "icon-list");

  if (tableCount > 0) {
    addScore(scores, reasons, "two-column", 0.95 + tableCount * 0.28, "table-heavy");
    addScore(scores, reasons, "left-focus", 0.8 + tableCount * 0.22, "table-support");
    addScore(scores, reasons, "right-focus", 0.7 + tableCount * 0.2, "table-support");
  }

  if (matrixCount > 0) {
    addScore(scores, reasons, "quad", 0.9 + matrixCount * 0.3, "matrix-structure");
    addScore(scores, reasons, "two-column", 0.55 + matrixCount * 0.2, "matrix-comparison");
  }

  if (barCount > 0) {
    addScore(scores, reasons, "left-focus", 0.75 + barCount * 0.22, "chart-focus");
    addScore(scores, reasons, "right-focus", 0.7 + barCount * 0.2, "chart-focus");
    addScore(scores, reasons, "top-bottom", 0.45 + barCount * 0.16, "chart-stack");
  }

  if (kpiCount > 0) {
    addScore(scores, reasons, "kpi-dashboard", 1.1 + kpiCount * 0.35, "kpi-priority");
    addScore(scores, reasons, "top-bottom", 0.6 + kpiCount * 0.2, "kpi-support");
  }

  if (timelineCount > 0) {
    addScore(scores, reasons, "timeline", 1.2 + timelineCount * 0.4, "timeline-visual");
    addScore(scores, reasons, "top-bottom", 0.7 + timelineCount * 0.18, "timeline-support");
  }

  if (flowCount > 0) {
    addScore(scores, reasons, "top-bottom", 0.7 + flowCount * 0.22, "flow-sequence");
    addScore(scores, reasons, "timeline", 0.45 + flowCount * 0.16, "flow-sequence");
  }

  if (actionCount > 0) {
    addScore(scores, reasons, "top-bottom", 0.85 + actionCount * 0.24, "action-cards");
    addScore(scores, reasons, "timeline", 0.55 + actionCount * 0.18, "action-sequencing");
  }

  if (insightCount > 0 && slide.visuals.length <= 2) {
    addScore(scores, reasons, "single-panel", 0.5 + insightCount * 0.1, "narrative-card");
  }

  const riskHits = keywordHits(corpus, RISK_KEYWORDS);
  const executionHits = keywordHits(corpus, EXECUTION_KEYWORDS);
  const comparisonHits = keywordHits(corpus, COMPARISON_KEYWORDS);
  const summaryHits = keywordHits(corpus, SUMMARY_KEYWORDS);
  const analysisHits = keywordHits(corpus, ANALYSIS_KEYWORDS);

  if (riskHits > 0) {
    addScore(scores, reasons, "quad", Math.min(1.7, 0.35 * riskHits), "risk-keyword");
    addScore(scores, reasons, "top-bottom", Math.min(1.1, 0.22 * riskHits), "risk-keyword");
  }

  if (executionHits > 0) {
    addScore(scores, reasons, "timeline", Math.min(2.1, 0.4 * executionHits), "execution-keyword");
    addScore(scores, reasons, "top-bottom", Math.min(1.4, 0.26 * executionHits), "execution-keyword");
  }

  if (comparisonHits > 0) {
    addScore(scores, reasons, "two-column", Math.min(1.9, 0.34 * comparisonHits), "comparison-keyword");
    addScore(scores, reasons, "left-focus", Math.min(1.2, 0.22 * comparisonHits), "comparison-keyword");
    addScore(scores, reasons, "right-focus", Math.min(1.2, 0.22 * comparisonHits), "comparison-keyword");
  }

  if (summaryHits > 0) {
    addScore(scores, reasons, "kpi-dashboard", Math.min(1.7, 0.3 * summaryHits), "summary-keyword");
    addScore(scores, reasons, "top-bottom", Math.min(1.1, 0.2 * summaryHits), "summary-keyword");
  }

  if (analysisHits > 0) {
    addScore(scores, reasons, "left-focus", Math.min(1.1, 0.2 * analysisHits), "analysis-keyword");
    addScore(scores, reasons, "single-panel", Math.min(0.9, 0.16 * analysisHits), "analysis-keyword");
  }

  const density = numericDensity(corpus);
  if (density >= 0.05) {
    addScore(scores, reasons, "kpi-dashboard", 0.45 + density * 4, "numeric-density");
    addScore(scores, reasons, "left-focus", 0.35 + density * 3.2, "numeric-density");
    addScore(scores, reasons, "two-column", 0.3 + density * 2.8, "numeric-density");
  }

  const avgClaim = averageClaimLength(slide);
  if (avgClaim >= 135) {
    addScore(scores, reasons, "top-bottom", 0.8, "long-claims");
    addScore(scores, reasons, "single-panel", 0.65, "long-claims");
    addScore(scores, reasons, "quad", -0.45, "long-claims-penalty");
    addScore(scores, reasons, "kpi-dashboard", -0.35, "long-claims-penalty");
  }

  if (slide.claims.length >= 4) {
    addScore(scores, reasons, "top-bottom", 0.45, "claim-count");
    addScore(scores, reasons, "quad", 0.35, "claim-count");
  }

  if (slide.visuals.length <= 1 && avgClaim > 105) {
    addScore(scores, reasons, "single-panel", 0.6, "single-visual-narrative");
  }

  const progress = total > 0 ? page / total : 0;
  if (progress >= 0.72) {
    addScore(scores, reasons, "timeline", 0.25, "late-deck-execution");
    addScore(scores, reasons, "top-bottom", 0.2, "late-deck-execution");
  } else if (progress <= 0.22) {
    addScore(scores, reasons, "kpi-dashboard", 0.18, "early-deck-summary");
    addScore(scores, reasons, "left-focus", 0.14, "early-deck-summary");
  }

  const candidates = Array.from(new Set([...(TEMPLATE_CANDIDATES_BY_TYPE[slide.type] ?? ALL_TEMPLATES), ...hints]));
  let selected = candidates[0] ?? defaultTemplateBySlideType(slide.type);
  let selectedScore = Number.NEGATIVE_INFINITY;

  for (const template of candidates) {
    const score = scores.get(template) ?? Number.NEGATIVE_INFINITY;
    if (score > selectedScore) {
      selected = template;
      selectedScore = score;
      continue;
    }

    if (score === selectedScore) {
      const defaultTemplate = defaultTemplateBySlideType(slide.type);
      if (template === defaultTemplate) {
        selected = template;
      }
    }
  }

  const selectedReasons = reasons.get(selected) ?? [];
  const reasonText = selectTopReasons(selectedReasons) || `type-prior:${slide.type}`;

  return {
    template: selected,
    emphasis: inferEmphasis(slide, corpus),
    rationale: `agentic-local: ${reasonText}`,
    provider: "agentic"
  };
}

function buildLayoutPrompt(slide: SlideSpecSlide, page: number, total: number): { system: string; user: string } {
  const visualKinds = slide.visuals.map((visual) => visual.kind).join(", ");
  const hints = readHintTemplates(slide).join(", ");

  const system = [
    "You are a senior strategy consulting presentation designer.",
    "Choose one layout template for each slide.",
    "Allowed templates: cover-hero, single-panel, two-column, top-bottom, left-focus, right-focus, quad, timeline, kpi-dashboard.",
    "Return JSON only with keys: template, emphasis, rationale.",
    "emphasis must be one of data, narrative, execution."
  ].join(" ");

  const user = [
    `Slide page: ${page}/${total}`,
    `Type: ${slide.type}`,
    `Title: ${slide.title}`,
    `Governing message: ${slide.governing_message}`,
    `Visual kinds: ${visualKinds || "none"}`,
    `Layout hints: ${hints || "none"}`,
    `Claim count: ${slide.claims.length}`,
    `Sample claims: ${slide.claims.slice(0, 2).map((claim) => claim.text).join(" || ")}`
  ].join("\n");

  return { system, user };
}

async function callOpenAiPlan(
  apiKey: string,
  model: string,
  prompt: { system: string; user: string },
  temperature: number,
  timeoutMs: number
): Promise<LlmLayoutPayload | null> {
  const { signal, clear } = requestTimeoutSignal(timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI layout API failed (${response.status}): ${body.slice(0, 240)}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content ?? "";
    return parseJsonLoose(content);
  } finally {
    clear();
  }
}

async function callAnthropicPlan(
  apiKey: string,
  model: string,
  prompt: { system: string; user: string },
  temperature: number,
  timeoutMs: number
): Promise<LlmLayoutPayload | null> {
  const { signal, clear } = requestTimeoutSignal(timeoutMs);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 320,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic layout API failed (${response.status}): ${body.slice(0, 240)}`);
    }

    const json = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };

    const contentText = json.content?.find((item) => item.type === "text")?.text ?? "";
    return parseJsonLoose(contentText);
  } finally {
    clear();
  }
}

function resolveProvider(options: LayoutPlannerOptions): LayoutProvider {
  const fromOptions = options.provider;
  if (fromOptions) {
    return fromOptions;
  }

  const fromEnv = process.env.PPT_LAYOUT_MODEL_PROVIDER?.toLowerCase();
  if (fromEnv === "openai" || fromEnv === "anthropic" || fromEnv === "heuristic" || fromEnv === "agentic" || fromEnv === "auto") {
    return fromEnv === "auto" ? "agentic" : fromEnv;
  }

  return "agentic";
}

function planFromPayload(payload: LlmLayoutPayload | null, fallback: LayoutPlan, provider: LayoutProvider): LayoutPlan {
  if (!payload) {
    return fallback;
  }

  const template = normalizeTemplate(payload.template) ?? fallback.template;
  const emphasis = normalizeEmphasis(payload.emphasis);
  const rationale =
    typeof payload.rationale === "string" && payload.rationale.trim().length > 0
      ? payload.rationale.trim()
      : fallback.rationale;

  return {
    template,
    emphasis,
    rationale,
    provider
  };
}

export async function planLayoutForSlide(
  slide: SlideSpecSlide,
  page: number,
  total: number,
  options: LayoutPlannerOptions = {}
): Promise<LayoutPlan> {
  const heuristicFallback = heuristicPlan(slide);
  const agenticFallback = agenticPlan(slide, page, total);
  const provider = resolveProvider(options);

  if (provider === "heuristic") {
    return heuristicFallback;
  }

  if (provider === "agentic") {
    return agenticFallback;
  }

  const model =
    options.model ??
    process.env.PPT_LAYOUT_MODEL ??
    (provider === "anthropic" ? "claude-3-5-sonnet-20241022" : "gpt-4o-mini");

  const temperatureRaw = options.temperature ?? Number(process.env.PPT_LAYOUT_MODEL_TEMPERATURE ?? "0.2");
  const temperature = Number.isFinite(temperatureRaw) ? Math.max(0, Math.min(temperatureRaw, 1)) : 0.2;
  const timeoutRaw = options.timeoutMs ?? Number(process.env.PPT_LAYOUT_MODEL_TIMEOUT_MS ?? "8000");
  const timeoutMs = Number.isFinite(timeoutRaw) ? Math.max(1500, timeoutRaw) : 8000;

  const prompt = buildLayoutPrompt(slide, page, total);

  try {
    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return {
          ...agenticFallback,
          rationale: `${agenticFallback.rationale} (OPENAI_API_KEY 미설정으로 agentic-local 사용)`
        };
      }

      const payload = await callOpenAiPlan(apiKey, model, prompt, temperature, timeoutMs);
      return planFromPayload(payload, agenticFallback, provider);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        ...agenticFallback,
        rationale: `${agenticFallback.rationale} (ANTHROPIC_API_KEY 미설정으로 agentic-local 사용)`
      };
    }

    const payload = await callAnthropicPlan(apiKey, model, prompt, temperature, timeoutMs);
    return planFromPayload(payload, agenticFallback, provider);
  } catch (error) {
    logger.warn(
      {
        slideId: slide.id,
        provider,
        model,
        error: error instanceof Error ? error.message : String(error)
      },
      "layout planner LLM fallback"
    );

    return {
      ...agenticFallback,
      rationale: `${agenticFallback.rationale} (LLM 호출 실패로 agentic-local fallback)`
    };
  }
}
