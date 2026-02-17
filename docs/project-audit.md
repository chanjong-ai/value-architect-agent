# Project Audit (2026-02-15)

이 문서는 현재 코드베이스를 프로젝트 전체 관점에서 점검한 결과와, 이번 점검에서 실제로 반영한 수정 사항을 기록합니다.

## 1) 감사 범위

- 파이프라인 구조: Thinking -> Making -> QA -> Manifest
- CLI 엔트리(`run/think/make/qa`)와 단계별 산출물 정합성
- 리서치/스토리라인/레이아웃/렌더링/QA 간 데이터 계약 일관성
- 문서(README/Architecture/Runbook)와 코드 동기화
- 회귀 방지 테스트 커버리지

## 2) 실행 기반 검증 결과

아래 명령을 실제 실행해 전수 확인했습니다.

- `pnpm install` -> 통과
- `pnpm build` -> 통과
- `pnpm lint` -> 통과
- `pnpm typecheck` -> 통과
- `pnpm test` -> 통과
- `pnpm regression:check` -> 통과
- `pnpm agent run --brief ./examples/brief.energy-materials.ko.json --project design_spec_smoke --deterministic --seed designspec --no-web-research` -> 통과 (QA 100)
- `pnpm agent run --brief ./examples/brief.energy-materials.ko.json --project design_spec_webcheck --deterministic --seed webcheck --web-research-attempts 30 --web-research-timeout-ms 4000` -> 통과 (QA 100, web attempts completed=30)

샘플 런 경로:
- `runs/2026-10-10/design_spec_smoke/det_8262a3f4_c8aeb7`
- `runs/2026-04-23/design_spec_webcheck/det_fe3f591a_126182`

## 3) 구조/코드 충실도 점검 결과

### A. CLI -> Stage 연계

- `apps/cli/src/commands/run.ts`
  - 웹 리서치 조건(최소 시도 횟수/연관성/축 커버리지) 검증 후 Thinking 실행
  - `slidespec.raw -> slidespec.effective -> qa -> autofix(1회)` 흐름이 코드로 명확히 유지됨
- `apps/cli/src/commands/think.ts`
  - `thinking.review`, `content.quality.pre-render`, `storyline.pre-render.debug`를 산출하여 렌더 전 디버깅 가능
- `apps/cli/src/commands/make.ts`
  - 표 렌더링 시 `research.pack` 존재를 강제하여 `data_ref` 불일치 리스크를 방지

### B. Thinking 품질

- `packages/thinking/src/research-orchestrator.ts`, `packages/thinking/src/web-research.ts`
  - 브리프 기반 동적 리서치 + 최소 30회 웹 시도 + 축별 보강 구조 유지
- `packages/thinking/src/spec-builder.ts`, `packages/thinking/src/self-critic.ts`
  - claim/evidence/source 연결과 So What 정규화 로직 일관 유지

### C. Making 품질

- `packages/making/src/renderer/pptxgen/layout-validator.ts`
  - 템플릿 선택/적합도/다회 리뷰(기본 4회) 기반 보정 구조 유지
- `packages/making/src/renderer/pptxgen/slide-types/consulting13.ts`
  - visual kind 중심 렌더링 구조 유지
  - 텍스트-only 슬라이드 자동 보강(bar-chart fallback) 포함
- `packages/making/src/renderer/pptxgen/icon-library.ts`
  - 아이콘 렌더 파이프라인(`react-icons -> renderToStaticMarkup -> sharp -> base64`) 적용

### D. QA 품질

- `packages/qa/src/*.ts`
  - 텍스트/레이아웃/데이터/소스 4축 점검 구조가 유지됨
  - threshold 기반 pass/fail 게이트 정상 동작

## 4) 이번 감사에서 실제 반영한 수정

### 4.1 소스 푸터 문자열 버그 수정

- 문제: 소스가 비어 있을 때 `Source: Source: N/A`로 중복 출력될 수 있었음
- 조치: fallback 텍스트를 `N/A`로 교정
- 파일: `packages/making/src/renderer/pptxgen/components/slide-frame.ts`

### 4.2 커버 슬라이드 예외 처리 개선(QA)

- 문제: 커버 슬라이드에 visual이 없어도 `visual_missing` 경고가 발생할 수 있었음
- 조치: `cover` 타입은 visual/labelling 권고 검사에서 제외
- 파일: `packages/qa/src/layout-qa.ts`

### 4.3 거버닝 메시지 톤 판정 오탐 수정

- 문제: `팩트A + 팩트B = So What` 공식형 문장이 톤 규칙에서 오탐될 수 있었음
- 조치:
  - QA 톤 판정에서 공식형/`결론` 패턴을 컨설팅 톤으로 허용
  - 렌더 전 layout-validator의 톤 판정도 동일 기준으로 정렬
- 파일:
  - `packages/qa/src/text-qa.ts`
  - `packages/making/src/renderer/pptxgen/layout-validator.ts`

### 4.4 회귀 테스트 추가

- 공식형 거버닝 메시지 허용 회귀 테스트 추가
- 커버 슬라이드 visual 예외 테스트 추가
- 소스 푸터 `Source:` 중복 방지 테스트 추가
- 파일:
  - `packages/qa/src/__tests__/qa.spec.ts`
  - `packages/making/src/__tests__/slide-frame.spec.ts`

### 4.5 문서 정합성 보정

- 레이아웃 provider 설명에 `agentic` 기본값 반영
- 아이콘 렌더 파이프라인 설명 추가
- 파일: `docs/architecture.md`

## 5) 현재 잔여 리스크

- 산업별 고난도 인사이트(예: 계약 구조/고객 믹스/원가 전가)는 사람 리뷰가 여전히 유리
- 디자인 완성도는 자동화 품질이 상승했지만, 최종 임원 보고 전 1회 수동 편집을 권장

## 6) 결론

현재 코드베이스는 파이프라인 목적(리서치 기반 컨설팅 보고서 자동 생성)에 맞는 구조를 유지하고 있으며,
이번 점검에서 발견된 실제 품질 이슈(소스 표기/커버 예외/톤 오탐)를 코드와 테스트로 보강해 회귀 가능성을 낮췄습니다.

## 7) 추가 점검 (범용 시나리오, 2026-02-15)

아래 명령으로 범용 브리프를 실행해 end-to-end 동작을 재검증했습니다.

- `pnpm agent run --brief ./examples/brief.energy-materials.ko.json --project generic_global_battery_strategy_2026 --deterministic --seed generic_v1 --web-research-attempts 30 --layout-provider agentic`

결과:
- run root: `runs/2026-04-22/generic_global_battery_strategy_2026/det_89c1b5b7_9f574a`
- QA: 100/100 (이슈 0)
- 웹 리서치: attempts_completed=30, relevant_successes=12, review_rounds=3
- 산출물: `output/report.pptx`, `spec/slidespec.effective.json`, `output/layout.decisions.json`

추가 관찰:
- 웹 리서치 성공 축 분포에서 `competition`, `finance` 축 성공 건수가 낮을 수 있음(실행 시점 네트워크/검색 결과 영향).
- 현재 파이프라인은 축 커버리지 부족 시 `research-orchestrator` 보강 로직으로 최종 리서치 팩의 구조적 완전성을 보정하며, QA 게이트를 통과하지 못하면 실패하도록 유지됩니다.

## 8) 퍼블릭 공개 준비 점검 강화 (2026-02-17)

이번 점검에서 공개 저장소 관점의 반복 리스크를 자동 차단하도록 아래를 추가했습니다.

- 신규 스크립트: `scripts/public-readiness-check.mjs`
  - 추적 파일에서 특정 고객사/기업 실명, 삭제된 사내 샘플 참조, 직접 비교 표현을 탐지하면 즉시 실패(exit 1)
- `package.json`에 `pnpm public:check` 스크립트 추가
- CI/Quality Gate 워크플로에 `Public readiness check` 단계 추가

검증:
- `pnpm public:check` -> 통과
- `pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm schema:validate && pnpm smoke` -> 통과
