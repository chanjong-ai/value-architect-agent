# Skill: sync-layout

## 목적
레이아웃 힌트와 렌더러 결과를 동기화합니다.

## 방식
현재 프로젝트는 `slidespec.visuals[].options.layout_hint`를 기준으로 레이아웃을 선택합니다.

## 실행
```bash
pnpm agent run --brief ./examples/brief.<project>.ko.json --project <project_id> --research ./examples/research.<project>.ko.json --layout-provider heuristic
```

## 확인
- `output/layout.decisions.json`에서 페이지별 템플릿/근거 확인
