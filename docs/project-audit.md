# Project Audit (2026-02-14)

## 목적
초기 마스터 프롬프트(`codex_ppt_agent_master_prompt.md`)와 개선 프롬프트(`prompt_analysis_and_improvement.md`) 기준으로,
현재 코드베이스의 구조/완성도/오류 여부를 전수 점검한 결과를 정리합니다.

## 1) 아키텍처 적합성 점검

- ✅ Thinking → Making 2단계 강제
- ✅ Spec-First (`slidespec.json` 선행)
- ✅ Schema validation (`brief`, `research-pack`, `slidespec`, `manifest`, `feedback`)
- ✅ run 단위 아카이빙(`input/research/spec/output/qa/manifest`)
- ✅ QA threshold 미달 시 non-zero exit
- ✅ deterministic 실행(`--deterministic --seed`)

핵심 파일:
- `packages/thinking/src/index.ts`
- `packages/making/src/renderer/pptxgen/index.ts`
- `packages/qa/src/index.ts`
- `apps/cli/src/commands/run.ts`

## 2) 슬라이드 구조/디자인 요구사항 점검

- ✅ 13장 기본 구조 반영 (cover~roadmap)
- ✅ Title → Takeaway → Content → Source/Page 레이아웃 고정
- ✅ 색상/타이포/간격 토큰화
- ✅ 슬라이드별 필수 visual kind QA 반영
- ✅ table style helper (`makeHeaderOpts`, `makeCellOpts`, `makeAltCellOpts`)

핵심 파일:
- `packages/thinking/src/narrative-planner.ts`
- `packages/thinking/src/spec-builder.ts`
- `packages/making/src/renderer/pptxgen/layout-engine.ts`
- `packages/making/src/renderer/pptxgen/theme.ts`
- `packages/making/src/renderer/pptxgen/components/table-style.ts`
- `packages/qa/src/layout-qa.ts`

## 3) 이번 보강 반영 사항

### A. 산업/기업 문맥 강화
- 커버/시장/경쟁 슬라이드 제목을 brief 기반으로 동적 생성
- 타깃 기업 및 경쟁사 문맥을 스토리라인에 반영

파일:
- `packages/thinking/src/narrative-planner.ts`

### B. research 기본 생성물 현실성 강화
- 축별 source/evidence를 산업·타깃기업 문맥으로 생성
- period를 report_date 기반으로 표준화
- 단일 KPI 테이블에서 다중 분석 테이블 구조로 확장:
  - 시장 KPI
  - 경쟁 순위 Top 10
  - 타깃 재무 상세
  - 플레이어 비교 매트릭스
  - 기술 벤치마크
  - 재무 성과 비교

파일:
- `packages/thinking/src/research-orchestrator.ts`

### C. table data_ref 정밀 매핑
- 슬라이드 ID별 table role 매핑 추가
- fallback 유지(테이블 누락 시 default table)

파일:
- `packages/thinking/src/spec-builder.ts`

### D. 렌더 품질 강화
- 렌더러가 `research.pack`의 실제 normalized table을 직접 사용하도록 연결
- placeholder 표보다 실데이터 중심 렌더링

파일:
- `packages/making/src/renderer/pptxgen/types.ts`
- `packages/making/src/renderer/pptxgen/index.ts`
- `packages/making/src/renderer/pptxgen/slide-types/consulting13.ts`

### E. QA 강도 강화
- 13장 여부와 무관하게 slide-id 기반 필수 시각요소 검증 적용

파일:
- `packages/qa/src/layout-qa.ts`

## 4) McKinsey/BCG 레벨 관점 갭 분석

자동화로 상당 부분 충족했지만, 아래는 여전히 사람의 고급 판단이 필요합니다.

- 산업별 "의미 있는 분해"(수요·원가·정책·고객전략)의 깊이
- 조직 실행 가능성(의사결정 권한/자본배분/영업역량)의 현실 반영
- 경영진 발표 문장 톤(한 문장 결론의 설득력/정치적 안전성)

권장 운영:
1. `pnpm agent run ... --research <검증된 외부 리서치팩>` 방식으로 최신 데이터 주입
2. `qa.summary.md`의 high 이슈 제거 후, 제목/권고안 문장만 수동 polish
3. 경영진 제출본은 마지막으로 도메인 리더 리뷰(15~20분)를 반드시 수행

## 5) 결론

현재 프로젝트는 "구조적 품질 + 재현성 + 검증 가능성" 측면에서 마스터 프롬프트의 핵심 요구를 충족하며,
이번 업데이트로 데이터-렌더 연결과 스토리 문맥 반영 수준이 개선되었습니다.
