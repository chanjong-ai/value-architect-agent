import { nowIso, ResearchPack, SlideSpec } from "@consulting-ppt/shared";

export interface SlideProvenance {
  slide_id: string;
  title: string;
  claims: Array<{
    text: string;
    evidences: Array<{
      evidence_id: string;
      source_id: string;
      source_title: string;
      publisher: string;
      source_date: string;
      claim_text: string;
      numeric_values: number[];
      unit: string;
      period: string;
      quote_snippet: string;
    }>;
  }>;
  source_footer: string[];
}

export function buildDetailedProvenance(
  runId: string,
  spec: SlideSpec,
  researchPack?: ResearchPack,
  generatedAt?: string
): {
  run_id: string;
  generated_at: string;
  slides: SlideProvenance[];
} {
  const sourceById = new Map(researchPack?.sources.map((source) => [source.source_id, source]) ?? []);
  const evidenceById = new Map(researchPack?.evidences.map((evidence) => [evidence.evidence_id, evidence]) ?? []);

  return {
    run_id: runId,
    generated_at: generatedAt ?? nowIso(),
    slides: spec.slides.map((slide) => ({
      slide_id: slide.id,
      title: slide.title,
      claims: slide.claims.map((claim) => ({
        text: claim.text,
        evidences: claim.evidence_ids.map((evidenceId) => {
          const evidence = evidenceById.get(evidenceId);
          const source = evidence ? sourceById.get(evidence.source_id) : undefined;

          return {
            evidence_id: evidenceId,
            source_id: evidence?.source_id ?? "unknown",
            source_title: source?.title ?? "unknown",
            publisher: source?.publisher ?? "unknown",
            source_date: source?.date ?? "unknown",
            claim_text: evidence?.claim_text ?? "unknown",
            numeric_values: evidence?.numeric_values ?? [],
            unit: evidence?.unit ?? "",
            period: evidence?.period ?? "",
            quote_snippet: evidence?.quote_snippet ?? ""
          };
        })
      })),
      source_footer: slide.source_footer
    }))
  };
}
