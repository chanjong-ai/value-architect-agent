# Skill: intake

## 목적
새 프로젝트의 입력 초안을 현재 Node 파이프라인 형식(`brief.json`)으로 준비합니다.

## 입력
- 사용자 요청(산업, 주제, 타깃 기업, 경쟁사, 페이지 수)

## 출력
- `examples/brief.<project>.ko.json`

## 절차
1. `examples/brief.posco.ko.json`를 복사해 새 brief를 생성합니다.
2. `project_id`, `topic`, `target_company`, `competitors`, `must_include`를 채웁니다.
3. 아래로 검증합니다.

```bash
pnpm agent think --brief ./examples/brief.<project>.ko.json --project <project_id>
```

## 완료 기준
- brief 스키마 검증 통과
- `runs/.../spec/slidespec.json` 생성 확인
