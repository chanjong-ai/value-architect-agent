# Sources: 포스코퓨처엠 ERP 전략 (2026-02-07 수집)

> 본 문서는 ERP 업그레이드 IT 전략 컨설팅을 위한 공개자료 기반 sources입니다.

## erp-timeline
- [x] SAP ECC EHP 6-8 Mainstream Maintenance: 2027.12.31 종료
- [x] SAP ECC EHP 0-5 Mainstream Maintenance: 2025.12.31 종료
- [x] Extended Maintenance: 2030.12.31까지 (유지보수 비용 약 2%p 추가 부담)
- [x] RISE with SAP을 통한 일부 고객 2033년까지 연장 가능
- [x] Gartner: 2024년 말 기준 SAP ECC 고객 35,000개 중 약 39%(14,000개)만 S/4HANA 전환 완료
- [x] 평균 ERP 전환 소요기간 2-3년, 복잡도에 따라 추가 소요
- [x] Rimini Street: SAP ECC 지원 종료 연장 없음 확인: https://www.riministreet.com/blog/no-extension-to-ecc-support-2027-deadline/
- [x] Kellton: ECC to S/4HANA Migration Guide: https://www.kellton.com/kellton-tech-blog/sap-ecc-s4hana-migration-2027-deadline

## s4hana-vs-ecc
- [x] SAP Press: Key Differences Between SAP ECC and SAP S/4HANA: https://blog.sap-press.com/key-differences-between-sap-ecc-and-sap-s4hana-a-detailed-comparison
- [x] SAP Press: Technical Foundations Comparison: https://blog.sap-press.com/sap-ecc-vs-sap-s4hana-technical-foundations
- [x] Pathlock: SAP ECC vs S/4HANA Complete Guide: https://pathlock.com/blog/sap-ecc-vs-sap-s4hana/
- [x] 핵심 차이: HANA 인메모리 DB, Universal Journal, 실시간 처리, Fiori UX, 간소화된 데이터 모델
- [x] ECC: 다중 DB 지원(Oracle/DB2/SQL Server), 배치 처리, SAP GUI
- [x] S/4HANA: 단일 HANA DB, 실시간 분석, AI/ML 내장, BTP 기반 확장

## clean-core
- [x] SAP Press: S/4HANA Clean Core Principles and Best Practices: https://blog.sap-press.com/sap-s4hana-clean-core-principles-benefits-and-best-practices
- [x] BJIT: 2026 Migration Roadmap & Clean Core Tips: https://bjitgroup.com/blog-details/sap-ecc-to-s-4hana-2026-migration-roadmap-clean-core-tips
- [x] SAP Learning: Introducing the Clean Core Approach: https://learning.sap.com/learning-journeys/practicing-clean-core-extensibility-for-sap-s-4hana-cloud/introducing-the-clean-core-approach
- [x] Fit-to-Standard: 업무 프로세스의 약 80%는 표준으로 처리 가능
- [x] Clean Core 효과: 업그레이드 용이성, TCO 절감, 보안 강화, 혁신 수용 가속

## industry-erp
- [x] Computer Weekly: BASF moves to SAP S/4HANA (2024.12 전략적 파트너십): https://www.computerweekly.com/news/366625052/Sapphire-2025-BASF-evolves-business-with-move-to-SAP-S-4Hana
- [x] Accenture: Chemical Company Reinvention With S/4HANA: https://www.accenture.com/us-en/blogs/chemicals-and-natural-resources-blog/chemical-companies-transform-with-sap-s4hana
- [x] 화학/소재 산업 상위 150개사 중 90% 이상이 SAP ERP 사용
- [x] SAP News: Ecobat - RISE with SAP으로 26개 ERP를 단일 시스템 통합: https://news.sap.com/2021/07/ecobat-rise-with-sap-circular-economy/

## battery-manufacturing
- [x] SAP Community: Battery Manufacturing with SAP Cloud Solutions: https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/battery-manufacturing-with-sap-cloud-solutions-sap-global-battery-practice/ba-p/14115506
- [x] SAP Global Battery Practice: PLM+ERP+MES 통합 솔루션으로 E2E 가시성 확보
- [x] EU Battery Regulation: 배터리 여권(Battery Passport), 원산지 추적, 재활용 함량 보고 필수
- [x] 배터리소재 업계 디지털 트윈, 공정 최적화, 배치 추적 요건 강화

## sap-trends-2026
- [x] i3S: SAP Trends 2026 - Cloud ERP, Sustainability, Compliance: https://www.i3s.es/en/blog/sap-trends-2026-how-cloud-erp-sustainability-and-compliance-redefine-the-digital-enterprise/
- [x] SNP: SAP transformation trends 2026: https://www.snpgroup.com/en/resources/blog/the-key-trends-shaping-sap-transformations-in-2026/
- [x] AI가 S/4HANA 마이그레이션의 핵심 화두 (스코핑부터 최적화까지)
- [x] 2026년 차별화 요소: 프로세스·데이터·규제·지속가능성의 디지털 클라우드 코어 통합

## client-context
- [x] 포스코퓨처엠: 에너지소재 + 기초소재 복합 사업구조
- [x] 해외법인 운영 (한국/북미/중국/유럽)
- [x] 포스코그룹 SAP ECC 기반 운영 (추정)
- [x] Manufacturing Digital: POSCO AI기반 디지털 전환: https://manufacturingdigital.com/articles/how-o9-will-digitally-transform-poscos-planning-processes

## policy-regulation
- [x] EU Battery Regulation (EU) 2023/1542: 배터리 여권, 탄소발자국 보고, 재활용 목표치 규정
- [x] IRA FEOC: 배터리 소재 원산지 추적 및 FEOC 규정 충족 필요
- [x] K-IFRS, K-SOX: 내부회계관리 강화, 데이터 감사 추적성 요구

## notes
- 인터뷰 기반 내용은 일반화하여 사용 (개인 특정 불가)
- 현재 시스템 상세 아키텍처는 별도 제공 전제
- SAP 라이선스/비용 상세는 범위 외
