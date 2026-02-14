import { BriefNormalized, SlideType } from "@consulting-ppt/shared";

export interface PlannedSlide {
  id: string;
  type: SlideType;
  title: string;
  focus: string;
  section: "problem" | "insight" | "option" | "recommendation" | "execution" | "appendix";
}

const BASE_STORY: Array<Omit<PlannedSlide, "id">> = [
  {
    type: "cover",
    title: "시장 종합 분석",
    focus: "분석 범위와 보고 목적을 경영진 의사결정 관점으로 정렬한다",
    section: "problem"
  },
  {
    type: "exec-summary",
    title: "Executive Summary",
    focus: "핵심 수치와 전략 결론을 단일 페이지에서 압축 제시한다",
    section: "insight"
  },
  {
    type: "market-landscape",
    title: "시장 개요",
    focus: "시장 규모·성장률·세그먼트 구조 변화를 정량으로 설명한다",
    section: "problem"
  },
  {
    type: "benchmark",
    title: "경쟁 환경",
    focus: "주요 플레이어 포지셔닝과 경쟁구도 변화를 비교한다",
    section: "insight"
  },
  {
    type: "benchmark",
    title: "플레이어 심층 분석",
    focus: "타깃 기업의 재무·전략·포트폴리오를 심층 진단한다",
    section: "insight"
  },
  {
    type: "benchmark",
    title: "플레이어 비교 매트릭스",
    focus: "핵심 경쟁사 간 전략·제품·고객·리스크를 동일 프레임으로 정렬한다",
    section: "option"
  },
  {
    type: "market-landscape",
    title: "기술/제품 벤치마킹",
    focus: "기술 성능과 제품 로드맵을 비교해 차별화 축을 정의한다",
    section: "option"
  },
  {
    type: "market-landscape",
    title: "밸류체인 분석",
    focus: "원료-전구체-소재-고객 밸류체인에서 경쟁 우위를 진단한다",
    section: "option"
  },
  {
    type: "benchmark",
    title: "재무 성과 비교",
    focus: "주요 기업의 실적·수익성·CAPA를 비교해 성과 격차를 해석한다",
    section: "recommendation"
  },
  {
    type: "exec-summary",
    title: "트렌드 & 기회",
    focus: "시장 메가트렌드와 사업 기회를 전략 우선순위로 변환한다",
    section: "recommendation"
  },
  {
    type: "risks-issues",
    title: "리스크 분석",
    focus: "발생확률-영향도 기준으로 핵심 리스크와 대응 우선순위를 명확화한다",
    section: "execution"
  },
  {
    type: "roadmap",
    title: "전략적 시사점",
    focus: "시장·기업·기술 관점의 So What을 경영 의사결정 언어로 정리한다",
    section: "execution"
  },
  {
    type: "roadmap",
    title: "권고안 (전략 로드맵)",
    focus: "단기·중기·장기 실행 계획과 우선 액션을 구체화한다",
    section: "execution"
  }
];

export function planNarrative(brief: BriefNormalized): PlannedSlide[] {
  const slides = [...BASE_STORY];
  const industryLabel = brief.industry.includes("시장") ? brief.industry : `${brief.industry} 시장`;
  const targetCompany = brief.target_company;
  const competitorSummary = brief.competitors.length > 0 ? brief.competitors.join(", ") : "주요 경쟁사";

  slides[0] = {
    ...slides[0],
    title: `${industryLabel} 종합 분석`,
    focus: `${brief.topic} 이슈를 ${brief.target_audience} 의사결정 프레임으로 구조화한다`
  };
  slides[2] = {
    ...slides[2],
    title: `${industryLabel} 개요`,
    focus: `${industryLabel} 규모·성장률·세그먼트 구조 변화를 정량으로 설명한다`
  };
  slides[3] = {
    ...slides[3],
    title: "경쟁 환경",
    focus: `${industryLabel}에서 ${targetCompany}와 주요 플레이어의 포지셔닝 변화를 비교한다`
  };
  slides[4] = {
    ...slides[4],
    title: `플레이어 심층 분석 — ${targetCompany}`,
    focus: `${targetCompany}의 재무·제품·고객 기반 경쟁 우위를 심층 진단한다`
  };
  slides[5] = {
    ...slides[5],
    focus: `${targetCompany}와 ${competitorSummary}를 동일 프레임으로 비교해 전략 차별화를 도출한다`
  };

  if (brief.page_count > slides.length) {
    const extraCount = brief.page_count - slides.length;
    for (let i = 0; i < extraCount; i += 1) {
      slides.splice(slides.length - 1, 0, {
        type: "appendix",
        title: `부록 상세 ${i + 1}`,
        focus: "추가 정량 근거와 계산 근거를 제시해 결론 신뢰도를 보강한다",
        section: "appendix"
      });
    }
  }

  return slides.map((slide, index) => ({
    ...slide,
    id: `s${String(index + 1).padStart(2, "0")}`
  }));
}
