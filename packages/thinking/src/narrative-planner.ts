import { BriefNormalized, ResearchPack, SlideType, Source } from "@consulting-ppt/shared";

// SCQA 프레임워크: 맥킨지 보고서의 핵심 내러티브 구조
export interface SCQAFramework {
  // Situation: 청중이 동의할 수 있는 객관적 사실
  situation: string;
  // Complication: 왜 지금 행동해야 하는지 — 긴박감과 변화의 필요성
  complication: string;
  // Question: Complication에서 자연스럽게 도출되는 핵심 질문
  question: string;
  // Answer: 보고서 전체의 결론 — Executive Summary의 핵심
  answer: string;
}

export interface PlannedSlide {
  id: string;
  type: SlideType;
  title: string;
  focus: string;
  section: "problem" | "insight" | "option" | "recommendation" | "execution" | "appendix";
  // SCQA 매핑: 각 슬라이드가 SCQA의 어느 요소를 지원하는지
  scqaRole: "situation" | "complication" | "question" | "answer_support" | "appendix";
}

interface AxisStat {
  axis: Source["axis"];
  sourceCount: number;
  evidenceCount: number;
  averageReliability: number;
  volatility: number;
  keywordBoost: number;
  score: number;
}

const BASE_STORY: Array<Omit<PlannedSlide, "id">> = [
  {
    type: "cover",
    title: "시장 종합 분석",
    focus: "분석 범위와 보고 목적을 경영진 의사결정 관점으로 정렬한다",
    section: "problem",
    scqaRole: "situation"
  },
  {
    type: "exec-summary",
    title: "Executive Summary",
    focus: "SCQA 기반 핵심 수치·결론·권고안을 단일 페이지에서 압축 제시한다",
    section: "insight",
    scqaRole: "answer_support"
  },
  {
    type: "market-landscape",
    title: "시장 개요",
    focus: "시장 규모·성장률·세그먼트 구조 변화를 정량으로 설명한다 — Situation 근거 확립",
    section: "problem",
    scqaRole: "situation"
  },
  {
    type: "benchmark",
    title: "경쟁 환경",
    focus: "주요 플레이어 포지셔닝과 경쟁구도 변화를 비교한다 — Complication 심화",
    section: "insight",
    scqaRole: "complication"
  },
  {
    type: "benchmark",
    title: "플레이어 심층 분석",
    focus: "타깃 기업의 재무·전략·포트폴리오를 심층 진단한다 — Complication 구체화",
    section: "insight",
    scqaRole: "complication"
  },
  {
    type: "benchmark",
    title: "플레이어 비교 매트릭스",
    focus: "핵심 경쟁사 간 전략·제품·고객·리스크를 동일 프레임으로 정렬한다 — Question 설정",
    section: "option",
    scqaRole: "question"
  },
  {
    type: "market-landscape",
    title: "기술/제품 벤치마킹",
    focus: "기술 성능과 제품 로드맵을 비교해 차별화 축을 정의한다 — Answer 근거",
    section: "option",
    scqaRole: "answer_support"
  },
  {
    type: "market-landscape",
    title: "밸류체인 분석",
    focus: "원료-전구체-소재-고객 밸류체인에서 경쟁 우위를 진단한다 — Answer 근거",
    section: "option",
    scqaRole: "answer_support"
  },
  {
    type: "benchmark",
    title: "재무 성과 비교",
    focus: "주요 기업의 실적·수익성·CAPA를 비교해 성과 격차를 해석한다 — Answer 근거",
    section: "recommendation",
    scqaRole: "answer_support"
  },
  {
    type: "exec-summary",
    title: "트렌드 & 기회",
    focus: "시장 메가트렌드와 사업 기회를 전략 우선순위로 변환한다 — Answer 종합",
    section: "recommendation",
    scqaRole: "answer_support"
  },
  {
    type: "risks-issues",
    title: "리스크 분석",
    focus: "발생확률-영향도 기준으로 핵심 리스크와 대응 우선순위를 명확화한다 — Complication 보완",
    section: "execution",
    scqaRole: "complication"
  },
  {
    type: "roadmap",
    title: "전략적 시사점",
    focus: "시장·기업·기술 관점의 So What을 경영 의사결정 언어로 정리한다 — Answer 핵심",
    section: "execution",
    scqaRole: "answer_support"
  },
  {
    type: "roadmap",
    title: "권고안 (전략 로드맵)",
    focus: "What/Who/When/How Much 기준 단기·중기·장기 실행 계획과 우선 액션을 구체화한다 — Answer 실행",
    section: "execution",
    scqaRole: "answer_support"
  }
];

const AXIS_ORDER: Array<Source["axis"]> = ["market", "competition", "finance", "technology", "regulation", "risk"];

const AXIS_LABEL: Record<Source["axis"], string> = {
  market: "시장 수요/세그먼트",
  competition: "경쟁 포지셔닝",
  finance: "재무/현금흐름",
  technology: "기술/제품 로드맵",
  regulation: "규제/통상 대응",
  risk: "리스크/변동성"
};

const AXIS_KEYWORDS: Record<Source["axis"], string[]> = {
  market: ["시장", "수요", "고객", "점유율", "성장"],
  competition: ["경쟁", "포지셔닝", "플레이어", "비교", "benchmark"],
  finance: ["재무", "수익", "마진", "현금", "투자", "capex"],
  technology: ["기술", "제품", "특허", "r&d", "로드맵", "공정"],
  regulation: ["규제", "정책", "ira", "cbam", "esg", "탄소"],
  risk: ["리스크", "변동성", "불확실", "원자재", "공급망"]
};

function tokenizeLower(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function axisKeywordBoost(brief: BriefNormalized, axis: Source["axis"]): number {
  const corpus = tokenizeLower(`${brief.topic} ${brief.industry} ${brief.must_include.join(" ")}`);
  let hit = 0;
  for (const keyword of AXIS_KEYWORDS[axis]) {
    if (corpus.includes(tokenizeLower(keyword))) {
      hit += 1;
    }
  }
  return Math.min(1.2, hit * 0.25);
}

function axisStats(brief: BriefNormalized, researchPack: ResearchPack): AxisStat[] {
  const sourceByAxis = new Map<Source["axis"], Source[]>();
  for (const axis of AXIS_ORDER) {
    sourceByAxis.set(axis, []);
  }
  for (const source of researchPack.sources) {
    const bucket = sourceByAxis.get(source.axis) ?? [];
    bucket.push(source);
    sourceByAxis.set(source.axis, bucket);
  }

  const sourceById = new Map(researchPack.sources.map((source) => [source.source_id, source]));
  const evidenceByAxis = new Map<Source["axis"], ResearchPack["evidences"]>();
  for (const axis of AXIS_ORDER) {
    evidenceByAxis.set(axis, []);
  }
  for (const evidence of researchPack.evidences) {
    const source = sourceById.get(evidence.source_id);
    if (!source) {
      continue;
    }
    const bucket = evidenceByAxis.get(source.axis) ?? [];
    bucket.push(evidence);
    evidenceByAxis.set(source.axis, bucket);
  }

  return AXIS_ORDER.map((axis) => {
    const axisSources = sourceByAxis.get(axis) ?? [];
    const axisEvidences = evidenceByAxis.get(axis) ?? [];
    const values = axisEvidences.flatMap((evidence) => evidence.numeric_values).filter((value) => Number.isFinite(value));
    const max = values.length > 0 ? Math.max(...values) : 0;
    const min = values.length > 0 ? Math.min(...values) : 0;
    const denominator = Math.max(1, Math.abs(min));
    const volatility = values.length >= 2 ? Math.min(1.8, Math.abs(max - min) / denominator) : 0;
    const reliability =
      axisSources.length > 0
        ? axisSources.reduce((sum, source) => sum + source.reliability_score, 0) / axisSources.length
        : 0;
    const keywordBoost = axisKeywordBoost(brief, axis);

    return {
      axis,
      sourceCount: axisSources.length,
      evidenceCount: axisEvidences.length,
      averageReliability: Number(reliability.toFixed(3)),
      volatility: Number(volatility.toFixed(3)),
      keywordBoost,
      score: Number(
        (
          axisSources.length * 0.7 +
          axisEvidences.length * 0.5 +
          reliability * 2.5 +
          volatility * 1.7 +
          keywordBoost
        ).toFixed(3)
      )
    };
  }).sort((a, b) => b.score - a.score || a.axis.localeCompare(b.axis));
}

function choosePriorityAxes(
  brief: BriefNormalized,
  researchPack: ResearchPack
): [Source["axis"], Source["axis"], Source["axis"]] {
  const ranked = axisStats(brief, researchPack);
  const fallback: Array<Source["axis"]> = ["market", "finance", "competition"];

  const picked: Source["axis"][] = [];
  for (const stat of ranked) {
    if (!picked.includes(stat.axis)) {
      picked.push(stat.axis);
    }
    if (picked.length === 3) {
      break;
    }
  }

  for (const axis of fallback) {
    if (!picked.includes(axis)) {
      picked.push(axis);
    }
    if (picked.length === 3) {
      break;
    }
  }

  return [picked[0], picked[1], picked[2]];
}

function trendTitle(primary: Source["axis"], secondary: Source["axis"]): string {
  if (primary === "risk" || secondary === "risk" || primary === "regulation" || secondary === "regulation") {
    return "리스크·규제 트렌드 & 기회";
  }
  if (primary === "finance" || secondary === "finance") {
    return "재무·시장 트렌드 & 기회";
  }
  if (primary === "technology" || secondary === "technology") {
    return "기술·제품 트렌드 & 기회";
  }
  return "트렌드 & 기회";
}

/**
 * SCQA 프레임워크 생성
 * 맥킨지 보고서의 최우선 설계 단계: 전체 내러티브의 뿌리
 */
export function buildSCQA(brief: BriefNormalized, researchPack: ResearchPack): SCQAFramework {
  const industryLabel = brief.industry.includes("시장") ? brief.industry : `${brief.industry} 시장`;
  const targetCompany = brief.target_company;
  const [primaryAxis] = choosePriorityAxes(brief, researchPack);

  // 고신뢰도 evidence에서 핵심 수치 추출
  const topSources = researchPack.sources
    .filter((source) => source.reliability_score >= 0.7)
    .sort((a, b) => b.reliability_score - a.reliability_score)
    .slice(0, 3);

  const topEvidences = researchPack.evidences
    .filter((evidence) => topSources.some((source) => source.source_id === evidence.source_id))
    .filter((evidence) => evidence.numeric_values.length > 0)
    .slice(0, 4);

  const primaryMetric = topEvidences[0]
    ? `${topEvidences[0].numeric_values[0]}${topEvidences[0].unit ?? ""}`
    : "핵심 지표";
  const secondaryMetric = topEvidences[1]
    ? `${topEvidences[1].numeric_values[0]}${topEvidences[1].unit ?? ""}`
    : "보조 지표";

  const situation = `${industryLabel}은 ${primaryMetric} 수준으로 ${AXIS_LABEL[primaryAxis]} 변화가 진행 중이며, ${targetCompany}${topicParticle(targetCompany)} 이 구조적 변화 속에 있다`;

  const complication = `그러나 ${secondaryMetric} 기준 경쟁 압력이 심화되고 있어, 현재 전략 방향으로는 ${targetCompany}의 지속 성장이 위협받고 있다`;

  const question = `그렇다면 ${targetCompany}${topicParticle(targetCompany)} ${brief.topic} 맥락에서 어떤 전략적 선택을 해야 경쟁 우위를 유지하고 수익성을 회복할 수 있는가?`;

  const answer = `${AXIS_LABEL[primaryAxis]} 중심의 포트폴리오 재편과 실행 가능한 단계별 로드맵을 통해 ${targetCompany}${topicParticle(targetCompany)} ${brief.target_audience} 관점의 의사결정을 구체화해야 한다`;

  return { situation, complication, question, answer };
}

function topicParticle(word: string): "은" | "는" {
  const trimmed = word.trim();
  if (!trimmed) return "은";
  const lastChar = trimmed.charCodeAt(trimmed.length - 1);
  if (lastChar < 0xac00 || lastChar > 0xd7a3) return "은";
  return (lastChar - 0xac00) % 28 !== 0 ? "은" : "는";
}

/**
 * Action Title 검증: Passive Title 탐지
 * "~현황", "~분석", "~개요" 등 명사형 종결 타이틀을 탐지
 */
export function isPassiveTitle(title: string): boolean {
  return /^(.*)(현황|개요|분석|검토|소개|정리|요약|개관|현황분석|현황파악)$/.test(title.trim());
}

/**
 * Action Title 구체성 점수 계산 (0-100)
 * 맥킨지 기준: 수치, 시간범위, 주체, 행동/결론 중 3개 이상 포함
 */
export function calcTitleSpecificityScore(title: string): number {
  let score = 0;
  // (a) 수치 포함
  if (/\d/.test(title)) score += 25;
  // (b) 시간 범위 포함
  if (/(\d{2,4}년|\d+[분기월주년]|Q\d|단기|중기|장기)/.test(title)) score += 25;
  // (c) 주체 포함 (기업명, 업계명 등 — 주어 역할)
  if (/(주요|핵심|경쟁사|플레이어|시장|고객|파트너|업체)/.test(title)) score += 25;
  // (d) 행동/결론 포함 (동사형 종결)
  if (/(필요|해야|전환|재편|확대|축소|강화|구축|달성|견인|확보|투자|추진|집중|주도|압박|위협|기회|전략|결정|선택)/.test(title)) score += 25;
  return score;
}

/**
 * Horizontal Flow 검증: Action Title 시퀀스가 하나의 완결된 논증을 형성하는지
 */
export function validateHorizontalFlow(slides: PlannedSlide[]): {
  titleSequence: string[];
  logicalGaps: Array<{ from: number; to: number; issue: string }>;
  coherenceScore: number;
} {
  const titleSequence = slides.map((slide) => slide.title);
  const logicalGaps: Array<{ from: number; to: number; issue: string }> = [];

  // SCQA 역할 전환 체크: situation → complication → question → answer_support 순서 확인
  const scqaRoles = slides.map((slide) => slide.scqaRole);
  let situationSeen = false;
  let complicationSeen = false;

  for (let i = 1; i < scqaRoles.length; i++) {
    const prev = scqaRoles[i - 1];
    const current = scqaRoles[i];
    if (prev === undefined || current === undefined) continue;

    if (current === "situation") situationSeen = true;
    if (current === "complication") complicationSeen = true;

    // answer_support가 complication보다 앞에 나오면 논리적 비약
    if (current === "answer_support" && !complicationSeen && !situationSeen) {
      logicalGaps.push({ from: i - 1, to: i, issue: `Answer before Situation/Complication: "${titleSequence[i]}"` });
    }
  }

  // 타이틀만 읽었을 때 연속성 점수 (단순 토큰 겹침 기반)
  let totalSimilarity = 0;
  for (let i = 1; i < titleSequence.length; i++) {
    const prevTokens = new Set((titleSequence[i - 1] ?? "").split(/[\s:·]+/).filter((t) => t.length >= 2));
    const currTokens = new Set((titleSequence[i] ?? "").split(/[\s:·]+/).filter((t) => t.length >= 2));
    let shared = 0;
    for (const t of prevTokens) {
      if (currTokens.has(t)) shared++;
    }
    const union = prevTokens.size + currTokens.size - shared;
    totalSimilarity += union > 0 ? shared / union : 0;
  }

  const avgSimilarity = titleSequence.length > 1 ? totalSimilarity / (titleSequence.length - 1) : 1;
  // 0~0.5 범위를 0~100으로 매핑 (너무 높으면 중복, 너무 낮으면 단절)
  const coherenceScore = Math.min(100, Math.round(avgSimilarity * 200));

  return { titleSequence, logicalGaps, coherenceScore };
}

export function planNarrative(brief: BriefNormalized, researchPack: ResearchPack): PlannedSlide[] {
  // Phase 1: SCQA 프레임워크를 최우선으로 확정 (맥킨지 방법론의 핵심)
  const scqa = buildSCQA(brief, researchPack);

  const slides = [...BASE_STORY];
  const industryLabel = brief.industry.includes("시장") ? brief.industry : `${brief.industry} 시장`;
  const targetCompany = brief.target_company;
  const competitorSummary = brief.competitors.length > 0 ? brief.competitors.join(", ") : "주요 경쟁사";
  const [primaryAxis, secondaryAxis, tertiaryAxis] = choosePriorityAxes(brief, researchPack);

  // Cover: Situation을 반영한 보고 범위 설정
  slides[0] = {
    ...slides[0],
    title: `${industryLabel} 전략 방향성 진단`,
    focus: `[Situation] ${brief.topic} 이슈를 ${brief.target_audience} 의사결정 프레임으로 구조화 — ${scqa.situation.slice(0, 60)}... — 리서치 우선축(${AXIS_LABEL[primaryAxis]}, ${AXIS_LABEL[secondaryAxis]})을 명확화한다`
  };

  // Executive Summary: SCQA Answer를 가장 먼저 제시 (맥킨지 표준)
  slides[1] = {
    ...slides[1],
    title: `핵심 결론: ${targetCompany} 전환 아젠다`,
    focus: `[Answer] ${scqa.answer} — ${AXIS_LABEL[primaryAxis]}·${AXIS_LABEL[secondaryAxis]} 근거 기반 핵심 수치·권고안·기대효과를 단일 페이지에서 압축 제시한다`
  };

  // Market Landscape: Situation 근거 확립
  slides[2] = {
    ...slides[2],
    title: "시장 진단: 수요·성장·지역 재편",
    focus: `[Situation] ${industryLabel}에서 ${AXIS_LABEL[primaryAxis]} 변화를 정량 검증하고 스토리라인의 문제정의 구간으로 연결한다`
  };

  // Competition: Complication 심화
  slides[3] = {
    ...slides[3],
    title: "경쟁 구도: 점유율·CAPA 재편",
    focus: `[Complication] ${industryLabel}에서 ${targetCompany}와 주요 플레이어의 포지셔닝 변화를 ${AXIS_LABEL[secondaryAxis]} 관점으로 비교한다`
  };

  // Target company deep-dive: Complication 구체화
  slides[4] = {
    ...slides[4],
    title: `${targetCompany} 포지셔닝: 우위·열위`,
    focus: `[Complication] ${targetCompany}의 재무·제품·고객 기반 경쟁 우위를 ${AXIS_LABEL[primaryAxis]} 중심으로 심층 진단한다`
  };

  // Competitor matrix: Question 설정 (어떻게 대응해야 하는가?)
  slides[5] = {
    ...slides[5],
    title: "경쟁사 비교: 전략·제품 매트릭스",
    focus: `[Question] ${targetCompany}와 ${competitorSummary}를 동일 프레임으로 비교해 ${AXIS_LABEL[secondaryAxis]} 차별화 포인트를 도출한다`
  };

  // Tech benchmarking: Answer 근거
  slides[6] = {
    ...slides[6],
    title: "기술 경쟁력: 로드맵·양산 속도",
    focus: `[Answer 근거] ${AXIS_LABEL[tertiaryAxis]} 관점에서 기술 성능과 제품 로드맵을 비교해 차별화 축을 정의한다`
  };

  // Value chain: Answer 근거
  slides[7] = {
    ...slides[7],
    title: "밸류체인: 원가·공급망 병목 진단",
    focus: `[Answer 근거] 원료-전구체-소재-고객 밸류체인에서 ${AXIS_LABEL[primaryAxis]}와 ${AXIS_LABEL[secondaryAxis]}의 연결 구조를 진단한다`
  };

  // Finance comparison: Answer 근거
  slides[8] = {
    ...slides[8],
    title: "재무 격차: 수익성·투자효율 비교",
    focus: `[Answer 근거] 주요 기업의 실적·수익성·CAPA를 비교해 ${AXIS_LABEL[primaryAxis]} 중심 성과 격차를 해석한다`
  };

  // Trends: Answer 종합
  slides[9] = {
    ...slides[9],
    title: `${trendTitle(primaryAxis, secondaryAxis)}: 전략 선택지`,
    focus: `[Answer 종합] ${AXIS_LABEL[primaryAxis]}와 ${AXIS_LABEL[secondaryAxis]} 기반 메가트렌드를 전략 우선순위로 변환한다`
  };

  // Risk analysis: Complication 보완 (실행 장애 요인)
  slides[10] = {
    ...slides[10],
    title: "핵심 리스크: 영향도·대응 우선순위",
    focus: `[Complication 보완] ${AXIS_LABEL[secondaryAxis]} 및 리스크 지표를 결합해 핵심 대응 우선순위를 명확화한다`
  };

  // Strategic implications: Answer 핵심
  slides[11] = {
    ...slides[11],
    title: "전략 시사점: 의사결정 원칙 재정의",
    focus: `[Answer 핵심] ${AXIS_LABEL[primaryAxis]}·${AXIS_LABEL[secondaryAxis]} 관점의 So What을 경영 의사결정 언어로 정리한다`
  };

  // Roadmap: Answer 실행 (What/Who/When/How Much 필수)
  slides[12] = {
    ...slides[12],
    title: "실행 로드맵: 단계별 KPI·오너십",
    focus: `[Answer 실행] ${AXIS_LABEL[primaryAxis]} 중심 KPI 체계로 구체화 — What(과제)/Who(오너십)/When(타임라인)/How Much(투자·ROI)를 단계별로 정의한다`
  };

  if (brief.page_count > slides.length) {
    const extraCount = brief.page_count - slides.length;
    const rotatingAxes: Source["axis"][] = [primaryAxis, secondaryAxis, tertiaryAxis];
    for (let i = 0; i < extraCount; i += 1) {
      const axis = rotatingAxes[i % rotatingAxes.length];
      slides.push({
        type: "appendix",
        title: `부록 상세 ${i + 1} — ${AXIS_LABEL[axis]} 근거`,
        focus: `${AXIS_LABEL[axis]} 관련 추가 정량 근거와 계산 가정을 제시해 결론 신뢰도를 보강한다`,
        section: "appendix",
        scqaRole: "appendix"
      });
    }
  }

  return slides.map((slide, index) => ({
    ...slide,
    id: `s${String(index + 1).padStart(2, "0")}`
  }));
}
