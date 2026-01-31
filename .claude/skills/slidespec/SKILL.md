# Skill: slidespec

## Purpose
Generate or update a client-specific `deck_spec.yaml` that:
- strictly follows `schema/deck_spec.schema.json`,
- is consistent with `clients/<client>/deck_outline.md`,
- enforces density/style rules in `CLAUDE.md` and `clients/<client>/constraints.md`,
- references sources via `clients/<client>/sources.md` anchors.

## Inputs (Required)
- clients/<client>/brief.md
- clients/<client>/constraints.md
- clients/<client>/deck_outline.md
- clients/<client>/sources.md (if available)

## Output (Required)
- clients/<client>/deck_spec.yaml

## Rules
1) Produce Korean output by default unless constraints specify otherwise.
2) Each slide MUST have:
   - `layout`, `title`, `governing_message`
3) Bullets:
   - 3–6 per slide recommended (can be 0 for cover/section divider)
   - each bullet should be crisp and executive-friendly
4) Notes:
   - include key assumptions, and the source anchors used
   - never invent specific numbers without marking as assumption

## Procedure
1) Read brief/constraints and infer target slide count and story arc.
2) Read deck_outline; convert each outline section into a slide object.
3) Ensure each slide has a single clear governing message.
4) Add bullets (MECE), limit density, avoid paragraphs.
5) Add notes: include references like "sources.md#market".
6) Validate against schema mentally; ensure YAML is well-formed.

## Completion Criteria
- deck_spec.yaml is complete, schema-compliant, and ready for rendering.
