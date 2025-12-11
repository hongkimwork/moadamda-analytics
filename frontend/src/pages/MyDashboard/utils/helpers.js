// 이전 기간 자동 계산 함수 (같은 일자의 이전 달)
// 예: 12월 1일 ~ 12월 5일 → 11월 1일 ~ 11월 5일
export const getComparisonPeriod = (startDate, endDate) => {
  return [
    startDate.subtract(1, 'month'),
    endDate.subtract(1, 'month')
  ];
};

// 날짜 라벨 생성 (YYYY년 MM월 형식 - 년도 포함)
export const formatPeriodLabel = (range) => {
  if (!range) return '';
  const startParts = range.start?.split('-') || [];
  const endParts = range.end?.split('-') || [];
  
  if (startParts.length < 3 || endParts.length < 3) return '';
  
  const startYear = startParts[0];
  const startMonth = parseInt(startParts[1]);
  const endYear = endParts[0];
  const endMonth = parseInt(endParts[1]);
  
  // 같은 년도, 같은 월
  if (startYear === endYear && startMonth === endMonth) {
    return `${startYear}년 ${startMonth}월`;
  }
  
  // 같은 년도, 다른 월
  if (startYear === endYear) {
    return `${startYear}년 ${startMonth}~${endMonth}월`;
  }
  
  // 다른 년도
  return `${startYear}년 ${startMonth}월~${endYear}년 ${endMonth}월`;
};

// 상세 날짜 정보 (간결한 형식: 2024.11.01 ~ 30)
export const formatDetailedPeriod = (range) => {
  if (!range) return '';
  const startParts = range.start?.split('-') || [];
  const endParts = range.end?.split('-') || [];
  
  if (startParts.length < 3 || endParts.length < 3) return '';
  
  const startYear = startParts[0];
  const startMonth = startParts[1];
  const startDay = startParts[2];
  const endYear = endParts[0];
  const endMonth = endParts[1];
  const endDay = endParts[2];
  
  // 같은 년도, 같은 월: 2024.11.01 ~ 30
  if (startYear === endYear && startMonth === endMonth) {
    return `${startYear}.${startMonth}.${startDay} ~ ${endDay}`;
  }
  
  // 같은 년도, 다른 월: 2024.11.01 ~ 12.31
  if (startYear === endYear) {
    return `${startYear}.${startMonth}.${startDay} ~ ${endMonth}.${endDay}`;
  }
  
  // 다른 년도: 2024.12.01 ~ 2025.01.31
  return `${startYear}.${startMonth}.${startDay} ~ ${endYear}.${endMonth}.${endDay}`;
};
