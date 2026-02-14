import { describe, expect, it } from "vitest";
import { buildExecutionClock } from "@consulting-ppt/shared";
import { runThinking } from "../index";

describe("runThinking", () => {
  it("builds validated spec with evidence mapping and source footer", () => {
    const brief = {
      client_name: "테스트클라이언트",
      industry: "소재",
      topic: "수익성 개선",
      target_audience: "CFO" as const,
      language: "ko-KR",
      page_count: 13,
      tone: "executive concise",
      must_include: ["수익성 개선 드라이버", "CAPEX 우선순위"],
      must_avoid: ["근거 없는 시장 전망"],
      output_style: "consulting"
    };

    const result = runThinking(brief, "det_test_run", "test_project", {
      clock: buildExecutionClock({ deterministic: true, seed: "thinking-test", inputHash: "abc123" })
    });
    const tableIds = new Set(result.researchPack.normalized_tables.map((table) => table.table_id));

    expect(result.slideSpec.slides.length).toBeGreaterThanOrEqual(13);
    expect(result.slideSpec.slides.length).toBeLessThanOrEqual(20);

    for (const slide of result.slideSpec.slides) {
      expect(slide.source_footer.length).toBeGreaterThan(0);
      for (const claim of slide.claims) {
        expect(claim.evidence_ids.length).toBeGreaterThanOrEqual(2);
        expect(claim.text.includes("So What:")).toBe(true);
      }

      for (const visual of slide.visuals) {
        if (visual.kind !== "table") {
          continue;
        }
        expect(typeof visual.data_ref).toBe("string");
        expect(tableIds.has(visual.data_ref ?? "")).toBe(true);
      }
    }
  });
});
