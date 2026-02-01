# Skill: qa

품질 검증 스킬 - 덱 품질 점검 및 검증

## 목적
렌더링된 덱의 품질을 검증하고 개선점을 식별합니다.

## 트리거
- `/qa <client-name>` 명령어 사용 시
- 사용자가 "검토 해줘", "품질 확인" 요청 시

## 입력
- `clients/<client>/deck_spec.yaml`
- `clients/<client>/outputs/*.pptx` (최신 파일)
- `clients/<client>/brief.md` (요구사항 비교)

## 출력
- 품질 점검 리포트 (화면 출력)
- 필요시 `clients/<client>/qa_report.md`

## 품질 점검 체크리스트

### 1. 구조적 검증 (Structural)
- [ ] 슬라이드 수가 brief.md의 목표 범위 내
- [ ] Cover 슬라이드 존재
- [ ] Executive Summary 존재
- [ ] 마무리 슬라이드 존재
- [ ] 논리적 흐름 (Context → Problem → Solution → Roadmap → Value)

### 2. 컨텐츠 검증 (Content)
- [ ] 모든 슬라이드에 거버닝 메시지 존재
- [ ] 거버닝 메시지가 "So What?"에 답함
- [ ] 불릿이 MECE 원칙 준수
- [ ] 사실과 가정이 구분됨
- [ ] 숫자/통계에 출처 명시

### 3. 밀도 검증 (Density)
- [ ] 불릿 수: 슬라이드당 3-6개
- [ ] 불릿 길이: 80자 이내
- [ ] 거버닝 메시지 길이: 100자 이내
- [ ] 텍스트 밀도가 적절함 (wall of text 없음)

### 4. 스타일 검증 (Style)
- [ ] 일관된 용어 사용
- [ ] 문장 어미 통일 (예: ~합니다 vs ~함)
- [ ] 불필요한 수식어 제거
- [ ] 액션 지향적 표현

### 5. 출처 검증 (Sources)
- [ ] sources.md 참조가 노트에 포함
- [ ] 주요 주장에 출처 명시
- [ ] 가정이 명시적으로 표시됨

## 절차

### Step 1: deck_spec.yaml 읽기
스펙 파일을 로드하여 분석합니다.

### Step 2: 자동 검증
스키마 및 밀도 규칙 검증:
```bash
python scripts/deck_cli.py validate <client-name>
```

### Step 3: 구조적 검증
- 슬라이드 구성 확인
- 필수 슬라이드 존재 확인
- 논리 흐름 확인

### Step 4: 컨텐츠 검증
각 슬라이드에 대해:
- 거버닝 메시지 품질 평가
- 불릿 MECE 검증
- 출처 참조 확인

### Step 5: 리포트 작성
발견된 문제와 개선 권고를 정리합니다.

## 출력 형식

```
=== QA Report: <client-name> ===

## Summary
- Total Slides: 10
- Issues Found: 3
- Warnings: 5

## Issues (Must Fix)
1. [Slide 3] 거버닝 메시지 누락
2. [Slide 5] 불릿 8개로 밀도 초과
3. [Slide 7] 출처 없는 통계 사용

## Warnings (Should Review)
1. [Slide 2] 불릿이 2개뿐 (권장 3-6개)
2. [Slide 4] 거버닝 메시지가 120자로 긺
3. [Slide 6] 불릿 문장이 2줄 초과

## Recommendations
- Slide 3: "산업 환경 분석" → "데이터 기반 의사결정이 경쟁력의 핵심입니다"
- Slide 5: 불릿을 6개로 통합하거나 슬라이드 분할 권장

## Quality Score: 7/10
- Structure: 8/10
- Content: 7/10
- Density: 6/10
- Style: 8/10
```

## 거버닝 메시지 품질 기준

### 좋은 거버닝 메시지
- ✅ 명확한 주장 포함
- ✅ 액션 지향적
- ✅ 구체적 수치/결과 포함
- ✅ "So What?"에 답함

예시:
- "AI 기반 품질검사 도입으로 불량률 50% 감소가 가능합니다"
- "3단계 로드맵으로 2년 내 디지털 전환을 완료할 수 있습니다"

### 나쁜 거버닝 메시지
- ❌ 설명적/서술적
- ❌ 모호함
- ❌ 주장 없음

예시:
- "산업 트렌드 분석" (주장 없음)
- "여러 가지 옵션이 있습니다" (모호함)
- "현황을 살펴보겠습니다" (서술적)

## 완료 기준
- 모든 체크리스트 항목 확인
- Issues 0개 (또는 해결 계획 수립)
- Quality Score 8/10 이상

## 다음 단계

Issues 있는 경우:
- deck_spec.yaml 수정
- `/render` 다시 실행

완료 시:
- 학습 기록 → `/lessons` 스킬

## 예시

```
사용자: acme-demo QA 해줘

Claude: acme-demo 덱의 품질을 검증하겠습니다.

[Step 1] deck_spec.yaml 로드...
[Step 2] 스키마 검증...
✓ 검증 통과

[Step 3] 구조적 검증...
- 슬라이드 수: 10 ✓
- Cover 존재: ✓
- Exec Summary 존재: ✓

[Step 4] 컨텐츠 검증...

=== QA Report: acme-demo ===

## Summary
- Total Slides: 10
- Issues Found: 1
- Warnings: 2

## Issues
1. [Slide 7] 불릿 7개로 밀도 초과 (최대 6개)

## Warnings
1. [Slide 4] 거버닝 메시지 95자 (권장 80자 이내)
2. [Slide 9] 출처 참조 누락

## Quality Score: 8/10

권고: Slide 7의 불릿을 6개로 통합하거나 슬라이드 분할을 권장합니다.
수정하시겠습니까?
```
