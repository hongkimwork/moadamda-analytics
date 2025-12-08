import { Modal, Table, Typography, Spin, Empty, Row, Col, Card, Progress, Tooltip } from 'antd';
import { FileSearchOutlined, ExportOutlined, ShoppingCartOutlined, UserOutlined, ClockCircleOutlined, EyeOutlined, WarningOutlined, BulbOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { urlToKorean } from '../utils/urlToKorean';
import { useUserMappings } from '../hooks/useUserMappings';

const { Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * CreativeLandingModal - 광고 소재별 랜딩페이지 분석 모달
 *
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 핸들러
 * @param {object} creative - 광고 소재 정보 { creative_name, utm_source, utm_medium, utm_campaign }
 * @param {object} dateRange - 조회 기간 { start, end }
 */
function CreativeLandingModal({ visible, onClose, creative, dateRange }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const { userMappings } = useUserMappings();

  // 모달이 열릴 때 데이터 조회
  useEffect(() => {
    if (visible && creative) {
      fetchLandingPages();
    }
  }, [visible, creative]);

  const fetchLandingPages = async () => {
    if (!creative || !dateRange) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/creative-performance/landing-pages`, {
        creative_name: creative.creative_name,
        utm_source: creative.utm_source,
        utm_medium: creative.utm_medium,
        utm_campaign: creative.utm_campaign,
        start: dateRange.start,
        end: dateRange.end
      });

      if (response.data.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('랜딩페이지 분석 조회 실패:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // 시간 포맷팅 (초 → 분:초)
  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0초';
    const numSeconds = parseInt(seconds);
    if (numSeconds < 60) return `${numSeconds}초`;
    const minutes = Math.floor(numSeconds / 60);
    const remainSeconds = numSeconds % 60;
    if (remainSeconds === 0) return `${minutes}분`;
    return `${minutes}분 ${remainSeconds}초`;
  };

  // 숫자 포맷팅
  const formatNumber = (num) => {
    if (!num && num !== 0) return '0';
    return parseInt(num).toLocaleString();
  };

  // 페이지명 변환 (한글 매핑 우선)
  const getPageName = (pageUrl, pageTitle) => {
    // 1. URL 매핑에서 한글명 찾기
    const urlInfo = urlToKorean(pageUrl, userMappings);
    if (urlInfo.name && urlInfo.name !== pageUrl) {
      return urlInfo.name;
    }
    
    // 2. page_title 사용 (기본 제목 제외)
    if (pageTitle && 
        pageTitle !== '모아담다 온라인 공식몰' && 
        pageTitle !== '모아담다' &&
        !pageTitle.includes('모아담다 온라인')) {
      return pageTitle;
    }
    
    // 3. URL에서 의미 있는 부분 추출
    try {
      const url = new URL(pageUrl);
      const path = url.pathname;
      
      // 특정 패턴 인식
      if (path.includes('/product/') || path.includes('/goods/')) {
        return '상품 상세';
      } else if (path.includes('/cart') || path.includes('/basket')) {
        return '장바구니';
      } else if (path.includes('/order') || path.includes('/checkout')) {
        return '주문/결제';
      } else if (path.includes('/category') || path.includes('/list')) {
        return '카테고리';
      } else if (path === '/' || path === '') {
        return '메인 페이지';
      }
      
      // 경로의 마지막 부분 반환
      const parts = path.split('/').filter(Boolean);
      if (parts.length > 0) {
        return parts[parts.length - 1];
      }
    } catch (e) {
      // URL 파싱 실패 시
    }
    
    return pageUrl;
  };

  // 순위 메달 렌더링
  const renderRankMedal = (rank) => {
    const colors = {
      1: { bg: '#faad14', color: 'white' },  // 금
      2: { bg: '#bfbfbf', color: 'white' },  // 은
      3: { bg: '#d48806', color: 'white' }   // 동
    };
    const style = colors[rank] || { bg: '#f0f0f0', color: '#595959' };
    
    return (
      <div style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: style.bg,
        color: style.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700
      }}>
        {rank}
      </div>
    );
  };

  // 개선 힌트 아이콘
  const getHintIcon = (hint) => {
    if (hint.includes('결제') || hint.includes('유도')) {
      return <WarningOutlined style={{ color: '#faad14' }} />;
    }
    return <BulbOutlined style={{ color: '#1890ff' }} />;
  };

  // 많이 본 페이지 테이블 컬럼
  const topPagesColumns = [
    {
      title: '순위',
      dataIndex: 'rank',
      key: 'rank',
      width: 60,
      align: 'center',
      render: (rank) => renderRankMedal(rank)
    },
    {
      title: '페이지명',
      dataIndex: 'page_url',
      key: 'page_name',
      ellipsis: true,
      render: (url, record) => (
        <Text ellipsis={{ tooltip: url }} style={{ fontSize: 13 }}>
          {getPageName(url, record.page_title)}
        </Text>
      )
    },
    {
      title: (
        <Tooltip title="이 페이지를 본 방문자 수">
          <span>방문자 수 <QuestionCircleOutlined style={{ fontSize: 11, color: '#bfbfbf' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'visitor_count',
      key: 'visitor_count',
      width: 90,
      align: 'center',
      render: (val) => <Text strong>{formatNumber(val)}명</Text>
    },
    {
      title: '비율',
      dataIndex: 'visitor_ratio',
      key: 'visitor_ratio',
      width: 100,
      align: 'center',
      render: (val) => (
        <Progress 
          percent={val} 
          size="small" 
          strokeColor="#1890ff"
          format={(p) => `${p}%`}
        />
      )
    },
    {
      title: (
        <Tooltip title="이 페이지에서 평균적으로 머문 시간">
          <span>평균 체류 <QuestionCircleOutlined style={{ fontSize: 11, color: '#bfbfbf' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'avg_time_spent',
      key: 'avg_time_spent',
      width: 90,
      align: 'center',
      render: (val) => <Text style={{ color: '#595959' }}>{formatDuration(val)}</Text>
    }
  ];

  // 이탈 페이지 테이블 컬럼
  const exitPagesColumns = [
    {
      title: '순위',
      dataIndex: 'rank',
      key: 'rank',
      width: 50,
      align: 'center',
      render: (rank) => renderRankMedal(rank)
    },
    {
      title: '페이지명',
      dataIndex: 'page_url',
      key: 'page_name',
      ellipsis: true,
      render: (url) => (
        <Text ellipsis={{ tooltip: url }} style={{ fontSize: 13 }}>
          {getPageName(url, null)}
        </Text>
      )
    },
    {
      title: '이탈 수',
      dataIndex: 'exit_count',
      key: 'exit_count',
      width: 70,
      align: 'center',
      render: (val) => <Text style={{ color: '#cf1322', fontWeight: 500 }}>{formatNumber(val)}명</Text>
    },
    {
      title: (
        <Tooltip title="이 페이지를 마지막으로 보고 나간 비율">
          <span>이탈률 <QuestionCircleOutlined style={{ fontSize: 11, color: '#bfbfbf' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'exit_rate',
      key: 'exit_rate',
      width: 80,
      align: 'center',
      render: (val) => (
        <Text style={{ 
          color: val >= 30 ? '#cf1322' : val >= 15 ? '#faad14' : '#52c41a',
          fontWeight: 600
        }}>
          {val}%
        </Text>
      )
    },
    {
      title: '개선 힌트',
      dataIndex: 'improvement_hint',
      key: 'improvement_hint',
      width: 130,
      render: (hint) => (
        <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          {getHintIcon(hint)} {hint}
        </span>
      )
    }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileSearchOutlined style={{ fontSize: '20px', color: '#13c2c2' }} />
          <span>페이지 분석</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      style={{ top: '2.5vh' }}
      styles={{
        body: { 
          padding: '16px 24px', 
          height: 'calc(95vh - 60px)',
          overflowY: 'auto' 
        }
      }}
    >
      <Spin spinning={loading}>
        {/* 광고 소재 정보 */}
        {creative && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #e6fffb 0%, #b5f5ec 100%)',
            borderRadius: '8px',
            border: '1px solid #87e8de'
          }}>
            <div style={{ 
              fontSize: '15px', 
              fontWeight: 600, 
              color: '#006d75',
              marginBottom: '4px'
            }}>
              {creative.creative_name}
            </div>
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
              {creative.utm_source} / {creative.utm_medium} / {creative.utm_campaign}
            </div>
          </div>
        )}

        {data ? (
          <>
            {/* 섹션 1: 요약 통계 */}
            <Row gutter={12} style={{ marginBottom: '20px' }}>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <Tooltip title="한 사람이 평균적으로 본 페이지 수예요">
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, cursor: 'help' }}>
                      <EyeOutlined style={{ marginRight: 4 }} />
                      평균 페이지뷰 <QuestionCircleOutlined style={{ fontSize: 10 }} />
                    </div>
                  </Tooltip>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#1890ff' }}>
                    {data.summary?.avg_pageviews || 0}
                  </div>
                  <div style={{ fontSize: 11, color: '#bfbfbf' }}>페이지</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <Tooltip title="한 사람이 평균적으로 머문 시간이에요">
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, cursor: 'help' }}>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      평균 체류시간 <QuestionCircleOutlined style={{ fontSize: 10 }} />
                    </div>
                  </Tooltip>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#722ed1' }}>
                    {formatDuration(data.summary?.avg_duration_seconds)}
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <Tooltip title="이 광고로 들어와서 1페이지만 보고 나간 비율이에요">
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, cursor: 'help' }}>
                      <ExportOutlined style={{ marginRight: 4 }} />
                      이탈률 <QuestionCircleOutlined style={{ fontSize: 10 }} />
                    </div>
                  </Tooltip>
                  <div style={{ 
                    fontSize: 24, 
                    fontWeight: 700, 
                    color: data.summary?.bounce_rate >= 50 ? '#cf1322' : 
                           data.summary?.bounce_rate >= 30 ? '#faad14' : '#52c41a'
                  }}>
                    {data.summary?.bounce_rate || 0}%
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <Tooltip title="이 광고로 들어와서 구매까지 이어진 비율이에요">
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, cursor: 'help' }}>
                      <ShoppingCartOutlined style={{ marginRight: 4 }} />
                      전환율 <QuestionCircleOutlined style={{ fontSize: 10 }} />
                    </div>
                  </Tooltip>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>
                    {data.summary?.conversion_rate || 0}%
                  </div>
                  <div style={{ fontSize: 11, color: '#bfbfbf' }}>
                    총 {formatNumber(data.summary?.total_visitors)}명 방문
                  </div>
                </Card>
              </Col>
            </Row>

            {/* 섹션 2: 많이 본 페이지 TOP 10 */}
            <Card 
              size="small" 
              style={{ marginBottom: '16px', borderRadius: 8 }}
              title={<span style={{ fontSize: 14, fontWeight: 600 }}>👀 많이 본 페이지 TOP 10</span>}
            >
              {data.top_pages?.length > 0 ? (
                <Table
                  columns={topPagesColumns}
                  dataSource={data.top_pages}
                  rowKey="rank"
                  size="small"
                  pagination={false}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="페이지뷰 데이터 없음" />
              )}
            </Card>

            {/* 섹션 3: 이탈이 많은 페이지 TOP 5 */}
            <Card 
              size="small" 
              style={{ marginBottom: '16px', borderRadius: 8 }}
              title={<span style={{ fontSize: 14, fontWeight: 600 }}>🚪 이탈이 많은 페이지 TOP 5</span>}
            >
              {data.exit_pages?.length > 0 ? (
                <Table
                  columns={exitPagesColumns}
                  dataSource={data.exit_pages}
                  rowKey="rank"
                  size="small"
                  pagination={false}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="이탈 데이터 없음" />
              )}
            </Card>

            {/* 섹션 4: 구매자 vs 비구매자 비교 */}
            <Card 
              size="small" 
              style={{ marginBottom: '16px', borderRadius: 8 }}
              title={<span style={{ fontSize: 14, fontWeight: 600 }}>🔍 구매자 vs 비구매자 비교</span>}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{
                    padding: '16px',
                    background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
                    borderRadius: 8,
                    border: '1px solid #b7eb8f'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      marginBottom: 12,
                      color: '#389e0d',
                      fontWeight: 600
                    }}>
                      <ShoppingCartOutlined />
                      구매자 ({formatNumber(data.purchaser_comparison?.purchasers?.count)}명)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#595959' }}>평균 페이지뷰</span>
                        <span style={{ fontWeight: 600, color: '#389e0d' }}>
                          {data.purchaser_comparison?.purchasers?.avg_pageviews || 0} 페이지
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#595959' }}>평균 체류시간</span>
                        <span style={{ fontWeight: 600, color: '#389e0d' }}>
                          {formatDuration(data.purchaser_comparison?.purchasers?.avg_duration)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#595959' }}>상품 상세 방문</span>
                        <span style={{ fontWeight: 600, color: '#389e0d' }}>
                          평균 {data.purchaser_comparison?.purchasers?.avg_product_views || 0}회
                        </span>
                      </div>
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{
                    padding: '16px',
                    background: '#fafafa',
                    borderRadius: 8,
                    border: '1px solid #e8e8e8'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      marginBottom: 12,
                      color: '#8c8c8c',
                      fontWeight: 600
                    }}>
                      <UserOutlined />
                      비구매자 ({formatNumber(data.purchaser_comparison?.non_purchasers?.count)}명)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#595959' }}>평균 페이지뷰</span>
                        <span style={{ fontWeight: 600, color: '#8c8c8c' }}>
                          {data.purchaser_comparison?.non_purchasers?.avg_pageviews || 0} 페이지
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#595959' }}>평균 체류시간</span>
                        <span style={{ fontWeight: 600, color: '#8c8c8c' }}>
                          {formatDuration(data.purchaser_comparison?.non_purchasers?.avg_duration)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#595959' }}>상품 상세 방문</span>
                        <span style={{ fontWeight: 600, color: '#8c8c8c' }}>
                          평균 {data.purchaser_comparison?.non_purchasers?.avg_product_views || 0}회
                        </span>
                      </div>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* 인사이트 */}
            {data.insight && (
              <Card 
                size="small" 
                style={{ 
                  borderRadius: 8, 
                  background: '#fffbe6', 
                  border: '1px solid #ffe58f' 
                }}
              >
                <div style={{ fontSize: 13, color: '#ad6800' }}>
                  <BulbOutlined style={{ marginRight: 8, fontSize: 16 }} />
                  <strong>인사이트:</strong> {data.insight}
                </div>
              </Card>
            )}
          </>
        ) : !loading && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: '#8c8c8c' }}>
                페이지 분석 데이터를 불러올 수 없습니다
              </span>
            }
            style={{ padding: '60px 0' }}
          />
        )}

        {/* 조회 기간 표시 */}
        {dateRange && (
          <div style={{ 
            marginTop: '16px', 
            textAlign: 'center', 
            color: '#8c8c8c',
            fontSize: '12px'
          }}>
            조회 기간: {dateRange.start} ~ {dateRange.end}
          </div>
        )}
      </Spin>
    </Modal>
  );
}

export default CreativeLandingModal;

