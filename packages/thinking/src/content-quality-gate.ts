import { BriefNormalized, ResearchPack, SlideSpec, SlideType } from "@consulting-ppt/shared";
import { buildMECEFramework } from "./mece-framework";

export interface ContentQualityRound {
  round: number;
  issue_count: number;
  issue_types: string[];
  notes: string[];
}

export interface ContentQualityReport {
  rounds: ContentQualityRound[];
  final_issue_count: number;
  rewritten_titles: number;
  rewritten_governing_messages: number;
  rewritten_claims: number;
  duplicate_claim_repairs: number;
  storyline_bridge_repairs: number;
  must_include_covered: number;
  uncovered_must_include: string[];
  /** MECE 커버리지 점수: 0~100 (6축 × 4레버 기반 문제 분해 완전성) */
  mece_coverage_score: number;
  /** MECE 갭: 슬라이드 스펙에서 다루지 않은 연구 축 */
  mece_gaps: string[];
}

type ClaimPhase = "diagnosis" | "implication" | "action";

type QualityIssueType =
  | "weak_title"
  | "weak_governing_message"
  | "weak_claim"
  | "duplicate_claim"
  | "story_gap";

interface QualityIssue {
  type: QualityIssueType;
  slideIndex: number;
  claimIndex?: number;
  relatedSlideIndex?: number;
}

interface RewriteStats {
  rewritten_titles: number;
  rewritten_governing_messages: number;
  rewritten_claims: number;
  duplicate_claim_repairs: number;
  storyline_bridge_repairs: number;
}

const MIN_REVIEW_ROUNDS = 3;
const CLAIM_SIMILARITY_THRESHOLD = 0.84;
const STORY_GAP_THRESHOLD = 0.025;
const GENERIC_SIGNALS = [
  "핵심 이슈가 실행 누락 없이 반영되도록 보장한다",
  "순위 실행 항목으로 구조화",
  "경영진 의사결정에 직접 연결",
  "정량 근거 기반",
  "핵심 과제 축"
];

const DECISION_FOCUS_BY_TYPE: Record<SlideType, string> = {
  cover: "핵심 질문과 분석 범위",
  "exec-summary": "투자·고객 포트폴리오",
  "market-landscape": "시장 대응 포트폴리오",
  benchmark: "경쟁우위 확보 과제",
  "risks-issues": "핵심 리스크 통제 과제",
  roadmap: "실행 게이트와 KPI",
  appendix: "근거 검증 항목"
};

const DIAGNOSIS_LENS_BY_TYPE: Record<SlideType, string> = {
  cover: "핵심 질문 정렬",
  "exec-summary": "가치창출 경로",
  "market-landscape": "수요·가격·지역 구조",
  benchmark: "경쟁 포지셔닝",
  "risks-issues": "리스크 노출도",
  roadmap: "실행 병목",
  appendix: "근거 신뢰도"
};

const IMPLICATION_LENS_BY_TYPE: Record<SlideType, string> = {
  cover: "전략 선택 기준",
  "exec-summary": "투자/수익성 배분",
  "market-landscape": "세그먼트 전략",
  benchmark: "고객·제품 우선순위",
  "risks-issues": "완화 투자 배분",
  roadmap: "단계 전환 기준",
  appendix: "결론 확신도"
};

const ACTION_LENS_BY_TYPE: Record<SlideType, [string, string, string]> = {
  cover: ["핵심 질문 확정", "분석 범위 동결", "전사 실행 아젠다 승인"],
  "exec-summary": ["핵심 KPI 확정", "우선과제 실행", "확장 투자 의사결정"],
  "market-landscape": ["수요 시나리오 재검증", "고객/제품 재배치", "장기 CAPA 연동"],
  benchmark: ["차별화 과제 확정", "수익성 개선 실행", "전략 파트너십 확장"],
  "risks-issues": ["조기경보 체계 구축", "고위험 완화 실행", "복구 시나리오 정례화"],
  roadmap: ["단계별 게이트 확정", "중기 확장 실행", "장기 체질 전환"],
  appendix: ["근거 검증 완료", "가정/지표 업데이트", "정책 변화 재반영"]
};

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanupSentenceEnd(value: string): string {
  return compact(value).replace(/[.。]+$/g, "");
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

function hasKoreanBatchim(word: string): boolean {
  const trimmed = word.trim();
  if (!trimmed) {
    return false;
  }

  const lastChar = trimmed[trimmed.length - 1] ?? "";
  const code = lastChar.charCodeAt(0);

  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 !== 0;
  }

  if (/[a-z]/i.test(lastChar)) {
    return !/[aeiouy]/i.test(lastChar);
  }

  if (/\d/.test(lastChar)) {
    return false;
  }

  return false;
}

function topicParticle(word: string): "은" | "는" {
  return hasKoreanBatchim(word) ? "은" : "는";
}

function andParticle(word: string): "과" | "와" {
  return hasKoreanBatchim(word) ? "과" : "와";
}

function extractSoWhat(text: string): string | null {
  const matched = text.match(/\(?\s*So What:\s*([^)]+)\)?/i);
  if (!matched) {
    return null;
  }
  return cleanupSentenceEnd(matched[1] ?? "");
}

function normalizeClaimSoWhat(text: string, fallbackSoWhat: string): string {
  const normalized = compact(text);
  if (!normalized) {
    return `(So What: ${fallbackSoWhat})`;
  }

  const soWhat = extractSoWhat(normalized) ?? fallbackSoWhat;
  const body = cleanupSentenceEnd(normalized.replace(/\(?\s*So What:\s*([^)]+)\)?/gi, ""));
  return `${body} (So What: ${soWhat})`;
}

function truncateClaimKeepSoWhat(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const marker = "So What:";
  const markerIndex = text.toLowerCase().indexOf(marker.toLowerCase());
  if (markerIndex < 0) {
    return `${text.slice(0, Math.max(20, maxChars - 3)).trim()}...`;
  }

  const head = cleanupSentenceEnd(text.slice(0, markerIndex));
  const tail = compact(text.slice(markerIndex));
  const budget = maxChars - tail.length - 1;
  if (budget <= 20) {
    return `${text.slice(0, Math.max(20, maxChars - 3)).trim()}...`;
  }

  const compactHead = head.length > budget ? `${head.slice(0, Math.max(20, budget - 3)).trim()}...` : head;
  const merged = compact(`${compactHead} ${tail}`);
  if (merged.length <= maxChars) {
    return merged;
  }

  return `${text.slice(0, Math.max(20, maxChars - 3)).trim()}...`;
}

function metricToken(evidence: ResearchPack["evidences"][number] | undefined): string {
  if (!evidence) {
    return "핵심 지표";
  }

  const value = evidence.numeric_values[0];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "핵심 지표";
  }

  const unit = evidence.unit ?? "";
  return `${Number(value.toFixed(2))}${unit}`.trim();
}

function sourceHint(
  evidence: ResearchPack["evidences"][number] | undefined,
  sourceById: Map<string, ResearchPack["sources"][number]>
): string {
  if (!evidence) {
    return "핵심 소스";
  }

  const source = sourceById.get(evidence.source_id);
  if (!source) {
    return "핵심 소스";
  }

  return `${source.publisher}(${source.date.slice(0, 7)})`;
}

function hasConsultingDecisionTone(value: string): boolean {
  return /(우선순위|재정렬|재설계|전환|구체화|강화|고도화|필요|해야)/.test(value);
}

function genericTitle(value: string): boolean {
  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }
  return /^(executive summary|시장 개요|경쟁 환경|재무 성과 비교|리스크 분석|전략적 시사점|트렌드 기회)$/i.test(normalized);
}

function phaseByClaimIndex(index: number): ClaimPhase {
  if (index <= 0) {
    return "diagnosis";
  }
  if (index === 1) {
    return "implication";
  }
  return "action";
}

function chooseBySeed<T>(items: T[], seed: number): T {
  if (items.length === 0) {
    throw new Error("chooseBySeed requires at least one item");
  }
  return items[Math.abs(seed) % items.length] ?? items[0];
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function phaseSoWhat(phase: ClaimPhase): string {
  if (phase === "diagnosis") {
    return "핵심 이슈를 계량 근거로 특정한다";
  }
  if (phase === "implication") {
    return "대안별 투자/수익성 트레이드오프를 명확화한다";
  }
  return "실행 책임과 성과 가시성을 동시에 확보한다";
}

function phaseLabel(phase: ClaimPhase): string {
  if (phase === "diagnosis") {
    return "진단";
  }
  if (phase === "implication") {
    return "해석";
  }
  return "권고";
}

function buildConsultingTitle(slide: SlideSpec["slides"][number], brief: BriefNormalized): string {
  const normalized = compact(slide.title);
  if (!genericTitle(normalized) && normalized.length >= 10) {
    return normalized;
  }

  switch (slide.type) {
    case "cover":
      return `${brief.industry} 전략 방향성 진단`;
    case "exec-summary":
      return `핵심 결론: ${brief.target_company} 전략 우선순위`;
    case "market-landscape":
      return "시장 진단: 수요·성장·지역 재편";
    case "benchmark":
      return normalized.includes(brief.target_company)
        ? `${brief.target_company} 경쟁력 진단: 우위·열위`
        : "경쟁 비교: 포지셔닝·수익성 격차";
    case "risks-issues":
      return "핵심 리스크: 영향도·대응 우선순위";
    case "roadmap":
      return "실행 로드맵: 단계별 KPI·오너십";
    case "appendix":
      return normalized.startsWith("부록") ? normalized : `부록: ${normalized}`;
    default:
      return normalized;
  }
}

function phaseFrame(slideIndex: number, totalSlides: number): string {
  if (slideIndex <= Math.floor(totalSlides * 0.33)) {
    return "진단";
  }
  if (slideIndex <= Math.floor(totalSlides * 0.66)) {
    return "해석";
  }
  return "실행";
}

function fitGoverningMessage(value: string, maxChars: number): string {
  const normalized = compact(value);
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const suffix = "우선순위를 재정렬해야 한다";
  const index = normalized.indexOf(":");
  if (index < 0) {
    return `${normalized.slice(0, Math.max(24, maxChars - 3)).trim()}...`;
  }

  const head = normalized.slice(0, index + 1).trim();
  const tail = normalized.slice(index + 1).trim();
  if (tail.includes(suffix)) {
    const budget = maxChars - head.length - suffix.length - 3;
    if (budget >= 18) {
      const core = tail
        .replace(suffix, "")
        .trim()
        .replace(/[.。]+$/g, "");
      const fittedCore = core.length > budget ? `${core.slice(0, Math.max(18, budget - 3)).trim()}...` : core;
      return compact(`${head} ${fittedCore} ${suffix}`);
    }
  }

  return `${normalized.slice(0, Math.max(24, maxChars - 3)).trim()}...`;
}

function buildGoverningMessage(
  slide: SlideSpec["slides"][number],
  brief: BriefNormalized,
  metricA: string,
  metricB: string,
  slideIndex: number,
  totalSlides: number
): string {
  const target = `${brief.target_company}${topicParticle(brief.target_company)}`;
  const decisionFocus = DECISION_FOCUS_BY_TYPE[slide.type];
  const frame = phaseFrame(slideIndex, totalSlides);
  const appendixAnchor = slide.type === "appendix" ? ` [${slide.id}]` : "";

  return `${slide.title}${appendixAnchor}: ${metricA}/${metricB} 근거 기준 ${target} ${decisionFocus} 우선순위를 ${frame} 구간에서 재정렬해야 한다`;
}

function competitorLens(brief: BriefNormalized, slideIndex: number): string {
  if (brief.competitors.length === 0) {
    return "주요 경쟁사";
  }
  return brief.competitors[slideIndex % brief.competitors.length] ?? brief.competitors[0];
}

function rewriteClaim(
  phase: ClaimPhase,
  slide: SlideSpec["slides"][number],
  brief: BriefNormalized,
  slideIndex: number,
  round: number,
  metricA: string,
  metricB: string,
  sourceA: string
): string {
  const targetAnd = `${brief.target_company}${andParticle(brief.target_company)}`;
  const competitor = competitorLens(brief, slideIndex + round);
  const company = brief.target_company;
  const shortTitle = cleanupSentenceEnd(slide.title);
  const shortAnchor = shortTitle.length > 12 ? `${shortTitle.slice(0, 12).trim()}...` : shortTitle;

  if (phase === "diagnosis") {
    const endings = [
      "원인 축을 재정의해야 한다",
      "수익성 병목 해소 우선순위를 재설정해야 한다",
      "고객/제품 믹스 재배치가 필요하다"
    ];
    const ending = chooseBySeed(endings, hashSeed(`${slide.id}:${round}:diag`));
    return normalizeClaimSoWhat(
      `${phaseLabel(phase)}: ${metricA} 대비 ${metricB} 변화는 ${shortTitle}에서 ${company}의 ${DIAGNOSIS_LENS_BY_TYPE[slide.type]} 병목을 시사한다. ${sourceA} 근거로 ${ending}`,
      phaseSoWhat(phase)
    );
  }

  if (phase === "implication") {
    const endings = [
      "전략 선택 기준을 재설계해야 한다",
      "투자/고객 우선순위 재배분이 필요하다",
      "대안별 기대성과를 다시 산정해야 한다"
    ];
    const ending = chooseBySeed(endings, hashSeed(`${slide.id}:${round}:imp`));
    return normalizeClaimSoWhat(
      `${phaseLabel(phase)}: ${shortTitle}에서 ${targetAnd} ${competitor} 비교 기준 ${metricA}/${metricB} 격차는 ${IMPLICATION_LENS_BY_TYPE[slide.type]} 재편을 요구한다. ${ending}`,
      phaseSoWhat(phase)
    );
  }

  const milestones = ACTION_LENS_BY_TYPE[slide.type];
  const [m1, m2, m3] = milestones;
  return normalizeClaimSoWhat(
    `${phaseLabel(phase)}: ${shortAnchor} 과제는 0-6개월(${m1}), 6-18개월(${m2}), 18-36개월(${m3}) 순으로 실행하고 KPI(${metricA}, ${metricB})를 월간 점검한다`,
    phaseSoWhat(phase)
  );
}

function claimNeedsRewrite(text: string, brief: BriefNormalized, phase: ClaimPhase): boolean {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length < 36) {
    return true;
  }

  if (!text.includes("So What:")) {
    return true;
  }

  if (!/\d/.test(text) && !/kpi/i.test(text)) {
    return true;
  }

  const entityTerms = [brief.target_company, ...brief.competitors, "시장", "경쟁", "수익성"]
    .map((term) => normalizeText(term))
    .filter((term) => term.length >= 2);
  const hasEntity = entityTerms.some((term) => normalized.includes(term));
  if (!hasEntity && phase !== "action") {
    return true;
  }

  if (!hasEntity && phase === "action") {
    const executionSignals = ["실행", "게이트", "kpi", "오너십", "월간", "로드맵"];
    const hasExecutionSignal = executionSignals.some((signal) => normalized.includes(signal));
    if (!hasExecutionSignal) {
      return true;
    }
  }

  if (GENERIC_SIGNALS.some((signal) => normalized.includes(normalizeText(signal)))) {
    return true;
  }

  return false;
}

function rebuildSourceFooter(
  claims: SlideSpec["slides"][number]["claims"],
  evidenceById: Map<string, ResearchPack["evidences"][number]>,
  sourceById: Map<string, ResearchPack["sources"][number]>
): string[] {
  const entries = new Set<string>();
  for (const claim of claims) {
    for (const evidenceId of claim.evidence_ids) {
      const evidence = evidenceById.get(evidenceId);
      const source = evidence ? sourceById.get(evidence.source_id) : undefined;
      if (!source) {
        continue;
      }
      entries.add(`${source.publisher} (${source.date})`);
    }
  }

  return Array.from(entries).sort();
}

function analyzeQuality(spec: SlideSpec, brief: BriefNormalized): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const claimPool: Array<{ slideIndex: number; claimIndex: number; tokens: string[] }> = [];

  spec.slides.forEach((slide, slideIndex) => {
    if (genericTitle(slide.title) || slide.title.length < 8) {
      issues.push({ type: "weak_title", slideIndex });
    }

    const gm = compact(slide.governing_message);
    const gmNeedsRewrite =
      !hasConsultingDecisionTone(gm) ||
      !gm.includes(brief.target_company) ||
      !/\d/.test(gm) ||
      gm.length > brief.constraints.max_governing_message_chars;

    if (gmNeedsRewrite) {
      issues.push({ type: "weak_governing_message", slideIndex });
    }

    slide.claims.forEach((claim, claimIndex) => {
      const phase = phaseByClaimIndex(claimIndex);
      if (claimNeedsRewrite(claim.text, brief, phase) || claim.text.length > 172) {
        issues.push({ type: "weak_claim", slideIndex, claimIndex });
      }
      claimPool.push({
        slideIndex,
        claimIndex,
        tokens: tokenize(claim.text)
      });
    });
  });

  for (let i = 0; i < claimPool.length; i += 1) {
    for (let j = i + 1; j < claimPool.length; j += 1) {
      const similarity = tokenJaccard(claimPool[i].tokens, claimPool[j].tokens);
      if (similarity < CLAIM_SIMILARITY_THRESHOLD) {
        continue;
      }
      issues.push({
        type: "duplicate_claim",
        slideIndex: claimPool[j].slideIndex,
        claimIndex: claimPool[j].claimIndex,
        relatedSlideIndex: claimPool[i].slideIndex
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

    if (similarity < STORY_GAP_THRESHOLD) {
      issues.push({
        type: "story_gap",
        slideIndex: index,
        relatedSlideIndex: index - 1
      });
    }
  }

  return issues;
}

function repairDuplicateClaim(
  slide: SlideSpec["slides"][number],
  claimIndex: number,
  round: number
): string {
  const claim = slide.claims[claimIndex];
  const soWhat = extractSoWhat(claim.text) ?? "실행 책임과 성과 가시성을 동시에 확보한다";
  const body = cleanupSentenceEnd(claim.text.replace(/\(?\s*So What:\s*([^)]+)\)?/gi, ""));
  const shortTitle = slide.title.length > 18 ? `${slide.title.slice(0, 18).trim()}...` : slide.title;
  return normalizeClaimSoWhat(
    `${body}. ${shortTitle} 관점 차별화 포인트를 ${round}차 검증에서 재확인한다`,
    soWhat
  );
}

function keywordCovered(corpus: string, keyword: string): boolean {
  const keyTokens = tokenize(keyword);
  if (keyTokens.length === 0) {
    return true;
  }

  const hit = keyTokens.filter((token) => corpus.includes(token)).length;
  const required = Math.max(1, Math.ceil(keyTokens.length * 0.4));
  return hit >= required;
}

function compactKeyword(keyword: string): string {
  const normalized = compact(
    keyword
      .replace(/[()]/g, " ")
      .replace(/[,]/g, " ")
      .replace(/\//g, " / ")
  );

  if (/ira/i.test(normalized) && /eu/i.test(normalized) && /규제|공급망|기술/.test(normalized)) {
    return "IRA/EU 규제·공급망·기술전환 옵션";
  }

  if (normalized.length <= 26) {
    return normalized;
  }

  const tokens = normalized.split(" ").filter((token) => token.length > 0);
  if (tokens.length >= 4) {
    return tokens.slice(0, 4).join(" ");
  }

  return `${normalized.slice(0, 23).trim()}...`;
}

function applyMustIncludeCoverage(spec: SlideSpec, brief: BriefNormalized): { covered: number; uncovered: string[] } {
  if (brief.must_include.length === 0) {
    return { covered: 0, uncovered: [] };
  }

  const corpus = normalizeText(
    spec.slides
      .map((slide) => `${slide.title} ${slide.governing_message} ${slide.claims.map((claim) => claim.text).join(" ")}`)
      .join(" ")
  );

  const uncovered = brief.must_include.filter((keyword) => !keywordCovered(corpus, keyword));

  if (uncovered.length === 0) {
    return { covered: brief.must_include.length, uncovered: [] };
  }

  const preferredTypes: SlideType[] = ["exec-summary", "benchmark", "roadmap", "risks-issues", "market-landscape", "appendix"];
  let covered = brief.must_include.length - uncovered.length;

  for (const keyword of uncovered) {
    const targetSlide = preferredTypes
      .map((type) => spec.slides.find((slide) => slide.type === type))
      .find((slide): slide is SlideSpec["slides"][number] => Boolean(slide));

    if (!targetSlide || targetSlide.claims.length === 0) {
      continue;
    }

    const targetClaim = targetSlide.claims[Math.min(2, targetSlide.claims.length - 1)] ?? targetSlide.claims[0];
    if (!targetClaim) {
      continue;
    }

    const soWhat = extractSoWhat(targetClaim.text) ?? "핵심 아젠다가 실행 누락 없이 반영된다";
    const compacted = compactKeyword(keyword);
    targetClaim.text = normalizeClaimSoWhat(
      `${targetClaim.text}. ${compacted} 아젠다를 실행 범위에 포함한다`,
      soWhat
    );
    targetClaim.text = truncateClaimKeepSoWhat(targetClaim.text, 168);
    covered += 1;
  }

  const finalCorpus = normalizeText(
    spec.slides
      .map((slide) => `${slide.title} ${slide.governing_message} ${slide.claims.map((claim) => claim.text).join(" ")}`)
      .join(" ")
  );

  const stillUncovered = brief.must_include.filter((keyword) => !keywordCovered(finalCorpus, keyword));

  return {
    covered: brief.must_include.length - stillUncovered.length,
    uncovered: stillUncovered
  };
}

function rewriteDeckContent(
  spec: SlideSpec,
  brief: BriefNormalized,
  research: ResearchPack,
  round: number,
  stats: RewriteStats
): void {
  const evidenceById = new Map(research.evidences.map((item) => [item.evidence_id, item]));
  const sourceById = new Map(research.sources.map((item) => [item.source_id, item]));

  spec.slides.forEach((slide, slideIndex) => {
    const prevTitle = slide.title;
    const rewrittenTitle = buildConsultingTitle(slide, brief);
    if (prevTitle !== rewrittenTitle) {
      slide.title = rewrittenTitle;
      stats.rewritten_titles += 1;
    }

    const fallbackEvidence = research.evidences[slideIndex % Math.max(1, research.evidences.length)];
    const firstClaim = slide.claims[0];
    const secondClaim = slide.claims[1];
    const evidenceA = evidenceById.get(firstClaim?.evidence_ids[0] ?? "") ?? fallbackEvidence;
    const evidenceB = evidenceById.get(secondClaim?.evidence_ids[0] ?? "") ?? evidenceA;

    const metricA = metricToken(evidenceA);
    const metricB = metricToken(evidenceB);

    const rewrittenGm = fitGoverningMessage(
      buildGoverningMessage(slide, brief, metricA, metricB, slideIndex, spec.slides.length),
      brief.constraints.max_governing_message_chars
    );

    if (slide.governing_message !== rewrittenGm) {
      slide.governing_message = rewrittenGm;
      stats.rewritten_governing_messages += 1;
    }

    const rewrittenClaims = slide.claims.slice(0, Math.max(3, Math.min(brief.constraints.max_bullets_per_slide, 4)));
    while (rewrittenClaims.length < 3) {
      rewrittenClaims.push({
        text: "",
        evidence_ids: [evidenceA?.evidence_id ?? "", evidenceB?.evidence_id ?? ""].filter((value): value is string => Boolean(value))
      });
    }

    rewrittenClaims.forEach((claim, claimIndex) => {
      const phase = phaseByClaimIndex(claimIndex);
      const evidenceForClaimA = evidenceById.get(claim.evidence_ids[0] ?? "") ?? evidenceA;
      const evidenceForClaimB = evidenceById.get(claim.evidence_ids[1] ?? "") ?? evidenceB ?? evidenceForClaimA;

      const mA = metricToken(evidenceForClaimA);
      const mB = metricToken(evidenceForClaimB);
      const sA = sourceHint(evidenceForClaimA, sourceById);

      const rewritten = rewriteClaim(phase, slide, brief, slideIndex + claimIndex, round, mA, mB, sA);
      const normalized = truncateClaimKeepSoWhat(normalizeClaimSoWhat(rewritten, phaseSoWhat(phase)), 168);

      if (claim.text !== normalized) {
        claim.text = normalized;
        stats.rewritten_claims += 1;
      }

      if (claim.evidence_ids.length < brief.constraints.min_evidence_per_claim) {
        const fallbackIds = [evidenceForClaimA?.evidence_id, evidenceForClaimB?.evidence_id].filter(
          (value): value is string => Boolean(value)
        );
        claim.evidence_ids = Array.from(new Set(fallbackIds)).slice(0, 2);
      }
    });

    slide.claims = rewrittenClaims.slice(0, brief.constraints.max_bullets_per_slide);
    slide.source_footer = rebuildSourceFooter(slide.claims, evidenceById, sourceById);
  });
}

function applyRoundFixes(
  spec: SlideSpec,
  brief: BriefNormalized,
  evidenceById: Map<string, ResearchPack["evidences"][number]>,
  sourceById: Map<string, ResearchPack["sources"][number]>,
  issues: QualityIssue[],
  round: number,
  stats: RewriteStats
): string[] {
  const notes: string[] = [];

  for (const issue of issues) {
    const slide = spec.slides[issue.slideIndex];
    if (!slide) {
      continue;
    }

    if (issue.type === "weak_title") {
      const rewritten = buildConsultingTitle(slide, brief);
      if (slide.title !== rewritten) {
        slide.title = rewritten;
        stats.rewritten_titles += 1;
        notes.push(`slide:${slide.id}:title`);
      }
      continue;
    }

    if (issue.type === "weak_governing_message") {
      const metricA = slide.claims[0]?.text.match(/\d+(?:\.\d+)?%?/)?.[0] ?? "핵심 지표";
      const metricB = slide.claims[1]?.text.match(/\d+(?:\.\d+)?%?/)?.[0] ?? metricA;
      const rewritten = fitGoverningMessage(
        `${slide.title}: ${metricA}/${metricB} 근거 기준 ${brief.target_company}${topicParticle(
          brief.target_company
        )} ${DECISION_FOCUS_BY_TYPE[slide.type]} 우선순위를 재정렬해야 한다`,
        brief.constraints.max_governing_message_chars
      );
      if (slide.governing_message !== rewritten) {
        slide.governing_message = rewritten;
        stats.rewritten_governing_messages += 1;
        notes.push(`slide:${slide.id}:gm`);
      }
      continue;
    }

    if (issue.type === "weak_claim") {
      const claim = slide.claims[issue.claimIndex ?? 0];
      if (!claim) {
        continue;
      }

      const phase = phaseByClaimIndex(issue.claimIndex ?? 0);
      const evidenceA = evidenceById.get(claim.evidence_ids[0] ?? "");
      const evidenceB = evidenceById.get(claim.evidence_ids[1] ?? claim.evidence_ids[0] ?? "");
      const metricA = metricToken(evidenceA);
      const metricB = metricToken(evidenceB ?? evidenceA);
      const hint = sourceHint(evidenceA, sourceById);
      claim.text = truncateClaimKeepSoWhat(
        normalizeClaimSoWhat(
          rewriteClaim(phase, slide, brief, issue.slideIndex + (issue.claimIndex ?? 0), round, metricA, metricB, hint),
          phaseSoWhat(phase)
        ),
        168
      );
      stats.rewritten_claims += 1;
      notes.push(`slide:${slide.id}:claim:${issue.claimIndex ?? 0}`);
      continue;
    }

    if (issue.type === "duplicate_claim") {
      const claimIndex = issue.claimIndex ?? 0;
      const claim = slide.claims[claimIndex];
      if (!claim) {
        continue;
      }
      claim.text = truncateClaimKeepSoWhat(repairDuplicateClaim(slide, claimIndex, round), 168);
      stats.duplicate_claim_repairs += 1;
      notes.push(`slide:${slide.id}:duplicate-claim:${claimIndex}`);
      continue;
    }

    if (issue.type === "story_gap") {
      const prevTitle = spec.slides[issue.relatedSlideIndex ?? issue.slideIndex - 1]?.title;
      const bridge = prevTitle
        ? `전장(${prevTitle})의 인사이트를 ${slide.title} 실행 판단으로 연결`
        : "전장 인사이트를 실행 판단으로 연결";
      if (!slide.governing_message.includes("전장(")) {
        slide.governing_message = fitGoverningMessage(
          `${slide.governing_message} | ${bridge}`,
          brief.constraints.max_governing_message_chars
        );
        stats.storyline_bridge_repairs += 1;
        notes.push(`slide:${slide.id}:bridge`);
      }
    }
  }

  return notes;
}

export function runContentQualityGate(
  spec: SlideSpec,
  brief: BriefNormalized,
  research: ResearchPack
): { spec: SlideSpec; report: ContentQualityReport } {
  const working = JSON.parse(JSON.stringify(spec)) as SlideSpec;
  const evidenceById = new Map(research.evidences.map((item) => [item.evidence_id, item]));
  const sourceById = new Map(research.sources.map((item) => [item.source_id, item]));
  const rounds: ContentQualityRound[] = [];
  const stats: RewriteStats = {
    rewritten_titles: 0,
    rewritten_governing_messages: 0,
    rewritten_claims: 0,
    duplicate_claim_repairs: 0,
    storyline_bridge_repairs: 0
  };

  rewriteDeckContent(working, brief, research, 1, stats);

  for (let round = 1; round <= MIN_REVIEW_ROUNDS; round += 1) {
    const issues = analyzeQuality(working, brief);
    const notes = applyRoundFixes(working, brief, evidenceById, sourceById, issues, round, stats);

    working.slides.forEach((slide) => {
      slide.governing_message = fitGoverningMessage(slide.governing_message, brief.constraints.max_governing_message_chars);
      slide.claims = slide.claims
        .slice(0, brief.constraints.max_bullets_per_slide)
        .map((claim, claimIndex) => {
          const phase = phaseByClaimIndex(claimIndex);
          const normalized = normalizeClaimSoWhat(claim.text, phaseSoWhat(phase));
          return {
            ...claim,
            text: truncateClaimKeepSoWhat(normalized, 168)
          };
        });
    });

    rounds.push({
      round,
      issue_count: issues.length,
      issue_types: Array.from(new Set(issues.map((issue) => issue.type))).sort(),
      notes
    });
  }

  const coverage = applyMustIncludeCoverage(working, brief);
  const finalIssues = analyzeQuality(working, brief);

  // MECE 커버리지 검증: 확정된 스펙 기준으로 6축 × 4레버 커버리지 측정
  const meceResult = buildMECEFramework(brief, research, working);

  return {
    spec: working,
    report: {
      rounds,
      final_issue_count: finalIssues.length,
      rewritten_titles: stats.rewritten_titles,
      rewritten_governing_messages: stats.rewritten_governing_messages,
      rewritten_claims: stats.rewritten_claims,
      duplicate_claim_repairs: stats.duplicate_claim_repairs,
      storyline_bridge_repairs: stats.storyline_bridge_repairs,
      must_include_covered: coverage.covered,
      uncovered_must_include: coverage.uncovered,
      mece_coverage_score: meceResult.coverageScore,
      mece_gaps: meceResult.gaps
    }
  };
}
