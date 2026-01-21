import React, { useState } from 'react';
import { Card, Typography, DatePicker, Button, Select, Space, Spin, message, Table, Checkbox } from 'antd';
import { DatabaseOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3003';

/**
 * 카페24 Data 비교 페이지
 * 카페24 EC로그의 최근 방문자 데이터와 우리 DB 데이터를 비교
 */
function OurDataCompare() {
  // 상태 관리
  const [loading, setLoading] = useState(false);
  const [cafe24Text, setCafe24Text] = useState('');
  const [dateRange, setDateRange] = useState([dayjs(), dayjs()]);
  const [tableType, setTableType] = useState('pageviews');
  const [matchCriteria, setMatchCriteria] = useState('ip_only');
  const [removeDuplicates, setRemoveDuplicates] = useState(false);
  
  // 결과 상태
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // all, matched, cafe24Only, dbOnly
  const [currentPage, setCurrentPage] = useState(1);

  /**
   * 카페24 데이터 파싱
   * 탭 구분: IP주소 \t 유입경로 \t 방문시간
   */
  const parseCafe24Data = (text) => {
    if (!text.trim()) return [];
    
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.trim().split('\n');
    const parsed = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      const parts = trimmedLine.split('\t');
      if (parts.length >= 3) {
        const ip = parts[0].trim();
        const referrer = parts[1].trim();
        const visitTime = parts[2].trim();
        
        // IP 형식 검증
        if (ip && visitTime && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
          parsed.push({ ip, referrer, visitTime });
        }
      }
    }
    
    return parsed;
  };

  /**
   * 비교 실행
   */
  const handleCompare = async () => {
    if (!cafe24Text.trim()) {
      message.warning('카페24 데이터를 붙여넣어 주세요.');
      return;
    }

    if (!dateRange[0] || !dateRange[1]) {
      message.warning('조회 기간을 선택해 주세요.');
      return;
    }

    const cafe24Data = parseCafe24Data(cafe24Text);
    if (cafe24Data.length === 0) {
      message.error('유효한 카페24 데이터가 없습니다. 형식을 확인해 주세요.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/stats/validation/compare-cafe24`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafe24Data,
          startDate: dateRange[0].format('YYYY-MM-DD'),
          endDate: dateRange[1].format('YYYY-MM-DD'),
          tableType,
          matchCriteria,
          timeToleranceSeconds: 60,
          removeDuplicates
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      setActiveTab('all');
      message.success(`비교 완료! 일치율: ${data.summary.matchRate}%`);

    } catch (error) {
      console.error('Compare failed:', error);
      message.error('비교 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 결과 데이터 가져오기 (탭별)
   */
  const getDisplayData = () => {
    if (!result) return [];

    switch (activeTab) {
      case 'matched':
        return result.matched.map((item, idx) => ({
          key: idx,
          cafe24Ip: item.cafe24?.ip || '-',
          cafe24Referrer: item.cafe24?.referrer || '-',
          cafe24Time: item.cafe24?.visitTime || '-',
          dbIp: item.db?.ip || '-',
          dbReferrer: item.db?.referrer || '-',
          dbTime: item.db?.visitTime || '-',
          status: 'matched'
        }));
      
      case 'cafe24Only':
        return result.cafe24Only.map((item, idx) => ({
          key: idx,
          cafe24Ip: item.cafe24?.ip || '-',
          cafe24Referrer: item.cafe24?.referrer || '-',
          cafe24Time: item.cafe24?.visitTime || '-',
          dbIp: '-',
          dbReferrer: '-',
          dbTime: '-',
          status: 'cafe24Only'
        }));
      
      case 'dbOnly':
        return result.dbOnly.map((item, idx) => ({
          key: idx,
          cafe24Ip: '-',
          cafe24Referrer: '-',
          cafe24Time: '-',
          dbIp: item.db?.ip || '-',
          dbReferrer: item.db?.referrer || '-',
          dbTime: item.db?.visitTime || '-',
          status: 'dbOnly'
        }));
      
      default: // all
        return [
          ...result.matched.map((item, idx) => ({
            key: `m-${idx}`,
            cafe24Ip: item.cafe24?.ip || '-',
            cafe24Referrer: item.cafe24?.referrer || '-',
            cafe24Time: item.cafe24?.visitTime || '-',
            dbIp: item.db?.ip || '-',
            dbReferrer: item.db?.referrer || '-',
            dbTime: item.db?.visitTime || '-',
            status: 'matched'
          })),
          ...result.cafe24Only.map((item, idx) => ({
            key: `c-${idx}`,
            cafe24Ip: item.cafe24?.ip || '-',
            cafe24Referrer: item.cafe24?.referrer || '-',
            cafe24Time: item.cafe24?.visitTime || '-',
            dbIp: '-',
            dbReferrer: '-',
            dbTime: '-',
            status: 'cafe24Only'
          })),
          ...result.dbOnly.map((item, idx) => ({
            key: `d-${idx}`,
            cafe24Ip: '-',
            cafe24Referrer: '-',
            cafe24Time: '-',
            dbIp: item.db?.ip || '-',
            dbReferrer: item.db?.referrer || '-',
            dbTime: item.db?.visitTime || '-',
            status: 'dbOnly'
          }))
        ];
    }
  };

  /**
   * 상태 아이콘 렌더링
   */
  const renderStatus = (status) => {
    switch (status) {
      case 'matched':
        return <span style={{ color: '#52c41a', fontSize: '16px' }}>🟢</span>;
      case 'cafe24Only':
        return <span style={{ color: '#ff4d4f', fontSize: '16px' }}>🔴</span>;
      case 'dbOnly':
        return <span style={{ color: '#faad14', fontSize: '16px' }}>🟡</span>;
      default:
        return '-';
    }
  };

  /**
   * 테이블 컬럼 정의
   */
  const columns = [
    {
      title: '카페24 데이터',
      children: [
        {
          title: 'IP',
          dataIndex: 'cafe24Ip',
          key: 'cafe24Ip',
          width: 130,
          align: 'center',
          render: (text) => (
            <span style={{ 
              fontFamily: 'monospace', 
              fontSize: '12px',
              color: text === '-' ? '#999' : '#000'
            }}>
              {text}
            </span>
          )
        },
        {
          title: '유입경로',
          dataIndex: 'cafe24Referrer',
          key: 'cafe24Referrer',
          width: 120,
          align: 'center',
          render: (text) => (
            <span style={{ color: text === '-' ? '#999' : '#000' }}>{text}</span>
          )
        },
        {
          title: '방문일시',
          dataIndex: 'cafe24Time',
          key: 'cafe24Time',
          width: 160,
          align: 'center',
          render: (text) => (
            <span style={{ fontSize: '12px', color: text === '-' ? '#999' : '#000' }}>{text}</span>
          )
        }
      ]
    },
    {
      title: '우리 DB 데이터',
      children: [
        {
          title: 'IP',
          dataIndex: 'dbIp',
          key: 'dbIp',
          width: 130,
          align: 'center',
          render: (text) => (
            <span style={{ 
              fontFamily: 'monospace', 
              fontSize: '12px',
              color: text === '-' ? '#999' : '#000'
            }}>
              {text}
            </span>
          )
        },
        {
          title: '유입경로',
          dataIndex: 'dbReferrer',
          key: 'dbReferrer',
          width: 120,
          align: 'center',
          render: (text) => (
            <span style={{ color: text === '-' ? '#999' : '#000' }}>{text}</span>
          )
        },
        {
          title: '방문일시',
          dataIndex: 'dbTime',
          key: 'dbTime',
          width: 160,
          align: 'center',
          render: (text) => (
            <span style={{ fontSize: '12px', color: text === '-' ? '#999' : '#000' }}>{text}</span>
          )
        }
      ]
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 60,
      align: 'center',
      render: renderStatus
    }
  ];

  /**
   * 날짜 프리셋
   */
  const datePresets = [
    { label: '오늘', value: [dayjs(), dayjs()] },
    { label: '어제', value: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
    { label: '최근 7일', value: [dayjs().subtract(6, 'day'), dayjs()] }
  ];

  return (
    <div style={{ padding: '40px 24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* 데이터 입력 영역 */}
        <Card style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <Space>
              <DatabaseOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
              <Title level={5} style={{ margin: 0 }}>카페24 데이터 붙여넣기</Title>
            </Space>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates)}
              format="YYYY-MM-DD"
              presets={datePresets}
              allowClear={false}
            />
          </div>
          
          <textarea
            placeholder={`카페24 EC로그 > 최근 방문자 데이터를 복사하여 붙여넣어 주세요\n\n예시:\n14.48.17.119\tinstagram.com\t2026-01-20 23:56:13\n211.110.2.188\tinstagram.com\t2026-01-20 23:54:13`}
            value={cafe24Text}
            onChange={(e) => setCafe24Text(e.target.value)}
            style={{
              width: '100%',
              height: '150px',
              padding: '12px',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '12px',
              resize: 'vertical'
            }}
          />

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleCompare}
              loading={loading}
              size="large"
            >
              비교하기
            </Button>
          </div>
        </Card>

        {/* 결과 영역 (비교 후에만 표시) */}
        {result && (
          <Card>
            {/* 요약 카드 */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              marginBottom: '16px',
              flexWrap: 'nowrap',
              justifyContent: 'space-between'
            }}>
              {/* 카페24 전체 입력 */}
              <div
                onClick={() => {
                  setActiveTab('all');
                  setCurrentPage(1);
                }}
                style={{
                  flex: 1,
                  padding: '16px 20px',
                  borderRadius: '8px',
                  backgroundColor: activeTab === 'all' ? '#e6f7ff' : '#fafafa',
                  border: activeTab === 'all' ? '2px solid #1890ff' : '1px solid #d9d9d9',
                  cursor: 'pointer',
                  textAlign: 'center',
                  minWidth: '110px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 600 }}>📋 카페24 전체</div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '24px', fontWeight: 600 }}>{result.summary.cafe24Total}</span>
                  {result.summary.cafe24DuplicatesRemoved > 0 && (
                    <span style={{ fontSize: '11px', color: '#8c8c8c', marginLeft: '6px' }}>
                      (중복 {result.summary.cafe24DuplicatesRemoved}건 제거)
                    </span>
                  )}
                </div>
              </div>

              {/* 양쪽 일치 */}
              <div
                onClick={() => {
                  setActiveTab('matched');
                  setCurrentPage(1);
                }}
                style={{
                  flex: 1,
                  padding: '16px 20px',
                  borderRadius: '8px',
                  backgroundColor: activeTab === 'matched' ? '#f6ffed' : '#fafafa',
                  border: activeTab === 'matched' ? '2px solid #52c41a' : '1px solid #d9d9d9',
                  cursor: 'pointer',
                  textAlign: 'center',
                  minWidth: '110px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 600 }}>🟢 양쪽 일치</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#52c41a' }}>
                  {result.summary.matchedCount}
                  <span style={{ fontSize: '14px', fontWeight: 400, marginLeft: '4px' }}>
                    ({result.summary.matchRate}%)
                  </span>
                </div>
              </div>

              {/* 카페24에만 있음 */}
              <div
                onClick={() => {
                  setActiveTab('cafe24Only');
                  setCurrentPage(1);
                }}
                style={{
                  flex: 1,
                  padding: '16px 20px',
                  borderRadius: '8px',
                  backgroundColor: activeTab === 'cafe24Only' ? '#fff1f0' : '#fafafa',
                  border: activeTab === 'cafe24Only' ? '2px solid #ff4d4f' : '1px solid #d9d9d9',
                  cursor: 'pointer',
                  textAlign: 'center',
                  minWidth: '110px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 600 }}>🔴 카페24에만</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#ff4d4f' }}>
                  {result.summary.cafe24OnlyCount}
                  <span style={{ fontSize: '14px', fontWeight: 400, marginLeft: '4px' }}>
                    ({((result.summary.cafe24OnlyCount / result.summary.cafe24Total) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* 우리DB에만 있음 */}
              <div
                onClick={() => {
                  setActiveTab('dbOnly');
                  setCurrentPage(1);
                }}
                style={{
                  flex: 1,
                  padding: '16px 20px',
                  borderRadius: '8px',
                  backgroundColor: activeTab === 'dbOnly' ? '#fffbe6' : '#fafafa',
                  border: activeTab === 'dbOnly' ? '2px solid #faad14' : '1px solid #d9d9d9',
                  cursor: 'pointer',
                  textAlign: 'center',
                  minWidth: '110px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 600 }}>🟡 우리DB에만</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#faad14' }}>
                  {result.summary.dbOnlyCount}
                  <span style={{ fontSize: '14px', fontWeight: 400, marginLeft: '4px' }}>
                    ({((result.summary.dbOnlyCount / result.summary.dbTotal) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* 드롭다운 옵션 */}
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              marginBottom: '16px',
              padding: '12px 16px',
              backgroundColor: '#fafafa',
              borderRadius: '6px',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <div>
                <Text type="secondary" style={{ marginRight: 8 }}>조회 테이블:</Text>
                <Select
                  value={tableType}
                  onChange={setTableType}
                  style={{ width: 120 }}
                  options={[
                    { value: 'pageviews', label: '페이지뷰' },
                    { value: 'sessions', label: '세션' }
                  ]}
                />
              </div>
              <div>
                <Text type="secondary" style={{ marginRight: 8 }}>비교 기준:</Text>
                <Select
                  value={matchCriteria}
                  onChange={setMatchCriteria}
                  style={{ width: 160 }}
                  options={[
                    { value: 'ip_only', label: 'IP만' },
                    { value: 'ip_time', label: 'IP + 시간(±60초)' },
                    { value: 'ip_referrer', label: 'IP + 유입경로' },
                    { value: 'all', label: '전체(±60초)' }
                  ]}
                />
              </div>
              <div>
                <Checkbox
                  checked={removeDuplicates}
                  onChange={(e) => setRemoveDuplicates(e.target.checked)}
                >
                  <Text type="secondary">IP 중복 제거</Text>
                </Checkbox>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Text type="secondary">
                  일치율: <Text strong style={{ color: '#1890ff' }}>{result.summary.matchRate}%</Text>
                  {' '}| 우리DB 총: <Text strong>{result.summary.dbTotal}</Text>건
                  {result.summary.duplicatesRemoved > 0 && (
                    <span> | 중복 제거: <Text strong style={{ color: '#8c8c8c' }}>{result.summary.duplicatesRemoved}</Text>건</span>
                  )}
                </Text>
              </div>
            </div>

            {/* 결과 테이블 */}
            <Table
              columns={columns}
              dataSource={getDisplayData()}
              loading={loading}
              pagination={{
                current: currentPage,
                pageSize: 50,
                showSizeChanger: true,
                pageSizeOptions: ['20', '50', '100', '200'],
                showTotal: (total) => `총 ${total}건`,
                onChange: (page) => setCurrentPage(page)
              }}
              size="small"
              bordered
              scroll={{ x: 900 }}
              locale={{
                emptyText: '데이터가 없습니다.'
              }}
            />
          </Card>
        )}

        {/* 로딩 오버레이 */}
        {loading && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <Spin size="large" tip="비교 중..." />
          </div>
        )}
      </div>
    </div>
  );
}

export default OurDataCompare;
