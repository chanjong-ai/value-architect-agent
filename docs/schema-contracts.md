# Schema Contracts

The canonical JSON schemas are stored in `packages/thinking/schemas`.

- `brief.schema.json`
  - includes `target_company`, `competitors[]`, `report_date`
- `research-pack.schema.json`
- `slidespec.schema.json`
- `manifest.schema.json`
- `feedback.schema.json`

Validation is mandatory between stages.

`manifest.schema.json` includes reproducibility metadata:
- `deterministic_mode`
- `deterministic_seed`
