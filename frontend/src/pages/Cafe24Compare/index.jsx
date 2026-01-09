import { useState } from 'react';
import { Card, Typography, Input, Button, Table, Tag, Row, Col, Statistic, message, DatePicker, Select } from 'antd';
import { 
  SwapOutlined, 
  CheckCircleOutlined, 
  WarningOutlined, 
  CloseCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * 카페24 Data 비교 페이지
 * 
 * 카페24에서 복사한 방문자 데이터(IP, 유입출처, 방문일시)를
 * 우리 시스템 데이터와 비교하는 기능
 */
function Cafe24Compare() {
  const [inputData, setInputData] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [pageSize, setPageSize] = useState(20);
  const [compareMode, setCompareMode] = useState('ip_time_only'); // 'ip_time_only' | 'ip_time_source'
  const [rawResults, setRawResults] = useState(null); // API 원본 결과 저장

  /**
   * 비교 모드 옵션
   */
  const compareModeOptions = [
    { value: 'ip_time_only', label: 'IP + 방문일시만 일치하면 일치로 판정' },
    { value: 'ip_time_source', label: 'IP + 방문일시 + 유입출처 모두 일치해야 일치로 판정' }
  ];

  /**
   * 유입출처 비교 (프론트엔드에서 재분류)
   */
  const compareSourceFlexible = (cafe24Source, ourSource, utmParams) => {
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
  };

  /**
   * 비교 모드에 따라 결과 재분류
   */
  const getProcessedResults = () => {
    if (!rawResults) return { results: null, summary: null };

    const processedResults = rawResults.map(r => {
      // 미수집이나 invalid는 그대로 유지
      if (r.status === 'not_found' || r.status === 'invalid') {
        return r;
      }

      // IP + 방문일시만 일치하면 일치로 판정 (유입출처 무시)
      if (compareMode === 'ip_time_only') {
        return {
          ...r,
          status: 'match',
          statusText: '일치'
        };
      }

      // IP + 방문일시 + 유입출처 모두 일치해야 일치로 판정
      const sourceMatch = compareSourceFlexible(r.cafe24.source, r.ourSystem?.source, r.ourSystem?.utmParams);

      return {
        ...r,
        status: sourceMatch ? 'match' : 'source_mismatch',
        statusText: sourceMatch ? '일치' : '유입불일치'
      };
    });

    // 요약 재계산
    const processedSummary = {
      total: processedResults.length,
      match: processedResults.filter(r => r.status === 'match').length,
      sourceMismatch: processedResults.filter(r => r.status === 'source_mismatch').length,
      notFound: processedResults.filter(r => r.status === 'not_found').length,
      invalid: processedResults.filter(r => r.status === 'invalid').length
    };

    return { results: processedResults, summary: processedSummary };
  };

  // 비교 모드 변경 시 결과 재계산
  const { results, summary } = getProcessedResults();

  /**
   * 카페24 데이터 파싱
   * 패턴: IP주소 + 유입출처 + 날짜시간
   */
  const parseInput = (text) => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const visits = [];

    for (const line of lines) {
      // IP 주소 패턴
      const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      // 날짜시간 패턴
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);

      if (ipMatch && dateMatch) {
        const ip = ipMatch[1];
        const visitTime = dateMatch[1];
        
        // IP와 날짜 사이의 텍스트가 유입출처
        const ipEnd = line.indexOf(ip) + ip.length;
        const dateStart = line.indexOf(visitTime);
        const source = line.substring(ipEnd, dateStart).trim();

        visits.push({ ip, source, visitTime });
      }
    }

    return visits;
  };

  /**
   * 비교 분석 실행
   */
  const handleCompare = async () => {
    const visits = parseInput(inputData);
    
    if (visits.length === 0) {
      message.error('파싱할 수 있는 데이터가 없습니다. 형식을 확인해주세요.');
      return;
    }

    if (!selectedDate) {
      message.error('비교할 날짜를 선택해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/stats/cafe24-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          visits,
          date: selectedDate.format('YYYY-MM-DD')
        })
      });

      if (!response.ok) {
        throw new Error('API 요청 실패');
      }

      const data = await response.json();
      setRawResults(data.results);
      setFilter('all');
      message.success(`${visits.length}건 비교 완료`);
    } catch (error) {
      console.error('비교 오류:', error);
      message.error('비교 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 필터링된 결과
   */
  const getFilteredResults = () => {
    if (!results) return [];
    if (filter === 'all') return results;
    return results.filter(r => r.status === filter);
  };

  /**
   * 상태별 태그 렌더링
   */
  const renderStatusTag = (status, statusText) => {
    const config = {
      match: { color: 'success', icon: <CheckCircleOutlined /> },
      source_mismatch: { color: 'warning', icon: <WarningOutlined /> },
      not_found: { color: 'error', icon: <CloseCircleOutlined /> },
      invalid: { color: 'default', icon: <CloseCircleOutlined /> }
    };
    const { color, icon } = config[status] || config.invalid;
    return <Tag color={color} icon={icon}>{statusText}</Tag>;
  };

  /**
   * 테이블 컬럼 정의
   */
  const columns = [
    {
      title: '카페24 원본 데이터',
      className: 'text-center border-r',
      children: [
        {
          title: 'IP',
          dataIndex: ['cafe24', 'ip'],
          width: 140,
          align: 'center',
          render: (ip) => <Text code>{ip}</Text>
        },
        {
          title: '유입출처',
          dataIndex: ['cafe24', 'source'],
          width: 200,
          align: 'center',
          ellipsis: true
        },
        {
          title: '방문일시',
          dataIndex: ['cafe24', 'visitTime'],
          width: 170,
          align: 'center'
        },
      ]
    },
    {
      title: '우리 시스템 데이터',
      className: 'text-center',
      children: [
        {
          title: 'IP',
          dataIndex: ['ourSystem', 'ip'],
          width: 140,
          align: 'center',
          className: 'border-l-2',
          render: (ip) => ip ? <Text code>{ip}</Text> : <Text type="secondary">-</Text>
        },
        {
          title: '유입출처',
          dataIndex: ['ourSystem', 'source'],
          width: 200,
          align: 'center',
          ellipsis: true,
          render: (source) => source || <Text type="secondary">-</Text>
        },
        {
          title: '방문일시',
          dataIndex: ['ourSystem', 'visitTime'],
          width: 170,
          align: 'center',
          render: (time) => time || <Text type="secondary">-</Text>
        },
      ]
    },
    {
      title: '상태',
      dataIndex: 'status',
      width: 100,
      align: 'center',
      render: (status, record) => renderStatusTag(status, record.statusText)
    }
  ];

  /**
   * 요약 카드 스타일
   */
  const getCardStyle = (type) => ({
    cursor: 'pointer',
    border: filter === type ? '2px solid #1890ff' : '1px solid #f0f0f0',
    transition: 'all 0.2s',
    borderRadius: '8px',
    boxShadow: filter === type ? '0 4px 12px rgba(24, 144, 255, 0.15)' : 'none'
  });

  return (
    <div style={{ padding: '24px 24px 60px 24px', maxWidth: '1300px', margin: '0 auto' }}>
      <Title level={2} style={{ marginBottom: '32px' }}>
        <SwapOutlined style={{ marginRight: '12px' }} />
        카페24 Data 비교
      </Title>

      {/* 데이터 입력 영역 */}
      <Card 
        style={{ marginBottom: '32px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        bodyStyle={{ padding: '24px' }}
      >
        <Row gutter={16} align="middle" style={{ marginBottom: '20px' }}>
          <Col flex="auto">
            <Title level={5} style={{ margin: 0 }}>📋 카페24 데이터 붙여넣기</Title>
          </Col>
          <Col>
            <Text type="secondary" style={{ marginRight: '8px' }}>비교 날짜:</Text>
            <DatePicker 
              value={selectedDate}
              onChange={setSelectedDate}
              allowClear={false}
            />
          </Col>
        </Row>
        <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
          카페24 관리자에서 복사한 방문자 데이터를 그대로 붙여넣으세요. (IP / 유입출처 / 방문일시)
        </Text>
        <TextArea
          rows={10}
          value={inputData}
          onChange={(e) => setInputData(e.target.value)}
          placeholder={`예시:
211.118.110.139instagram.com2026-01-08 23:58:50
14.48.26.183Bookmark2026-01-08 23:55:39
121.132.172.101m.search.naver.com(네이버 모바일 브랜드검색):모아담다2026-01-08 23:52:00`}
          style={{ fontFamily: 'monospace', fontSize: '13px', borderRadius: '8px', marginBottom: '20px' }}
        />
        <Button 
          type="primary" 
          size="large"
          onClick={handleCompare} 
          loading={loading}
          disabled={!inputData.trim()}
          block
          style={{ borderRadius: '8px', height: '48px', fontWeight: 'bold' }}
        >
          비교 분석하기
        </Button>
      </Card>

      {/* 요약 카드 */}
      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
          <Col xs={12} sm={6}>
            <Card 
              style={getCardStyle('all')} 
              onClick={() => setFilter('all')}
              hoverable
              bodyStyle={{ padding: '20px', textAlign: 'center' }}
            >
              <Statistic
                title="📥 전체 입력"
                value={summary.total}
                suffix="건"
                valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card 
              style={getCardStyle('match')} 
              onClick={() => setFilter('match')}
              hoverable
              bodyStyle={{ padding: '20px', textAlign: 'center' }}
            >
              <Statistic
                title="✅ 일치"
                value={summary.match}
                suffix={`건 (${summary.total > 0 ? Math.round(summary.match / summary.total * 100) : 0}%)`}
                valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card 
              style={getCardStyle('source_mismatch')} 
              onClick={() => setFilter('source_mismatch')}
              hoverable
              bodyStyle={{ padding: '20px', textAlign: 'center' }}
            >
              <Statistic
                title="⚠️ 유입 불일치"
                value={summary.sourceMismatch}
                suffix={`건 (${summary.total > 0 ? Math.round(summary.sourceMismatch / summary.total * 100) : 0}%)`}
                valueStyle={{ color: '#faad14', fontWeight: 'bold' }}
              />
            </Card>
            <Select
              value={compareMode}
              onChange={(value) => setCompareMode(value)}
              options={compareModeOptions}
              style={{ width: '100%', marginTop: '8px' }}
              size="small"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Card 
              style={getCardStyle('not_found')} 
              onClick={() => setFilter('not_found')}
              hoverable
              bodyStyle={{ padding: '20px', textAlign: 'center' }}
            >
              <Statistic
                title="❌ 미수집"
                value={summary.notFound}
                suffix={`건 (${summary.total > 0 ? Math.round(summary.notFound / summary.total * 100) : 0}%)`}
                valueStyle={{ color: '#ff4d4f', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 비교 결과 테이블 */}
      {results && (
        <Card 
          style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
          bodyStyle={{ padding: '24px' }}
        >
          <Title level={5} style={{ marginBottom: '4px' }}>📋 상세 비교 결과</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: '20px' }}>
            * 매칭 기준: IP + 방문일시 (±3초 오차 허용)
          </Text>
          <Table
            columns={columns}
            dataSource={getFilteredResults()}
            rowKey={(record, index) => index}
            pagination={{ 
              pageSize: pageSize, 
              onShowSizeChange: (current, size) => setPageSize(size),
              showSizeChanger: true, 
              showTotal: (total) => `총 ${total}건`,
              position: ['bottomCenter']
            }}
            size="middle"
            bordered
          />
        </Card>
      )}
    </div>
  );
}

export default Cafe24Compare;
