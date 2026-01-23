# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2026-01-20

---

## 📍 현재 상태

- **시스템 버전**: v055
- **Tracker 버전**: tracker-v051.js
- **프론트**: https://marketingzon.com
- **백엔드**: https://moadamda-analytics.co.kr

---

## 📝 최근 작업 로그 (최신 15개)

| 날짜 | 작업 내용 | 수정 파일 |
|------|---------|----------|
| 2026-01-23 | 광고 소재 성과 개선 배포 | creative-performance.js |
| 2026-01-23 | 세션PV→총PV 컬럼명 변경 | CreativeOrdersModal.jsx |
| 2026-01-23 | 평균스크롤 합계방식 변경 | creativeRepository.js |
| 2026-01-23 | 세션모달 스크롤컬럼 추가 | CreativeSessionsModal.jsx |
| 2026-01-23 | View/UV 모달 분리 | CreativeEntriesModal.jsx |
| 2026-01-23 | 취소주문 기여도 제외 | creativeAttribution.js |
| 2026-01-23 | View를 진입횟수로 변경 | creativeRepository.js |
| 2026-01-23 | 광고귀속 인앱대응 추가 | creativeAttribution.js |
| 2026-01-23 | 인앱브라우저 UTM 복구 | ordersRepository.js |
| 2026-01-22 | 평균PV 중복계산 버그 수정 | creativeRepository.js |
| 2026-01-22 | 광고 성과 정렬 수정 | creativeService.js |
| 2026-01-22 | 메타광고명 병합 기능 | metaAdNameMapping.js |
| 2026-01-21 | 카페24 중복제거 건수 표시 | OurDataCompare/index.jsx |
| 2026-01-21 | 요약 카드 순서 변경 | OurDataCompare/index.jsx |
| 2026-01-21 | 탭 변경 시 페이지 리셋 | OurDataCompare/index.jsx |

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
