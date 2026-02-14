# AGENTS

## Purpose
This repository implements a two-stage consulting presentation agent:
1. Thinking: brief normalization, research packaging, narrative planning, slide spec generation.
2. Making: PptxGenJS rendering, QA gates, and artifact export.

## Non-negotiables
- Use schema validation between stages.
- Preserve claim-to-evidence mapping.
- Store all run artifacts under `runs/YYYY-MM-DD/project_id/run_id`.
- Fail the pipeline when QA score is below threshold.
