# Skill: enrich-evidence

근거 보강 스킬 - `deck_spec.yaml`의 불릿에 `evidence.source_anchor` 자동 연결

## 목적
주장-근거 추적성을 강화해 컨설팅 등급 품질 게이트(근거 연결률)를 충족하도록 돕습니다.

## 트리거
- `/enrich-evidence <client-name>` 명령어 사용 시
- 사용자가 "출처 연결 보강", "evidence 자동 채워줘" 요청 시

## 입력
- `clients/<client>/deck_spec.yaml` (필수)
- `clients/<client>/sources.md` (필수)

## 출력
- 수정된 `clients/<client>/deck_spec.yaml`

## 실행 명령

```bash
# 기본 보강
python scripts/deck_cli.py enrich-evidence <client-name>

# 기존 evidence까지 재설정
python scripts/deck_cli.py enrich-evidence <client-name> --overwrite

# 변경사항 확인만
python scripts/deck_cli.py enrich-evidence <client-name> --dry-run
```

## 동작 방식
1. `sources.md`에서 앵커 목록 수집
2. 슬라이드별 기본 앵커 추론
3. `bullets` / `columns` / `content_blocks`의 불릿에 evidence 자동 삽입

## 권장 후속 단계
```bash
python scripts/deck_cli.py validate <client-name>
python scripts/deck_cli.py full-pipeline <client-name> --sync-layout --enrich-evidence --polish
```

## 완료 기준
- 업데이트된 불릿 수가 출력됨
- 검증/QA에서 evidence 관련 이슈가 감소함
