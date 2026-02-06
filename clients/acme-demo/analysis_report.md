# Client Analysis Report: acme-demo

- Generated at: 2026-02-06T23:15:08
- Industry: Manufacturing
- Audience: C-level (CEO/CFO/CIO)
- Maturity: **READY_FOR_EXEC_DECK**

## 1) Readiness Scorecard

- Overall: **99/100**
- Brief: 100
- Sources: 96
- Storyline: 100
- Spec: 100
- Execution: 100
- Quality gate: PASS

## 2) Current Artifact Diagnostics

- Slides in spec: 11
- Outline slide count: 11
- Total bullets: 34
- Bullet evidence coverage: 100%
- Source sections found: 4/4 (extra: 1)
- Checked source entries: 11
- Latest QA: PASS
- QA summary: errors 0, warnings 0, info 0
- QA report: `/Users/chanjonglee/Documents/GitHub/value-architect-agent/clients/acme-demo/outputs/acme-demo_20260206_231418_qa_report.json`

## 3) Recommended Analysis Modules (Client-Specific)

### M1. Issue Tree & Hypothesis (HIGH)
- 분석 목적: 경영진 질문을 이슈 트리로 구조화하고 검증 가설을 정의
- 수행 방법: Issue Tree, Pyramid Principle, Hypothesis Backlog
- 필요 데이터: brief, 핵심 질문, 경영진 의사결정 포인트
- PPT 반영: Exec Summary / Section Divider / Storyline backbone

### M2. External Context & Market Drivers (HIGH)
- 분석 목적: 시장/기술/규제 요인이 고객사의 전략 선택에 미치는 영향 정량화
- 수행 방법: Market sizing, trend decomposition, scenario framing
- 필요 데이터: 시장 리포트, 거시/산업 데이터, 기술 채택 지표
- PPT 반영: Industry Context / Strategic Implications

### M3. Current State Diagnostic (HIGH)
- 분석 목적: As-Is 운영/데이터/조직의 병목과 손실 구간 파악
- 수행 방법: KPI baseline, process bottleneck mapping, maturity assessment
- 필요 데이터: 내부 KPI, 프로세스 현황, 시스템 인터페이스
- PPT 반영: Current State / Pain Points
- 리스크: 내부 데이터 미제공 시 가정 기반 산출로 신뢰도 제한

### M4. Benchmark & Competitive Gap (HIGH)
- 분석 목적: 선도사와의 격차를 capability 및 KPI 관점으로 계량화
- 수행 방법: Peer benchmarking, capability heatmap, gap scoring
- 필요 데이터: 경쟁사 공개자료, 벤치마크 KPI, 사례 비교
- PPT 반영: Competitive Landscape / Comparison

### M5. Option Design & Value Case (HIGH)
- 분석 목적: 실행 옵션별 효과/비용/리스크를 비교해 우선순위 도출
- 수행 방법: Option matrix, cost-benefit model, sensitivity analysis
- 필요 데이터: 투자비, 운영비, 기대효과, 가정 파라미터
- PPT 반영: Value Case / Recommendation
- 리스크: 내부 데이터 미제공 시 가정 기반 산출로 신뢰도 제한

### M6. Roadmap, Governance, and Risks (MEDIUM)
- 분석 목적: 실행 로드맵, PMO, 리스크 대응 체계 구체화
- 수행 방법: Wave planning, milestone design, risk-control matrix
- 필요 데이터: 프로젝트 일정, 조직 구조, 의사결정 체계
- PPT 반영: Timeline / Process Flow / Closing

### X1. Manufacturing Operations Analytics (HIGH)
- 분석 목적: 생산성/품질/설비가동률 관점의 개선 레버 정의
- 수행 방법: OEE decomposition, quality loss tree, downtime analysis
- 필요 데이터: 설비가동, 불량, 재작업, 납기 지표
- PPT 반영: Current State / Value Case / Roadmap
- 리스크: 내부 데이터 미제공 시 가정 기반 산출로 신뢰도 제한

## 4) Analysis-to-Slide Mapping

| 분석 단계 | 핵심 산출물 | 권장 레이아웃 |
|---|---|---|
| 이슈 구조화 | 의사결정 질문, 가설 트리 | exec_summary / section_divider |
| 외부환경 분석 | 시장/기술/규제 드라이버 | content / two_column |
| As-Is 진단 | 병목, KPI baseline | content / comparison |
| 벤치마크 | 경쟁사 대비 갭 | comparison / three_column |
| 가치 검증 | 옵션별 효과/비용, 민감도 | chart_focus / content |
| 실행 설계 | 단계별 로드맵, 거버넌스 | timeline / process_flow |

## 5) Gap & Risk Items

- 주요 갭 없음

## 6) Immediate Action Plan

- `clients/acme-demo/brief.md`에 의사결정 질문, 성과 KPI, 발표 목적을 수치 중심으로 명확화
- `clients/acme-demo/sources.md` 각 항목에 발행일/URL/접근일 추가 (감사 추적성 확보)
- `clients/acme-demo/deck_spec.yaml`의 핵심 불릿에 evidence/source_anchor 우선 연결
- `python scripts/deck_cli.py full-pipeline acme-demo --sync-layout --enrich-evidence --polish`로 품질 게이트 재확인
- 내부 KPI 미제공 상태이므로 Value Case는 범위형 시나리오(보수/기준/공격)로 명시

## 7) Consulting-Grade Quality Gates

- 주장-근거 연결(evidence/source_anchor) 80% 이상
- 레이아웃별 불릿 규칙 준수 (일반 3-6, 시각중심 0-4, no-bullet 0)
- 최신 QA 보고서 오류 0 유지
- Value Case 수치는 시나리오/가정/근거를 슬라이드 노트에 명시
