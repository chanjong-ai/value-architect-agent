import { describe, expect, it } from "vitest";
import { buildExecutionClock } from "@consulting-ppt/shared";
import { runThinking } from "../index";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\\(so what:[^)]+\\)/gi, "")
    .replace(/[^a-z0-9가-힣\\s]/gi, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

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

  it("places appendix slides at the end when page_count exceeds base storyline", () => {
    const brief = {
      client_name: "테스트클라이언트",
      industry: "소재",
      topic: "수익성 개선",
      target_audience: "CEO" as const,
      language: "ko-KR",
      page_count: 15,
      tone: "executive concise",
      must_include: ["실행 로드맵", "규제 대응"],
      must_avoid: ["출처 누락"],
      output_style: "consulting"
    };

    const result = runThinking(brief, "det_test_run_appendix", "test_project", {
      clock: buildExecutionClock({ deterministic: true, seed: "thinking-test-appendix", inputHash: "abc1234" })
    });

    const firstAppendixIndex = result.slideSpec.slides.findIndex((slide) => slide.type === "appendix");
    expect(firstAppendixIndex).toBeGreaterThanOrEqual(0);
    const tail = result.slideSpec.slides.slice(firstAppendixIndex);
    expect(tail.every((slide) => slide.type === "appendix")).toBe(true);
    for (const appendixSlide of tail) {
      expect(appendixSlide.governing_message.includes(`[${appendixSlide.id}]`)).toBe(true);
    }
  });

  it("generates non-duplicated claim bodies across slides", () => {
    const brief = {
      client_name: "테스트클라이언트",
      industry: "2차전지 소재",
      topic: "전략 우선순위",
      target_audience: "CEO" as const,
      language: "ko-KR",
      page_count: 13,
      tone: "executive concise",
      must_include: ["성장 전략", "리스크 대응", "실행 계획"],
      must_avoid: [],
      output_style: "consulting"
    };

    const result = runThinking(brief, "det_test_run_uniqueness", "test_project", {
      clock: buildExecutionClock({ deterministic: true, seed: "thinking-test-unique", inputHash: "abc12345" })
    });

    const seen = new Set<string>();
    for (const slide of result.slideSpec.slides) {
      for (const claim of slide.claims) {
        const key = normalizeText(claim.text);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it("builds research-rich pack and reflects research priorities in storyline", () => {
    const brief = {
      client_name: "테스트클라이언트",
      industry: "배터리 소재",
      topic: "규제 대응 중심 성장 전략",
      target_audience: "CEO" as const,
      language: "ko-KR",
      page_count: 15,
      tone: "executive detailed",
      must_include: ["IRA/CBAM 대응", "리스크 완화", "현금흐름 우선순위"],
      must_avoid: [],
      output_style: "consulting"
    };

    const result = runThinking(brief, "det_test_run_research_rich", "test_project", {
      clock: buildExecutionClock({ deterministic: true, seed: "thinking-test-research-rich", inputHash: "xyz12345" })
    });

    const sourceCountByAxis = new Map<string, number>();
    for (const source of result.researchPack.sources) {
      sourceCountByAxis.set(source.axis, (sourceCountByAxis.get(source.axis) ?? 0) + 1);
    }

    const sourceById = new Map(result.researchPack.sources.map((source) => [source.source_id, source]));
    const evidenceCountByAxis = new Map<string, number>();
    for (const evidence of result.researchPack.evidences) {
      const source = sourceById.get(evidence.source_id);
      if (!source) {
        continue;
      }
      evidenceCountByAxis.set(source.axis, (evidenceCountByAxis.get(source.axis) ?? 0) + 1);
    }

    for (const axis of ["market", "competition", "finance", "technology", "regulation", "risk"]) {
      expect((sourceCountByAxis.get(axis) ?? 0)).toBeGreaterThanOrEqual(3);
      expect((evidenceCountByAxis.get(axis) ?? 0)).toBeGreaterThanOrEqual(4);
    }

    expect(result.researchPack.normalized_tables.length).toBeGreaterThanOrEqual(8);

    const trendSlide = result.slideSpec.slides.find((slide) => slide.id === "s10");
    if (!trendSlide) {
      throw new Error("Test precondition failed: trend slide not found");
    }
    expect(trendSlide.title.includes("트렌드")).toBe(true);
    expect(trendSlide.claims.some((claim) => /리스크|규제|재무/.test(claim.text))).toBe(true);
  });
});
