import { BriefInput, BriefNormalized } from "@consulting-ppt/shared";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function clampPageCount(value: number | undefined): number {
  if (!value) {
    return 13;
  }
  return Math.max(13, Math.min(20, value));
}

function defaultReportDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function cleanList(values: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
}

function detectToneProfile(tone: string): "concise" | "deep" {
  const lowered = tone.toLowerCase();
  if (lowered.includes("deep") || lowered.includes("detailed") || lowered.includes("심화")) {
    return "deep";
  }
  return "concise";
}

export function normalizeBrief(input: BriefInput, projectIdOverride?: string): BriefNormalized {
  const fallbackProject = slugify(`${input.client_name}-${input.topic}`);
  const mustInclude = cleanList(input.must_include);
  const mustAvoid = cleanList(input.must_avoid);
  const competitors = cleanList(input.competitors).slice(0, 5);

  const tone = input.tone ?? "executive concise";
  const toneProfile = detectToneProfile(tone);

  return {
    project_id: projectIdOverride ?? input.project_id ?? fallbackProject,
    client_name: input.client_name,
    industry: input.industry,
    topic: input.topic,
    target_company: input.target_company ?? input.client_name,
    competitors,
    report_date: input.report_date ?? defaultReportDate(),
    target_audience: input.target_audience ?? "CFO",
    language: "ko-KR",
    page_count: clampPageCount(input.page_count),
    tone,
    must_include: mustInclude,
    must_avoid: mustAvoid,
    output_style: "consulting",
    constraints: {
      max_governing_message_chars: toneProfile === "deep" ? 108 : 92,
      min_evidence_per_claim: 2,
      max_bullets_per_slide: toneProfile === "deep" ? 6 : 5
    }
  };
}
