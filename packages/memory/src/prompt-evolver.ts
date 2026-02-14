import { BriefNormalized } from "@consulting-ppt/shared";

export function evolveBriefWithRules(brief: BriefNormalized, rules: string[]): BriefNormalized {
  const next = { ...brief, constraints: { ...brief.constraints } };

  if (rules.includes("limit_bullets_to_5")) {
    next.constraints.max_bullets_per_slide = Math.min(next.constraints.max_bullets_per_slide, 5);
  }

  if (rules.includes("force_evidence_for_numeric_claims")) {
    next.constraints.min_evidence_per_claim = Math.max(next.constraints.min_evidence_per_claim, 2);
  }

  if (rules.includes("tighten_governing_message")) {
    next.constraints.max_governing_message_chars = Math.min(next.constraints.max_governing_message_chars, 72);
  }

  return next;
}
