# Prompt Alignment (Claude-Style PPT)

이 문서는 고급 컨설팅 보고서 프롬프트 요구사항이 현재 코드에 어떻게 반영되는지 추적합니다.

## 1) 스토리 구조 정렬

- 13~20장 스토리라인 자동 구성
- cover → summary → 분석 → 리스크 → 실행 아크 강제

파일:
- `packages/thinking/src/narrative-planner.ts`
- `packages/qa/src/layout-qa.ts`

## 2) 보고서형 본문 생성

- 각 슬라이드 claim을 `진단/해석/실행` 3단 구조로 생성
- 수치 claim은 evidence pair 기반으로 생성

파일:
- `packages/thinking/src/spec-builder.ts`
- `packages/thinking/src/self-critic.ts`

## 3) 동적 레이아웃 반영

- `visual kind + layout_hint + claim density`로 레이아웃 선택
- heuristic 기본 + optional LLM provider(OpenAI/Anthropic)
- 페이지별 결정 근거 저장 (`layout.decisions.json`)

파일:
- `packages/making/src/renderer/pptxgen/layout-planner.ts`
- `packages/making/src/renderer/pptxgen/layout-engine.ts`
- `packages/making/src/renderer/pptxgen/index.ts`

## 4) 디자인 토큰/타이포

- theme 토큰 기반 색상/간격/타입 적용
- 전체 텍스트 Calibri 통일

파일:
- `packages/making/src/renderer/pptxgen/theme.ts`
- `templates/themes/consulting_kr_blue.theme.json`

## 5) 렌더링 구현 방식

- slide ID 하드코딩 분기 대신 visual kind 기반 적응형 렌더러 사용
- table은 research pack의 normalized table 실데이터 렌더

파일:
- `packages/making/src/renderer/pptxgen/slide-types/consulting13.ts`

## 6) 품질 게이트 정렬

- 텍스트/레이아웃/데이터/출처 QA 점수화
- threshold 미달 시 실행 실패
- auto-fix 후 재렌더/재채점

파일:
- `packages/qa/src/*.ts`
- `apps/cli/src/commands/run.ts`
