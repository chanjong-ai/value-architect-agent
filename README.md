# Value Architect Agent

컨설팅 품질의 경영진용 PPT를 자동 생성하는 에이전트 파이프라인입니다.

이 저장소는 단순 렌더러가 아니라, 아래를 한 번에 처리하는 실무형 워크플로우를 제공합니다.

- 최신 근거 기반 리서치 수집
- 페이지별 레이아웃 블루프린트 설계
- Deck Spec 자동 보강(밀도/근거/레이아웃 의도)
- PPT 렌더링 + QA + 폴리시(미세 정리)

## 1. 핵심 개념

### Two-Stage Workflow

1) Thinking Stage
- `brief.md` / `sources.md` / `research_report.md` / `layout_blueprint.*` / `deck_spec.yaml`

2) Making Stage
- `deck_spec.yaml` → `validate` → `render` → `qa` → `polish`

핵심 원칙은 **`deck_spec.yaml`이 단일 진실 소스(Single Source of Truth)** 라는 점입니다.

## 2. 최신 반영 사항 (v2.4)

이번 버전에서 프로젝트 전반에 다음이 반영되었습니다.

- `predeck` 단계 기본화
  - 심화 리서치 + 페이지 블루프린트 생성 + 선택적 deck_spec 반영
- 최신성/신뢰도 기반 근거 수집 강화
  - 웹 근거 수집, 출처 스코어링, 섹션 분류, 사실 은행(Fact Bank)
- 본문 밀도 강화
  - 불릿/내러티브 자동 보강(`densify`) 및 하단 공백 완화
- 템플릿 전략 개선
  - `--template-mode {auto,additional,base,blank}`
  - `auto`는 `additional-template.pptx` 우선
  - 템플릿이 없을 때 `blank` 16:9 폴백
- 동일 고객사 다주제 운영
  - `new --topic ... --new-folder-if-exists`로 변형 폴더 생성
- 폰트 강제 일관성 강화
  - Noto Sans KR 일반체 기반
  - 렌더/폴리시 단계에서 한글 East Asia 폰트 속성까지 동시 적용
- 스키마/검증 상향
  - 불릿 길이/개수 상향(밀도 높은 보고서 문장 허용)

## 3. 디렉터리 구조

```text
value-architect-agent/
├── README.md
├── CLAUDE.md
├── scripts/
│   ├── deck_cli.py
│   ├── predeck_research.py
│   ├── densify_spec.py
│   ├── enrich_evidence.py
│   ├── layout_sync.py
│   ├── render_ppt.py
│   ├── qa_ppt.py
│   ├── polish_ppt.py
│   ├── validate_spec.py
│   ├── analyze_client.py
│   ├── recommend_strategy.py
│   └── new_client.py
├── schema/
│   ├── deck_spec.schema.json
│   └── deck_spec.example.yaml
├── templates/company/
│   ├── base-template.pptx
│   ├── additional-template.pptx
│   ├── tokens.yaml
│   └── layouts.yaml
├── clients/
│   ├── _template/
│   └── <client>/
└── reports/
```

## 4. 설치

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install python-pptx pyyaml jsonschema
```

## 5. 빠른 시작

### 5.1 새 고객 생성

```bash
python scripts/deck_cli.py new ecopro
```

기존 동일 고객 폴더가 있고 다른 주제로 새로 테스트하려면:

```bash
python scripts/deck_cli.py new ecopro --topic "원가혁신" --new-folder-if-exists
```

### 5.2 권장 전체 파이프라인

```bash
python scripts/deck_cli.py full-pipeline ecopro \
  --topic "배터리소재 성장·수익성 동시 달성" \
  --sync-layout --enrich-evidence --overwrite-evidence --polish \
  --template-mode additional
```

이 명령은 기본적으로 다음을 실행합니다.

1. `predeck` (심화 리서치/블루프린트)
2. `densify` (본문 밀도 보강)
3. `sync-layout` (옵션)
4. `enrich-evidence` (옵션)
5. `validate`
6. `render`
7. `qa`
8. `polish` (옵션)

## 6. CLI 요약

```bash
python scripts/deck_cli.py --help
```

주요 명령:

- `new`: 새 고객 폴더 생성
- `predeck`: 심화 리서치 + 블루프린트 생성
- `recommend`: `strategy_input.yaml` 기반 전략/레이아웃 추천
- `analyze`: 고객사 준비도/갭 진단 리포트
- `sync-layout`: 레이아웃 선호를 deck_spec에 반영
- `densify`: 본문 밀도 + 슬라이드 제약(`slide_constraints`) 자동 보강
- `enrich-evidence`: 불릿 evidence 자동 보강
- `validate`: deck_spec 스키마/비즈니스 규칙 검증
- `render`: PPT 렌더링
- `qa`: PPT QA 검사
- `polish`: 폰트/줄간격/텍스트 정리
- `pipeline`: validate → render
- `full-pipeline`: predeck 포함 end-to-end

## 7. 산출물 파일

고객 폴더(`clients/<client>/`) 주요 산출물:

- `research_report.md` / `research_report.json`
- `layout_blueprint.md` / `layout_blueprint.yaml`
- `layout_preferences.research.yaml`
- `strategy_report.md` / `strategy_report.json`
- `analysis_report.md` / `analysis_report.json`
- `deck_spec.yaml`
- `outputs/*.pptx`
- `outputs/*_qa_report.json`
- `outputs/*_polished.polish.json`

## 8. 품질/디자인 정책

### 폰트

- 기본: `Noto Sans KR` 일반체
- tokens 기준 크기:
  - title: 20pt
  - governing: 15pt
  - body: 11pt
  - footnote: 9pt

### 불릿/밀도

- 전역 기본값(권장):
  - `default_max_bullets: 9`
  - `default_max_chars_per_bullet: 180`
- 슬라이드/레이아웃에 따라 오버라이드 가능
- 컨설팅 톤 문장형 불릿 허용(과도한 축약 지양)

### 템플릿

- `template-mode=auto`: `additional-template.pptx` 우선
- 템플릿 누락 시 `blank` 16:9 폴백

## 9. Deck Spec 작성 팁

- 주장-근거를 함께 작성 (`evidence.source_anchor`)
- `layout_intent`를 명시 (`emphasis`, `content_density`, `visual_position`)
- `content_blocks`를 적극 활용 (`bullets/table/chart/image/text/callout/kpi`)
- 본문 하단 공백이 남는 슬라이드는 narrative text block을 추가

## 10. 문제 해결

### validate 실패

```bash
python scripts/deck_cli.py validate <client>
```

- 스키마 오류 위치를 먼저 수정
- 불릿 길이/개수, 컬럼 구조, evidence 형식을 우선 확인

### QA 경고

```bash
python scripts/deck_cli.py qa <client>
```

- 밀도 경고: `densify` 재실행
- 레이아웃 경고: `sync-layout` + `predeck --update-spec` 적용

### 렌더 실패

- `templates/company/tokens.yaml`, `templates/company/layouts.yaml` 존재 확인
- 템플릿 이슈 시 `--template-mode blank`로 우선 렌더 확인

## 11. 운영 권장 순서

신규 프로젝트:

1. `new`
2. `predeck --update-spec`
3. `recommend --apply-layout`
4. `analyze`
5. `full-pipeline --sync-layout --enrich-evidence --polish`

반복 개선:

1. `predeck` (주제/페이지/근거 강화)
2. `densify`
3. `full-pipeline --skip-predeck` (빠른 회귀)

## 12. 변경 로그 (요약)

### v2.4
- predeck 중심 파이프라인 강화
- 페이지 블루프린트/리서치 리포트 자동화 강화
- 동일 고객 다주제 폴더 생성 지원
- 본문 밀도/폰트 일관성 강화
- 스키마/검증 규칙 상향

### v2.3
- `recommend` 기반 전략/레이아웃 추천

### v2.2
- `analyze`, `sync-layout`, `enrich-evidence` 추가

### v2.1
- `polish` 단계 추가

### v2.0
- Deck Spec v2 구조 및 QA 자동검사 도입
