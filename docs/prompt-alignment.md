# Prompt Alignment (Claude-Style PPT)

이 문서는 `/Users/chanjonglee/Downloads/prompt_analysis_and_improvement.md`의 요구사항을
현재 코드베이스에 어떻게 반영했는지 추적하기 위한 매핑이다.

## 1) 13장 구조 매핑

- 스토리라인 재설계:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/thinking/src/narrative-planner.ts`
- 슬라이드별 제목/포커스:
  - 표지 → Executive Summary → 시장 개요 → 경쟁 환경 → 타깃 심층 → 비교 매트릭스 → 기술/제품 → 밸류체인 → 재무 비교 → 트렌드/기회 → 리스크 → 전략적 시사점 → 권고안

## 2) 슬라이드별 필수 시각요소 반영

- SlideSpec visual kind 확장:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/shared/src/types.ts`
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/thinking/schemas/slidespec.schema.json`
- 슬라이드 ID별 필수 visual 매핑:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/thinking/src/spec-builder.ts`
- QA에서 필수 visual 누락 fail:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/qa/src/layout-qa.ts`

## 3) 디자인 시스템 반영

- 색상/폰트/타입 계층 토큰화:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/making/src/renderer/pptxgen/theme.ts`
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/templates/themes/consulting_kr_blue.theme.json`
- 헤더 레이아웃(Title→Takeaway) + Source/Page 위치:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/making/src/renderer/pptxgen/layout-engine.ts`
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/making/src/renderer/pptxgen/components/slide-frame.ts`
- 테이블 헬퍼:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/making/src/renderer/pptxgen/components/table-style.ts`

## 4) 렌더링 구조 반영

- 16:9 커스텀 레이아웃(10 x 5.625):
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/making/src/renderer/pptxgen/index.ts`
- 13장 패턴 기반 렌더러:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/making/src/renderer/pptxgen/slide-types/consulting13.ts`
- `research.pack`의 normalized table 실데이터를 슬라이드 표에 직접 연결:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/making/src/renderer/pptxgen/types.ts`
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/making/src/renderer/pptxgen/index.ts`
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/making/src/renderer/pptxgen/slide-types/consulting13.ts`
- 기존 slide-type 파일은 공통 렌더러로 위임:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/making/src/renderer/pptxgen/slide-types/*.ts`

## 5) QA/검증 강화

- 스토리 아크 점검(cover first, 핵심 타입, 순서):
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/qa/src/layout-qa.ts`
- slide-id 기반 필수 visual 누락 검증(13장 여부와 무관하게 적용):
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/qa/src/layout-qa.ts`
- takeaway 형식 점검:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/qa/src/text-qa.ts`
- source footer 완전성 점검:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/qa/src/source-qa.ts`
- table data_ref 정합성 점검:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/packages/qa/src/data-qa.ts`

## 6) 테스트 데이터/실행 검증

- 실전형 예시:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/examples/brief.energy-materials.ko.json`
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/examples/research.energy-materials.ko.json`
- 최근 검증 run:
  - `/Users/chanjonglee/Documents/GitHub/value-architect-agent/runs/2026-02-14/energy_materials_cathode_anode/20260214_224037_br2uq1`
  - QA score: 100

## 7) 리서치 계층 전략 반영 방식

- 프롬프트의 Layer 1~4 웹리서치는 런타임에서 자동 브라우징하지 않고,
  `--research`로 주입되는 `research.pack.json`에 반영하는 구조다.
- 즉, 수집/정제(통화, 시점, 교차검증)는 외부 리서치 파이프라인에서 수행하고,
  본 프로젝트는 검증/스토리화/렌더링/QA를 책임진다.
