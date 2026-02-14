# Consulting Quality Benchmark

## 목적
본 문서는 엔진 산출물을 전략 컨설팅 펌(맥킨지/BCG) 보고서 기준에 맞춰 점검하기 위한 내부 벤치마크다.

## 평가 프레임

### 1) 스토리라인 구조
- 피라미드 구조: 결론 → 근거 → 실행안
- 슬라이드 간 논리 연결: 문제정의 → 시사점 → 옵션 → 권고안 → 실행
- 중복 메시지 제거: 거버닝 메시지 중복 금지
- 자동 검사: cover 시작, 핵심 타입 존재(exec-summary/market/benchmark/roadmap/appendix), appendix 종료

### 2) 메시지 품질
- 거버닝 메시지는 한 문장으로 의사결정 포인트를 제시
- claim에는 반드시 `So What:` 포함
- 추상적 표현보다 실행 결과를 제시하는 동사 중심 문장 사용

### 3) 근거 품질
- 수치 claim은 최소 2개 evidence를 통한 교차근거
- claim ↔ evidence ↔ source 매핑을 provenance로 저장
- 단위/기간 누락 시 QA 감점

### 4) 실행 가능성
- 권고안에 실행 주체/기한/우선순위를 연결
- 로드맵 슬라이드에서 90일/180일/1년 단계 명시
- must_include 키워드 누락 시 self-critic에서 자동 보강

## 현재 엔진 자동화 수준
- 자동 보장됨: 기본 스토리 템플릿, 근거 매핑, QA 점수화, fail gate
- 자동 보장됨: 외부 research pack 주입 시 source/evidence 기반 claim 생성
- 부분 자동화: 오버플로우 완화(문장 길이 축소), must_include 보강
- 수동 보완 필요: 업종별 도메인 전문성, 실제 사업 맥락 판단, 최종 임원 톤 조정

## 운영 권장
- 배포 전 최소 1회: `pnpm agent qa --run <run-path> --threshold 85`
- 경영진 제출 전: 사람 리뷰로 결론문 문장(타이틀/권고안) 수동 다듬기
