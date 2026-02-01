# Skill: storyline

스토리라인 스킬 - 경영진용 내러티브 구축

## 목적
리서치 결과를 바탕으로 설득력 있는 경영진용 스토리라인을 구축합니다.

## 트리거
- `/storyline <client-name>` 명령어 사용 시
- 사용자가 "스토리라인 만들어줘", "덱 구조 잡아줘" 요청 시

## 입력
- `clients/<client>/brief.md`
- `clients/<client>/sources.md`
- `clients/<client>/research/*.md` (리서치 노트)

## 출력
- `clients/<client>/deck_outline.md`

## 핵심 원칙

### 1. 피라미드 원칙 (Pyramid Principle)
- 결론 먼저 (Top-Down)
- 지원 논거 그룹핑
- MECE (Mutually Exclusive, Collectively Exhaustive)

### 2. So What? / Why So?
- 모든 슬라이드는 "So What?"에 답해야 함
- 모든 주장은 "Why So?"로 뒷받침되어야 함

### 3. 스토리 아크
```
Context → Problem → Implication → Solution → Roadmap → Value
(맥락) → (문제) → (시사점) → (해결책) → (로드맵) → (가치)
```

## 표준 덱 구조

### 1. Cover (커버)
- 제목, 클라이언트명, 날짜

### 2. Executive Summary (요약)
- 핵심 메시지 3-4개
- 전체 스토리 압축

### 3. Context (맥락)
- 산업 환경
- 기술 트렌드
- 시장 동인

### 4. Current State (현재 상태)
- 클라이언트 현황
- Pain Points
- 갭 분석

### 5. Competitive Landscape (경쟁 환경)
- 경쟁사 비교
- 벤치마킹

### 6. Strategic Implications (전략적 시사점)
- 기회와 위협
- 우선순위

### 7. Recommendation (권고안)
- 목표 아키텍처
- 핵심 이니셔티브

### 8. Roadmap (로드맵)
- 단계별 계획
- 타임라인

### 9. Value Case (가치)
- KPI 개선 전망
- ROI

### 10. Appendix (부록) - 선택
- 상세 데이터
- 방법론

## 절차

### Step 1: 핵심 메시지 정의
브리프와 리서치를 바탕으로 "이 덱이 전달해야 할 핵심 메시지"를 정의합니다.

### Step 2: 스토리 아크 설계
Context → Problem → Implication → Solution → Roadmap → Value 흐름을 설계합니다.

### Step 3: 슬라이드별 구조 작성
각 슬라이드의:
- 제목 (Title)
- 거버닝 메시지 (Governing Message)
- 핵심 불릿 (3-4개)

### Step 4: 논리 흐름 검증
- 앞뒤 슬라이드 연결 확인
- "So What?" 테스트
- MECE 검증

### Step 5: deck_outline.md 작성
최종 스토리라인을 deck_outline.md에 기록합니다.

## 출력 템플릿

```markdown
# Deck Outline: [클라이언트명]

> 핵심 메시지: [한 문장으로 덱의 핵심 주장]

## Slide 1 — Cover
- Title: [덱 제목]
- Governing message: [핵심 서브메시지]

## Slide 2 — Executive Summary
- Title: Executive Summary
- Governing message: [핵심 요약 메시지]
- Key bullets:
  - [불릿 1]
  - [불릿 2]
  - [불릿 3]
  - [불릿 4]

## Slide 3 — Industry Context
- Title: [제목]
- Governing message: [So What?]
- Key bullets:
  - ...

## Slide 4 — Client Current State
- Title: [제목]
- Governing message: [So What?]
- Key bullets:
  - ...

[이하 동일 구조]
```

## 거버닝 메시지 작성 가이드

좋은 거버닝 메시지:
- ✅ "AI 기반 품질검사 도입으로 불량률 50% 감소가 가능합니다"
- ✅ "3단계 로드맵으로 2년 내 디지털 전환을 완료할 수 있습니다"

나쁜 거버닝 메시지:
- ❌ "산업 트렌드 분석" (설명적, So What 없음)
- ❌ "여러 가지 옵션이 있습니다" (모호함)

## 완료 기준
- deck_outline.md 작성 완료
- 모든 슬라이드에 거버닝 메시지 포함
- 논리 흐름이 일관됨
- 슬라이드 수가 brief.md의 목표 범위 내

## 다음 단계
- 덱 스펙 생성 → `/slidespec` 스킬
