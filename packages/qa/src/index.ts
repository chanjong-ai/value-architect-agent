import { QAReport, ResearchPack, SlideSpec } from "@consulting-ppt/shared";
import { runDataQa } from "./data-qa";
import { runLayoutQa } from "./layout-qa";
import { totalScore } from "./scoring";
import { runSourceQa } from "./source-qa";
import { runTextQa } from "./text-qa";

export interface QaExecutionOptions {
  threshold?: number;
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
