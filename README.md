# consulting-ppt-agent

한국어 전략 컨설팅 보고서(PPT)를 자동으로 만드는 **Thinking → Making** 2단계 에이전트입니다.

이 프로젝트는 "슬라이드 예쁘게 만들기"보다,
- 논리 구조(스토리라인),
- 근거 추적(claim ↔ evidence ↔ source),
- QA 게이트(점수 기반 통과/실패)
를 우선하도록 설계되어 있습니다.

---

## 이 프로젝트가 하는 일

1. **Thinking 단계**
   - 브리프를 정규화합니다.
   - 리서치 팩(또는 외부 리서치 파일)을 준비합니다.
   - 13~20장 스토리라인을 설계하고 `slidespec.json`을 만듭니다.

2. **Making 단계**
   - `slidespec.json`을 검증한 뒤 PptxGenJS로 `report.pptx`를 생성합니다.
   - 슬라이드별 근거 매핑이 포함된 provenance를 저장합니다.

3. **QA 단계**
   - 구조/데이터/메시지/가독성/출처를 점수화합니다.
   - threshold 미달이면 실행을 실패 처리합니다.

---

## 빠른 시작 (Quickstart)

아래 순서대로 실행하면 가장 안전합니다.

### 1) 의존성 설치
```bash
pnpm install
```

### 2) 빌드
```bash
pnpm build
```

### 3) 기본 E2E 실행
```bash
pnpm agent run --brief ./examples/brief.posco.ko.json --project posco_cvj
```

### 4) 에너지 소재(양극재/음극재) 실전형 실행
```bash
pnpm agent run \
  --brief ./examples/brief.energy-materials.ko.json \
  --project energy_materials_cathode_anode \
  --research ./examples/research.energy-materials.ko.json \
  --threshold 80
```

### 5) 재현 가능한 실행(Deterministic)
```bash
pnpm agent run \
  --brief ./examples/brief.posco.ko.json \
  --project posco_cvj \
  --deterministic --seed posco_v1
```

---

## 실행 결과 위치

모든 실행 결과는 아래 구조로 저장됩니다.

```text
runs/YYYY-MM-DD/<project>/<run_id>/
├─ input/brief.raw.json
├─ input/brief.normalized.json
├─ input/learning.rules.json
├─ research/research.pack.json
├─ spec/slidespec.json
├─ output/report.pptx
├─ output/provenance.json
├─ qa/qa.report.json
├─ qa/qa.summary.md
├─ qa/autofix.json
└─ manifest.json
```

`qa/qa.summary.md`를 먼저 보면, 왜 통과/실패했는지 빠르게 파악할 수 있습니다.

---

## 자주 쓰는 명령

```bash
# Thinking만 실행
pnpm agent think --brief ./examples/brief.posco.ko.json --project posco_cvj

# Making만 실행
pnpm agent make --spec ./runs/<date>/<project>/<run_id>/spec/slidespec.json

# QA만 실행
pnpm agent qa --run ./runs/<date>/<project>/<run_id> --threshold 80

# 피드백 저장
pnpm agent feedback --run_id <run_id> --file ./examples/feedback.sample.json
```

---

## 품질 기준 (McKinsey/BCG 스타일 대응)

엔진이 기본적으로 아래를 강제합니다.
- 거버닝 메시지 중복 감지 및 Takeaway 형식 점검
- 수치 claim의 교차 근거(2개 이상 evidence) 점검
- table visual의 `data_ref` 정합성 점검
- source footer 완전성 점검
- 스토리 아크(cover → 분석 → 리스크 → 실행) 점검

사람이 최종 검토해야 하는 영역도 남아 있습니다.
- 산업 특화 인사이트의 현실성
- 조직/의사결정 구조를 반영한 실행 가능성
- 대외 커뮤니케이션 문구(IR/규제) 정합성

---

## 프로젝트 구조

```text
apps/
  cli/      # run/think/make/qa/feedback
  worker/   # 배치 확장 엔트리
packages/
  shared/   # 공통 타입/로깅/해시/시간/에러
  thinking/ # Stage A + JSON schema
  making/   # PptxGenJS 렌더러
  qa/       # QA 게이트
  memory/   # run/feedback 저장 및 학습 규칙
templates/  # theme/storyline/preset
examples/   # 샘플 brief/research/feedback
docs/       # 아키텍처/계약/운영/품질 문서
runs/       # 실행 산출물
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

- 한글 폰트가 깨질 때
  - 시스템에 `Malgun Gothic` 또는 대체 한글 폰트를 설치한 뒤 다시 실행해 주세요.

- QA 점수가 낮을 때
  - `qa/qa.summary.md`의 `Fail Reasons`와 `[high]` 이슈부터 수정하면 가장 빠릅니다.

- 텍스트가 과밀할 때
  - `brief.page_count`를 늘리거나 `must_include` 항목을 줄여 밀도를 낮춰 주세요.

- lockfile 충돌이 있을 때
  - `pnpm install`을 다시 실행해 `pnpm-lock.yaml`을 동기화해 주세요.

---

## 문서

- `docs/architecture.md`
- `docs/schema-contracts.md`
- `docs/qa-rubric.md`
- `docs/consulting-quality-benchmark.md`
- `docs/prompt-alignment.md`
- `docs/project-audit.md`
- `docs/runbook.md`
