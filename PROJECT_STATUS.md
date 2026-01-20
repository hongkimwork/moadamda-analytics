# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2026-01-19

---

## 📍 현재 상태

- **시스템 버전**: v054
- **Tracker 버전**: tracker-v051.js
- **프론트**: https://marketingzon.com
- **백엔드**: https://moadamda-analytics.co.kr

---

## 📝 최근 작업 로그 (최신 15개)

| 날짜 | 작업 내용 | 수정 파일 |
|------|---------|----------|
| 2026-01-19 | 봇감지 로직 강화 | utils.js, repository.js |
| 2026-01-19 | 비교분석 다중기준 | VisitorAnalysis/index.jsx |
| 2026-01-19 | 상세 모달 크기 확대 | VisitorAnalysis/index.jsx |
| 2026-01-19 | 카페24 비교분석 기능 | VisitorAnalysis/index.jsx |
| 2026-01-19 | 상세 모달 컬럼 제거 | VisitorAnalysis/index.jsx |
| 2026-01-19 | 순방문자 상세 모달 | VisitorAnalysis/index.jsx |
| 2026-01-19 | 타임존 이중변환 수정 | fix_kst_timezone.sql |
| 2026-01-19 | KST 타임존 적용 | fix_kst_timezone.sql |
| 2026-01-19 | 순방문자수 페이지 | VisitorAnalysis/index.jsx |
| 2026-01-19 | 세션2시간+쿠키1년 | tracker-v051.js |
| 2026-01-19 | 카페24 체류시간 필터 | update_cafe24_views.sql |
| 2026-01-17 | SSH 보안 강화 완료 | deploy.mdc |
| 2026-01-16 | 모수평가 스크롤 반영 | formatters.js |
| 2026-01-16 | 평균 스크롤 컬럼 추가 | PerformanceTable.jsx |
| 2026-01-15 | 메뉴 위치 변경 | App.jsx |

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
