# value-architect-agent

A reusable consulting-grade PPT generation agent workflow powered by Claude Code, designed to:
- ingest client inputs (brief/constraints),
- conduct structured research (industry/company/competitors/tech trends),
- derive insights and storyline (MECE / executive narrative),
- produce a validated deck specification (Deck Spec),
- render a PowerPoint deck (PPTX) following an enterprise template and design tokens,
- keep client-by-client artifacts and lessons learned for continuous improvement.

## Core Concept: Two-Stage Output
This repository intentionally separates "thinking" from "making".

1) **Thinking Artifacts (text-first)**
- Research notes and sources (`clients/<client>/research/`, `sources.md`)
- Storyline / deck outline (`deck_outline.md`)
- Deck Spec YAML (`deck_spec.yaml`) — the single source of truth for rendering

2) **Making Artifacts (rendered deliverable)**
- PowerPoint output (`clients/<client>/outputs/*.pptx`)

This separation improves repeatability, reduces hallucination risk, and enables robust style enforcement.

## Repository Structure
- `.claude/`
  - `skills/` : repeatable slash commands (intake/research/storyline/spec/render/qa/lessons)
  - `subagents/` : specialized roles (researcher, analyst, storyliner, slide-designer, qa-auditor, librarian)
- `templates/company/`
  - `base-template.pptx` : company-approved PPTX template (optional in repo)
  - `tokens.yaml` : design tokens (fonts, sizes, colors, spacing)
  - `layouts.yaml` : render mapping (layout -> slide_layout index/name + placeholder strategy)
- `schema/`
  - `deck_spec.schema.json` : schema for validating Deck Spec
  - `deck_spec.example.yaml` : reference example
- `clients/`
  - `_template/` : client pack template
  - `<client>/` : per-client work area (brief, constraints, sources, outline, spec, outputs, lessons)
- `scripts/`
  - `new_client.py` : create a client folder from template
  - `validate_spec.py` : validate deck spec against schema
  - `render_ppt.py` : render PPTX from deck spec using company template
- `library/`
  - reusable patterns and lessons learned across clients

## Quick Start (Local)
1) Create a client pack:
   - `python scripts/new_client.py acme-demo`

2) Fill in:
   - `clients/acme-demo/brief.md`
   - `clients/acme-demo/constraints.md`

3) Generate Deck Spec (via Claude Code skill or manually):
   - `clients/acme-demo/deck_spec.yaml`

4) Validate and render:
   - `python scripts/validate_spec.py clients/acme-demo/deck_spec.yaml schema/deck_spec.schema.json`
   - `python scripts/render_ppt.py clients/acme-demo/deck_spec.yaml templates/company/base-template.pptx clients/acme-demo/outputs/acme-demo.pptx`

## Governance
All project-level rules and style requirements live in `CLAUDE.md`.
Local or sensitive notes should be stored in `CLAUDE.local.md` (gitignored).

## Notes on Fonts
If you require a specific font (e.g., "MS고딕네오"), ensure it is installed on the machine that opens the PPTX.
The renderer enforces font names/sizes, but availability depends on client environment.
