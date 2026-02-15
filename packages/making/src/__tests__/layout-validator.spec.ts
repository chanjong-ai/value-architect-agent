import { describe, expect, it } from "vitest";
import { SlideSpec } from "@consulting-ppt/shared";
import { prepareSpecWithLayoutValidation } from "../renderer/pptxgen/layout-validator";

const SAMPLE_SPEC: SlideSpec = {
  meta: {
    project_id: "sample",
    run_id: "run-1",
    locale: "ko-KR",
    aspect_ratio: "LAYOUT_16x9",
    theme: "consulting_kr_blue",
    created_at: "2026-02-15T00:00:00.000Z"
  },
  slides: [
    {
      id: "s01",
      type: "cover",
      title: "Cover",
      governing_message: "핵심 메시지",
      claims: [
        { text: "진단: 시장은 확대 중이다 (So What: 투자 타이밍이 중요하다)", evidence_ids: ["e1", "e2"] },
        { text: "해석: 경쟁은 심화 중이다 (So What: 차별화가 필요하다)", evidence_ids: ["e1", "e2"] },
        { text: "실행: 단계별 대응이 필요하다 (So What: 실행 속도를 높인다)", evidence_ids: ["e1", "e2"] }
      ],
      visuals: [{ kind: "insight-box", options: { layout_hint: "cover-hero", priority: 1 } }],
      source_footer: ["Source A (2026-01-01)"]
    },
    {
      id: "s02",
      type: "exec-summary",
      title: "Executive Summary",
      governing_message: "핵심 지표와 실행 과제를 단일 페이지에서 연결한다",
      claims: [
        {
          text: "진단: 긴 본문 테스트를 위해 문장을 확장한다. 숫자와 조건을 함께 기술해도 텍스트가 과도하게 절단되지 않아야 한다 (So What: 의사결정 우선순위를 명확히 한다)",
          evidence_ids: ["e1", "e2"]
        },
        {
          text: "해석: 본문 길이가 길어도 레이아웃 검증 패스를 통해 적합한 템플릿이 선택되어야 한다 (So What: 페이지 가독성을 유지한다)",
          evidence_ids: ["e1", "e2"]
        },
        {
          text: "실행: KPI와 액션카드를 함께 배치할 때 텍스트와 레이아웃 간 충돌이 줄어들어야 한다 (So What: 메시지 전달력을 높인다)",
          evidence_ids: ["e1", "e2"]
        }
      ],
      visuals: [
        { kind: "kpi-cards", options: { layout_hint: "kpi-dashboard", priority: 1 } },
        { kind: "action-cards", options: { layout_hint: "kpi-dashboard", priority: 2 } },
        { kind: "bullets", options: { layout_hint: "kpi-dashboard", priority: 3 } }
      ],
      source_footer: ["Source B (2026-01-01)"]
    }
  ]
};

describe("layout-validator", () => {
  it("supports agentic local planner without external API keys", async () => {
    const result = await prepareSpecWithLayoutValidation(SAMPLE_SPEC, { provider: "agentic" });
    expect(result.decisions).toHaveLength(SAMPLE_SPEC.slides.length);
    expect(result.decisions[0]?.provider).toBe("agentic");
    expect(result.decisions[1]?.provider).toBe("agentic");
    expect(result.decisions[1]?.template).toBeTruthy();
  });

  it("returns decisions and effective spec for every slide", async () => {
    const result = await prepareSpecWithLayoutValidation(SAMPLE_SPEC, { provider: "heuristic" });
    expect(result.decisions).toHaveLength(SAMPLE_SPEC.slides.length);
    expect(result.effectiveSpec.slides).toHaveLength(SAMPLE_SPEC.slides.length);
    expect(result.decisions[1]?.slide_id).toBe("s02");
    expect(result.decisions[1]?.fit_score_after).toBeGreaterThan(0);
  });

  it("runs multi-round pre-render review and applies anti-repetition fixes", async () => {
    const repeated: SlideSpec = {
      ...SAMPLE_SPEC,
      slides: [
        SAMPLE_SPEC.slides[0],
        {
          ...SAMPLE_SPEC.slides[1],
          id: "s02",
          title: "중복 테스트 1",
          governing_message: "반복 메시지 테스트",
          claims: [
            { text: "진단: 동일 문장 테스트 (So What: 동일)", evidence_ids: ["e1", "e2"] },
            { text: "해석: 동일 문장 테스트 (So What: 동일)", evidence_ids: ["e1", "e2"] },
            { text: "실행: 동일 문장 테스트 (So What: 동일)", evidence_ids: ["e1", "e2"] }
          ]
        },
        {
          ...SAMPLE_SPEC.slides[1],
          id: "s03",
          title: "중복 테스트 2",
          governing_message: "반복 메시지 테스트",
          claims: [
            { text: "진단: 동일 문장 테스트 (So What: 동일)", evidence_ids: ["e1", "e2"] },
            { text: "해석: 동일 문장 테스트 (So What: 동일)", evidence_ids: ["e1", "e2"] },
            { text: "실행: 동일 문장 테스트 (So What: 동일)", evidence_ids: ["e1", "e2"] }
          ]
        }
      ]
    };

    const result = await prepareSpecWithLayoutValidation(repeated, { provider: "heuristic" });
    expect(result.decisions.some((decision) => decision.review_round >= 2)).toBe(true);
    expect(result.decisions.some((decision) => decision.review_notes.length > 0)).toBe(true);
    expect(result.effectiveSpec.slides[2]?.claims[0]?.text.includes("중복 테스트 2")).toBe(true);
  });

  it("normalizes malformed So What segments during pre-render review", async () => {
    const malformed: SlideSpec = {
      ...SAMPLE_SPEC,
      slides: [
        {
          ...SAMPLE_SPEC.slides[0],
          claims: [
            { text: "진단: 테스트 문장 So What: 포맷이 깨진 상태", evidence_ids: ["e1", "e2"] },
            { text: "해석: 테스트 문장 (So What: 형식 복구 필요", evidence_ids: ["e1", "e2"] },
            { text: "실행: 테스트 문장", evidence_ids: ["e1", "e2"] }
          ]
        },
        SAMPLE_SPEC.slides[1]
      ]
    };

    const result = await prepareSpecWithLayoutValidation(malformed, { provider: "heuristic" });
    const claimTexts = result.effectiveSpec.slides[0]?.claims.map((claim) => claim.text) ?? [];
    for (const claimText of claimTexts) {
      expect(claimText.includes("(So What:")).toBe(true);
      expect(claimText.endsWith(")")).toBe(true);
    }
  });

  it("rewrites overly long governing messages into consulting tone without unresolved tone issues", async () => {
    const longToneSpec: SlideSpec = {
      ...SAMPLE_SPEC,
      slides: SAMPLE_SPEC.slides.map((slide, index) => ({
        ...slide,
        id: `tone-${index + 1}`,
        governing_message:
          "시장 데이터와 운영 지표를 함께 검토한 결과 다양한 시사점이 도출되었고 이를 기반으로 폭넓은 논의가 필요하다는 점을 확인했다"
      }))
    };

    const result = await prepareSpecWithLayoutValidation(longToneSpec, { provider: "heuristic" });
    const unresolvedTone = result.decisions.flatMap((decision) =>
      decision.review_notes.filter((note) => note === "unresolved:governing_tone")
    );

    expect(unresolvedTone).toHaveLength(0);
    for (const slide of result.effectiveSpec.slides) {
      expect(slide.governing_message).toMatch(/(우선순위|재정렬|재설계|전환|구체화|강화|고도화|필요|해야)/);
    }
  });
});
