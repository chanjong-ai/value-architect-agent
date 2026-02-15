# Skill: render

## 목적
생성된 slidespec을 PPT로 렌더링합니다.

## 실행
```bash
pnpm agent make --spec ./runs/<date>/<project>/<run_id>/spec/slidespec.json
```

LLM 레이아웃 사용:
```bash
pnpm agent make --spec ./runs/<date>/<project>/<run_id>/spec/slidespec.json --layout-provider anthropic --layout-model claude-3-5-sonnet-20241022
```

## 결과
- `runs/.../output/report.pptx`
- `runs/.../output/layout.decisions.json`
