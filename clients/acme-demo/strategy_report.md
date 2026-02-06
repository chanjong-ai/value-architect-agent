# Strategy Recommendation Report: acme-demo

- Generated at: 2026-02-06T23:29:45
- Industry: Manufacturing
- Audience: C-level (CEO/CFO/CIO)
- Objective: ERP + AI 기반 운영 전환 Value Case 및 24개월 실행안 제시
- Internal data level: none

## 1) Input Summary

- Focus areas (input): cost_reduction, operational_excellence, ai_scaling, risk_control
- Must-answer questions: 3
- Expected slides: 11
- Storytelling mode: decision_first

## 2) Priority Focus Score

| Focus | Score | 권장 관점 |
|---|---:|---|
| 운영 효율/프로세스 혁신 | 6 | 현업 프로세스 병목과 의사결정 리드타임을 함께 개선하는 실행 시나리오 설계 |
| 비용 절감/수익성 개선 | 4 | 원가 구조 분해, 손실 구간 식별, 시나리오 기반 절감안 우선순위화 |
| AI 확산/자동화 | 3 | 우선 유스케이스를 선별하고 효과/난이도 기반으로 확산 순서를 설계 |
| 리스크 통제/컴플라이언스 | 3 | 통제 사각지대와 규제 영향도를 반영한 단계별 리스크 완화 계획 수립 |

## 3) Recommended Analysis Modules

| Module | Stage | Priority Score |
|---|---|---:|
| Roadmap, Governance, and Risks | 실행설계 | 16 |
| Option Design & Value Case | 가치검증 | 13 |
| Current State Diagnostic | 현황진단 | 10 |
| External Context & Market Drivers | 외부환경 | 6 |
| Benchmark & Competitive Gap | 벤치마크 | 3 |
| Issue Tree & Hypothesis | 문제정의 | 2 |

## 4) Recommended Slide Architecture

| Slide | Layout | Recommended Theme |
|---:|---|---|
| 1 | cover | 프로젝트 목적과 경영진 의사결정 주제 |
| 2 | exec_summary | 핵심 결론과 결정 포인트 |
| 3 | section_divider | 분석 파트 전환 |
| 4 | content | 운영 효율/프로세스 혁신 |
| 5 | comparison | As-Is vs To-Be / 경쟁사 격차 |
| 6 | content | 비용 절감/수익성 개선 |
| 7 | section_divider | 분석 파트 전환 |
| 8 | chart_focus | 정량 효과/ROI/민감도 |
| 9 | timeline | 단계별 로드맵 |
| 10 | process_flow | 실행 운영모델/거버넌스 |
| 11 | thank_you | 의사결정 요청 및 다음 단계 |

## 5) Generated Artifacts

- Strategy report (json): `/Users/chanjonglee/Documents/GitHub/value-architect-agent/clients/acme-demo/strategy_report.json`
- Generated layout preference: `/Users/chanjonglee/Documents/GitHub/value-architect-agent/clients/acme-demo/layout_preferences.generated.yaml`

## 6) Execution Actions

- `python scripts/deck_cli.py sync-layout acme-demo --pref /Users/chanjonglee/Documents/GitHub/value-architect-agent/clients/acme-demo/layout_preferences.generated.yaml`
- `python scripts/deck_cli.py analyze acme-demo`
- `python scripts/deck_cli.py full-pipeline acme-demo --sync-layout --enrich-evidence --polish`
- 내부 데이터 미보유: Value Case를 보수/기준/공격 3개 시나리오로 제시
