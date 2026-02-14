import { describe, expect, it } from "vitest";
import { buildExecutionClock } from "@consulting-ppt/shared";
import { runThinking } from "@consulting-ppt/thinking";
import { runQa } from "../index";

describe("runQa", () => {
  const thinking = runThinking(
    {
      client_name: "테스트클라이언트",
      industry: "소재",
      topic: "수익성 개선",
      target_audience: "CFO",
      language: "ko-KR",
      page_count: 13,
      tone: "executive concise",
      must_include: ["실행 로드맵"],
      must_avoid: ["출처 누락"],
      output_style: "consulting"
    },
    "qa_test_run",
    "qa_project",
    {
      clock: buildExecutionClock({ deterministic: true, seed: "qa-test", inputHash: "xyz987" })
    }
  );

  it("passes for healthy spec", () => {
    const result = runQa("qa_test_run", thinking.slideSpec, thinking.researchPack, { threshold: 80 });
    expect(result.report.passed).toBe(true);
    expect(result.report.qa_score).toBeGreaterThanOrEqual(80);
  });

  it("fails when evidence mapping is removed", () => {
    const brokenSpec = JSON.parse(JSON.stringify(thinking.slideSpec)) as typeof thinking.slideSpec;
    brokenSpec.slides[0].claims[0].evidence_ids = [];

    const result = runQa("qa_test_run", brokenSpec, thinking.researchPack, { threshold: 95 });
    expect(result.report.passed).toBe(false);
    expect(result.report.fail_reasons.length).toBeGreaterThan(0);
  });

  it("flags table data_ref mismatch", () => {
    const brokenSpec = JSON.parse(JSON.stringify(thinking.slideSpec)) as typeof thinking.slideSpec;
    const tableSlide = brokenSpec.slides.find((slide) => slide.visuals.some((visual) => visual.kind === "table"));
    if (!tableSlide) {
      throw new Error("Test precondition failed: no table visual slide");
    }

    const tableVisual = tableSlide.visuals.find((visual) => visual.kind === "table");
    if (!tableVisual) {
      throw new Error("Test precondition failed: table visual not found");
    }

    tableVisual.data_ref = "unknown_table_id";

    const result = runQa("qa_test_run", brokenSpec, thinking.researchPack, { threshold: 95 });
    expect(result.report.passed).toBe(false);
    expect(result.report.issues.some((issue) => issue.rule === "table_data_ref_mismatch")).toBe(true);
  });
});
