# Skill: storyline

## 목적
스토리라인 품질을 점검하고 brief/research를 조정해 메시지 흐름을 개선합니다.

## 점검 기준
- cover → summary → analysis → risk → roadmap 아크
- 슬라이드 제목과 governing message 정합성
- claim의 `So What:` 포함 여부

## 실행
```bash
pnpm agent think --brief ./examples/brief.<project>.ko.json --project <project_id> --research ./examples/research.<project>.ko.json
```

생성된 `runs/.../spec/slidespec.json`을 보고 brief/research를 수정합니다.
