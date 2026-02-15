# Skill: enrich-evidence

## 목적
evidence 품질(교차검증/단위/기간/출처)을 강화합니다.

## 체크리스트
- 수치 claim 당 evidence 2개 이상
- evidence `unit`, `period` 채움
- 서로 다른 source 기반 교차근거

## 검증
```bash
pnpm agent run --brief ./examples/brief.<project>.ko.json --project <project_id> --research ./examples/research.<project>.ko.json --threshold 85
```
