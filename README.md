# Value Architect Agent

**Claude Code 기반 컨설팅 등급 PowerPoint 덱 자동 생성 에이전트**

---

## 목차

1. [개요](#개요)
2. [주요 기능](#주요-기능)
3. [시스템 요구사항](#시스템-요구사항)
4. [설치 방법](#설치-방법)
5. [빠른 시작](#빠른-시작)
6. [Claude Code로 사용하기](#claude-code로-사용하기)
7. [프로젝트 구조](#프로젝트-구조)
8. [워크플로우](#워크플로우)
9. [CLI 사용법](#cli-사용법)
10. [고객사 분석 리포트](#고객사-분석-리포트)
11. [요건 입력 기반 맞춤 추천](#요건-입력-기반-맞춤-추천)
12. [대화형 스킬](#대화형-스킬)
13. [Deck Spec v2.0 작성 가이드](#deck-spec-v20-작성-가이드)
14. [레이아웃 유형](#레이아웃-유형)
15. [디자인 토큰](#디자인-토큰)
16. [품질 관리 (QA)](#품질-관리-qa)
17. [문제 해결](#문제-해결)

---

## 개요

Value Architect Agent는 Claude Code와 대화하며 컨설팅 수준의 PowerPoint 프레젠테이션을 자동으로 생성하는 에이전트 프레임워크입니다.

### 핵심 철학: 2단계 워크플로우

이 프로젝트는 **"생각(Thinking)"과 "만들기(Making)"를 의도적으로 분리**합니다.

```
[Stage 1: Thinking - 텍스트 아티팩트]
brief.md → research → sources.md → deck_outline.md → deck_spec.yaml → analysis_report.md

[Stage 2: Making - 렌더링 결과물]
deck_spec.yaml → validate → render → qa → polish → output.pptx
```

이러한 분리를 통해:
- **재현성 향상**: 동일한 Deck Spec으로 언제든 동일한 결과물 생성
- **환각 위험 감소**: YAML 스펙이 계약서 역할을 수행
- **스타일 일관성**: 디자인 토큰 기반 강제 적용
- **품질 보증**: 자동 QA 검사 및 수정 루프

### v2.0 신규 기능

- **2층 스펙 구조**: 콘텐츠 스펙 + 레이아웃 스펙 분리
- **근거 연결 (Evidence)**: 각 불릿에 sources.md 앵커 직접 연결
- **자동 QA**: 렌더 후 불릿 개수, 폰트, 밀도 자동 검사
- **하이브리드 렌더**: Spec→PPTX 후 Polish 스킬로 미세 편집

---

## 주요 기능

### 클라이언트별 독립 작업 영역
- 각 클라이언트마다 별도의 작업 폴더 (`clients/<client>/`)
- 브리프, 리서치, 스토리라인, 스펙, 결과물 모두 분리 관리
- 학습 내용 축적 및 재사용 가능

### 2층 스펙 구조 (v2.0)
- **콘텐츠 스펙**: bullets, table, chart, image, quote, callout, kpi 등 타입별 분리
- **레이아웃 스펙**: layout_intent로 렌더러에게 구체적 지시
- **근거 연결**: evidence 필드로 sources.md와 직접 연결
- **슬라이드별 제약**: slide_constraints로 로컬 규칙 적용

### 스키마 기반 검증
- JSON Schema (Draft 2020-12) 기반 검증
- 필수 필드 누락, 데이터 타입 오류 사전 차단
- 비즈니스 규칙 검증 (불릿 개수, 문자 길이 등)

### 자동 QA 시스템 (v2.0)
- 렌더 후 자동 품질 검사
- 불릿 개수/길이, 폰트/사이즈, 콘텐츠 밀도 검증
- Evidence 앵커 포맷 및 sources.md 존재 여부 검증
- JSON/Markdown 보고서 출력
- 자동 수정 가능 이슈 표시

### 하이브리드 렌더 워크플로우 (v2.0)
- **1단계**: Spec → PPTX 자동 생성 (구조/레이아웃 강제)
- `chart.data_inline` 또는 `chart.data_path` 제공 시 실제 차트 렌더링 지원 (미제공 시 플레이스홀더 폴백)
- **2단계**: Polish 스킬로 미세 편집 (문장 다듬기, 정렬 보정)

### 다양한 레이아웃 지원
- 14개의 사전 정의된 레이아웃
- 컬럼 기반 레이아웃 (2단, 3단, 비교)
- 타임라인, 차트 중심 등 특수 레이아웃

### 고객사 분석 리포트 (v2.2)
- 고객사별 준비도 점수(Brief/Sources/Storyline/Spec/Execution) 자동 산출
- 산업별 분석 모듈 추천(예: 제조/리테일/금융/헬스케어)
- 분석 단계 → PPT 레이아웃 매핑 자동 생성
- 갭/리스크 및 즉시 실행 액션 아이템 파일 출력

### 요건 입력 기반 맞춤 추천 (v2.3)
- `strategy_input.yaml`에 고객 요건/집중영역/성공지표를 입력하면 맞춤 전략 리포트 생성
- 집중영역 점수화 후 분석 모듈 우선순위 및 슬라이드 아키텍처 자동 추천
- `layout_preferences.generated.yaml` 자동 생성으로 고객이 원하는 레이아웃을 즉시 반영 가능

---

## 시스템 요구사항

### 필수 환경
- **Python**: 3.9 이상
- **Claude Code**: 최신 버전 설치
- **운영체제**: macOS, Linux, Windows

### 필수 패키지
- `python-pptx`: PowerPoint 파일 생성
- `PyYAML`: YAML 파일 처리
- `jsonschema`: 스키마 검증

### 권장 폰트
- **Noto Sans KR**: 모든 슬라이드 텍스트에 사용
  - [Google Fonts에서 다운로드](https://fonts.google.com/specimen/Noto+Sans+KR)
  - 시스템에 설치 후 사용

---

## 설치 방법

### 1단계: 저장소 클론
```bash
git clone https://github.com/your-username/value-architect-agent.git
cd value-architect-agent
```

### 2단계: 가상환경 생성 및 활성화
```bash
# 가상환경 생성
python3 -m venv .venv

# 활성화 (macOS/Linux)
source .venv/bin/activate

# 활성화 (Windows)
.venv\Scripts\activate
```

### 3단계: 의존성 설치
```bash
pip install python-pptx pyyaml jsonschema
```

### 4단계: 설치 확인
```bash
python scripts/deck_cli.py list
```

정상적으로 설치되면 클라이언트 목록이 표시됩니다.

---

## 빠른 시작

### 예제 1: 새 클라이언트 프로젝트 시작

```bash
# 1. 새 클라이언트 생성
python scripts/deck_cli.py new samsung-ai-strategy

# 2. 상태 확인
python scripts/deck_cli.py status samsung-ai-strategy
```

### 예제 2: 기존 예제로 테스트

```bash
# acme-demo 예제의 전체 파이프라인 실행 (검증 + 렌더링 + QA)
python scripts/deck_cli.py full-pipeline acme-demo
```

---

## Claude Code로 사용하기

이 에이전트는 Claude Code와 대화하며 사용하도록 설계되었습니다.

### 1. Claude Code에서 프로젝트 열기

```bash
# 터미널에서 프로젝트 디렉토리로 이동
cd value-architect-agent

# Claude Code 실행
claude
```

### 2. 대화 예시: 처음부터 덱 만들기

```
사용자: 삼성전자 AI 전환 전략 덱 만들어줘

Claude: 새 프로젝트를 시작하겠습니다. 먼저 몇 가지 정보를 확인하겠습니다.

1. 클라이언트명: samsung-ai-strategy로 생성할까요?
2. 대상 청중은 누구인가요? (예: C-level, 사업부장)
3. 예상 슬라이드 수는 몇 장인가요?
4. 발표 시간은 어느 정도인가요?

사용자: 그래, C-level 대상이고 15장 내외, 30분 발표야

Claude: 정보 확인했습니다.

[1] 클라이언트 팩 생성...
(python scripts/deck_cli.py new samsung-ai-strategy 실행)

[2] brief.md 작성 중...
(clients/samsung-ai-strategy/brief.md 생성)

클라이언트 팩이 생성되었습니다.

다음 단계:
- 리서치가 필요하면 "/research samsung-ai-strategy" 사용
- 스토리라인 구축은 "/storyline samsung-ai-strategy" 사용
- 이미 내용이 있으면 공유해주세요

사용자: AI 기반 품질검사, 예측 정비, 수요 예측 3가지를 중심으로 해줘

Claude: 3가지 핵심 주제를 바탕으로 스토리라인을 구축하겠습니다.

[deck_outline.md 작성 중...]

스토리라인 완성:
1. Cover - 삼성전자 AI 전환 전략
2. Executive Summary - 3대 AI 이니셔티브
3. 산업 배경 - AI 기반 제조 혁신 트렌드
4. 현황 분석 - 삼성전자 디지털 성숙도
5. AI 품질검사 - 비전 AI로 불량률 50% 감소
6. 예측 정비 - 설비 가동률 15% 향상
7. 수요 예측 - 재고 비용 20% 절감
...

스펙을 생성할까요?

사용자: 응

Claude: deck_spec.yaml을 생성하겠습니다...
(clients/samsung-ai-strategy/deck_spec.yaml 작성)

스키마 검증 중...
✓ 검증 통과

렌더링하시겠습니까?

사용자: full-pipeline으로 돌려줘

Claude: 전체 파이프라인을 실행하겠습니다.

=== Full Pipeline 시작 ===

[1/3] 스키마 검증 중...
✓ 검증 통과

[2/3] PPTX 렌더링 중...
✓ 완료: clients/samsung-ai-strategy/outputs/samsung-ai-strategy_20260201.pptx

[3/3] QA 검사 중...
✅ 통과 (경고: 2, 참고: 1)

=== Full Pipeline 완료 ===

PPTX 파일이 생성되었습니다:
clients/samsung-ai-strategy/outputs/samsung-ai-strategy_20260201.pptx
```

### 3. 스킬 사용하기

Claude Code에서 슬래시 명령어로 스킬을 호출할 수 있습니다:

```
/intake samsung-ai    # 새 프로젝트 시작
/research samsung-ai  # 리서치 수행
/storyline samsung-ai # 스토리라인 구축
/slidespec samsung-ai # Deck Spec 생성
/recommend samsung-ai # 요건 기반 전략 추천
/sync-layout samsung-ai # 레이아웃 선호 반영
/enrich-evidence samsung-ai # evidence 자동 보강
/render samsung-ai    # PPTX 렌더링
/qa samsung-ai        # QA 검사
/polish samsung-ai    # 미세 편집
```

### 4. 자연어로 요청하기

스킬을 명시적으로 호출하지 않아도 자연어로 요청할 수 있습니다:

```
사용자: acme-demo 덱 렌더링 해줘
Claude: (자동으로 /render acme-demo 실행)

사용자: QA 검사 결과 보여줘
Claude: (자동으로 /qa acme-demo 실행)

사용자: 슬라이드 3의 불릿을 좀 더 간결하게 수정해줘
Claude: deck_spec.yaml을 수정하고 재렌더링...
```

### 5. 단계별 워크플로우

#### 완전 자동 모드
```
사용자: 현대자동차 EV 전략 덱을 처음부터 끝까지 만들어줘

Claude:
1. 클라이언트 팩 생성
2. 리서치 및 sources.md 작성
3. 스토리라인 구축
4. deck_spec.yaml 생성
5. 렌더링 + QA
6. 결과물 전달
```

#### 단계별 수동 모드
```
사용자: /intake hyundai-ev
(정보 수집 후)

사용자: /research hyundai-ev
(리서치 완료 후)

사용자: /storyline hyundai-ev
(스토리라인 검토 후)

사용자: /slidespec hyundai-ev
(스펙 검증 후)

사용자: /render hyundai-ev
(렌더링 결과 확인)

사용자: /qa hyundai-ev
(품질 검증)
```

### 6. 기존 자료 활용하기

```
사용자: 여기 리서치 자료 있어 (파일 첨부 또는 텍스트)

Claude:
제공해주신 자료를 sources.md에 정리하겠습니다.
(sources.md 작성)

이 내용을 바탕으로 스토리라인을 구축할까요?

사용자: 응, 그리고 이 PPT 구조를 참고해줘 (기존 PPT 구조 설명)

Claude:
기존 구조를 참고하여 deck_outline.md를 작성하겠습니다...
```

### 7. 수정 및 반복

```
사용자: 슬라이드 5번에 경쟁사 비교 내용 추가해줘

Claude:
deck_spec.yaml의 5번 슬라이드를 수정하겠습니다.
(comparison 레이아웃으로 변경, 경쟁사 비교 내용 추가)

재렌더링하시겠습니까?

사용자: full-pipeline으로 다시 돌려

Claude:
=== Full Pipeline 시작 ===
...
=== Full Pipeline 완료 ===
```

### 8. 품질 개선 사이클

```
사용자: QA 리포트 보여줘

Claude:
# PPT QA 보고서

**결과**: ✅ 통과

## 상세 이슈
### 슬라이드 5
- 🟡 **[불릿 개수]** 불릿이 6개를 초과합니다 (8개)

권고: 슬라이드 5의 불릿을 6개로 줄이거나 분할을 권장합니다.

사용자: 슬라이드 5 분할해줘

Claude:
슬라이드 5를 두 개로 분할하겠습니다:
- 5a: 운영 측면 개선점
- 5b: 기술 측면 개선점

(deck_spec.yaml 수정 후 재렌더링)
```

---

## 프로젝트 구조

```
value-architect-agent/
│
├── CLAUDE.md                    # 에이전트 규칙 및 가이드
├── README.md                    # 이 문서
│
├── scripts/                     # CLI 스크립트
│   ├── deck_cli.py             # 통합 CLI (메인 진입점)
│   ├── analyze_client.py       # 고객사 분석 전략/준비도 리포터 (v2.2)
│   ├── recommend_strategy.py   # 요건 입력 기반 전략/레이아웃 추천기 (v2.3)
│   ├── layout_sync.py          # layout_preferences -> deck_spec 동기화 (v2.2)
│   ├── enrich_evidence.py      # 불릿 evidence/source_anchor 자동 보강 (v2.2)
│   ├── render_ppt.py           # PPTX 렌더러
│   ├── qa_ppt.py               # QA 자동 검사기 (v2.0)
│   ├── polish_ppt.py           # PPTX 미세 편집기 (v2.1)
│   ├── validate_spec.py        # 스키마 검증기
│   └── new_client.py           # 클라이언트 생성기
│
├── schema/                      # 검증 스키마
│   └── deck_spec.schema.json   # Deck Spec JSON Schema v2.0
│
├── templates/                   # 템플릿 및 토큰
│   └── company/
│       ├── base-template.pptx       # 베이스 PPT 템플릿 (회사 표준)
│       ├── additional-template.pptx # 타사 보고서 사례 템플릿 (80페이지, 참고용)
│       ├── tokens.yaml              # 디자인 토큰 (폰트, 색상)
│       └── layouts.yaml             # 레이아웃 매핑
│
├── clients/                     # 클라이언트별 작업 영역
│   ├── _template/              # 새 클라이언트용 템플릿
│   │   └── strategy_input.yaml # 요건/집중영역 입력 템플릿 (v2.3)
│   └── acme-demo/              # 예제 클라이언트
│
├── library/                     # 재사용 가능한 자산
│   ├── patterns/               # 슬라이드 패턴
│   ├── slides/                 # 프리셋 슬라이드
│   └── lessons/                # 산업별 학습 내용
│
└── .claude/                     # Claude Code 설정
    ├── skills/                 # 대화형 스킬 정의
    │   ├── intake/
    │   ├── research/
    │   ├── industry/
    │   ├── competitors/
    │   ├── storyline/
    │   ├── slidespec/
    │   ├── analyze/            # 고객사 분석 전략/갭 리포트 (v2.2)
    │   ├── recommend/          # 요건 기반 전략 추천 (v2.3)
    │   ├── sync-layout/        # 레이아웃 선호 반영 (v2.2)
    │   ├── enrich-evidence/    # evidence 자동 보강 (v2.2)
    │   ├── render/
    │   ├── qa/
    │   ├── polish/             # 하이브리드 렌더용 (v2.0)
    │   └── lessons/
    │
    └── subagents/              # 서브에이전트 정의
```

---

## 워크플로우

### 전체 프로세스 (v2.3 하이브리드 렌더)

```
[1] Intake     → 클라이언트 정보 수집, 프로젝트 설정
[2] Research   → 산업, 경쟁사, 기술 트렌드 리서치
[3] Storyline  → 피라미드 원칙 기반 스토리라인 구축
[4] Slidespec  → deck_outline.md를 deck_spec.yaml로 변환
[5] Recommend  → 요건 입력 기반 전략/레이아웃 추천 및 생성
[6] Analyze    → 고객사별 준비도/갭/실행계획 리포트 생성
[7] Sync/Evidence → 생성된 레이아웃 반영 + 근거 자동 보강
[8] Render     → PPTX 파일 생성 (1차 렌더)
[9] QA         → 자동 품질 검증 및 보고서 생성
[10] Polish    → 미세 편집 (문장 다듬기, 정렬 보정)
[11] Lessons   → 학습 내용 기록 및 라이브러리 업데이트
```

### 파이프라인 명령어

```bash
# 기본 파이프라인 (validate → render)
python scripts/deck_cli.py pipeline <client>

# 전체 파이프라인 (validate → render → qa)
python scripts/deck_cli.py full-pipeline <client>

# 전체 파이프라인 + polish (validate → render → qa → polish)
python scripts/deck_cli.py full-pipeline <client> --polish

# 레이아웃 선호 + evidence 보강 + 품질 파이프라인 (권장)
python scripts/deck_cli.py full-pipeline <client> --sync-layout --enrich-evidence --polish

# QA 경고 무시하고 진행
python scripts/deck_cli.py full-pipeline <client> --ignore-qa-errors
```

---

## CLI 사용법

### 기본 명령어

```bash
# 도움말 표시
python scripts/deck_cli.py --help

# 새 클라이언트 생성
python scripts/deck_cli.py new <client-name>

# 클라이언트 목록 조회
python scripts/deck_cli.py list

# 클라이언트 상태 확인
python scripts/deck_cli.py status <client-name>

# Deck Spec 검증
python scripts/deck_cli.py validate <client-name>

# PPTX 렌더링
python scripts/deck_cli.py render <client-name>

# QA 검사 (v2.0)
python scripts/deck_cli.py qa <client-name>

# 미세 편집 (v2.1)
python scripts/deck_cli.py polish <client-name>

# 고객사 분석 리포트 (v2.2)
python scripts/deck_cli.py analyze <client-name>

# 전체 고객사 분석 요약 (v2.2)
python scripts/deck_cli.py analyze --all

# 요건 입력 기반 전략 추천 (v2.3)
python scripts/deck_cli.py recommend <client-name>

# 레이아웃 선호 반영 (v2.2)
python scripts/deck_cli.py sync-layout <client-name>

# evidence 자동 보강 (v2.2)
python scripts/deck_cli.py enrich-evidence <client-name>

# 기본 파이프라인 (validate → render)
python scripts/deck_cli.py pipeline <client-name>

# 전체 파이프라인 (validate → render → qa) (v2.0)
python scripts/deck_cli.py full-pipeline <client-name>

# 전체 파이프라인 + 미세 편집 (v2.1)
python scripts/deck_cli.py full-pipeline <client-name> --polish

# 실무 권장 파이프라인 (v2.2)
python scripts/deck_cli.py full-pipeline <client-name> --sync-layout --enrich-evidence --polish
```

### 사용 예시

```bash
# 1. 새 클라이언트 생성
$ python scripts/deck_cli.py new hyundai-ev-strategy
✓ 클라이언트 팩 생성 완료: clients/hyundai-ev-strategy

다음 단계:
  1. brief.md 작성
  2. constraints.md 확인
  3. strategy_input.yaml 작성
  4. 리서치 후 sources.md 업데이트
  5. deck_outline.md → deck_spec.yaml 작성
  6. python scripts/deck_cli.py recommend hyundai-ev-strategy --apply-layout
  7. python scripts/deck_cli.py analyze hyundai-ev-strategy
  8. python scripts/deck_cli.py full-pipeline hyundai-ev-strategy --sync-layout --enrich-evidence --polish

# 2. 요건 기반 전략 추천 실행
$ python scripts/deck_cli.py recommend acme-demo --apply-layout
✓ 전략 리포트 생성: clients/acme-demo/strategy_report.md
✓ 생성 레이아웃 선호: clients/acme-demo/layout_preferences.generated.yaml

# 3. 전체 파이프라인 실행
$ python scripts/deck_cli.py full-pipeline acme-demo --sync-layout --enrich-evidence --polish
=== Full Pipeline 시작: acme-demo ===

[1/3] 스키마 검증 중...
✓ Deck Spec 검증 통과

[2/3] PPTX 렌더링 중...
✓ PPTX 렌더링 완료

[3/3] QA 검사 중...
✅ QA 통과 (경고: 2, 참고: 1)

=== Full Pipeline 완료: acme-demo ===

# 4. QA만 별도 실행
$ python scripts/deck_cli.py qa acme-demo
# PPT QA 보고서
**파일**: `clients/acme-demo/outputs/acme-demo_20260201_103000.pptx`
**결과**: ✅ 통과
```

---

## 고객사 분석 리포트

`analyze` 명령은 고객사별로 **어떤 분석을 통해 PPT를 구성해야 하는지**를 자동으로 진단합니다.

### 생성 파일

- `clients/<client>/analysis_report.md`
- `clients/<client>/analysis_report.json`
- (전체 실행 시) `reports/client_analysis_summary_*.md`, `reports/client_analysis_summary_*.json`

### 단일 고객 분석

```bash
python scripts/deck_cli.py analyze <client-name>
```

### 전체 고객 분석

```bash
python scripts/deck_cli.py analyze --all
```

### 권장 실행 순서 (실제 고객 프로젝트)

```bash
# 1) 고객 맞춤 레이아웃 반영
python scripts/deck_cli.py sync-layout <client-name>

# 2) 불릿-출처 연결 자동 보강
python scripts/deck_cli.py enrich-evidence <client-name>

# 3) 품질 파이프라인 실행
python scripts/deck_cli.py full-pipeline <client-name> --sync-layout --enrich-evidence --polish
```

### 리포트 포함 항목

- 준비도 점수: Brief / Sources / Storyline / Spec / Execution
- 산업별 분석 모듈 추천: 분석 목적, 방법론, 필요 데이터, 슬라이드 매핑
- 갭/리스크: 누락 파일, 근거 연결률, QA 상태
- 실행 액션: 어떤 파일을 어떻게 보강할지 즉시 실행 가능한 체크리스트

---

## 요건 입력 기반 맞춤 추천

`recommend` 명령은 고객사별 요구사항과 집중 포인트를 입력하면, 그에 맞는 전략과 레이아웃 결과를 자동으로 생성합니다.

### 입력 파일

- `clients/<client>/strategy_input.yaml`
- 새 클라이언트 생성 시 템플릿이 자동 포함됩니다.

### 핵심 입력 항목

- `priorities.focus_areas`
- 선택값: `cost_reduction`, `revenue_growth`, `risk_control`, `customer_experience`, `operational_excellence`, `data_foundation`, `ai_scaling`
- `priorities.must_answer_questions`
- 실제 경영진 질문(최소 3개) 입력
- `data_readiness.internal_data_level`
- `none`, `partial`, `full`
- `deck_preferences.storytelling_mode`
- `decision_first`, `diagnostic_first`, `opportunity_first`
- `deck_preferences.must_have_layouts`
- 고객이 요구한 PPT 레이아웃 강제 항목

### 실행 명령

```bash
# 전략 추천 결과 생성
python scripts/deck_cli.py recommend <client-name>

# 생성된 레이아웃을 deck_spec에 즉시 반영 (안전모드: 키워드 기반)
python scripts/deck_cli.py recommend <client-name> --apply-layout
```

### 생성 결과물

- `clients/<client>/strategy_report.md`
- `clients/<client>/strategy_report.json`
- `clients/<client>/layout_preferences.generated.yaml`

### 고객사 유형별 집중 포인트 가이드

| 고객사 유형 | 우선 focus_areas | 필수 확인 KPI | 권장 레이아웃 |
|---|---|---|---|
| 제조/산업재 | `operational_excellence`, `cost_reduction`, `ai_scaling` | OEE, 불량률, 재고일수, 다운타임 | `comparison`, `chart_focus`, `timeline` |
| 유통/소비재 | `revenue_growth`, `customer_experience`, `data_foundation` | 채널별 매출성장률, 객단가, 재고회전율 | `content`, `chart_focus`, `comparison` |
| 금융/보험 | `risk_control`, `revenue_growth`, `data_foundation` | 손실률, 승인율, 컴플라이언스 위반건수 | `comparison`, `process_flow`, `timeline` |
| 헬스케어 | `risk_control`, `customer_experience`, `operational_excellence` | 대기시간, 자원가동률, 품질지표 | `process_flow`, `chart_focus`, `timeline` |
| 공공/기관 | `risk_control`, `data_foundation`, `cost_reduction` | 서비스 처리시간, 예산 집행효율, 품질지표 | `process_flow`, `comparison`, `timeline` |

### 권장 운영 순서

```bash
python scripts/deck_cli.py recommend <client-name> --apply-layout
python scripts/deck_cli.py analyze <client-name>
python scripts/deck_cli.py full-pipeline <client-name> --sync-layout --enrich-evidence --polish
```

---

## 대화형 스킬

Claude Code와 대화할 때 사용할 수 있는 스킬입니다.

| 스킬 | 설명 | 사용 예시 |
|------|------|----------|
| `/intake <client>` | 새 프로젝트 시작 및 정보 수집 | `/intake samsung-ai` |
| `/research <client>` | 리서치 수행 및 출처 기록 | `/research samsung-ai` |
| `/industry <client>` | 산업 심층 분석 | `/industry samsung-ai` |
| `/competitors <client>` | 경쟁사 분석 | `/competitors samsung-ai` |
| `/storyline <client>` | 스토리라인 구축 | `/storyline samsung-ai` |
| `/slidespec <client>` | Deck Spec 생성 | `/slidespec samsung-ai` |
| `/analyze <client>` | 고객사 분석 전략/갭 리포트 | `/analyze samsung-ai` |
| `/recommend <client>` | 요건 입력 기반 전략/레이아웃 추천 | `/recommend samsung-ai` |
| `/sync-layout <client>` | 레이아웃 선호 반영 | `/sync-layout samsung-ai` |
| `/enrich-evidence <client>` | evidence/source_anchor 자동 보강 | `/enrich-evidence samsung-ai` |
| `/render <client>` | PPTX 렌더링 | `/render samsung-ai` |
| `/qa <client>` | 품질 검증 | `/qa samsung-ai` |
| `/polish <client>` | 미세 편집 (v2.0) | `/polish samsung-ai` |
| `/lessons <client>` | 학습 기록 | `/lessons samsung-ai` |

---

## Deck Spec v2.0 작성 가이드

### 기본 구조

```yaml
# 메타데이터 (필수)
client_meta:
  client_name: "ACME Corp"
  industry: "Manufacturing"
  date: "2026-02-01"
  audience: "C-level"
  objective: "디지털 전환 전략"
  language: "ko"

# 전역 제약조건 (v2.0 신규)
global_constraints:
  max_slides: 30
  default_max_bullets: 6
  default_max_chars_per_bullet: 100
  forbidden_words: ["추정", "아마"]
  tone: "professional"

# 가정 목록 (선택)
assumptions:
  - "공개 정보 기반 분석"

# 출처 참조 (선택)
sources_ref:
  - "sources.md#market"

# 슬라이드 목록 (필수)
slides:
  - layout: "cover"
    title: "제목"
    governing_message: "핵심 메시지"
```

### 2층 구조: 콘텐츠 블록 (v2.0)

```yaml
slides:
  - layout: "content"
    title: "시장 분석 결과"
    governing_message: "3개 분야에서 성장 기회 확인"

    # 방법 1: 전통적 bullets (레거시 호환)
    bullets:
      - "디지털 전환 시장 연 15% 성장"
      - "AI 솔루션 수요 급증"

    # 방법 2: 콘텐츠 블록 (v2.0 권장)
    content_blocks:
      - type: "bullets"
        position: "main"
        evidence:
          source_anchor: "sources.md#market-data"
          confidence: "high"
        bullets:
          - text: "디지털 전환 시장 연 15% 성장"
            evidence:
              source_anchor: "sources.md#gartner-2026"
          - text: "AI 솔루션 수요 급증"

      - type: "kpi"
        position: "sidebar"
        kpi:
          label: "시장 규모"
          value: "2.5"
          unit: "조원"
          trend: "up"
```

### 레이아웃 의도 지정 (layout_intent)

```yaml
- layout: "chart_focus"
  title: "Value Case"
  governing_message: "핵심 KPI 개선 효과가 2년차부터 가시화됩니다"
  layout_intent:
    emphasis: "balanced"      # content | visual | balanced
    visual_position: "right"  # left | right | center
    content_density: "normal" # sparse | normal | dense
```

### 컬럼 레이아웃 작성

```yaml
# two_column 예시
- layout: "two_column"
  title: "분석과 시사점"
  governing_message: "데이터 기반 전환이 필요합니다"
  columns:
    - heading: "현황 분석"
      bullets:
        - "레거시 시스템 분절"
        - "데이터 사일로"
    - heading: "시사점"
      bullets:
        - "통합 플랫폼 필요"
        - "거버넌스 체계 수립"
```

---

## 레이아웃 유형

### 기본 레이아웃

| 레이아웃 | 용도 | 불릿 | 설명 |
|----------|------|------|------|
| `cover` | 표지 | 0개 | 덱 표지, 제목과 서브타이틀 |
| `exec_summary` | 요약 | 3-6개 | 핵심 메시지 요약 |
| `content` | 일반 | 3-6개 | 범용 컨텐츠 슬라이드 |
| `section_divider` | 섹션 구분 | 0개 | 섹션 시작 표시 |
| `thank_you` | 마무리 | 0개 | 마지막 슬라이드 |

### 컬럼 기반 레이아웃

| 레이아웃 | 용도 | 컬럼 수 | 설명 |
|----------|------|---------|------|
| `two_column` | 좌우 분할 | 2개 | 분석/시사점 등 |
| `three_column` | 3분할 | 3개 | 옵션 비교 등 |
| `comparison` | As-Is/To-Be | 2개 | 전후 비교 (배경색 차별화) |

### 특수 레이아웃

| 레이아웃 | 용도 | 설명 |
|----------|------|------|
| `timeline` | 로드맵 | 시간순 단계 표시 |
| `process_flow` | 프로세스 | 단계별 흐름 표시 |
| `chart_focus` | 차트 중심 | 좌측 차트 + 우측 불릿 (`data_inline`/`data_path` 지원) |
| `image_focus` | 이미지 중심 | `image_path`가 있으면 실제 이미지, 없으면 플레이스홀더 |
| `quote` | 인용문 | 중앙 정렬 인용 |
| `appendix` | 부록 | 상세 데이터 |

---

## 디자인 토큰

### 폰트 설정

| 요소 | 폰트 | 굵기 | 크기 |
|------|------|------|------|
| 제목 | Noto Sans KR | Bold | 24pt |
| 거버닝 메시지 | Noto Sans KR | Bold | 16pt |
| 본문 | Noto Sans KR | Regular | 12pt |
| 각주 | Noto Sans KR | Regular | 10pt |

### 색상 팔레트

| 용도 | 색상명 | HEX 코드 | 용례 |
|------|--------|----------|------|
| 주요 강조 | Primary Blue | `#0A6ED1` | 제목, 강조 텍스트 |
| 어두운 강조 | Dark Blue | `#084E8A` | 헤딩, 진한 배경 |
| 밝은 배경 | Light Blue | `#D6EAFB` | 박스 배경 |
| 본문 텍스트 | Text Dark | `#1A1A1A` | 일반 텍스트 |
| 보조 텍스트 | Text Muted | `#4D4D4D` | 거버닝 메시지 |
| 구분선 | Divider Gray | `#D9D9D9` | 선, 테두리 |
| 배경 | Background | `#FFFFFF` | 슬라이드 배경 |

### 밀도 규칙

| 항목 | 기준 | 설명 |
|------|------|------|
| 슬라이드당 불릿 수 | 기본 3-6개 | cover/divider/thank_you/quote는 0개, chart_focus/image_focus는 0-4개 |
| 불릿당 줄 수 | 1-2줄 | 1줄 권장, 최대 2줄 |
| 불릿 최대 길이 | 100자 | 80자 권장, global_constraints로 오버라이드 가능 |
| 거버닝 메시지 길이 | 200자 | 100자 이내 권장 |

---

## 품질 관리 (QA)

### QA 자동 검사 항목 (v2.0)

| 카테고리 | 검사 항목 | 심각도 |
|----------|----------|--------|
| 불릿 개수 | 슬라이드 최소 불릿 미달 | ⚠ 경고 |
| 불릿 개수 | 슬라이드당 6개 초과 | ⚠ 경고 |
| 불릿 길이 | 100자 초과 | ⚠ 경고 |
| 불릿 줄 수 | 2줄 초과 가능성 | ⚠ 경고 |
| 폰트 | 허용되지 않은 폰트 사용 | ⚠ 경고 |
| 폰트 크기 | 비정상적 크기 (8pt 미만, 30pt 초과) | ℹ 참고 |
| 콘텐츠 밀도 | 800자 초과 (과밀) | ⚠ 경고 |
| 콘텐츠 밀도 | 50자 미만 (부족) | ℹ 참고 |
| 금지어 | 금지 단어 발견 | ❌ 오류 |
| Evidence 포맷 | `sources.md#...` 형식 불일치 | ⚠ 경고 |
| Evidence 참조 | `sources.md` 앵커 미존재 | ℹ 참고 |
| Spec 일치 | 제목이 Spec과 불일치 | ℹ 참고 |

### QA 보고서 형식

```markdown
# PPT QA 보고서

**파일**: `clients/acme-demo/outputs/acme-demo_20260201.pptx`
**슬라이드 수**: 10
**결과**: ✅ 통과

## 요약
- 🔴 오류: 0
- 🟡 경고: 2
- 🔵 참고: 1

## 상세 이슈
### 슬라이드 5
- 🟡 **[불릿 길이]** 불릿이 100자를 초과합니다 (125자)
```

### QA 명령어

```bash
# 기본 QA 검사
python scripts/deck_cli.py qa <client>

# 특정 PPTX 파일 검사
python scripts/deck_cli.py qa <client> --pptx path/to/file.pptx

# JSON 보고서 출력
python scripts/deck_cli.py qa <client> -o qa_report.json
```

---

## 문제 해결

### 자주 발생하는 오류

#### "deck_spec not found" 오류
```bash
# 원인: deck_spec.yaml 파일이 없음
# 해결: 파일 생성 또는 경로 확인
python scripts/deck_cli.py status <client-name>
```

#### 스키마 검증 실패
```bash
# 원인: 필수 필드 누락 또는 데이터 타입 오류
# 해결: 오류 메시지에서 문제 필드 확인 후 수정
python scripts/deck_cli.py validate <client-name>
```

#### 폰트가 적용되지 않음
```
원인: 시스템에 Noto Sans KR 폰트가 설치되지 않음
해결: Google Fonts에서 다운로드 후 시스템에 설치
```

#### 렌더링 실패
```bash
# 원인: tokens.yaml 또는 layouts.yaml 누락
# 해결: templates/company/ 폴더 확인
ls templates/company/
```

#### QA 검사 실패
```bash
# 원인: 품질 기준 미달
# 해결: QA 보고서에서 이슈 확인 후 deck_spec.yaml 수정
python scripts/deck_cli.py qa <client>
```

### 지원

문제가 지속되면:
1. `CLAUDE.md`의 에러 처리 섹션 참조
2. `.claude/skills/` 의 스킬 문서 확인
3. GitHub Issues에 문의

---

## 라이선스

이 프로젝트는 비공개(Private) 프로젝트입니다.

---

## 변경 이력

### v2.3.0 (2026-02-06)
- `recommend` 명령 추가: `strategy_input.yaml` 기반 맞춤 전략/레이아웃 추천
- 생성 파일:
  - `strategy_report.md/json` (요건 기반 우선순위/모듈/슬라이드 추천)
  - `layout_preferences.generated.yaml` (생성형 레이아웃 선호)
- `--apply-layout` 옵션으로 생성 레이아웃을 `deck_spec.yaml`에 즉시 반영 지원
- 고객사 유형별 집중 포인트 가이드(README) 추가
- `_template`에 `strategy_input.yaml` 템플릿 추가

### v2.2.1 (2026-02-06)
- `enrich-evidence` 명령 추가: deck_spec 불릿에 `evidence.source_anchor` 자동 보강
- `full-pipeline` 옵션 확장:
  - `--sync-layout` (layout_preferences 반영)
  - `--enrich-evidence` (근거 자동 보강)
  - `--evidence-confidence`, `--overwrite-evidence`
- `layout_preferences.yaml`에 `title_keyword_overrides` 추가 (슬라이드 제목 키워드 기반 레이아웃 강제)
- 준비도 점수 로직 강화: evidence 연결률 80% 미만 시 품질 게이트 실패로 판정

### v2.2.0 (2026-02-06)
- `analyze` 명령 추가: 고객사별 분석 전략/준비도 리포트 자동 생성
- 산업/데이터 가용성 기반 분석 모듈 추천 및 PPT 매핑 제공
- 전체 고객사 분석 요약 리포트(`reports/`) 자동 생성
- 고객사 샘플에 `analysis_report.md/json` 생성 흐름 반영

### v2.1.2 (2026-02-06)
- 불릿 규칙을 레이아웃별 최소/최대 기준으로 통합 (`validate`/`qa` 동일 로직)
- `chart_focus`/`image_focus` 구조 누락 감지 강화 (필수 시각 요소 경고)
- `chart.data_path`(JSON/CSV) 기반 실제 차트 렌더링 지원
- `layout_intent.visual_position` 반영 (chart/image focus 좌/우/중앙 배치)
- QA 중복 이슈 적재 제거 및 evidence 타입 안전성 강화

### v2.1.1 (2026-02-06)
- QA 불릿 카운트 오탐 제거 (spec 기반 집계 우선)
- Evidence 검사 범위 확장 (sources_ref/visuals/content_blocks/footnotes)
- comparison 레이아웃 우측 불릿 가독성 개선 (흰색 텍스트)
- 이미지 상대경로 해석 개선 (spec 경로 기준)
- `chart.data_inline` 실제 차트 렌더링 지원
- validate/qa/cli 간 비즈니스 규칙 정합성 강화

### v2.0.0 (2026-02-01)
- 2층 스펙 구조 (콘텐츠 스펙 + 레이아웃 스펙)
- 근거 연결 (Evidence) 기능
- 자동 QA 검사 시스템
- 하이브리드 렌더 워크플로우 (Polish 스킬)
- 전역/슬라이드별 제약조건 지원
- 렌더러 버그 수정 (템플릿 기존 슬라이드 제거)

### v1.0.0 (2026-01-15)
- 최초 릴리스
- 통합 CLI 구축
- 14개 레이아웃 지원
- 9개 대화형 스킬 구현
- JSON Schema 기반 검증
- 디자인 토큰 시스템
