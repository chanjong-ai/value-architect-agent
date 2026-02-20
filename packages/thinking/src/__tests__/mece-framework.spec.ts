import { describe, expect, it } from "vitest";
import { buildExecutionClock } from "@consulting-ppt/shared";
import { buildMECEFramework, formatMECEReport } from "../mece-framework";
import { runThinking } from "../index";

// ────────────────────────────────────────
// 공통 픽스처
// ────────────────────────────────────────

function makeMinimalBrief() {
  return {
    client_name: "테스트클라이언트",
    industry: "소재",
    topic: "수익성 개선",
    target_company: "테스트클라이언트",
    competitors: [],
    report_date: "2026-01-01",
    target_audience: "CFO" as const,
    language: "ko-KR",
    page_count: 13,
    tone: "executive concise",
    must_include: ["CAPEX 우선순위", "수익성 개선"],
    must_avoid: [],
    output_style: "consulting" as const,
    constraints: {
      max_governing_message_chars: 92,
      min_evidence_per_claim: 2,
      max_bullets_per_slide: 4
    },
    project_id: "test-mece"
  };
}

describe("buildMECEFramework", () => {
  it("모든 6개 축에 대한 문제 분해를 생성한다", () => {
    const brief = makeMinimalBrief();
    const thinking = runThinking(
      { client_name: "테스트클라이언트", industry: "소재", topic: "수익성 개선", target_audience: "CFO" },
      "mece-test-run",
      "test-project",
      { clock: buildExecutionClock({ deterministic: true, seed: "mece-test", inputHash: "mece001" }) }
    );

    const result = buildMECEFramework(thinking.brief, thinking.researchPack, thinking.slideSpec);

    // 6개 축 전부 생성 확인
    expect(result.problemDecomposition).toHaveLength(6);

    const axes = result.problemDecomposition.map((p) => p.axis);
    expect(axes).toContain("market");
    expect(axes).toContain("competition");
    expect(axes).toContain("finance");
    expect(axes).toContain("technology");
    expect(axes).toContain("regulation");
    expect(axes).toContain("risk");
  });

  it("각 축의 하위 범주는 4개로 구성된다 (MECE 원칙: 상호 배타적)", () => {
    const brief = makeMinimalBrief();
    const thinking = runThinking(
      { client_name: "테스트클라이언트", industry: "소재", topic: "수익성 개선" },
      "mece-categories-run",
      "test-project",
      { clock: buildExecutionClock({ deterministic: true, seed: "mece-cat", inputHash: "mece002" }) }
    );

    const result = buildMECEFramework(thinking.brief, thinking.researchPack);

    for (const category of result.problemDecomposition) {
      expect(category.categories.length).toBe(4);
      // 중복 범주 없음 (상호 배타적)
      const unique = new Set(category.categories);
      expect(unique.size).toBe(4);
    }
  });

  it("4대 레버 권고안 공간을 생성한다 (cost/revenue/assets/growth)", () => {
    const brief = makeMinimalBrief();
    const thinking = runThinking(
      { client_name: "테스트클라이언트", industry: "소재", topic: "수익성 개선", target_audience: "CFO" },
      "mece-levers-run",
      "test-project",
      { clock: buildExecutionClock({ deterministic: true, seed: "mece-levers", inputHash: "mece003" }) }
    );

    const result = buildMECEFramework(thinking.brief, thinking.researchPack, thinking.slideSpec);

    expect(result.recommendationSpace).toHaveLength(4);
    const levers = result.recommendationSpace.map((r) => r.lever);
    expect(levers).toContain("cost");
    expect(levers).toContain("revenue");
    expect(levers).toContain("assets");
    expect(levers).toContain("growth");

    // 각 레버는 최소 1개 이니셔티브 보유
    for (const category of result.recommendationSpace) {
      expect(category.initiatives.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("spec이 있을 때 커버리지 점수가 0~100 범위 내에 있다", () => {
    const thinking = runThinking(
      { client_name: "테스트클라이언트", industry: "소재", topic: "수익성 개선" },
      "mece-coverage-run",
      "test-project",
      { clock: buildExecutionClock({ deterministic: true, seed: "mece-cov", inputHash: "mece004" }) }
    );

    const result = buildMECEFramework(thinking.brief, thinking.researchPack, thinking.slideSpec);

    expect(result.coverageScore).toBeGreaterThanOrEqual(0);
    expect(result.coverageScore).toBeLessThanOrEqual(100);
  });

  it("데이터 강도 기준으로 problemDecomposition이 내림차순 정렬된다", () => {
    const thinking = runThinking(
      { client_name: "테스트클라이언트", industry: "소재", topic: "수익성 개선" },
      "mece-sort-run",
      "test-project",
      { clock: buildExecutionClock({ deterministic: true, seed: "mece-sort", inputHash: "mece005" }) }
    );

    const result = buildMECEFramework(thinking.brief, thinking.researchPack);

    for (let i = 1; i < result.problemDecomposition.length; i += 1) {
      expect(result.problemDecomposition[i - 1]!.dataStrength).toBeGreaterThanOrEqual(
        result.problemDecomposition[i]!.dataStrength
      );
    }
  });

  it("ThinkingResult에 meceFramework가 포함된다", () => {
    const result = runThinking(
      { client_name: "테스트클라이언트", industry: "소재", topic: "수익성 개선" },
      "mece-integrated-run",
      "test-project",
      { clock: buildExecutionClock({ deterministic: true, seed: "mece-int", inputHash: "mece006" }) }
    );

    expect(result.meceFramework).toBeDefined();
    expect(result.meceFramework.problemDecomposition).toHaveLength(6);
    expect(result.meceFramework.recommendationSpace).toHaveLength(4);
    expect(result.meceFramework.coverageScore).toBeGreaterThanOrEqual(0);
    expect(result.meceFramework.gaps).toBeInstanceOf(Array);
    expect(result.meceFramework.redundancies).toBeInstanceOf(Array);
  });
});

describe("formatMECEReport", () => {
  it("마크다운 형식의 리포트를 생성한다", () => {
    const thinking = runThinking(
      { client_name: "테스트클라이언트", industry: "소재", topic: "수익성 개선" },
      "mece-fmt-run",
      "test-project",
      { clock: buildExecutionClock({ deterministic: true, seed: "mece-fmt", inputHash: "mece007" }) }
    );

    const mece = buildMECEFramework(thinking.brief, thinking.researchPack, thinking.slideSpec);
    const report = formatMECEReport(mece);

    expect(report).toContain("## MECE Framework Report");
    expect(report).toContain("Coverage Score:");
    expect(report).toContain("문제 분해 (Problem Decomposition)");
    expect(report).toContain("권고안 공간 (Recommendation Space");
  });
});
