import { QABreakdown } from "@consulting-ppt/shared";

export function totalScore(breakdown: QABreakdown): number {
  return (
    breakdown.structure_consistency +
    breakdown.data_accuracy +
    breakdown.message_clarity +
    breakdown.visual_readability +
    breakdown.source_completeness
  );
}
