# QA Rubric

Total score: 100

- Structure consistency: 20
- Data accuracy: 30
- Message clarity: 20
- Visual readability: 20
- Source completeness: 10

## Hard fail conditions

- claim without evidence mapping
- numeric claim without cross-validation (>= 2 evidences)
- single-source numeric claim
- table visual `data_ref` mismatch
- story arc missing (core slide types 누락)
- total score below threshold (default: 80)

## High-priority warnings (권장 즉시 수정)

- text-only slide (cover 제외)
- governing message duplicate
- overflow risk (장문 claim 과밀)
- source footer incomplete

## Layout quality checks

- slide type별 필수 시각요소 군 충족 여부
- `visual.options.layout_hint` 입력 권장 여부
- appendix 위치 점검(마지막 슬라이드 권장)
