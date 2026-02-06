# Skill: recommend

고객 요건 기반 전략 추천 스킬

## 목적
`strategy_input.yaml`에 입력된 고객사 요구사항과 집중영역을 기반으로 분석 우선순위, 권장 레이아웃, 실행 순서를 자동 추천합니다.

## 트리거
- `/recommend <client-name>` 명령 사용 시
- 사용자가 "고객 요건 입력 기반 추천", "고객별 어디에 집중해야 할지"를 요청할 때

## 입력
- `clients/<client>/strategy_input.yaml`
- `clients/<client>/brief.md` (fallback 메타정보)

## 출력
- `clients/<client>/strategy_report.md`
- `clients/<client>/strategy_report.json`
- `clients/<client>/layout_preferences.generated.yaml`

## 실행 명령

```bash
# 전략 추천 리포트 생성
python scripts/deck_cli.py recommend <client-name>

# 생성된 레이아웃 선호를 deck_spec에 즉시 반영 (키워드 기반 안전모드)
python scripts/deck_cli.py recommend <client-name> --apply-layout
```

## 완료 기준
- focus 우선순위와 분석 모듈 우선순위가 리포트에 포함됨
- 슬라이드별 권장 레이아웃 맵이 생성됨
- 후속 실행 명령(sync-layout/analyze/full-pipeline)이 제시됨
