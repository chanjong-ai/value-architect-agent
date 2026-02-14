import {
  BriefNormalized,
  ExecutionClock,
  PipelineError,
  ResearchPack,
  SlideSpec,
  SlideSpecSlide,
  SlideType,
  SlideVisual
} from "@consulting-ppt/shared";
import { PlannedSlide } from "./narrative-planner";

const AXIS_PRIORITY_BY_SLIDE_TYPE: Record<SlideType, Array<ResearchPack["sources"][number]["axis"]>> = {
  cover: ["market", "finance"],
  "exec-summary": ["finance", "market", "risk"],
  "market-landscape": ["market", "competition", "regulation"],
  benchmark: ["competition", "finance", "technology"],
  "risks-issues": ["risk", "regulation", "finance"],
  roadmap: ["technology", "finance", "risk"],
  appendix: ["market", "competition", "finance", "technology", "regulation", "risk"]
};

interface TableRefs {
  default: string;
  competitionRanking: string;
  targetFinance: string;
  playerCompare: string;
  techBenchmark: string;
  financeCompare: string;
}

function lower(value: string): string {
  return value.toLowerCase();
}

function resolveTableRefs(researchPack: ResearchPack): TableRefs {
  const defaultId = researchPack.normalized_tables[0]?.table_id;
  if (!defaultId) {
    throw new PipelineError("research_pack.normalized_tables must include at least one table");
  }

  const findByTitle = (patterns: string[]): string | undefined => {
    const matched = researchPack.normalized_tables.find((table) => {
      const title = lower(table.title);
      return patterns.some((pattern) => title.includes(lower(pattern)));
    });
    return matched?.table_id;
  };

  return {
    default: defaultId,
    competitionRanking: findByTitle(["경쟁 순위", "ranking", "top players", "top10"]) ?? defaultId,
    targetFinance: findByTitle(["타깃 재무", "target finance", "심층 재무", "financial detail"]) ?? defaultId,
    playerCompare: findByTitle(["플레이어 비교", "player compare", "peer compare"]) ?? defaultId,
    techBenchmark: findByTitle(["기술 벤치마크", "tech benchmark", "feature comparison"]) ?? defaultId,
    financeCompare: findByTitle(["재무 성과 비교", "financial comparison", "peer financial"]) ?? defaultId
  };
}

function visualBySlideId(slideId: string, fallbackType: SlideSpecSlide["type"], tableRefs: TableRefs): SlideVisual[] {
  const byId: Record<string, SlideVisual[]> = {
    s01: [{ kind: "bullets" }],
    s02: [{ kind: "kpi-cards" }, { kind: "bullets" }],
    s03: [{ kind: "bar-chart" }, { kind: "kpi-cards" }, { kind: "insight-box" }],
    s04: [{ kind: "matrix" }, { kind: "table", data_ref: tableRefs.competitionRanking }, { kind: "insight-box" }],
    s05: [{ kind: "table", data_ref: tableRefs.targetFinance }, { kind: "pie-chart" }, { kind: "action-cards" }, { kind: "insight-box" }],
    s06: [{ kind: "table", data_ref: tableRefs.playerCompare }],
    s07: [{ kind: "table", data_ref: tableRefs.techBenchmark }, { kind: "timeline" }],
    s08: [{ kind: "flow" }, { kind: "insight-box" }],
    s09: [{ kind: "bar-chart" }, { kind: "table", data_ref: tableRefs.financeCompare }, { kind: "insight-box" }],
    s10: [{ kind: "icon-list" }, { kind: "action-cards" }],
    s11: [{ kind: "matrix" }, { kind: "bullets" }],
    s12: [{ kind: "so-what-grid" }, { kind: "insight-box" }],
    s13: [{ kind: "timeline" }, { kind: "action-cards" }]
  };

  if (byId[slideId]) {
    return byId[slideId];
  }

  switch (fallbackType) {
    case "exec-summary":
      return [{ kind: "kpi-cards" }, { kind: "bullets" }];
    case "market-landscape":
      return [{ kind: "bar-chart" }, { kind: "table", data_ref: tableRefs.default }];
    case "benchmark":
      return [{ kind: "matrix" }, { kind: "table", data_ref: tableRefs.default }];
    case "risks-issues":
      return [{ kind: "matrix" }, { kind: "bullets" }];
    case "roadmap":
      return [{ kind: "timeline" }, { kind: "action-cards" }];
    case "appendix":
      return [{ kind: "table", data_ref: tableRefs.default }];
    case "cover":
    default:
      return [{ kind: "bullets" }];
  }
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

function collectEvidenceByAxis(researchPack: ResearchPack): Map<string, ResearchPack["evidences"]> {
  const sourceById = new Map(researchPack.sources.map((source) => [source.source_id, source]));
  const grouped = new Map<string, ResearchPack["evidences"]>();

  for (const evidence of researchPack.evidences) {
    const source = sourceById.get(evidence.source_id);
    if (!source) {
      continue;
    }

    const bucket = grouped.get(source.axis) ?? [];
    bucket.push(evidence);
    grouped.set(source.axis, bucket);
  }

  return grouped;
}

function pickCrossValidatedEvidence(
  groupedByAxis: Map<string, ResearchPack["evidences"]>,
  preferredAxes: string[],
  cursor: number
): { evidenceIds: string[]; primaryEvidence: ResearchPack["evidences"][number] | null } {
  for (const axis of preferredAxes) {
    const pool = groupedByAxis.get(axis);
    if (!pool || pool.length === 0) {
      continue;
    }

    if (pool.length === 1) {
      return {
        evidenceIds: [pool[0].evidence_id],
        primaryEvidence: pool[0]
      };
    }

    const first = pool[cursor % pool.length];
    const second = pool[(cursor + 1) % pool.length];
    const ids = first.evidence_id === second.evidence_id ? [first.evidence_id] : [first.evidence_id, second.evidence_id];

    return {
      evidenceIds: ids,
      primaryEvidence: first
    };
  }

  return {
    evidenceIds: [],
    primaryEvidence: null
  };
}

function formatClaim(
  focus: string,
  evidence: ResearchPack["evidences"][number] | null,
  audience: BriefNormalized["target_audience"],
  mustInclude: string | undefined,
  avoidTerms: string[]
): string {
  const numeric = evidence?.numeric_values?.[0];
  const metricText = numeric !== undefined && evidence
    ? `${numeric}${evidence.unit ?? ""} (${evidence.period ?? "기간 미정"})`
    : "정량 지표 보강 필요";

  const includeText = mustInclude ? `핵심 과제(${mustInclude})를 포함해` : "핵심 과제를 포함해";
  const raw = `${focus}. ${metricText} 수준의 변화가 확인되며, ${includeText} ${audience} 관점 의사결정 우선순위를 즉시 재정렬해야 한다 (So What: 실행 시 손익 개선 시점을 앞당긴다)`;

  return sanitizeWithAvoidRules(raw, avoidTerms);
}

function buildGoverningMessage(
  item: PlannedSlide,
  brief: BriefNormalized,
  primaryEvidence: ResearchPack["evidences"][number] | null,
  secondaryEvidence: ResearchPack["evidences"][number] | null
): string {
  const metricA = primaryEvidence
    ? `${primaryEvidence.numeric_values[0] ?? "N/A"}${primaryEvidence.unit ?? ""} (${primaryEvidence.period ?? "기간"})`
    : "핵심 지표A";
  const metricB = secondaryEvidence
    ? `${secondaryEvidence.numeric_values[0] ?? "N/A"}${secondaryEvidence.unit ?? ""} (${secondaryEvidence.period ?? "기간"})`
    : "핵심 지표B";

  return `${item.title}: ${metricA} + ${metricB} = ${brief.target_audience} 의사결정 우선순위 재정렬`;
}

function buildSourceFooter(
  evidenceIds: string[],
  sourceById: Map<string, ResearchPack["sources"][number]>,
  evidenceById: Map<string, ResearchPack["evidences"][number]>
): string[] {
  const sourceFooter = new Set<string>();

  for (const evidenceId of evidenceIds) {
    const evidence = evidenceById.get(evidenceId);
    const source = evidence ? sourceById.get(evidence.source_id) : undefined;
    if (!source) {
      continue;
    }
    sourceFooter.add(`${source.publisher} (${source.date})`);
  }

  return Array.from(sourceFooter);
}

export function buildSlideSpec(
  brief: BriefNormalized,
  researchPack: ResearchPack,
  plan: PlannedSlide[],
  runId: string,
  clock: ExecutionClock
): SlideSpec {
  const tableRefs = resolveTableRefs(researchPack);

  const evidenceById = new Map(researchPack.evidences.map((item) => [item.evidence_id, item]));
  const sourceById = new Map(researchPack.sources.map((item) => [item.source_id, item]));
  const groupedEvidence = collectEvidenceByAxis(researchPack);

  const mustIncludeQueue = [...brief.must_include];

  const slides = plan.map((item, index): SlideSpecSlide => {
    const preferredAxes = AXIS_PRIORITY_BY_SLIDE_TYPE[item.type] ?? ["market", "finance"];

    const firstClaimEvidence = pickCrossValidatedEvidence(groupedEvidence, preferredAxes, index * 2);
    const secondClaimEvidence = pickCrossValidatedEvidence(groupedEvidence, preferredAxes, index * 2 + 1);

    const includeForFirst = mustIncludeQueue.shift();
    const includeForSecond = mustIncludeQueue.shift();

    const firstClaimText = formatClaim(
      item.focus,
      firstClaimEvidence.primaryEvidence,
      brief.target_audience,
      includeForFirst,
      brief.must_avoid
    );

    const secondClaimText = formatClaim(
      `${brief.client_name}의 ${brief.topic} 과제는 실행 순서가 성과를 좌우한다`,
      secondClaimEvidence.primaryEvidence,
      brief.target_audience,
      includeForSecond,
      brief.must_avoid
    );

    const claims = [
      {
        text: firstClaimText,
        evidence_ids: firstClaimEvidence.evidenceIds
      },
      {
        text: secondClaimText,
        evidence_ids: secondClaimEvidence.evidenceIds
      }
    ];

    const allEvidenceIds = claims.flatMap((claim) => claim.evidence_ids);

    return {
      id: item.id,
      type: item.type,
      title: sanitizeWithAvoidRules(item.title, brief.must_avoid),
      governing_message: sanitizeWithAvoidRules(
        buildGoverningMessage(item, brief, firstClaimEvidence.primaryEvidence, secondClaimEvidence.primaryEvidence),
        brief.must_avoid
      ),
      claims,
      visuals: visualBySlideId(item.id, item.type, tableRefs),
      source_footer: buildSourceFooter(allEvidenceIds, sourceById, evidenceById)
    };
  });

  return {
    meta: {
      project_id: brief.project_id,
      run_id: runId,
      locale: brief.language,
      aspect_ratio: "LAYOUT_16x9",
      theme: "consulting_kr_blue",
      created_at: clock.nowIso
    },
    slides
  };
}
