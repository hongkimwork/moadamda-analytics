# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2025-12-03

---

## 📍 현재 상태

- **시스템 버전**: v051
- **Tracker 버전**: tracker-v047.js
- **프론트**: https://marketingzon.com
- **백엔드**: https://moadamda-analytics.co.kr

---

## 📝 최근 작업 로그 (최신 15개)

| 날짜 | 작업 내용 | 수정 파일 |
|------|---------|----------|
| 2025-12-03 | 구매카드 결제정보 단순화 | PurchaseTimelineItem.jsx |
| 2025-12-03 | 결제금액 컬럼+할인계산 개선 | OrderListPage.jsx, PurchaseTimelineItem.jsx |
| 2025-12-03 | 상품 판매가 표시 버그 수정 | stats.js |
| 2025-12-03 | 구매완료 카드 타임라인 통합 | PurchaseTimelineItem.jsx |
| 2025-12-03 | 입금대기 포함 필터 추가 | OrderListPage.jsx |
| 2025-12-03 | Cafe24 주문 타임존 버그 수정 | cafe24.js |
| 2025-12-03 | 취소/반품 포함 필터 추가 | SearchFilterBar.jsx |
| 2025-12-03 | 구매완료 카드 분리+상세정보 | PurchaseCompleteCard.jsx |
| 2025-12-03 | 주문금액 0원 버그 수정 배포 | cafe24.js |
| 2025-12-03 | 포인트결제/취소주문 표시 개선 | cafe24.js, stats.js, OrderListPage.jsx |
| 2025-12-03 | 트래커 인앱 강화전송+재시도 | tracker-v047.js, track.js |
| 2025-12-03 | 시간대 버그 전체 수정 | stats.js, range.js, creative-performance.js |
| 2025-12-03 | 트래커v047 인앱브라우저 개선 | tracker-v047.js, track.js |
| 2025-12-03 | 긴 여정 좌측 잘림 현상 수정 | OrderDetailPage.jsx |
| 2025-12-01 | 광고클릭 오분류 근본 해결 | track.js, journeyCalculations.js |

---

## 📚 참고

- 개발 환경: `.cursor/rules/dev.mdc`
- 서버 배포: `.cursor/rules/deploy.mdc`
- 데이터 검증: `.cursor/rules/data-validation.mdc`
- DB 구조: `docs/database-structure.md`
- Git: https://github.com/hongkimwork/moadamda-analytics
