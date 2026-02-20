# CLAUDE.md — value-architect-agent 에이전틱 가이드

Claude Code가 이 프로젝트를 작업할 때 자동으로 읽는 컨텍스트 파일입니다.

## 프로젝트 개요

맥킨지 컨설팅 수준의 PPT를 자동 생성하는 2단계 에이전트 파이프라인:
- **Thinking** (`packages/thinking`): brief → researchPack → narrativePlan → meceFramework → slideSpec
- **Making** (`packages/making`): slideSpec → PptxGenJS → .pptx 파일
- **QA** (`packages/qa`): slideSpec 품질 검증 (score ≥ 80 필수) + MECE 커버리지 리포팅
- **Memory** (`packages/memory`): 피드백 학습, 프롬프트 진화
- **Shared** (`packages/shared`): 공유 타입/스키마

## 핵심 명령어

```bash
# 전체 빌드
pnpm build

# 타입 체크
pnpm typecheck

# 테스트
pnpm test

# 스키마 검증 (end-to-end 파이프라인)
pnpm schema:validate

# PPT 생성 실행
pnpm agent think --brief ./examples/brief.energy-materials.ko.json --project my_project

# 스모크 테스트
pnpm smoke
```

## 아키텍처 원칙 (변경 금지)

1. **단방향 파이프라인**: brief → research → narrative → meceFramework → spec → render → qa
2. **스키마 검증**: 각 단계 사이에 JSON Schema 검증 필수 (`packages/thinking/src/validator.ts`)
3. **Claim-Evidence 매핑**: 모든 claim은 `evidence_ids[]`를 반드시 포함
4. **QA Gate**: `qa_score < 80`이면 파이프라인 실패
5. **결정론적 모드**: `--deterministic --seed <string>` 옵션으로 재현 가능한 결과
6. **MECE 원칙**: 6개 축(market/competition/finance/technology/regulation/risk) × 4개 범주 분해 필수

## McKinsey 디자인 표준 (컴포넌트 수정 시 준수)

### 색상
- **절대 하드코딩 금지**: 모든 색상은 `theme.colors.*` 사용
- 색상 팔레트 최대 3색: primary(003A70 navy), accent(0077B6 blue), secondary(5A6B7B gray)
- 테마 파일: `packages/making/src/renderer/pptxgen/theme.ts`

### 도형
- **roundRect 사용 금지**: 모든 도형은 `rect` (직각)
- shadow, gradient 금지 — 극도의 미니멀리즘

### 타이포그래피
- Action Title: 18pt Bold, `primary` 색상 (navy)
- Governing Message/Takeaway: 11pt Bold, `primary` 색상
- Body: 8pt, `text` 색상
- Source Footer: 8pt, `source` 색상 (gray)

### 슬라이드 해부 (레이아웃 좌표)
- Title Zone: y=0.08, h=0.28 (Action Title)
- Takeaway Zone: y=0.48, h=0.34 (Governing Message — 1~2줄)
- Content Zone: y=0.95 ~ 5.15 (시각 요소 + bullets)
- Source Footer: y=5.25, h=0.12

## 주요 파일 위치

| 역할 | 파일 |
|------|------|
| 파이프라인 진입점 | `packages/thinking/src/index.ts` |
| SCQA 프레임워크 | `packages/thinking/src/narrative-planner.ts` |
| 슬라이드 스펙 빌더 | `packages/thinking/src/spec-builder.ts` |
| **MECE 프레임워크** | `packages/thinking/src/mece-framework.ts` |
| Self-Critic | `packages/thinking/src/self-critic.ts` |
| Content Quality Gate | `packages/thinking/src/content-quality-gate.ts` |
| 렌더러 진입점 | `packages/making/src/renderer/pptxgen/index.ts` |
| **실제 PPT 렌더링 엔진** | `packages/making/src/renderer/pptxgen/slide-types/consulting13.ts` |
| 레이아웃 엔진 | `packages/making/src/renderer/pptxgen/layout-engine.ts` |
| Deck Review | `packages/making/src/renderer/pptxgen/layout-validator.ts` |
| 테마 토큰 | `packages/making/src/renderer/pptxgen/theme.ts` |
| QA 메인 | `packages/qa/src/index.ts` |
| QA 레이아웃 | `packages/qa/src/layout-qa.ts` |
| QA 텍스트 | `packages/qa/src/text-qa.ts` |

> **⚠️ 주의**: `packages/making/src/renderer/pptxgen/components/` 디렉터리의 파일들
> (`kpi-cards.ts`, `risk-matrix.ts`, `comparison-table.ts`, `title-block.ts`)은
> **현재 어디에서도 import되지 않는 사용되지 않는 코드(dead code)**입니다.
> 실제 PPT 렌더링은 전적으로 `consulting13.ts` 내부 함수들이 담당합니다.
> 렌더링 로직을 수정하거나 추가할 때는 반드시 `consulting13.ts`를 직접 수정해야 합니다.

## Claude Code 에이전틱 워크플로우

### 새 기능 추가 시
1. `pnpm typecheck` → 오류 없음 확인
2. 기능 구현
3. `pnpm typecheck` 재실행 → 오류 수정
4. `pnpm test` → 테스트 통과 확인
5. `pnpm schema:validate` → 전체 파이프라인 검증

> **패키지 빌드 의존성 주의**: `apps/cli`는 `@consulting-ppt/thinking`의 컴파일된 `.d.ts`에 의존합니다.
> `thinking` 패키지의 타입을 변경한 후 CLI에서 타입 오류가 발생하면,
> `pnpm --filter @consulting-ppt/thinking build` 실행 후 재검증 필요.

### 렌더링 컴포넌트 수정 시
- **항상** `consulting13.ts`를 수정 (components/ 파일은 dead code)
- **항상** `ThemeTokens` 인터페이스 토큰만 사용 — `"FFFFFF"`, `"E8E8E8"` 등 하드코딩 절대 금지
- `roundRect` → `rect` 변환 필수
- 레이블은 `extractConsultingLabel()` 헬퍼 함수 활용 (claim 텍스트 추출, "KPI 1" 같은 범용 레이블 금지)
- 수정 후 `pnpm typecheck && pnpm test` 실행

### QA 규칙 추가 시
- `packages/qa/src/layout-qa.ts` 또는 `text-qa.ts`에 issue 추가
- `packages/qa/src/index.ts`에 `deduceFailReasons()` 매핑 추가
- QA Summary markdown 섹션 업데이트

### MECE 프레임워크 수정 시
- `packages/thinking/src/mece-framework.ts` 수정
- 6개 축 및 4개 레버는 McKinsey 표준 — 임의 변경 금지
- `@consulting-ppt/qa`는 `@consulting-ppt/thinking`을 import하면 안 됨 (순환 의존성)
  → MECE 점수는 CLI 레이어에서 `QaExecutionOptions.meceCoverageScore`로 전달
- 수정 후 `pnpm test` (mece-framework.spec.ts 7개 테스트 통과 확인)

### 슬라이드 타입 추가 시
1. `packages/shared/src/types.ts`에 `SlideType` 유니온 추가
2. `packages/making/src/renderer/pptxgen/layout-engine.ts`에 `defaultTemplateBySlideType()` 케이스 추가
3. `packages/making/src/renderer/pptxgen/slide-types/consulting13.ts`에 렌더 로직 추가
4. `packages/qa/src/layout-qa.ts`에 `REQUIRED_VISUAL_GROUPS_BY_TYPE` 엔트리 추가
5. 관련 스키마 JSON 업데이트

## 병렬 에이전틱 탐색 패턴

여러 패키지를 동시에 탐색할 때는 Task 에이전트를 병렬 실행:
```
Task(Explore, "packages/thinking/src")
Task(Explore, "packages/making/src")
Task(Explore, "packages/qa/src")
```

## 테스트 파일 위치

- `packages/thinking/src/__tests__/thinking.spec.ts` — 4개 테스트
- `packages/thinking/src/__tests__/mece-framework.spec.ts` — 7개 테스트 (MECE 프레임워크)
- `packages/qa/src/__tests__/qa.spec.ts` — 8개 테스트
- `packages/making/src/__tests__/layout-validator.spec.ts` — 6개 테스트
- `packages/making/src/__tests__/text-fit.spec.ts` — 4개 테스트
- `packages/making/src/__tests__/slide-frame.spec.ts` — (슬라이드 프레임)
- `packages/memory/src/__tests__/feedback-store.spec.ts` — (메모리)

## 알려진 설계 결정

1. **결정론적 해시 시드**: `research-orchestrator.ts`의 `hashSeed()` 함수는 동일 brief → 동일 출력 보장
2. **Synthesis Layer**: research axes 간 교차 합성으로 단순 팩트 이상의 So What Chain 생성
3. **3단계 Claim 구조**: 각 슬라이드마다 diagnosis / implication / action 3개 claim 필수
4. **Source Footer**: 모든 슬라이드에 evidence → source 역추적 체인 필수
5. **Vertical Flow**: layout-validator.ts가 title 키워드 → body 커버리지 33% 이상 검증
6. **MECE 프레임워크**: 6축(market/competition/finance/technology/regulation/risk) × 4범주 문제 분해 + 4레버(cost/revenue/assets/growth) 권고안 공간. `coverageScore`는 축 커버리지 70% + 레버 커버리지 30% 가중 합산. QA summary에 반영.
7. **Dead Code (components/)**: `kpi-cards.ts`, `risk-matrix.ts`, `comparison-table.ts`, `title-block.ts`는 아무 곳에서도 import되지 않음. 실제 렌더링은 `consulting13.ts`가 전담. 미래 리팩터링 시 삭제 또는 통합 검토 필요.
8. **extractConsultingLabel()**: `consulting13.ts` 내부 헬퍼. claim 텍스트에서 So What 접미사 제거 후 의미 있는 2어절 레이블 추출. "KPI 1/2/3", "Action 1/2/3" 같은 범용 레이블을 방지.

## 금지 사항

- `roundRect` 사용 절대 금지 (McKinsey 직각 원칙)
- 하드코딩 hex 색상 금지 (`theme.colors.*` 사용) — `"FFFFFF"`, `"E8E8E8"` 등 포함
- 범용 레이블 금지 (`"KPI 1"`, `"Action 2"` 등 — `extractConsultingLabel()` 사용)
- QA 임계값(80점) 하향 금지
- `evidence_ids[]` 없는 claim 생성 금지
- 스키마 검증 우회 금지
- `@consulting-ppt/qa`에서 `@consulting-ppt/thinking` import 금지 (순환 의존성)
- `packages/making/src/renderer/pptxgen/components/` 파일 수정 금지 (dead code — 실제 효과 없음)
