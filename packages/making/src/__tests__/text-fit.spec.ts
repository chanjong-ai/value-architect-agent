import { describe, expect, it } from "vitest";
import {
  fitClaimPreserveSoWhat,
  fitGoverningMessagePreserveDecision,
  fitTextToCapacity
} from "../renderer/pptxgen/text-fit";

describe("text-fit", () => {
  it("preserves decimal points while fitting", () => {
    const result = fitTextToCapacity("매출은 3.7조원에서 4.2조원으로 증가했다. 추가 설명이 길다.", 26);
    expect(result.text).toContain("3.7");
    expect(result.text).not.toMatch(/3\.\.\./);
  });

  it("keeps So What segment when shrinking claim text", () => {
    const claim = "진단: 매우 긴 설명이 계속 이어져서 길이가 충분히 길다 (So What: 의사결정 우선순위를 명확히 한다)";
    const result = fitClaimPreserveSoWhat(claim, 68);
    expect(result.text).toContain("So What:");
    expect(result.text.length).toBeLessThanOrEqual(68);
  });

  it("keeps consulting decision verb when shrinking governing message", () => {
    const message =
      "시장 변화와 경쟁 구도를 반영해 핵심 투자 포트폴리오를 전면 검토해야 하며 중장기 우선순위를 단계별로 재정렬해야 한다";
    const result = fitGoverningMessagePreserveDecision(message, 58);
    expect(result.text.length).toBeLessThanOrEqual(58);
    expect(result.text).toMatch(/(재정렬|우선순위|해야)/);
  });
});
