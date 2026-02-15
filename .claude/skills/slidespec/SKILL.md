# Skill: slidespec

## 목적
slidespec 품질(visual 구성, evidence 매핑, source footer)을 검토합니다.

## 핵심 파일
- `runs/<date>/<project>/<run_id>/spec/slidespec.json`
- `packages/thinking/src/spec-builder.ts`

## 검토 포인트
- `visuals[].kind`가 슬라이드 목적과 맞는지
- `visuals[].options.layout_hint`가 있는지
- claim별 `evidence_ids` 2개 이상인지
