export type TargetAudience = "CFO" | "COO" | "CIO" | "CEO" | "CSO";

export interface BriefInput {
  project_id?: string;
  client_name: string;
  industry: string;
  topic: string;
  target_company?: string;
  competitors?: string[];
  report_date?: string;
  target_audience?: TargetAudience;
  language?: string;
  page_count?: number;
  tone?: string;
  must_include?: string[];
  must_avoid?: string[];
  output_style?: string;
}

export interface BriefNormalized {
  project_id: string;
  client_name: string;
  industry: string;
  topic: string;
  target_company: string;
  competitors: string[];
  report_date: string;
  target_audience: TargetAudience;
  language: "ko-KR";
  page_count: number;
  tone: string;
  must_include: string[];
  must_avoid: string[];
  output_style: "consulting";
  constraints: {
    max_governing_message_chars: number;
    min_evidence_per_claim: number;
    max_bullets_per_slide: number;
  };
}

export interface Source {
  source_id: string;
  title: string;
  publisher: string;
  date: string;
  url_or_ref: string;
  reliability_score: number;
  axis: "market" | "competition" | "finance" | "technology" | "regulation" | "risk";
}

export interface Evidence {
  evidence_id: string;
  source_id: string;
  claim_text: string;
  numeric_values: number[];
  quote_snippet: string;
  unit?: string;
  period?: string;
}

export interface NormalizedTable {
  table_id: string;
  title: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
}

export interface ResearchPack {
  project_id: string;
  run_id: string;
  generated_at: string;
  sources: Source[];
  evidences: Evidence[];
  normalized_tables: NormalizedTable[];
}

export type SlideType =
  | "cover"
  | "exec-summary"
  | "market-landscape"
  | "benchmark"
  | "risks-issues"
  | "roadmap"
  | "appendix";

export interface SlideClaim {
  text: string;
  evidence_ids: string[];
}

export interface SlideVisual {
  kind:
    | "bullets"
    | "table"
    | "kpi-cards"
    | "matrix"
    | "timeline"
    | "bar-chart"
    | "pie-chart"
    | "flow"
    | "icon-list"
    | "action-cards"
    | "so-what-grid"
    | "insight-box";
  data_ref?: string;
  options?: Record<string, string | number | boolean | string[]>;
}

export interface SlideSpecSlide {
  id: string;
  type: SlideType;
  title: string;
  governing_message: string;
  claims: SlideClaim[];
  visuals: SlideVisual[];
  source_footer: string[];
}

export interface SlideSpec {
  meta: {
    project_id: string;
    run_id: string;
    locale: string;
    aspect_ratio: "LAYOUT_WIDE" | "LAYOUT_16x9";
    theme: string;
    created_at: string;
  };
  slides: SlideSpecSlide[];
}

export interface QAIssue {
  rule: string;
  severity: "low" | "medium" | "high";
  slide_id?: string;
  message: string;
}

export interface QABreakdown {
  structure_consistency: number;
  data_accuracy: number;
  message_clarity: number;
  visual_readability: number;
  source_completeness: number;
}

export interface QAReport {
  run_id: string;
  qa_score: number;
  threshold: number;
  passed: boolean;
  breakdown: QABreakdown;
  issues: QAIssue[];
  fail_reasons: string[];
}

export interface Manifest {
  run_id: string;
  started_at: string;
  ended_at: string;
  input_hash: string;
  research_hash: string;
  spec_hash: string;
  renderer_version: string;
  qa_score: number;
  status: "success" | "failed";
  deterministic_mode: boolean;
  deterministic_seed: string;
}

export interface FeedbackComment {
  slide_id: string;
  category: "logic" | "density" | "design" | "evidence";
  text: string;
}

export interface Feedback {
  run_id: string;
  reviewer: string;
  score_breakdown: Record<string, number>;
  comments: FeedbackComment[];
  actions: string[];
}

export interface RunPaths {
  runRoot: string;
  inputDir: string;
  researchDir: string;
  specDir: string;
  outputDir: string;
  qaDir: string;
}
