import { QAReport, ResearchPack, SlideSpec } from "@consulting-ppt/shared";
import { runDataQa } from "./data-qa";
import { runLayoutQa } from "./layout-qa";
import { totalScore } from "./scoring";
import { runSourceQa } from "./source-qa";
import { runTextQa } from "./text-qa";

export interface QaExecutionOptions {
  threshold?: number;
  /** MECE 커버리지 점수 (0~100). thinking 패키지에서 buildMECEFramework 결과를 전달 */
  meceCoverageScore?: number;
  /** MECE 갭: 슬라이드 스펙에서 다루지 않은 연구 축 목록 */
  meceGaps?: string[];
}

export interface QaExecutionResult {
  report: QAReport;
  summaryMarkdown: string;
}

function deduceFailReasons(report: QAReport): string[] {
  const reasons = new Set<string>();

  if (report.qa_score < report.threshold) {
    reasons.add(`QA score ${report.qa_score} is below threshold ${report.threshold}`);
  }

  for (const issue of report.issues) {
    if (issue.severity === "high") {
      reasons.add(`High severity: ${issue.rule}`);
    }

    if (issue.rule === "claim_without_evidence") {
      reasons.add("핵심 claim evidence 누락");
    }

    if (issue.rule === "overflow_risk") {
      reasons.add("텍스트 오버플로우 위험");
    }

    if (issue.rule === "period_inconsistency") {
      reasons.add("기간 표기 불일치");
    }

    if (issue.rule === "table_data_ref_mismatch" || issue.rule === "table_data_ref_missing") {
      reasons.add("표 데이터 참조 불일치");
    }

    if (issue.rule === "story_arc_missing" || issue.rule === "story_arc_cover_first") {
      reasons.add("핵심 스토리라인 구조 누락");
    }

    if (issue.rule === "required_visual_missing" || issue.rule === "text_only_slide") {
      reasons.add("슬라이드 필수 시각요소 누락");
    }

    if (issue.rule === "governing_tone_non_consulting") {
      reasons.add("거버닝 메시지 컨설팅 문체 미흡");
    }

    if (issue.rule === "passive_action_title") {
      reasons.add("Passive Action Title 탐지 (맥킨지 기준 위반)");
    }

    if (issue.rule === "low_specificity_title") {
      reasons.add("Action Title 구체성 부족 — 수치·시간범위·행동결론 보강 필요");
    }

    if (issue.rule === "missing_exec_summary") {
      reasons.add("Executive Summary 슬라이드 누락");
    }

    if (issue.rule === "recommendation_missing_owner") {
      reasons.add("권고안 오너십(Who) 미명시");
    }

    if (issue.rule === "recommendation_missing_timeline") {
      reasons.add("권고안 타임라인(When) 미명시");
    }

    if (issue.rule === "overcrowded_slide") {
      reasons.add("슬라이드 텍스트 과밀 — 맥킨지 Negative Space 원칙 위반");
    }

    if (issue.rule === "chart_without_callout") {
      reasons.add("차트 Callout/Annotation 부재 — 맥킨지 데이터 스토리텔링 미흡");
    }
  }

  return Array.from(reasons);
}

export function runQa(
  runId: string,
  spec: SlideSpec,
  researchPack: ResearchPack,
  options: QaExecutionOptions = {}
): QaExecutionResult {
  const threshold = options.threshold ?? 80;
  const meceCoverageScore = options.meceCoverageScore ?? null;
  const meceGaps = options.meceGaps ?? [];

  const text = runTextQa(spec);
  const layout = runLayoutQa(spec);
  const data = runDataQa(spec, researchPack);
  const source = runSourceQa(spec, researchPack);

  const breakdown = {
    structure_consistency: layout.score,
    data_accuracy: data.score,
    message_clarity: text.score,
    visual_readability: Math.max(0, 20 - Math.max(0, layout.issues.length - 2) * 2),
    source_completeness: source.score
  };

  const qaScore = totalScore(breakdown);

  const report: QAReport = {
    run_id: runId,
    qa_score: qaScore,
    threshold,
    passed: qaScore >= threshold,
    breakdown,
    issues: [...text.issues, ...layout.issues, ...data.issues, ...source.issues],
    fail_reasons: []
  };

  report.fail_reasons = deduceFailReasons(report);

  const lines = [
    "# QA Summary",
    "",
    `- Run ID: ${report.run_id}`,
    `- Score: ${report.qa_score} / 100`,
    `- Threshold: ${report.threshold}`,
    `- Passed: ${report.passed ? "YES" : "NO"}`,
    "",
    "## Breakdown",
    `- 구조 일관성: ${breakdown.structure_consistency}/20`,
    `- 데이터 정확성: ${breakdown.data_accuracy}/30`,
    `- 메시지 명료성: ${breakdown.message_clarity}/20`,
    `- 시각 가독성: ${breakdown.visual_readability}/20`,
    `- 출처 완전성: ${breakdown.source_completeness}/10`,
    "",
    "## McKinsey Quality Gates (확장 QA)",
    `- SCQA 커버리지: ${text.scqaCheck.scqaCoverage}% (Situation: ${text.scqaCheck.hasSituation ? "✓" : "✗"} | Complication: ${text.scqaCheck.hasComplication ? "✓" : "✗"} | Answer: ${text.scqaCheck.hasAnswer ? "✓" : "✗"})`,
    `- Action Title 평균 구체성: ${text.actionTitleCheck.averageSpecificityScore}/100`,
    `- Passive Title 개수: ${text.actionTitleCheck.passiveTitles.length}`,
    `- Executive Summary: ${text.executiveSummaryCheck.hasExecSummary ? "✓" : "✗"} (KeyFindings: ${text.executiveSummaryCheck.hasKeyFindings ? "✓" : "✗"} | Recommendations: ${text.executiveSummaryCheck.hasRecommendations ? "✓" : "✗"})`,
    `- 권고안 실행가능성: ${text.recommendationCheck.actionabilityScore}% (What: ${text.recommendationCheck.slidesWithWhat} | Who: ${text.recommendationCheck.slidesWithWho} | When: ${text.recommendationCheck.slidesWithWhen} | HowMuch: ${text.recommendationCheck.slidesWithHowMuch})`,
    "",
    "## Design Density (Negative Space 관리)",
    `- 과밀 슬라이드 수: ${report.issues.filter((i) => i.rule === "overcrowded_slide").length}`,
    `- Callout 누락 차트: ${report.issues.filter((i) => i.rule === "chart_without_callout").length}`,
    `- 표 5행 초과 위험 슬라이드: ${report.issues.filter((i) => i.rule === "table_exceeds_5_rows").length}`,
    `- Vertical Flow 불일치 (layout-validator): 별도 rendering 단계에서 확인`,
    "",
    "## MECE Framework (문제 분해 완전성)",
    meceCoverageScore !== null
      ? `- MECE 커버리지 점수: ${meceCoverageScore}/100 ${meceCoverageScore >= 70 ? "✓" : "⚠️ 보강 필요"}`
      : "- MECE 커버리지: 미산출 (thinking 결과 없이 QA 단독 실행)",
    meceGaps.length > 0
      ? `- 미커버 축: ${meceGaps.join(" / ")}`
      : "- MECE 갭: 없음",
    "",
    "## Fail Reasons"
  ];

  if (report.fail_reasons.length === 0) {
    lines.push("- 없음");
  } else {
    for (const reason of report.fail_reasons) {
      lines.push(`- ${reason}`);
    }
  }

  lines.push("", "## Issues");

  if (report.issues.length === 0) {
    lines.push("- 이슈 없음");
  } else {
    for (const issue of report.issues) {
      lines.push(`- [${issue.severity}] ${issue.slide_id ?? "global"} ${issue.rule}: ${issue.message}`);
    }
  }

  return {
    report,
    summaryMarkdown: `${lines.join("\n")}\n`
  };
}
