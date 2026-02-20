/**
 * MECE Framework Generator
 *
 * McKinsey의 핵심 사고 도구: MECE (Mutually Exclusive, Collectively Exhaustive)
 * 문제 공간을 상호 배타적이고 전체적으로 완전한 방식으로 분해한다.
 *
 * 역할:
 * 1. ProblemDecomposition — 6축(market/competition/finance/technology/regulation/risk) 기반 문제 분해
 * 2. RecommendationSpace — 4대 레버(cost/revenue/assets/growth) 기반 권고안 공간 분해
 * 3. MECEValidation — 슬라이드 스펙의 MECE 준수 여부 검증
 */

import { BriefNormalized, ResearchPack, SlideSpec } from "@consulting-ppt/shared";

// ───────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────

export type ResearchAxis = "market" | "competition" | "finance" | "technology" | "regulation" | "risk";
export type RecommendationLever = "cost" | "revenue" | "assets" | "growth";

export interface ProblemCategory {
  /** 분해 축 (MECE 영역) */
  axis: ResearchAxis;
  /** 상호 배타적 하위 범주들 */
  categories: string[];
  /** 이 축이 전체 문제 공간의 얼마를 커버하는지 (0~1) */
  coverageWeight: number;
  /** 이 축에 대한 데이터 신뢰도 (0~1) */
  dataStrength: number;
}

export interface RecommendationInitiative {
  lever: RecommendationLever;
  description: string;
  /** 권고 이니셔티브의 시급성 */
  priority: "immediate" | "short_term" | "mid_term";
}

export interface RecommendationCategory {
  lever: RecommendationLever;
  label: string;
  initiatives: RecommendationInitiative[];
  /** 이 레버가 포함되어야 하는지 여부 (brief 기반) */
  isRequired: boolean;
}

export interface MECEFrameworkResult {
  /**
   * 문제 분해: 6개 축 중 데이터 강도 기준 상위 축을 상호 배타적으로 정렬
   * MECE 원칙: 어떤 문제도 두 개의 축에 동시에 귀속되지 않도록 경계 설정
   */
  problemDecomposition: ProblemCategory[];

  /**
   * 권고안 공간: 4대 레버 기반 이니셔티브
   * MECE 원칙: 권고 항목들이 레버 간 중복 없이 전체 해결 공간을 커버
   */
  recommendationSpace: RecommendationCategory[];

  /**
   * 커버리지 점수: 0~100
   * 100 = 모든 핵심 축이 슬라이드 스펙에서 다루어짐
   */
  coverageScore: number;

  /**
   * MECE 갭: 슬라이드 스펙에서 다루어지지 않은 축
   */
  gaps: string[];

  /**
   * MECE 중복: 두 개 이상의 슬라이드에서 동일 축을 과도하게 반복하는 경우
   */
  redundancies: string[];

  /**
   * 권고안 레버 커버리지: 4대 레버 중 spec에 포함된 레버
   */
  coveredLevers: RecommendationLever[];
}

// ───────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────

const AXIS_LABELS: Record<ResearchAxis, string> = {
  market: "시장·수요",
  competition: "경쟁·포지셔닝",
  finance: "재무·수익성",
  technology: "기술·제품",
  regulation: "규제·정책",
  risk: "리스크·불확실성"
};

const LEVER_LABELS: Record<RecommendationLever, string> = {
  cost: "비용 최적화",
  revenue: "수익 성장",
  assets: "자산 효율화",
  growth: "신성장 전환"
};

/**
 * 각 축의 MECE 하위 범주: 상호 배타적으로 설계
 * (예: market 축의 하위 범주들은 서로 겹치지 않음)
 */
const MECE_CATEGORIES_BY_AXIS: Record<ResearchAxis, string[]> = {
  market: ["국내 수요", "수출/해외", "신규 세그먼트", "가격 구조"],
  competition: ["직접 경쟁사", "신규 진입자", "대체재", "가치사슬 수직통합"],
  finance: ["매출 성장", "마진 개선", "현금흐름", "자본효율(ROI/ROIC)"],
  technology: ["제품·서비스 R&D", "공정 혁신", "디지털·데이터", "특허·IP"],
  regulation: ["국내 규제", "해외 규제", "환경·ESG", "산업 표준·인증"],
  risk: ["재무 리스크", "운영 리스크", "전략 리스크", "외부 거시 리스크"]
};

/**
 * 각 레버에 대한 키워드 매핑 (슬라이드 claim 텍스트에서 검출)
 */
const LEVER_KEYWORDS: Record<RecommendationLever, RegExp> = {
  cost: /원가|비용|COGS|절감|효율화|opex|capex|생산성/i,
  revenue: /매출|수익|성장|확대|점유율|revenue|성장률|고객|시장 확대/i,
  assets: /자산|투자|ROI|ROIC|회전율|자본|효율|turnover/i,
  growth: /신사업|M&A|진출|혁신|플랫폼|파트너십|확장|포트폴리오 전환/i
};

/**
 * 각 축에 대한 키워드 매핑 (슬라이드 claim/title에서 검출)
 */
const AXIS_KEYWORDS: Record<ResearchAxis, RegExp> = {
  market: /시장|수요|규모|점유율|성장률|고객|세그먼트|TAM|SAM/i,
  competition: /경쟁|플레이어|포지셔닝|벤치마크|경쟁사|ranking|차별화/i,
  finance: /재무|매출|마진|EBITDA|현금|수익성|capex|opex|투자/i,
  technology: /기술|R&D|특허|제품|혁신|디지털|AI|플랫폼|공정/i,
  regulation: /규제|정책|ESG|탄소|compliance|인증|법규|표준/i,
  risk: /리스크|위험|불확실|변동성|시나리오|완화|exposure/i
};

// ───────────────────────────────────────────────
// Helper functions
// ───────────────────────────────────────────────

function computeAxisDataStrength(axis: ResearchAxis, researchPack: ResearchPack): number {
  const sources = researchPack.sources.filter((s) => s.axis === axis);
  const evidences = researchPack.evidences.filter((e) =>
    sources.some((s) => s.source_id === e.source_id)
  );

  if (sources.length === 0) return 0;

  const avgReliability = sources.reduce((sum, s) => sum + s.reliability_score, 0) / sources.length;
  // 소스 수(0.4) + 증거 수(0.3) + 평균 신뢰도(0.3) 가중 합산
  const sourceScore = Math.min(1, sources.length / 5) * 0.4;
  const evidenceScore = Math.min(1, evidences.length / 8) * 0.3;
  const reliabilityScore = avgReliability * 0.3;

  return Math.min(1, sourceScore + evidenceScore + reliabilityScore);
}

function computeCoverageWeight(axis: ResearchAxis, brief: BriefNormalized): number {
  const topicLower = brief.topic.toLowerCase();
  const industryLower = brief.industry.toLowerCase();

  // brief 토픽/산업이 이 축의 키워드를 포함하면 가중치 상승
  const pattern = AXIS_KEYWORDS[axis];
  const isInTopic = pattern.test(topicLower) || pattern.test(industryLower);

  // 기본 가중치: 6축 균등 배분 (1/6 ≈ 0.167)
  const base = 1 / 6;
  return isInTopic ? Math.min(1, base * 1.8) : base;
}

function detectAxisCoverageInSpec(axis: ResearchAxis, spec: SlideSpec): number {
  const pattern = AXIS_KEYWORDS[axis];
  let matchCount = 0;

  for (const slide of spec.slides) {
    const corpus = `${slide.title} ${slide.governing_message} ${slide.claims.map((c) => c.text).join(" ")}`;
    if (pattern.test(corpus)) {
      matchCount += 1;
    }
  }

  return matchCount;
}

function detectLeverCoverageInSpec(lever: RecommendationLever, spec: SlideSpec): boolean {
  const pattern = LEVER_KEYWORDS[lever];

  for (const slide of spec.slides) {
    const corpus = `${slide.title} ${slide.governing_message} ${slide.claims.map((c) => c.text).join(" ")}`;
    if (pattern.test(corpus)) {
      return true;
    }
  }

  return false;
}

function buildRecommendationInitiatives(
  lever: RecommendationLever,
  brief: BriefNormalized
): RecommendationInitiative[] {
  const company = brief.target_company;

  const templates: Record<RecommendationLever, RecommendationInitiative[]> = {
    cost: [
      {
        lever: "cost",
        description: `${company} COGS·운영비 구조 재설계 — Tier-1 공급망 재협상 및 공정 자동화`,
        priority: "immediate"
      },
      {
        lever: "cost",
        description: `고정비 대비 변동비 비중 최적화 — 수요 변동 완충력 확보`,
        priority: "short_term"
      }
    ],
    revenue: [
      {
        lever: "revenue",
        description: `핵심 성장 세그먼트 집중 투자 — ${brief.industry} 내 고부가가치 고객군 우선 공략`,
        priority: "immediate"
      },
      {
        lever: "revenue",
        description: `가격 아키텍처 재설계 — Premium/Standard/Economy 3-tier 포지셔닝`,
        priority: "short_term"
      }
    ],
    assets: [
      {
        lever: "assets",
        description: `${company} 자산 포트폴리오 재편 — 저수익 자산 매각·재배치로 ROIC 개선`,
        priority: "short_term"
      },
      {
        lever: "assets",
        description: `운전자본 최적화 — 재고 회전율·매출채권 관리 강화`,
        priority: "mid_term"
      }
    ],
    growth: [
      {
        lever: "growth",
        description: `${brief.industry} 인접 시장 진출 — M&A·파트너십 통한 포트폴리오 전환`,
        priority: "mid_term"
      },
      {
        lever: "growth",
        description: `플랫폼·디지털 전환 가속 — 신규 수익 모델(구독/데이터) 구축`,
        priority: "mid_term"
      }
    ]
  };

  return templates[lever];
}

// ───────────────────────────────────────────────
// Main exports
// ───────────────────────────────────────────────

/**
 * MECE 문제 분해 및 권고안 공간 생성
 *
 * @param brief — 정규화된 브리프 (target_company, industry, topic 등)
 * @param researchPack — 리서치 팩 (데이터 강도 계산용)
 * @param spec — 슬라이드 스펙 (커버리지 검증용, 선택적)
 */
export function buildMECEFramework(
  brief: BriefNormalized,
  researchPack: ResearchPack,
  spec?: SlideSpec
): MECEFrameworkResult {
  const allAxes: ResearchAxis[] = ["market", "competition", "finance", "technology", "regulation", "risk"];

  // 1. 문제 분해: 6축 × (데이터 강도 + 커버리지 가중치)
  const problemDecomposition: ProblemCategory[] = allAxes.map((axis) => ({
    axis,
    categories: MECE_CATEGORIES_BY_AXIS[axis],
    coverageWeight: computeCoverageWeight(axis, brief),
    dataStrength: computeAxisDataStrength(axis, researchPack)
  }));

  // 데이터 강도 기준 정렬 (높은 축 우선)
  problemDecomposition.sort((a, b) => b.dataStrength - a.dataStrength);

  // 2. 권고안 공간: 4대 레버 기반 (brief의 industry/topic 연관성으로 필요 여부 결정)
  const allLevers: RecommendationLever[] = ["cost", "revenue", "assets", "growth"];
  const recommendationSpace: RecommendationCategory[] = allLevers.map((lever) => {
    const isRequired = (() => {
      switch (lever) {
        case "cost":
          // 비용/마진 관련 키워드가 brief에 있으면 필수
          return LEVER_KEYWORDS.cost.test(brief.topic) || LEVER_KEYWORDS.cost.test(brief.industry);
        case "revenue":
          // 성장 관련 brief에는 항상 필수
          return true;
        case "assets":
          return LEVER_KEYWORDS.assets.test(brief.topic) || brief.target_audience === "CFO";
        case "growth":
          return LEVER_KEYWORDS.growth.test(brief.topic) || brief.target_audience === "CSO" || brief.target_audience === "CEO";
      }
    })();

    return {
      lever,
      label: LEVER_LABELS[lever],
      initiatives: buildRecommendationInitiatives(lever, brief),
      isRequired
    };
  });

  // 3. 슬라이드 스펙 커버리지 검증 (spec이 주어진 경우)
  const gaps: string[] = [];
  const redundancies: string[] = [];
  const coveredLevers: RecommendationLever[] = [];
  let coverageScore = 0;

  if (spec) {
    let coveredAxisCount = 0;
    const totalAxes = allAxes.length;

    for (const axis of allAxes) {
      const matchCount = detectAxisCoverageInSpec(axis, spec);
      if (matchCount === 0) {
        gaps.push(`${AXIS_LABELS[axis]} 축(${axis})이 슬라이드 스펙에서 다루어지지 않았습니다`);
      } else {
        coveredAxisCount += 1;
        // 3슬라이드 이상에서 동일 축이 반복되면 중복 경고
        if (matchCount >= 4) {
          redundancies.push(
            `${AXIS_LABELS[axis]} 축(${axis})이 ${matchCount}개 슬라이드에서 반복됩니다 — 단일 슬라이드로 통합 권장`
          );
        }
      }
    }

    for (const lever of allLevers) {
      if (detectLeverCoverageInSpec(lever, spec)) {
        coveredLevers.push(lever);
      }
    }

    // coverageScore: 축 커버리지(70%) + 레버 커버리지(30%)
    const axisScore = (coveredAxisCount / totalAxes) * 70;
    const leverScore = (coveredLevers.length / allLevers.length) * 30;
    coverageScore = Math.round(axisScore + leverScore);
  } else {
    // spec 없이 호출 시: 데이터 강도 기반 예상 점수
    const coveredByData = problemDecomposition.filter((p) => p.dataStrength > 0.2).length;
    coverageScore = Math.round((coveredByData / allAxes.length) * 100);
    allLevers.forEach((lever) => coveredLevers.push(lever));
  }

  return {
    problemDecomposition,
    recommendationSpace,
    coverageScore,
    gaps,
    redundancies,
    coveredLevers
  };
}

/**
 * MECE 검증 결과를 마크다운 요약으로 변환
 */
export function formatMECEReport(result: MECEFrameworkResult): string {
  const lines: string[] = [
    "## MECE Framework Report",
    "",
    `- Coverage Score: ${result.coverageScore}/100`,
    `- Gaps: ${result.gaps.length}개`,
    `- Redundancies: ${result.redundancies.length}개`,
    "",
    "### 문제 분해 (Problem Decomposition)",
    "| 축 | 데이터 강도 | 커버리지 가중치 | 하위 범주 수 |",
    "|---|---|---|---|"
  ];

  for (const cat of result.problemDecomposition) {
    lines.push(
      `| ${cat.axis} | ${(cat.dataStrength * 100).toFixed(0)}% | ${(cat.coverageWeight * 100).toFixed(0)}% | ${cat.categories.length}개 |`
    );
  }

  lines.push("", "### 권고안 공간 (Recommendation Space — 4대 레버)");
  for (const rec of result.recommendationSpace) {
    const marker = rec.isRequired ? "✓ 필수" : "○ 선택";
    lines.push(`- [${marker}] **${rec.label}(${rec.lever})**: ${rec.initiatives.length}개 이니셔티브`);
  }

  lines.push("", `### 적용된 레버: ${result.coveredLevers.map((l) => `${l}`).join(", ") || "없음"}`);

  if (result.gaps.length > 0) {
    lines.push("", "### MECE 갭");
    for (const gap of result.gaps) {
      lines.push(`- ${gap}`);
    }
  }

  if (result.redundancies.length > 0) {
    lines.push("", "### MECE 중복 경고");
    for (const r of result.redundancies) {
      lines.push(`- ${r}`);
    }
  }

  return lines.join("\n");
}
