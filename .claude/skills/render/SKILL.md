# Skill: render

렌더링 스킬 - deck_spec.yaml을 PPTX로 변환

## 목적
검증된 deck_spec.yaml을 회사 템플릿과 디자인 토큰을 적용하여 PPTX로 렌더링합니다.

## 트리거
- `/render <client-name>` 명령어 사용 시
- 사용자가 "렌더링 해줘", "PPT 만들어줘" 요청 시

## 입력
- `clients/<client>/deck_spec.yaml` (필수)
- `schema/deck_spec.schema.json` (검증용)
- `templates/company/base-template.pptx` (권장)
- `templates/company/tokens.yaml` (필수)
- `templates/company/layouts.yaml` (필수)

## 출력
- `clients/<client>/outputs/<client>_<timestamp>.pptx`

## 절차

### Step 1: 스키마 검증
```bash
python scripts/deck_cli.py validate <client-name>
```

검증 실패 시:
- 오류 메시지 확인
- deck_spec.yaml 수정
- 재검증

### Step 2: PPTX 렌더링
```bash
python scripts/deck_cli.py render <client-name>
```

또는 상세 옵션:
```bash
python scripts/render_ppt.py \
  clients/<client>/deck_spec.yaml \
  templates/company/base-template.pptx \
  clients/<client>/outputs/<client>.pptx \
  templates/company
```

### Step 3: 렌더링 확인
- 파일 생성 확인
- 슬라이드 수 확인
- 오류 메시지 확인

### Step 4: 품질 점검
- 폰트/크기 적용 확인
- 불릿 밀도 확인
- 레이아웃 적용 확인

## 파이프라인 실행 (검증 + 렌더링)

한 번에 실행:
```bash
python scripts/deck_cli.py pipeline <client-name>
```

## 레이아웃별 렌더링

### cover
- 제목 중앙 상단
- 거버닝 메시지/부제목 중앙 하단

### exec_summary / content
- 제목 상단
- 거버닝 메시지 제목 아래
- 불릿 본문 영역

### two_column
- 좌우 분할
- 각 컬럼에 헤딩 + 불릿

### comparison
- 좌측: 연한 배경 박스
- 우측: 진한 배경 박스
- 대비 효과

### timeline
- 가로 화살표
- 단계별 텍스트 박스

### chart_focus
- 좌측 2/3: 차트 플레이스홀더
- 우측 1/3: 불릿

## 트러블슈팅

### "deck_spec not found"
- 파일 경로 확인
- deck_spec.yaml 존재 여부 확인

### "tokens.yaml not found"
- templates/company/tokens.yaml 확인
- 경로 오타 확인

### 스키마 검증 실패
- 오류 메시지에서 필드 확인
- 필수 필드 누락 확인
- 데이터 타입 확인

### 폰트 적용 안 됨
- 시스템에 폰트 설치 여부 확인
- tokens.yaml의 폰트명 확인

## 디자인 토큰 참조

### 폰트
| 요소 | 폰트 | 크기 |
|------|------|------|
| 제목 | Noto Sans KR Bold | 24pt |
| 거버닝 메시지 | Noto Sans KR Bold | 16pt |
| 본문 | Noto Sans KR Regular | 12pt |
| 각주 | Noto Sans KR | 10pt |

### 색상
| 용도 | 색상 코드 |
|------|----------|
| Primary Blue | #0A6ED1 |
| Dark Blue | #084E8A |
| Light Blue | #D6EAFB |
| Text Dark | #1A1A1A |
| Text Muted | #4D4D4D |

## 완료 기준
- PPTX 파일 생성됨
- 모든 슬라이드가 deck_spec.yaml 순서대로 포함됨
- 디자인 토큰이 올바르게 적용됨
- 레이아웃이 의도대로 렌더링됨

## 다음 단계
- QA 점검 → `/qa` 스킬
- 학습 기록 → `/lessons` 스킬

## 예시

```
사용자: acme-demo 렌더링 해줘

Claude: acme-demo 클라이언트의 덱을 렌더링하겠습니다.

[Step 1] 스키마 검증 중...
✓ Deck Spec 검증 통과

[Step 2] PPTX 렌더링 중...
✓ Rendered PPTX: clients/acme-demo/outputs/acme-demo_20260201_143025.pptx

렌더링이 완료되었습니다:
- 슬라이드 수: 10
- 출력 파일: clients/acme-demo/outputs/acme-demo_20260201_143025.pptx

다음 단계:
- 품질 점검: /qa acme-demo
- 학습 기록: /lessons acme-demo
```
