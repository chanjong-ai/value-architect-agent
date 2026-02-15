import { BriefNormalized, ResearchPack, SlideType, Source } from "@consulting-ppt/shared";

export interface PlannedSlide {
  id: string;
  type: SlideType;
  title: string;
  focus: string;
  section: "problem" | "insight" | "option" | "recommendation" | "execution" | "appendix";
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
    section: "problem"
  },
  {
    type: "exec-summary",
    title: "Executive Summary",
    focus: "핵심 수치와 전략 결론을 단일 페이지에서 압축 제시한다",
    section: "insight"
  },
  {
    type: "market-landscape",
    title: "시장 개요",
    focus: "시장 규모·성장률·세그먼트 구조 변화를 정량으로 설명한다",
    section: "problem"
  },
  {
    type: "benchmark",
    title: "경쟁 환경",
    focus: "주요 플레이어 포지셔닝과 경쟁구도 변화를 비교한다",
    section: "insight"
  },
  {
    type: "benchmark",
    title: "플레이어 심층 분석",
    focus: "타깃 기업의 재무·전략·포트폴리오를 심층 진단한다",
    section: "insight"
  },
  {
    type: "benchmark",
    title: "플레이어 비교 매트릭스",
    focus: "핵심 경쟁사 간 전략·제품·고객·리스크를 동일 프레임으로 정렬한다",
    section: "option"
  },
  {
    type: "market-landscape",
    title: "기술/제품 벤치마킹",
    focus: "기술 성능과 제품 로드맵을 비교해 차별화 축을 정의한다",
    section: "option"
  },
  {
    type: "market-landscape",
    title: "밸류체인 분석",
    focus: "원료-전구체-소재-고객 밸류체인에서 경쟁 우위를 진단한다",
    section: "option"
  },
  {
    type: "benchmark",
    title: "재무 성과 비교",
    focus: "주요 기업의 실적·수익성·CAPA를 비교해 성과 격차를 해석한다",
    section: "recommendation"
  },
  {
    type: "exec-summary",
    title: "트렌드 & 기회",
    focus: "시장 메가트렌드와 사업 기회를 전략 우선순위로 변환한다",
    section: "recommendation"
  },
  {
    type: "risks-issues",
    title: "리스크 분석",
    focus: "발생확률-영향도 기준으로 핵심 리스크와 대응 우선순위를 명확화한다",
    section: "execution"
  },
  {
    type: "roadmap",
    title: "전략적 시사점",
    focus: "시장·기업·기술 관점의 So What을 경영 의사결정 언어로 정리한다",
    section: "execution"
  },
  {
    type: "roadmap",
    title: "권고안 (전략 로드맵)",
    focus: "단기·중기·장기 실행 계획과 우선 액션을 구체화한다",
    section: "execution"
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

export function planNarrative(brief: BriefNormalized, researchPack: ResearchPack): PlannedSlide[] {
  const slides = [...BASE_STORY];
  const industryLabel = brief.industry.includes("시장") ? brief.industry : `${brief.industry} 시장`;
  const targetCompany = brief.target_company;
  const competitorSummary = brief.competitors.length > 0 ? brief.competitors.join(", ") : "주요 경쟁사";
  const [primaryAxis, secondaryAxis, tertiaryAxis] = choosePriorityAxes(brief, researchPack);

  slides[0] = {
    ...slides[0],
    title: `${industryLabel} 전략 방향성 진단`,
    focus: `${brief.topic} 이슈를 ${brief.target_audience} 의사결정 프레임으로 구조화하고, 리서치 우선축(${AXIS_LABEL[primaryAxis]}, ${AXIS_LABEL[secondaryAxis]})을 명확화한다`
  };

  slides[1] = {
    ...slides[1],
    title: `핵심 결론: ${targetCompany} 전환 아젠다`,
    focus: `${AXIS_LABEL[primaryAxis]}·${AXIS_LABEL[secondaryAxis]} 근거를 기반으로 핵심 수치와 전략 결론을 단일 페이지에서 압축 제시한다`
  };

  slides[2] = {
    ...slides[2],
    title: "시장 진단: 수요·성장·지역 재편",
    focus: `${industryLabel}에서 ${AXIS_LABEL[primaryAxis]} 변화를 정량 검증하고 스토리라인의 문제정의 구간으로 연결한다`
  };

  slides[3] = {
    ...slides[3],
    title: "경쟁 구도: 점유율·CAPA 재편",
    focus: `${industryLabel}에서 ${targetCompany}와 주요 플레이어의 포지셔닝 변화를 ${AXIS_LABEL[secondaryAxis]} 관점으로 비교한다`
  };

  slides[4] = {
    ...slides[4],
    title: `${targetCompany} 포지셔닝: 우위·열위`,
    focus: `${targetCompany}의 재무·제품·고객 기반 경쟁 우위를 ${AXIS_LABEL[primaryAxis]} 중심으로 심층 진단한다`
  };

  slides[5] = {
    ...slides[5],
    title: "경쟁사 비교: 전략·제품 매트릭스",
    focus: `${targetCompany}와 ${competitorSummary}를 동일 프레임으로 비교해 ${AXIS_LABEL[secondaryAxis]} 차별화 포인트를 도출한다`
  };

  slides[6] = {
    ...slides[6],
    title: "기술 경쟁력: 로드맵·양산 속도",
    focus: `${AXIS_LABEL[tertiaryAxis]} 관점에서 기술 성능과 제품 로드맵을 비교해 차별화 축을 정의한다`
  };

  slides[7] = {
    ...slides[7],
    title: "밸류체인: 원가·공급망 병목 진단",
    focus: `원료-전구체-소재-고객 밸류체인에서 ${AXIS_LABEL[primaryAxis]}와 ${AXIS_LABEL[secondaryAxis]}의 연결 구조를 진단한다`
  };

  slides[8] = {
    ...slides[8],
    title: "재무 격차: 수익성·투자효율 비교",
    focus: `주요 기업의 실적·수익성·CAPA를 비교해 ${AXIS_LABEL[primaryAxis]} 중심 성과 격차를 해석한다`
  };

  slides[9] = {
    ...slides[9],
    title: `${trendTitle(primaryAxis, secondaryAxis)}: 전략 선택지`,
    focus: `${AXIS_LABEL[primaryAxis]}와 ${AXIS_LABEL[secondaryAxis]} 기반 메가트렌드를 전략 우선순위로 변환한다`
  };

  slides[10] = {
    ...slides[10],
    title: "핵심 리스크: 영향도·대응 우선순위",
    focus: `${AXIS_LABEL[secondaryAxis]} 및 리스크 지표를 결합해 핵심 대응 우선순위를 명확화한다`
  };

  slides[11] = {
    ...slides[11],
    title: "전략 시사점: 의사결정 원칙 재정의",
    focus: `${AXIS_LABEL[primaryAxis]}·${AXIS_LABEL[secondaryAxis]} 관점의 So What을 경영 의사결정 언어로 정리한다`
  };

  slides[12] = {
    ...slides[12],
    title: "실행 로드맵: 단계별 KPI·오너십",
    focus: `단기·중기·장기 실행 계획과 우선 액션을 ${AXIS_LABEL[primaryAxis]} 중심 KPI 체계로 구체화한다`
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
        section: "appendix"
      });
    }
  }

  return slides.map((slide, index) => ({
    ...slide,
    id: `s${String(index + 1).padStart(2, "0")}`
  }));
}
