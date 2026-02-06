# Skill: sync-layout

레이아웃 동기화 스킬 - `layout_preferences.yaml`을 `deck_spec.yaml`에 반영

## 목적
고객이 원하는 PPT 레이아웃 패턴(슬라이드 순서/키워드/슬라이드별 오버라이드)을 스펙에 강제 적용합니다.

## 트리거
- `/sync-layout <client-name>` 명령어 사용 시
- 사용자가 "원하는 레이아웃으로 맞춰줘", "레이아웃 선호 반영해줘" 요청 시

## 입력
- `clients/<client>/deck_spec.yaml` (필수)
- `clients/<client>/layout_preferences.yaml` (기본)

## 출력
- 수정된 `clients/<client>/deck_spec.yaml`

## 실행 명령

```bash
# 기본 (deck_spec 덮어쓰기)
python scripts/deck_cli.py sync-layout <client-name>

# 변경사항 확인만
python scripts/deck_cli.py sync-layout <client-name> --dry-run
```

## 적용 우선순위
1. `layout_sequence` (전반 레이아웃 순서)
2. `title_keyword_overrides` (제목 키워드 매핑)
3. `slide_overrides` (특정 슬라이드 강제, 최우선)
4. `global.default_layout_intent`
5. `layout_intents` (레이아웃 타입별 공통 의도)

## 완료 기준
- 레이아웃 변경 사항이 출력에 표시됨
- deck_spec가 저장됨
- 이후 `validate` 통과 가능
