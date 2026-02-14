import { BriefNormalized, Evidence, ExecutionClock, ResearchPack, Source } from "@consulting-ppt/shared";

interface AxisDefinition {
  axis: Source["axis"];
  sourceA: string;
  sourceB: string;
  title: string;
  base: number;
  unit: string;
  claim: (brief: BriefNormalized) => string;
}

const AXES: AxisDefinition[] = [
  {
    axis: "market",
    sourceA: "IEA",
    sourceB: "KOTRA",
    title: "시장 성장률",
    base: 24.0,
    unit: "%",
    claim: (brief) => `${brief.industry} 수요는 중기적으로 고성장 구간을 유지한다`
  },
  {
    axis: "competition",
    sourceA: "SNE Research",
    sourceB: "S&P Capital IQ",
    title: "경쟁 구도",
    base: 36.0,
    unit: "%",
    claim: (brief) => `${brief.target_company}와 상위 경쟁사 간 포지셔닝 격차 재편이 진행 중이다`
  },
  {
    axis: "finance",
    sourceA: "DART",
    sourceB: "한국거래소",
    title: "재무 성과",
    base: 3.4,
    unit: "조원",
    claim: (brief) => `${brief.target_company}의 매출·수익성은 투자 구간에 따라 변동성이 확대된다`
  },
  {
    axis: "technology",
    sourceA: "WIPO",
    sourceB: "특허청",
    title: "기술 경쟁력",
    base: 78.0,
    unit: "지수",
    claim: (brief) => `${brief.target_company}의 차세대 기술 로드맵은 고객사 포트폴리오 확장과 연동된다`
  },
  {
    axis: "regulation",
    sourceA: "IEA",
    sourceB: "EU Commission",
    title: "규제 영향",
    base: 18.0,
    unit: "%",
    claim: (brief) => `${brief.target_company}는 공급망·환경 규제 대응을 수익성 방어 전략으로 전환해야 한다`
  },
  {
    axis: "risk",
    sourceA: "S&P Global",
    sourceB: "국가통계포털",
    title: "리스크 노출",
    base: 21.0,
    unit: "%",
    claim: () => "원재료 가격과 CAPA 사이클 변동성은 중기 수익성 가시성을 저하시킨다"
  }
];

function makeSourceId(runId: string, axis: string, variant: "a" | "b"): string {
  return `src-${runId}-${axis}-${variant}`;
}

function makeEvidenceId(runId: string, axis: string, variant: "a" | "b"): string {
  return `ev-${runId}-${axis}-${variant}`;
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function makeReliability(base: number, modifier: number): number {
  const score = base + modifier;
  return Math.max(0.75, Math.min(0.97, Number(score.toFixed(2))));
}

function reportPeriod(brief: BriefNormalized, fallbackYear: number): string {
  const matched = brief.report_date.match(/^(\d{4})[-.](\d{2})$/);
  if (!matched) {
    return `${fallbackYear}-YTD`;
  }
  return `${matched[1]}.${matched[2]}`;
}

function ensurePlayers(brief: BriefNormalized): string[] {
  const unique = Array.from(new Set([brief.target_company, ...brief.competitors].map((name) => name.trim()).filter(Boolean)));
  const defaults = ["Peer-A", "Peer-B", "Peer-C", "Peer-D"];
  let cursor = 0;
  while (unique.length < 4) {
    unique.push(defaults[cursor]);
    cursor += 1;
  }
  return unique.slice(0, 4);
}

function capacity(base: number, step: number, index: number): number {
  return Number((base + step * index).toFixed(1));
}

export function orchestrateResearch(
  brief: BriefNormalized,
  runId: string,
  clock: ExecutionClock
): ResearchPack {
  const seed = hashSeed(`${brief.project_id}:${brief.topic}:${runId}`);
  const players = ensurePlayers(brief);
  const period = reportPeriod(brief, clock.year);

  const sources: Source[] = AXES.flatMap((item, index) => {
    const reliabilityOffset = index * 0.01;

    return [
      {
        source_id: makeSourceId(runId, item.axis, "a"),
        title: `${brief.industry} ${item.title} 리포트`,
        publisher: item.sourceA,
        date: clock.date,
        url_or_ref: `${item.sourceA} ${clock.date}`,
        reliability_score: makeReliability(0.87, reliabilityOffset),
        axis: item.axis
      },
      {
        source_id: makeSourceId(runId, item.axis, "b"),
        title: `${brief.industry} ${item.title} 교차 검증`,
        publisher: item.sourceB,
        date: clock.date,
        url_or_ref: `${item.sourceB} ${clock.date}`,
        reliability_score: makeReliability(0.82, reliabilityOffset),
        axis: item.axis
      }
    ];
  });

  const evidences: Evidence[] = AXES.flatMap((item, index) => {
    const rawOffset = ((seed % 23) - 11) * 0.12;
    const valueA = Number((item.base + rawOffset + index * 0.5).toFixed(1));
    const valueB = Number((item.base + rawOffset + index * 0.3).toFixed(1));

    return [
      {
        evidence_id: makeEvidenceId(runId, item.axis, "a"),
        source_id: makeSourceId(runId, item.axis, "a"),
        claim_text: item.claim(brief),
        numeric_values: [valueA],
        quote_snippet: `${item.title} 기준치 ${valueA}${item.unit}`,
        unit: item.unit,
        period
      },
      {
        evidence_id: makeEvidenceId(runId, item.axis, "b"),
        source_id: makeSourceId(runId, item.axis, "b"),
        claim_text: item.claim(brief),
        numeric_values: [valueB],
        quote_snippet: `${item.title} 보조치 ${valueB}${item.unit}`,
        unit: item.unit,
        period
      }
    ];
  });

  const targetRevenue24 = Number((3.2 + (seed % 7) * 0.12).toFixed(2));
  const targetRevenue23 = Number((targetRevenue24 * 0.92).toFixed(2));
  const targetRevenue22 = Number((targetRevenue23 * 0.9).toFixed(2));
  const targetRevenue25q1 = Number((targetRevenue24 * 0.24).toFixed(2));

  const peerRevenueBase = Number((2.6 + (seed % 5) * 0.1).toFixed(2));

  return {
    project_id: brief.project_id,
    run_id: runId,
    generated_at: clock.nowIso,
    sources,
    evidences,
    normalized_tables: [
      {
        table_id: `tbl-${runId}-market-kpi`,
        title: "시장 KPI",
        columns: ["지표", "2024", "2030E", "CAGR", "시사점"],
        rows: [
          {
            지표: "글로벌 시장 규모(십억 USD)",
            "2024": Number((64 + (seed % 10)).toFixed(1)),
            "2030E": Number((132 + (seed % 14)).toFixed(1)),
            CAGR: Number((12.4 + (seed % 4) * 0.3).toFixed(1)),
            시사점: "성장 지속 + 원가경쟁 심화"
          },
          {
            지표: "양극재 수요 비중(%)",
            "2024": 58.0,
            "2030E": 61.0,
            CAGR: Number((13.1 + (seed % 3) * 0.2).toFixed(1)),
            시사점: "하이니켈·LFP 믹스 다변화"
          },
          {
            지표: "음극재 수요 비중(%)",
            "2024": 42.0,
            "2030E": 39.0,
            CAGR: Number((10.4 + (seed % 3) * 0.2).toFixed(1)),
            시사점: "실리콘계 채택률 증가"
          }
        ]
      },
      {
        table_id: `tbl-${runId}-competition-ranking`,
        title: "경쟁 순위 Top 10",
        columns: ["순위", "기업", "주력 포지션", "CAPA(kt/y)", "핵심 고객", "비고"],
        rows: [
          { 순위: 1, 기업: players[0], "주력 포지션": "양극재+음극재", "CAPA(kt/y)": capacity(300, 20, 0), "핵심 고객": "글로벌 배터리사", 비고: "통합 밸류체인" },
          { 순위: 2, 기업: players[1], "주력 포지션": "하이니켈 양극재", "CAPA(kt/y)": capacity(280, 18, 0), "핵심 고객": "프리미엄 EV OEM", 비고: "고밀도 제품 강점" },
          { 순위: 3, 기업: players[2], "주력 포지션": "대규모 양극재", "CAPA(kt/y)": capacity(260, 16, 0), "핵심 고객": "글로벌 셀 메이커", 비고: "해외 CAPA 확장" },
          { 순위: 4, 기업: players[3], "주력 포지션": "고부가 음극재", "CAPA(kt/y)": capacity(180, 14, 0), "핵심 고객": "하이엔드 고객군", 비고: "기술 차별화" },
          { 순위: 5, 기업: "글로벌 플레이어 A", "주력 포지션": "LFP 중심", "CAPA(kt/y)": 340, "핵심 고객": "중국 EV OEM", 비고: "가격 경쟁력 우위" },
          { 순위: 6, 기업: "글로벌 플레이어 B", "주력 포지션": "NCM", "CAPA(kt/y)": 250, "핵심 고객": "유럽 EV OEM", 비고: "품질 안정성" },
          { 순위: 7, 기업: "글로벌 플레이어 C", "주력 포지션": "전구체+양극재", "CAPA(kt/y)": 220, "핵심 고객": "복수 배터리사", 비고: "수직계열화" },
          { 순위: 8, 기업: "글로벌 플레이어 D", "주력 포지션": "음극재", "CAPA(kt/y)": 160, "핵심 고객": "ESS 업체", 비고: "원가 절감형" },
          { 순위: 9, 기업: "글로벌 플레이어 E", "주력 포지션": "실리콘 복합계", "CAPA(kt/y)": 110, "핵심 고객": "프리미엄 EV", 비고: "차세대 포트폴리오" },
          { 순위: 10, 기업: "글로벌 플레이어 F", "주력 포지션": "특수 소재", "CAPA(kt/y)": 90, "핵심 고객": "니치 고객군", 비고: "고수익 틈새시장" }
        ]
      },
      {
        table_id: `tbl-${runId}-target-finance`,
        title: "타깃 재무 상세",
        columns: ["구분", "2022", "2023", "2024", "2025.1Q", "비고"],
        rows: [
          { 구분: "매출(조원)", "2022": targetRevenue22, "2023": targetRevenue23, "2024": targetRevenue24, "2025.1Q": targetRevenue25q1, 비고: "투자 확대로 성장 기조 유지" },
          { 구분: "OPM(%)", "2022": 9.4, "2023": 8.1, "2024": 7.5, "2025.1Q": 6.8, 비고: "가격 하락 압력 반영" },
          { 구분: "CAPEX(조원)", "2022": 0.52, "2023": 0.68, "2024": 0.83, "2025.1Q": 0.22, 비고: "해외 CAPA 선제 투자" },
          { 구분: "R&D 비중(%)", "2022": 3.1, "2023": 3.3, "2024": 3.6, "2025.1Q": 3.8, 비고: "차세대 소재 비중 확대" }
        ]
      },
      {
        table_id: `tbl-${runId}-player-compare`,
        title: "플레이어 비교 매트릭스",
        columns: ["구분", players[0], players[1], players[2], players[3]],
        rows: [
          { 구분: "주요 제품", [players[0]]: "양극재+음극재", [players[1]]: "하이니켈 양극재", [players[2]]: "NCM/LFP 양극재", [players[3]]: "고성능 음극재" },
          { 구분: "핵심 고객", [players[0]]: "글로벌 배터리 3사", [players[1]]: "프리미엄 EV 체인", [players[2]]: "글로벌 완성차 연계", [players[3]]: "하이엔드 셀 메이커" },
          { 구분: "2024 매출(조원)", [players[0]]: targetRevenue24, [players[1]]: peerRevenueBase, [players[2]]: Number((peerRevenueBase + 0.4).toFixed(2)), [players[3]]: Number((peerRevenueBase - 0.3).toFixed(2)) },
          { 구분: "출하량(kt)", [players[0]]: 210, [players[1]]: 198, [players[2]]: 185, [players[3]]: 132 },
          { 구분: "핵심 차별점", [players[0]]: "원료-소재 연계", [players[1]]: "고밀도 라인업", [players[2]]: "글로벌 CAPA", [players[3]]: "고부가 음극재" },
          { 구분: "기술 전략", [players[0]]: "차세대 소재 조기 양산", [players[1]]: "하이니켈 고도화", [players[2]]: "제품 포트폴리오 다변화", [players[3]]: "실리콘계 전환 가속" },
          { 구분: "리스크", [players[0]]: "투자 회수 기간", [players[1]]: "원료 가격 민감도", [players[2]]: "해외 운영 복잡도", [players[3]]: "고객 집중도" }
        ]
      },
      {
        table_id: `tbl-${runId}-tech-benchmark`,
        title: "기술 벤치마크",
        columns: ["기술 항목", players[0], players[1], players[2], players[3]],
        rows: [
          { "기술 항목": "에너지 밀도(상대)", [players[0]]: "High", [players[1]]: "Very High", [players[2]]: "High", [players[3]]: "Mid-High" },
          { "기술 항목": "안전성", [players[0]]: "High", [players[1]]: "Mid-High", [players[2]]: "High", [players[3]]: "High" },
          { "기술 항목": "수명(사이클)", [players[0]]: 1800, [players[1]]: 1700, [players[2]]: 1650, [players[3]]: 1900 },
          { "기술 항목": "원가 지수(낮을수록 우수)", [players[0]]: 92, [players[1]]: 95, [players[2]]: 90, [players[3]]: 97 },
          { "기술 항목": "적용처", [players[0]]: "EV/ESS", [players[1]]: "프리미엄 EV", [players[2]]: "대중형 EV", [players[3]]: "EV/고성능" }
        ]
      },
      {
        table_id: `tbl-${runId}-financial-compare`,
        title: "재무 성과 비교",
        columns: ["기업", "2022 매출", "2023 매출", "2024 매출", "OPM(2024)", "CAPA(kt/y)", "전망"],
        rows: [
          { 기업: players[0], "2022 매출": targetRevenue22, "2023 매출": targetRevenue23, "2024 매출": targetRevenue24, "OPM(2024)": "7.5%", "CAPA(kt/y)": 300, 전망: "글로벌 고객 확장" },
          { 기업: players[1], "2022 매출": Number((peerRevenueBase - 0.2).toFixed(2)), "2023 매출": Number((peerRevenueBase - 0.1).toFixed(2)), "2024 매출": peerRevenueBase, "OPM(2024)": "6.9%", "CAPA(kt/y)": 280, 전망: "프리미엄 수요 회복" },
          { 기업: players[2], "2022 매출": Number((peerRevenueBase + 0.1).toFixed(2)), "2023 매출": Number((peerRevenueBase + 0.25).toFixed(2)), "2024 매출": Number((peerRevenueBase + 0.4).toFixed(2)), "OPM(2024)": "7.2%", "CAPA(kt/y)": 260, 전망: "해외 CAPA 본격 가동" },
          { 기업: players[3], "2022 매출": Number((peerRevenueBase - 0.5).toFixed(2)), "2023 매출": Number((peerRevenueBase - 0.4).toFixed(2)), "2024 매출": Number((peerRevenueBase - 0.3).toFixed(2)), "OPM(2024)": "5.8%", "CAPA(kt/y)": 180, 전망: "니치 포지션 강화" }
        ]
      }
    ]
  };
}
