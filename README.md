# Value Architect Agent

고객사별 경영진용 컨설팅 PPT를 생성/검증하는 자동화 파이프라인입니다.

핵심 방향:
- 최신·신뢰 근거 기반 리서치 강화
- 슬라이드 블록 구조(`blocks`) 기반 설계
- 16:9 기준 헤더/본문 일관 디자인
- `validate → render → qa` 품질 게이트 자동화

## 핵심 아키텍처

### 1) Deck Spec: 텍스트 배열이 아닌 블록 구조
`deck_spec.yaml`은 아래 구조를 권장합니다.

- `layout`: `cover | exec_summary | two_column | chart_insight | competitor_2x2 | strategy_cards | timeline | kpi_cards`
- `blocks[]`:
  - `headline`, `key_message`
  - `bullets`, `action_list`
  - `chart`, `matrix_2x2`, `timeline_steps`, `kpi_cards`

렌더러는 `headline`/`key_message` 블록이 있으면 `title`/`governing_message`보다 우선 적용합니다.

레거시 필드(`bullets`, `content_blocks`, `columns`)는 호환되지만, 파이프라인이 자동으로 `blocks` 중심으로 정규화합니다.

### 2) Layout 슬롯 기반 렌더링
`templates/company/layouts.yaml`에서 슬롯 좌표를 정의합니다.

- `title_box`, `governing_box`
- `left_column`, `right_column`
- `chart_box`, `insight_box`
- `matrix_box`, `timeline_box`
- `kpi_card_1..4`, `action_box`, `assumptions_box`

렌더러는 슬롯 좌표를 읽어 도형/텍스트를 배치하므로, 별도 PPT 템플릿 파일 없이도 일관된 결과를 생성합니다.

### 3) 폰트/타이포 정책
기본 폰트는 `Noto Sans KR` 일반체를 사용합니다.

- Title: `24pt`
- Governing Message: `16pt`
- Body: `12pt` (레이아웃에 따라 `14pt` 허용)
- Footnote: `9pt`

## 실무 고정 레이아웃 세트 (8)

자동 생성/보강에서 우선 사용하는 레이아웃:

1. `cover`
2. `exec_summary`
3. `two_column`
4. `chart_insight`
5. `competitor_2x2`
6. `strategy_cards`
7. `timeline`
8. `kpi_cards`

레거시 레이아웃(`content`, `comparison`, `three_column`, `process_flow`, `chart_focus`, `image_focus`)은 자동 보강 단계에서 위 8개로 정규화될 수 있습니다.

## 디렉터리 구조

```text
value-architect-agent/
├── scripts/
│   ├── deck_cli.py
│   ├── client_bootstrap.py
│   ├── quality_gate.py
│   ├── new_client.py
│   ├── predeck_research.py
│   ├── densify_spec.py
│   ├── enrich_evidence.py
│   ├── validate_spec.py
│   ├── render_ppt.py
│   ├── qa_ppt.py
│   ├── polish_ppt.py
│   ├── constants.py
│   └── block_utils.py
├── schema/
│   ├── deck_spec.schema.json
│   └── deck_spec.example.yaml
├── templates/company/
│   ├── tokens.yaml
│   └── layouts.yaml
├── .github/workflows/
│   └── quality-gate.yml
└── clients/
    ├── _template/
    └── <client>/
```

## 설치

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install python-pptx pyyaml jsonschema pypdf
```

## 빠른 시작

### 1) 신규 고객 생성

```bash
python scripts/deck_cli.py new ecopro
```

동일 고객의 다른 주제로 새 폴더 생성:

```bash
python scripts/deck_cli.py new ecopro --topic "원가혁신" --new-folder-if-exists
```

### 2) 전체 파이프라인 실행

```bash
python scripts/deck_cli.py full-pipeline ecopro \
  --topic "배터리소재 성장·수익성 동시 달성" \
  --sync-layout --enrich-evidence --overwrite-evidence --polish \
  --template-mode layout
```

`full-pipeline` 기본 흐름:

1. `predeck` (심화 리서치 + 블루프린트)
2. `densify` (blocks 정규화 + 필수 블록 보강)
3. `sync-layout` (옵션)
4. `enrich-evidence` (옵션)
5. `validate`
6. `render`
7. `qa`
8. `qa 실패 시 자동 보정 루프` (`densify → validate → render → qa`, 기본 2회)
9. `polish` (옵션)

## 주요 명령

```bash
python scripts/deck_cli.py --help
```

- `new`: 신규 고객 템플릿 생성
- `predeck`: 리서치/블루프린트 생성 (+ `--update-spec`)
- `densify`: 레이아웃 정규화 + blocks 보강 + 밀도 개선
- `enrich-evidence`: 불릿/블록 evidence 자동 보강
- `validate`: 스키마 + 비즈니스 규칙 검증
- `render`: PPTX 생성
- `qa`: 폰트/밀도/경계/블록 필수요건 검사
- `full-pipeline`: end-to-end 실행

## CI / Quality Gate

로컬/CI 공통 품질 게이트:

```bash
python scripts/quality_gate.py --template-mode layout
```

검사 항목:
- `scripts/*.py` 문법 컴파일(`py_compile`)
- `clients/_template` 제외 전체 고객 `validate`
- `qa-sanity-client` 기준 `render(layout-driven)` + `qa` 스모크 테스트

GitHub Actions는 `.github/workflows/quality-gate.yml`에서 동일 게이트를 실행합니다.

## 품질 정책

### 컨텐츠 정책

- 거버닝 메시지: 단문 1문장, 권장 길이 `28~45자`
- 본문: 문제-영향-시사점이 닫히는 문장형 서술 유지
- bullets 블록: `3~5`개, action_list 블록: `2~3`개 권장
- 불릿 길이: 권장 `18~110자` (문장형 컨설팅 톤 허용)
- 원인→영향→시사점 구조 불릿은 슬라이드당 1개 권장

### QA 정책

- 허용 폰트: `Noto Sans KR` 계열
- 레이아웃별 필수 블록 누락 검사
- 블록 단위 밀도 규칙(아이템 수/문장 길이) 검사
- 텍스트 오버플로우 추정 검사
- 근거 앵커(`sources.md#...`) 포맷/존재 검사

## Troubleshooting

### validate 실패

```bash
python scripts/deck_cli.py validate <client>
```

확인 포인트:
- `layout` enum/오타
- `blocks` 타입 및 필수 필드
- `evidence.source_anchor` 형식

### QA 경고가 많을 때

```bash
python scripts/deck_cli.py densify <client>
python scripts/deck_cli.py validate <client>
python scripts/deck_cli.py render <client>
python scripts/deck_cli.py qa <client>
```

### 렌더 모드 분리

```bash
python scripts/deck_cli.py render <client> --template-mode layout
```

외부 템플릿을 임시로 적용하려면:

```bash
python scripts/deck_cli.py render <client> --template /absolute/path/to/custom-template.pptx
```

## 산출물

`clients/<client>/outputs/` 하위:
- `*.pptx`
- `*_qa_report.json`
- `*_polished.pptx` / `*.polish.json`

`clients/<client>/` 하위:
- `research_report.md|json`
- `layout_blueprint.md|yaml`
- `layout_preferences.research.yaml`
- `deck_spec.yaml`
