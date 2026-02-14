import { QAIssue, ResearchPack, SlideSpec } from "@consulting-ppt/shared";

export interface DataQaResult {
  score: number;
  issues: QAIssue[];
}

export function runDataQa(spec: SlideSpec, researchPack: ResearchPack): DataQaResult {
  const issues: QAIssue[] = [];
  const evidenceById = new Map(researchPack.evidences.map((item) => [item.evidence_id, item]));
  const tableIds = new Set(researchPack.normalized_tables.map((table) => table.table_id));

  for (const slide of spec.slides) {
    for (const visual of slide.visuals) {
      if (visual.kind !== "table") {
        continue;
      }

      if (!visual.data_ref) {
        issues.push({
          rule: "table_data_ref_missing",
          severity: "high",
          slide_id: slide.id,
          message: "table 시각 요소에 data_ref가 없습니다"
        });
        continue;
      }

      if (!tableIds.has(visual.data_ref)) {
        issues.push({
          rule: "table_data_ref_mismatch",
          severity: "high",
          slide_id: slide.id,
          message: `알 수 없는 table data_ref: ${visual.data_ref}`
        });
      }
    }

    for (const claim of slide.claims) {
      const numericInClaim = /\d/.test(claim.text);
      const evidences = claim.evidence_ids
        .map((id) => evidenceById.get(id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      if (numericInClaim && evidences.length < 2) {
        issues.push({
          rule: "numeric_cross_validation_missing",
          severity: "high",
          slide_id: slide.id,
          message: "수치 claim은 최소 2개 근거로 교차검증되어야 합니다"
        });
      }

      for (const evidence of evidences) {
        if (!evidence.unit) {
          issues.push({
            rule: "missing_unit",
            severity: "medium",
            slide_id: slide.id,
            message: `evidence ${evidence.evidence_id}에 단위(unit)가 없습니다`
          });
        }

        if (!evidence.period) {
          issues.push({
            rule: "missing_period",
            severity: "medium",
            slide_id: slide.id,
            message: `evidence ${evidence.evidence_id}에 기간(period)이 없습니다`
          });
        }
      }

      const uniquePeriods = new Set(evidences.map((evidence) => evidence.period).filter(Boolean));
      if (uniquePeriods.size > 1) {
        issues.push({
          rule: "period_inconsistency",
          severity: "medium",
          slide_id: slide.id,
          message: "동일 claim 내 evidence 간 기간이 불일치합니다"
        });
      }

      if (evidences.length >= 2) {
        const values = evidences.flatMap((evidence) => evidence.numeric_values);
        if (values.length >= 2) {
          const max = Math.max(...values);
          const min = Math.min(...values);
          if (min > 0 && (max - min) / min > 0.5) {
            issues.push({
              rule: "cross_validation_gap",
              severity: "low",
              slide_id: slide.id,
              message: "교차 근거 수치 편차가 커 해석 유의가 필요합니다"
            });
          }
        }
      }
    }
  }

  const deduction = issues.reduce((acc, issue) => {
    if (issue.severity === "high") {
      return acc + 10;
    }
    if (issue.severity === "medium") {
      return acc + 5;
    }
    return acc + 2;
  }, 0);

  return {
    score: Math.max(0, 30 - deduction),
    issues
  };
}
