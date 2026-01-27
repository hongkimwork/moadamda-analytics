# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2026-01-27

---

## 📍 현재 상태

- **시스템 버전**: v055
- **Tracker 버전**: tracker-v052.js
- **프론트**: https://marketingzon.com
- **백엔드**: https://moadamda-analytics.co.kr

---

## 📝 최근 작업 로그 (최신 15개)

| 날짜 | 작업 내용 | 수정 파일 |
|------|---------|----------|
| 2026-01-27 | 원본URL 빈문자열 버그수정 | detailService.js |
| 2026-01-27 | 트래커 UTM % 파싱 수정 | tracker-v052.js |
| 2026-01-27 | 소재상세 모달 여정컬럼 삭제 | CreativeOrdersModal.jsx |
| 2026-01-27 | 여정 중복제거 시간간격 버그수정 | dataTransform.js |
| 2026-01-27 | 광고접촉/여정 불일치 해결 | detailRepository.js |
| 2026-01-27 | 고객여정 날짜표시 버그수정 | ordersService.js |
| 2026-01-26 | 모수평가 설정 기능 추가 | ScoreSettingsModal.jsx |
| 2026-01-26 | 이상치필터 확장(PV/스크롤) | PerformanceFilters.jsx |
| 2026-01-26 | 점수계산 로직 개선 | formatters.js |
| 2026-01-26 | 여정카드 요약정보 추가 | JourneyMiniCard.jsx |
| 2026-01-26 | 세션모달 UV/세션수 표시 | CreativeSessionsModal.jsx |
| 2026-01-26 | 소재 모달 지표 색상/크기 조정 | CreativeOrdersModal.jsx |
| 2026-01-26 | 소재 상세 모달 디자인 변경 | CreativeOrdersModal.jsx |
| 2026-01-26 | 광고 성과 테이블 컬럼 변경 | PerformanceTable.jsx |
| 2026-01-23 | 광고 소재 성과 개선 배포 | creative-performance.js |

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
