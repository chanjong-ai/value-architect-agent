import { QAIssue, SlideSpec } from "@consulting-ppt/shared";

export interface TextQaResult {
  score: number;
  issues: QAIssue[];
  // Phase 4: 확장 QA 리포트
  scqaCheck: {
    hasSituation: boolean;
    hasComplication: boolean;
    hasAnswer: boolean;
    scqaCoverage: number; // 0-100
  };
  actionTitleCheck: {
    passiveTitles: string[];
    lowSpecificityTitles: Array<{ id: string; title: string; score: number }>;
    averageSpecificityScore: number;
  };
  executiveSummaryCheck: {
    hasExecSummary: boolean;
    hasProblemStatement: boolean;
    hasKeyFindings: boolean;
    hasRecommendations: boolean;
  };
  recommendationCheck: {
    slidesWithWhat: number;
    slidesWithWho: number;
    slidesWithWhen: number;
    slidesWithHowMuch: number;
    actionabilityScore: number; // 0-100
  };
}

function normalizeForDupCheck(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function tokenize(value: string): string[] {
  return value
    .replace(/[^a-zA-Z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 2);
}

function isConsultingToneGoverningMessage(value: string): boolean {
  const normalized = normalizeForDupCheck(value);
  if (!normalized) {
    return false;
  }
  const hasFormulaTone = /([a-z0-9가-힣][^=]{1,40}\+\s*[a-z0-9가-힣][^=]{1,40}=\s*[a-z0-9가-힣])/i.test(normalized);
  if (hasFormulaTone || normalized.includes("결론")) {
    return true;
  }
  return /(우선순위|재정렬|재설계|전환|구체화|강화|고도화|필요|해야)/.test(normalized);
}

/**
 * Phase 4: Passive Title 탐지
 * "~현황", "~분석", "~개요" 등 명사형 종결 타이틀 → Action Title이어야 함
 */
function isPassiveTitle(title: string): boolean {
  return /^(.*)(현황|개요|분석|검토|소개|정리|요약|개관|현황분석|현황파악)$/.test(title.trim());
}

/**
 * Phase 4: Action Title 구체성 점수 (0-100)
 * 맥킨지 기준: 수치/시간범위/주체/행동결론 중 3개 이상
 */
function calcTitleSpecificity(title: string): number {
  let score = 0;
  if (/\d/.test(title)) score += 25;
  if (/(\d{2,4}년|\d+[분기월주년]|Q\d|단기|중기|장기)/.test(title)) score += 25;
  if (/(주요|핵심|경쟁사|플레이어|시장|고객|파트너|업체)/.test(title)) score += 25;
  if (/(필요|해야|전환|재편|확대|축소|강화|구축|달성|견인|확보|투자|추진|집중|주도|압박|위협|기회|전략|결정|선택)/.test(title)) score += 25;
  return score;
}

/**
 * Phase 4: Recommendation Actionability 검증
 * What/Who/When/How Much 포함 여부
 */
function checkRecommendationActionability(claims: SlideSpec["slides"][number]["claims"]): {
  hasWhat: boolean;
  hasWho: boolean;
  hasWhen: boolean;
  hasHowMuch: boolean;
} {
  const allText = claims.map((c) => c.text).join(" ");
  return {
    hasWhat: /(과제|전략|실행|추진|구축|착수|개발|투자|재편)/.test(allText),
    hasWho: /(오너|owner|책임|담당|PMO|팀|조직|본부장|CEO|CFO|COO|CIO|CSO)/.test(allText),
    hasWhen: /(개월|분기|년|Q\d|단기|중기|장기|\d{4}|타임라인|일정|목표 시점)/.test(allText),
    hasHowMuch: /(투자|CAPEX|예산|비용|ROI|억원|조원|백만|천만|원)/.test(allText)
  };
}

export function runTextQa(spec: SlideSpec): TextQaResult {
  const issues: QAIssue[] = [];
  const governingMessageSet = new Set<string>();

  // Phase 4: 확장 QA 데이터 수집
  const passiveTitles: string[] = [];
  const lowSpecificityTitles: Array<{ id: string; title: string; score: number }> = [];
  let specificityScoreSum = 0;
  let specificityCount = 0;

  // SCQA 커버리지 탐지
  const allText = spec.slides.map((s) => `${s.title} ${s.governing_message} ${s.claims.map((c) => c.text).join(" ")}`).join(" ").toLowerCase();
  const hasSituation = /(현재|시장|상황|배경|현황|진단)/.test(allText);
  const hasComplication = /(그러나|그런데|문제|위협|도전|압력|위기|과제|하락|둔화|심화|경쟁)/.test(allText);
  const hasAnswer = /(따라서|권고|결론|필요|전략|로드맵|실행|추진)/.test(allText);

  // Executive Summary 체크
  const execSummarySlide = spec.slides.find((s) => s.type === "exec-summary");
  const execText = execSummarySlide ? `${execSummarySlide.title} ${execSummarySlide.governing_message} ${execSummarySlide.claims.map((c) => c.text).join(" ")}`.toLowerCase() : "";
  const hasProblemStatement = /(배경|상황|문제|현황|진단|situation)/.test(execText);
  const hasKeyFindings = /(핵심|결론|발견|key|finding)/.test(execText) && /\d/.test(execText);
  const hasRecommendations = /(권고|권장|recommend|전략|로드맵|실행)/.test(execText);

  // Recommendation actionability 체크
  const roadmapSlides = spec.slides.filter((s) => s.type === "roadmap");
  let slidesWithWhat = 0;
  let slidesWithWho = 0;
  let slidesWithWhen = 0;
  let slidesWithHowMuch = 0;

  for (const slide of spec.slides) {
    if (slide.title.length < 3) {
      issues.push({
        rule: "title_min_length",
        severity: "medium",
        slide_id: slide.id,
        message: "슬라이드 제목이 너무 짧습니다"
      });
    }

    if (slide.title.length > 60) {
      issues.push({
        rule: "title_too_long",
        severity: "low",
        slide_id: slide.id,
        message: "슬라이드 제목이 길어 가독성이 낮아질 수 있습니다 (맥킨지 기준 60자 이내)"
      });
    }

    // Phase 4: Passive Title 탐지 (cover 제외)
    if (slide.type !== "cover" && isPassiveTitle(slide.title)) {
      passiveTitles.push(slide.title);
      issues.push({
        rule: "passive_action_title",
        severity: "high",
        slide_id: slide.id,
        message: `Passive Title 탐지: "${slide.title}" — "~현황/~분석" 형식은 Action Title이 아님. 결론을 담은 완전한 문장으로 교체 필요`
      });
    }

    // Phase 4: Action Title 구체성 점수 (cover/appendix 제외)
    if (slide.type !== "cover" && slide.type !== "appendix") {
      const score = calcTitleSpecificity(slide.title);
      specificityScoreSum += score;
      specificityCount += 1;
      if (score < 50) {
        lowSpecificityTitles.push({ id: slide.id, title: slide.title, score });
        issues.push({
          rule: "low_specificity_title",
          severity: "medium",
          slide_id: slide.id,
          message: `Action Title 구체성 부족 (점수: ${score}/100): 수치·시간범위·주체·행동결론 중 2개 이상 추가 필요`
        });
      }
    }

    if (slide.governing_message.length > 120) {
      issues.push({
        rule: "governing_message_length",
        severity: "medium",
        slide_id: slide.id,
        message: "거버닝 메시지가 길어 1~2줄 takeaway 원칙을 벗어납니다"
      });
    }

    const gmKey = normalizeForDupCheck(slide.governing_message);
    if (governingMessageSet.has(gmKey)) {
      issues.push({
        rule: "governing_message_duplicate",
        severity: "high",
        slide_id: slide.id,
        message: "거버닝 메시지가 중복되어 스토리라인 차별성이 부족합니다"
      });
    }
    governingMessageSet.add(gmKey);

    if (!isConsultingToneGoverningMessage(slide.governing_message)) {
      issues.push({
        rule: "governing_tone_non_consulting",
        severity: "medium",
        slide_id: slide.id,
        message: "거버닝 메시지가 컨설팅 의사결정 문체(우선순위/전환/재정렬) 기준에 미달합니다"
      });
    }

    const titleTokens = tokenize(slide.title);
    const gmTokens = new Set(tokenize(slide.governing_message));
    const overlapCount = titleTokens.filter((token) => gmTokens.has(token)).length;
    if (titleTokens.length > 0 && overlapCount === 0) {
      issues.push({
        rule: "title_body_inconsistency",
        severity: "medium",
        slide_id: slide.id,
        message: "제목과 거버닝 메시지 간 핵심 키워드 정합성이 낮습니다"
      });
    }

    for (const claim of slide.claims) {
      if (!claim.text.includes("So What:")) {
        issues.push({
          rule: "missing_so_what",
          severity: "high",
          slide_id: slide.id,
          message: "주장 문장에 So What이 없어 임원 의사결정 연결성이 약합니다"
        });
      }

      if (claim.text.length > 200) {
        issues.push({
          rule: "claim_too_long",
          severity: "medium",
          slide_id: slide.id,
          message: "claim 문장이 너무 길어 핵심 메시지가 흐려집니다"
        });
      }
    }

    // Phase 4: Recommendation Actionability (roadmap 슬라이드)
    if (slide.type === "roadmap") {
      const actionability = checkRecommendationActionability(slide.claims);
      if (actionability.hasWhat) slidesWithWhat += 1;
      if (actionability.hasWho) slidesWithWho += 1;
      if (actionability.hasWhen) slidesWithWhen += 1;
      if (actionability.hasHowMuch) slidesWithHowMuch += 1;

      if (!actionability.hasWho) {
        issues.push({
          rule: "recommendation_missing_owner",
          severity: "medium",
          slide_id: slide.id,
          message: "권고안에 실행 오너십(Who)이 명시되지 않음 — 구체적 담당 조직/역할 추가 필요"
        });
      }
      if (!actionability.hasWhen) {
        issues.push({
          rule: "recommendation_missing_timeline",
          severity: "medium",
          slide_id: slide.id,
          message: "권고안에 타임라인(When)이 명시되지 않음 — 단기/중기/장기 또는 분기별 목표 시점 추가 필요"
        });
      }
    }
  }

  // Executive Summary가 없으면 경고
  if (!execSummarySlide) {
    issues.push({
      rule: "missing_exec_summary",
      severity: "high",
      slide_id: undefined,
      message: "Executive Summary 슬라이드가 없습니다 — 맥킨지 표준에서 가장 중요한 단일 슬라이드"
    });
  } else if (!hasKeyFindings) {
    issues.push({
      rule: "exec_summary_missing_key_findings",
      severity: "medium",
      slide_id: execSummarySlide.id,
      message: "Executive Summary에 수치 기반 Key Findings가 부족합니다"
    });
  }

  const deduction = issues.reduce((acc, issue) => {
    if (issue.severity === "high") {
      return acc + 6;
    }
    if (issue.severity === "medium") {
      return acc + 3;
    }
    return acc + 1;
  }, 0);

  const avgSpecificity = specificityCount > 0 ? Math.round(specificityScoreSum / specificityCount) : 0;
  const roadmapCount = Math.max(1, roadmapSlides.length);
  const actionabilityScore = Math.round(
    ((slidesWithWhat + slidesWithWho + slidesWithWhen + slidesWithHowMuch) / (roadmapCount * 4)) * 100
  );

  const scqaCount = (hasSituation ? 1 : 0) + (hasComplication ? 1 : 0) + (hasAnswer ? 1 : 0);
  const scqaCoverage = Math.round((scqaCount / 3) * 100);

  return {
    score: Math.max(0, 20 - deduction),
    issues,
    scqaCheck: {
      hasSituation,
      hasComplication,
      hasAnswer,
      scqaCoverage
    },
    actionTitleCheck: {
      passiveTitles,
      lowSpecificityTitles,
      averageSpecificityScore: avgSpecificity
    },
    executiveSummaryCheck: {
      hasExecSummary: Boolean(execSummarySlide),
      hasProblemStatement,
      hasKeyFindings,
      hasRecommendations
    },
    recommendationCheck: {
      slidesWithWhat,
      slidesWithWho,
      slidesWithWhen,
      slidesWithHowMuch,
      actionabilityScore
    }
  };
}
