import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Table, DatePicker, Button, Space, Spin, Tag, Modal, Input, Radio, Tooltip, Pagination, message } from 'antd';
import { UserOutlined, ReloadOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3003';

/**
 * 방문자 분석 페이지 - 카페24 "순방문자 수" 호환
 * 
 * 지표 정의:
 * - 전체방문: 2시간 이내 재방문은 1회로 집계
 * - 순방문수: 1년 이내 동일 쿠키/브라우저/기기 = 1명
 * - 재방문수: 재방문자들의 방문 횟수
 * - 비교값: 전일 전체방문 수
 * - 증감: (당일 - 전일) / 전일 × 100 (%)
 */
function VisitorAnalysis() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  
  // 기본 날짜 범위: 최근 7일
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(6, 'day'),
    dayjs()
  ]);

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalDate, setModalDate] = useState(null);
  const [modalData, setModalData] = useState([]);
  const [modalSummary, setModalSummary] = useState(null);
  const [modalPagination, setModalPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  
  // 필터/검색/정렬 상태
  const [searchText, setSearchText] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [browserFilter, setBrowserFilter] = useState('');
  const [sortBy, setSortBy] = useState('visit_time');
  const [sortOrder, setSortOrder] = useState('asc');

  // 카페24 비교 분석 상태
  const [cafe24Text, setCafe24Text] = useState('');
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [compareFilter, setCompareFilter] = useState('all'); // all, match, ours_only, cafe24_only
  const [matchCriteria, setMatchCriteria] = useState('3s'); // 3s, 60s, ip_only

  /**
   * 순방문자 데이터 로드
   */
  const loadData = useCallback(async () => {
    if (!dateRange[0] || !dateRange[1]) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD')
      });

      const res = await fetch(`${API_BASE}/api/stats/validation/unique-visitors?${params}`);
      const result = await res.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // 순방문수 기준 내림차순 정렬 (최신 날짜가 위로)
      const sortedData = [...result.data].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
      
      setData(sortedData);
      setSummary(result.summary);
    } catch (error) {
      console.error('Failed to load unique visitors:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // 초기 로드 및 날짜 변경 시 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * 모달 데이터 로드
   */
  const loadModalData = useCallback(async (date, page = 1) => {
    if (!date) return;
    
    setModalLoading(true);
    try {
      const params = new URLSearchParams({
        date,
        page: page.toString(),
        limit: modalPagination.limit.toString(),
        sortBy,
        sortOrder
      });

      if (searchText) params.append('search', searchText);
      if (deviceFilter) params.append('device', deviceFilter);
      if (browserFilter) params.append('browser', browserFilter);

      const res = await fetch(`${API_BASE}/api/stats/validation/unique-visitors/detail?${params}`);
      const result = await res.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setModalData(result.visitors);
      setModalPagination(result.pagination);
      setModalSummary(result.summary);
    } catch (error) {
      console.error('Failed to load visitor detail:', error);
    } finally {
      setModalLoading(false);
    }
  }, [searchText, deviceFilter, browserFilter, sortBy, sortOrder, modalPagination.limit]);

  /**
   * 순방문수 클릭 시 모달 열기
   */
  const handleUniqueVisitorClick = (record) => {
    setModalDate(record.date);
    setSearchText('');
    setDeviceFilter('');
    setBrowserFilter('');
    setSortBy('visit_time');
    setSortOrder('asc');
    setModalPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
    setModalOpen(true);
  };

  /**
   * 모달 열릴 때 데이터 로드
   */
  useEffect(() => {
    if (modalOpen && modalDate) {
      loadModalData(modalDate, 1);
    }
  }, [modalOpen, modalDate]);

  /**
   * 필터/검색 변경 시 데이터 재로드
   */
  useEffect(() => {
    if (modalOpen && modalDate) {
      loadModalData(modalDate, 1);
    }
  }, [searchText, deviceFilter, browserFilter, sortBy, sortOrder]);

  /**
   * 모달 테이블 정렬 핸들러
   */
  const handleModalSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  /**
   * 정렬 아이콘 렌더링
   */
  const renderSortIcon = (column) => {
    if (sortBy !== column) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  /**
   * 카페24 데이터 파싱
   * 탭 구분: IP주소 \t 유입경로 \t 방문시간
   * 다양한 줄바꿈 형식 지원 (\r\n, \n, \r)
   */
  const parseCafe24Data = (text) => {
    if (!text.trim()) return [];
    
    // 다양한 줄바꿈 형식 통일
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.trim().split('\n');
    const parsed = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      const parts = trimmedLine.split('\t');
      if (parts.length >= 3) {
        const ip = parts[0].trim();
        const visitTime = parts[2].trim();
        
        // IP 형식 검증 (간단한 검증)
        if (ip && visitTime && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
          parsed.push({ ip, visitTime });
        }
      }
    }
    
    return parsed;
  };

  /**
   * IP 주소 정규화 (앞의 \ 제거)
   */
  const normalizeIp = (ip) => {
    if (!ip) return '';
    return ip.replace(/^\\/, '').trim();
  };

  /**
   * 시간 차이 계산 (초 단위)
   */
  const getTimeDiffSeconds = (time1, time2) => {
    try {
      const t1 = dayjs(time1);
      const t2 = dayjs(time2);
      return Math.abs(t1.diff(t2, 'second'));
    } catch {
      return Infinity;
    }
  };

  /**
   * 비교 분석 실행
   */
  const handleCompareAnalysis = async () => {
    if (!cafe24Text.trim()) {
      message.warning('카페24 데이터를 붙여넣어 주세요.');
      return;
    }

    if (!modalDate) {
      message.warning('날짜 정보가 없습니다.');
      return;
    }

    setCompareLoading(true);
    
    try {
      // 1. 카페24 데이터 파싱
      const cafe24Parsed = parseCafe24Data(cafe24Text);
      
      if (cafe24Parsed.length === 0) {
        message.warning('유효한 카페24 데이터가 없습니다.');
        setCompareLoading(false);
        return;
      }

      // 2. 카페24 데이터에서 고유 IP 추출 (첫 번째 등장 기준)
      const cafe24UniqueMap = new Map();
      const cafe24Duplicates = [];
      
      for (const item of cafe24Parsed) {
        if (!cafe24UniqueMap.has(item.ip)) {
          cafe24UniqueMap.set(item.ip, item);
        } else {
          cafe24Duplicates.push(item);
        }
      }
      
      const cafe24Unique = Array.from(cafe24UniqueMap.values());

      // 3. 우리 데이터 로드 (전체)
      const params = new URLSearchParams({ date: modalDate });
      const res = await fetch(`${API_BASE}/api/stats/validation/unique-visitors/all?${params}`);
      const result = await res.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // 4. 우리 데이터에서 고유 IP 추출 (역슬래시 제거) + 상세 정보 포함
      const oursUniqueMap = new Map();
      const oursDuplicates = [];
      
      for (const item of result.visitors) {
        const normalizedIp = normalizeIp(item.ipAddress);
        if (!oursUniqueMap.has(normalizedIp)) {
          oursUniqueMap.set(normalizedIp, { 
            ip: normalizedIp, 
            visitTime: item.visitTime,
            browser: item.browser || 'Unknown',
            os: item.os || 'Unknown',
            deviceType: item.deviceType || 'unknown',
            pageviewCount: item.pageviewCount || 0,
            totalDuration: item.totalDuration || 0
          });
        } else {
          oursDuplicates.push(item);
        }
      }
      
      const oursUnique = Array.from(oursUniqueMap.values());

      // 5. 세 가지 기준으로 비교 분석
      // 기준1: IP + 시간 ±3초
      // 기준2: IP + 시간 ±60초
      // 기준3: IP만 (시간 무시)
      
      const matched3s = [];
      const matched60s = [];
      const matchedIpOnly = [];
      const oursOnly = [];
      const cafe24Only = [];
      
      const cafe24MatchedIps3s = new Set();
      const oursMatchedIps3s = new Set();
      const cafe24MatchedIps60s = new Set();
      const oursMatchedIps60s = new Set();
      const cafe24MatchedIpsOnly = new Set();
      const oursMatchedIpsOnly = new Set();

      // 일치 항목 찾기 (세 가지 기준)
      for (const oursItem of oursUnique) {
        const cafe24Item = cafe24UniqueMap.get(oursItem.ip);
        
        if (cafe24Item) {
          const timeDiff = getTimeDiffSeconds(oursItem.visitTime, cafe24Item.visitTime);
          
          // 기준1: ±3초
          if (timeDiff <= 3) {
            matched3s.push({
              cafe24Ip: cafe24Item.ip,
              cafe24Time: cafe24Item.visitTime,
              oursIp: oursItem.ip,
              oursTime: oursItem.visitTime,
              timeDiff,
              status: 'match'
            });
            cafe24MatchedIps3s.add(cafe24Item.ip);
            oursMatchedIps3s.add(oursItem.ip);
          }
          
          // 기준2: ±60초
          if (timeDiff <= 60) {
            matched60s.push({
              cafe24Ip: cafe24Item.ip,
              cafe24Time: cafe24Item.visitTime,
              oursIp: oursItem.ip,
              oursTime: oursItem.visitTime,
              timeDiff,
              status: 'match'
            });
            cafe24MatchedIps60s.add(cafe24Item.ip);
            oursMatchedIps60s.add(oursItem.ip);
          }
          
          // 기준3: IP만 (시간 무시)
          matchedIpOnly.push({
            cafe24Ip: cafe24Item.ip,
            cafe24Time: cafe24Item.visitTime,
            oursIp: oursItem.ip,
            oursTime: oursItem.visitTime,
            timeDiff,
            status: 'match'
          });
          cafe24MatchedIpsOnly.add(cafe24Item.ip);
          oursMatchedIpsOnly.add(oursItem.ip);
        }
      }

      // 헬퍼 함수: 특정 기준의 우리만/카페24만 데이터 생성
      const buildOursOnly = (matchedIpsSet) => {
        const result = [];
        for (const oursItem of oursUnique) {
          if (!matchedIpsSet.has(oursItem.ip)) {
            const cafe24Item = cafe24UniqueMap.get(oursItem.ip);
            result.push({
              cafe24Ip: cafe24Item?.ip || '-',
              cafe24Time: cafe24Item?.visitTime || '-',
              oursIp: oursItem.ip,
              oursTime: oursItem.visitTime,
              browser: oursItem.browser,
              os: oursItem.os,
              deviceType: oursItem.deviceType,
              pageviewCount: oursItem.pageviewCount,
              totalDuration: oursItem.totalDuration,
              hasIpInCafe24: !!cafe24Item,
              timeDiff: cafe24Item ? getTimeDiffSeconds(oursItem.visitTime, cafe24Item.visitTime) : null,
              status: 'ours_only'
            });
          }
        }
        return result;
      };

      const buildCafe24Only = (matchedIpsSet) => {
        const result = [];
        for (const cafe24Item of cafe24Unique) {
          if (!matchedIpsSet.has(cafe24Item.ip)) {
            result.push({
              cafe24Ip: cafe24Item.ip,
              cafe24Time: cafe24Item.visitTime,
              oursIp: '-',
              oursTime: '-',
              status: 'cafe24_only'
            });
          }
        }
        return result;
      };

      // 세 가지 기준별 결과 생성
      const oursOnly3s = buildOursOnly(oursMatchedIps3s);
      const oursOnly60s = buildOursOnly(oursMatchedIps60s);
      const oursOnlyIpOnly = buildOursOnly(oursMatchedIpsOnly);
      const cafe24Only3s = buildCafe24Only(cafe24MatchedIps3s);
      const cafe24Only60s = buildCafe24Only(cafe24MatchedIps60s);
      const cafe24OnlyIpOnly = buildCafe24Only(cafe24MatchedIpsOnly);

      // 6. 결과 저장 (세 가지 기준별 데이터 포함)
      setCompareResult({
        totalOurs: oursUnique.length,
        totalCafe24: cafe24Unique.length,
        duplicatesRemoved: cafe24Duplicates.length + oursDuplicates.length,
        // 기준별 데이터
        criteria: {
          '3s': {
            matched: matched3s,
            oursOnly: oursOnly3s,
            cafe24Only: cafe24Only3s
          },
          '60s': {
            matched: matched60s,
            oursOnly: oursOnly60s,
            cafe24Only: cafe24Only60s
          },
          'ip_only': {
            matched: matchedIpOnly,
            oursOnly: oursOnlyIpOnly,
            cafe24Only: cafe24OnlyIpOnly
          }
        }
      });

      setCompareFilter('all');
      setCompareModalOpen(true);

    } catch (error) {
      console.error('Compare analysis failed:', error);
      message.error('비교 분석 중 오류가 발생했습니다.');
    } finally {
      setCompareLoading(false);
    }
  };

  /**
   * 증감률 렌더링 (양수: 초록, 음수: 빨강)
   */
  const renderChangeRate = (value) => {
    if (value === null || value === undefined) {
      return <Text type="secondary">-</Text>;
    }
    
    const isPositive = value > 0;
    const isNegative = value < 0;
    const color = isPositive ? '#52c41a' : isNegative ? '#ff4d4f' : '#8c8c8c';
    const prefix = isPositive ? '+' : '';
    
    return (
      <Text style={{ color, fontWeight: 500 }}>
        {prefix}{value.toFixed(2)}%
      </Text>
    );
  };

  /**
   * 숫자 포맷팅 (천 단위 콤마)
   */
  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString();
  };

  /**
   * 테이블 컬럼 정의
   */
  const columns = [
    {
      title: '일시',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
      sorter: (a, b) => new Date(a.date) - new Date(b.date)
    },
    {
      title: '전체방문',
      dataIndex: 'totalVisits',
      key: 'totalVisits',
      width: 120,
      align: 'right',
      render: formatNumber,
      sorter: (a, b) => a.totalVisits - b.totalVisits
    },
    {
      title: '순방문수',
      dataIndex: 'uniqueVisitors',
      key: 'uniqueVisitors',
      width: 120,
      align: 'right',
      render: (value, record) => (
        <span 
          style={{ 
            color: '#1890ff', 
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
          onClick={() => handleUniqueVisitorClick(record)}
        >
          {formatNumber(value)}
        </span>
      ),
      sorter: (a, b) => a.uniqueVisitors - b.uniqueVisitors,
      defaultSortOrder: 'descend'
    },
    {
      title: '재방문수',
      dataIndex: 'returningVisits',
      key: 'returningVisits',
      width: 120,
      align: 'right',
      render: formatNumber,
      sorter: (a, b) => a.returningVisits - b.returningVisits
    },
    {
      title: '비교값',
      dataIndex: 'prevTotalVisits',
      key: 'prevTotalVisits',
      width: 120,
      align: 'right',
      render: (value) => value !== null ? formatNumber(value) : '-'
    },
    {
      title: '증감',
      dataIndex: 'changeRate',
      key: 'changeRate',
      width: 100,
      align: 'right',
      render: renderChangeRate,
      sorter: (a, b) => (a.changeRate || 0) - (b.changeRate || 0)
    }
  ];

  /**
   * 날짜 범위 프리셋
   */
  const datePresets = [
    { label: '오늘', value: [dayjs(), dayjs()] },
    { label: '7일', value: [dayjs().subtract(6, 'day'), dayjs()] },
    { label: '1개월', value: [dayjs().subtract(1, 'month').add(1, 'day'), dayjs()] },
    { label: '3개월', value: [dayjs().subtract(3, 'month').add(1, 'day'), dayjs()] }
  ];

  return (
    <div style={{ padding: '24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* 헤더 */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <UserOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
            <Title level={4} style={{ margin: 0 }}>순방문자 수</Title>
            <Tag color="blue">카페24 호환</Tag>
          </Space>
          
          <Space>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates)}
              format="YYYY-MM-DD"
              presets={datePresets}
              allowClear={false}
            />
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={loadData}
              loading={loading}
            >
              조회하기
            </Button>
          </Space>
        </div>
      </Card>

      {/* 테이블 */}
      <Card>
        {/* 합계 요약 */}
        {summary && (
          <div style={{ 
            marginBottom: '16px', 
            padding: '12px 16px',
            backgroundColor: '#fafafa',
            borderRadius: '4px',
            display: 'flex',
            gap: '32px'
          }}>
            <div>
              <Text type="secondary">전체방문 합계</Text>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>
                {formatNumber(summary.totalVisits)}
              </div>
            </div>
            <div>
              <Text type="secondary">순방문수 합계</Text>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>
                {formatNumber(summary.uniqueVisitors)}
              </div>
            </div>
            <div>
              <Text type="secondary">재방문수 합계</Text>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>
                {formatNumber(summary.returningVisits)}
              </div>
            </div>
          </div>
        )}

        <Table
          rowKey="date"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            pageSize: 31,
            showSizeChanger: true,
            pageSizeOptions: ['7', '14', '31', '90'],
            showTotal: (total) => `총 ${total}일`
          }}
          size="middle"
          locale={{
            emptyText: '데이터가 없습니다. 날짜 범위를 선택해 주세요.'
          }}
        />
      </Card>

      {/* 순방문자 상세 모달 */}
      <Modal
        title={
          <Space>
            <span>📋 {modalDate && dayjs(modalDate).format('YYYY-MM-DD')} 순방문자 상세</span>
            {modalSummary && (
              <Tag color="blue">총 {formatNumber(modalSummary.uniqueVisitors)}명</Tag>
            )}
          </Space>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={1100}
        style={{ top: 20 }}
        styles={{ body: { height: 'calc(95vh - 110px)', overflowY: 'auto' } }}
      >
        {/* 검색 & 필터 + 카페24 비교 */}
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#fafafa', 
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          gap: '24px'
        }}>
          {/* 좌측: 검색 & 필터 */}
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '12px' }}>
              <Input
                placeholder="IP 주소 검색..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 300 }}
                allowClear
              />
            </div>
            
            <Space size="large">
              <div>
                <Text type="secondary" style={{ marginRight: 8 }}>기기:</Text>
                <Radio.Group 
                  value={deviceFilter} 
                  onChange={(e) => setDeviceFilter(e.target.value)}
                  size="small"
                >
                  <Radio.Button value="">전체</Radio.Button>
                  <Radio.Button value="pc">PC</Radio.Button>
                  <Radio.Button value="mobile">모바일</Radio.Button>
                  <Radio.Button value="tablet">태블릿</Radio.Button>
                </Radio.Group>
              </div>
              
              <div>
                <Text type="secondary" style={{ marginRight: 8 }}>브라우저:</Text>
                <Radio.Group 
                  value={browserFilter} 
                  onChange={(e) => setBrowserFilter(e.target.value)}
                  size="small"
                >
                  <Radio.Button value="">전체</Radio.Button>
                  <Radio.Button value="chrome">Chrome</Radio.Button>
                  <Radio.Button value="safari">Safari</Radio.Button>
                  <Radio.Button value="other">기타</Radio.Button>
                </Radio.Group>
              </div>
            </Space>
          </div>

          {/* 우측: 카페24 비교 */}
          <div style={{ width: 320 }}>
            <Input.TextArea
              placeholder="카페24 데이터 붙여넣기...&#10;(IP주소 ⭢ 유입경로 ⭢ 방문시간)"
              value={cafe24Text}
              onChange={(e) => setCafe24Text(e.target.value)}
              rows={3}
              style={{ marginBottom: '8px', fontSize: '12px' }}
            />
            <Button
              type="primary"
              icon={<SwapOutlined />}
              onClick={handleCompareAnalysis}
              loading={compareLoading}
              block
            >
              비교 분석
            </Button>
          </div>
        </div>

        {/* 필터 결과 */}
        <div style={{ marginBottom: '12px' }}>
          <Text type="secondary">
            필터 결과: {modalSummary ? formatNumber(modalSummary.uniqueVisitors) : 0}명 중 {formatNumber(modalPagination.total)}명 표시
          </Text>
        </div>

        {/* 테이블 */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
                <th style={{ padding: '10px 8px', textAlign: 'center', width: 50 }}>#</th>
                <th 
                  style={{ padding: '10px 8px', textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => handleModalSort('ip_address')}
                >
                  IP 주소 {renderSortIcon('ip_address')}
                </th>
                <th 
                  style={{ padding: '10px 8px', textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => handleModalSort('visit_time')}
                >
                  방문시간 {renderSortIcon('visit_time')}
                </th>
              </tr>
            </thead>
            <tbody>
              {modalLoading ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '40px' }}>
                    <Spin />
                  </td>
                </tr>
              ) : modalData.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                modalData.map((row) => (
                  <tr key={row.visitorId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px 8px', textAlign: 'center', color: '#999' }}>
                      {row.rowNum}
                    </td>
                    <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontSize: '12px' }}>
                      {row.ipAddress}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      {row.visitTime}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {modalPagination.totalPages > 1 && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Pagination
              current={modalPagination.page}
              total={modalPagination.total}
              pageSize={modalPagination.limit}
              onChange={(page) => loadModalData(modalDate, page)}
              showSizeChanger={false}
              showQuickJumper
            />
          </div>
        )}

        {/* 요약 통계 */}
        {modalSummary && (
          <div style={{ 
            marginTop: '16px', 
            padding: '12px 16px',
            backgroundColor: '#fafafa',
            borderRadius: '4px',
            borderTop: '1px solid #e8e8e8'
          }}>
            <Text type="secondary">
              📊 요약: visitor_id <strong>{formatNumber(modalSummary.uniqueVisitors)}</strong>개 │ 
              고유 IP <strong>{formatNumber(modalSummary.uniqueIps)}</strong>개 │ 
              총 세션 <strong>{formatNumber(modalSummary.totalSessions)}</strong>회 │ 
              총 PV <strong>{formatNumber(modalSummary.totalPageviews)}</strong>
            </Text>
          </div>
        )}
      </Modal>

      {/* 비교 결과 모달 */}
      <Modal
        title="📊 데이터 비교 결과"
        open={compareModalOpen}
        onCancel={() => setCompareModalOpen(false)}
        footer={null}
        width={1000}
        style={{ top: 20 }}
        styles={{ body: { height: 'calc(95vh - 110px)', overflowY: 'auto' } }}
      >
        {compareResult && compareResult.criteria && (
          <>
            {/* 매칭 기준 선택 + 총 데이터 */}
            <div style={{ 
              marginBottom: '16px', 
              padding: '12px 16px',
              backgroundColor: '#f0f5ff',
              borderRadius: '8px',
              border: '1px solid #adc6ff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <Text type="secondary" style={{ marginRight: 12 }}>매칭 기준:</Text>
                <Radio.Group 
                  value={matchCriteria} 
                  onChange={(e) => setMatchCriteria(e.target.value)}
                  size="small"
                >
                  <Radio.Button value="3s">±3초</Radio.Button>
                  <Radio.Button value="60s">±60초</Radio.Button>
                  <Radio.Button value="ip_only">IP만</Radio.Button>
                </Radio.Group>
              </div>
              <div style={{ fontSize: '12px', color: '#1d39c4' }}>
                📌 우리: <strong>{compareResult.totalOurs}</strong>건 | 
                카페24: <strong>{compareResult.totalCafe24}</strong>건
              </div>
            </div>

            {/* 요약 카드 */}
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              marginBottom: '20px',
              justifyContent: 'center'
            }}>
              {/* 전체 카드 */}
              <div
                onClick={() => setCompareFilter('all')}
                style={{
                  padding: '16px 24px',
                  borderRadius: '8px',
                  backgroundColor: compareFilter === 'all' ? '#e6f7ff' : '#fafafa',
                  border: compareFilter === 'all' ? '2px solid #1890ff' : '1px solid #d9d9d9',
                  cursor: 'pointer',
                  textAlign: 'center',
                  minWidth: '100px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 600 }}>
                  {compareResult.criteria[matchCriteria].matched.length + 
                   compareResult.criteria[matchCriteria].oursOnly.length + 
                   compareResult.criteria[matchCriteria].cafe24Only.length}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>전체</div>
              </div>

              {/* 일치 카드 */}
              <div
                onClick={() => setCompareFilter('match')}
                style={{
                  padding: '16px 24px',
                  borderRadius: '8px',
                  backgroundColor: compareFilter === 'match' ? '#f6ffed' : '#fafafa',
                  border: compareFilter === 'match' ? '2px solid #52c41a' : '1px solid #d9d9d9',
                  cursor: 'pointer',
                  textAlign: 'center',
                  minWidth: '100px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#52c41a' }}>
                  ✅ {compareResult.criteria[matchCriteria].matched.length}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>일치</div>
              </div>

              {/* 우리만 카드 */}
              <div
                onClick={() => setCompareFilter('ours_only')}
                style={{
                  padding: '16px 24px',
                  borderRadius: '8px',
                  backgroundColor: compareFilter === 'ours_only' ? '#fff2e8' : '#fafafa',
                  border: compareFilter === 'ours_only' ? '2px solid #fa541c' : '1px solid #d9d9d9',
                  cursor: 'pointer',
                  textAlign: 'center',
                  minWidth: '100px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#fa541c' }}>
                  ❌ {compareResult.criteria[matchCriteria].oursOnly.length}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>우리만</div>
              </div>

              {/* 카페24만 카드 */}
              <div
                onClick={() => setCompareFilter('cafe24_only')}
                style={{
                  padding: '16px 24px',
                  borderRadius: '8px',
                  backgroundColor: compareFilter === 'cafe24_only' ? '#fffbe6' : '#fafafa',
                  border: compareFilter === 'cafe24_only' ? '2px solid #faad14' : '1px solid #d9d9d9',
                  cursor: 'pointer',
                  textAlign: 'center',
                  minWidth: '100px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#faad14' }}>
                  ⚠️ {compareResult.criteria[matchCriteria].cafe24Only.length}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>카페24만</div>
              </div>

              {/* 중복 제외 카드 */}
              <div
                style={{
                  padding: '16px 24px',
                  borderRadius: '8px',
                  backgroundColor: '#fafafa',
                  border: '1px solid #d9d9d9',
                  textAlign: 'center',
                  minWidth: '100px'
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#8c8c8c' }}>
                  🔄 {compareResult.duplicatesRemoved}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>중복제외</div>
              </div>
            </div>

            {/* 현재 필터 표시 */}
            <div style={{ marginBottom: '12px' }}>
              <Text type="secondary">
                현재 필터: {
                  compareFilter === 'all' ? '전체' :
                  compareFilter === 'match' ? '✅ 일치' :
                  compareFilter === 'ours_only' ? '❌ 우리만' :
                  '⚠️ 카페24만'
                } ({
                  compareFilter === 'all' 
                    ? compareResult.criteria[matchCriteria].matched.length + 
                      compareResult.criteria[matchCriteria].oursOnly.length + 
                      compareResult.criteria[matchCriteria].cafe24Only.length
                    : compareFilter === 'match'
                    ? compareResult.criteria[matchCriteria].matched.length
                    : compareFilter === 'ours_only'
                    ? compareResult.criteria[matchCriteria].oursOnly.length
                    : compareResult.criteria[matchCriteria].cafe24Only.length
                }건)
              </Text>
            </div>

            {/* 비교 결과 테이블 - "우리만" 필터일 때 상세 정보 표시 */}
            <div style={{ overflowX: 'auto' }}>
              {compareFilter === 'ours_only' ? (
                /* 우리만 수집한 데이터 상세 테이블 */
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fff2e8', borderBottom: '1px solid #e8e8e8' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>IP 주소</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>방문시간</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>브라우저</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>OS</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>기기</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>PV</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>체류(초)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(compareResult.criteria[matchCriteria].oursOnly || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                          데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      (compareResult.criteria[matchCriteria].oursOnly || []).map((row, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontSize: '12px' }}>
                            {row.oursIp}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '12px' }}>
                            {row.oursTime?.split(' ')[1] || row.oursTime}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            {row.browser || '-'}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '12px' }}>
                            {row.os || '-'}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            {row.deviceType === 'mobile' ? '📱' : row.deviceType === 'tablet' ? '📱' : '💻'}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            {row.pageviewCount || 0}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            {row.totalDuration || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                /* 기본 비교 테이블 */
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
                      <th colSpan={2} style={{ padding: '10px 8px', textAlign: 'center', borderRight: '2px solid #e8e8e8' }}>
                        카페24 데이터
                      </th>
                      <th colSpan={2} style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #e8e8e8' }}>
                        우리 데이터
                      </th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', width: 60 }}>
                        상태
                      </th>
                    </tr>
                    <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>IP 주소</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderRight: '2px solid #e8e8e8' }}>방문시간</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>IP 주소</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e8e8e8' }}>방문시간</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const currentData = compareFilter === 'all' 
                        ? [...compareResult.criteria[matchCriteria].matched, 
                           ...compareResult.criteria[matchCriteria].oursOnly, 
                           ...compareResult.criteria[matchCriteria].cafe24Only]
                        : compareFilter === 'match'
                        ? compareResult.criteria[matchCriteria].matched
                        : compareFilter === 'cafe24_only'
                        ? compareResult.criteria[matchCriteria].cafe24Only
                        : [];
                      
                      return currentData.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                            데이터가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        currentData.map((row, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ 
                              padding: '10px 8px', 
                              fontFamily: 'monospace', 
                              fontSize: '12px',
                              color: row.cafe24Ip === '-' ? '#999' : '#000'
                            }}>
                              {row.cafe24Ip}
                            </td>
                            <td style={{ 
                              padding: '10px 8px', 
                              textAlign: 'center',
                              borderRight: '2px solid #e8e8e8',
                              color: row.cafe24Time === '-' ? '#999' : '#000'
                            }}>
                              {row.cafe24Time}
                            </td>
                            <td style={{ 
                              padding: '10px 8px', 
                              fontFamily: 'monospace', 
                              fontSize: '12px',
                              color: row.oursIp === '-' ? '#999' : '#000'
                            }}>
                              {row.oursIp}
                            </td>
                            <td style={{ 
                              padding: '10px 8px', 
                              textAlign: 'center',
                              borderRight: '1px solid #e8e8e8',
                              color: row.oursTime === '-' ? '#999' : '#000'
                            }}>
                              {row.oursTime}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              {row.status === 'match' && <span style={{ color: '#52c41a' }}>✅</span>}
                              {row.status === 'ours_only' && <span style={{ color: '#fa541c' }}>❌</span>}
                              {row.status === 'cafe24_only' && <span style={{ color: '#faad14' }}>⚠️</span>}
                            </td>
                          </tr>
                        ))
                      );
                    })()}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

export default VisitorAnalysis;
