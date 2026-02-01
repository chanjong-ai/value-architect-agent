# Skill: lessons

학습 기록 스킬 - 프로젝트 학습 내용 추출 및 보존

## 목적
완료된 프로젝트에서 재사용 가능한 학습 내용을 추출하고 보존합니다.

## 트리거
- `/lessons <client-name>` 명령어 사용 시
- 프로젝트 완료 후 사용자가 "정리 해줘", "학습 기록" 요청 시

## 입력
- `clients/<client>/brief.md`
- `clients/<client>/deck_spec.yaml`
- `clients/<client>/sources.md`
- `clients/<client>/research/*.md`
- 프로젝트 진행 중 발생한 이슈/해결책

## 출력
- `clients/<client>/lessons.md` (클라이언트별 학습)
- `library/lessons/<industry>_lessons.md` (산업별 재사용 학습)

## 학습 내용 분류

### 1. 산업 인사이트 (Industry Insights)
- 해당 산업의 주요 트렌드
- 산업별 Pain Points
- 산업 특화 솔루션 패턴

### 2. 스토리라인 패턴 (Storyline Patterns)
- 효과적이었던 스토리 구조
- 설득력 있었던 거버닝 메시지
- 청중별 맞춤 접근법

### 3. 데이터 및 출처 (Data & Sources)
- 유용했던 데이터 소스
- 신뢰할 수 있는 통계 출처
- 산업 보고서 레퍼런스

### 4. 시각화 패턴 (Visualization Patterns)
- 효과적이었던 레이아웃
- 차트/다이어그램 사용 사례
- 비교 표현 방식

### 5. 피드백 및 개선점 (Feedback & Improvements)
- 클라이언트 피드백
- 발생한 이슈와 해결 방법
- 다음 프로젝트를 위한 개선점

## 절차

### Step 1: 프로젝트 아티팩트 리뷰
brief.md, deck_spec.yaml, sources.md, research 폴더를 리뷰합니다.

### Step 2: 학습 내용 추출
각 카테고리별로 재사용 가능한 내용을 식별합니다.

### Step 3: 클라이언트 lessons.md 작성
`clients/<client>/lessons.md`에 기록합니다.

### Step 4: 라이브러리 업데이트
재사용 가치가 높은 내용을 `library/lessons/`에 추가합니다.

### Step 5: 패턴 추출 (선택)
반복 사용 가능한 슬라이드 패턴을 `library/patterns/`에 저장합니다.

## 출력 템플릿

### clients/<client>/lessons.md

```markdown
# Lessons Learned: [클라이언트명]

## Project Summary
- 클라이언트: [이름]
- 산업: [산업]
- 기간: [시작일] - [종료일]
- 덱 주제: [주제]

## What Went Well
1. [성공 요인 1]
2. [성공 요인 2]

## Challenges & Solutions
| 문제 | 해결책 |
|------|--------|
| [문제 1] | [해결책 1] |
| [문제 2] | [해결책 2] |

## Key Learnings

### Industry Insights
- [인사이트 1]
- [인사이트 2]

### Effective Storylines
- [패턴 1]: [설명]
- [패턴 2]: [설명]

### Useful Sources
- [출처 1]: [왜 유용했는지]
- [출처 2]: [왜 유용했는지]

### Visualization Wins
- [슬라이드 X]: [왜 효과적이었는지]

## Recommendations for Future
1. [권고 1]
2. [권고 2]

## Reusable Assets
- `library/patterns/[파일명]`: [설명]
- `library/lessons/[파일명]`: [설명]
```

### library/lessons/<industry>_lessons.md

```markdown
# [산업] Industry Lessons

## Overview
이 문서는 [산업] 관련 프로젝트에서 축적된 학습 내용을 담고 있습니다.

## Industry Characteristics
- 주요 특성 1
- 주요 특성 2

## Common Pain Points
1. [Pain Point 1]
2. [Pain Point 2]

## Effective Approaches
### Storyline Patterns
- [패턴 1]: [언제 사용, 왜 효과적]

### Data Sources
- [출처 1]: [설명]

### Slide Templates
- [템플릿 1]: [용도]

## Projects Reference
- [클라이언트 A]: [주요 학습]
- [클라이언트 B]: [주요 학습]

---
Last Updated: [날짜]
Contributors: [프로젝트 목록]
```

## 패턴 추출 가이드

재사용 가능한 패턴 유형:
1. **슬라이드 템플릿**: 특정 목적에 맞는 슬라이드 구조
2. **불릿 패턴**: 효과적인 불릿 구성 방식
3. **거버닝 메시지 템플릿**: 산업/상황별 메시지 패턴
4. **데이터 시각화 패턴**: 차트/표 구성 방식

패턴 저장 형식:
```yaml
# library/patterns/<pattern-name>.yaml
name: "디지털 전환 로드맵"
category: "timeline"
industry: ["Manufacturing", "Retail"]
description: "3단계 디지털 전환 로드맵 슬라이드"
template:
  layout: "timeline"
  title: "[Client] 디지털 전환 로드맵"
  governing_message: "3단계 접근으로 [기간] 내 전환 완료"
  bullets:
    - "Phase 1: 기반 정비"
    - "Phase 2: 핵심 전환"
    - "Phase 3: 고도화"
```

## 완료 기준
- lessons.md 작성 완료
- 최소 3개 이상의 학습 내용 기록
- 재사용 가능한 패턴 1개 이상 추출
- library/ 업데이트 (해당 시)

## 예시

```
사용자: acme-demo 학습 정리 해줘

Claude: acme-demo 프로젝트의 학습 내용을 정리하겠습니다.

[프로젝트 리뷰 중...]

## Key Learnings

### 효과적이었던 점
1. 3단계 로드맵 구조가 경영진에게 명확한 실행 경로 제시
2. As-Is/To-Be 비교 슬라이드로 변화 필요성 시각화
3. KPI 기반 가치 제안으로 투자 정당화

### 개선이 필요했던 점
1. 초기 불릿 밀도가 높아 여러 차례 수정 필요
2. 경쟁사 분석 출처 보강 필요

### 재사용 가능한 패턴
- 제조업 디지털 전환 스토리라인 구조
- AI 활용 가치 제안 프레임

clients/acme-demo/lessons.md에 기록하겠습니다.
library/lessons/manufacturing_lessons.md도 업데이트하겠습니다.
```
