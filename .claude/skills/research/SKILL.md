# Skill: research

리서치 스킬 - 클라이언트 분석을 위한 정보 수집

## 목적
덱 작성에 필요한 리서치를 수행하고 출처를 체계적으로 기록합니다.

## 트리거
- `/research <client-name>` 명령어 사용 시
- 사용자가 "리서치 해줘", "정보 찾아줘" 등 요청 시

## 입력
- `clients/<client>/brief.md` (프로젝트 컨텍스트)
- 사용자의 리서치 요청

## 출력
- `clients/<client>/sources.md` 업데이트
- `clients/<client>/research/*.md` 리서치 노트

## 리서치 영역

### 1. 시장/산업 분석 (#market)
- 시장 규모 및 성장률
- 주요 트렌드
- 규제 환경
- 산업 동인/억제 요인

### 2. 클라이언트 분석 (#client)
- 회사 개요, 연혁
- 사업 구조, 매출 구성
- 재무 현황 (공개 정보)
- 최근 뉴스, IR 자료

### 3. 경쟁사 분석 (#competitors)
- 주요 경쟁사 목록
- 경쟁사별 강점/약점
- 시장 점유율
- 벤치마킹 포인트

### 4. 기술 트렌드 (#tech-trends)
- 관련 기술 동향
- AI/클라우드/데이터 트렌드
- 산업별 디지털 전환 사례

## 절차

### Step 1: 리서치 범위 확인
brief.md를 읽고 필요한 리서치 범위를 파악합니다.

### Step 2: 정보 수집
웹 검색, 공개 자료 등을 통해 정보를 수집합니다.

### Step 3: 출처 기록
sources.md에 모든 출처를 앵커와 함께 기록합니다:

```markdown
## market
- [x] Gartner 시장 보고서 2025
- [x] 산업연구원 동향 분석

## client
- [x] 삼성전자 IR 자료 (2025)
- [x] 공식 웹사이트

## competitors
- [x] 경쟁사 A 연간보고서
- [x] 경쟁사 B 뉴스 기사
```

### Step 4: 리서치 노트 작성
`clients/<client>/research/` 폴더에 영역별 노트를 작성합니다:
- `industry_analysis.md`
- `client_overview.md`
- `competitor_landscape.md`
- `tech_trends.md`

### Step 5: 핵심 인사이트 정리
수집한 정보에서 덱에 사용할 핵심 인사이트를 도출합니다.

## 출처 기록 규칙
1. 모든 사실에는 출처를 명시합니다
2. 숫자/통계는 출처와 연도를 함께 기록합니다
3. 가정과 사실을 명확히 구분합니다
4. 앵커(#market, #client 등)를 사용해 추적 가능하게 합니다

## 완료 기준
- sources.md에 최소 5개 이상의 출처 기록
- 리서치 노트 최소 1개 이상 작성
- 핵심 인사이트 3개 이상 도출

## 다음 단계
리서치 완료 후:
- 스토리라인 구축 → `/storyline` 스킬
- 산업 심층 분석 → `/industry` 스킬
- 경쟁사 심층 분석 → `/competitors` 스킬
