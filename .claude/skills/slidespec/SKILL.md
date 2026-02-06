# Skill: slidespec

덱 스펙 생성 스킬 - deck_outline.md를 deck_spec.yaml로 변환

## 목적
deck_outline.md를 스키마 준수 deck_spec.yaml로 변환합니다.

## 트리거
- `/slidespec <client-name>` 명령어 사용 시
- 사용자가 "스펙 생성", "YAML 만들어줘" 요청 시

## 입력 (필수)
- `clients/<client>/brief.md`
- `clients/<client>/constraints.md`
- `clients/<client>/deck_outline.md`
- `clients/<client>/sources.md` (있는 경우)

## 출력 (필수)
- `clients/<client>/deck_spec.yaml`

## 스키마 준수 사항

### client_meta (필수)
```yaml
client_meta:
  client_name: "클라이언트명"
  industry: "산업"
  date: "YYYY-MM-DD"
  audience: "대상 청중"
  objective: "덱 목적"
  language: "ko"  # ko, en, ko-en
```

### slides (필수)
각 슬라이드는 반드시 다음을 포함:
- `layout`: cover, exec_summary, content, two_column, comparison, timeline 등
- `title`: 슬라이드 제목 (최대 100자)
- `governing_message`: 핵심 메시지 (최대 200자)

선택적 필드:
- `subtitle`: 부제목 (cover, section_divider용)
- `bullets`: 불릿 목록 (최대 8개)
- `columns`: 컬럼 데이터 (two_column, three_column, comparison용)
- `visuals`: 시각 자료 정의
- `layout_intent`: visual_position/emphasis/content_density 등 레이아웃 힌트
- `notes`: 발표자 노트
- `metadata`: 추가 메타데이터

## 레이아웃 선택 가이드

| 내용 유형 | 권장 레이아웃 |
|-----------|--------------|
| 표지 | `cover` |
| 요약 | `exec_summary` |
| 일반 컨텐츠 | `content` |
| 분석 vs 시사점 | `two_column` |
| As-Is vs To-Be | `comparison` |
| 로드맵 | `timeline` |
| 차트 중심 | `chart_focus` |
| 섹션 구분 | `section_divider` |
| 마무리 | `thank_you` |

## 밀도 규칙

### 불릿 규칙
- 일반 슬라이드: 3-6개 불릿
- chart_focus/image_focus: 0-4개 불릿
- cover/section_divider/thank_you/quote: 0개 불릿
- 한 불릿당 1줄 권장 (최대 2줄)
- 불릿 최대 길이: 100자 (80자 권장)

### 구조화된 불릿
```yaml
bullets:
  - "단순 불릿 텍스트"
  - text: "구조화된 불릿"
    level: 1  # 0: 최상위, 1: 하위, 2: 하위하위
    emphasis: "bold"  # normal, bold, highlight
```

## 컬럼 레이아웃

### two_column 예시
```yaml
- layout: "two_column"
  title: "현황 분석과 시사점"
  governing_message: "데이터 기반 의사결정 체계 구축이 시급합니다"
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

### comparison 예시
```yaml
- layout: "comparison"
  title: "디지털 전환 전후 비교"
  governing_message: "운영 효율 30% 개선이 예상됩니다"
  columns:
    - heading: "As-Is"
      bullets:
        - "수작업 기반 프로세스"
        - "분절된 데이터"
    - heading: "To-Be"
      bullets:
        - "자동화된 워크플로우"
        - "통합 데이터 플랫폼"
```

## 절차

### Step 1: 입력 파일 읽기
brief.md, constraints.md, deck_outline.md를 읽습니다.

### Step 2: client_meta 작성
brief.md에서 메타데이터를 추출합니다.

### Step 3: 슬라이드 변환
deck_outline.md의 각 슬라이드를 YAML 객체로 변환합니다:
1. 적절한 layout 선택
2. title, governing_message 매핑
3. bullets 구조화
4. notes에 출처 참조 추가

### Step 4: 밀도 검증
- 레이아웃별 불릿 수 확인 (일반 3-6개, chart/image 0-4개, no-bullet 0개)
- 불릿 길이 확인 (100자 이내)
- 거버닝 메시지 길이 확인

### Step 5: 스키마 검증
```bash
python scripts/deck_cli.py validate <client-name>
```

### Step 6: 저장
deck_spec.yaml을 저장합니다.

## 출력 예시

```yaml
client_meta:
  client_name: "ACME Corp"
  industry: "Manufacturing"
  date: "2026-02-01"
  audience: "C-level"
  objective: "Digital Transformation Strategy"
  language: "ko"

assumptions:
  - "공개 정보 기반 분석"
  - "슬라이드 수 목표: 10-12"

sources_ref:
  - "sources.md#market"
  - "sources.md#competitors"

slides:
  - layout: "cover"
    title: "ACME 디지털 전환 전략"
    governing_message: "AI와 클라우드로 제조 혁신을 가속화합니다"
    notes: "표지 슬라이드"

  - layout: "exec_summary"
    title: "Executive Summary"
    governing_message: "3대 핵심 이니셔티브로 운영 효율 30% 개선"
    bullets:
      - "운영: 표준화된 프로세스로 리스크 감소"
      - "가치: 단일 지표 체계로 의사결정 가속화"
      - "확장: 통합 플랫폼으로 신규 사업 비용 절감"
    notes: "sources.md#market 참조"
```

## 완료 기준
- deck_spec.yaml 생성 완료
- 스키마 검증 통과
- 밀도 규칙 준수
- 모든 슬라이드에 거버닝 메시지 포함

## 다음 단계
- 렌더링 → `/render` 스킬
- QA → `/qa` 스킬
