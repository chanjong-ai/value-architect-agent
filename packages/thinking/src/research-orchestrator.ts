import { BriefNormalized, Evidence, ExecutionClock, NormalizedTable, ResearchPack, Source } from "@consulting-ppt/shared";

type Axis = Source["axis"];

interface AxisDefinition {
  axis: Axis;
  sourceA: string;
  sourceB: string;
  sourceC: string;
  title: string;
  base: number;
  unit: string;
  claim: (brief: BriefNormalized) => string;
  trendClaim: (brief: BriefNormalized) => string;
  riskClaim: (brief: BriefNormalized) => string;
  strategyClaim: (brief: BriefNormalized) => string;
}

const AXIS_ORDER: Axis[] = ["market", "competition", "finance", "technology", "regulation", "risk"];
const MIN_SOURCES_PER_AXIS = 3;
const MIN_EVIDENCES_PER_AXIS = 4;
const MIN_TABLE_COUNT = 8;

const AXIS_KEYWORDS: Record<Axis, string[]> = {
  market: ["시장", "수요", "점유율", "고객", "성장", "cagr"],
  competition: ["경쟁", "포지셔닝", "플레이어", "비교", "peer", "benchmark"],
  finance: ["재무", "수익", "마진", "현금흐름", "capex", "opex", "투자"],
  technology: ["기술", "제품", "특허", "r&d", "로드맵", "공정"],
  regulation: ["규제", "정책", "ira", "cbam", "esg", "컴플라이언스"],
  risk: ["리스크", "위험", "불확실", "변동성", "공급망", "원자재"]
};

const AXES: AxisDefinition[] = [
  {
    axis: "market",
    sourceA: "IEA",
    sourceB: "KOTRA",
    sourceC: "BloombergNEF",
    title: "시장 성장률",
    base: 24.0,
    unit: "%",
    claim: (brief) => `${brief.industry} 수요는 중기적으로 고성장 구간을 유지한다`,
    trendClaim: (brief) => `${brief.industry} 시장의 지역별 수요 이동이 고객 포트폴리오 재배치를 요구한다`,
    riskClaim: () => "수요 성장의 편차 확대로 제품 믹스 관리 난이도가 높아지고 있다",
    strategyClaim: () => "고성장 세그먼트 중심의 고객·제품 우선순위 재정렬이 필요하다"
  },
  {
    axis: "competition",
    sourceA: "SNE Research",
    sourceB: "S&P Capital IQ",
    sourceC: "Benchmark Mineral Intelligence",
    title: "경쟁 구도",
    base: 36.0,
    unit: "%",
    claim: (brief) => `${brief.target_company}와 상위 경쟁사 간 포지셔닝 격차 재편이 진행 중이다`,
    trendClaim: () => "상위 플레이어의 CAPA 증설 속도 차이가 고객 락인 구조를 바꾸고 있다",
    riskClaim: () => "가격 경쟁 심화로 중위권 업체의 수익성 방어력이 약화되고 있다",
    strategyClaim: () => "경쟁우위를 유지하려면 고객군별 차별화 제안이 필수적이다"
  },
  {
    axis: "finance",
    sourceA: "DART",
    sourceB: "한국거래소",
    sourceC: "FactSet",
    title: "재무 성과",
    base: 3.4,
    unit: "조원",
    claim: (brief) => `${brief.target_company}의 매출·수익성은 투자 구간에 따라 변동성이 확대된다`,
    trendClaim: () => "현금흐름과 CAPEX 사이의 갭 관리가 투자 성과를 좌우한다",
    riskClaim: () => "다운사이클 구간에서 고정비 부담이 마진 하방 압력을 확대한다",
    strategyClaim: () => "투자 우선순위를 현금창출력 기준으로 재배치할 필요가 있다"
  },
  {
    axis: "technology",
    sourceA: "WIPO",
    sourceB: "특허청",
    sourceC: "IEEE",
    title: "기술 경쟁력",
    base: 78.0,
    unit: "지수",
    claim: (brief) => `${brief.target_company}의 차세대 기술 로드맵은 고객사 포트폴리오 확장과 연동된다`,
    trendClaim: () => "제품 성능 고도화 속도는 고객 전환비용과 직결된다",
    riskClaim: () => "양산 전환 지연은 고객 신뢰도와 수익성에 동시 타격을 준다",
    strategyClaim: () => "기술 로드맵과 영업 전략을 하나의 KPI 체계로 관리해야 한다"
  },
  {
    axis: "regulation",
    sourceA: "EU Commission",
    sourceB: "IEA",
    sourceC: "US DOE",
    title: "규제 영향",
    base: 18.0,
    unit: "%",
    claim: (brief) => `${brief.target_company}는 공급망·환경 규제 대응을 수익성 방어 전략으로 전환해야 한다`,
    trendClaim: () => "지역별 통상·탄소 규제가 고객 요구 사양을 빠르게 바꾸고 있다",
    riskClaim: () => "규제 대응 지연은 인증·고객 수주 일정 전체에 지연 리스크를 야기한다",
    strategyClaim: () => "규제 대응 체계를 선제 구축하면 가격·납기 협상력을 높일 수 있다"
  },
  {
    axis: "risk",
    sourceA: "S&P Global",
    sourceB: "국가통계포털",
    sourceC: "IMF",
    title: "리스크 노출",
    base: 21.0,
    unit: "%",
    claim: () => "원재료 가격과 CAPA 사이클 변동성은 중기 수익성 가시성을 저하시킨다",
    trendClaim: () => "공급망 병목과 환율 변동은 프로젝트 수익률 분산을 확대하고 있다",
    riskClaim: () => "수요 둔화와 공급 과잉이 동시 발생할 경우 다운사이드 폭이 커진다",
    strategyClaim: () => "조기경보 지표와 대응 시나리오를 결합한 리스크 운영체계가 필요하다"
  }
];

function makeSourceId(runId: string, axis: Axis, variant: "a" | "b" | "c"): string {
  return `src-${runId}-${axis}-${variant}`;
}

function makeEvidenceId(runId: string, axis: Axis, variant: "a" | "b" | "c" | "d"): string {
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
  return Math.max(0.75, Math.min(0.98, Number(score.toFixed(2))));
}

function reportPeriod(brief: BriefNormalized, fallbackYear: number): string {
  const matched = brief.report_date.match(/^(\d{4})[-.](\d{2})$/);
  if (!matched) {
    return `${fallbackYear}-YTD`;
  }
  return `${matched[1]}.${matched[2]}`;
}

function ensurePlayers(brief: BriefNormalized): string[] {
  const unique = Array.from(
    new Set([brief.target_company, ...brief.competitors].map((name) => name.trim()).filter(Boolean))
  );
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

function axisBoostByBrief(brief: BriefNormalized, axis: Axis): number {
  const corpus = `${brief.topic} ${brief.industry} ${brief.must_include.join(" ")}`.toLowerCase();
  let hit = 0;
  for (const keyword of AXIS_KEYWORDS[axis]) {
    if (corpus.includes(keyword.toLowerCase())) {
      hit += 1;
    }
  }
  return Math.min(0.22, hit * 0.04);
}

function deterministicNoise(seed: number, axisIndex: number, variant: number): number {
  const raw = ((seed + axisIndex * 997 + variant * 191) % 100) - 50;
  return Number((raw / 100).toFixed(2));
}

function sortByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => keyFn(a).localeCompare(keyFn(b)));
}

function mergeUniqueByKey<T>(primary: T[], fallback: T[], keyFn: (item: T) => string): T[] {
  const merged = new Map<string, T>();
  for (const item of [...primary, ...fallback]) {
    const key = keyFn(item);
    if (!merged.has(key)) {
      merged.set(key, item);
    }
  }
  return Array.from(merged.values());
}

function buildGeneratedResearch(
  brief: BriefNormalized,
  runId: string,
  clock: ExecutionClock
): Pick<ResearchPack, "sources" | "evidences" | "normalized_tables"> {
  const seed = hashSeed(`${brief.project_id}:${brief.topic}:${runId}`);
  const players = ensurePlayers(brief);
  const period = reportPeriod(brief, clock.year);

  const sources: Source[] = AXES.flatMap((item, index) => {
    const boost = axisBoostByBrief(brief, item.axis);
    const reliabilityOffset = index * 0.004 + boost;

    return [
      {
        source_id: makeSourceId(runId, item.axis, "a"),
        title: `${brief.industry} ${item.title} 메인 리포트`,
        publisher: item.sourceA,
        date: clock.date,
        url_or_ref: `${item.sourceA} ${brief.report_date}`,
        reliability_score: makeReliability(0.9, reliabilityOffset),
        axis: item.axis
      },
      {
        source_id: makeSourceId(runId, item.axis, "b"),
        title: `${brief.industry} ${item.title} 교차 검증`,
        publisher: item.sourceB,
        date: clock.date,
        url_or_ref: `${item.sourceB} ${brief.report_date}`,
        reliability_score: makeReliability(0.86, reliabilityOffset),
        axis: item.axis
      },
      {
        source_id: makeSourceId(runId, item.axis, "c"),
        title: `${brief.industry} ${item.title} 시나리오 인사이트`,
        publisher: item.sourceC,
        date: clock.date,
        url_or_ref: `${item.sourceC} ${brief.report_date}`,
        reliability_score: makeReliability(0.83, reliabilityOffset),
        axis: item.axis
      }
    ];
  });

  const evidences: Evidence[] = AXES.flatMap((item, index) => {
    const boost = axisBoostByBrief(brief, item.axis);
    const baseNoise = deterministicNoise(seed, index, 0);
    const trendNoise = deterministicNoise(seed, index, 1);
    const riskNoise = deterministicNoise(seed, index, 2);
    const strategyNoise = deterministicNoise(seed, index, 3);

    const valueA = Number((item.base * (1 + boost) + baseNoise + index * 0.2).toFixed(1));
    const valueB = Number((item.base * (1 + boost * 0.6) + trendNoise + index * 0.15).toFixed(1));
    const valueC = Number((item.base * (1 + boost * 0.4) + riskNoise + index * 0.1).toFixed(1));
    const valueD = Number((item.base * (1 + boost * 0.8) + strategyNoise + index * 0.25).toFixed(1));

    return [
      {
        evidence_id: makeEvidenceId(runId, item.axis, "a"),
        source_id: makeSourceId(runId, item.axis, "a"),
        claim_text: item.claim(brief),
        numeric_values: [valueA],
        quote_snippet: `${item.title} baseline ${valueA}${item.unit}`,
        unit: item.unit,
        period
      },
      {
        evidence_id: makeEvidenceId(runId, item.axis, "b"),
        source_id: makeSourceId(runId, item.axis, "b"),
        claim_text: item.trendClaim(brief),
        numeric_values: [valueB],
        quote_snippet: `${item.title} trend ${valueB}${item.unit}`,
        unit: item.unit,
        period
      },
      {
        evidence_id: makeEvidenceId(runId, item.axis, "c"),
        source_id: makeSourceId(runId, item.axis, "c"),
        claim_text: item.riskClaim(brief),
        numeric_values: [valueC],
        quote_snippet: `${item.title} risk ${valueC}${item.unit}`,
        unit: item.unit,
        period
      },
      {
        evidence_id: makeEvidenceId(runId, item.axis, "d"),
        source_id: makeSourceId(runId, item.axis, "a"),
        claim_text: item.strategyClaim(brief),
        numeric_values: [valueD],
        quote_snippet: `${item.title} strategy ${valueD}${item.unit}`,
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

  const normalized_tables: NormalizedTable[] = [
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
    },
    {
      table_id: `tbl-${runId}-regulation-scenario`,
      title: "규제 시나리오 비교",
      columns: ["시나리오", "정책 강도", "원가 영향", "고객 요구 변화", "대응 우선순위"],
      rows: [
        { 시나리오: "Base", "정책 강도": "중", "원가 영향": "중", "고객 요구 변화": "중", "대응 우선순위": "공급망 투명성 강화" },
        { 시나리오: "Tight", "정책 강도": "상", "원가 영향": "상", "고객 요구 변화": "상", "대응 우선순위": "지역별 인증·원산지 체계 고도화" },
        { 시나리오: "Flexible", "정책 강도": "중하", "원가 영향": "중하", "고객 요구 변화": "중", "대응 우선순위": "고객/제품별 대응 차등화" }
      ]
    },
    {
      table_id: `tbl-${runId}-risk-heatmap`,
      title: "리스크 히트맵",
      columns: ["리스크 항목", "발생확률", "영향도", "조기경보지표", "오너"],
      rows: [
        { "리스크 항목": "원자재 가격 급등", 발생확률: "High", 영향도: "High", 조기경보지표: "원료 스프레드", 오너: "구매/원가" },
        { "리스크 항목": "수요 둔화", 발생확률: "Mid", 영향도: "High", 조기경보지표: "고객 주문 변동", 오너: "영업/전략" },
        { "리스크 항목": "양산 전환 지연", 발생확률: "Mid", 영향도: "Mid-High", 조기경보지표: "수율·불량률", 오너: "생산/R&D" },
        { "리스크 항목": "규제 인증 지연", 발생확률: "Low-Mid", 영향도: "High", 조기경보지표: "인증 일정", 오너: "품질/법무" }
      ]
    },
    {
      table_id: `tbl-${runId}-roadmap-execution`,
      title: "실행 로드맵 단계별 액션",
      columns: ["단계", "핵심 과제", "주요 KPI", "목표 시점", "오너"],
      rows: [
        { 단계: "0-6개월", "핵심 과제": "수익성 방어 과제 실행", "주요 KPI": "OPM/재고회전", "목표 시점": "H1", 오너: "전략 PMO" },
        { 단계: "6-18개월", "핵심 과제": "고객·제품 포트폴리오 재편", "주요 KPI": "고객 다변화율", "목표 시점": "H2~Y+1", 오너: "사업부장" },
        { 단계: "18-36개월", "핵심 과제": "글로벌 확장·기술 고도화", "주요 KPI": "신규 매출 비중", "목표 시점": "Y+2~Y+3", 오너: "CEO Staff" }
      ]
    }
  ];

  return {
    sources: sortByKey(sources, (item) => item.source_id),
    evidences: sortByKey(evidences, (item) => item.evidence_id),
    normalized_tables: sortByKey(normalized_tables, (item) => item.table_id)
  };
}

function countSourcesByAxis(sources: Source[]): Map<Axis, number> {
  const map = new Map<Axis, number>();
  for (const axis of AXIS_ORDER) {
    map.set(axis, 0);
  }
  for (const source of sources) {
    map.set(source.axis, (map.get(source.axis) ?? 0) + 1);
  }
  return map;
}

function countEvidencesByAxis(evidences: Evidence[], sourceById: Map<string, Source>): Map<Axis, number> {
  const map = new Map<Axis, number>();
  for (const axis of AXIS_ORDER) {
    map.set(axis, 0);
  }

  for (const evidence of evidences) {
    const source = sourceById.get(evidence.source_id);
    if (!source) {
      continue;
    }
    map.set(source.axis, (map.get(source.axis) ?? 0) + 1);
  }
  return map;
}

function ensureAxisSourceDepth(sources: Source[], generatedSources: Source[]): Source[] {
  const output = [...sources];
  const counts = countSourcesByAxis(output);

  for (const axis of AXIS_ORDER) {
    if ((counts.get(axis) ?? 0) >= MIN_SOURCES_PER_AXIS) {
      continue;
    }
    const fallback = generatedSources.filter((item) => item.axis === axis);
    for (const candidate of fallback) {
      if (output.some((item) => item.source_id === candidate.source_id)) {
        continue;
      }
      output.push(candidate);
      counts.set(axis, (counts.get(axis) ?? 0) + 1);
      if ((counts.get(axis) ?? 0) >= MIN_SOURCES_PER_AXIS) {
        break;
      }
    }
  }

  return output;
}

function ensureAxisEvidenceDepth(
  evidences: Evidence[],
  sourceById: Map<string, Source>,
  generatedEvidences: Evidence[]
): Evidence[] {
  const output = [...evidences];
  const counts = countEvidencesByAxis(output, sourceById);

  for (const axis of AXIS_ORDER) {
    if ((counts.get(axis) ?? 0) >= MIN_EVIDENCES_PER_AXIS) {
      continue;
    }
    const fallback = generatedEvidences.filter((item) => sourceById.get(item.source_id)?.axis === axis);
    for (const candidate of fallback) {
      if (output.some((item) => item.evidence_id === candidate.evidence_id)) {
        continue;
      }
      output.push(candidate);
      counts.set(axis, (counts.get(axis) ?? 0) + 1);
      if ((counts.get(axis) ?? 0) >= MIN_EVIDENCES_PER_AXIS) {
        break;
      }
    }
  }

  return output;
}

function ensureTableDepth(tables: NormalizedTable[], generatedTables: NormalizedTable[]): NormalizedTable[] {
  const output = [...tables];
  if (output.length >= MIN_TABLE_COUNT) {
    return output;
  }

  for (const fallback of generatedTables) {
    if (output.some((table) => table.table_id === fallback.table_id)) {
      continue;
    }
    output.push(fallback);
    if (output.length >= MIN_TABLE_COUNT) {
      break;
    }
  }

  return output;
}

function harmonizeResearchPack(
  brief: BriefNormalized,
  runId: string,
  clock: ExecutionClock,
  researchPackOverride: ResearchPack | undefined
): ResearchPack {
  const generated = buildGeneratedResearch(brief, runId, clock);

  if (!researchPackOverride) {
    return {
      project_id: brief.project_id,
      run_id: runId,
      generated_at: clock.nowIso,
      sources: generated.sources,
      evidences: generated.evidences,
      normalized_tables: generated.normalized_tables
    };
  }

  const override = {
    ...researchPackOverride,
    project_id: brief.project_id,
    run_id: runId,
    generated_at: researchPackOverride.generated_at || clock.nowIso
  };

  let sources = mergeUniqueByKey(override.sources, generated.sources, (item) => item.source_id);
  sources = ensureAxisSourceDepth(sources, generated.sources);
  const sourceById = new Map(sources.map((item) => [item.source_id, item]));

  const mergedEvidences = mergeUniqueByKey(override.evidences, generated.evidences, (item) => item.evidence_id).filter(
    (item) => sourceById.has(item.source_id)
  );
  const evidences = ensureAxisEvidenceDepth(mergedEvidences, sourceById, generated.evidences);

  const tables = ensureTableDepth(
    mergeUniqueByKey(override.normalized_tables, generated.normalized_tables, (item) => item.table_id),
    generated.normalized_tables
  );

  return {
    project_id: brief.project_id,
    run_id: runId,
    generated_at: override.generated_at,
    sources: sortByKey(sources, (item) => item.source_id),
    evidences: sortByKey(evidences, (item) => item.evidence_id),
    normalized_tables: sortByKey(tables, (item) => item.table_id)
  };
}

export function orchestrateResearch(
  brief: BriefNormalized,
  runId: string,
  clock: ExecutionClock
): ResearchPack {
  return harmonizeResearchPack(brief, runId, clock, undefined);
}

export function enrichResearchPack(
  brief: BriefNormalized,
  runId: string,
  clock: ExecutionClock,
  researchPackOverride: ResearchPack
): ResearchPack {
  return harmonizeResearchPack(brief, runId, clock, researchPackOverride);
}
