# Lessons Learned: ACME Demo

## What worked well
- 11장 스토리 아크(Context -> Pain Points -> Gap -> Section Divider -> Blueprint -> Roadmap -> Value)가 명확함
- `comparison` 레이아웃으로 As-Is/To-Be 차이를 직관적으로 전달 가능
- `global_constraints`와 슬라이드 제약을 함께 사용해 불릿/금지어/섹션 규칙을 일관되게 유지
- Value Case를 `data_path` 기반 차트로 구성해 숫자 업데이트 재사용성이 높음

## What did not work / risks
- 고객 실제 데이터 미제공 상태에서는 가치 수치가 가정 중심으로 남아 신뢰도 제한
- sources가 요약형이면 `evidence` 트레이서빌리티는 유지되지만 감사 수준 근거로는 부족
- 복잡한 다중 시각화 슬라이드는 현재 렌더러에서 플레이스홀더 비중이 높음

## Template / style adjustments needed
- 비교 슬라이드 우측 박스는 흰색 텍스트 강제 적용(가독성 이슈 수정 완료)
- chart 블록은 `data_inline` 우선 실제 차트 렌더, 없으면 플레이스홀더 유지
- 이미지 경로는 spec 기준 상대경로 해석이 필요(수정 완료)

## Reusable patterns to promote into library/
- 제조업 전환 제안 표준 10장 구조 (Cover/Exec/Context/Current/Gap/Implication/Architecture/Roadmap/Value/Close)
- KPI 중심 Value Case 불릿 템플릿
- 3단계 로드맵 표현 패턴 (기반 정비 -> 핵심 전환 -> AI 내재화)
