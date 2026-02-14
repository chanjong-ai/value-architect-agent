import { QAIssue, SlideSpec } from "@consulting-ppt/shared";

export interface LayoutQaResult {
  score: number;
  issues: QAIssue[];
}

export function runLayoutQa(spec: SlideSpec): LayoutQaResult {
  const issues: QAIssue[] = [];
  const requiredVisualsBySlideId: Record<string, string[]> = {
    s02: ["kpi-cards", "bullets"],
    s03: ["bar-chart", "kpi-cards", "insight-box"],
    s04: ["matrix", "table"],
    s05: ["table", "pie-chart", "action-cards"],
    s06: ["table"],
    s07: ["table", "timeline"],
    s08: ["flow", "insight-box"],
    s09: ["bar-chart", "table", "insight-box"],
    s10: ["icon-list", "action-cards"],
    s11: ["matrix", "bullets"],
    s12: ["so-what-grid", "insight-box"],
    s13: ["timeline", "action-cards"]
  };

  if (spec.slides.length < 13 || spec.slides.length > 20) {
    issues.push({
      rule: "slide_count_range",
      severity: "high",
      message: "슬라이드 수가 13~20 범위를 벗어났습니다"
    });
  }

  const typeOrder = spec.slides.map((slide) => slide.type);
  const firstCover = typeOrder.indexOf("cover");
  const firstExecSummary = typeOrder.indexOf("exec-summary");
  const firstMarket = typeOrder.indexOf("market-landscape");
  const firstBenchmark = typeOrder.indexOf("benchmark");
  const firstRisks = typeOrder.indexOf("risks-issues");
  const firstRoadmap = typeOrder.indexOf("roadmap");
  const firstAppendix = typeOrder.indexOf("appendix");

  if (firstCover !== 0) {
    issues.push({
      rule: "story_arc_cover_first",
      severity: "high",
      message: "첫 슬라이드는 cover여야 합니다"
    });
  }

  if (
    firstExecSummary < 0 ||
    firstMarket < 0 ||
    firstBenchmark < 0 ||
    firstRoadmap < 0 ||
    firstRisks < 0
  ) {
    issues.push({
      rule: "story_arc_missing",
      severity: "high",
      message: "스토리라인 핵심 슬라이드 유형(exec-summary/market/benchmark/risks/roadmap)이 누락되었습니다"
    });
  } else {
    const ordered = firstExecSummary < firstMarket &&
      firstMarket < firstBenchmark &&
      firstBenchmark < firstRisks &&
      firstRisks < firstRoadmap;

    if (!ordered) {
      issues.push({
        rule: "story_arc_order",
        severity: "medium",
        message: "문제정의→분석→리스크→실행 순서가 약합니다"
      });
    }

    if (firstAppendix >= 0 && firstAppendix !== spec.slides.length - 1) {
      issues.push({
        rule: "appendix_not_last",
        severity: "low",
        message: "appendix는 마지막 슬라이드에 위치하는 것이 권장됩니다"
      });
    }
  }

  for (const slide of spec.slides) {
    if (slide.visuals.length === 0) {
      issues.push({
        rule: "visual_missing",
        severity: "medium",
        slide_id: slide.id,
        message: "시각 요소가 없는 슬라이드입니다"
      });
    }

    const requiredVisuals = requiredVisualsBySlideId[slide.id] ?? [];
    if (requiredVisuals.length > 0) {
      const visualKinds = new Set(slide.visuals.map((visual) => visual.kind));
      for (const requiredKind of requiredVisuals) {
        if (!visualKinds.has(requiredKind as typeof slide.visuals[number]["kind"])) {
          issues.push({
            rule: "required_visual_missing",
            severity: "high",
            slide_id: slide.id,
            message: `필수 시각 요소 누락: ${requiredKind}`
          });
        }
      }
    }

    if (slide.id !== "s01") {
      const nonTextVisualCount = slide.visuals.filter((visual) => visual.kind !== "bullets").length;
      if (nonTextVisualCount === 0) {
        issues.push({
          rule: "text_only_slide",
          severity: "high",
          slide_id: slide.id,
          message: "커버를 제외한 슬라이드에 텍스트 외 시각 요소가 필요합니다"
        });
      }
    }

    if (slide.claims.length > 6) {
      issues.push({
        rule: "claim_density",
        severity: "medium",
        slide_id: slide.id,
        message: "슬라이드 claim 수가 많아 과밀 가능성이 높습니다"
      });
    }

    const longClaimCount = slide.claims.filter((claim) => claim.text.length > 180).length;
    if (longClaimCount >= 2) {
      issues.push({
        rule: "overflow_risk",
        severity: "high",
        slide_id: slide.id,
        message: "텍스트 오버플로우 위험이 높은 슬라이드입니다"
      });
    }
  }

  const deduction = issues.reduce((acc, issue) => {
    if (issue.severity === "high") {
      return acc + 8;
    }
    if (issue.severity === "medium") {
      return acc + 4;
    }
    return acc + 2;
  }, 0);

  return {
    score: Math.max(0, 20 - deduction),
    issues
  };
}
