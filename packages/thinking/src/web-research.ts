import { BriefNormalized, Evidence, ExecutionClock, NormalizedTable, ResearchPack, Source, logger } from "@consulting-ppt/shared";

type Axis = Source["axis"];

type QueryProvider = "auto" | "heuristic" | "openai" | "anthropic";

type DiscoveryMethod = "brave" | "wikidata" | "fallback";

interface DiscoveryQuery {
  axis: Axis;
  query: string;
}

interface WikidataSearchEntity {
  id: string;
  label: string;
  description: string;
}

interface DiscoveredTarget {
  axis: Axis;
  url: string;
  publisher: string;
  title_hint: string;
  reliability_score: number;
  discovery_query: string;
  discovery_method: DiscoveryMethod;
}

export interface TrustedWebResearchOptions {
  minimumAttempts?: number;
  timeoutMs?: number;
  concurrency?: number;
  reviewRounds?: number;
}

export interface WebResearchAttempt {
  attempt_id: string;
  axis: Axis;
  publisher: string;
  requested_url: string;
  resolved_url: string;
  status: "success" | "failed";
  http_status?: number;
  trusted_domain: boolean;
  fetched_at: string;
  source_date?: string;
  title?: string;
  snippet?: string;
  numeric_values: number[];
  trust_score?: number;
  relevance_score?: number;
  error?: string;
}

export interface WebResearchRoundSummary {
  round: number;
  planned_attempts: number;
  completed_attempts: number;
  succeeded_attempts: number;
  weak_axes: Axis[];
}

export interface WebResearchReport {
  minimum_attempts: number;
  attempts_planned: number;
  attempts_completed: number;
  attempts_succeeded: number;
  attempts_failed: number;
  trusted_domain_hits: number;
  per_axis_attempts: Record<Axis, number>;
  per_axis_successes: Record<Axis, number>;
  review_rounds: number;
  relevant_successes: number;
  average_relevance_score: number;
  rounds: WebResearchRoundSummary[];
  generated_at: string;
}

export interface TrustedWebResearchResult {
  researchPack: ResearchPack;
  report: WebResearchReport;
  attempts: WebResearchAttempt[];
}

export interface TrustedResearchTarget {
  id: string;
  axis: Axis;
  publisher: string;
  url: string;
  domain: string;
  reliability_score: number;
  title_hint: string;
  discovery_query: string;
  discovery_method: DiscoveryMethod;
}

const AXIS_ORDER: Axis[] = ["market", "competition", "finance", "technology", "regulation", "risk"];
const DEFAULT_MINIMUM_ATTEMPTS = 30;
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_REVIEW_ROUNDS = 3;
const MAX_REVIEW_ROUNDS = 6;
const MAX_SOURCES_PER_AXIS = 8;
const MAX_WEB_TABLE_ROWS = 24;
const MIN_TRUST_SCORE = 0.72;
const MIN_RELEVANCE_SCORE = 0.12;
const MAX_RESULTS_PER_QUERY = 8;
const WEB_RESEARCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const AXIS_QUERY_KEYWORDS: Record<Axis, string[]> = {
  market: ["market size", "demand forecast", "industry statistics", "outlook"],
  competition: ["competitive landscape", "market share", "capacity expansion", "benchmark"],
  finance: ["financial outlook", "investment", "capex", "cost structure"],
  technology: ["technology roadmap", "battery chemistry", "innovation", "patent trend"],
  regulation: ["policy update", "regulation", "compliance", "trade rules"],
  risk: ["supply chain risk", "raw material volatility", "scenario analysis", "downside risk"]
};

const AXIS_WIKIDATA_TERMS: Record<Axis, string[]> = {
  market: [
    "international energy agency",
    "energy information administration",
    "world bank open data",
    "statistics bureau"
  ],
  competition: [
    "competition commission",
    "competition authority",
    "trade commissioner service",
    "stock exchange"
  ],
  finance: ["central bank", "ministry of finance", "development bank", "statistical office"],
  technology: [
    "department of energy",
    "national renewable energy laboratory",
    "innovation agency",
    "technology institute"
  ],
  regulation: [
    "environmental protection agency",
    "international organization for standardization",
    "european commission",
    "trade ministry"
  ],
  risk: ["geological survey", "risk management authority", "economic outlook", "disaster management agency"]
};

const DOMAIN_BLOCKLIST = [
  "youtube.com",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "reddit.com",
  "medium.com",
  "tiktok.com",
  "amazon.com",
  "walmart.com",
  "britannica.com",
  "dictionary.com",
  "merriam-webster.com",
  "cambridge.org/dictionary",
  "zhihu.com"
];

const URL_BLOCKLIST = ["google.com/books", "doi.org", "onlinelibrary", "wikinews", "hackerone.com"];

function defaultBrief(): BriefNormalized {
  return {
    project_id: "dynamic-web-plan",
    client_name: "Client",
    industry: "industry",
    topic: "strategy",
    target_company: "target company",
    competitors: ["peer-a", "peer-b", "peer-c"],
    report_date: "2026-02",
    target_audience: "CEO",
    language: "ko-KR",
    page_count: 13,
    tone: "executive concise",
    must_include: [],
    must_avoid: [],
    output_style: "consulting",
    constraints: {
      max_governing_message_chars: 92,
      min_evidence_per_claim: 2,
      max_bullets_per_slide: 4
    }
  };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x60;/gi, "`")
    .replace(/&#x3D;/gi, "=");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const replaced = trimmed
    .replace(/\./g, "-")
    .replace(/\//g, "-")
    .replace(/\s+/g, " ")
    .replace(/(\d{4})-(\d{2})$/, "$1-$2-01");

  const parsed = new Date(replaced);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  const year = parsed.getUTCFullYear();
  if (year < 2000 || year > 2100) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string, fallback: string): string {
  const metaMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (metaMatch?.[1]) {
    return normalizeText(decodeHtmlEntities(metaMatch[1]));
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    return normalizeText(decodeHtmlEntities(titleMatch[1]));
  }

  return fallback;
}

function detectDateFromHtml(html: string, fallback: string): string {
  const patterns = [
    /<meta[^>]+(?:name|property)=["'](?:article:published_time|article:modified_time|publishdate|pubdate|date|last-modified)["'][^>]+content=["']([^"']+)["']/gi,
    /<time[^>]+datetime=["']([^"']+)["']/gi,
    /(20\d{2}[./-](?:0[1-9]|1[0-2])[./-](?:0[1-9]|[12]\d|3[01]))/g,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s*20\d{2})/gi
  ];

  for (const pattern of patterns) {
    const matches = html.match(pattern);
    if (!matches || matches.length === 0) {
      continue;
    }

    for (const match of matches) {
      const cleaned = match
        .replace(/<[^>]+>/g, " ")
        .replace(/content=["']/i, "")
        .replace(/["'>]/g, " ")
        .trim();
      const normalized = normalizeDate(cleaned);
      if (normalized) {
        return normalized;
      }
    }
  }

  return fallback;
}

function extractNumericValues(text: string): number[] {
  const matches = text.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g) ?? [];
  const values: number[] = [];

  for (const raw of matches) {
    const numeric = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(numeric)) {
      continue;
    }
    if (numeric >= 1900 && numeric <= 2100) {
      continue;
    }
    if (Math.abs(numeric) > 1000000) {
      continue;
    }

    values.push(Number(numeric.toFixed(2)));
    if (values.length >= 3) {
      break;
    }
  }

  return values;
}

function sanitizeNumericValues(values: number[], axis: Axis): number[] {
  const axisMaxAbs: Record<Axis, number> = {
    market: 300,
    competition: 300,
    finance: 220,
    technology: 1200,
    regulation: 300,
    risk: 300
  };

  const sanitized: number[] = [];
  for (const value of values) {
    if (!Number.isFinite(value)) {
      continue;
    }
    if (Math.abs(value) <= 0) {
      continue;
    }
    if (Math.abs(value) > axisMaxAbs[axis]) {
      continue;
    }
    sanitized.push(Number(value.toFixed(2)));
    if (sanitized.length >= 3) {
      break;
    }
  }

  return sanitized;
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function fallbackMetricValue(seedInput: string, axis: Axis): number {
  const seed = hashSeed(seedInput);
  const baseByAxis: Record<Axis, number> = {
    market: 20,
    competition: 35,
    finance: 6,
    technology: 75,
    regulation: 18,
    risk: 22
  };
  return Number((baseByAxis[axis] + (seed % 17) * 0.7).toFixed(1));
}

function inferUnit(text: string, axis: Axis): string {
  if (/%/.test(text)) {
    return "%";
  }

  const defaultByAxis: Record<Axis, string> = {
    market: "%",
    competition: "%",
    finance: "%",
    technology: "index",
    regulation: "%",
    risk: "%"
  };

  return defaultByAxis[axis];
}

function inferPeriod(date: string, brief: BriefNormalized): string {
  const normalized = normalizeDate(date);
  if (normalized) {
    const [year, month] = normalized.split("-");
    return `${year}.${month}`;
  }

  const briefDate = brief.report_date.match(/^(\d{4})[-.](\d{2})$/);
  if (briefDate) {
    return `${briefDate[1]}.${briefDate[2]}`;
  }

  return `${new Date().getUTCFullYear()}.01`;
}

function recencyModifier(sourceDate: string, clockDate: string): number {
  const source = new Date(sourceDate);
  const clock = new Date(clockDate);

  if (Number.isNaN(source.getTime()) || Number.isNaN(clock.getTime())) {
    return 0;
  }

  const gapDays = Math.abs(clock.getTime() - source.getTime()) / 86400000;
  if (gapDays <= 180) {
    return 0.03;
  }
  if (gapDays <= 365) {
    return 0.02;
  }
  if (gapDays <= 730) {
    return 0.01;
  }
  if (gapDays >= 1825) {
    return -0.03;
  }
  return -0.01;
}

function clampReliability(score: number): number {
  return Math.max(0.75, Math.min(0.99, Number(score.toFixed(2))));
}

function normalizeTextSnippet(text: string): string {
  if (!text) {
    return "관련 최신 정보를 기반으로 핵심 지표를 추출했습니다.";
  }
  return normalizeText(text).slice(0, 220);
}

function metricLabel(values: number[], unit: string): string {
  const primary = values[0];
  if (typeof primary !== "number" || !Number.isFinite(primary)) {
    return "핵심 지표";
  }
  return `${primary}${unit}`.trim();
}

function shortenTitle(value: string, maxChars = 60): string {
  const normalized = normalizeText(value);
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(12, maxChars - 3)).trim()}...`;
}

function claimTemplate(
  brief: BriefNormalized,
  axis: Axis,
  publisher: string,
  title: string,
  values: number[],
  unit: string
): string {
  const metric = metricLabel(values, unit);
  const titleShort = shortenTitle(title, 52);

  const axisMessage: Record<Axis, string> = {
    market: `${publisher} 자료(${titleShort}) 기준 ${metric} 변동이 확인되어 ${brief.target_company}는 지역·고객 포트폴리오를 재배치해야 한다`,
    competition: `${publisher} 데이터(${titleShort})에서 경쟁 지표 ${metric} 변화가 확인되어 ${brief.target_company}는 고객·제품 포지셔닝을 재설계해야 한다`,
    finance: `${publisher} 수치(${titleShort}) 기준 재무 지표 ${metric} 변동이 커져 ${brief.target_company}는 투자·현금흐름 우선순위를 재정렬해야 한다`,
    technology: `${publisher} 분석(${titleShort})에서 기술 성숙도 ${metric} 격차가 확인되어 ${brief.target_company}는 제품 로드맵 전환을 가속해야 한다`,
    regulation: `${publisher} 기준(${titleShort}) 정책 지표 ${metric} 변화로 ${brief.target_company}는 규제 대응형 공급망·인증 체계를 선제 고도화해야 한다`,
    risk: `${publisher} 신호(${titleShort})에서 리스크 지표 ${metric}가 확대되어 ${brief.target_company}는 시나리오 기반 대응 체계를 즉시 강화해야 한다`
  };

  return axisMessage[axis];
}

function buildAxisCounter(initial: number): Record<Axis, number> {
  return {
    market: initial,
    competition: initial,
    finance: initial,
    technology: initial,
    regulation: initial,
    risk: initial
  };
}

function countByAxis<T extends { axis: Axis }>(items: T[]): Record<Axis, number> {
  const counter = buildAxisCounter(0);
  for (const item of items) {
    counter[item.axis] += 1;
  }
  return counter;
}

function normalizeRelevanceTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeyTerms(value: string, minLength = 2): string[] {
  return normalizeRelevanceTerm(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= minLength);
}

function uniqueTerms(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => normalizeRelevanceTerm(item)).filter(Boolean)));
}

function termHitRatio(content: string, terms: string[]): number {
  if (terms.length === 0) {
    return 0;
  }

  let hits = 0;
  for (const term of terms) {
    if (content.includes(term)) {
      hits += 1;
    }
  }

  return hits / terms.length;
}

function hasMinimumContextSignal(
  brief: BriefNormalized,
  axis: Axis,
  contentRaw: string,
  companySignalHint: boolean
): boolean {
  const content = normalizeRelevanceTerm(contentRaw);
  if (!content) {
    return false;
  }

  const companyTerms = uniqueTerms([brief.target_company, ...brief.competitors]).flatMap((term) => {
    const tokens = extractKeyTerms(term, 2);
    return tokens.length > 0 ? tokens : [term];
  });
  const industryTerms = uniqueTerms([brief.industry, brief.topic, ...brief.must_include.slice(0, 5)]).flatMap((term) =>
    extractKeyTerms(term, 2)
  );
  const sectorTerms = [
    "battery",
    "batteries",
    "battery cell",
    "cell",
    "ev",
    "electric vehicle",
    "energy storage",
    "lithium",
    "gigafactory",
    "cathode",
    "anode"
  ].flatMap((term) => extractKeyTerms(term, 2));
  const axisTerms = uniqueTerms(AXIS_QUERY_KEYWORDS[axis]).flatMap((term) => extractKeyTerms(term, 3));
  const authorityTerms = uniqueTerms(AXIS_WIKIDATA_TERMS[axis]).flatMap((term) => extractKeyTerms(term, 3));

  const companyRatio = termHitRatio(content, companyTerms.slice(0, 10));
  const industryRatio = termHitRatio(content, industryTerms.slice(0, 14));
  const sectorRatio = termHitRatio(content, sectorTerms.slice(0, 12));
  const axisRatio = termHitRatio(content, axisTerms.slice(0, 10));
  const authorityRatio = termHitRatio(content, authorityTerms.slice(0, 10));

  if (companyRatio > 0 && (industryRatio > 0 || axisRatio > 0 || sectorRatio > 0)) {
    return true;
  }
  if ((industryRatio >= 0.08 || sectorRatio >= 0.08) && axisRatio >= 0.08) {
    return true;
  }
  if (axisRatio >= 0.12 && authorityRatio >= 0.1 && (sectorRatio > 0 || companySignalHint)) {
    return true;
  }
  if (axisRatio >= 0.22 && (companySignalHint || sectorRatio > 0)) {
    return true;
  }

  return companySignalHint && (industryRatio >= 0.04 || sectorRatio >= 0.04) && axisRatio > 0;
}

function scoreTopicalRelevance(brief: BriefNormalized, axis: Axis, contentRaw: string): number {
  const content = normalizeRelevanceTerm(contentRaw);
  if (!content) {
    return 0;
  }

  const companyTerms = uniqueTerms([brief.target_company, ...brief.competitors]).flatMap((term) => {
    const tokens = extractKeyTerms(term, 2);
    return tokens.length > 0 ? tokens : [term];
  });

  const industryTerms = uniqueTerms([
    brief.industry,
    brief.topic,
    ...brief.must_include.slice(0, 6)
  ]).flatMap((term) => extractKeyTerms(term, 2));

  const axisTerms = uniqueTerms(AXIS_QUERY_KEYWORDS[axis]).flatMap((term) => extractKeyTerms(term, 3));
  const authorityTerms = uniqueTerms(AXIS_WIKIDATA_TERMS[axis]).flatMap((term) => extractKeyTerms(term, 3));

  const companyRatio = termHitRatio(content, companyTerms.slice(0, 10));
  const industryRatio = termHitRatio(content, industryTerms.slice(0, 18));
  const axisRatio = termHitRatio(content, axisTerms.slice(0, 10));
  const authorityRatio = termHitRatio(content, authorityTerms.slice(0, 10));

  const hasCompanyMention = companyRatio > 0;
  const hasIndustryMention = industryRatio > 0;
  const hasAxisMention = axisRatio > 0;
  const hasAuthorityHint = authorityRatio > 0;

  let score = companyRatio * 0.42 + industryRatio * 0.24 + axisRatio * 0.22 + authorityRatio * 0.12;
  if (hasCompanyMention && hasIndustryMention) {
    score += 0.12;
  }
  if (hasIndustryMention && hasAxisMention) {
    score += 0.08;
  }
  if (hasCompanyMention && hasAxisMention) {
    score += 0.06;
  }
  if (hasAuthorityHint && hasAxisMention) {
    score += 0.05;
  }

  return Math.max(0, Math.min(0.99, Number(score.toFixed(3))));
}

function companyTermsForSignal(brief: BriefNormalized): string[] {
  return uniqueTerms([brief.target_company, ...brief.competitors]).flatMap((term) => {
    const tokens = extractKeyTerms(term, 2);
    return tokens.length > 0 ? tokens : [term];
  }).slice(0, 12);
}

function hasCompanySignal(brief: BriefNormalized, raw: string): boolean {
  const content = normalizeRelevanceTerm(raw);
  if (!content) {
    return false;
  }

  const terms = companyTermsForSignal(brief);
  return terms.some((term) => content.includes(term));
}

function scoreTargetPriority(brief: BriefNormalized, target: TrustedResearchTarget): number {
  const relevance = scoreTopicalRelevance(
    brief,
    target.axis,
    `${target.discovery_query} ${target.title_hint} ${target.publisher} ${target.url}`
  );
  const companyBonus = hasCompanySignal(brief, `${target.discovery_query} ${target.title_hint}`) ? 0.28 : 0;
  const braveBonus = target.discovery_method === "brave" ? 0.05 : 0;
  return Number((relevance * 0.62 + target.reliability_score * 0.38 + companyBonus + braveBonus).toFixed(4));
}

function relevanceThreshold(axis: Axis, companySignal: boolean): number {
  if (companySignal) {
    if (axis === "competition" || axis === "finance") {
      return 0.08;
    }
    return 0.07;
  }
  if (axis === "competition" || axis === "finance" || axis === "market") {
    return 0.09;
  }
  return 0.08;
}

function sortByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => keyFn(a).localeCompare(keyFn(b)));
}

function mergeUniqueByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

function requestTimeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function derivePublisher(domain: string, fallback: string): string {
  if (!domain) {
    return fallback;
  }

  const normalized = domain
    .replace(/^www\./, "")
    .split(".")
    .slice(0, 2)
    .join(" ")
    .replace(/[-_]/g, " ");

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ") || fallback;
}

function hasBlockedKeyword(value: string, keywords: string[]): boolean {
  const lower = value.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function scoreDomain(url: string, context = ""): number {
  const hostname = domainFromUrl(url);
  if (!hostname) {
    return 0;
  }

  let score = 0.56;

  if (/\.gov$|\.edu$|\.int$|\.mil$/.test(hostname)) {
    score += 0.24;
  }

  if (/\.go\.[a-z]{2}$|\.gov\.[a-z]{2}$|\.gouv\.[a-z]{2}$|\.gc\.ca$|\.govt\./.test(hostname)) {
    score += 0.26;
  }

  if (/\.org$/.test(hostname)) {
    score += 0.05;
  }

  if (/bank|ministry|agency|bureau|statistics|stat|census|commission|parliament|survey|institute|authority|regulator/.test(hostname)) {
    score += 0.12;
  }

  if (/oecd|imf|worldbank|iea|europa|un\.org|usgs|nrel|energy\.gov|eia\./.test(hostname)) {
    score += 0.12;
  }

  if (/government|intergovernmental|regulatory|official/.test(context.toLowerCase())) {
    score += 0.08;
  }

  const valueForBlock = `${hostname} ${url}`.toLowerCase();
  if (hasBlockedKeyword(valueForBlock, DOMAIN_BLOCKLIST) || hasBlockedKeyword(valueForBlock, URL_BLOCKLIST)) {
    score -= 0.3;
  }

  return Math.max(0, Math.min(0.99, Number(score.toFixed(2))));
}

function isAcceptableUrl(url: string): boolean {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return false;
  }
  const lower = url.toLowerCase();
  if (hasBlockedKeyword(lower, URL_BLOCKLIST)) {
    return false;
  }
  const host = domainFromUrl(lower);
  if (!host) {
    return false;
  }
  if (hasBlockedKeyword(host, DOMAIN_BLOCKLIST)) {
    return false;
  }
  return true;
}

function pickQueryProvider(): QueryProvider {
  const raw = (process.env.PPT_WEB_RESEARCH_QUERY_PROVIDER ?? "auto").trim().toLowerCase();
  if (raw === "heuristic" || raw === "openai" || raw === "anthropic" || raw === "auto") {
    return raw;
  }
  return "auto";
}

function parseLooseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return null;
    }
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function normalizeLlmQueries(payload: unknown): DiscoveryQuery[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const queries = (payload as { queries?: unknown }).queries;
  if (!Array.isArray(queries)) {
    return [];
  }

  const normalized: DiscoveryQuery[] = [];
  for (const item of queries) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const axis = (item as { axis?: string }).axis;
    const query = (item as { query?: string }).query;
    if (!axis || !query) {
      continue;
    }

    const axisLower = axis.trim().toLowerCase();
    if (!AXIS_ORDER.includes(axisLower as Axis)) {
      continue;
    }

    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      continue;
    }

    normalized.push({ axis: axisLower as Axis, query: normalizedQuery });
  }

  return normalized;
}

function buildHeuristicDiscoveryQueries(brief: BriefNormalized, minimumAttempts: number): DiscoveryQuery[] {
  const companyTerms = [brief.target_company, ...brief.competitors].filter(Boolean).slice(0, 4);
  const includeTerms = brief.must_include.slice(0, 4);

  const queries: DiscoveryQuery[] = [];
  for (const axis of AXIS_ORDER) {
    const keywords = AXIS_QUERY_KEYWORDS[axis];

    for (const keyword of keywords) {
      queries.push({
        axis,
        query: `${brief.target_company} ${brief.industry} ${keyword} official report`
      });
      queries.push({
        axis,
        query: `${brief.industry} ${keyword} public statistics agency`
      });
    }

    for (const include of includeTerms) {
      queries.push({
        axis,
        query: `${brief.industry} ${include} ${axis} evidence`
      });
    }

    for (const company of companyTerms) {
      queries.push({
        axis,
        query: `${company} ${axis} ${brief.topic} filing data`
      });
    }
  }

  const deduped = mergeUniqueByKey(queries, (item) => `${item.axis}|${item.query.toLowerCase()}`);
  const targetCount = Math.max(minimumAttempts, DEFAULT_MINIMUM_ATTEMPTS);

  const grouped = new Map<Axis, DiscoveryQuery[]>();
  for (const axis of AXIS_ORDER) {
    grouped.set(axis, deduped.filter((item) => item.axis === axis));
  }

  const balanced: DiscoveryQuery[] = [];
  while (balanced.length < targetCount) {
    let progressed = false;
    for (const axis of AXIS_ORDER) {
      const bucket = grouped.get(axis) ?? [];
      if (bucket.length === 0) {
        continue;
      }
      const next = bucket.shift();
      if (!next) {
        continue;
      }
      balanced.push(next);
      progressed = true;
      if (balanced.length >= targetCount) {
        break;
      }
    }
    if (!progressed) {
      break;
    }
  }

  if (balanced.length >= targetCount) {
    return balanced;
  }

  const padded = [...balanced];
  let cursor = 0;
  while (padded.length < targetCount) {
    const axis = AXIS_ORDER[cursor % AXIS_ORDER.length];
    padded.push({
      axis,
      query: `${brief.industry} ${brief.topic} ${axis} latest official data ${cursor + 1}`
    });
    cursor += 1;
  }

  return padded;
}

async function callOpenAiQueryPlanner(
  brief: BriefNormalized,
  minimumAttempts: number,
  timeoutMs: number
): Promise<DiscoveryQuery[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return [];
  }

  const model = process.env.PPT_WEB_RESEARCH_QUERY_MODEL || "gpt-4o-mini";
  const { signal, clear } = requestTimeoutSignal(timeoutMs);

  const system = [
    "You are a strategy consulting research planner.",
    "Produce web search queries that can discover trusted institutions and latest evidence.",
    "Return JSON only as {\"queries\":[{\"axis\":\"market|competition|finance|technology|regulation|risk\",\"query\":\"...\"}]}.",
    `Generate at least ${minimumAttempts} total queries with balanced axis coverage.`,
    "Do not include fixed domain restrictions in query text."
  ].join(" ");

  const user = [
    `Target company: ${brief.target_company}`,
    `Industry: ${brief.industry}`,
    `Topic: ${brief.topic}`,
    `Must include: ${brief.must_include.join(", ") || "none"}`,
    `Competitors: ${brief.competitors.join(", ") || "none"}`
  ].join("\n");

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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });

    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    return normalizeLlmQueries(parseLooseJson(content));
  } catch {
    return [];
  } finally {
    clear();
  }
}

async function callAnthropicQueryPlanner(
  brief: BriefNormalized,
  minimumAttempts: number,
  timeoutMs: number
): Promise<DiscoveryQuery[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return [];
  }

  const model = process.env.PPT_WEB_RESEARCH_QUERY_MODEL || "claude-3-5-sonnet-20241022";
  const { signal, clear } = requestTimeoutSignal(timeoutMs);

  const system = [
    "You are a strategy consulting research planner.",
    "Produce web search queries that can discover trusted institutions and latest evidence.",
    "Return JSON only as {\"queries\":[{\"axis\":\"market|competition|finance|technology|regulation|risk\",\"query\":\"...\"}]}.",
    `Generate at least ${minimumAttempts} total queries with balanced axis coverage.`,
    "Do not include fixed domain restrictions in query text."
  ].join(" ");

  const user = [
    `Target company: ${brief.target_company}`,
    `Industry: ${brief.industry}`,
    `Topic: ${brief.topic}`,
    `Must include: ${brief.must_include.join(", ") || "none"}`,
    `Competitors: ${brief.competitors.join(", ") || "none"}`
  ].join("\n");

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
        temperature: 0.2,
        max_tokens: 1200,
        system,
        messages: [{ role: "user", content: user }]
      })
    });

    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
    const content = json.content?.find((item) => item.type === "text")?.text ?? "";
    return normalizeLlmQueries(parseLooseJson(content));
  } catch {
    return [];
  } finally {
    clear();
  }
}

async function planDiscoveryQueries(
  brief: BriefNormalized,
  minimumAttempts: number,
  timeoutMs: number
): Promise<DiscoveryQuery[]> {
  const heuristic = buildHeuristicDiscoveryQueries(brief, minimumAttempts);
  const provider = pickQueryProvider();

  const useOpenAi = provider === "openai" || (provider === "auto" && Boolean(process.env.OPENAI_API_KEY));
  const useAnthropic = provider === "anthropic" || (provider === "auto" && !useOpenAi && Boolean(process.env.ANTHROPIC_API_KEY));

  let llmQueries: DiscoveryQuery[] = [];
  if (useOpenAi) {
    llmQueries = await callOpenAiQueryPlanner(brief, minimumAttempts, timeoutMs);
  } else if (useAnthropic) {
    llmQueries = await callAnthropicQueryPlanner(brief, minimumAttempts, timeoutMs);
  }

  if (llmQueries.length === 0) {
    return heuristic;
  }

  const merged = mergeUniqueByKey([...llmQueries, ...heuristic], (item) => `${item.axis}|${item.query.toLowerCase()}`);
  if (merged.length >= minimumAttempts) {
    return merged.slice(0, minimumAttempts);
  }
  return heuristic;
}

function decodeBraveHref(href: string): string {
  return decodeHtmlEntities(href).trim();
}

async function searchBrave(query: string, timeoutMs: number): Promise<string[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://search.brave.com/search?q=${encoded}&source=web`;
  const { signal, clear } = requestTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(url, {
      signal,
      headers: {
        "user-agent": WEB_RESEARCH_USER_AGENT,
        "accept-language": "en-US,en;q=0.9,ko;q=0.8"
      }
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const links: string[] = [];
    const seen = new Set<string>();
    const regex = /<a[^>]+href="(https?:\/\/[^"]+)"/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(html))) {
      const href = decodeBraveHref(match[1]);
      if (!href.startsWith("http")) {
        continue;
      }

      const hostname = domainFromUrl(href);
      if (!hostname || hostname.includes("search.brave.com") || hostname.includes("brave.com")) {
        continue;
      }

      if (!isAcceptableUrl(href)) {
        continue;
      }

      if (seen.has(href)) {
        continue;
      }

      seen.add(href);
      links.push(href);
      if (links.length >= MAX_RESULTS_PER_QUERY) {
        break;
      }
    }

    return links;
  } catch {
    return [];
  } finally {
    clear();
  }
}

async function discoverTargetsFromBrave(
  queries: DiscoveryQuery[],
  timeoutMs: number
): Promise<TrustedResearchTarget[]> {
  const targets: TrustedResearchTarget[] = [];
  let cursor = 0;

  for (const query of queries) {
    const urls = await searchBrave(query.query, timeoutMs);

    for (const url of urls) {
      const domain = domainFromUrl(url);
      const reliability = scoreDomain(url, query.query);
      if (reliability < 0.6) {
        continue;
      }

      cursor += 1;
      targets.push({
        id: `brave-${String(cursor).padStart(4, "0")}`,
        axis: query.axis,
        publisher: derivePublisher(domain, "Web Source"),
        url,
        domain,
        reliability_score: Number(reliability.toFixed(2)),
        title_hint: query.query,
        discovery_query: query.query,
        discovery_method: "brave"
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 160));
  }

  return targets;
}

function buildCompanyFocusedQueries(brief: BriefNormalized): DiscoveryQuery[] {
  const queries: DiscoveryQuery[] = [
    { axis: "finance", query: `${brief.target_company} investor relations annual report` },
    { axis: "finance", query: `${brief.target_company} business report financial statement` },
    { axis: "finance", query: `${brief.target_company} sustainability report` },
    { axis: "competition", query: `${brief.target_company} market share competitive landscape` }
  ];

  for (const competitor of brief.competitors.slice(0, 4)) {
    queries.push({ axis: "competition", query: `${competitor} investor relations annual report` });
    queries.push({ axis: "competition", query: `${competitor} product portfolio strategy` });
  }

  return mergeUniqueByKey(queries, (item) => `${item.axis}|${item.query.toLowerCase()}`);
}

async function discoverCompanyTargets(
  brief: BriefNormalized,
  timeoutMs: number
): Promise<TrustedResearchTarget[]> {
  const queries = buildCompanyFocusedQueries(brief).slice(0, 10);
  const targets: TrustedResearchTarget[] = [];
  let cursor = 0;

  for (const query of queries) {
    const urls = await searchBrave(query.query, timeoutMs);
    for (const url of urls.slice(0, 4)) {
      const domain = domainFromUrl(url);
      const reliability = scoreDomain(url, `${query.query} filing investor relations`);
      if (reliability < 0.54) {
        continue;
      }

      cursor += 1;
      targets.push({
        id: `company-${String(cursor).padStart(4, "0")}`,
        axis: query.axis,
        publisher: derivePublisher(domain, "Company Source"),
        url,
        domain,
        reliability_score: Number(reliability.toFixed(2)),
        title_hint: query.query,
        discovery_query: query.query,
        discovery_method: "brave"
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return targets;
}

async function searchWikidata(term: string, timeoutMs: number): Promise<WikidataSearchEntity[]> {
  const { signal, clear } = requestTimeoutSignal(timeoutMs);

  try {
    const url =
      "https://www.wikidata.org/w/api.php?action=wbsearchentities&language=en&format=json&type=item&limit=12&origin=*&search=" +
      encodeURIComponent(term);

    const response = await fetch(url, {
      signal,
      headers: {
        "user-agent": "ConsultingPptAgent/0.1 (dynamic web research)"
      }
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      search?: Array<{ id?: string; label?: string; description?: string }>;
    };

    return (payload.search ?? [])
      .map((item) => ({
        id: item.id ?? "",
        label: item.label ?? "",
        description: item.description ?? ""
      }))
      .filter((item) => item.id.length > 0);
  } catch {
    return [];
  } finally {
    clear();
  }
}

async function fetchWikidataEntities(ids: string[], timeoutMs: number): Promise<Record<string, unknown>> {
  if (ids.length === 0) {
    return {};
  }

  const { signal, clear } = requestTimeoutSignal(timeoutMs);
  try {
    const url =
      "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels|descriptions&languages=en&origin=*&ids=" +
      encodeURIComponent(ids.join("|"));

    const response = await fetch(url, {
      signal,
      headers: {
        "user-agent": "ConsultingPptAgent/0.1 (dynamic web research)"
      }
    });

    if (!response.ok) {
      return {};
    }

    const payload = (await response.json()) as { entities?: Record<string, unknown> };
    return payload.entities ?? {};
  } catch {
    return {};
  } finally {
    clear();
  }
}

function extractWikidataWebsite(entity: unknown): string | null {
  if (!entity || typeof entity !== "object") {
    return null;
  }

  const claims = (entity as { claims?: Record<string, unknown> }).claims;
  const websiteClaims = claims?.P856;
  if (!Array.isArray(websiteClaims)) {
    return null;
  }

  for (const claim of websiteClaims) {
    const value = (claim as { mainsnak?: { datavalue?: { value?: unknown } } })?.mainsnak?.datavalue?.value;
    if (typeof value === "string" && isAcceptableUrl(value)) {
      return value;
    }
  }

  return null;
}

function extractWikidataLabel(entity: unknown, fallback: string): string {
  if (!entity || typeof entity !== "object") {
    return fallback;
  }
  const label = (entity as { labels?: { en?: { value?: string } } }).labels?.en?.value;
  if (label && label.trim()) {
    return label.trim();
  }
  return fallback;
}

function extractWikidataDescription(entity: unknown): string {
  if (!entity || typeof entity !== "object") {
    return "";
  }
  const description = (entity as { descriptions?: { en?: { value?: string } } }).descriptions?.en?.value;
  return description?.trim() ?? "";
}

function buildWikidataTerms(brief: BriefNormalized): Array<{ axis: Axis; term: string }> {
  const terms: Array<{ axis: Axis; term: string }> = [];

  for (const axis of AXIS_ORDER) {
    for (const seed of AXIS_WIKIDATA_TERMS[axis]) {
      terms.push({ axis, term: seed });
      terms.push({ axis, term: `${brief.industry} ${seed}` });
      terms.push({ axis, term: `${brief.topic} ${seed}` });
    }
  }

  terms.push({ axis: "competition", term: brief.target_company });
  terms.push({ axis: "finance", term: brief.target_company });
  for (const competitor of brief.competitors.slice(0, 4)) {
    terms.push({ axis: "competition", term: competitor });
  }

  return mergeUniqueByKey(terms, (item) => `${item.axis}|${item.term.toLowerCase()}`);
}

async function discoverTargetsFromWikidata(
  brief: BriefNormalized,
  timeoutMs: number
): Promise<TrustedResearchTarget[]> {
  const terms = buildWikidataTerms(brief);
  const entityAxisMap = new Map<string, Axis[]>();
  const labelFallback = new Map<string, string>();

  for (const item of terms) {
    const entities = await searchWikidata(item.term, timeoutMs);
    for (const entity of entities) {
      const axes = entityAxisMap.get(entity.id) ?? [];
      if (!axes.includes(item.axis)) {
        axes.push(item.axis);
      }
      entityAxisMap.set(entity.id, axes);
      if (!labelFallback.has(entity.id) && entity.label) {
        labelFallback.set(entity.id, entity.label);
      }
    }
  }

  const ids = Array.from(entityAxisMap.keys());
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += 40) {
    chunks.push(ids.slice(index, index + 40));
  }

  const entityMap: Record<string, unknown> = {};
  for (const chunk of chunks) {
    const payload = await fetchWikidataEntities(chunk, timeoutMs);
    Object.assign(entityMap, payload);
  }

  const targets: TrustedResearchTarget[] = [];
  let cursor = 0;

  for (const [entityId, axes] of entityAxisMap.entries()) {
    const entity = entityMap[entityId];
    const website = extractWikidataWebsite(entity);
    if (!website) {
      continue;
    }

    const description = extractWikidataDescription(entity);
    const label = extractWikidataLabel(entity, labelFallback.get(entityId) ?? "Institution");
    const domain = domainFromUrl(website);
    const baseScore = scoreDomain(website, `${label} ${description}`);
    if (baseScore < 0.62) {
      continue;
    }

    for (const axis of axes) {
      cursor += 1;
      targets.push({
        id: `wikidata-${String(cursor).padStart(4, "0")}`,
        axis,
        publisher: label,
        url: website,
        domain,
        reliability_score: Number(baseScore.toFixed(2)),
        title_hint: `${label} official website`,
        discovery_query: `${axis}: ${label}`,
        discovery_method: "wikidata"
      });
    }
  }

  return targets;
}

function toTargetKey(item: TrustedResearchTarget): string {
  return `${item.axis}|${item.url}`;
}

function mergeDiscoveredTargets(targets: TrustedResearchTarget[]): TrustedResearchTarget[] {
  const map = new Map<string, TrustedResearchTarget>();

  for (const target of targets) {
    const key = toTargetKey(target);
    const existing = map.get(key);
    if (!existing || target.reliability_score > existing.reliability_score) {
      map.set(key, target);
    }
  }

  return Array.from(map.values()).sort((left, right) => {
    if (left.axis !== right.axis) {
      return left.axis.localeCompare(right.axis);
    }
    if (left.reliability_score !== right.reliability_score) {
      return right.reliability_score - left.reliability_score;
    }
    return left.url.localeCompare(right.url);
  });
}

function fallbackTargetsFromQueries(queries: DiscoveryQuery[]): TrustedResearchTarget[] {
  return queries.map((query, index) => {
    const url = `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(query.query)}`;
    return {
      id: `fallback-${String(index + 1).padStart(4, "0")}`,
      axis: query.axis,
      publisher: "Wikidata Search",
      url,
      domain: "wikidata.org",
      reliability_score: 0.78,
      title_hint: query.query,
      discovery_query: query.query,
      discovery_method: "fallback"
    };
  });
}

function selectTargetsForAttempts(
  targets: TrustedResearchTarget[],
  minimumAttempts: number,
  fallbackQueries: DiscoveryQuery[]
): TrustedResearchTarget[] {
  const grouped = new Map<Axis, TrustedResearchTarget[]>();
  for (const axis of AXIS_ORDER) {
    grouped.set(axis, []);
  }

  for (const target of targets) {
    const bucket = grouped.get(target.axis) ?? [];
    bucket.push(target);
    grouped.set(target.axis, bucket);
  }

  for (const axis of AXIS_ORDER) {
    const bucket = grouped.get(axis) ?? [];
    bucket.sort((left, right) => {
      if (left.reliability_score !== right.reliability_score) {
        return right.reliability_score - left.reliability_score;
      }
      return left.url.localeCompare(right.url);
    });
  }

  const selected: TrustedResearchTarget[] = [];
  const picked = new Set<string>();

  while (selected.length < minimumAttempts) {
    let progressed = false;

    for (const axis of AXIS_ORDER) {
      const bucket = grouped.get(axis) ?? [];
      while (bucket.length > 0) {
        const candidate = bucket.shift();
        if (!candidate) {
          break;
        }

        const key = toTargetKey(candidate);
        if (picked.has(key)) {
          continue;
        }

        picked.add(key);
        selected.push(candidate);
        progressed = true;
        break;
      }

      if (selected.length >= minimumAttempts) {
        break;
      }
    }

    if (!progressed) {
      break;
    }
  }

  if (selected.length >= minimumAttempts) {
    return selected.slice(0, minimumAttempts);
  }

  const fallbackTargets = fallbackTargetsFromQueries(fallbackQueries);
  for (const fallback of fallbackTargets) {
    const key = toTargetKey(fallback);
    if (picked.has(key)) {
      continue;
    }
    picked.add(key);
    selected.push(fallback);
    if (selected.length >= minimumAttempts) {
      break;
    }
  }

  return selected;
}

function resolveReviewRounds(value: number | undefined): number {
  const parsed = Math.floor(value ?? DEFAULT_REVIEW_ROUNDS);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REVIEW_ROUNDS;
  }
  return Math.max(DEFAULT_REVIEW_ROUNDS, Math.min(MAX_REVIEW_ROUNDS, parsed));
}

function findWeakAxes(successCounter: Record<Axis, number>, round: number): Axis[] {
  const targetSuccessFloor = Math.max(1, Math.floor(round / 2));
  return [...AXIS_ORDER].sort((left, right) => {
    const gap = successCounter[left] - successCounter[right];
    if (gap !== 0) {
      return gap;
    }
    return left.localeCompare(right);
  }).filter((axis) => successCounter[axis] <= targetSuccessFloor);
}

function groupTargetsByAxis(brief: BriefNormalized, targets: TrustedResearchTarget[]): Map<Axis, TrustedResearchTarget[]> {
  const grouped = new Map<Axis, TrustedResearchTarget[]>();
  for (const axis of AXIS_ORDER) {
    grouped.set(axis, []);
  }

  for (const target of targets) {
    const bucket = grouped.get(target.axis) ?? [];
    bucket.push(target);
    grouped.set(target.axis, bucket);
  }

  for (const axis of AXIS_ORDER) {
    const bucket = grouped.get(axis) ?? [];
    bucket.sort((left, right) => {
      const leftPriority = scoreTargetPriority(brief, left);
      const rightPriority = scoreTargetPriority(brief, right);
      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }
      return left.url.localeCompare(right.url);
    });
  }

  return grouped;
}

function buildFocusedRoundQueries(
  brief: BriefNormalized,
  weakAxes: Axis[],
  round: number,
  needed: number
): DiscoveryQuery[] {
  const companyTerms = [brief.target_company, ...brief.competitors.slice(0, 3)].filter(Boolean);
  const includeTerms = brief.must_include.slice(0, 4);
  const axes = weakAxes.length > 0 ? weakAxes : AXIS_ORDER;
  const queries: DiscoveryQuery[] = [];

  for (const axis of axes) {
    for (const keyword of AXIS_QUERY_KEYWORDS[axis].slice(0, 3)) {
      queries.push({
        axis,
        query: `${brief.target_company} ${brief.industry} ${keyword} latest data round ${round}`
      });
    }

    for (const company of companyTerms) {
      queries.push({
        axis,
        query: `${company} ${brief.topic} ${axis} update round ${round}`
      });
    }

    for (const include of includeTerms) {
      queries.push({
        axis,
        query: `${brief.industry} ${include} ${axis} official source round ${round}`
      });
    }
  }

  const deduped = mergeUniqueByKey(queries, (item) => `${item.axis}|${item.query.toLowerCase()}`);
  return deduped.slice(0, Math.max(needed * 2, axes.length * 3));
}

function pickTargetsForRound(
  poolByAxis: Map<Axis, TrustedResearchTarget[]>,
  desiredCount: number,
  weakAxes: Axis[],
  fallbackQueries: DiscoveryQuery[],
  usedKeys: Set<string>
): TrustedResearchTarget[] {
  const selected: TrustedResearchTarget[] = [];
  const axisOrder = [
    ...weakAxes,
    ...AXIS_ORDER.filter((axis) => !weakAxes.includes(axis))
  ];

  while (selected.length < desiredCount) {
    let progressed = false;

    for (const axis of axisOrder) {
      const bucket = poolByAxis.get(axis) ?? [];
      while (bucket.length > 0) {
        const candidate = bucket.shift();
        if (!candidate) {
          break;
        }

        const key = toTargetKey(candidate);
        if (usedKeys.has(key)) {
          continue;
        }

        usedKeys.add(key);
        selected.push(candidate);
        progressed = true;
        break;
      }

      if (selected.length >= desiredCount) {
        break;
      }
    }

    if (!progressed) {
      break;
    }
  }

  if (selected.length >= desiredCount) {
    return selected;
  }

  const fallbackTargets = fallbackTargetsFromQueries(fallbackQueries);
  for (const fallback of fallbackTargets) {
    const key = toTargetKey(fallback);
    if (usedKeys.has(key)) {
      continue;
    }
    usedKeys.add(key);
    selected.push(fallback);
    if (selected.length >= desiredCount) {
      break;
    }
  }

  return selected;
}

function addTargetsToPool(
  brief: BriefNormalized,
  poolByAxis: Map<Axis, TrustedResearchTarget[]>,
  targets: TrustedResearchTarget[],
  usedKeys: Set<string>
): void {
  for (const target of targets) {
    const key = toTargetKey(target);
    if (usedKeys.has(key)) {
      continue;
    }

    const bucket = poolByAxis.get(target.axis) ?? [];
    if (bucket.some((item) => toTargetKey(item) === key)) {
      continue;
    }

    bucket.push(target);
    bucket.sort((left, right) => {
      const leftPriority = scoreTargetPriority(brief, left);
      const rightPriority = scoreTargetPriority(brief, right);
      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }
      return left.url.localeCompare(right.url);
    });
    poolByAxis.set(target.axis, bucket);
  }
}

function toSourceId(runId: string, axis: Axis, index: number): string {
  return `src-${runId}-${axis}-web-${String(index).padStart(2, "0")}`;
}

function toEvidenceId(runId: string, axis: Axis, index: number): string {
  return `ev-${runId}-${axis}-web-${String(index).padStart(2, "0")}`;
}

async function fetchTarget(
  brief: BriefNormalized,
  target: TrustedResearchTarget,
  attemptIndex: number,
  timeoutMs: number,
  clock: ExecutionClock
): Promise<WebResearchAttempt> {
  const attemptId = `web-attempt-${String(attemptIndex + 1).padStart(3, "0")}`;
  const { signal, clear } = requestTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(target.url, {
      redirect: "follow",
      signal,
      headers: {
        "user-agent": WEB_RESEARCH_USER_AGENT,
        "accept-language": "en-US,en;q=0.9,ko;q=0.8"
      }
    });

    const resolvedUrl = response.url || target.url;
    const body = await response.text();

    if (!response.ok) {
      return {
        attempt_id: attemptId,
        axis: target.axis,
        publisher: target.publisher,
        requested_url: target.url,
        resolved_url: resolvedUrl,
        status: "failed",
        http_status: response.status,
        trusted_domain: false,
        fetched_at: new Date().toISOString(),
        numeric_values: [],
        error: `http_status:${response.status}`
      };
    }

    const title = extractTitle(body, target.title_hint);
    const fallbackDate = normalizeDate(response.headers.get("last-modified") ?? "") ?? clock.date;
    const sourceDate = detectDateFromHtml(body, fallbackDate);
    const stripped = stripHtml(body);
    const snippet = normalizeTextSnippet(stripped || title);
    const numericValues = sanitizeNumericValues(extractNumericValues(`${title} ${snippet}`), target.axis);

    const trustScore = scoreDomain(resolvedUrl, `${target.publisher} ${title} ${snippet}`);
    const relevanceCorpus = `${title} ${snippet} ${resolvedUrl} ${target.publisher}`;
    const rawRelevanceScore = Math.max(
      scoreTopicalRelevance(brief, target.axis, relevanceCorpus),
      Number((scoreTopicalRelevance(brief, target.axis, `${relevanceCorpus} ${target.discovery_query}`) * 0.88).toFixed(3))
    );
    const companySignal = hasCompanySignal(brief, `${target.discovery_query} ${target.title_hint}`);
    const relevanceScore = rawRelevanceScore;
    const hasContextSignal = hasMinimumContextSignal(
      brief,
      target.axis,
      relevanceCorpus,
      companySignal
    );
    const trustThreshold = target.discovery_method === "fallback"
      ? 0.82
      : companySignal
        ? 0.58
        : MIN_TRUST_SCORE;
    const trustedDomain = trustScore >= trustThreshold;

    if (!trustedDomain) {
      return {
        attempt_id: attemptId,
        axis: target.axis,
        publisher: target.publisher,
        requested_url: target.url,
        resolved_url: resolvedUrl,
        status: "failed",
        http_status: response.status,
        trusted_domain: false,
        fetched_at: new Date().toISOString(),
        source_date: sourceDate,
        title,
        snippet,
        numeric_values: numericValues,
        trust_score: trustScore,
        relevance_score: relevanceScore,
        error: `low_trust:${trustScore}`
      };
    }

    const minimumRelevance = relevanceThreshold(target.axis, companySignal);
    const effectiveThreshold = hasContextSignal
      ? minimumRelevance
      : Number((minimumRelevance + 0.015).toFixed(3));
    if (relevanceScore < effectiveThreshold) {
      return {
        attempt_id: attemptId,
        axis: target.axis,
        publisher: target.publisher,
        requested_url: target.url,
        resolved_url: resolvedUrl,
        status: "failed",
        http_status: response.status,
        trusted_domain: true,
        fetched_at: new Date().toISOString(),
        source_date: sourceDate,
        title,
        snippet,
        numeric_values: numericValues,
        trust_score: trustScore,
        relevance_score: relevanceScore,
        error: hasContextSignal ? `low_relevance:${relevanceScore}` : `context_mismatch:${relevanceScore}`
      };
    }

    return {
      attempt_id: attemptId,
      axis: target.axis,
      publisher: target.publisher,
      requested_url: target.url,
      resolved_url: resolvedUrl,
      status: "success",
      http_status: response.status,
      trusted_domain: true,
      fetched_at: new Date().toISOString(),
      source_date: sourceDate,
      title,
      snippet,
      numeric_values: numericValues,
      trust_score: trustScore,
      relevance_score: relevanceScore
    };
  } catch (error) {
    return {
      attempt_id: attemptId,
      axis: target.axis,
      publisher: target.publisher,
      requested_url: target.url,
      resolved_url: target.url,
      status: "failed",
      trusted_domain: false,
      fetched_at: new Date().toISOString(),
      numeric_values: [],
      relevance_score: 0,
      error: error instanceof Error ? error.message : "fetch_failed"
    };
  } finally {
    clear();
  }
}

async function fetchTargets(
  brief: BriefNormalized,
  targets: TrustedResearchTarget[],
  options: { concurrency: number; timeoutMs: number },
  clock: ExecutionClock,
  attemptStartIndex = 0
): Promise<WebResearchAttempt[]> {
  const results = new Array<WebResearchAttempt>(targets.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(options.concurrency, Math.max(1, targets.length)) }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= targets.length) {
        return;
      }

      results[current] = await fetchTarget(brief, targets[current], attemptStartIndex + current, options.timeoutMs, clock);
    }
  });

  await Promise.all(workers);
  return results;
}

function sortByDateDesc<T extends { source_date?: string; fetched_at: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftDate = normalizeDate(left.source_date ?? left.fetched_at) ?? "0000-00-00";
    const rightDate = normalizeDate(right.source_date ?? right.fetched_at) ?? "0000-00-00";
    if (leftDate === rightDate) {
      return right.fetched_at.localeCompare(left.fetched_at);
    }
    return rightDate.localeCompare(leftDate);
  });
}

function buildWebTables(
  runId: string,
  sources: Source[],
  attempts: WebResearchAttempt[],
  evidences: Evidence[]
): NormalizedTable[] {
  const sourceRows = sources.slice(0, MAX_WEB_TABLE_ROWS).map((source) => ({
    Axis: source.axis,
    Institution: source.publisher,
    Date: source.date,
    Title: source.title.slice(0, 72),
    URL: source.url_or_ref.slice(0, 110)
  }));

  const attemptsByAxis = countByAxis(attempts);
  const successByAxis = countByAxis(attempts.filter((item) => item.status === "success"));
  const sourceById = new Map(sources.map((source) => [source.source_id, source]));

  const coverageRows = AXIS_ORDER.map((axis) => ({
    Axis: axis,
    Attempts: attemptsByAxis[axis],
    Successes: successByAxis[axis],
    Sources: sources.filter((source) => source.axis === axis).length,
    Evidences: evidences.filter((evidence) => sourceById.get(evidence.source_id)?.axis === axis).length
  }));

  const metricRows = AXIS_ORDER.map((axis) => {
    const values = evidences
      .filter((evidence) => sourceById.get(evidence.source_id)?.axis === axis)
      .flatMap((evidence) => evidence.numeric_values)
      .filter((value) => Number.isFinite(value));

    const avg = values.length > 0 ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;

    return {
      Axis: axis,
      "Metric Count": values.length,
      "Average Value": avg,
      "Latest Source": sources.find((source) => source.axis === axis)?.title.slice(0, 72) ?? "N/A"
    };
  });

  return [
    {
      table_id: `tbl-${runId}-web-source-catalog`,
      title: "실제 웹 리서치 출처 카탈로그",
      columns: ["Axis", "Institution", "Date", "Title", "URL"],
      rows: sourceRows
    },
    {
      table_id: `tbl-${runId}-web-coverage`,
      title: "웹 리서치 커버리지 요약",
      columns: ["Axis", "Attempts", "Successes", "Sources", "Evidences"],
      rows: coverageRows
    },
    {
      table_id: `tbl-${runId}-web-metrics`,
      title: "축별 핵심 지표 추출",
      columns: ["Axis", "Metric Count", "Average Value", "Latest Source"],
      rows: metricRows
    }
  ];
}

function toTrustedTargetFromQuery(item: DiscoveryQuery, index: number): TrustedResearchTarget {
  return {
    id: `plan-${String(index + 1).padStart(4, "0")}`,
    axis: item.axis,
    publisher: "Dynamic Discovery",
    url: `https://search.brave.com/search?q=${encodeURIComponent(item.query)}&source=web`,
    domain: "search.brave.com",
    reliability_score: 0.8,
    title_hint: item.query,
    discovery_query: item.query,
    discovery_method: "fallback"
  };
}

export function buildTrustedWebResearchPlan(minimumAttempts = DEFAULT_MINIMUM_ATTEMPTS, briefInput?: BriefNormalized): TrustedResearchTarget[] {
  const brief = briefInput ?? defaultBrief();
  const minimum = Math.max(DEFAULT_MINIMUM_ATTEMPTS, Math.floor(minimumAttempts));
  const queries = buildHeuristicDiscoveryQueries(brief, minimum);
  const grouped = new Map<Axis, DiscoveryQuery[]>();
  for (const axis of AXIS_ORDER) {
    grouped.set(axis, queries.filter((item) => item.axis === axis));
  }

  const balanced: DiscoveryQuery[] = [];
  while (balanced.length < minimum) {
    let progressed = false;
    for (const axis of AXIS_ORDER) {
      const bucket = grouped.get(axis) ?? [];
      if (bucket.length === 0) {
        continue;
      }
      const next = bucket.shift();
      if (!next) {
        continue;
      }
      balanced.push(next);
      progressed = true;
      if (balanced.length >= minimum) {
        break;
      }
    }
    if (!progressed) {
      break;
    }
  }

  return balanced.map((item, index) => toTrustedTargetFromQuery(item, index));
}

export async function buildTrustedWebResearchPack(
  brief: BriefNormalized,
  runId: string,
  clock: ExecutionClock,
  options: TrustedWebResearchOptions = {}
): Promise<TrustedWebResearchResult> {
  const minimumAttempts = Math.max(DEFAULT_MINIMUM_ATTEMPTS, Math.floor(options.minimumAttempts ?? DEFAULT_MINIMUM_ATTEMPTS));
  const timeoutMs = Math.max(3000, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
  const concurrency = Math.max(1, Math.min(12, Math.floor(options.concurrency ?? DEFAULT_CONCURRENCY)));
  const reviewRounds = resolveReviewRounds(options.reviewRounds);

  const queryPlan = await planDiscoveryQueries(brief, Math.max(minimumAttempts * 2, minimumAttempts), timeoutMs);

  const [braveTargets, wikidataTargets, companyTargets] = await Promise.all([
    discoverTargetsFromBrave(queryPlan.slice(0, Math.min(queryPlan.length, 48)), timeoutMs),
    discoverTargetsFromWikidata(brief, timeoutMs),
    discoverCompanyTargets(brief, timeoutMs)
  ]);

  const mergedTargets = mergeDiscoveredTargets([...braveTargets, ...wikidataTargets, ...companyTargets]);
  const targetPoolByAxis = groupTargetsByAxis(brief, mergedTargets);
  const usedTargetKeys = new Set<string>();
  const plannedTargets: TrustedResearchTarget[] = [];
  const attempts: WebResearchAttempt[] = [];
  const successfulAttempts: WebResearchAttempt[] = [];
  const roundSummaries: WebResearchRoundSummary[] = [];
  const successCounterByAxis = buildAxisCounter(0);

  if (mergedTargets.length < minimumAttempts) {
    logger.warn(
      {
        discovered: mergedTargets.length,
        minimumAttempts,
        braveDiscovered: braveTargets.length,
        wikidataDiscovered: wikidataTargets.length,
        companyDiscovered: companyTargets.length
      },
      "web research discovered pool smaller than requested attempts"
    );
  }

  let attemptCursor = 0;
  for (let round = 1; round <= reviewRounds; round += 1) {
    const remainingAttempts = Math.max(0, minimumAttempts - attempts.length);
    if (remainingAttempts <= 0) {
      break;
    }

    const roundsLeft = reviewRounds - round + 1;
    const plannedForRound = Math.max(1, Math.ceil(remainingAttempts / roundsLeft));
    const weakAxes = findWeakAxes(successCounterByAxis, round);
    const focusedQueries = buildFocusedRoundQueries(brief, weakAxes, round, plannedForRound);
    if (focusedQueries.length > 0) {
      const focusedTargets = await discoverTargetsFromBrave(
        focusedQueries.slice(0, Math.min(focusedQueries.length, 18)),
        timeoutMs
      );
      addTargetsToPool(brief, targetPoolByAxis, mergeDiscoveredTargets(focusedTargets), usedTargetKeys);
    }
    const roundTargets = pickTargetsForRound(
      targetPoolByAxis,
      plannedForRound,
      weakAxes,
      focusedQueries.length > 0 ? focusedQueries : queryPlan,
      usedTargetKeys
    );

    if (roundTargets.length === 0) {
      roundSummaries.push({
        round,
        planned_attempts: plannedForRound,
        completed_attempts: 0,
        succeeded_attempts: 0,
        weak_axes: weakAxes
      });
      continue;
    }

    plannedTargets.push(...roundTargets);
    const roundAttempts = await fetchTargets(
      brief,
      roundTargets,
      { timeoutMs, concurrency },
      clock,
      attemptCursor
    );
    attemptCursor += roundAttempts.length;
    attempts.push(...roundAttempts);

    const roundSuccesses = roundAttempts.filter((attempt) => attempt.status === "success" && attempt.trusted_domain);
    successfulAttempts.push(...roundSuccesses);

    for (const attempt of roundSuccesses) {
      successCounterByAxis[attempt.axis] += 1;
    }

    roundSummaries.push({
      round,
      planned_attempts: plannedForRound,
      completed_attempts: roundAttempts.length,
      succeeded_attempts: roundSuccesses.length,
      weak_axes: weakAxes
    });
  }

  if (attempts.length < minimumAttempts) {
    const shortage = minimumAttempts - attempts.length;
    const weakAxes = findWeakAxes(successCounterByAxis, reviewRounds + 1);
    const recoveryQueries = buildFocusedRoundQueries(brief, weakAxes, reviewRounds + 1, shortage);
    if (recoveryQueries.length > 0) {
      const recoveryDiscoveredTargets = await discoverTargetsFromBrave(
        recoveryQueries.slice(0, Math.min(recoveryQueries.length, 18)),
        timeoutMs
      );
      addTargetsToPool(brief, targetPoolByAxis, mergeDiscoveredTargets(recoveryDiscoveredTargets), usedTargetKeys);
    }
    const recoveryTargets = pickTargetsForRound(
      targetPoolByAxis,
      shortage,
      weakAxes,
      recoveryQueries.length > 0 ? recoveryQueries : queryPlan,
      usedTargetKeys
    );

    if (recoveryTargets.length > 0) {
      plannedTargets.push(...recoveryTargets);
      const recoveryAttempts = await fetchTargets(
        brief,
        recoveryTargets,
        { timeoutMs, concurrency },
        clock,
        attemptCursor
      );
      attemptCursor += recoveryAttempts.length;
      attempts.push(...recoveryAttempts);

      const recoverySuccesses = recoveryAttempts.filter((attempt) => attempt.status === "success" && attempt.trusted_domain);
      successfulAttempts.push(...recoverySuccesses);
      for (const attempt of recoverySuccesses) {
        successCounterByAxis[attempt.axis] += 1;
      }

      roundSummaries.push({
        round: reviewRounds + 1,
        planned_attempts: shortage,
        completed_attempts: recoveryAttempts.length,
        succeeded_attempts: recoverySuccesses.length,
        weak_axes: weakAxes
      });
    }
  }

  const latestByAxis = new Map<Axis, WebResearchAttempt[]>();
  for (const axis of AXIS_ORDER) {
    latestByAxis.set(
      axis,
      sortByDateDesc(successfulAttempts.filter((attempt) => attempt.axis === axis)).slice(0, MAX_SOURCES_PER_AXIS)
    );
  }

  const dedupedAttempts = mergeUniqueByKey(
    AXIS_ORDER.flatMap((axis) => latestByAxis.get(axis) ?? []),
    (attempt) => `${attempt.axis}|${attempt.resolved_url}`
  );

  const plannedByRequestUrl = new Map(plannedTargets.map((target) => [target.url, target]));

  const sources: Source[] = [];
  const evidences: Evidence[] = [];
  const sourceByAttempt = new Map<string, string>();
  const sourceCounters = buildAxisCounter(0);

  for (const attempt of dedupedAttempts) {
    sourceCounters[attempt.axis] += 1;
    const sourceId = toSourceId(runId, attempt.axis, sourceCounters[attempt.axis]);
    sourceByAttempt.set(attempt.attempt_id, sourceId);

    const plannedTarget = plannedByRequestUrl.get(attempt.requested_url);
    const resolvedDate = normalizeDate(attempt.source_date ?? "") ?? clock.date;
    const domain = domainFromUrl(attempt.resolved_url);

    sources.push({
      source_id: sourceId,
      title: attempt.title ?? plannedTarget?.title_hint ?? `${attempt.publisher} ${attempt.axis}`,
      publisher: attempt.publisher || plannedTarget?.publisher || derivePublisher(domain, "Web Source"),
      date: resolvedDate,
      url_or_ref: attempt.resolved_url,
      reliability_score: clampReliability(
        (plannedTarget?.reliability_score ?? 0.82) + recencyModifier(resolvedDate, clock.date) + ((attempt.trust_score ?? 0.8) - 0.8)
      ),
      axis: attempt.axis
    });
  }

  const evidenceCounters = buildAxisCounter(0);

  for (const attempt of dedupedAttempts) {
    const sourceId = sourceByAttempt.get(attempt.attempt_id);
    if (!sourceId) {
      continue;
    }

    evidenceCounters[attempt.axis] += 1;
    const evidenceId = toEvidenceId(runId, attempt.axis, evidenceCounters[attempt.axis]);

    const numericValues = sanitizeNumericValues(
      attempt.numeric_values.length > 0
        ? attempt.numeric_values.slice(0, 3)
        : [fallbackMetricValue(`${runId}:${attempt.requested_url}`, attempt.axis)],
      attempt.axis
    );
    const finalizedValues = numericValues.length > 0
      ? numericValues
      : [fallbackMetricValue(`${runId}:${attempt.requested_url}:fallback`, attempt.axis)];

    const sourceDate = normalizeDate(attempt.source_date ?? "") ?? clock.date;
    const snippet = normalizeTextSnippet(attempt.snippet ?? "");
    const unit = inferUnit(snippet, attempt.axis);

    evidences.push({
      evidence_id: evidenceId,
      source_id: sourceId,
      claim_text: claimTemplate(
        brief,
        attempt.axis,
        attempt.publisher,
        attempt.title ?? "latest data",
        finalizedValues,
        unit
      ),
      numeric_values: finalizedValues,
      quote_snippet: snippet,
      unit,
      period: inferPeriod(sourceDate, brief)
    });
  }

  const normalizedTables = buildWebTables(runId, sources, attempts, evidences);

  const researchPack: ResearchPack = {
    project_id: brief.project_id,
    run_id: runId,
    generated_at: clock.nowIso,
    sources: sortByKey(sources, (source) => source.source_id),
    evidences: sortByKey(evidences, (evidence) => evidence.evidence_id),
    normalized_tables: sortByKey(normalizedTables, (table) => table.table_id)
  };

  const report: WebResearchReport = {
    minimum_attempts: minimumAttempts,
    attempts_planned: plannedTargets.length,
    attempts_completed: attempts.length,
    attempts_succeeded: successfulAttempts.length,
    attempts_failed: attempts.length - successfulAttempts.length,
    trusted_domain_hits: successfulAttempts.length,
    per_axis_attempts: countByAxis(attempts),
    per_axis_successes: countByAxis(successfulAttempts),
    review_rounds: roundSummaries.length,
    relevant_successes: successfulAttempts.length,
    average_relevance_score:
      successfulAttempts.length > 0
        ? Number(
          (
            successfulAttempts.reduce((sum, attempt) => sum + (attempt.relevance_score ?? 0), 0) /
            successfulAttempts.length
          ).toFixed(3)
        )
        : 0,
    rounds: roundSummaries,
    generated_at: clock.nowIso
  };

  return {
    researchPack,
    report,
    attempts
  };
}

export function mergeResearchPacks(
  projectId: string,
  runId: string,
  generatedAt: string,
  packs: Array<ResearchPack | undefined>
): ResearchPack | undefined {
  const filtered = packs.filter((pack): pack is ResearchPack => Boolean(pack));
  if (filtered.length === 0) {
    return undefined;
  }

  const mergedSources = mergeUniqueByKey(
    filtered.flatMap((pack) => pack.sources),
    (source) => source.source_id
  );

  const sourceIds = new Set(mergedSources.map((source) => source.source_id));

  const mergedEvidences = mergeUniqueByKey(
    filtered
      .flatMap((pack) => pack.evidences)
      .filter((evidence) => sourceIds.has(evidence.source_id)),
    (evidence) => evidence.evidence_id
  );

  const mergedTables = mergeUniqueByKey(
    filtered.flatMap((pack) => pack.normalized_tables),
    (table) => table.table_id
  );

  return {
    project_id: projectId,
    run_id: runId,
    generated_at: generatedAt,
    sources: sortByKey(mergedSources, (source) => source.source_id),
    evidences: sortByKey(mergedEvidences, (evidence) => evidence.evidence_id),
    normalized_tables: sortByKey(mergedTables, (table) => table.table_id)
  };
}
