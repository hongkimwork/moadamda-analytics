# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2025-11-27

---

## 📍 현재 상태

- **시스템 버전**: v049
- **Tracker 버전**: tracker-v044.js
- **프론트**: https://marketingzon.com
- **백엔드**: https://moadamda-analytics.co.kr

---

## 📝 최근 작업 로그 (최신 15개)

| 날짜 | 작업 내용 | 수정 파일 |
|------|---------|----------|
| 2025-11-27 | 상품수 계산 로직 수정 (quantity 합산) | cafe24.js |
| 2025-11-27 | 주문목록 상품수/재구매 컬럼 추가 | OrderAnalysis.jsx |
| 2025-11-27 | 주문 분석2 페이지 제거 | App.jsx |
| 2025-11-27 | 미니카드 전체표시+RangePicker | OrderAnalysis.jsx |
| 2025-11-27 | 여정 카드 열 단계 6→4 변경 | OrderAnalysis.jsx |
| 2025-11-27 | Cafe24 실시간 주문 동기화 | track.js, cafe24.js |
| 2025-11-27 | 주문시간 KST 일관성 수정 | stats.js |
| 2025-11-26 | 0원 주문 제외 필터 구현 | orders.js |
| 2025-11-26 | 상품명 DB 저장 및 마이그레이션 | stats.js |
| 2025-11-26 | visitor_id 백필 API 추가 | cafe24.js |
| 2025-11-26 | 자동 동기화 및 visitor 매칭 | cafe24.js |
| 2025-11-26 | Cafe24 API 연동 구현 | cafe24.js |
| 2025-11-25 | 필터에서 viral 제외 처리 | DynamicUtmFilterBar.jsx |
| 2025-11-25 | 퀵필터 바이럴 제거/추가버튼 수정 | UtmSourceQuickFilter.jsx |
| 2025-11-25 | UTM Source 퀵 필터 추가 | UtmSourceQuickFilter.jsx |

---

## 📚 참고

- 개발 환경: `.cursor/rules/dev.mdc`
- 서버 배포: `.cursor/rules/deploy.mdc`
- 데이터 검증: `.cursor/rules/data-validation.mdc`
- DB 구조: `docs/database-structure.md`
- Git: https://github.com/hongkimwork/moadamda-analytics
