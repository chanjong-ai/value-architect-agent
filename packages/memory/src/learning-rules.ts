import { Feedback } from "@consulting-ppt/shared";

export function deriveLearningRules(feedback: Feedback): string[] {
  const rules = new Set<string>(feedback.actions);

  for (const comment of feedback.comments) {
    if (comment.category === "density") {
      rules.add("limit_bullets_to_5");
    }
    if (comment.category === "evidence") {
      rules.add("force_evidence_for_numeric_claims");
    }
    if (comment.category === "design") {
      rules.add("split_table_if_rows_over_9");
    }
  }

  return Array.from(rules);
}
