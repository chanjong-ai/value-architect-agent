# Runbook

## End-to-End
```bash
pnpm install
pnpm build
pnpm agent run --brief ./examples/brief.posco.ko.json --project posco_cvj
```

`brief`에 `target_company`, `competitors`, `report_date`를 넣으면
플레이어 심층/비교 슬라이드가 해당 구성을 우선 반영한다.

## Reproducible Mode
```bash
pnpm agent run --brief ./examples/brief.posco.ko.json --project posco_cvj --deterministic --seed posco_v1
```

## Stage-by-Stage
```bash
pnpm agent think --brief ./examples/brief.posco.ko.json --project posco_cvj
pnpm agent think --brief ./examples/brief.posco.ko.json --project posco_cvj --research ./examples/research.pack.sample.json
pnpm agent make --spec ./runs/<date>/<project>/<run_id>/spec/slidespec.json
pnpm agent qa --run ./runs/<date>/<project>/<run_id>
pnpm agent feedback --run_id <run_id> --file ./examples/feedback.sample.json
```

`pnpm agent qa`는 threshold 미달 시 실패 코드(exit 1)로 종료된다.
`pnpm agent run`은 QA 실패 시 fix 가능한 규칙(문장 길이/So What/evidence/source)을 1회 자동 보정 후 재채점한다.
feedback가 누적되면 다음 run에서 `input/learning.rules.json`에 반영 규칙이 기록된다.

## Nightly Regression Baseline Check
```bash
pnpm regression:check
cat ./artifacts/nightly-regression.md
```
