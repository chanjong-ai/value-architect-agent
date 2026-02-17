# Runbook

## End-to-End
```bash
pnpm install
pnpm build
pnpm public:check
pnpm agent run --brief ./examples/brief.energy-materials.ko.json --project energy_materials_strategy_ko
```

참고:
- `--research`를 주더라도 파이프라인은 리서치 깊이를 점검하고 부족 축(시장/경쟁/재무/기술/규제/리스크)을 자동 보강한 뒤 스토리라인을 생성합니다.
- `run`/`think`는 기본적으로 브리프 기반 동적 쿼리로 출처를 재탐색하고 실제 웹 리서치를 최소 30회 수행합니다.
- 웹 리서치는 기본 3라운드 반복으로 수행되며, 각 라운드에서 약한 축을 우선 재탐색합니다.
- trust/relevance 기준을 동시에 통과한 건만 성공으로 집계됩니다.
- 웹 리서치 옵션:
  - `--web-research-attempts <number>` (최소 30)
  - `--web-research-timeout-ms <ms>`
  - `--web-research-concurrency <number>`
  - `--no-web-research`
  - (선택) `PPT_WEB_RESEARCH_QUERY_PROVIDER=auto|heuristic|openai|anthropic`
  - (선택) `PPT_WEB_RESEARCH_QUERY_MODEL=<model_name>`

## Layout Planner 선택

기본(권장):
```bash
pnpm agent run \
  --brief ./examples/brief.energy-materials.ko.json \
  --project energy_materials_strategy_ko \
  --layout-provider agentic
```

Anthropic 레이아웃 결정:
```bash
export ANTHROPIC_API_KEY="<your_key>"
export PPT_LAYOUT_MODEL_PROVIDER="anthropic"
export PPT_LAYOUT_MODEL="claude-3-5-sonnet-20241022"

pnpm agent run \
  --brief ./examples/brief.energy-materials.ko.json \
  --project energy_materials_strategy_ko \
  --layout-provider anthropic
```

## Reproducible Mode
```bash
pnpm agent run \
  --brief ./examples/brief.energy-materials.ko.json \
  --project energy_materials_strategy_ko \
  --deterministic --seed energy_materials_v1
```

## 렌더링 전 다회 검증 강도 조절
```bash
# 기본값: 4 (권장 4~5)
export PPT_PRE_RENDER_REVIEW_ROUNDS=4
```

## Stage-by-Stage
```bash
pnpm agent think --brief ./examples/brief.energy-materials.ko.json --project energy_materials_strategy_ko
pnpm agent think --brief ./examples/brief.energy-materials.ko.json --project energy_materials_strategy_ko --research ./examples/research.pack.sample.json
pnpm agent think --brief ./examples/brief.energy-materials.ko.json --project energy_materials_strategy_ko --web-research-attempts 36
pnpm agent make --spec ./runs/<date>/<project>/<run_id>/spec/slidespec.raw.json
pnpm agent make --spec ./runs/<date>/<project>/<run_id>/spec/slidespec.raw.json --layout-provider anthropic
pnpm agent qa --run ./runs/<date>/<project>/<run_id>
pnpm agent feedback --run_id <run_id> --file ./examples/feedback.sample.json
```

## 산출물 확인 순서

1. `qa/qa.summary.md`
2. `research/web.research.report.json`
3. `spec/thinking.review.json`
4. `spec/slidespec.effective.json`
5. `output/layout.decisions.json`
6. `output/report.pptx`
7. 필요 시 `spec/slidespec.raw.json`와 비교

## 실패 처리 메모

- `pnpm agent qa`는 threshold 미달 시 exit 1
- `pnpm agent run`은 fix 가능한 규칙(문장 길이/So What/evidence/source)을 1회 자동 보정 후 재채점
- `pnpm agent run`/`make`는 본문 생성 후 레이아웃을 선택하고, 선택 레이아웃 기준으로 텍스트 적합성 검증 후 렌더링
- LLM 레이아웃 호출 실패 시 agentic-local로 fallback (파이프라인은 계속 진행)
- 웹 리서치 relevance/축 커버리지 기준 미달 시 run/think를 실패로 종료

## Regression Baseline Check (On-demand)

GitHub Actions `nightly-regression` 워크플로는 현재 스케줄 실행 없이 수동(`workflow_dispatch`)으로만 실행됩니다.

```bash
pnpm regression:check
cat ./artifacts/nightly-regression.md
```

## Public Readiness Check

공개 전 점검 자동화:
```bash
pnpm public:check
```

검사 범위:
- 추적 파일 내 특정 고객사/기업 실명
- 삭제된 기업 특화 샘플 파일 참조
- 직접 비교 표현(특정 전략컨설팅사 실명)
