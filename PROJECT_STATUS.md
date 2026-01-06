# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2026-01-06

---

## 📍 현재 상태

- **시스템 버전**: v052
- **Tracker 버전**: tracker-v049.js
- **프론트**: https://marketingzon.com
- **백엔드**: https://moadamda-analytics.co.kr

---

## 📝 최근 작업 로그 (최신 15개)

| 날짜 | 작업 내용 | 수정 파일 |
|------|---------|----------|
| 2026-01-06 | 모수평가점수 UV제외 변경 | formatters.js |
| 2026-01-06 | 여정상세→고객여정모달 연동 | CreativeOrdersModal.jsx |
| 2026-01-06 | 주문모달 노출일시 컬럼추가 | CreativeOrdersModal.jsx |
| 2026-01-06 | 스크롤 깊이 추적 추가 | tracker-v049.js |
| 2026-01-06 | 검증 기능 개선 | TestResultModal.jsx |
| 2026-01-05 | 페이지네이션 초기화 수정 | RawDataModal.jsx |
| 2026-01-05 | 광고소재 분석 배포완료 | creative-performance.js |
| 2026-01-05 | Raw Data 검증 기능 추가 | RawDataModal.jsx |
| 2026-01-05 | 기여매출액 계산버그 수정 | creativeAttribution.js |
| 2026-01-05 | 유입가치 툴팁 개선 | PerformanceTable.jsx |
| 2026-01-05 | UTM 컬럼 너비 축소 | PerformanceTable.jsx |
| 2026-01-05 | 소재 비교 기능 제거 | PerformanceTable.jsx |
| 2026-01-05 | 1명당 유입가치 컬럼 추가 | PerformanceTable.jsx |
| 2025-12-29 | URL정규화 버그 수정 | urlCleaner.js |
| 2025-12-29 | 테이블 스타일 개선 | PerformanceTable.jsx |

---

## 📚 참고

- **✨ 다음 개발**: `CHANNEL_FUNNEL_PRD.md` (채널별 전환 퍼널 위젯 개발 명세서)
- 개발 계획: `CHANNEL_PERFORMANCE_PLAN.md` (초기 유입 채널 성과 분석 계획서)
- 개발 환경: `.cursor/rules/dev.mdc`
- 서버 배포: `.cursor/rules/deploy.mdc`
- 데이터 검증: `.cursor/rules/data-validation.mdc`
- DB 구조: `docs/database-structure.md`
- Git: https://github.com/hongkimwork/moadamda-analytics
- ⚠️ `moadamda-access-log/` 폴더는 다른 개발자가 만든 레퍼런스 프로젝트이며, 현재 프로젝트에 연동되어 있지 않음
