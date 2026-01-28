# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2026-01-28

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
| 2026-01-28 | 광고성과 미사용코드 정리 | creative-performance.js |
| 2026-01-28 | 세션상세 테이블 정렬기능 | CreativeSessionsModal.jsx |
| 2026-01-28 | 상대평가 백분위 방식 추가 | ScoreSettingsModal.jsx |
| 2026-01-28 | 점수 툴팁 및 View/UV 계산 | formatters.js |
| 2026-01-28 | 모수평가 UI 레이아웃 수정 | ScoreSettingsCard.jsx |
| 2026-01-28 | View/UV 지표 선택 기능 | ScoreSettingsModal.jsx |
| 2026-01-28 | 점수계산 데이터없음 차감로직 | formatters.js |
| 2026-01-28 | Top5 카드 설정 연동 | InsightCards.jsx |
| 2026-01-27 | 배포매뉴얼 경로 오류 수정 | deploy.mdc |
| 2026-01-27 | 배포매뉴얼 컨테이너 재시작 추가 | deploy.mdc |
| 2026-01-27 | 모수 구간 추가/삭제 기능 | ScoreSettingsModal.jsx |
| 2026-01-27 | 모수모달 위치 상단 조정 | ScoreSettingsModal.jsx |
| 2026-01-27 | 모수설정 모달 높이/스크롤 수정 | ScoreSettingsModal.jsx |
| 2026-01-27 | 백엔드/프론트 재빌드 | docker-compose |
| 2026-01-27 | URL utm_content 디코딩 추가 | detailService.js |

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
