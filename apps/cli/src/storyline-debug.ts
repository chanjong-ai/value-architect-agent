import { BriefNormalized, ResearchPack, SlideSpec, Source } from "@consulting-ppt/shared";
import { ThinkingReviewReport } from "@consulting-ppt/thinking";

interface NarrativeDebugSlide {
  id: string;
  type: SlideSpec["slides"][number]["type"];
  title: string;
  focus: string;
  section: "problem" | "insight" | "option" | "recommendation" | "execution" | "appendix";
}

interface StorylineDebugInput {
  runId: string;
  generatedAt: string;
  brief: BriefNormalized;
  researchPack: ResearchPack;
  slideSpec: SlideSpec;
  reviewReport: ThinkingReviewReport;
  narrativePlan: NarrativeDebugSlide[];
}

interface AxisCoverageSummary {
  axis: Source["axis"];
  source_count: number;
  evidence_count: number;
  average_reliability: number;
  latest_source_date: string;
  top_publishers: string[];
}

interface StorylineTransitionSummary {
  from_slide_id: string;
  to_slide_id: string;
  similarity: number;
  status: "ok" | "weak";
}

interface ClaimEvidenceTrace {
  claim_index: number;
  claim_text: string;
  evidence_ids: string[];
  evidences: Array<{
    evidence_id: string;
    source_id: string;
    source_axis: Source["axis"] | "unknown";
    publisher: string;
    source_date: string;
    reliability_score: number;
    url_or_ref: string;
    evidence_claim_text: string;
    numeric_values: number[];
    unit?: string;
    period?: string;
  }>;
}

interface SlideDebugBlueprint {
  page: number;
  slide_id: string;
  slide_type: SlideSpec["slides"][number]["type"];
  section: NarrativeDebugSlide["section"] | "unknown";
  narrative_title: string;
  narrative_focus: string;
  render_title: string;
  governing_message: string;
  claim_count: number;
  max_claim_chars: number;
  visuals: Array<{
    kind: string;
    data_ref?: string;
    layout_hint?: string;
    priority?: number;
  }>;
  source_footer: string[];
  claim_traces: ClaimEvidenceTrace[];
}

interface StorylineDebugDocument {
  run_id: string;
  generated_at: string;
  brief: {
    project_id: string;
    client_name: string;
    target_company: string;
    topic: string;
    industry: string;
    target_audience: string;
    page_count: number;
    competitors: string[];
  };
  research_summary: {
    source_count: number;
    evidence_count: number;
    table_count: number;
    axis_coverage: AxisCoverageSummary[];
  };
  thinking_review: ThinkingReviewReport;
  storyline_plan: NarrativeDebugSlide[];
  storyline_transitions: StorylineTransitionSummary[];
  layout_readiness: {
    average_score: number;
    risk_slides: string[];
    watch_slides: string[];
    per_slide: Array<{
      page: number;
      slide_id: string;
      slide_type: SlideSpec["slides"][number]["type"];
      avg_claim_chars: number;
      visual_count: number;
      non_text_visual_count: number;
      layout_hints: string[];
      readiness_score: number;
      status: "ready" | "watch" | "risk";
      risks: string[];
    }>;
  };
  ppt_conversion_blueprint: SlideDebugBlueprint[];
  debugging_flags: {
    duplicate_governing_message_slide_ids: string[];
    governing_tone_risk_slide_ids: string[];
    weak_transition_pairs: Array<{ from_slide_id: string; to_slide_id: string; similarity: number }>;
    claims_without_so_what: Array<{ slide_id: string; claim_index: number }>;
    claims_with_insufficient_evidence: Array<{ slide_id: string; claim_index: number; evidence_count: number }>;
  };
}

export interface StorylineDebugArtifacts {
  json: StorylineDebugDocument;
  markdown: string;
}

const AXES: Source["axis"][] = ["market", "competition", "finance", "technology", "regulation", "risk"];

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(?\s*so what:\s*([^)]+)\)?/gi, "")
    .replace(/[^a-z0-9가-힣\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function tokenJaccard(left: string[], right: string[]): number {
  const setLeft = new Set(left);
  const setRight = new Set(right);
  if (setLeft.size === 0 || setRight.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of setLeft) {
    if (setRight.has(token)) {
      intersection += 1;
    }
  }

  const union = setLeft.size + setRight.size - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function safeDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value || "unknown";
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function escapeMd(value: string): string {
  return compact(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function isConsultingToneGoverningMessage(value: string): boolean {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }
  return /(우선순위|재정렬|재설계|전환|구체화|강화|고도화|필요|해야)/.test(normalized);
}

function buildAxisCoverage(researchPack: ResearchPack): AxisCoverageSummary[] {
  const sourceById = new Map(researchPack.sources.map((source) => [source.source_id, source]));

  return AXES.map((axis) => {
    const axisSources = researchPack.sources.filter((source) => source.axis === axis);
    const axisEvidences = researchPack.evidences.filter((evidence) => {
      const source = sourceById.get(evidence.source_id);
      return source?.axis === axis;
    });

    const reliability =
      axisSources.length > 0
        ? axisSources.reduce((sum, source) => sum + source.reliability_score, 0) / axisSources.length
        : 0;

    const latestDate = axisSources
      .map((source) => safeDate(source.date))
      .sort((a, b) => b.localeCompare(a))[0] ?? "unknown";

    const publisherCount = new Map<string, number>();
    for (const source of axisSources) {
      const key = source.publisher || "unknown";
      publisherCount.set(key, (publisherCount.get(key) ?? 0) + 1);
    }

    const topPublishers = Array.from(publisherCount.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([publisher]) => publisher);

    return {
      axis,
      source_count: axisSources.length,
      evidence_count: axisEvidences.length,
      average_reliability: Number(reliability.toFixed(3)),
      latest_source_date: latestDate,
      top_publishers: topPublishers
    };
  });
}

function buildTransitions(slides: SlideSpec["slides"]): StorylineTransitionSummary[] {
  const transitions: StorylineTransitionSummary[] = [];

  for (let index = 1; index < slides.length; index += 1) {
    const prev = slides[index - 1];
    const current = slides[index];
    const similarity = tokenJaccard(
      tokenize(`${prev.title} ${prev.governing_message}`),
      tokenize(`${current.title} ${current.governing_message}`)
    );

    transitions.push({
      from_slide_id: prev.id,
      to_slide_id: current.id,
      similarity: Number(similarity.toFixed(4)),
      status: similarity < 0.03 ? "weak" : "ok"
    });
  }

  return transitions;
}

function buildLayoutReadiness(spec: SlideSpec): StorylineDebugDocument["layout_readiness"] {
  const perSlide = spec.slides.map((slide, index) => {
    const avgClaimChars = slide.claims.length > 0
      ? Math.round(slide.claims.reduce((sum, claim) => sum + claim.text.length, 0) / slide.claims.length)
      : 0;
    const visualCount = slide.visuals.length;
    const nonTextVisualCount = slide.visuals.filter((visual) => visual.kind !== "bullets").length;
    const layoutHints = Array.from(
      new Set(
        slide.visuals
          .map((visual) => (typeof visual.options?.layout_hint === "string" ? visual.options.layout_hint : ""))
          .filter((hint) => hint.length > 0)
      )
    );

    const hasExecutionVisual = slide.visuals.some((visual) => visual.kind === "timeline" || visual.kind === "flow" || visual.kind === "action-cards");
    const hasDataVisual = slide.visuals.some((visual) => visual.kind === "table" || visual.kind === "bar-chart" || visual.kind === "matrix");

    let score = 100;
    const risks: string[] = [];

    if (slide.id !== "s01" && nonTextVisualCount === 0) {
      score -= 25;
      risks.push("텍스트 외 시각요소 부족");
    }

    if (avgClaimChars > 155) {
      score -= 20;
      risks.push("평균 claim 길이가 길어 오버플로우 위험");
    } else if (avgClaimChars > 135) {
      score -= 10;
      risks.push("평균 claim 길이가 길어 밀도 주의 필요");
    }

    if (visualCount >= 4) {
      score -= 8;
      risks.push("시각요소 수가 많아 레이아웃 복잡도 상승");
    }

    if (slide.id !== "s01" && layoutHints.length === 0) {
      score -= 10;
      risks.push("layout_hint 부재로 레이아웃 선택 불확실성 증가");
    }

    if (slide.type === "roadmap" && !hasExecutionVisual) {
      score -= 12;
      risks.push("로드맵 슬라이드에 실행형 visual 부족");
    }

    if ((slide.type === "market-landscape" || slide.type === "benchmark") && !hasDataVisual) {
      score -= 10;
      risks.push("분석형 슬라이드에 데이터 visual 부족");
    }

    const bounded = Math.max(0, Math.min(100, score));
    const status: "ready" | "watch" | "risk" = bounded < 70 ? "risk" : bounded < 85 ? "watch" : "ready";

    return {
      page: index + 1,
      slide_id: slide.id,
      slide_type: slide.type,
      avg_claim_chars: avgClaimChars,
      visual_count: visualCount,
      non_text_visual_count: nonTextVisualCount,
      layout_hints: layoutHints,
      readiness_score: bounded,
      status,
      risks
    };
  });

  const averageScore = perSlide.length > 0
    ? Number((perSlide.reduce((sum, item) => sum + item.readiness_score, 0) / perSlide.length).toFixed(2))
    : 0;

  return {
    average_score: averageScore,
    risk_slides: perSlide.filter((item) => item.status === "risk").map((item) => item.slide_id),
    watch_slides: perSlide.filter((item) => item.status === "watch").map((item) => item.slide_id),
    per_slide: perSlide
  };
}

function buildBlueprint(input: StorylineDebugInput): SlideDebugBlueprint[] {
  const sourceById = new Map(input.researchPack.sources.map((source) => [source.source_id, source]));
  const evidenceById = new Map(input.researchPack.evidences.map((evidence) => [evidence.evidence_id, evidence]));
  const narrativeById = new Map(input.narrativePlan.map((slide) => [slide.id, slide]));

  return input.slideSpec.slides.map((slide, index) => {
    const narrative = narrativeById.get(slide.id);

    const claimTraces: ClaimEvidenceTrace[] = slide.claims.map((claim, claimIndex) => {
      const evidences = claim.evidence_ids.map((evidenceId) => {
        const evidence = evidenceById.get(evidenceId);
        const source = evidence ? sourceById.get(evidence.source_id) : undefined;
        const sourceAxis: Source["axis"] | "unknown" = source?.axis ?? "unknown";

        return {
          evidence_id: evidence?.evidence_id ?? evidenceId,
          source_id: evidence?.source_id ?? "unknown",
          source_axis: sourceAxis,
          publisher: source?.publisher ?? "unknown",
          source_date: source?.date ?? "unknown",
          reliability_score: source?.reliability_score ?? 0,
          url_or_ref: source?.url_or_ref ?? "",
          evidence_claim_text: evidence?.claim_text ?? "evidence not found",
          numeric_values: evidence?.numeric_values ?? [],
          unit: evidence?.unit,
          period: evidence?.period
        };
      });

      return {
        claim_index: claimIndex,
        claim_text: claim.text,
        evidence_ids: claim.evidence_ids,
        evidences
      };
    });

    const visuals = slide.visuals.map((visual) => ({
      kind: visual.kind,
      data_ref: visual.data_ref,
      layout_hint: typeof visual.options?.layout_hint === "string" ? visual.options.layout_hint : undefined,
      priority: typeof visual.options?.priority === "number" ? visual.options.priority : undefined
    }));

    return {
      page: index + 1,
      slide_id: slide.id,
      slide_type: slide.type,
      section: narrative?.section ?? "unknown",
      narrative_title: narrative?.title ?? slide.title,
      narrative_focus: narrative?.focus ?? "n/a",
      render_title: slide.title,
      governing_message: slide.governing_message,
      claim_count: slide.claims.length,
      max_claim_chars: slide.claims.reduce((max, claim) => Math.max(max, claim.text.length), 0),
      visuals,
      source_footer: slide.source_footer,
      claim_traces: claimTraces
    };
  });
}

function buildDebuggingFlags(
  slides: SlideSpec["slides"],
  transitions: StorylineTransitionSummary[]
): StorylineDebugDocument["debugging_flags"] {
  const normalizedGmSeen = new Map<string, string>();
  const duplicateGmSlideIds = new Set<string>();
  const governingToneRiskSlideIds = new Set<string>();

  const claimsWithoutSoWhat: Array<{ slide_id: string; claim_index: number }> = [];
  const claimsWithInsufficientEvidence: Array<{ slide_id: string; claim_index: number; evidence_count: number }> = [];

  for (const slide of slides) {
    if (!isConsultingToneGoverningMessage(slide.governing_message)) {
      governingToneRiskSlideIds.add(slide.id);
    }

    const key = normalizeText(slide.governing_message);
    const first = normalizedGmSeen.get(key);
    if (first) {
      duplicateGmSlideIds.add(first);
      duplicateGmSlideIds.add(slide.id);
    } else {
      normalizedGmSeen.set(key, slide.id);
    }

    slide.claims.forEach((claim, claimIndex) => {
      if (!/so what:/i.test(claim.text)) {
        claimsWithoutSoWhat.push({ slide_id: slide.id, claim_index: claimIndex });
      }
      if (claim.evidence_ids.length < 2) {
        claimsWithInsufficientEvidence.push({
          slide_id: slide.id,
          claim_index: claimIndex,
          evidence_count: claim.evidence_ids.length
        });
      }
    });
  }

  return {
    duplicate_governing_message_slide_ids: Array.from(duplicateGmSlideIds).sort(),
    governing_tone_risk_slide_ids: Array.from(governingToneRiskSlideIds).sort(),
    weak_transition_pairs: transitions
      .filter((transition) => transition.status === "weak")
      .map((transition) => ({
        from_slide_id: transition.from_slide_id,
        to_slide_id: transition.to_slide_id,
        similarity: transition.similarity
      })),
    claims_without_so_what: claimsWithoutSoWhat,
    claims_with_insufficient_evidence: claimsWithInsufficientEvidence
  };
}

function buildMarkdown(doc: StorylineDebugDocument): string {
  const lines: string[] = [];

  lines.push("# Pre-Render Storyline Debug");
  lines.push("");
  lines.push(`- run_id: ${doc.run_id}`);
  lines.push(`- generated_at: ${doc.generated_at}`);
  lines.push(`- project_id: ${doc.brief.project_id}`);
  lines.push("");

  lines.push("## Brief Context");
  lines.push("");
  lines.push(`- client: ${doc.brief.client_name}`);
  lines.push(`- target_company: ${doc.brief.target_company}`);
  lines.push(`- topic: ${doc.brief.topic}`);
  lines.push(`- industry: ${doc.brief.industry}`);
  lines.push(`- audience: ${doc.brief.target_audience}`);
  lines.push(`- page_count: ${doc.brief.page_count}`);
  lines.push(`- competitors: ${doc.brief.competitors.join(", ") || "n/a"}`);
  lines.push("");

  lines.push("## Research Coverage (for storyline confidence)");
  lines.push("");
  lines.push(`- sources: ${doc.research_summary.source_count}`);
  lines.push(`- evidences: ${doc.research_summary.evidence_count}`);
  lines.push(`- normalized_tables: ${doc.research_summary.table_count}`);
  lines.push("");
  lines.push("| axis | sources | evidences | avg_reliability | latest_source_date | top_publishers |");
  lines.push("|---|---:|---:|---:|---|---|");
  for (const row of doc.research_summary.axis_coverage) {
    lines.push(
      `| ${row.axis} | ${row.source_count} | ${row.evidence_count} | ${row.average_reliability.toFixed(3)} | ${row.latest_source_date} | ${escapeMd(row.top_publishers.join(", "))} |`
    );
  }
  lines.push("");

  lines.push("## Thinking Review Rounds");
  lines.push("");
  lines.push(`- narrative_rounds: ${doc.thinking_review.narrative_rounds}`);
  lines.push(`- content_rounds: ${doc.thinking_review.content_rounds}`);
  lines.push("");
  lines.push("| round | narrative_issues | content_issues | notes |");
  lines.push("|---:|---:|---:|---|");
  for (const row of doc.thinking_review.rounds) {
    lines.push(
      `| ${row.round} | ${row.narrative_issue_count} | ${row.content_issue_count} | ${escapeMd(row.notes.join(", "))} |`
    );
  }
  lines.push("");

  lines.push("## Storyline Plan (before PPT conversion)");
  lines.push("");
  lines.push("| page | slide_id | section | type | title | focus |");
  lines.push("|---:|---|---|---|---|---|");
  doc.storyline_plan.forEach((slide, index) => {
    lines.push(
      `| ${index + 1} | ${slide.id} | ${slide.section} | ${slide.type} | ${escapeMd(slide.title)} | ${escapeMd(slide.focus)} |`
    );
  });
  lines.push("");

  lines.push("## Storyline Transition Check");
  lines.push("");
  lines.push("| from | to | similarity | status |");
  lines.push("|---|---|---:|---|");
  for (const item of doc.storyline_transitions) {
    lines.push(`| ${item.from_slide_id} | ${item.to_slide_id} | ${item.similarity.toFixed(4)} | ${item.status} |`);
  }
  lines.push("");

  lines.push("## Layout Readiness (pre-render)");
  lines.push("");
  lines.push(`- average_score: ${doc.layout_readiness.average_score}`);
  lines.push(`- risk_slides: ${doc.layout_readiness.risk_slides.join(", ") || "none"}`);
  lines.push(`- watch_slides: ${doc.layout_readiness.watch_slides.join(", ") || "none"}`);
  lines.push("");
  lines.push("| page | slide_id | type | avg_claim_chars | visuals | non_text_visuals | hints | score | status | risks |");
  lines.push("|---:|---|---|---:|---:|---:|---|---:|---|---|");
  for (const item of doc.layout_readiness.per_slide) {
    lines.push(
      `| ${item.page} | ${item.slide_id} | ${item.slide_type} | ${item.avg_claim_chars} | ${item.visual_count} | ${item.non_text_visual_count} | ${escapeMd(item.layout_hints.join(", ") || "n/a")} | ${item.readiness_score} | ${item.status} | ${escapeMd(item.risks.join("; ") || "none")} |`
    );
  }
  lines.push("");

  lines.push("## PPT Conversion Blueprint (slide-by-slide)");
  lines.push("");

  for (const slide of doc.ppt_conversion_blueprint) {
    lines.push(`### p${String(slide.page).padStart(2, "0")} ${slide.slide_id} (${slide.slide_type})`);
    lines.push("");
    lines.push(`- section: ${slide.section}`);
    lines.push(`- narrative_title: ${escapeMd(slide.narrative_title)}`);
    lines.push(`- narrative_focus: ${escapeMd(slide.narrative_focus)}`);
    lines.push(`- render_title: ${escapeMd(slide.render_title)}`);
    lines.push(`- governing_message: ${escapeMd(slide.governing_message)}`);
    lines.push(`- claim_count: ${slide.claim_count}`);
    lines.push(`- max_claim_chars: ${slide.max_claim_chars}`);
    lines.push(
      `- visuals: ${slide.visuals
        .map((visual) => `${visual.kind}${visual.layout_hint ? `@${visual.layout_hint}` : ""}${visual.data_ref ? `#${visual.data_ref}` : ""}`)
        .join(", ") || "n/a"}`
    );
    lines.push(`- source_footer: ${slide.source_footer.join("; ") || "n/a"}`);
    lines.push("");
    lines.push("#### Claims & Evidence Trace");
    lines.push("");
    slide.claim_traces.forEach((claim) => {
      lines.push(`${claim.claim_index + 1}. ${escapeMd(claim.claim_text)}`);
      claim.evidences.forEach((evidence) => {
        lines.push(
          `   - ${evidence.evidence_id} | ${evidence.publisher} | ${evidence.source_axis} | ${evidence.source_date} | reliability=${evidence.reliability_score.toFixed(3)}`
        );
      });
    });
    lines.push("");
  }

  lines.push("## Debugging Flags");
  lines.push("");
  lines.push(`- duplicate_governing_message_slide_ids: ${doc.debugging_flags.duplicate_governing_message_slide_ids.join(", ") || "none"}`);
  lines.push(`- governing_tone_risk_slide_ids: ${doc.debugging_flags.governing_tone_risk_slide_ids.join(", ") || "none"}`);
  lines.push(
    `- weak_transition_pairs: ${doc.debugging_flags.weak_transition_pairs
      .map((pair) => `${pair.from_slide_id}->${pair.to_slide_id}(${pair.similarity.toFixed(4)})`)
      .join(", ") || "none"}`
  );
  lines.push(
    `- claims_without_so_what: ${doc.debugging_flags.claims_without_so_what
      .map((item) => `${item.slide_id}#${item.claim_index + 1}`)
      .join(", ") || "none"}`
  );
  lines.push(
    `- claims_with_insufficient_evidence: ${doc.debugging_flags.claims_with_insufficient_evidence
      .map((item) => `${item.slide_id}#${item.claim_index + 1}(${item.evidence_count})`)
      .join(", ") || "none"}`
  );

  return lines.join("\n");
}

export function buildStorylineDebugArtifacts(input: StorylineDebugInput): StorylineDebugArtifacts {
  const axisCoverage = buildAxisCoverage(input.researchPack);
  const transitions = buildTransitions(input.slideSpec.slides);
  const layoutReadiness = buildLayoutReadiness(input.slideSpec);
  const blueprint = buildBlueprint(input);

  const json: StorylineDebugDocument = {
    run_id: input.runId,
    generated_at: input.generatedAt,
    brief: {
      project_id: input.brief.project_id,
      client_name: input.brief.client_name,
      target_company: input.brief.target_company,
      topic: input.brief.topic,
      industry: input.brief.industry,
      target_audience: input.brief.target_audience,
      page_count: input.brief.page_count,
      competitors: input.brief.competitors
    },
    research_summary: {
      source_count: input.researchPack.sources.length,
      evidence_count: input.researchPack.evidences.length,
      table_count: input.researchPack.normalized_tables.length,
      axis_coverage: axisCoverage
    },
    thinking_review: input.reviewReport,
    storyline_plan: input.narrativePlan,
    storyline_transitions: transitions,
    layout_readiness: layoutReadiness,
    ppt_conversion_blueprint: blueprint,
    debugging_flags: buildDebuggingFlags(input.slideSpec.slides, transitions)
  };

  return {
    json,
    markdown: buildMarkdown(json)
  };
}
