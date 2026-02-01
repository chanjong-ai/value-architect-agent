# Skill: Polish (PPT 편집/다듬기)

## 목적
렌더링된 PPTX를 미세 편집하여 완성도를 높입니다.
하이브리드 렌더 워크플로우의 마지막 단계입니다.

## 호출
```
/polish <client>
```

## 전제조건
- 렌더링된 PPTX 파일이 `clients/<client>/outputs/`에 존재
- QA 보고서 (선택사항)

## 절차

### 1. 현재 상태 확인
```python
# 가장 최근 PPTX 파일 확인
outputs = clients/{client}/outputs/*.pptx
qa_report = clients/{client}/outputs/*_qa_report.json
```

### 2. QA 이슈 기반 편집 계획 수립
QA 보고서가 있으면 자동 수정 가능한 이슈 식별:
- **폰트 불일치**: Noto Sans KR로 통일
- **불릿 길이 초과**: 문장 다듬기
- **밀도 경고**: 슬라이드 분할 제안

### 3. 미세 편집 수행
python-pptx를 사용하여:

```python
from pptx import Presentation
from pptx.util import Pt
from pptx.dml.color import RgbColor

prs = Presentation(pptx_path)

for slide in prs.slides:
    for shape in slide.shapes:
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                for run in para.runs:
                    # 폰트 통일
                    run.font.name = "Noto Sans KR"

                    # 문장 다듬기 (Claude가 판단)
                    # - 불필요한 조사 제거
                    # - 간결한 표현으로 수정
```

### 4. 편집 내용 기록
```yaml
# clients/{client}/polish_log.yaml
timestamp: 2024-01-15T10:30:00
source_pptx: "{client}_20240115_103000.pptx"
output_pptx: "{client}_20240115_103000_polished.pptx"
changes:
  - slide: 3
    type: font_fix
    detail: "Arial → Noto Sans KR"
  - slide: 5
    type: text_edit
    original: "현재 시장 상황을 분석해 보면 다음과 같은 특징이 있습니다"
    edited: "시장 상황 분석 결과"
  - slide: 7
    type: bullet_split
    detail: "80자 초과 불릿을 2개로 분할"
```

### 5. 저장 및 보고
- 원본 보존: `{client}_YYYYMMDD_HHMMSS.pptx`
- 편집본 생성: `{client}_YYYYMMDD_HHMMSS_polished.pptx`
- 편집 로그: `polish_log.yaml`

## 편집 가이드라인

### 문장 다듬기 원칙
1. **간결성**: "~하는 것이 필요합니다" → "~필요"
2. **능동태**: "~되었습니다" → "~했습니다"
3. **불필요한 조사 제거**: "현재의 시장에서" → "현재 시장에서"
4. **숫자 강조**: "약 30%" → "~30%"

### 편집하지 않는 것
- 거버닝 메시지의 핵심 의미
- 데이터/수치
- 고유명사
- 출처 표기

## 입력
- `clients/<client>/outputs/*.pptx` (최신)
- `clients/<client>/outputs/*_qa_report.json` (선택)

## 출력
- `clients/<client>/outputs/*_polished.pptx`
- `clients/<client>/polish_log.yaml`

## 완료 조건
- [ ] 원본 PPTX 백업 보존
- [ ] 폰트 통일 완료
- [ ] QA 이슈 중 자동 수정 가능 항목 처리
- [ ] 편집 로그 작성

## 사용 예시

### 기본 사용
```
/polish acme-demo
```

### 특정 파일 지정
```
/polish acme-demo --pptx acme-demo_20240115_103000.pptx
```

### 미리보기 (실제 수정 없음)
```
/polish acme-demo --dry-run
```

## 하이브리드 렌더 전체 워크플로우

```
[Spec 작성] → [validate] → [render] → [qa] → [polish]
     ↓            ↓           ↓         ↓        ↓
deck_spec.yaml  검증      1차 PPTX   QA보고서  최종 PPTX
```

명령어:
```bash
# 전체 파이프라인 (validate → render → qa)
python scripts/deck_cli.py full-pipeline <client>

# Polish는 별도 실행 (Claude Code 대화형)
/polish <client>
```

## 참고
- `/qa` 스킬과 연계하여 사용
- 대량 편집보다는 미세 조정에 적합
- 원본 보존 원칙 준수
