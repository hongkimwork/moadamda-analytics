/**
 * 카페24 Data 비교 API
 * 
 * 카페24에서 복사한 방문자 데이터(IP, 유입출처, 방문일시)를
 * 우리 시스템 데이터와 비교하는 API
 * 
 * 비교 기준: pageview 시간 (카페24가 페이지뷰 시간을 기록하므로)
 * 원본 테이블 사용 이유: 데이터 무결성 검증 목적
 */

const express = require('express');
const router = express.Router();
const db = require('../../utils/database');

/**
 * POST /api/stats/cafe24-compare
 * 
 * 카페24 데이터와 우리 시스템 데이터 비교
 * 
 * Request Body:
 * {
 *   visits: [
 *     { ip: "211.118.110.139", source: "instagram.com", visitTime: "2026-01-08 23:58:50" },
 *     ...
 *   ]
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { visits, date } = req.body;
    
    if (!visits || !Array.isArray(visits) || visits.length === 0) {
      return res.status(400).json({ error: '비교할 데이터가 없습니다.' });
    }

    if (!date) {
      return res.status(400).json({ error: '비교할 날짜를 선택해주세요.' });
    }

    const results = [];

    for (const visit of visits) {
      const { ip, source, visitTime } = visit;
      
      if (!ip || !visitTime) {
        results.push({
          cafe24: visit,
          ourSystem: null,
          status: 'invalid',
          statusText: '데이터 오류'
        });
        continue;
      }

      // IP + 시간(±3초) 기준으로 pageview 검색 (카페24는 페이지뷰 시간을 기록하므로)
      // 원본 테이블 사용 이유: 데이터 무결성 검증 목적
      // IP 앞에 백슬래시가 붙어있을 수 있어서 양쪽 모두 검색
      // 날짜 필터 추가로 조회 범위 제한
      const query = `
        SELECT 
          s.ip_address,
          p.timestamp as visit_time,
          s.utm_params,
          s.entry_url
        FROM pageviews p
        JOIN sessions s ON p.session_id = s.session_id
        WHERE (s.ip_address = $1 OR s.ip_address = $4)
          AND p.timestamp >= $3::date
          AND p.timestamp < ($3::date + interval '1 day')
          AND p.timestamp BETWEEN ($2::timestamp - interval '3 seconds') 
                              AND ($2::timestamp + interval '3 seconds')
        ORDER BY ABS(EXTRACT(EPOCH FROM (p.timestamp - $2::timestamp)))
        LIMIT 1
      `;

      const ipWithBackslash = '\\' + ip;
      const result = await db.query(query, [ip, visitTime, date, ipWithBackslash]);

      if (result.rows.length === 0) {
        // ±3초 내에 없으면, 같은 날 같은 IP로 재검색 (시간 불일치 확인)
        const timeMismatchQuery = `
          SELECT 
            s.ip_address,
            p.timestamp as visit_time,
            s.utm_params,
            s.entry_url,
            ABS(EXTRACT(EPOCH FROM (p.timestamp - $2::timestamp))) as time_diff_seconds
          FROM pageviews p
          JOIN sessions s ON p.session_id = s.session_id
          WHERE (s.ip_address = $1 OR s.ip_address = $4)
            AND p.timestamp >= $3::date
            AND p.timestamp < ($3::date + interval '1 day')
          ORDER BY ABS(EXTRACT(EPOCH FROM (p.timestamp - $2::timestamp)))
          LIMIT 1
        `;

        const timeMismatchResult = await db.query(timeMismatchQuery, [ip, visitTime, date, ipWithBackslash]);

        if (timeMismatchResult.rows.length === 0) {
          // 진짜 미수집 (같은 날 해당 IP 세션 없음)
          results.push({
            cafe24: visit,
            ourSystem: null,
            status: 'not_found',
            statusText: '미수집'
          });
        } else {
          // 시간 불일치 (같은 IP는 있지만 시간이 ±3초 초과)
          const row = timeMismatchResult.rows[0];
          const cleanIp = (row.ip_address || '').replace(/^\\/, '');
          const ourSource = extractSource(row.utm_params, row.entry_url);
          const timeDiffSeconds = Math.round(row.time_diff_seconds);

          results.push({
            cafe24: visit,
            ourSystem: {
              ip: cleanIp,
              source: ourSource,
              visitTime: formatTimestamp(row.visit_time),
              utmParams: row.utm_params
            },
            status: 'time_mismatch',
            statusText: '시간불일치',
            timeDiff: formatTimeDiff(timeDiffSeconds)
          });
        }
      } else {
        const row = result.rows[0];
        const cleanIp = (row.ip_address || '').replace(/^\\/, '');
        const ourSource = extractSource(row.utm_params, row.entry_url);
        const sourceMatch = compareSource(source, ourSource, row.utm_params);

        results.push({
          cafe24: visit,
          ourSystem: {
            ip: cleanIp,
            source: ourSource,
            visitTime: formatTimestamp(row.visit_time),
            utmParams: row.utm_params
          },
          status: sourceMatch ? 'match' : 'source_mismatch',
          statusText: sourceMatch ? '일치' : '유입불일치'
        });
      }
    }

    // 요약 통계 계산
    const summary = {
      total: results.length,
      match: results.filter(r => r.status === 'match').length,
      sourceMismatch: results.filter(r => r.status === 'source_mismatch').length,
      timeMismatch: results.filter(r => r.status === 'time_mismatch').length,
      notFound: results.filter(r => r.status === 'not_found').length,
      invalid: results.filter(r => r.status === 'invalid').length
    };

    res.json({ summary, results });

  } catch (error) {
    console.error('카페24 비교 API 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

/**
 * utm_params 또는 entry_url에서 유입출처 추출
 */
function extractSource(utmParams, entryUrl) {
  // utm_source가 있으면 사용
  if (utmParams && utmParams.utm_source) {
    return utmParams.utm_source;
  }
  
  // entry_url에서 utm_source 추출 시도
  if (entryUrl) {
    try {
      const url = new URL(entryUrl);
      const utmSource = url.searchParams.get('utm_source');
      if (utmSource) return utmSource;
    } catch (e) {
      // URL 파싱 실패 시 무시
    }
  }
  
  // UTM 정보 없으면 직접 방문
  return '(직접 방문)';
}

/**
 * 카페24 유입출처와 우리 시스템 유입출처 비교
 */
function compareSource(cafe24Source, ourSource, utmParams) {
  const cafe24Lower = (cafe24Source || '').toLowerCase();
  const ourLower = (ourSource || '').toLowerCase();

  // 직접 방문 비교
  if (cafe24Lower === 'bookmark' || cafe24Lower === '(직접 방문)' || cafe24Lower === '') {
    return ourLower === '(직접 방문)' || !utmParams || Object.keys(utmParams).length === 0;
  }

  // Meta 계열 (instagram, facebook, threads)
  if (cafe24Lower.includes('instagram') || cafe24Lower.includes('facebook') || cafe24Lower.includes('threads')) {
    return ourLower === 'meta' || ourLower.includes('instagram') || ourLower.includes('facebook');
  }

  // 네이버
  if (cafe24Lower.includes('naver')) {
    return ourLower === 'naver' || ourLower.includes('naver');
  }

  // 카카오
  if (cafe24Lower.includes('kakao')) {
    return ourLower === 'kakaotalk' || ourLower.includes('kakao');
  }

  // 구글
  if (cafe24Lower.includes('google')) {
    return ourLower === 'google' || ourLower.includes('google');
  }

  // 기타: 도메인 포함 여부로 비교
  return ourLower.includes(cafe24Lower) || cafe24Lower.includes(ourLower);
}

/**
 * 타임스탬프 포맷팅
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 시간 차이 포맷팅 (초 단위 → 사람이 읽기 쉬운 형태)
 */
function formatTimeDiff(seconds) {
  const absSeconds = Math.abs(seconds);
  
  if (absSeconds < 60) {
    return `${absSeconds}초`;
  } else if (absSeconds < 3600) {
    const minutes = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    return secs > 0 ? `${minutes}분 ${secs}초` : `${minutes}분`;
  } else {
    const hours = Math.floor(absSeconds / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  }
}

module.exports = router;
