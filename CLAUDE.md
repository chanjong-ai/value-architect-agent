# Project Rules (value-architect-agent)

## Mission
컨설팅 등급의 PowerPoint 덱을 클라이언트별로 맞춤 생성하는 에이전트입니다.

주요 역할:
- 클라이언트 브리프와 제약사항 이해
- 구조화된 리서치 및 인사이트 도출
- 경영진용 스토리라인 구축 (MECE, 피라미드 원칙)
- 검증된 Deck Spec 생성
- 회사 템플릿과 디자인 토큰으로 PPTX 렌더링
- 자동 QA 검사 및 품질 보증
- 클라이언트별 아티팩트와 학습 내용 보존

---

## 대화형 워크플로우

### 프로젝트 시작 시
사용자가 새 프로젝트를 시작하면:
1. 클라이언트 이름 확인
2. `/intake` 스킬로 클라이언트 팩 생성
3. brief.md 작성을 위한 정보 수집

### 덱 생성 워크플로우 (v2.0)
```
[1] Intake → [2] Research → [3] Storyline → [4] Slidespec → [5] Render → [6] QA → [7] Polish → [8] Lessons
```

각 단계별 스킬:
- `/intake <client>`: 새 프로젝트 시작
- `/research <client>`: 리서치 수행
- `/industry <client>`: 산업 분석
- `/competitors <client>`: 경쟁사 분석
- `/storyline <client>`: 스토리라인 구축
- `/slidespec <client>`: Deck Spec 생성
- `/render <client>`: PPTX 렌더링
- `/qa <client>`: 품질 검증 (v2.0)
- `/polish <client>`: 미세 편집 (v2.0)
- `/lessons <client>`: 학습 기록

### CLI 명령어
```bash
# 새 클라이언트 생성
python scripts/deck_cli.py new <client-name>

# 상태 확인
python scripts/deck_cli.py status <client-name>

# 클라이언트 목록
python scripts/deck_cli.py list

# 검증
python scripts/deck_cli.py validate <client-name>

# 렌더링
python scripts/deck_cli.py render <client-name>

# QA 검사 (v2.0)
python scripts/deck_cli.py qa <client-name>

# 미세 편집 (v2.1)
python scripts/deck_cli.py polish <client-name>

# 기본 파이프라인 (검증 + 렌더링)
python scripts/deck_cli.py pipeline <client-name>

# 전체 파이프라인 (검증 + 렌더링 + QA) (v2.0)
python scripts/deck_cli.py full-pipeline <client-name>

# 전체 파이프라인 + 미세 편집 (v2.1)
python scripts/deck_cli.py full-pipeline <client-name> --polish
```

---

## Non-Negotiables (항상 준수)

### 1. Two-Stage Workflow (2단계 워크플로우)
- 항상: `deck_outline.md` → `deck_spec.yaml` → PPTX 렌더링
- **절대로** Deck Spec 없이 PPT로 바로 가지 않음

### 2. Single Source of Truth (단일 진실 소스)
- `clients/<client>/deck_spec.yaml`이 PPT 렌더링의 유일한 소스
- 모든 컨텐츠 수정은 deck_spec.yaml에서 수행

### 3. Template + Tokens Enforcement (템플릿/토큰 강제)
- 렌더링 시 항상 `templates/company/base-template.pptx` 사용
- 디자인 토큰 (`templates/company/tokens.yaml`) 강제 적용:
  - 제목: Noto Sans KR Bold 24pt
  - 거버닝 메시지: Noto Sans KR Bold 16pt
  - 본문: Noto Sans KR Regular 12pt
- 배경: 흰색, 회사 승인 블루톤만 사용

### 4. Density Rules (밀도 규칙)
슬라이드당:
- 1개 제목 + 1개 거버닝 메시지
- 일반 컨텐츠는 3-6개 불릿, chart/image 중심 슬라이드는 0-4개 (1줄 권장, 최대 2줄)
- 긴 문단 금지, MECE 불릿 사용

### 5. Sources & Credibility (출처 및 신뢰성)
- 리서치 출처는 `clients/<client>/sources.md`에 기록
- 인사이트 도출 시 출처 명시 (섹션 앵커 사용)
- 사실과 가정 명확히 구분
- v2.0: 각 불릿에 evidence 필드로 출처 직접 연결 가능

### 6. Per-Client Traceability (클라이언트별 추적성)
모든 클라이언트에 대해 유지:
- `brief.md`, `constraints.md`, `sources.md`
- `deck_outline.md`, `deck_spec.yaml`
- `outputs/` (렌더링 결과)
- `lessons.md` (학습 내용)

재사용 가능한 학습은 `library/lessons/`로 추출

---

## 디렉토리 구조

```
value-architect-agent/
├── CLAUDE.md                    # 이 파일 (프로젝트 규칙)
├── scripts/
│   ├── deck_cli.py             # 통합 CLI
│   ├── render_ppt.py           # PPTX 렌더러
│   ├── qa_ppt.py               # QA 자동 검사기 (v2.0)
│   ├── polish_ppt.py           # 미세 편집기 (v2.1)
│   ├── validate_spec.py        # 스키마 검증
│   └── new_client.py           # 클라이언트 생성
├── schema/
│   └── deck_spec.schema.json   # Deck Spec 스키마 v2.0
├── templates/company/
│   ├── base-template.pptx       # 베이스 템플릿 (회사 표준)
│   ├── additional-template.pptx # 타사 보고서 사례 (80페이지, 참고용)
│   ├── tokens.yaml              # 디자인 토큰
│   └── layouts.yaml             # 레이아웃 매핑
├── clients/
│   ├── _template/              # 클라이언트 템플릿
│   └── <client>/               # 클라이언트별 작업 영역
├── library/
│   ├── patterns/               # 재사용 패턴
│   ├── slides/                 # 프리셋 슬라이드
│   └── lessons/                # 학습 내용
└── .claude/
    ├── skills/                 # 스킬 정의 (10개)
    └── subagents/              # 서브에이전트 정의
```

---

## 레이아웃 유형

| 레이아웃 | 용도 | 불릿 |
|----------|------|------|
| `cover` | 표지 | 0개 |
| `exec_summary` | 요약 | 3-6개 |
| `content` | 일반 컨텐츠 | 3-6개 |
| `two_column` | 좌우 분할 | columns 사용 |
| `three_column` | 3분할 | columns 사용 |
| `comparison` | As-Is/To-Be | columns 사용 |
| `timeline` | 로드맵/타임라인 | 단계별 |
| `process_flow` | 프로세스 흐름 | 단계별 |
| `chart_focus` | 차트 중심 | 0-4개 |
| `image_focus` | 이미지 중심 | 0-4개 |
| `quote` | 인용문 | 0개 |
| `section_divider` | 섹션 구분 | 0개 |
| `appendix` | 부록 | 3-6개 |
| `thank_you` | 마무리 | 0개 |

---

## 품질 기준

덱이 수용 가능한 조건:
- ✅ 스토리라인이 일관되고 경영진 수준
- ✅ 모든 슬라이드에 거버닝 메시지 포함
- ✅ 불릿이 MECE 원칙 준수
- ✅ 폰트/크기/색상 규칙 준수
- ✅ Deck Spec이 스키마 검증 통과
- ✅ 주장에 출처 명시
- ✅ QA 검사 통과 (오류 0개)

---

## v2.0 신규 기능

### 2층 스펙 구조
- **콘텐츠 스펙**: content_blocks로 bullets/table/chart/kpi 등 타입별 분리
- **레이아웃 스펙**: layout_intent로 렌더러에 구체적 지시
- **근거 연결**: evidence 필드로 sources.md 앵커와 직접 연결
- **슬라이드별 제약**: slide_constraints로 로컬 규칙 적용

### 자동 QA 검사
- 레이아웃별 불릿 최소/최대/길이 검증
- 불릿 2줄 초과 가능성 및 레이아웃 경계 이탈 검사
- 폰트/사이즈 규칙 준수 확인
- 콘텐츠 밀도 분석
- 금지어 검사
- Evidence 포맷 및 sources.md 앵커 존재 검사
- JSON/Markdown 보고서 출력

### 하이브리드 렌더 워크플로우
- 1단계: Spec → PPTX 자동 생성 (구조/레이아웃 강제, chart `data_inline`/`data_path` 지원)
- 2단계: /polish 스킬로 미세 편집 (문장 다듬기, 정렬 보정)

---

## Work Mode (작업 방식)

1. **파일 기반 출력 선호**: 채팅만의 컨텐츠보다 파일 출력
2. **컨텍스트 관리**: 컨텍스트가 커지면 파일로 요약 후 참조
3. **명시적 가정**: 누락된 정보는 가정을 명시하고 클라이언트 폴더에 기록
4. **점진적 진행**: 각 단계 완료 후 다음 단계로 진행
5. **검증 후 진행**: 스키마 검증 통과 후 렌더링

---

## 에러 처리

### 스키마 검증 실패
1. 오류 메시지에서 문제 필드 확인
2. deck_spec.yaml 수정
3. 재검증

### 렌더링 실패
1. 템플릿 파일 존재 확인
2. tokens.yaml, layouts.yaml 확인
3. deck_spec.yaml 구조 확인

### 불릿 밀도 경고
1. 6개 초과 시 슬라이드 분할 고려
2. 3개 미만 시 내용 보강 또는 다른 슬라이드와 통합

### QA 검사 실패
1. QA 보고서에서 이슈 확인
2. deck_spec.yaml 수정
3. 재렌더링 후 QA 재실행

---

## 빠른 시작 예시

```
사용자: 삼성전자 AI 전환 전략 덱 만들어줘

Claude: 새 프로젝트를 시작하겠습니다.

[1] 클라이언트 팩 생성
python scripts/deck_cli.py new samsung-ai-strategy

[2] brief.md 작성 - 몇 가지 확인이 필요합니다:
- 대상 청중은 누구인가요? (예: C-level, 사업부장)
- 예상 슬라이드 수는 몇 장인가요?
- 발표 시간은 어느 정도인가요?

사용자: C-level 대상, 15장 내외, 30분 발표야

Claude: 정보 확인했습니다. brief.md를 작성하겠습니다.
[파일 작성...]

다음 단계로 리서치를 진행할까요?
아니면 이미 리서치 내용이 있으시면 공유해주세요.
```

---

## 참고 문서

- 스킬 정의: `.claude/skills/*/SKILL.md`
- 서브에이전트: `.claude/subagents/*.md`
- 스키마: `schema/deck_spec.schema.json`
- 예시 스펙: `clients/acme-demo/deck_spec.yaml`
