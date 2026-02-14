import { BriefNormalized, ResearchPack, SlideSpec } from "@consulting-ppt/shared";

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars - 3)}...`;
}

function sanitizeWithAvoidRules(text: string, avoidTerms: string[]): string {
  let sanitized = text;
  for (const term of avoidTerms) {
    if (!term.trim()) {
      continue;
    }
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    sanitized = sanitized.replace(new RegExp(escaped, "gi"), "검증 데이터");
  }
  return sanitized;
}

function ensureSoWhat(text: string): string {
  if (text.includes("So What:")) {
    return text;
  }
  return `${text} (So What: 의사결정과 실행 우선순위가 명확해진다)`;
}

function ensureMustIncludeCoverage(spec: SlideSpec, brief: BriefNormalized): void {
  const combinedTexts = spec.slides
    .flatMap((slide) => [slide.title, slide.governing_message, ...slide.claims.map((claim) => claim.text)])
    .join("\n");

  const uncovered = brief.must_include.filter((keyword) => !combinedTexts.includes(keyword));
  if (uncovered.length === 0) {
    return;
  }

  const targetSlide = spec.slides.find((slide) => slide.type === "roadmap") ?? spec.slides[spec.slides.length - 1];
  for (const keyword of uncovered) {
    targetSlide.claims.push({
      text: `${keyword}를 실행 항목에 반영해 성과 추적 지표를 명확화한다 (So What: 실행 누락 리스크를 낮춘다)`,
      evidence_ids: targetSlide.claims[0]?.evidence_ids ?? []
    });
  }
}

export function runSelfCritic(spec: SlideSpec, brief: BriefNormalized, research: ResearchPack): SlideSpec {
  const evidenceById = new Map(research.evidences.map((item) => [item.evidence_id, item]));
  const sourceById = new Map(research.sources.map((item) => [item.source_id, item]));

  for (let pass = 0; pass < 2; pass += 1) {
    const seenGm = new Set<string>();

    for (const slide of spec.slides) {
      slide.governing_message = sanitizeWithAvoidRules(slide.governing_message, brief.must_avoid);
      slide.governing_message = truncate(slide.governing_message, brief.constraints.max_governing_message_chars);

      if (seenGm.has(slide.governing_message)) {
        slide.governing_message = truncate(
          `${slide.governing_message} | ${slide.title}`,
          brief.constraints.max_governing_message_chars
        );
      }
      seenGm.add(slide.governing_message);

      slide.claims = slide.claims.slice(0, brief.constraints.max_bullets_per_slide);

      for (const claim of slide.claims) {
        claim.text = ensureSoWhat(sanitizeWithAvoidRules(claim.text, brief.must_avoid));

        if (claim.evidence_ids.length < brief.constraints.min_evidence_per_claim) {
          const fallback = research.evidences.slice(0, brief.constraints.min_evidence_per_claim).map((item) => item.evidence_id);
          claim.evidence_ids = fallback;
        }
      }

      if (slide.source_footer.length === 0) {
        const fallbackSources = new Set<string>();
        for (const claim of slide.claims) {
          for (const evidenceId of claim.evidence_ids) {
            const evidence = evidenceById.get(evidenceId);
            const source = evidence ? sourceById.get(evidence.source_id) : undefined;
            if (source) {
              fallbackSources.add(`${source.publisher} (${source.date})`);
            }
          }
        }
        slide.source_footer = Array.from(fallbackSources);
      }

      slide.source_footer = Array.from(new Set(slide.source_footer)).sort();
    }

    ensureMustIncludeCoverage(spec, brief);
  }

  return spec;
}
