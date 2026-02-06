# Skill: analyze

고객사 분석 전략/준비도 진단 스킬

## 목적
고객사별로 어떤 분석을 통해 PPT를 구성해야 하는지 구조화하고, 현재 산출물의 갭을 진단합니다.

## 트리거
- `/analyze <client-name>` 명령 사용 시
- 사용자가 "고객사별 분석 전략", "어떤 분석으로 PPT를 만들지"를 요청할 때

## 입력
- `clients/<client>/brief.md`
- `clients/<client>/constraints.md`
- `clients/<client>/sources.md`
- `clients/<client>/deck_outline.md`
- `clients/<client>/deck_spec.yaml`
- `clients/<client>/outputs/*_qa_report.json` (있는 경우)

## 출력
- `clients/<client>/analysis_report.md`
- `clients/<client>/analysis_report.json`
- (옵션) `reports/client_analysis_summary_*.md` (전체 고객 분석 시)

## 실행 명령

```bash
# 단일 고객 분석
python scripts/deck_cli.py analyze <client-name>

# 전체 고객 분석
python scripts/deck_cli.py analyze --all
```

## 리포트 핵심 구성
1. 준비도 점수 (Brief/Sources/Storyline/Spec/Execution)
2. 산업별 분석 모듈 추천 (목적/방법론/필요데이터/슬라이드 매핑)
3. 갭 및 리스크 (파일 누락, 근거 연결률, QA 상태)
4. 즉시 실행 액션 플랜

## 완료 기준
- `analysis_report.md`가 생성됨
- 분석 모듈과 슬라이드 매핑이 포함됨
- 최소 1개 이상의 실행 액션이 제시됨
