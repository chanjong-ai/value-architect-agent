import {
  BriefNormalized,
  ExecutionClock,
  PipelineError,
  ResearchPack,
  SlideSpec,
  SlideSpecSlide,
  SlideType,
  SlideVisual
} from "@consulting-ppt/shared";
import { PlannedSlide } from "./narrative-planner";

const AXIS_PRIORITY_BY_SLIDE_TYPE: Record<SlideType, Array<ResearchPack["sources"][number]["axis"]>> = {
  cover: ["market", "finance"],
  "exec-summary": ["finance", "market", "risk"],
  "market-landscape": ["market", "competition", "regulation"],
  benchmark: ["competition", "finance", "technology"],
  "risks-issues": ["risk", "regulation", "finance"],
  roadmap: ["technology", "finance", "risk"],
  appendix: ["market", "competition", "finance", "technology", "regulation", "risk"]
};

type EvidenceItem = ResearchPack["evidences"][number];

interface TableRefs {
  default: string;
  competitionRanking: string;
  targetFinance: string;
  playerCompare: string;
  techBenchmark: string;
  financeCompare: string;
  roadmapExecution: string;
  appendixData: string;
}

interface EvidencePairSelection {
  primaryEvidence: EvidenceItem | null;
  secondaryEvidence: EvidenceItem | null;
  evidenceIds: string[];
}

function lower(value: string): string {
  return value.toLowerCase();
}

function resolveTableRefs(researchPack: ResearchPack): TableRefs {
  const defaultId = researchPack.normalized_tables[0]?.table_id;
  if (!defaultId) {
    throw new PipelineError("research_pack.normalized_tables must include at least one table");
  }

  const findByTitle = (patterns: string[]): string | undefined => {
    const matched = researchPack.normalized_tables.find((table) => {
      const title = lower(table.title);
      return patterns.some((pattern) => title.includes(lower(pattern)));
    });
    return matched?.table_id;
  };

  return {
    default: defaultId,
    competitionRanking: findByTitle(["경쟁", "ranking", "player", "포지셔닝"]) ?? defaultId,
    targetFinance: findByTitle(["재무", "financial", "손익", "실적"]) ?? defaultId,
    playerCompare: findByTitle(["플레이어 비교", "peer", "benchmark", "경쟁사"]) ?? defaultId,
    techBenchmark: findByTitle(["기술", "tech", "product", "로드맵"]) ?? defaultId,
    financeCompare: findByTitle(["재무 성과 비교", "performance", "financial comparison"]) ?? defaultId,
    roadmapExecution: findByTitle(["로드맵", "execution", "액션", "단계"]) ?? defaultId,
    appendixData: findByTitle(["appendix", "부록", "상세", "detail"]) ?? defaultId
  };
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function chooseBySeed<T>(items: T[], seed: number): T {
  if (items.length === 0) {
    throw new PipelineError("chooseBySeed requires at least one item");
  }
  return items[seed % items.length] ?? items[0];
}

function withLayoutHint(visuals: SlideVisual[], layoutHint: string): SlideVisual[] {
  return visuals.map((visual) => ({
    ...visual,
    options: {
      ...(visual.options ?? {}),
      layout_hint: layoutHint
    }
  }));
}

function resolveTableByContext(item: PlannedSlide, tableRefs: TableRefs): string {
  const title = lower(item.title);
  const focus = lower(item.focus);
  const corpus = `${title} ${focus}`;

  if (/재무|손익|현금|capex|수익성|finance/.test(corpus)) {
    return tableRefs.financeCompare || tableRefs.targetFinance || tableRefs.default;
  }
  if (/기술|제품|벤치마크|tech|roadmap/.test(corpus)) {
    return tableRefs.techBenchmark || tableRefs.default;
  }
  if (/경쟁|플레이어|포지셔닝|benchmark|peer|capa/.test(corpus)) {
    return tableRefs.playerCompare || tableRefs.competitionRanking || tableRefs.default;
  }
  if (/로드맵|권고|실행|action|execution/.test(corpus)) {
    return tableRefs.roadmapExecution || tableRefs.default;
  }
  if (/부록|appendix|상세/.test(corpus)) {
    return tableRefs.appendixData || tableRefs.default;
  }

  return tableRefs.default;
}

function visualBySlide(item: PlannedSlide, tableRefs: TableRefs, brief: BriefNormalized): SlideVisual[] {
  const tableRef = resolveTableByContext(item, tableRefs);
  const seed = hashSeed(`${brief.target_company}|${brief.topic}|${item.id}|${item.title}|${item.focus}`);

  if (item.type === "cover") {
    return withLayoutHint([{ kind: "insight-box", options: { priority: 1 } }], "cover-hero");
  }

  if (item.type === "exec-summary") {
    const variant = chooseBySeed<SlideVisual[]>(
      [
        [
          { kind: "kpi-cards", options: { priority: 1 } },
          { kind: "bullets", options: { priority: 2 } }
        ],
        [
          { kind: "kpi-cards", options: { priority: 1 } },
          { kind: "table", data_ref: tableRef, options: { priority: 2 } }
        ],
        [
          { kind: "action-cards", options: { priority: 1 } },
          { kind: "insight-box", options: { priority: 2 } }
        ]
      ],
      seed
    );
    const hint = chooseBySeed(["kpi-dashboard", "top-bottom", "two-column"], seed + 3);
    return withLayoutHint(variant, hint);
  }

  if (item.type === "market-landscape") {
    const variant = chooseBySeed<SlideVisual[]>(
      [
        [
          { kind: "bar-chart", options: { priority: 1 } },
          { kind: "table", data_ref: tableRef, options: { priority: 2 } },
          { kind: "insight-box", options: { priority: 3 } }
        ],
        [
          { kind: "table", data_ref: tableRef, options: { priority: 1 } },
          { kind: "bullets", options: { priority: 2 } }
        ],
        [
          { kind: "bar-chart", options: { priority: 1 } },
          { kind: "icon-list", options: { priority: 2 } }
        ]
      ],
      seed
    );
    const hint = chooseBySeed(["left-focus", "two-column", "top-bottom"], seed + 5);
    return withLayoutHint(variant, hint);
  }

  if (item.type === "benchmark") {
    const variant = chooseBySeed<SlideVisual[]>(
      [
        [
          { kind: "matrix", options: { priority: 1 } },
          { kind: "table", data_ref: tableRef, options: { priority: 2 } }
        ],
        [
          { kind: "table", data_ref: tableRef, options: { priority: 1 } },
          { kind: "icon-list", options: { priority: 2 } }
        ],
        [
          { kind: "matrix", options: { priority: 1 } },
          { kind: "bullets", options: { priority: 2 } }
        ]
      ],
      seed
    );
    const hint = chooseBySeed(["two-column", "left-focus", "quad"], seed + 7);
    return withLayoutHint(variant, hint);
  }

  if (item.type === "risks-issues") {
    const variant = chooseBySeed<SlideVisual[]>(
      [
        [
          { kind: "matrix", options: { priority: 1 } },
          { kind: "table", data_ref: tableRef, options: { priority: 2 } }
        ],
        [
          { kind: "matrix", options: { priority: 1 } },
          { kind: "bullets", options: { priority: 2 } }
        ],
        [
          { kind: "action-cards", options: { priority: 1 } },
          { kind: "table", data_ref: tableRef, options: { priority: 2 } }
        ]
      ],
      seed
    );
    const hint = chooseBySeed(["quad", "top-bottom", "two-column"], seed + 11);
    return withLayoutHint(variant, hint);
  }

  if (item.type === "roadmap") {
    const variant = chooseBySeed<SlideVisual[]>(
      [
        [
          { kind: "timeline", options: { priority: 1 } },
          { kind: "table", data_ref: tableRefs.roadmapExecution, options: { priority: 2 } }
        ],
        [
          { kind: "flow", options: { priority: 1 } },
          { kind: "bullets", options: { priority: 2 } }
        ],
        [
          { kind: "timeline", options: { priority: 1 } },
          { kind: "action-cards", options: { priority: 2 } }
        ]
      ],
      seed
    );
    const hint = chooseBySeed(["timeline", "top-bottom", "left-focus"], seed + 13);
    return withLayoutHint(variant, hint);
  }

  const variant = chooseBySeed<SlideVisual[]>(
    [
      [
        { kind: "table", data_ref: tableRefs.appendixData, options: { priority: 1 } },
        { kind: "bullets", options: { priority: 2 } }
      ],
      [
        { kind: "table", data_ref: tableRef, options: { priority: 1 } },
        { kind: "insight-box", options: { priority: 2 } }
      ]
    ],
    seed
  );
  const hint = chooseBySeed(["single-panel", "two-column"], seed + 17);
  return withLayoutHint(variant, hint);
}

function sanitizeWithAvoidRules(text: string, avoidTerms: string[]): string {
  let sanitized = text;
  for (const term of avoidTerms) {
    if (!term.trim()) {
      continue;
    }
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    sanitized = sanitized.replace(new RegExp(escaped, "gi"), "검증 데이터");
  }
  return sanitized;
}

function collectEvidenceByAxis(researchPack: ResearchPack): Map<string, ResearchPack["evidences"]> {
  const sourceById = new Map(researchPack.sources.map((source) => [source.source_id, source]));
  const grouped = new Map<string, ResearchPack["evidences"]>();

  for (const evidence of researchPack.evidences) {
    const source = sourceById.get(evidence.source_id);
    if (!source) {
      continue;
    }

    const bucket = grouped.get(source.axis) ?? [];
    bucket.push(evidence);
    grouped.set(source.axis, bucket);
  }

  return grouped;
}

function primaryValue(evidence: EvidenceItem): number | null {
  const raw = evidence.numeric_values[0];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }
  return raw;
}

function pairScore(a: EvidenceItem, b: EvidenceItem): number {
  const valueA = primaryValue(a);
  const valueB = primaryValue(b);

  let gapPenalty = 0.2;
  if (valueA !== null && valueB !== null) {
    const denominator = Math.max(Math.min(Math.abs(valueA), Math.abs(valueB)), 1);
    const gap = Math.abs(valueA - valueB) / denominator;
    gapPenalty = Math.min(gap, 4);
  }

  const periodPenalty = a.period && b.period && a.period !== b.period ? 0.2 : 0;
  const unitPenalty = a.unit && b.unit && a.unit !== b.unit ? 0.12 : 0;
  const sourcePenalty = a.source_id === b.source_id ? 0.25 : 0;

  return gapPenalty + periodPenalty + unitPenalty + sourcePenalty;
}

function pickBalancedPair(pool: EvidenceItem[], cursor: number): [EvidenceItem, EvidenceItem] | null {
  if (pool.length < 2) {
    return null;
  }

  const pairs: Array<{ pair: [EvidenceItem, EvidenceItem]; score: number; key: string }> = [];
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      const first = pool[i];
      const second = pool[j];
      const key = `${first.evidence_id}|${second.evidence_id}`;
      pairs.push({
        pair: [first, second],
        score: pairScore(first, second),
        key
      });
    }
  }

  pairs.sort((a, b) => a.score - b.score || a.key.localeCompare(b.key));
  const topRange = Math.min(pairs.length, 3);
  return pairs[cursor % topRange].pair;
}

function findClosestEvidence(base: EvidenceItem, pool: EvidenceItem[]): EvidenceItem | null {
  const candidates = pool.filter((item) => item.evidence_id !== base.evidence_id);
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const score = pairScore(base, a) - pairScore(base, b);
    if (score !== 0) {
      return score;
    }
    return a.evidence_id.localeCompare(b.evidence_id);
  });

  return candidates[0] ?? null;
}

function pickEvidencePair(
  groupedByAxis: Map<string, ResearchPack["evidences"]>,
  preferredAxes: string[],
  cursor: number,
  fallbackPool: EvidenceItem[]
): EvidencePairSelection {
  for (const axis of preferredAxes) {
    const pool = groupedByAxis.get(axis);
    if (!pool || pool.length === 0) {
      continue;
    }

    const balanced = pickBalancedPair(pool, cursor);
    if (balanced) {
      const [primary, secondary] = balanced;
      return {
        primaryEvidence: primary,
        secondaryEvidence: secondary,
        evidenceIds: [primary.evidence_id, secondary.evidence_id]
      };
    }

    const primary = pool[cursor % pool.length] ?? pool[0];
    const secondary = findClosestEvidence(primary, fallbackPool) ?? fallbackPool.find((item) => item.evidence_id !== primary.evidence_id) ?? null;

    if (primary && secondary) {
      return {
        primaryEvidence: primary,
        secondaryEvidence: secondary,
        evidenceIds: [primary.evidence_id, secondary.evidence_id]
      };
    }

    if (primary) {
      return {
        primaryEvidence: primary,
        secondaryEvidence: null,
        evidenceIds: [primary.evidence_id]
      };
    }
  }

  const fallbackPair = pickBalancedPair(fallbackPool, cursor);
  if (fallbackPair) {
    return {
      primaryEvidence: fallbackPair[0],
      secondaryEvidence: fallbackPair[1],
      evidenceIds: [fallbackPair[0].evidence_id, fallbackPair[1].evidence_id]
    };
  }

  const fallbackFirst = fallbackPool[0] ?? null;
  const fallbackSecond = fallbackPool[1] ?? null;

  return {
    primaryEvidence: fallbackFirst,
    secondaryEvidence: fallbackSecond,
    evidenceIds: [fallbackFirst?.evidence_id, fallbackSecond?.evidence_id].filter((value): value is string => Boolean(value))
  };
}

function metricText(evidence: EvidenceItem | null): string {
  if (!evidence) {
    return "핵심지표 미확보";
  }
  const numeric = evidence.numeric_values[0];
  const value = numeric !== undefined ? `${numeric}` : "N/A";
  const unit = evidence.unit ?? "";
  const period = evidence.period ?? "기간";
  return `${value}${unit} (${period})`;
}

function decisionFocusByAudience(audience: BriefNormalized["target_audience"]): string {
  switch (audience) {
    case "CEO":
      return "전사 포트폴리오/투자 우선순위";
    case "CFO":
      return "현금흐름/수익성 우선순위";
    case "COO":
      return "운영/생산성 우선순위";
    case "CIO":
      return "디지털/데이터 우선순위";
    case "CSO":
      return "성장/신사업 우선순위";
    default:
      return "전략 우선순위";
  }
}

function sectionDecisionFocus(section: PlannedSlide["section"]): string {
  switch (section) {
    case "problem":
      return "핵심 문제정의";
    case "insight":
      return "핵심 인사이트";
    case "option":
      return "전략 대안";
    case "recommendation":
      return "권고안";
    case "execution":
      return "실행 체계";
    case "appendix":
      return "근거 검증";
    default:
      return "전략 우선순위";
  }
}

function typeLens(type: PlannedSlide["type"]): string {
  switch (type) {
    case "cover":
      return "보고 범위와 의사결정 질문 정렬";
    case "exec-summary":
      return "핵심 KPI와 실행 과제 압축";
    case "market-landscape":
      return "시장 수요·공급·규제 변화 해석";
    case "benchmark":
      return "플레이어별 포지셔닝·수익성 비교";
    case "risks-issues":
      return "영향도·발생확률 기반 리스크 우선순위";
    case "roadmap":
      return "단계별 실행 로드맵 설계";
    case "appendix":
      return "정량 근거와 계산 가정 검증";
    default:
      return "핵심 전략 검토";
  }
}

function sectionSoWhat(section: PlannedSlide["section"]): string {
  switch (section) {
    case "problem":
      return "문제 정의를 경영진 의사결정 항목으로 전환한다";
    case "insight":
      return "핵심 성과동인을 선택과 집중으로 연결한다";
    case "option":
      return "대안 간 트레이드오프를 수치로 비교한다";
    case "recommendation":
      return "우선순위 의사결정을 신속화한다";
    case "execution":
      return "실행 책임과 일정 관리를 구체화한다";
    case "appendix":
      return "본안 결론의 근거 신뢰도를 보강한다";
    default:
      return "의사결정 품질을 높인다";
  }
}

function phaseLabel(slideIndex: number, totalSlides: number): string {
  if (slideIndex === 0) {
    return "오프닝";
  }
  if (slideIndex <= Math.floor(totalSlides * 0.35)) {
    return "진단 구간";
  }
  if (slideIndex <= Math.floor(totalSlides * 0.7)) {
    return "해석 구간";
  }
  return "실행 구간";
}

const DIAGNOSIS_FRAME_BY_TYPE: Record<PlannedSlide["type"], string[]> = {
  cover: ["보고 범위와 핵심 질문을 단일 의사결정 프레임으로 정렬한다", "경영진이 확인해야 할 핵심 가정을 먼저 정의한다"],
  "exec-summary": ["핵심 KPI와 전략 결론을 압축된 구조로 재배열한다", "수치 기반 핵심 결론을 단일 페이지에서 정렬한다"],
  "market-landscape": ["수요·공급·가격 축의 구조 변화를 수치로 해석한다", "시장 성장과 변동성의 동인을 분해해 제시한다"],
  benchmark: ["플레이어별 포지셔닝과 성과 차이를 비교 프레임으로 구조화한다", "경쟁사 대비 우위/열위 축을 정량적으로 분리한다"],
  "risks-issues": ["영향도와 발생확률 기준으로 리스크 우선순위를 계층화한다", "리스크 항목을 실행 통제 포인트와 연결한다"],
  roadmap: ["단계별 실행 과제를 의존관계 중심으로 배치한다", "로드맵의 우선순위를 자원 투입 순서로 정렬한다"],
  appendix: ["본안 결론을 뒷받침하는 추가 근거를 검증한다", "계산 가정과 데이터 근거를 재확인한다"]
};

const IMPLICATION_FRAME_BY_TYPE: Record<PlannedSlide["type"], string[]> = {
  cover: ["핵심 시사점을 보고 전체의 판단 기준으로 연결한다", "문제 정의와 전략 선택의 연결고리를 명확화한다"],
  "exec-summary": ["핵심 결론의 트레이드오프를 경영 의사결정 언어로 요약한다", "재무성과와 실행 난이도의 균형점을 도출한다"],
  "market-landscape": ["시장 구조 변화가 매출·마진·점유율에 미치는 영향을 분해한다", "수요/공급 불균형이 전략 선택에 주는 함의를 도출한다"],
  benchmark: ["경쟁 포지셔닝 차이가 수익성 경로에 미치는 영향을 해석한다", "동일 KPI 대비 경쟁우위의 지속 가능성을 판정한다"],
  "risks-issues": ["리스크 노출도가 실행 우선순위에 주는 제약을 해석한다", "리스크 대응 비용과 기대효과의 균형점을 제시한다"],
  roadmap: ["실행 단계 간 병목을 해소할 우선 조치를 정리한다", "로드맵 달성 가능성을 KPI와 책임체계로 연결한다"],
  appendix: ["추가 근거가 본안 결론을 얼마나 강화하는지 검토한다", "부록 수치가 본안 메시지와 정합한지 검증한다"]
};

const ACTION_FRAME_BY_TYPE: Record<PlannedSlide["type"], string[]> = {
  cover: ["분석 범위 고정과 의사결정 질문 확정 절차를 즉시 시작한다", "초기 정렬 과제를 통해 실행 착수 리스크를 제거한다"],
  "exec-summary": ["핵심 KPI 오너십과 주간 리뷰 체계를 즉시 가동한다", "핵심 과제별 실행 리더를 지정하고 1차 점검을 시작한다"],
  "market-landscape": ["시장/고객 시그널 모니터링 체계를 단계적으로 구축한다", "수요 변동 대응 계획을 CAPA/원가 계획과 동기화한다"],
  benchmark: ["경쟁사 대비 차별화 과제를 단기 실행 패키지로 전환한다", "경쟁우위 항목별 투자 우선순위를 단계화한다"],
  "risks-issues": ["리스크별 예방·완화·복구 액션을 책임자 중심으로 배치한다", "조기경보 지표와 대응 프로토콜을 병행 설계한다"],
  roadmap: ["로드맵 단계별 게이트와 의사결정 체크포인트를 확정한다", "단계 전환 조건을 KPI와 함께 운영한다"],
  appendix: ["부록 근거를 월간 검증 프로세스로 편입한다", "추가 데이터 업데이트와 검증 일정을 운영 체계에 포함한다"]
};

const ACTION_OWNER_BY_AUDIENCE: Record<BriefNormalized["target_audience"], string> = {
  CEO: "전사 전략 PMO",
  CFO: "재무/투자 기획 조직",
  COO: "운영/공급망 조직",
  CIO: "데이터/디지털 조직",
  CSO: "신사업/전략 조직"
};

function pickFrame(frames: string[], index: number): string {
  if (frames.length === 0) {
    return "핵심 과제를 구조화한다";
  }
  return frames[index % frames.length] ?? frames[0];
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanupSentenceEnd(value: string): string {
  return compact(value).replace(/[.。]+$/g, "");
}

function hasKoreanBatchim(word: string): boolean {
  const trimmed = word.trim();
  if (!trimmed) {
    return false;
  }
  const lastChar = trimmed.charCodeAt(trimmed.length - 1);
  if (lastChar < 0xac00 || lastChar > 0xd7a3) {
    return false;
  }
  return (lastChar - 0xac00) % 28 !== 0;
}

function topicParticle(word: string): "은" | "는" {
  return hasKoreanBatchim(word) ? "은" : "는";
}

function andParticle(word: string): "과" | "와" {
  return hasKoreanBatchim(word) ? "과" : "와";
}

function safeEvidenceHint(evidence: EvidenceItem | null): string {
  if (!evidence?.claim_text) {
    return "핵심 근거";
  }
  const normalized = compact(evidence.claim_text).replace(/[()]/g, "").replace(/[;,]+/g, " ");
  if (normalized.length <= 30) {
    return normalized;
  }
  return `${normalized.slice(0, 27)}...`;
}

function normalizeClaimSoWhat(text: string, fallbackSoWhat: string): string {
  const normalized = compact(text);
  if (!normalized) {
    return `(So What: ${fallbackSoWhat})`;
  }

  const matches = Array.from(normalized.matchAll(/\(?\s*So What:\s*([^)]+)\)?/gi));
  const soWhat = cleanupSentenceEnd(matches[0]?.[1] ?? fallbackSoWhat);

  const body = cleanupSentenceEnd(normalized.replace(/\(?\s*So What:\s*([^)]+)\)?/gi, ""));
  return `${body} (So What: ${soWhat})`;
}

function competitorLens(brief: BriefNormalized, slideIndex: number): string {
  if (brief.competitors.length === 0) {
    return "주요 경쟁사";
  }
  if (brief.competitors.length === 1) {
    return brief.competitors[0];
  }

  const first = brief.competitors[slideIndex % brief.competitors.length];
  const second = brief.competitors[(slideIndex + 1) % brief.competitors.length];
  return first === second ? first : `${first}/${second}`;
}

function sectionBridge(section: PlannedSlide["section"]): string {
  switch (section) {
    case "problem":
      return "문제 정의에서 전략 질문으로 전환";
    case "insight":
      return "핵심 인사이트에서 실행 과제로 연결";
    case "option":
      return "대안 비교 결과를 선택 기준으로 정렬";
    case "recommendation":
      return "권고안을 우선순위와 투자안으로 구체화";
    case "execution":
      return "실행 계획을 KPI/오너십과 결합";
    case "appendix":
      return "근거 검증 결과를 본안 판단에 반영";
    default:
      return "핵심 판단 기준을 정렬";
  }
}

function summarizeFocus(value: string, maxChars = 66): string {
  const compacted = cleanupSentenceEnd(value);
  if (compacted.length <= maxChars) {
    return compacted;
  }
  return `${compacted.slice(0, Math.max(12, maxChars - 3)).trim()}...`;
}

function decisionAxisByType(type: PlannedSlide["type"]): string {
  switch (type) {
    case "cover":
      return "핵심 질문 정렬";
    case "exec-summary":
      return "핵심 KPI/우선과제";
    case "market-landscape":
      return "시장 변화 해석";
    case "benchmark":
      return "경쟁 포지셔닝 비교";
    case "risks-issues":
      return "리스크 우선순위";
    case "roadmap":
      return "단계별 실행체계";
    case "appendix":
      return "근거 검증";
    default:
      return "전략 의사결정";
  }
}

function actionMilestones(item: PlannedSlide): [string, string, string] {
  const titleCore = cleanupSentenceEnd(item.title);
  switch (item.type) {
    case "market-landscape":
      return [`${titleCore} 수급 가설 검증`, "세그먼트별 고객/제품 포트폴리오 재배치", "장기 CAPA/가격 시나리오 연동"];
    case "benchmark":
      return [`${titleCore} 차별화 포인트 확정`, "수익성 개선 프로그램 실행", "전략 파트너십/신규 고객 확장"];
    case "risks-issues":
      return [`${titleCore} 조기경보 체계 구축`, "고위험 항목 완화 액션 집행", "복구 시나리오 정례 점검"];
    case "roadmap":
      return [`${titleCore} 실행 게이트 확정`, "중기 확장과 투자 집행", "장기 체질 전환 및 스케일업"];
    case "appendix":
      return [`${titleCore} 근거 검증`, "가정/지표 업데이트", "정책/시장 변화 반영"];
    case "exec-summary":
      return [`${titleCore} 핵심 KPI 확정`, "핵심 과제 실행 및 성과 점검", "확장 과제 투자 의사결정"];
    case "cover":
      return [`${titleCore} 핵심 질문 정렬`, "우선 과제 후보 구체화", "전사 실행 아젠다 확정"];
    default:
      return [`${titleCore} 초기 안정화`, "중기 성과 개선", "장기 구조 고도화"];
  }
}

function metricToken(evidence: EvidenceItem | null): string {
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

function governingDecisionPhrase(section: PlannedSlide["section"], type: PlannedSlide["type"]): string {
  if (section === "problem") {
    return "핵심 시장·고객 우선순위";
  }
  if (section === "insight") {
    return "성장·수익성 전환 과제";
  }
  if (section === "option") {
    return "대안별 투자 배분";
  }
  if (section === "recommendation") {
    return "핵심 권고안";
  }
  if (section === "execution") {
    if (type === "roadmap") {
      return "실행 게이트와 KPI";
    }
    return "실행 우선순위";
  }
  return "근거 검증 항목";
}

function buildGoverningMessage(
  item: PlannedSlide,
  brief: BriefNormalized,
  primaryEvidence: EvidenceItem | null,
  secondaryEvidence: EvidenceItem | null,
  slideIndex: number,
  totalSlides: number
): string {
  const focus = decisionFocusByAudience(brief.target_audience).replace(" 우선순위", "");
  const sectionFocus = sectionDecisionFocus(item.section);
  const decisionPhrase = governingDecisionPhrase(item.section, item.type);
  const metric = `${metricToken(primaryEvidence)}·${metricToken(secondaryEvidence)}`;
  const target = `${brief.target_company}${topicParticle(brief.target_company)}`;
  const phase = phaseLabel(slideIndex, totalSlides).replace(" 구간", "");
  const axis = decisionAxisByType(item.type);
  const uniquenessAnchor = item.section === "appendix" ? ` [${item.id}]` : "";

  // Phase 1: Executive Summary는 SCQA Answer를 포함하는 특별 거버닝 메시지
  if (item.type === "exec-summary") {
    return `[핵심결론] ${metric} 근거: ${target} ${brief.topic} 대응에서 ${focus}/${decisionPhrase}이 ${phase}에 가장 중요하며, 권고안 3가지가 즉시 실행되어야 한다`;
  }

  return `${item.title}${uniquenessAnchor}: ${metric} 기준 ${target} ${focus} 관점의 ${sectionFocus}/${decisionPhrase} 항목을 ${axis} 기준으로 ${phase}에 확정해야 한다`;
}

function buildClaim(
  mode: "diagnosis" | "implication" | "action",
  item: PlannedSlide,
  brief: BriefNormalized,
  metricA: string,
  metricB: string,
  includeKeyword: string | undefined,
  avoidTerms: string[],
  primaryEvidence: EvidenceItem | null,
  secondaryEvidence: EvidenceItem | null,
  slideIndex: number,
  totalSlides: number
): string {
  const includeText = includeKeyword ? `${includeKeyword} 축` : "핵심 과제 축";
  const stageSoWhat = sectionSoWhat(item.section);
  const phase = phaseLabel(slideIndex, totalSlides).replace(" 구간", "");
  const evidenceHintA = safeEvidenceHint(primaryEvidence);
  const evidenceHintB = safeEvidenceHint(secondaryEvidence);
  const competitorHint = competitorLens(brief, slideIndex);
  const diagnosisFrame = pickFrame(DIAGNOSIS_FRAME_BY_TYPE[item.type], slideIndex).replace(/[.。]+$/g, "");
  const implicationFrame = pickFrame(IMPLICATION_FRAME_BY_TYPE[item.type], slideIndex + 1);
  const actionFrame = pickFrame(ACTION_FRAME_BY_TYPE[item.type], slideIndex + 2);
  const owner = ACTION_OWNER_BY_AUDIENCE[brief.target_audience];
  const [m1, m2, m3] = actionMilestones(item);
  const focusSummary = summarizeFocus(item.focus, 56);
  const titleCore = cleanupSentenceEnd(item.title);
  const targetAnd = `${brief.target_company}${andParticle(brief.target_company)}`;

  let raw = "";

  // Phase 1+4: Executive Summary 전용 클레임 — Problem Statement + Key Findings + Recommendations + Impact
  // 맥킨지 표준: 가장 많은 시간이 투입되는 단일 슬라이드의 4요소 구조화
  if (item.type === "exec-summary") {
    if (mode === "diagnosis") {
      // Problem Statement: 왜 이 보고서가 필요한가
      raw = `[Problem] ${brief.target_company}는 ${brief.topic} 맥락에서 ${metricA} 수준의 ${includeText} 구조적 도전에 직면했다. ${diagnosisFrame}에 따르면 현재 전략 방향을 유지할 경우 ${targetAnd} 경쟁 포지셔닝이 지속 약화될 위험이 있다 (So What: 지금 행동하지 않으면 중기 수익성이 위협받는다)`;
    } else if (mode === "implication") {
      // Key Findings: 핵심 발견 사항 (수치 포함)
      raw = `[Key Finding] ${metricA}/${metricB} 분석 결과: (1) ${brief.industry} 구조 변화가 ${evidenceHintA} 기준으로 확인됨, (2) ${targetAnd} ${competitorHint} 대비 격차가 ${metricB}로 측정됨, (3) ${implicationFrame}에 따른 전략 전환이 시급함 (So What: 3가지 핵심 근거가 권고안의 긴급성을 뒷받침한다)`;
    } else {
      // Recommendations + Expected Impact: 실행 권고안 + 기대 효과
      raw = `[Recommendation] ${owner}가 주도: [What: ${m1}] [Who: ${owner}] [When: ${phase} 내 의사결정→실행] [HowMuch: ${metricA} KPI 기준 목표 달성]. 기대 효과: ${evidenceHintA}/${evidenceHintB} 근거로 ${targetAnd} ${brief.topic} 포지션 강화 및 수익성 개선 (So What: 3가지 권고안이 즉시 실행되어야 한다)`;
    }
  } else if (mode === "diagnosis") {
    raw = `진단: ${metricA} 대비 ${metricB} 변동을 보면 ${titleCore}에서 ${includeText} 병목이 확인된다. ${diagnosisFrame} 관점에서 ${focusSummary}를 우선 검증해야 한다 (So What: ${stageSoWhat})`;
  } else if (mode === "implication") {
    raw = `해석: ${targetAnd} ${competitorHint} 비교 시 ${metricA}/${metricB} 격차가 확인된다. ${implicationFrame}에 따라 ${titleCore}의 투자·고객 선택 기준을 재정의해야 한다 (So What: 대안별 수익성/리스크 트레이드오프를 명확화한다)`;
  } else if (mode === "action") {
    // Phase 4: Recommendation Spec 강화 — What/Who/When/How Much 4요소 명시
    if (item.type === "roadmap") {
      const whatAction = m1.replace(/^.*?: /, "");
      raw = `실행[What: ${whatAction}·${m2}·${m3}] [Who: ${owner}] [When: 0-6개월→6-18개월→18-36개월] [HowMuch: KPI(${metricA}, ${metricB}) 기준 투자 규모 확정]. ${owner}가 ${phase} 기준으로 분기별 게이트 점검하고 ${evidenceHintA}/${evidenceHintB} 근거로 실행 결정을 운영한다. ${actionFrame} (So What: 실행 책임·타임라인·ROI가 명확해져 의사결정 속도를 높인다)`;
    } else {
      raw = `실행: 0-6개월(${m1}), 6-18개월(${m2}), 18-36개월(${m3}) 단계로 추진한다. ${owner}가 KPI(${metricA}, ${metricB})를 ${phase} 기준으로 점검하고 ${evidenceHintA}/${evidenceHintB} 근거로 실행 게이트를 운영한다. ${actionFrame} (So What: 실행 속도와 성과 가시성을 동시에 높인다)`;
    }
  }

  const sanitized = sanitizeWithAvoidRules(raw, avoidTerms);
  return normalizeClaimSoWhat(sanitized, stageSoWhat);
}

function ensureTwoEvidenceIds(primary: string[], secondary: string[]): string[] {
  const merged = Array.from(new Set([...primary, ...secondary]));
  if (merged.length >= 2) {
    return merged.slice(0, 2);
  }
  if (merged.length === 1) {
    return [merged[0], merged[0]];
  }
  return [];
}

function buildSourceFooter(
  evidenceIds: string[],
  sourceById: Map<string, ResearchPack["sources"][number]>,
  evidenceById: Map<string, ResearchPack["evidences"][number]>
): string[] {
  const sourceFooter = new Set<string>();

  for (const evidenceId of evidenceIds) {
    const evidence = evidenceById.get(evidenceId);
    const source = evidence ? sourceById.get(evidence.source_id) : undefined;
    if (!source) {
      continue;
    }
    sourceFooter.add(`${source.publisher} (${source.date})`);
  }

  return Array.from(sourceFooter);
}

export function buildSlideSpec(
  brief: BriefNormalized,
  researchPack: ResearchPack,
  plan: PlannedSlide[],
  runId: string,
  clock: ExecutionClock
): SlideSpec {
  const tableRefs = resolveTableRefs(researchPack);

  const evidenceById = new Map(researchPack.evidences.map((item) => [item.evidence_id, item]));
  const sourceById = new Map(researchPack.sources.map((item) => [item.source_id, item]));
  const groupedEvidence = collectEvidenceByAxis(researchPack);
  const fallbackEvidence = [...researchPack.evidences].sort((a, b) => a.evidence_id.localeCompare(b.evidence_id));

  const mustIncludeQueue = [...brief.must_include];
  const totalSlides = plan.length;

  const slides = plan.map((item, index): SlideSpecSlide => {
    const preferredAxes = AXIS_PRIORITY_BY_SLIDE_TYPE[item.type] ?? ["market", "finance"];

    const firstPair = pickEvidencePair(groupedEvidence, preferredAxes, index * 3, fallbackEvidence);
    const secondPair = pickEvidencePair(groupedEvidence, preferredAxes, index * 3 + 1, fallbackEvidence);

    const firstEvidenceIds = ensureTwoEvidenceIds(firstPair.evidenceIds, fallbackEvidence.map((item) => item.evidence_id));
    const secondEvidenceIds = ensureTwoEvidenceIds(secondPair.evidenceIds, firstEvidenceIds);
    const actionEvidenceIds = ensureTwoEvidenceIds(firstEvidenceIds, secondEvidenceIds);

    const includeForFirst = mustIncludeQueue.shift();

    const metricA = metricText(firstPair.primaryEvidence);
    const metricB = metricText(firstPair.secondaryEvidence ?? secondPair.primaryEvidence);
    const metricC = metricText(secondPair.primaryEvidence);
    const metricD = metricText(secondPair.secondaryEvidence ?? firstPair.primaryEvidence);

    const claims = [
      {
        text: buildClaim(
          "diagnosis",
          item,
          brief,
          metricA,
          metricB,
          includeForFirst,
          brief.must_avoid,
          firstPair.primaryEvidence,
          firstPair.secondaryEvidence ?? secondPair.primaryEvidence,
          index,
          totalSlides
        ),
        evidence_ids: firstEvidenceIds
      },
      {
        text: buildClaim(
          "implication",
          item,
          brief,
          metricC,
          metricD,
          undefined,
          brief.must_avoid,
          secondPair.primaryEvidence,
          secondPair.secondaryEvidence ?? firstPair.primaryEvidence,
          index,
          totalSlides
        ),
        evidence_ids: secondEvidenceIds
      },
      {
        text: buildClaim(
          "action",
          item,
          brief,
          metricA,
          metricD,
          undefined,
          brief.must_avoid,
          firstPair.primaryEvidence,
          secondPair.primaryEvidence,
          index,
          totalSlides
        ),
        evidence_ids: actionEvidenceIds
      }
    ];

    const allEvidenceIds = claims.flatMap((claim) => claim.evidence_ids);

    return {
      id: item.id,
      type: item.type,
      title: sanitizeWithAvoidRules(item.title, brief.must_avoid),
      governing_message: sanitizeWithAvoidRules(
        buildGoverningMessage(item, brief, firstPair.primaryEvidence, secondPair.primaryEvidence, index, totalSlides),
        brief.must_avoid
      ),
      claims,
      visuals: visualBySlide(item, tableRefs, brief),
      source_footer: buildSourceFooter(allEvidenceIds, sourceById, evidenceById)
    };
  });

  return {
    meta: {
      project_id: brief.project_id,
      run_id: runId,
      locale: brief.language,
      aspect_ratio: "LAYOUT_16x9",
      theme: "consulting_kr_blue",
      created_at: clock.nowIso
    },
    slides
  };
}
