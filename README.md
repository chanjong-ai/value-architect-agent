# consulting-ppt-agent

전략 컨설팅 보고서(PPT)를 자동으로 생성하는 **Thinking → Making** 파이프라인입니다.
이 저장소는 "슬라이드 그림"보다 아래 4가지를 우선합니다.

전체 목적/구조/동작원리 단일 참조 문서:
- `docs/architecture.md`

- 논리 구조: cover → 분석 → 리스크 → 실행
- 근거 추적: claim ↔ evidence ↔ source
- 품질 게이트: 점수 기반 pass/fail
- 재현성: deterministic run

---

## 지금 버전의 핵심 특징

### 1) 슬라이드 폰트 전면 통일
- 전체 텍스트를 `Calibri`로 강제합니다.
- 제목/본문/표/각주/페이지 번호 모두 동일 폰트를 사용합니다.

### 2) 본문 내용의 "보고서형" 강화
- 슬라이드별 claim을 단순 요약 문장에서 벗어나
  - `진단`
  - `해석`
  - `실행`
  3단 구조로 생성합니다.
- 수치 근거는 편차가 과도하지 않도록 evidence pair를 선택해 데이터 QA 안정성을 높였습니다.
- 리서치가 부족한 입력(`--research` 포함)도 자동으로 축별 보강(시장/경쟁/재무/기술/규제/리스크)한 뒤 스토리라인을 생성합니다.
- 스토리라인은 고정 템플릿이 아니라 리서치 우선축(coverage/volatility/keyword signal) 기반으로 focus/title이 조정됩니다.

### 3) 동적 레이아웃 결정
- 고정 슬라이드 ID 렌더링에서 벗어나, 슬라이드의 `visual kind`와 `layout_hint`를 바탕으로 레이아웃을 결정합니다.
- 레이아웃이 결정된 뒤, 해당 레이아웃 기준으로 텍스트 수용량과 문장 구조를 재검증해 `effective spec`으로 보정한 후 렌더링합니다.
- 렌더링 전 `스토리라인/본문 중복/아이콘 의미 균형/디자인 다양성`을 다회 검증(기본 4회)합니다.
- 레이아웃 결정기는 두 모드를 지원합니다.
  - `agentic` (기본): API 키 없이 본문/시각요소/맥락 기반 로컬 추론으로 결정
  - `heuristic`: 단순 규칙 기반(레거시 호환)
  - `openai` / `anthropic`: 슬라이드별로 LLM에 레이아웃을 질의
- 실행 시 `output/layout.decisions.json`에 페이지별 결정 결과가 남습니다.

### 4) 디자인 품질 강화
- 카드/배지/아이콘형 마커/강조 박스를 기본 제공
- 데이터 시각(표/차트/매트릭스/타임라인)을 슬라이드 컨텍스트에 맞춰 배치
- `table`은 research pack의 실데이터를 직접 렌더링

### 5) 실제 웹 리서치 기본 내장 (신뢰 기관 30회+)
- `agent run`/`agent think`는 브리프(회사/산업/토픽) 기반으로 매 실행마다 검색 쿼리를 동적으로 구성하고, 그 결과에서 신뢰 가능한 기관/공식 사이트를 선별해 **최소 30회 실제 웹 조회**를 수행합니다.
- 웹 리서치는 기본 **3회 반복 라운드**로 수행되며, 라운드별 약한 축을 재탐색합니다.
- 각 시도는 `신뢰도(trust)`와 `주제 연관성(relevance)`을 함께 평가하며, relevance가 낮으면 성공으로 집계되지 않습니다.
- 조회 결과는 `research/web.research.report.json`, `research/web.research.attempts.json`에 저장됩니다.
- 웹 리서치 결과는 사용자 `--research` 입력과 병합된 뒤 Thinking 단계에서 축별 깊이 보강을 거쳐 최종 `research.pack.json`으로 확정됩니다.

### 6) 스토리라인/본문 반복 검토 강제 (각 3회)
- Thinking 단계에서 스토리라인(내러티브) 검토를 최소 3회 수행합니다.
- 이어서 페이지별 제목/거버닝 메시지/본문(클레임) 검토를 최소 3회 수행합니다.
- 반복 검토 결과는 `spec/thinking.review.json`에 저장됩니다.

---

## 빠른 시작 (Quickstart)

### 1) 의존성 설치
```bash
pnpm install
```

### 2) 빌드
```bash
pnpm build
```

### 3) 기본 실행
```bash
pnpm agent run --brief ./examples/brief.posco.ko.json --project posco_cvj
```
- 위 기본 실행은 자동으로 `30회+` 실제 웹 리서치를 수행합니다.
- 시도 횟수/타임아웃/동시성은 아래 옵션으로 조정 가능합니다.
  - `--web-research-attempts <number>` (최소 30)
  - `--web-research-timeout-ms <ms>`
  - `--web-research-concurrency <number>`
  - `--no-web-research` (비활성화)

### 3-1) 파이프라인 시작 프롬프트 (권장 템플릿)
아래 프롬프트를 그대로 사용하면, 이 프로젝트가 의도한 파이프라인(웹 리서치 → 분석/스토리라인 → 레이아웃 검증 → 렌더링)으로 실행하기 쉽습니다.

```text
아래 주제에 맞게 이 프로젝트에서 만들어진 파이프라인을 따라 보고서를 작성해주세요
고객사명: <고객사명>
주제: <분석 주제>

요구사항:
- 전략 컨설팅 보고서용 브리프
- 한국어(ko-KR), 임원 대상
- 실행 가능한 권고안 중심
- 근거 기반 분석이 가능하도록 경쟁사/핵심 이슈 포함
```

포스코퓨처엠 예시:

```text
아래 주제에 맞게 이 프로젝트에서 만들어진 파이프라인을 따라 보고서를 작성해주세요
고객사명: 포스코퓨처엠
주제: 현재 글로벌 에너지소재 시장 상황에 따른 회사의 비즈니스 전략 방향성

요구사항:
- 전략 컨설팅 보고서용 브리프
- 한국어(ko-KR), 임원 대상
- 실행 가능한 권고안 중심
- 근거 기반 분석이 가능하도록 경쟁사/핵심 이슈 포함
```

### 4) 에코프로비엠 실전형 실행
```bash
pnpm agent run \
  --brief ./examples/brief.ecoprobm.ko.json \
  --project ecoprobm_consulting_2026 \
  --research ./examples/research.ecoprobm.ko.json \
  --threshold 80
```

### 5) 재현 가능한 실행 (Deterministic)
```bash
pnpm agent run \
  --brief ./examples/brief.ecoprobm.ko.json \
  --project ecoprobm_consulting_2026 \
  --research ./examples/research.ecoprobm.ko.json \
  --deterministic --seed ecoprobm_v1
```

---

## Claude Code에서 더 잘 쓰는 방법

Claude Code에서도 동일하게 Node/PNPM 명령으로 동작합니다.

### A. 가장 안전한 기본 모드 (권장)
API 키 없이 agentic-local 레이아웃으로 실행:

```bash
pnpm agent run \
  --brief ./examples/brief.ecoprobm.ko.json \
  --project ecoprobm_consulting_2026 \
  --research ./examples/research.ecoprobm.ko.json \
  --layout-provider agentic
```

### B. Claude(Anthropic)로 페이지별 레이아웃 결정
환경변수 설정 후 실행:

```bash
export ANTHROPIC_API_KEY="<your_key>"
export PPT_LAYOUT_MODEL_PROVIDER="anthropic"
export PPT_LAYOUT_MODEL="claude-3-5-sonnet-20241022"

pnpm agent run \
  --brief ./examples/brief.ecoprobm.ko.json \
  --project ecoprobm_consulting_2026 \
  --research ./examples/research.ecoprobm.ko.json \
  --layout-provider anthropic
```

### C. 실패 대비(Fallback)
- LLM 호출 실패/타임아웃/API 키 누락 시 자동으로 agentic-local로 fallback합니다.
- 파이프라인은 중단되지 않고 결과물을 계속 생성합니다.
- 실제 적용된 레이아웃은 `layout.decisions.json`에서 확인할 수 있습니다.
- 다회 검증 횟수를 조정하려면 `PPT_PRE_RENDER_REVIEW_ROUNDS`(기본 4)를 설정할 수 있습니다.

---

## 자주 쓰는 명령

```bash
# Thinking만 실행
pnpm agent think --brief ./examples/brief.posco.ko.json --project posco_cvj

# Thinking + 웹 리서치 강화(예: 36회)
pnpm agent think \
  --brief ./examples/brief.posco.ko.json \
  --project posco_cvj \
  --web-research-attempts 36

# Making만 실행
pnpm agent make --spec ./runs/<date>/<project>/<run_id>/spec/slidespec.raw.json

# Making + 레이아웃 모델 지정
pnpm agent make \
  --spec ./runs/<date>/<project>/<run_id>/spec/slidespec.raw.json \
  --layout-provider anthropic \
  --layout-model claude-3-5-sonnet-20241022

# QA만 실행
pnpm agent qa --run ./runs/<date>/<project>/<run_id> --threshold 80

# 피드백 저장
pnpm agent feedback --run_id <run_id> --file ./examples/feedback.sample.json
```

---

## 실행 결과 위치

```text
runs/YYYY-MM-DD/<project>/<run_id>/
├─ input/brief.raw.json
├─ input/brief.normalized.json
├─ input/learning.rules.json
├─ research/research.pack.json
├─ research/web.research.report.json
├─ research/web.research.attempts.json
├─ spec/thinking.review.json
├─ spec/storyline.pre-render.debug.json
├─ spec/storyline.pre-render.debug.md
├─ spec/slidespec.raw.json
├─ spec/slidespec.effective.json
├─ spec/slidespec.json
├─ output/report.pptx
├─ output/provenance.json
├─ output/layout.decisions.json
├─ qa/qa.report.json
├─ qa/qa.summary.md
├─ qa/autofix.json
└─ manifest.json
```

실무에서는 아래 순서로 보면 가장 빠릅니다.
1. `qa/qa.summary.md`
2. `spec/storyline.pre-render.debug.md` (렌더링 직전 스토리라인/근거/PPT 변환 청사진 검토)
3. `spec/slidespec.effective.json`
4. `output/layout.decisions.json`
5. `output/report.pptx`
6. 필요 시 `spec/slidespec.raw.json`와 비교해 레이아웃 검증 보정 내용을 확인

---

## 품질 기준 (McKinsey/BCG 스타일 대응)

엔진이 자동으로 강제하는 항목:
- 거버닝 메시지 형식 점검 (`팩트A + 팩트B = So What`)
- 수치 claim의 다중 근거 교차 검증
- source footer 완전성
- 스토리 아크 순서 점검
- 텍스트 과밀/오버플로 리스크 점검

사람 리뷰가 필요한 항목:
- 도메인 특화 인사이트의 현실성
- 조직 실행 가능성(권한/예산/책임)
- 임원 커뮤니케이션 문장 톤의 최종 polish

---

## 프로젝트 구조

```text
apps/
  cli/      # run/think/make/qa/feedback
  worker/   # 배치 확장 엔트리
packages/
  shared/   # 공통 타입/로깅/해시/시간/에러
  thinking/ # Stage A + schema + 스토리/claim 생성
  making/   # PptxGenJS 렌더러 + 동적 레이아웃 플래너
  qa/       # 품질 게이트
  memory/   # run/feedback 저장 및 학습 규칙
templates/
  themes/   # 디자인 토큰
  storylines/
  presets/
examples/
  brief/research 샘플
runs/
  실행 산출물
```

---

## 검증 명령 모음

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm schema:validate
pnpm regression:check
pnpm smoke
```

---

## 트러블슈팅

- `QA score is below threshold`
  - `qa/qa.summary.md`의 `high`/`medium` 이슈부터 수정하세요.

- `LLM 레이아웃이 기대와 다름`
  - `spec/slidespec.raw.json`의 `visual.options.layout_hint`를 명시해 제약을 강화하세요.
  - `output/layout.decisions.json`으로 실제 선택 근거를 점검하세요.

- `폰트가 다르게 보임`
  - 기본 설정은 Calibri 강제입니다.
  - 뷰어 환경에서 Calibri 대체 폰트로 표시될 수 있으니 OS 폰트 설치 상태를 확인하세요.
