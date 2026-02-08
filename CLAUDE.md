# Project Rules (value-architect-agent)

## Mission
고객사별로 경영진 설득형 컨설팅 PPT를 안정적으로 생성한다.

핵심 목표:
- 최신/신뢰 근거 기반 리서치
- 논리적 스토리 구조와 페이지별 설계
- 밀도 높은 본문과 일관된 디자인
- 자동 검증(스키마/QA) 통과

## Operating Principles

### 1) Single Source of Truth
- 최종 렌더의 기준은 항상 `clients/<client>/deck_spec.yaml`.
- 수정은 원칙적으로 spec에서 수행한다.

### 2) Predeck-First
- 실무 기본 흐름은 `predeck`(리서치+블루프린트) 후 제작.
- 템플릿 편집보다 리서치/구조 품질을 우선한다.

### 3) Quality Gates
- `validate` 실패 상태에서 렌더링 강행 금지.
- `qa` 오류는 0건을 기본 기준으로 한다.

### 4) Font & Tone Consistency
- 기본 폰트는 Noto Sans KR 일반체.
- 문장은 지나친 축약 대신 컨설팅 보고서 톤의 문장형 서술을 유지.

## Standard Workflow (v2.4)

```text
new
→ predeck (research_report + layout_blueprint + optional update-spec)
→ recommend (optional)
→ analyze (optional)
→ densify
→ sync-layout (optional)
→ enrich-evidence (optional)
→ validate
→ render
→ qa
→ polish (optional)
```

권장 단일 명령:

```bash
python scripts/deck_cli.py full-pipeline <client> \
  --topic "<주제>" \
  --sync-layout --enrich-evidence --polish \
  --template-mode additional
```

## CLI Rules

### Client Creation
- 기본 생성: `new <client>`
- 동일 고객 다른 주제: `new <client> --topic "..." --new-folder-if-exists`

### Research & Blueprint
- `predeck`는 아래를 생성해야 한다.
  - `research_report.md/json`
  - `layout_blueprint.md/yaml`
  - `layout_preferences.research.yaml`
- 필요시 `--update-spec`로 spec 반영.

### Render Template Selection
- `--template-mode auto`가 기본.
- 우선순위: `additional` → `base` → `blank(16:9 fallback)`.

## Non-Negotiables

1. `deck_spec.yaml` 없는 렌더링 금지.
2. 주장에는 근거(`evidence.source_anchor`)를 연결.
3. 커버/섹션/마무리 외 일반 슬라이드는 빈 본문 금지.
4. 본문 하단 공백이 큰 슬라이드는 narrative 또는 구조 재배치로 보정.
5. 산출물은 `clients/<client>/outputs/`에 추적 가능하게 남긴다.

## Content Density Policy

기본 가이드:
- 컨텐츠 중심 슬라이드: 불릿 6~10개 권장(상황에 따라 `slide_constraints`로 제어)
- 불릿은 문장형으로 작성(근거/조건/시사점 포함)
- 표/차트 슬라이드도 해석 문단 또는 시사점 블록 포함

금지 패턴:
- 제목/거버닝만 있고 본문이 빈 상태
- 데이터 설명 없이 도식만 있는 상태
- 근거 없는 단정 문장 반복

## Validation & QA Policy

### validate
- 스키마 + 비즈니스 규칙 검사.
- 실패 시 해당 필드부터 수정 후 재검증.

### qa
- 폰트/밀도/경계/Spec 정합/근거 연계를 확인.
- 목표: 오류 0, 경고 0 (프로젝트 기준).

## Repository Conventions

- 공통 로직은 `scripts/`에 반영해 다른 고객에도 전파한다.
- 고객별 임시 수정은 지양하고, 가능하면 파이프라인 일반화로 해결한다.
- `_template`는 항상 유효한 최소 스펙 상태를 유지한다.

## Key Files

- `scripts/deck_cli.py`: 통합 오케스트레이션
- `scripts/predeck_research.py`: 심화 리서치/블루프린트
- `scripts/densify_spec.py`: 본문 밀도 보강
- `scripts/render_ppt.py`: 렌더러
- `scripts/qa_ppt.py`: 품질 검사
- `scripts/polish_ppt.py`: 미세 편집
- `schema/deck_spec.schema.json`: 스키마
- `templates/company/tokens.yaml`: 디자인 토큰

## Troubleshooting Checklist

1. `validate` 통과 여부 확인
2. `qa` 보고서에서 밀도/경계 경고 확인
3. `layout_intent`, `content_blocks`, `slide_constraints` 점검
4. 템플릿 이슈 시 `--template-mode blank`로 분리 테스트
5. 필요 시 `predeck --update-spec`로 구조 재동기화

## Do / Don't

Do:
- 리서치 근거를 먼저 강화한 뒤 페이지를 작성
- 레이아웃 의도와 본문 밀도를 함께 관리
- 반복 실행으로 품질 게이트를 맞춘다

Don't:
- 텍스트 밀도 부족 상태로 렌더 결과만 반복 확인
- 템플릿에만 의존해 내용 품질 문제를 가리기
- 특정 고객에만 통하는 하드코딩을 공통 로직에 넣기
