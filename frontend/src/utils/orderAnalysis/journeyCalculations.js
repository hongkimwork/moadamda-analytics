/**
 * 고객 여정 계산 유틸리티
 * OrderAnalysis 페이지에서 사용하는 여정 관련 계산 함수들
 */

import dayjs from 'dayjs';
import { removeConcecutiveDuplicates, formatDuration } from './dataTransform';

/**
 * 페이지 배열에 광고 유입 시점 표시 추가
 * UTM 세션 entry_time과 페이지 timestamp를 비교하여 광고 클릭 직후 첫 페이지에 마킹
 * @param {Array} pages - 페이지 배열
 * @param {Array} utmHistory - UTM 히스토리 배열
 * @returns {Array} 광고 유입 시점이 표시된 페이지 배열
 */
function markAdEntryPoints(pages, utmHistory) {
  if (!pages || pages.length === 0 || !utmHistory || utmHistory.length === 0) {
    return pages;
  }

  // UTM 세션 entry_time을 Date 객체로 변환
  const utmEntryTimes = utmHistory.map(utm => ({
    entryTime: new Date(utm.entry_time),
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    utm_content: utm.utm_content,
    entry_time: utm.entry_time
  }));

  // 각 페이지에 광고 유입 시점 표시
  return pages.map((page, idx) => {
    const pageTime = new Date(page.timestamp);
    
    // 이 페이지가 UTM 세션 시작 직후인지 확인
    // (UTM entry_time과 페이지 timestamp가 30초 이내 차이)
    const matchingUtm = utmEntryTimes.find(utm => {
      const timeDiff = Math.abs(pageTime - utm.entryTime);
      return timeDiff <= 30000; // 30초 이내
    });

    if (matchingUtm) {
      // 이미 표시된 UTM은 제거 (중복 방지)
      const utmIdx = utmEntryTimes.findIndex(u => u.entry_time === matchingUtm.entry_time);
      if (utmIdx !== -1) {
        utmEntryTimes.splice(utmIdx, 1);
      }

      return {
        ...page,
        adEntry: {
          utm_source: matchingUtm.utm_source,
          utm_medium: matchingUtm.utm_medium,
          utm_campaign: matchingUtm.utm_campaign,
          utm_content: matchingUtm.utm_content,
          entry_time: matchingUtm.entry_time
        }
      };
    }

    return page;
  });
}

/**
 * 모든 여정 통합 (이전 방문 + 구매 당일)
 * @param {Array} filteredPreviousVisits - 필터링된 이전 방문 배열
 * @param {Array} validJourneyPages - 구매 당일 페이지 배열
 * @param {string} purchaseDate - 구매일 (YYYY-MM-DD)
 * @param {Array} utmHistory - UTM 히스토리 배열 (광고 유입 시점 표시용)
 * @returns {Array} 통합된 여정 배열
 */
export function buildAllJourneys(filteredPreviousVisits, validJourneyPages, purchaseDate, utmHistory = []) {
  const journeys = [
    // 필터링된 이전 방문들 (연속 중복 제거 적용)
    ...filteredPreviousVisits.map((visit) => {
      const deduplicatedPages = removeConcecutiveDuplicates(visit.pages || []);
      // 이전 방문에도 광고 유입 시점 표시 적용
      const pagesWithAdEntry = markAdEntryPoints(deduplicatedPages, utmHistory);
      const totalDuration = pagesWithAdEntry.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);

      return {
        id: `visit-${visit.date}`,
        date: visit.date,
        type: 'visit',
        dateLabel: dayjs(visit.date).format('YYYY-MM-DD'),
        pageCount: pagesWithAdEntry.length,
        duration: formatDuration(totalDuration),
        pages: pagesWithAdEntry,
        color: '#9ca3af' // 회색
      };
    }),
    // 구매 당일 (연속 중복 제거 적용)
    (() => {
      const deduplicatedPages = removeConcecutiveDuplicates(validJourneyPages);
      // 구매 당일에도 광고 유입 시점 표시 적용
      const pagesWithAdEntry = markAdEntryPoints(deduplicatedPages, utmHistory);
      const totalDuration = pagesWithAdEntry.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);

      return {
        id: 'purchase',
        date: purchaseDate,
        type: 'purchase',
        dateLabel: purchaseDate,
        pageCount: pagesWithAdEntry.length,
        duration: formatDuration(totalDuration),
        pages: pagesWithAdEntry,
        color: '#60a5fa' // 밝은 파스텔 블루
      };
    })()
  ];

  // 시간순 정렬 후 방문 순서 부여
  const sortedJourneys = journeys.sort((a, b) => new Date(a.date) - new Date(b.date));

  return sortedJourneys.map((journey, idx) => ({
    ...journey,
    visitNumber: idx + 1,
    label: journey.type === 'purchase'
      ? `${idx + 1}차 방문 (구매)`
      : `${idx + 1}차 방문 (이탈)`
  }));
}

/**
 * 타임라인 다단 배치 계산 (광고 카드 포함)
 * 광고 유입이 있는 페이지는 2칸(광고카드+페이지카드)으로 계산하여
 * 열당 실제 표시되는 아이템 수가 균등하도록 분할
 * @param {Array} pages - 페이지 배열
 * @param {number} maxItemsPerColumn - 컬럼당 최대 아이템 수 (기본: 4)
 * @returns {Array<Array>} 컬럼별로 분할된 페이지 배열
 */
export function getColumns(pages, maxItemsPerColumn = 4) {
  const columns = [];
  let currentColumn = [];
  let currentItemCount = 0;

  pages.forEach((page) => {
    // 광고 카드가 있으면 2칸, 없으면 1칸
    const itemCount = page.adEntry ? 2 : 1;

    // 현재 열에 추가 시 최대치 초과하면 새 열 시작
    if (currentItemCount + itemCount > maxItemsPerColumn && currentColumn.length > 0) {
      columns.push(currentColumn);
      currentColumn = [];
      currentItemCount = 0;
    }

    currentColumn.push(page);
    currentItemCount += itemCount;
  });

  // 마지막 열 추가
  if (currentColumn.length > 0) {
    columns.push(currentColumn);
  }

  return columns;
}

/**
 * 이전 방문을 날짜별로 그룹화
 * @param {Array} previousVisitsRows - 이전 방문 데이터 배열
 * @returns {Array} 날짜별로 그룹화된 방문 배열
 */
export function groupVisitsByDate(previousVisitsRows) {
  const previousVisitsByDate = {};

  previousVisitsRows.forEach(row => {
    const date = row.visit_date;
    if (!previousVisitsByDate[date]) {
      previousVisitsByDate[date] = [];
    }
    previousVisitsByDate[date].push({
      page_url: row.page_url,
      clean_url: row.clean_url,
      page_title: row.page_title || null,
      timestamp: row.timestamp,
      time_spent_seconds: row.time_spent_seconds || 0
    });
  });

  return Object.entries(previousVisitsByDate).map(([date, pages]) => ({
    date: date,
    pages: pages,
    total_duration: pages.reduce((sum, p) => sum + p.time_spent_seconds, 0),
    page_count: pages.length
  })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 이전 방문 필터링 로직
 * @param {Array} previousVisits - 이전 방문 배열
 * @param {string} orderTimestamp - 주문 시간
 * @param {Array|null} selectedDateRange - 선택된 날짜 범위 [시작, 종료]
 * @returns {Array} 필터링된 이전 방문 배열
 */
export function filterPreviousVisits(previousVisits, orderTimestamp, selectedDateRange) {
  if (!previousVisits || previousVisits.length === 0) {
    return [];
  }

  const purchaseDateObj = dayjs(orderTimestamp);

  return previousVisits.filter(visit => {
    const visitDate = dayjs(visit.date);

    // 구매일 이후 방문은 제외 (데이터 무결성 체크)
    if (visitDate.isAfter(purchaseDateObj, 'day') || visitDate.isSame(purchaseDateObj, 'day')) {
      return false;
    }

    if (selectedDateRange && selectedDateRange[0] && selectedDateRange[1]) {
      // RangePicker 선택 시: 해당 기간 내 방문만 필터링
      const startDate = selectedDateRange[0];
      const endDate = selectedDateRange[1];
      return (visitDate.isAfter(startDate, 'day') || visitDate.isSame(startDate, 'day')) &&
             (visitDate.isBefore(endDate, 'day') || visitDate.isSame(endDate, 'day'));
    }

    // 기본: 모든 방문 포함
    return true;
  });
}
