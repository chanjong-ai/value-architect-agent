# Skill: research

## 목적
실행 가능한 `research.pack.json` 형식으로 근거 데이터를 정리합니다.

## 입력
- 외부 리서치 링크/수치
- `examples/research.energy-materials.ko.json` (참조)

## 출력
- `examples/research.<project>.ko.json`

## 절차
1. `sources`(source_id/date/url/reliability_score/axis)를 채웁니다.
2. `evidences`를 source_id와 연결합니다.
3. `normalized_tables`를 최소 1개 이상 작성합니다.
4. 아래로 검증/실행합니다.

```bash
pnpm agent run --brief ./examples/brief.<project>.ko.json --project <project_id> --research ./examples/research.<project>.ko.json
```

## 완료 기준
- 실행 성공
- `qa/qa.summary.md`에서 threshold 통과
