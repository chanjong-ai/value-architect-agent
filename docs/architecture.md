# Architecture

## Pipeline
- Input Brief
- Thinking stage
  - Brief normalizer
  - Feedback-driven rule evolution (project history)
  - Research orchestrator
  - Optional external research pack override (`--research`)
  - Narrative planner
  - SlideSpec builder
  - Self-critique
- Making stage
  - Schema validation
  - PptxGenJS rendering (prompt-aligned 13-slide pattern renderer)
  - Provenance export
- QA stage
  - text/layout/data/source checks
  - table `data_ref` integrity checks
  - score gate (default: 80)
  - one-pass post-QA auto-fix + re-score (run command)
- Artifact store
  - runs/YYYY-MM-DD/project_id/run_id

## Reproducibility
- deterministic mode (`--deterministic --seed`) 지원
- 동일 입력/seed에서 run_id와 stage timestamp를 고정
- manifest에 deterministic 실행 메타데이터 기록

## Runtime Modes
- CLI: synchronous end-to-end execution
- Worker: async job entrypoint for queue-based orchestration
