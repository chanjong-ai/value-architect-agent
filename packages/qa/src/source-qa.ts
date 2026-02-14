import { QAIssue, ResearchPack, SlideSpec } from "@consulting-ppt/shared";

export interface SourceQaResult {
  score: number;
  issues: QAIssue[];
}

export function runSourceQa(spec: SlideSpec, researchPack: ResearchPack): SourceQaResult {
  const issues: QAIssue[] = [];
  const evidenceById = new Map(researchPack.evidences.map((item) => [item.evidence_id, item]));
  const sourceById = new Map(researchPack.sources.map((item) => [item.source_id, item]));

  for (const slide of spec.slides) {
    const expectedFooters = new Set<string>();

    for (const claim of slide.claims) {
      if (claim.evidence_ids.length === 0) {
        issues.push({
          rule: "claim_without_evidence",
          severity: "high",
          slide_id: slide.id,
          message: "핵심 claim에 evidence mapping이 없습니다"
        });
      }

      const sourceIds = new Set<string>();

      for (const evidenceId of claim.evidence_ids) {
        const evidence = evidenceById.get(evidenceId);
        if (!evidence) {
          issues.push({
            rule: "unknown_evidence_id",
            severity: "high",
            slide_id: slide.id,
            message: `알 수 없는 evidence_id: ${evidenceId}`
          });
          continue;
        }

        sourceIds.add(evidence.source_id);
        const source = sourceById.get(evidence.source_id);
        if (!source) {
          issues.push({
            rule: "unknown_source_id",
            severity: "high",
            slide_id: slide.id,
            message: `알 수 없는 source_id: ${evidence.source_id}`
          });
          continue;
        }

        if (source.reliability_score < 0.75) {
          issues.push({
            rule: "low_reliability_source",
            severity: "medium",
            slide_id: slide.id,
            message: `출처 신뢰도 낮음(${source.publisher}: ${source.reliability_score})`
          });
        }

        expectedFooters.add(`${source.publisher} (${source.date})`);
      }

      if (/\d/.test(claim.text) && sourceIds.size < 2) {
        issues.push({
          rule: "single_source_numeric_claim",
          severity: "high",
          slide_id: slide.id,
          message: "수치 claim은 서로 다른 2개 이상 출처가 필요합니다"
        });
      }
    }

    if (slide.source_footer.length === 0) {
      issues.push({
        rule: "missing_source_footer",
        severity: "medium",
        slide_id: slide.id,
        message: "source_footer가 비어 있습니다"
      });
      continue;
    }

    for (const expectedFooter of expectedFooters) {
      if (!slide.source_footer.includes(expectedFooter)) {
        issues.push({
          rule: "source_footer_incomplete",
          severity: "medium",
          slide_id: slide.id,
          message: `source_footer에 누락된 출처가 있습니다: ${expectedFooter}`
        });
      }
    }
  }

  const deduction = issues.reduce((acc, issue) => {
    if (issue.severity === "high") {
      return acc + 12;
    }
    if (issue.severity === "medium") {
      return acc + 5;
    }
    return acc + 1;
  }, 0);

  return {
    score: Math.max(0, 10 - deduction),
    issues
  };
}
