/**
 * 주문 상세 페이지
 * 고객 여정 분석 및 상세 정보
 */

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, DatePicker, Button, Spin, Alert, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { TrendingUp } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useOrderDetail } from '../../hooks/useOrderDetail';
import { useJourneyExpansion } from '../../hooks/useJourneyExpansion';
import { useUserMappings } from '../../hooks/useUserMappings';
import { validateTimeSpent, findMatchingMapping } from '../../utils/orderAnalysis/dataTransform';
import { buildAllJourneys, filterPreviousVisits } from '../../utils/orderAnalysis/journeyCalculations';
import JourneyMiniCard from './components/JourneyMiniCard';
import JourneyTimeline from './components/JourneyTimeline';

dayjs.extend(relativeTime);

const { RangePicker } = DatePicker;

/**
 * OrderDetailPageContent 컴포넌트
 * 모달과 페이지에서 공통 사용
 */
export function OrderDetailPageContent({ orderId, userMappings = {}, onClose = null, matchingMode = 'default' }) {
  // FIX (2026-02-04): 기본값을 '전체'로 변경, UI 제거
  const [attributionWindow] = useState('all');
  const { data, loading, error } = useOrderDetail(orderId, attributionWindow, matchingMode);
  const { expandedJourneys, toggleJourney } = useJourneyExpansion(['purchase']);
  const [selectedDateRange, setSelectedDateRange] = useState(null);

  // URL 복사 핸들러
  const handleCopyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      message.success('URL이 클립보드에 복사되었습니다!');
    } catch (err) {
      console.error('복사 실패:', err);
      message.error('URL 복사에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip="주문 정보를 불러오는 중..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <Alert
            message="오류 발생"
            description={error}
            type="error"
            showIcon
          />
          {!onClose && (
            <Button
              type="primary"
              icon={<ArrowLeftOutlined />}
              onClick={() => window.history.back()}
              style={{ marginTop: '16px' }}
            >
              목록으로 돌아가기
            </Button>
          )}
        </Card>
      </div>
    );
  }

  // FIX (2026-02-05): IP 기반 UTM 히스토리를 별도로 받음 (참고 정보용)
  // FIX (2026-02-10): display_utm_history = 광고 클릭 카드 표시용 (구매 이후 UTM 포함)
  const { order, purchase_journey, previous_visits, page_path, utm_history, display_utm_history, ip_utm_history, past_purchases } = data;

  // 구매 직전 경로 (광고 클릭 후 ~ 구매까지)
  const journeyPages = purchase_journey?.pages || page_path || [];

  // 체류시간 필터링: 최대 10분(600초)으로 제한 (데이터 검증)
  const validJourneyPages = validateTimeSpent(journeyPages);

  // 데이터 검증 (백엔드가 제대로 처리했는지 확인)
  const overLimitPages = journeyPages.filter(p => p.time_spent_seconds > 600);
  if (overLimitPages.length > 0) {
    console.warn('[데이터 검증] 10분 초과 페이지 발견 (필터링 적용됨):', overLimitPages);
  }

  // 구매일 계산
  const purchaseDate = dayjs(order.timestamp).format('YYYY-MM-DD');

  // 이전 방문 필터링
  const filteredPreviousVisits = filterPreviousVisits(previous_visits, order.timestamp, selectedDateRange);

  // 모든 여정 통합 (광고 유입 시점 표시 + 이전 구매 감지 포함)
  // FIX (2026-02-10): 광고 클릭 카드에는 display_utm_history 사용 (구매 이후 UTM 포함)
  const allJourneys = buildAllJourneys(filteredPreviousVisits, validJourneyPages, purchaseDate, display_utm_history || utm_history || [], past_purchases || []);

  return (
    <div style={{ background: '#fafbfc', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더: 제목 + DatePicker + 미니 카드들 + 닫기 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        background: 'linear-gradient(to bottom, #ffffff 0%, #fafbfc 100%)',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        gap: '20px',
        overflowX: 'auto'
      }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '700',
              whiteSpace: 'nowrap',
              color: '#1f2937',
              letterSpacing: '-0.02em'
            }}>
              고객 여정 분석
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  fontSize: '13px', 
                  color: '#4b5563', 
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}>
                  날짜 선택 :
                </span>
                <RangePicker
                  placeholder={['시작 날짜', '종료 날짜']}
                  style={{
                    width: 280,
                    borderRadius: '8px',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                  }}
                  onChange={(dates) => setSelectedDateRange(dates)}
                  value={selectedDateRange}
                  allowClear
                  format="YYYY-MM-DD"
                />
              </div>
              
            </div>
          </div>

          {/* 미니 카드들 - 페이드 효과 wrapper */}
          <div style={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden'
          }}>
            {/* 좌측 페이드 */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '24px',
              background: 'linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))',
              zIndex: 1,
              pointerEvents: 'none'
            }} />
            {/* 우측 페이드 */}
            <div style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '24px',
              background: 'linear-gradient(to left, rgba(255,255,255,1), rgba(255,255,255,0))',
              zIndex: 1,
              pointerEvents: 'none'
            }} />
            <div style={{
              display: 'flex',
              gap: '10px',
              overflowX: 'auto',
              padding: '4px 28px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}>
              {allJourneys.map(journey => (
                <JourneyMiniCard
                  key={journey.id}
                  journey={journey}
                  isExpanded={expandedJourneys.includes(journey.id)}
                  onToggle={() => toggleJourney(journey.id)}
                />
              ))}
            </div>
          </div>
        </div>
        {onClose && (
          <Button
            type="text"
            icon={<span style={{ fontSize: '24px', lineHeight: 1 }}>×</span>}
            onClick={onClose}
            style={{
              fontSize: '24px',
              padding: '8px 12px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fee2e2';
              e.currentTarget.style.color = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(0, 0, 0, 0.45)';
            }}
          />
        )}
      </div>

      {/* 펼쳐진 여정 표시 영역 */}
      <div style={{
        flex: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '20px 24px',
        background: '#fafbfc'
      }}>
        {expandedJourneys.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 60px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e5e7eb',
            margin: '20px auto',
            maxWidth: '500px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <TrendingUp
                size={48}
                strokeWidth={1.5}
                style={{
                  color: '#9ca3af',
                  opacity: 0.6
                }}
              />
            </div>
            <p style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#374151',
              margin: '0 0 8px 0'
            }}>
              고객 여정을 선택해주세요
            </p>
            <p style={{
              fontSize: '14px',
              color: '#9ca3af',
              margin: 0
            }}>
              상단 카드를 클릭하여 상세한 여정을 확인할 수 있습니다
            </p>
          </div>
        ) : (
          (() => {
            const expandedJourneysList = allJourneys.filter(journey => expandedJourneys.includes(journey.id));

            return (
              <div style={{
                display: 'flex',
                gap: '20px',
                alignItems: 'flex-start',
                width: 'fit-content',
                margin: expandedJourneysList.length === 1 ? '0 auto' : '0'
              }}>
                {expandedJourneysList.map(journey => (
                  <JourneyTimeline
                    key={journey.id}
                    journey={journey}
                    userMappings={userMappings}
                    order={order}
                    findMatchingMapping={(productName) => findMatchingMapping(productName, userMappings)}
                  />
                ))}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}

/**
 * OrderDetailPage 컴포넌트
 * 라우팅용 래퍼
 */
export function OrderDetailPage() {
  const { orderId } = useParams();
  const { userMappings } = useUserMappings();

  return <OrderDetailPageContent orderId={orderId} userMappings={userMappings} />;
}

export default OrderDetailPage;
