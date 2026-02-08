# Layout Blueprint: posco-futurem

- Generated at: 2026-02-08T15:18:21
- Topic: 배터리소재 글로벌 확장 전략
- Page count: 30

## 1) Design Concept & Tone

- Tone: Comparison & Solution
- Keywords: Context Preservation, Knowledge Graph, Zero-copy
- One-line directive: 문제(회색)에서 해결(블루 네트워크)로 시선을 이동시켜, 문맥 보존 데이터가 AI 품질을 결정한다는 메시지를 시각적으로 증명한다.

## 2) Color / Typography / Layout Guide

- Color (problem zone): Cool Gray / dashed border / low saturation
- Color (solution zone): SAP Blue #008FD3 + Teal/Green highlight
- Color (graph zone): Bright node-link network with glow
- Global layout: {'header': '15% (title + governing)', 'body': '70% (problem → visual core → solution)', 'footer': '15% (impact bar + next step)', 'top_right_caption': 'CIO Priority: Data & AI Foundation'}
- Typography: {'title': 'Noto Sans KR 24pt Regular', 'box_heading': 'Noto Sans KR 16pt Regular', 'body': 'Noto Sans KR 12~14pt Regular', 'caption': 'Noto Sans KR 14pt Regular'}

## 3) Slide-by-Slide Blueprint

### Slide 1 — posco-futurem 배터리소재 글로벌 확장 전략
- Section: Cover
- Layout: `cover`
- Top-right tag: Strategic Proposal
- Governing message: 2026-2030 구간에서 posco-futurem의 배터리소재 글로벌 확장 전략를 동시에 달성하기 위한 실행 프레임을 제시합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'normal'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 0}
- Layout recipe:
  - 좌측 상단 로고/브랜드, 중앙 좌측 대제목 2줄, 우측 하단 프레임 문구 배치
  - 제목은 문제정의+가치제안이 동시에 보이도록 구성
- Content prompts:
  - 대제목 1개 + 부제 1개 + 기간 프레임 1개
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 2 — Executive Summary: 핵심 결론과 의사결정 포인트
- Section: Executive
- Layout: `exec_summary`
- Top-right tag: C-Level Decision Summary
- Governing message: 핵심 결론은 단일 해법이 아니라 시장·운영·재무를 연결한 포트폴리오형 접근이며, 단기 실적 방어와 중장기 경쟁우위 확보를 같은 의사결정 체계로 통합해야 합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 핵심 결론 5~7개를 우선순위 순으로 나열
  - 각 불릿에 숫자/근거 출처를 포함하고 실행 시사점을 문장으로 연결
  - 하단에는 100일 실행항목 2개 이상을 콜아웃으로 배치
- Content prompts:
  - 핵심 결론 6~8개를 문장형 불릿으로 작성 (각 90~180자)
  - 각 결론은 근거 지표(수치/기간/출처)를 1개 이상 포함
  - 우선 실행 과제(100일) 2~3개를 하단 바에 배치
- Recommended evidence refs:
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 3 — Section A. 시장·정책·기술 전환 시그널
- Section: External
- Layout: `section_divider`
- Top-right tag: Market & Policy Signal
- Governing message: 외부 환경은 수요/정책/기술 축에서 동시에 변화하고 있으므로, 단일 변수 대응이 아닌 복합 시그널 기반 전략 조정 메커니즘이 필요합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'normal'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 0}
- Layout recipe:
  - 섹션 명칭 + 섹션에서 답해야 할 핵심 질문 1문장
  - 전환 슬라이드이므로 시각 요소는 절제하되 톤 차이를 분명히 설정
- Content prompts:
  - 해당 섹션에서 답할 질문 2개를 서브텍스트로 명시
- Recommended evidence refs:
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
  - https://news.google.com/rss/articles/CBMigAFBVV95cUxPSEtLM0szUkVDZE9DNlFnUWU5VTU2OEVSRXZQZFBFNl9WeHUwVzNDWDFNZkRDX1lDY1lvQmtLSTlGTUJZTmFmMS05aDFob2syY0xVSExSeUUtcmowdFFqczk2R2dZQ19fUWJadEtCVGVmcC1ReXhWLXR6RThQejlxNtIBlAFBVV95cUxPVkYwTWE2czVkTmhjeFBXbU1mWDFqSk54VHltcTVKOHhsT0tMNGlvaGlPY2pyS2xjQ09pbDJpUWlxRVVJai03Y2ZXdEk0a2ZXTUcxYTBPNW5iQUVLbWRjQW9XMW50MGVWcXJ6QW90MncxT2FaU1lDQTIzWlhBeXVPZUp3TmFuM0NCdEJwdFdEWGpuN2NS?oc=5
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 4 — 시장 수요 및 성장 경로: 최신 업데이트
- Section: External
- Layout: `chart_focus`
- Top-right tag: Market & Policy Signal
- Governing message: 외부 환경은 수요/정책/기술 축에서 동시에 변화하고 있으므로, 단일 변수 대응이 아닌 복합 시그널 기반 전략 조정 메커니즘이 필요합니다.
- Layout intent: {'emphasis': 'balanced', 'visual_position': 'right', 'content_density': 'dense'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 6}
- Layout recipe:
  - 차트는 핵심 축 1~2개만 강조하고 우측 설명 패널로 해석 제공
  - 데이터 포인트에는 출처/기준시점을 명시
  - 하단에 의사결정 인사이트를 긴 문장으로 서술
- Content prompts:
  - 차트 해석 불릿 4~5개 + 내러티브 문단 1~2개
  - 차트 캡션에 기준 연도/단위/출처 명시
- Recommended evidence refs:
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
  - https://news.google.com/rss/articles/CBMigAFBVV95cUxPSEtLM0szUkVDZE9DNlFnUWU5VTU2OEVSRXZQZFBFNl9WeHUwVzNDWDFNZkRDX1lDY1lvQmtLSTlGTUJZTmFmMS05aDFob2syY0xVSExSeUUtcmowdFFqczk2R2dZQ19fUWJadEtCVGVmcC1ReXhWLXR6RThQejlxNtIBlAFBVV95cUxPVkYwTWE2czVkTmhjeFBXbU1mWDFqSk54VHltcTVKOHhsT0tMNGlvaGlPY2pyS2xjQ09pbDJpUWlxRVVJai03Y2ZXdEk0a2ZXTUcxYTBPNW5iQUVLbWRjQW9XMW50MGVWcXJ6QW90MncxT2FaU1lDQTIzWlhBeXVPZUp3TmFuM0NCdEJwdFdEWGpuN2NS?oc=5
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 5 — 정책/규제 변화가 수익성에 미치는 영향
- Section: External
- Layout: `chart_focus`
- Top-right tag: Market & Policy Signal
- Governing message: 외부 환경은 수요/정책/기술 축에서 동시에 변화하고 있으므로, 단일 변수 대응이 아닌 복합 시그널 기반 전략 조정 메커니즘이 필요합니다.
- Layout intent: {'emphasis': 'balanced', 'visual_position': 'right', 'content_density': 'dense'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 6}
- Layout recipe:
  - 차트는 핵심 축 1~2개만 강조하고 우측 설명 패널로 해석 제공
  - 데이터 포인트에는 출처/기준시점을 명시
  - 하단에 의사결정 인사이트를 긴 문장으로 서술
- Content prompts:
  - 차트 해석 불릿 4~5개 + 내러티브 문단 1~2개
  - 차트 캡션에 기준 연도/단위/출처 명시
- Recommended evidence refs:
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
  - https://news.google.com/rss/articles/CBMigAFBVV95cUxPSEtLM0szUkVDZE9DNlFnUWU5VTU2OEVSRXZQZFBFNl9WeHUwVzNDWDFNZkRDX1lDY1lvQmtLSTlGTUJZTmFmMS05aDFob2syY0xVSExSeUUtcmowdFFqczk2R2dZQ19fUWJadEtCVGVmcC1ReXhWLXR6RThQejlxNtIBlAFBVV95cUxPVkYwTWE2czVkTmhjeFBXbU1mWDFqSk54VHltcTVKOHhsT0tMNGlvaGlPY2pyS2xjQ09pbDJpUWlxRVVJai03Y2ZXdEk0a2ZXTUcxYTBPNW5iQUVLbWRjQW9XMW50MGVWcXJ6QW90MncxT2FaU1lDQTIzWlhBeXVPZUp3TmFuM0NCdEJwdFdEWGpuN2NS?oc=5
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 6 — 경쟁구도 및 벤치마크 포지션
- Section: External
- Layout: `comparison`
- Top-right tag: Market & Policy Signal
- Governing message: 외부 환경은 수요/정책/기술 축에서 동시에 변화하고 있으므로, 단일 변수 대응이 아닌 복합 시그널 기반 전략 조정 메커니즘이 필요합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 좌측 As-Is(문제), 우측 To-Be(해결)를 대비시키고 기준 KPI를 명시
  - 문제 카드(회색/점선)와 해결 카드(블루/강조) 대비를 시각적으로 유지
  - 중앙 연결 화살표/그래프를 통해 변화 경로를 보여줌
- Content prompts:
  - 좌측 문제(As-Is) 3~4개, 우측 해법(To-Be) 3~4개
  - 중앙 연결 메시지 1개(왜 전환해야 하는지)
  - 하단에 KPI 비교 1줄(현재 vs 목표) + 실행 전환 조건 1문장
- Recommended evidence refs:
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
  - https://news.google.com/rss/articles/CBMigAFBVV95cUxPSEtLM0szUkVDZE9DNlFnUWU5VTU2OEVSRXZQZFBFNl9WeHUwVzNDWDFNZkRDX1lDY1lvQmtLSTlGTUJZTmFmMS05aDFob2syY0xVSExSeUUtcmowdFFqczk2R2dZQ19fUWJadEtCVGVmcC1ReXhWLXR6RThQejlxNtIBlAFBVV95cUxPVkYwTWE2czVkTmhjeFBXbU1mWDFqSk54VHltcTVKOHhsT0tMNGlvaGlPY2pyS2xjQ09pbDJpUWlxRVVJai03Y2ZXdEk0a2ZXTUcxYTBPNW5iQUVLbWRjQW9XMW50MGVWcXJ6QW90MncxT2FaU1lDQTIzWlhBeXVPZUp3TmFuM0NCdEJwdFdEWGpuN2NS?oc=5
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 7 — 공급망/원재료 리스크 구조
- Section: External
- Layout: `content`
- Top-right tag: Market & Policy Signal
- Governing message: 외부 환경은 수요/정책/기술 축에서 동시에 변화하고 있으므로, 단일 변수 대응이 아닌 복합 시그널 기반 전략 조정 메커니즘이 필요합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 상단 제목/거버닝 메시지 이후 본문 2단(불릿+설명 문장) 또는 표+시사점 구성
  - 본문 문장은 축약형이 아닌 보고서형 문장으로 2~3문단 확보
  - 하단 빈 공간은 내러티브 블록 또는 결론 바(bar)로 채움
- Content prompts:
  - 본문 불릿 최소 6개 (각 90~180자)
  - 요약 문단 최소 2개 (각 180~320자)
  - 하단 결론 바 1개 (Expected Value 형식)
- Recommended evidence refs:
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
  - https://news.google.com/rss/articles/CBMigAFBVV95cUxPSEtLM0szUkVDZE9DNlFnUWU5VTU2OEVSRXZQZFBFNl9WeHUwVzNDWDFNZkRDX1lDY1lvQmtLSTlGTUJZTmFmMS05aDFob2syY0xVSExSeUUtcmowdFFqczk2R2dZQ19fUWJadEtCVGVmcC1ReXhWLXR6RThQejlxNtIBlAFBVV95cUxPVkYwTWE2czVkTmhjeFBXbU1mWDFqSk54VHltcTVKOHhsT0tMNGlvaGlPY2pyS2xjQ09pbDJpUWlxRVVJai03Y2ZXdEk0a2ZXTUcxYTBPNW5iQUVLbWRjQW9XMW50MGVWcXJ6QW90MncxT2FaU1lDQTIzWlhBeXVPZUp3TmFuM0NCdEJwdFdEWGpuN2NS?oc=5
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 8 — 외부 환경 종합 시사점
- Section: External
- Layout: `content`
- Top-right tag: Market & Policy Signal
- Governing message: 외부 환경은 수요/정책/기술 축에서 동시에 변화하고 있으므로, 단일 변수 대응이 아닌 복합 시그널 기반 전략 조정 메커니즘이 필요합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 상단 제목/거버닝 메시지 이후 본문 2단(불릿+설명 문장) 또는 표+시사점 구성
  - 본문 문장은 축약형이 아닌 보고서형 문장으로 2~3문단 확보
  - 하단 빈 공간은 내러티브 블록 또는 결론 바(bar)로 채움
- Content prompts:
  - 본문 불릿 최소 6개 (각 90~180자)
  - 요약 문단 최소 2개 (각 180~320자)
  - 하단 결론 바 1개 (Expected Value 형식)
- Recommended evidence refs:
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
  - https://news.google.com/rss/articles/CBMigAFBVV95cUxPSEtLM0szUkVDZE9DNlFnUWU5VTU2OEVSRXZQZFBFNl9WeHUwVzNDWDFNZkRDX1lDY1lvQmtLSTlGTUJZTmFmMS05aDFob2syY0xVSExSeUUtcmowdFFqczk2R2dZQ19fUWJadEtCVGVmcC1ReXhWLXR6RThQejlxNtIBlAFBVV95cUxPVkYwTWE2czVkTmhjeFBXbU1mWDFqSk54VHltcTVKOHhsT0tMNGlvaGlPY2pyS2xjQ09pbDJpUWlxRVVJai03Y2ZXdEk0a2ZXTUcxYTBPNW5iQUVLbWRjQW9XMW50MGVWcXJ6QW90MncxT2FaU1lDQTIzWlhBeXVPZUp3TmFuM0NCdEJwdFdEWGpuN2NS?oc=5
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 9 — Section B. 현황 진단과 핵심 문제정의
- Section: Diagnosis
- Layout: `section_divider`
- Top-right tag: Client Diagnostic
- Governing message: 현재 성과는 구조적 경쟁력과 일시적 요인이 혼재되어 있어, 제품·고객·거점·운영 KPI를 같은 프레임에서 재분해해야 실질적 개선 우선순위를 도출할 수 있습니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'normal'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 0}
- Layout recipe:
  - 섹션 명칭 + 섹션에서 답해야 할 핵심 질문 1문장
  - 전환 슬라이드이므로 시각 요소는 절제하되 톤 차이를 분명히 설정
- Content prompts:
  - 해당 섹션에서 답할 질문 2개를 서브텍스트로 명시
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 10 — 사업 포트폴리오 및 수익 구조 진단
- Section: Diagnosis
- Layout: `three_column`
- Top-right tag: Client Diagnostic
- Governing message: 현재 성과는 구조적 경쟁력과 일시적 요인이 혼재되어 있어, 제품·고객·거점·운영 KPI를 같은 프레임에서 재분해해야 실질적 개선 우선순위를 도출할 수 있습니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 3축(시장/경쟁/내부역량 또는 전략옵션 A/B/C) 비교
  - 각 컬럼은 제목+핵심 불릿 2~3개+시사점 1문장으로 균형 구성
- Content prompts:
  - 컬럼당 핵심 메시지 2~3개 + 실행 시사점 1문장
  - 컬럼 하단에는 공통 KPI 또는 리스크 주석을 추가
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 11 — 재무/운영 KPI 트렌드 점검
- Section: Diagnosis
- Layout: `chart_focus`
- Top-right tag: Client Diagnostic
- Governing message: 현재 성과는 구조적 경쟁력과 일시적 요인이 혼재되어 있어, 제품·고객·거점·운영 KPI를 같은 프레임에서 재분해해야 실질적 개선 우선순위를 도출할 수 있습니다.
- Layout intent: {'emphasis': 'balanced', 'visual_position': 'right', 'content_density': 'dense'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 6}
- Layout recipe:
  - 차트는 핵심 축 1~2개만 강조하고 우측 설명 패널로 해석 제공
  - 데이터 포인트에는 출처/기준시점을 명시
  - 하단에 의사결정 인사이트를 긴 문장으로 서술
- Content prompts:
  - 차트 해석 불릿 4~5개 + 내러티브 문단 1~2개
  - 차트 캡션에 기준 연도/단위/출처 명시
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 12 — 가치사슬 병목과 개선 여지
- Section: Diagnosis
- Layout: `content`
- Top-right tag: Client Diagnostic
- Governing message: 현재 성과는 구조적 경쟁력과 일시적 요인이 혼재되어 있어, 제품·고객·거점·운영 KPI를 같은 프레임에서 재분해해야 실질적 개선 우선순위를 도출할 수 있습니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 상단 제목/거버닝 메시지 이후 본문 2단(불릿+설명 문장) 또는 표+시사점 구성
  - 본문 문장은 축약형이 아닌 보고서형 문장으로 2~3문단 확보
  - 하단 빈 공간은 내러티브 블록 또는 결론 바(bar)로 채움
- Content prompts:
  - 본문 불릿 최소 6개 (각 90~180자)
  - 요약 문단 최소 2개 (각 180~320자)
  - 하단 결론 바 1개 (Expected Value 형식)
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 13 — 고객/제품/지역 포트폴리오 평가
- Section: Diagnosis
- Layout: `three_column`
- Top-right tag: Client Diagnostic
- Governing message: 현재 성과는 구조적 경쟁력과 일시적 요인이 혼재되어 있어, 제품·고객·거점·운영 KPI를 같은 프레임에서 재분해해야 실질적 개선 우선순위를 도출할 수 있습니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 3축(시장/경쟁/내부역량 또는 전략옵션 A/B/C) 비교
  - 각 컬럼은 제목+핵심 불릿 2~3개+시사점 1문장으로 균형 구성
- Content prompts:
  - 컬럼당 핵심 메시지 2~3개 + 실행 시사점 1문장
  - 컬럼 하단에는 공통 KPI 또는 리스크 주석을 추가
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 14 — 운영 거점·공급망 구조 시각화
- Section: Diagnosis
- Layout: `image_focus`
- Top-right tag: Client Diagnostic
- Governing message: 현재 성과는 구조적 경쟁력과 일시적 요인이 혼재되어 있어, 제품·고객·거점·운영 KPI를 같은 프레임에서 재분해해야 실질적 개선 우선순위를 도출할 수 있습니다.
- Layout intent: {'emphasis': 'balanced', 'visual_position': 'right', 'content_density': 'dense'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 6}
- Layout recipe:
  - 지도/네트워크/아키텍처 이미지를 메인 비주얼로 배치
  - 우측/하단 카드에서 기술적 의미와 실행 시사점을 연결
- Content prompts:
  - 메인 비주얼 해석 불릿 4~5개 + 내러티브 문단 1~2개
  - 이미지 위/옆에 핵심 라벨(노드/흐름/관계) 부여
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 15 — 자회사/사업부 성과 분해
- Section: Diagnosis
- Layout: `content`
- Top-right tag: Client Diagnostic
- Governing message: 현재 성과는 구조적 경쟁력과 일시적 요인이 혼재되어 있어, 제품·고객·거점·운영 KPI를 같은 프레임에서 재분해해야 실질적 개선 우선순위를 도출할 수 있습니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 상단 제목/거버닝 메시지 이후 본문 2단(불릿+설명 문장) 또는 표+시사점 구성
  - 본문 문장은 축약형이 아닌 보고서형 문장으로 2~3문단 확보
  - 하단 빈 공간은 내러티브 블록 또는 결론 바(bar)로 채움
- Content prompts:
  - 본문 불릿 최소 6개 (각 90~180자)
  - 요약 문단 최소 2개 (각 180~320자)
  - 하단 결론 바 1개 (Expected Value 형식)
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 16 — 경쟁사 대비 강점/열위 비교
- Section: Diagnosis
- Layout: `comparison`
- Top-right tag: Client Diagnostic
- Governing message: 현재 성과는 구조적 경쟁력과 일시적 요인이 혼재되어 있어, 제품·고객·거점·운영 KPI를 같은 프레임에서 재분해해야 실질적 개선 우선순위를 도출할 수 있습니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 좌측 As-Is(문제), 우측 To-Be(해결)를 대비시키고 기준 KPI를 명시
  - 문제 카드(회색/점선)와 해결 카드(블루/강조) 대비를 시각적으로 유지
  - 중앙 연결 화살표/그래프를 통해 변화 경로를 보여줌
- Content prompts:
  - 좌측 문제(As-Is) 3~4개, 우측 해법(To-Be) 3~4개
  - 중앙 연결 메시지 1개(왜 전환해야 하는지)
  - 하단에 KPI 비교 1줄(현재 vs 목표) + 실행 전환 조건 1문장
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 17 — 핵심 진단 요약 및 전략적 함의
- Section: Diagnosis
- Layout: `process_flow`
- Top-right tag: Client Diagnostic
- Governing message: 현재 성과는 구조적 경쟁력과 일시적 요인이 혼재되어 있어, 제품·고객·거점·운영 KPI를 같은 프레임에서 재분해해야 실질적 개선 우선순위를 도출할 수 있습니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 6}
- Layout recipe:
  - 문제 발생 지점 → 개선 액션 → 기대효과를 단계 흐름으로 시각화
  - 단계별 소유 조직과 KPI를 병기해 실행 가능성 확보
- Content prompts:
  - Step 4~5개, 단계별 병목/개선/효과를 한 세트로 작성
  - 마지막 단계에 성과지표 및 모니터링 루프 추가
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 18 — Section C. 전략 옵션 설계와 가치 검증
- Section: Options
- Layout: `content`
- Top-right tag: Option & Value Validation
- Governing message: 전략 옵션은 상호배타가 아니라 조합 설계 대상이며, 옵션별 기대효과·난이도·리스크를 정량화해 단계적으로 자본과 실행역량을 배분해야 합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 상단 제목/거버닝 메시지 이후 본문 2단(불릿+설명 문장) 또는 표+시사점 구성
  - 본문 문장은 축약형이 아닌 보고서형 문장으로 2~3문단 확보
  - 하단 빈 공간은 내러티브 블록 또는 결론 바(bar)로 채움
- Content prompts:
  - 본문 불릿 최소 6개 (각 90~180자)
  - 요약 문단 최소 2개 (각 180~320자)
  - 하단 결론 바 1개 (Expected Value 형식)
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 19 — 전략 옵션 포트폴리오(Option A/B/C)
- Section: Options
- Layout: `section_divider`
- Top-right tag: Option & Value Validation
- Governing message: 전략 옵션은 상호배타가 아니라 조합 설계 대상이며, 옵션별 기대효과·난이도·리스크를 정량화해 단계적으로 자본과 실행역량을 배분해야 합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'normal'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 0}
- Layout recipe:
  - 섹션 명칭 + 섹션에서 답해야 할 핵심 질문 1문장
  - 전환 슬라이드이므로 시각 요소는 절제하되 톤 차이를 분명히 설정
- Content prompts:
  - 해당 섹션에서 답할 질문 2개를 서브텍스트로 명시
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 20 — 옵션 평가 매트릭스(효과 vs 실행난이도)
- Section: Options
- Layout: `three_column`
- Top-right tag: Option & Value Validation
- Governing message: 전략 옵션은 상호배타가 아니라 조합 설계 대상이며, 옵션별 기대효과·난이도·리스크를 정량화해 단계적으로 자본과 실행역량을 배분해야 합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 3축(시장/경쟁/내부역량 또는 전략옵션 A/B/C) 비교
  - 각 컬럼은 제목+핵심 불릿 2~3개+시사점 1문장으로 균형 구성
- Content prompts:
  - 컬럼당 핵심 메시지 2~3개 + 실행 시사점 1문장
  - 컬럼 하단에는 공통 KPI 또는 리스크 주석을 추가
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 21 — Value Case: 매출 성장 시나리오
- Section: Options
- Layout: `comparison`
- Top-right tag: Option & Value Validation
- Governing message: 전략 옵션은 상호배타가 아니라 조합 설계 대상이며, 옵션별 기대효과·난이도·리스크를 정량화해 단계적으로 자본과 실행역량을 배분해야 합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 좌측 As-Is(문제), 우측 To-Be(해결)를 대비시키고 기준 KPI를 명시
  - 문제 카드(회색/점선)와 해결 카드(블루/강조) 대비를 시각적으로 유지
  - 중앙 연결 화살표/그래프를 통해 변화 경로를 보여줌
- Content prompts:
  - 좌측 문제(As-Is) 3~4개, 우측 해법(To-Be) 3~4개
  - 중앙 연결 메시지 1개(왜 전환해야 하는지)
  - 하단에 KPI 비교 1줄(현재 vs 목표) + 실행 전환 조건 1문장
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 22 — Value Case: 수익성 회복 시나리오
- Section: Options
- Layout: `chart_focus`
- Top-right tag: Option & Value Validation
- Governing message: 전략 옵션은 상호배타가 아니라 조합 설계 대상이며, 옵션별 기대효과·난이도·리스크를 정량화해 단계적으로 자본과 실행역량을 배분해야 합니다.
- Layout intent: {'emphasis': 'balanced', 'visual_position': 'right', 'content_density': 'dense'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 6}
- Layout recipe:
  - 차트는 핵심 축 1~2개만 강조하고 우측 설명 패널로 해석 제공
  - 데이터 포인트에는 출처/기준시점을 명시
  - 하단에 의사결정 인사이트를 긴 문장으로 서술
- Content prompts:
  - 차트 해석 불릿 4~5개 + 내러티브 문단 1~2개
  - 차트 캡션에 기준 연도/단위/출처 명시
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 23 — CAPEX·자본배분 우선순위
- Section: Options
- Layout: `chart_focus`
- Top-right tag: Option & Value Validation
- Governing message: 전략 옵션은 상호배타가 아니라 조합 설계 대상이며, 옵션별 기대효과·난이도·리스크를 정량화해 단계적으로 자본과 실행역량을 배분해야 합니다.
- Layout intent: {'emphasis': 'balanced', 'visual_position': 'right', 'content_density': 'dense'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 6}
- Layout recipe:
  - 차트는 핵심 축 1~2개만 강조하고 우측 설명 패널로 해석 제공
  - 데이터 포인트에는 출처/기준시점을 명시
  - 하단에 의사결정 인사이트를 긴 문장으로 서술
- Content prompts:
  - 차트 해석 불릿 4~5개 + 내러티브 문단 1~2개
  - 차트 캡션에 기준 연도/단위/출처 명시
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 24 — 리스크 완화 아키텍처
- Section: Options
- Layout: `content`
- Top-right tag: Option & Value Validation
- Governing message: 전략 옵션은 상호배타가 아니라 조합 설계 대상이며, 옵션별 기대효과·난이도·리스크를 정량화해 단계적으로 자본과 실행역량을 배분해야 합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 상단 제목/거버닝 메시지 이후 본문 2단(불릿+설명 문장) 또는 표+시사점 구성
  - 본문 문장은 축약형이 아닌 보고서형 문장으로 2~3문단 확보
  - 하단 빈 공간은 내러티브 블록 또는 결론 바(bar)로 채움
- Content prompts:
  - 본문 불릿 최소 6개 (각 90~180자)
  - 요약 문단 최소 2개 (각 180~320자)
  - 하단 결론 바 1개 (Expected Value 형식)
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 25 — 권고안 통합 및 의사결정 포인트
- Section: Options
- Layout: `process_flow`
- Top-right tag: Option & Value Validation
- Governing message: 전략 옵션은 상호배타가 아니라 조합 설계 대상이며, 옵션별 기대효과·난이도·리스크를 정량화해 단계적으로 자본과 실행역량을 배분해야 합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 6}
- Layout recipe:
  - 문제 발생 지점 → 개선 액션 → 기대효과를 단계 흐름으로 시각화
  - 단계별 소유 조직과 KPI를 병기해 실행 가능성 확보
- Content prompts:
  - Step 4~5개, 단계별 병목/개선/효과를 한 세트로 작성
  - 마지막 단계에 성과지표 및 모니터링 루프 추가
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
  - https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 26 — Section D. 실행 로드맵과 거버넌스
- Section: Execution
- Layout: `section_divider`
- Top-right tag: Execution Governance
- Governing message: 실행 성패는 계획의 화려함이 아니라 거버넌스·데이터·책임체계의 정합성에 달려 있으므로, 분기별 리뷰와 게이트 의사결정을 통해 전략을 지속 보정해야 합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'normal'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 0}
- Layout recipe:
  - 섹션 명칭 + 섹션에서 답해야 할 핵심 질문 1문장
  - 전환 슬라이드이므로 시각 요소는 절제하되 톤 차이를 분명히 설정
- Content prompts:
  - 해당 섹션에서 답할 질문 2개를 서브텍스트로 명시
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 27 — First 100 Days 실행계획
- Section: Execution
- Layout: `timeline`
- Top-right tag: Execution Governance
- Governing message: 실행 성패는 계획의 화려함이 아니라 거버넌스·데이터·책임체계의 정합성에 달려 있으므로, 분기별 리뷰와 게이트 의사결정을 통해 전략을 지속 보정해야 합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 6}
- Layout recipe:
  - Phase별 목표/KPI/책임조직을 동시에 표기
  - 100일-1년-3년 등 시간축과 의사결정 게이트를 함께 표시
- Content prompts:
  - Phase 3~5개, 각 Phase별 목표/KPI/오너 표기
  - 리스크 게이트와 의사결정 시점을 함께 표기
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 28 — 2026-2030 단계별 실행 로드맵
- Section: Execution
- Layout: `process_flow`
- Top-right tag: Execution Governance
- Governing message: 실행 성패는 계획의 화려함이 아니라 거버넌스·데이터·책임체계의 정합성에 달려 있으므로, 분기별 리뷰와 게이트 의사결정을 통해 전략을 지속 보정해야 합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 6}
- Layout recipe:
  - 문제 발생 지점 → 개선 액션 → 기대효과를 단계 흐름으로 시각화
  - 단계별 소유 조직과 KPI를 병기해 실행 가능성 확보
- Content prompts:
  - Step 4~5개, 단계별 병목/개선/효과를 한 세트로 작성
  - 마지막 단계에 성과지표 및 모니터링 루프 추가
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 29 — 거버넌스/KPI 대시보드 설계
- Section: Execution
- Layout: `content`
- Top-right tag: Execution Governance
- Governing message: 실행 성패는 계획의 화려함이 아니라 거버넌스·데이터·책임체계의 정합성에 달려 있으므로, 분기별 리뷰와 게이트 의사결정을 통해 전략을 지속 보정해야 합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'dense'}
- Density target: {'min_body_chars': 700, 'min_paragraphs': 7, 'min_bullets': 6}
- Layout recipe:
  - 상단 제목/거버닝 메시지 이후 본문 2단(불릿+설명 문장) 또는 표+시사점 구성
  - 본문 문장은 축약형이 아닌 보고서형 문장으로 2~3문단 확보
  - 하단 빈 공간은 내러티브 블록 또는 결론 바(bar)로 채움
- Content prompts:
  - 본문 불릿 최소 6개 (각 90~180자)
  - 요약 문단 최소 2개 (각 180~320자)
  - 하단 결론 바 1개 (Expected Value 형식)
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

### Slide 30 — 결론 및 다음 단계
- Section: Execution
- Layout: `thank_you`
- Top-right tag: Execution Governance
- Governing message: 실행 성패는 계획의 화려함이 아니라 거버넌스·데이터·책임체계의 정합성에 달려 있으므로, 분기별 리뷰와 게이트 의사결정을 통해 전략을 지속 보정해야 합니다.
- Layout intent: {'emphasis': 'content', 'content_density': 'normal'}
- Density target: {'min_body_chars': 560, 'min_paragraphs': 5, 'min_bullets': 0}
- Layout recipe:
  - 결론 1문장 + 즉시 의사결정 요청 1문장
  - 다음 액션/워크숍 일정 등 실무 연결 문구 포함
- Content prompts:
  - 결론 1문장 + 다음 단계 1문장 + 연락 포인트
- Recommended evidence refs:
  - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- Quality checks:
  - 제목/거버닝/본문이 동일 주장으로 정렬되어 있는지 확인
  - 본문 하단 공백이 과도하지 않도록 내러티브 또는 결론 바로 채움
  - 아이콘/도형/차트 캡션의 의미가 본문 주장과 일치하는지 검증

## 4) Designer Checklist

- 좌측 문제 영역은 정적/단절 느낌, 우측 해결 영역은 연결/확장 느낌으로 대비
- 중앙 그래프는 추상 점이 아니라 비즈니스 객체 노드(고객/오더/납품/청구/수금)로 구성
- 우측 해결 카드에는 Zero-copy/Data Product/Semantic Onboarding 3요소를 분리 기재

