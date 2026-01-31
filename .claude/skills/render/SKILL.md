# Skill: render

## Purpose
Validate and render a PPTX deck from a client's `deck_spec.yaml` using:
- templates/company/base-template.pptx
- templates/company/tokens.yaml
- templates/company/layouts.yaml

## Inputs
- clients/<client>/deck_spec.yaml
- schema/deck_spec.schema.json
- templates/company/base-template.pptx (optional but recommended)
- templates/company/tokens.yaml
- templates/company/layouts.yaml

## Outputs
- clients/<client>/outputs/<client>-<date>.pptx
- (optional) clients/<client>/outputs/render-log.txt

## Steps
1) Run validation:
   python scripts/validate_spec.py clients/<client>/deck_spec.yaml schema/deck_spec.schema.json
2) Render PPTX:
   python scripts/render_ppt.py clients/<client>/deck_spec.yaml templates/company/base-template.pptx clients/<client>/outputs/<client>.pptx templates/company
3) If render fails:
   - identify whether failure is due to missing template, missing tokens/layouts, or invalid YAML
   - propose concrete fixes and re-run

## Quality Checks (Post-render)
- Confirm title/governing/body fonts and sizes are enforced
- Confirm bullet density is within constraints
- Confirm slide order matches deck_spec.yaml
