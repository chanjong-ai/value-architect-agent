# Schema Contracts

The canonical JSON schemas are stored in `packages/thinking/schemas`.

- `brief.schema.json`
  - includes `target_company`, `competitors[]`, `report_date`
- `research-pack.schema.json`
- `slidespec.schema.json`
  - `visuals[].options` can include layout planning hints (e.g. `layout_hint`, `priority`)
- `manifest.schema.json`
- `feedback.schema.json`

Validation is mandatory between stages.

`manifest.schema.json` includes reproducibility metadata:
- `deterministic_mode`
- `deterministic_seed`

Runtime note:
- `spec/slidespec.raw.json`: Thinking stage output (before layout validation)
- `spec/slidespec.effective.json`: Making stage layout-validation output (render/QA/provenance 기준)
- `spec/slidespec.json`: 현재 파이프라인에서 사용하는 최종 유효 스펙(일반적으로 effective spec과 동일)
- `research/web.research.report.json`: 실제 웹 리서치(최소 30회) 수행 요약
- `research/web.research.attempts.json`: URL 단위 fetch 결과(성공/실패/축/기관/상태코드)
- `--research` 외부 입력이 있더라도, Thinking 단계에서 축별 리서치 깊이(source/evidence/table)가 부족하면 자동 보강 후 스토리라인을 생성
