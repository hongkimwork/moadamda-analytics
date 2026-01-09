import { useState } from 'react';
import { Card, Typography, Input, Button, Table, Tag, Row, Col, Statistic, message } from 'antd';
import { 
  SwapOutlined, 
  CheckCircleOutlined, 
  WarningOutlined, 
  CloseCircleOutlined,
  InboxOutlined 
} from '@ant-design/icons';

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
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('all');

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

    setLoading(true);
    try {
      const response = await fetch('/api/stats/cafe24-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visits })
      });

      if (!response.ok) {
        throw new Error('API 요청 실패');
      }

      const data = await response.json();
      setResults(data.results);
      setSummary(data.summary);
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
      title: '카페24 IP',
      dataIndex: ['cafe24', 'ip'],
      width: 130,
      render: (ip) => <Text code>{ip}</Text>
    },
    {
      title: '카페24 유입출처',
      dataIndex: ['cafe24', 'source'],
      width: 180,
      ellipsis: true
    },
    {
      title: '카페24 방문일시',
      dataIndex: ['cafe24', 'visitTime'],
      width: 160
    },
    {
      title: '우리 시스템 IP',
      dataIndex: ['ourSystem', 'ip'],
      width: 130,
      render: (ip) => ip ? <Text code>{ip}</Text> : <Text type="secondary">-</Text>
    },
    {
      title: '우리 시스템 유입출처',
      dataIndex: ['ourSystem', 'source'],
      width: 150,
      render: (source) => source || <Text type="secondary">-</Text>
    },
    {
      title: '우리 시스템 방문일시',
      dataIndex: ['ourSystem', 'visitTime'],
      width: 160,
      render: (time) => time || <Text type="secondary">-</Text>
    },
    {
      title: '상태',
      dataIndex: 'status',
      width: 100,
      fixed: 'right',
      render: (status, record) => renderStatusTag(status, record.statusText)
    }
  ];

  /**
   * 요약 카드 스타일
   */
  const getCardStyle = (type) => ({
    cursor: 'pointer',
    border: filter === type ? '2px solid #1890ff' : '1px solid #d9d9d9',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <SwapOutlined style={{ marginRight: '12px' }} />
        카페24 Data 비교
      </Title>

      {/* 데이터 입력 영역 */}
      <Card style={{ marginBottom: '24px' }}>
        <Title level={5}>📋 카페24 데이터 붙여넣기</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: '12px' }}>
          카페24 관리자에서 복사한 방문자 데이터를 그대로 붙여넣으세요. (IP / 유입출처 / 방문일시)
        </Text>
        <TextArea
          rows={8}
          value={inputData}
          onChange={(e) => setInputData(e.target.value)}
          placeholder={`예시:
211.118.110.139instagram.com2026-01-08 23:58:50
14.48.26.183Bookmark2026-01-08 23:55:39
121.132.172.101m.search.naver.com(네이버 모바일 브랜드검색):모아담다2026-01-08 23:52:00`}
          style={{ fontFamily: 'monospace', fontSize: '13px' }}
        />
        <Button 
          type="primary" 
          onClick={handleCompare} 
          loading={loading}
          style={{ marginTop: '12px' }}
          disabled={!inputData.trim()}
        >
          비교 분석하기
        </Button>
      </Card>

      {/* 요약 카드 */}
      {summary && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card 
              style={getCardStyle('all')} 
              onClick={() => setFilter('all')}
              hoverable
            >
              <Statistic
                title="📥 입력"
                value={summary.total}
                suffix="건"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card 
              style={getCardStyle('match')} 
              onClick={() => setFilter('match')}
              hoverable
            >
              <Statistic
                title="✅ 일치"
                value={summary.match}
                suffix={`건 (${summary.total > 0 ? Math.round(summary.match / summary.total * 100) : 0}%)`}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card 
              style={getCardStyle('source_mismatch')} 
              onClick={() => setFilter('source_mismatch')}
              hoverable
            >
              <Statistic
                title="⚠️ 유입불일치"
                value={summary.sourceMismatch}
                suffix={`건 (${summary.total > 0 ? Math.round(summary.sourceMismatch / summary.total * 100) : 0}%)`}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card 
              style={getCardStyle('not_found')} 
              onClick={() => setFilter('not_found')}
              hoverable
            >
              <Statistic
                title="❌ 미수집"
                value={summary.notFound}
                suffix={`건 (${summary.total > 0 ? Math.round(summary.notFound / summary.total * 100) : 0}%)`}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 비교 결과 테이블 */}
      {results && (
        <Card>
          <Title level={5}>📋 상세 비교 결과</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: '12px' }}>
            * 매칭 기준: IP + 방문일시 (±3초 오차 허용)
          </Text>
          <Table
            columns={columns}
            dataSource={getFilteredResults()}
            rowKey={(record, index) => index}
            scroll={{ x: 1100 }}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `총 ${total}건` }}
            size="small"
          />
        </Card>
      )}
    </div>
  );
}

export default Cafe24Compare;
