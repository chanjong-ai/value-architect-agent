# Project Rules (value-architect-agent)

## Mission
고객사별 경영진 설득형 컨설팅 PPT를 고품질로 안정 생성한다.

필수 목표:
- 최신/신뢰 기반 리서치
- 논리 구조(문제-영향-시사점) 일관성
- 블록 기반 레이아웃 완성도
- validate/qa 품질 게이트 통과

## Single Source of Truth

- 최종 제작 기준은 항상 `clients/<client>/deck_spec.yaml`.
- 렌더 이슈는 템플릿보다 spec(`layout`, `blocks`, `evidence`)을 먼저 수정한다.

## Canonical Spec Policy

기본 작성 단위:
- `layout`: `cover | exec_summary | two_column | chart_insight | competitor_2x2 | strategy_cards | timeline | kpi_cards`
- `blocks`: `headline`, `key_message`, `bullets`, `action_list`, `chart`, `matrix_2x2`, `timeline_steps`, `kpi_cards`

레거시 필드(`bullets`, `content_blocks`, `columns`)는 호환용이며, 공통 파이프라인에서 canonical `blocks`로 정규화한다.

## Typography & Visual Rules

- 폰트: `Noto Sans KR` 일반체
- 사이즈 기준: `Title 24pt / Governing 16pt / Body 12pt(필요시 14pt)`
- 16:9 헤더 영역 정렬:
  - 제목(`title_box`)
  - 거버닝(`governing_box`)
- 본문은 하단 빈 공간이 과도하지 않도록 `action_box`/`assumptions_box`/내러티브로 채운다.

## Standard Workflow

```text
new
→ predeck (research + layout blueprint + optional update-spec)
→ densify (blocks normalization + required block fill)
→ sync-layout (optional)
→ enrich-evidence (optional)
→ validate
→ render
→ qa
→ (qa fail) auto-fix loop: densify → validate → render → qa
→ polish (optional)
```

권장 단일 명령:

```bash
python scripts/deck_cli.py full-pipeline <client> \
  --topic "<주제>" \
  --sync-layout --enrich-evidence --polish \
  --template-mode layout
```

## Non-Negotiables

1. `deck_spec.yaml` 없이 렌더링 금지.
2. 주장-근거 연결(`evidence.source_anchor`) 필수.
3. 일반 컨텐츠 슬라이드에서 본문 공백 방치 금지.
4. 고객별 임시 하드코딩 금지. 공통 로직(`scripts/`)에 일반화 반영.
5. 변경 후 `validate`/`qa` 실행으로 회귀 확인.

## Quality Gates

### validate
- 스키마 + 비즈니스 규칙 검사
- 레이아웃별 필수 블록 누락 여부 확인

### qa
- 폰트/밀도/경계/텍스트 오버플로우/Spec 정합 검사
- 목표: `error = 0`
- 경고는 반복 보정으로 최소화

### CI quality gate
- 로컬/CI 공통 실행: `python scripts/quality_gate.py --template-mode layout`
- 포함 검사: `py_compile` + 전체 고객 `validate` + `qa-sanity-client` render/qa 스모크
- GitHub Actions: `.github/workflows/quality-gate.yml`

## Content Quality Rules

- 거버닝 메시지는 단문 1문장, 권장 길이 28~45자
- 불릿은 단어열이 아니라 문장형으로 작성
- bullets 블록은 3~5개, action_list는 2~3개 권장
- 불릿 길이 권장 범위는 18~110자
- 한 슬라이드에 핵심 논리 1개를 명확히 닫는다
- 원인→영향→시사점 구조는 슬라이드당 1개 권장
- 숫자/시점/출처 없는 단정 문장 반복 금지

## Key Files

- `scripts/deck_cli.py`: 전체 오케스트레이션
- `scripts/client_bootstrap.py`: 신규 고객 생성/초기화 공통 로직
- `scripts/quality_gate.py`: 저장소 단위 품질 게이트 실행
- `scripts/new_client.py`: 레거시 신규 고객 생성 래퍼
- `scripts/predeck_research.py`: 리서치 + 블루프린트
- `scripts/densify_spec.py`: blocks 중심 정규화/밀도 보강
- `scripts/render_ppt.py`: 슬롯 기반 렌더러
- `scripts/qa_ppt.py`: 디자인+밀도 QA
- `scripts/validate_spec.py`: 스키마/비즈니스 규칙 검증
- `scripts/block_utils.py`: blocks/legacy 호환 유틸
- `templates/company/layouts.yaml`: 좌표 슬롯 레이아웃
- `templates/company/tokens.yaml`: 폰트/컬러 토큰

## Do / Don't

Do:
- predeck로 리서치 근거를 먼저 강화
- blocks 기반으로 레이아웃 의도를 명시
- 결과 경고를 다음 고객에도 재발하지 않게 공통 코드에 반영

Don't:
- 템플릿 수정만으로 내용 품질 문제를 우회
- 고객별 예외 분기를 공통 코드에 누적
- validate/qa 미통과 상태에서 완료 처리
