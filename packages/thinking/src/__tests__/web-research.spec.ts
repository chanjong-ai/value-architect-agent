import { describe, expect, it } from "vitest";
import { buildTrustedWebResearchPlan, mergeResearchPacks } from "../web-research";

describe("web research plan", () => {
  it("builds at least 30 trusted targets with balanced axis coverage", () => {
    const plan = buildTrustedWebResearchPlan(30);
    expect(plan.length).toBeGreaterThanOrEqual(30);

    const axisCount = new Map<string, number>();
    for (const target of plan) {
      axisCount.set(target.axis, (axisCount.get(target.axis) ?? 0) + 1);
      expect(target.url.startsWith("https://")).toBe(true);
      expect(target.domain.length).toBeGreaterThan(0);
    }

    for (const axis of ["market", "competition", "finance", "technology", "regulation", "risk"]) {
      expect(axisCount.get(axis) ?? 0).toBeGreaterThanOrEqual(5);
    }
  });

  it("merges research packs and drops evidences with missing sources", () => {
    const merged = mergeResearchPacks("project", "run", "2026-02-15T00:00:00.000Z", [
      {
        project_id: "project",
        run_id: "run",
        generated_at: "2026-02-15T00:00:00.000Z",
        sources: [
          {
            source_id: "s1",
            title: "A",
            publisher: "IEA",
            date: "2026-02-01",
            url_or_ref: "https://www.iea.org",
            reliability_score: 0.95,
            axis: "market"
          }
        ],
        evidences: [
          {
            evidence_id: "e1",
            source_id: "s1",
            claim_text: "claim",
            numeric_values: [1],
            quote_snippet: "snippet",
            unit: "%",
            period: "2026.02"
          },
          {
            evidence_id: "e2",
            source_id: "missing",
            claim_text: "invalid",
            numeric_values: [2],
            quote_snippet: "snippet",
            unit: "%",
            period: "2026.02"
          }
        ],
        normalized_tables: [
          {
            table_id: "t1",
            title: "T1",
            columns: ["A"],
            rows: [{ A: 1 }]
          }
        ]
      },
      {
        project_id: "project",
        run_id: "run",
        generated_at: "2026-02-15T00:00:00.000Z",
        sources: [
          {
            source_id: "s2",
            title: "B",
            publisher: "World Bank",
            date: "2026-02-02",
            url_or_ref: "https://www.worldbank.org",
            reliability_score: 0.94,
            axis: "finance"
          }
        ],
        evidences: [
          {
            evidence_id: "e3",
            source_id: "s2",
            claim_text: "claim2",
            numeric_values: [3],
            quote_snippet: "snippet2",
            unit: "%",
            period: "2026.02"
          }
        ],
        normalized_tables: [
          {
            table_id: "t2",
            title: "T2",
            columns: ["B"],
            rows: [{ B: 2 }]
          }
        ]
      }
    ]);

    expect(merged).toBeDefined();
    expect(merged?.sources.length).toBe(2);
    expect(merged?.evidences.map((item) => item.evidence_id)).toEqual(["e1", "e3"]);
    expect(merged?.normalized_tables.length).toBe(2);
  });
});
