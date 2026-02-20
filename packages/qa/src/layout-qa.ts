import { QAIssue, SlideSpec, SlideType } from "@consulting-ppt/shared";

export interface LayoutQaResult {
  score: number;
  issues: QAIssue[];
}

const REQUIRED_VISUAL_GROUPS_BY_TYPE: Partial<Record<SlideType, string[][]>> = {
  "exec-summary": [["kpi-cards", "action-cards", "so-what-grid"], ["bullets", "icon-list", "table", "insight-box"]],
  "market-landscape": [["bar-chart", "table", "flow", "kpi-cards", "insight-box"]],
  benchmark: [["matrix", "table", "bar-chart", "icon-list", "insight-box"]],
  "risks-issues": [["matrix", "action-cards", "bullets", "insight-box"]],
  roadmap: [["timeline", "action-cards", "table", "flow"]],
  appendix: [["table", "bullets", "insight-box"]]
};

function hasAnyVisual(slideVisualKinds: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => slideVisualKinds.has(candidate));
}

export function runLayoutQa(spec: SlideSpec): LayoutQaResult {
  const issues: QAIssue[] = [];

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

  if (firstExecSummary < 0 || firstMarket < 0 || firstBenchmark < 0 || firstRoadmap < 0 || firstRisks < 0) {
    issues.push({
      rule: "story_arc_missing",
      severity: "high",
      message: "스토리라인 핵심 슬라이드 유형(exec-summary/market/benchmark/risks/roadmap)이 누락되었습니다"
    });
  } else {
    const ordered =
      firstExecSummary < firstMarket && firstMarket < firstBenchmark && firstBenchmark < firstRisks && firstRisks < firstRoadmap;

    if (!ordered) {
      issues.push({
        rule: "story_arc_order",
        severity: "medium",
        message: "문제정의→분석→리스크→실행 순서가 약합니다"
      });
    }

    if (firstAppendix >= 0) {
      const hasNonAppendixAfterAppendix = spec.slides
        .slice(firstAppendix)
        .some((slide) => slide.type !== "appendix");

      if (hasNonAppendixAfterAppendix) {
        issues.push({
          rule: "appendix_not_last",
          severity: "low",
          message: "appendix는 문서 마지막 구간에 연속 배치되는 것이 권장됩니다"
        });
      }
    }
  }

  for (const slide of spec.slides) {
    const isCover = slide.type === "cover";

    if (slide.visuals.length === 0) {
      if (isCover) {
        continue;
      }
      issues.push({
        rule: "visual_missing",
        severity: "medium",
        slide_id: slide.id,
        message: "시각 요소가 없는 슬라이드입니다"
      });
      continue;
    }

    const visualKinds = new Set(slide.visuals.map((visual) => visual.kind));
    const requiredGroups = REQUIRED_VISUAL_GROUPS_BY_TYPE[slide.type] ?? [];

    for (const group of requiredGroups) {
      if (!hasAnyVisual(visualKinds, group)) {
        issues.push({
          rule: "required_visual_missing",
          severity: "high",
          slide_id: slide.id,
          message: `${slide.type} 슬라이드는 다음 시각요소 중 하나 이상이 필요합니다: ${group.join(", ")}`
        });
      }
    }

    const hasLayoutHint = slide.visuals.some((visual) => {
      const hint = visual.options?.layout_hint;
      return typeof hint === "string" && hint.trim().length > 0;
    });

    if (!hasLayoutHint && !isCover) {
      issues.push({
        rule: "layout_hint_missing",
        severity: "low",
        slide_id: slide.id,
        message: "동적 레이아웃 선택을 위해 visual.options.layout_hint 입력이 권장됩니다"
      });
    }

    if (!isCover) {
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

    // Phase 3 (분석 파일 §2.8): Design Density 체크 — 맥킨지 "Negative Space" 관리
    if (!isCover) {
      // 총 claim 텍스트가 매우 많으면 과밀 슬라이드
      const totalClaimChars = slide.claims.reduce((sum, c) => sum + c.text.length, 0);
      if (totalClaimChars > 900 && slide.claims.length >= 4) {
        issues.push({
          rule: "overcrowded_slide",
          severity: "medium",
          slide_id: slide.id,
          message: `슬라이드 텍스트 밀도 과다(${totalClaimChars}자): 맥킨지 표준에서 각 슬라이드는 하나의 명확한 메시지만 전달해야 합니다 — claim 수 축소 또는 분할 권장`
        });
      }

      // 차트/바 시각요소에 annotation이 없을 경우 경고
      const hasChartVisual = slide.visuals.some((v) => v.kind === "bar-chart" || v.kind === "pie-chart");
      if (hasChartVisual) {
        const hasAnnotationHint = slide.visuals.some(
          (v) => (v.kind === "bar-chart" || v.kind === "pie-chart") && v.options?.annotation
        );
        const hasAnnotationInClaims = slide.claims.some((c) =>
          /(so what|따라서|결론|핵심|시사점|주목|callout)/i.test(c.text)
        );
        if (!hasAnnotationHint && !hasAnnotationInClaims) {
          issues.push({
            rule: "chart_without_callout",
            severity: "low",
            slide_id: slide.id,
            message: "차트에 Callout/Annotation이 부족합니다 — 맥킨지 표준에서 모든 차트는 주목해야 할 포인트를 화살표/박스로 강조해야 합니다"
          });
        }
      }

      // 표가 5행을 초과하면 분할 권장
      const tableVisuals = slide.visuals.filter((v) => v.kind === "table");
      if (tableVisuals.length > 0) {
        // 표 행 수는 claim 개수로 근사: claim 5개 초과 = 표 5행 초과로 추정
        if (slide.claims.length > 5 && tableVisuals.length > 0) {
          issues.push({
            rule: "table_exceeds_5_rows",
            severity: "low",
            slide_id: slide.id,
            message: "표 데이터가 5행을 초과할 가능성이 높습니다 — 맥킨지 표준에서 슬라이드당 표는 5행 이내로 제한, 초과 시 appendix로 분리 권장"
          });
        }
      }
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
