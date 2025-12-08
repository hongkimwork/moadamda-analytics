import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, Typography, Button, Modal, DatePicker, Space, Dropdown, Empty, Input, Radio, Steps, Checkbox, Spin } from 'antd';
import {
  AppstoreOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  DragOutlined,
  MoreOutlined,
  LockOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  DATA_SOURCES,
  WIDGET_PRESETS,
  DATE_PRESETS,
  getComparisonPeriod,
  WIDTH_SIZES,
  HEIGHT_SIZES,
  getWidthSizeFromCols,
  getHeightSizeFromPixels,
  WIDGET_TYPES
} from './constants';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  fetchWidgetData,
  getValueFromData,
  calculateChange,
  transformWidgetData,
  generateDummyData
} from './utils';
import {
  useContainerSize,
  useWidgetData,
  useWidgets,
  useWidgetPersistence
} from './hooks';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ============================================================================
// 개별 위젯 컴포넌트 (리사이즈 핸들 + 가이드 박스)
// ============================================================================
const DashboardWidget = ({ widget, onDelete, onEdit, onResize, containerWidth, containerRef }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null); // 'corner-left', 'corner-right', 'bottom'
  const [previewSize, setPreviewSize] = useState(null); // { cols, height }
  const widgetRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ cols: 1, height: 150 });
  
  const gap = 16;
  const colWidth = (containerWidth - gap * 2) / 3;
  
  // 현재 크기 계산
  const currentCols = WIDTH_SIZES[widget.widthSize]?.cols || 1;
  const currentHeight = HEIGHT_SIZES[widget.heightSize]?.height || 150;
  
  // 위젯 너비 계산
  const getWidthFromCols = (cols) => cols * colWidth + (cols - 1) * gap;
  
  const widgetWidth = getWidthFromCols(currentCols);
  const widgetHeight = currentHeight;
  
  // 리사이즈 시작
  const handleResizeStart = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startSizeRef.current = { cols: currentCols, height: currentHeight };
    setPreviewSize({ cols: currentCols, height: currentHeight });
  };
  
  // 리사이즈 중
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startPosRef.current.x;
      const deltaY = e.clientY - startPosRef.current.y;
      
      let newCols = startSizeRef.current.cols;
      let newHeight = startSizeRef.current.height;
      
      // 방향에 따라 크기 계산
      if (resizeDirection === 'corner-right') {
        // 우하단: 너비 + 높이
        const deltaColsRaw = deltaX / colWidth;
        newCols = Math.round(startSizeRef.current.cols + deltaColsRaw);
        newHeight = startSizeRef.current.height + deltaY;
      } else if (resizeDirection === 'corner-left') {
        // 좌하단: 너비 + 높이 (좌측으로 늘리면 너비 증가)
        const deltaColsRaw = -deltaX / colWidth;
        newCols = Math.round(startSizeRef.current.cols + deltaColsRaw);
        newHeight = startSizeRef.current.height + deltaY;
      } else if (resizeDirection === 'bottom') {
        // 하단 중앙: 높이만
        newHeight = startSizeRef.current.height + deltaY;
      }
      
      // 범위 제한
      newCols = Math.max(1, Math.min(3, newCols));
      
      // 높이 스냅 (short: 150, medium: 250, tall: 350)
      const heightSteps = [150, 250, 350];
      const closestHeight = heightSteps.reduce((prev, curr) => 
        Math.abs(curr - newHeight) < Math.abs(prev - newHeight) ? curr : prev
      );
      
      setPreviewSize({ cols: newCols, height: closestHeight });
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection(null);
      
      if (previewSize) {
        const newWidthSize = getWidthSizeFromCols(previewSize.cols);
        const newHeightSize = getHeightSizeFromPixels(previewSize.height);
        
        // 크기가 변경된 경우에만 업데이트
        if (newWidthSize !== widget.widthSize || newHeightSize !== widget.heightSize) {
          onResize(widget.id, newWidthSize, newHeightSize);
        }
      }
      
      setPreviewSize(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeDirection, previewSize, colWidth, widget.id, widget.widthSize, widget.heightSize, onResize]);
  
  // 위젯 타입별 렌더링
  const renderWidgetContent = () => {
    const contentHeight = widgetHeight - 57; // Card header 높이 제외
    
    // 로딩 상태
    if (widget.loading) {
      return (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: contentHeight
        }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        </div>
      );
    }

    // 에러 상태
    if (widget.error) {
      return (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: contentHeight,
          color: '#ff4d4f',
          fontSize: 13
        }}>
          데이터를 불러올 수 없습니다
        </div>
      );
    }

    // 데이터 없음
    if (!widget.data) {
      return (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: contentHeight,
          color: '#8c8c8c',
          fontSize: 13
        }}>
          데이터가 없습니다
        </div>
      );
    }
    
    switch (widget.type) {
      case 'kpi':
        // 비교 모드 확인 (compareValue가 숫자면 비교 모드)
        const hasCompare = widget.compareEnabled && (widget.data.compareValue !== null && widget.data.compareValue !== undefined);
        const changeValue = widget.data.change;
        const isNewData = changeValue === 'new';  // 이전 데이터 없음 (신규)
        const numericChange = isNewData ? 0 : (parseFloat(changeValue) || 0);
        
        // 날짜 포맷팅 (MM/DD 형식)
        const formatDateRange = (range) => {
          if (!range) return '';
          const start = range.start || '';
          const end = range.end || '';
          // YYYY-MM-DD → MM/DD 변환
          const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : dateStr;
          };
          return `${formatDate(start)}~${formatDate(end)}`;
        };
        
        const currentDateLabel = widget.dateRange ? formatDateRange(widget.dateRange) : '이번 기간';
        const compareDateLabel = widget.compareRange ? formatDateRange(widget.compareRange) : '이전 기간';
        
        return (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: contentHeight,
            padding: '10px 0'
          }}>
            {/* 비교 모드: 현재값 + 이전값 나란히 표시 */}
            {hasCompare ? (
              <>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 20,
                  width: '100%'
                }}>
                  {/* 현재 기간 */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#1890ff', marginBottom: 4, fontWeight: 500 }}>{currentDateLabel}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#1890ff' }}>
                      {widget.data.prefix}{(widget.data.value || 0).toLocaleString()}<span style={{ fontSize: 13 }}>{widget.data.suffix}</span>
                    </div>
                  </div>
                  
                  {/* 구분선 */}
                  <div style={{ 
                    width: 1, 
                    height: 40, 
                    background: '#e8e8e8' 
                  }} />
                  
                  {/* 이전 기간 */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, fontWeight: 500 }}>{compareDateLabel}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#8c8c8c' }}>
                      {widget.data.prefix}{(widget.data.compareValue || 0).toLocaleString()}<span style={{ fontSize: 13 }}>{widget.data.suffix}</span>
                    </div>
                  </div>
                </div>
                
                {/* 증감률 */}
                <div style={{ 
                  fontSize: 12, 
                  marginTop: 8,
                  padding: '3px 10px',
                  borderRadius: 10,
                  background: isNewData ? '#e6f7ff' : (numericChange >= 0 ? '#f6ffed' : '#fff2f0'),
                  color: isNewData ? '#1890ff' : (numericChange >= 0 ? '#52c41a' : '#ff4d4f')
                }}>
                  {isNewData ? (
                    '🆕 신규 (이전 데이터 없음)'
                  ) : (
                    <>
                      {numericChange >= 0 ? '▲' : '▼'} {Math.abs(numericChange)}%
                    </>
                  )}
                </div>
              </>
            ) : (
              /* 비교 없음: 기존 단일 값 표시 */
              <div style={{ fontSize: 36, fontWeight: 700, color: '#1890ff' }}>
                {widget.data.prefix}{(widget.data.value || 0).toLocaleString()}{widget.data.suffix}
              </div>
            )}
          </div>
        );
      
      case 'line':
        return (
          <div style={{ height: contentHeight, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: contentHeight - 30, gap: 8 }}>
              {widget.data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div 
                    style={{ 
                      width: '100%', 
                      height: `${(d.value / 1500) * (contentHeight - 50)}px`,
                      background: 'linear-gradient(180deg, #1890ff 0%, #69c0ff 100%)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: 20
                    }} 
                  />
                  <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 4 }}>{d.date}</div>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'bar':
        return (
          <div style={{ height: contentHeight, overflow: 'auto', padding: '10px 0' }}>
            {widget.data.map((d, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#262626' }}>{d.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{d.value.toLocaleString()}</span>
                </div>
                <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4 }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${(d.value / 6000) * 100}%`,
                      background: ['#1890ff', '#52c41a', '#722ed1', '#fa8c16'][i],
                      borderRadius: 4
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        );
      
      case 'table':
        // 프리셋별 테이블 렌더링
        if (widget.presetId === 'recent_orders') {
          return (
            <div style={{ height: contentHeight, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>주문번호</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>상품명</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>금액</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>경로</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 8px', fontSize: 11 }}>{row.order_id}</td>
                      <td style={{ padding: '6px 8px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.product_name}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                        {(row.final_payment || 0).toLocaleString()}원
                      </td>
                      <td style={{ padding: '6px 8px', fontSize: 11, color: '#8c8c8c' }}>{row.order_place}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        
        if (widget.presetId === 'top_products') {
          return (
            <div style={{ height: contentHeight, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, position: 'sticky', top: 0, background: 'white', width: 30 }}>#</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>상품명</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>주문</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>매출</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: i < 3 ? '#fa8c16' : '#8c8c8c' }}>{i + 1}</td>
                      <td style={{ padding: '6px 8px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.product_name}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{row.order_count}건</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                        {(row.revenue || 0).toLocaleString()}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // 기본 테이블 (기존 더미 데이터 호환)
        return (
          <div style={{ height: contentHeight, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>캠페인</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>방문자</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>주문</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>매출</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 12px' }}>{row.campaign}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{(row.visitors || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.orders}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                      {(row.revenue || 0).toLocaleString()}원
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      
      case 'funnel':
        return (
          <div style={{ height: contentHeight, overflow: 'auto', padding: '10px 0' }}>
            {widget.data.map((d, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{d.stage}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{d.value.toLocaleString()} ({d.rate}%)</span>
                </div>
                <div 
                  style={{ 
                    height: 24, 
                    background: `linear-gradient(90deg, #1890ff ${d.rate}%, #f0f0f0 ${d.rate}%)`,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 8
                  }}
                >
                  <span style={{ fontSize: 11, color: d.rate > 50 ? 'white' : '#8c8c8c' }}>
                    {d.rate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      
      case 'text':
        return (
          <div style={{ height: contentHeight, overflow: 'auto', padding: '10px 0' }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#262626' }}>
              {widget.data.title}
            </div>
            <div style={{ fontSize: 14, color: '#8c8c8c', lineHeight: 1.6 }}>
              {widget.data.content}
            </div>
          </div>
        );
      
      default:
        return <div>알 수 없는 위젯 타입</div>;
    }
  };

  // 더보기 메뉴
  const moreMenuItems = [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '편집',
      onClick: () => onEdit(widget)
    },
    {
      type: 'divider'
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '삭제',
      danger: true,
      onClick: () => onDelete(widget.id)
    }
  ];
  
  // 핸들 공통 스타일
  const handleBaseStyle = {
    position: 'absolute',
    zIndex: 10,
    display: isHovered || isResizing ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center'
  };

  return (
    <div 
      ref={widgetRef}
      style={{ 
        width: widgetWidth,
        height: widgetHeight,
        minWidth: 200,
        flexShrink: 0,
        position: 'relative'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => !isResizing && setIsHovered(false)}
    >
      {/* 원본 카드 */}
      <Card
        size="small"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 8,
          border: isHovered ? '1px solid #1890ff' : '1px solid #e8e8e8',
          boxShadow: isHovered ? '0 2px 8px rgba(24, 144, 255, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          overflow: 'hidden'
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DragOutlined style={{ color: '#bfbfbf', cursor: 'grab' }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{widget.title}</span>
          </div>
        }
        extra={
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
            <Button 
              type="text" 
              icon={<MoreOutlined />} 
              style={{ opacity: isHovered ? 1 : 0.3, transition: 'opacity 0.2s' }}
            />
          </Dropdown>
        }
        bodyStyle={{ padding: '0 12px', height: widgetHeight - 57, overflow: 'hidden' }}
      >
        {renderWidgetContent()}
      </Card>
      
      {/* 좌측 하단 리사이즈 핸들 (대각선) */}
      <div
        style={{
          ...handleBaseStyle,
          left: 0,
          bottom: 0,
          width: 20,
          height: 20,
          cursor: 'nesw-resize'
        }}
        onMouseDown={(e) => handleResizeStart(e, 'corner-left')}
      >
        <div style={{
          width: 10,
          height: 10,
          borderLeft: '2px solid #1890ff',
          borderBottom: '2px solid #1890ff',
          borderBottomLeftRadius: 2
        }} />
      </div>
      
      {/* 하단 중앙 리사이즈 핸들 (높이만) */}
      <div
        style={{
          ...handleBaseStyle,
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: 40,
          height: 16,
          cursor: 'ns-resize'
        }}
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
      >
        <div style={{
          width: 24,
          height: 4,
          background: '#1890ff',
          borderRadius: 2
        }} />
      </div>
      
      {/* 우측 하단 리사이즈 핸들 (대각선) */}
      <div
        style={{
          ...handleBaseStyle,
          right: 0,
          bottom: 0,
          width: 20,
          height: 20,
          cursor: 'nwse-resize'
        }}
        onMouseDown={(e) => handleResizeStart(e, 'corner-right')}
      >
        <div style={{
          width: 10,
          height: 10,
          borderRight: '2px solid #1890ff',
          borderBottom: '2px solid #1890ff',
          borderBottomRightRadius: 2
        }} />
      </div>
      
      {/* 리사이즈 가이드 박스 (투명한 파란색) */}
      {isResizing && previewSize && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: resizeDirection === 'corner-left' 
              ? -(getWidthFromCols(previewSize.cols) - widgetWidth) 
              : 0,
            width: getWidthFromCols(previewSize.cols),
            height: previewSize.height,
            background: 'rgba(24, 144, 255, 0.15)',
            border: '2px dashed #1890ff',
            borderRadius: 8,
            pointerEvents: 'none',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{
            background: '#1890ff',
            color: 'white',
            padding: '4px 12px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600
          }}>
            {WIDTH_SIZES[getWidthSizeFromCols(previewSize.cols)].label} × {HEIGHT_SIZES[getHeightSizeFromPixels(previewSize.height)].label}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 위젯 추가 모달 컴포넌트 (3단계 스텝)
// ============================================================================
const AddWidgetModal = ({ visible, onClose, onAdd, globalDateRange }) => {
  // Step 관리
  const [currentStep, setCurrentStep] = useState(0);
  
  // Step 1: 카테고리 선택
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Step 2: 지표 선택
  const [selectedPreset, setSelectedPreset] = useState(null);
  
  // Step 3: 기간 설정
  const [datePresetKey, setDatePresetKey] = useState('last7days');
  const [customDateRange, setCustomDateRange] = useState([dayjs().subtract(6, 'days'), dayjs()]);
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [compareType, setCompareType] = useState('auto'); // 'auto' or 'custom'
  const [customCompareRange, setCustomCompareRange] = useState(null);

  // 초기화
  const resetModal = () => {
    setCurrentStep(0);
    setSelectedCategory(null);
    setSelectedPreset(null);
    setDatePresetKey('last7days');
    setCustomDateRange([dayjs().subtract(6, 'days'), dayjs()]);
    setCompareEnabled(true);
    setCompareType('auto');
    setCustomCompareRange(null);
  };

  // 모달 닫기
  const handleClose = () => {
    resetModal();
    onClose();
  };

  // 현재 기간 계산
  const getCurrentDateRange = () => {
    if (datePresetKey === 'custom') {
      return customDateRange;
    }
    const preset = DATE_PRESETS.find(p => p.key === datePresetKey);
    return preset ? preset.getValue() : [dayjs().subtract(6, 'days'), dayjs()];
  };

  // 비교 기간 계산
  const getCompareDateRange = () => {
    if (!compareEnabled) return null;
    const [start, end] = getCurrentDateRange();
    if (compareType === 'custom' && customCompareRange) {
      return customCompareRange;
    }
    return getComparisonPeriod(start, end);
  };

  // 완료 처리
  const handleComplete = () => {
    if (!selectedPreset) return;
    
    const [startDate, endDate] = getCurrentDateRange();
    const compareRange = getCompareDateRange();
    
    onAdd({
      id: `widget-${Date.now()}`,
      type: selectedPreset.type,
      title: selectedPreset.label,
      widthSize: selectedPreset.defaultWidth,
      heightSize: selectedPreset.defaultHeight,
      // 위젯 설정 정보
      presetId: selectedPreset.id,
      category: selectedCategory,
      apiEndpoint: selectedPreset.apiEndpoint,
      dataKey: selectedPreset.dataKey,
      suffix: selectedPreset.suffix || '',
      // 기간 설정
      dateRange: {
        start: startDate.format('YYYY-MM-DD'),
        end: endDate.format('YYYY-MM-DD'),
        presetKey: datePresetKey
      },
      compareEnabled,
      compareRange: compareRange ? {
        start: compareRange[0].format('YYYY-MM-DD'),
        end: compareRange[1].format('YYYY-MM-DD'),
        type: compareType
      } : null,
      // 초기 데이터 (로딩 상태)
      data: null,
      loading: true
    });
    
    handleClose();
  };

  // 다음 단계로
  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  // 이전 단계로
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 다음 버튼 활성화 여부
  const canGoNext = () => {
    if (currentStep === 0) return selectedCategory !== null;
    if (currentStep === 1) return selectedPreset !== null;
    return true;
  };

  // Step 1: 카테고리 선택 렌더링
  const renderStep1 = () => (
    <div>
      <Text style={{ display: 'block', marginBottom: 16, fontSize: 15 }}>
        무엇을 보고 싶으세요?
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.values(DATA_SOURCES).map(source => (
          <div
            key={source.id}
            onClick={() => source.enabled && setSelectedCategory(source.id)}
            style={{
              padding: 20,
              border: selectedCategory === source.id ? '2px solid #1890ff' : '1px solid #e8e8e8',
              borderRadius: 12,
              cursor: source.enabled ? 'pointer' : 'not-allowed',
              background: selectedCategory === source.id ? '#e6f7ff' : source.enabled ? 'white' : '#fafafa',
              opacity: source.enabled ? 1 : 0.6,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 16
            }}
          >
            <div style={{ 
              width: 56, 
              height: 56, 
              borderRadius: 12, 
              background: source.enabled ? '#f0f5ff' : '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {source.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontWeight: 600, 
                fontSize: 16, 
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                {source.name}
                {source.comingSoon && (
                  <span style={{ 
                    fontSize: 11, 
                    background: '#f0f0f0', 
                    padding: '2px 8px', 
                    borderRadius: 4,
                    color: '#8c8c8c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <LockOutlined style={{ fontSize: 10 }} /> 준비중
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#8c8c8c' }}>{source.description}</div>
            </div>
            {source.enabled && (
              <div style={{ 
                width: 24, 
                height: 24, 
                borderRadius: '50%',
                border: selectedCategory === source.id ? 'none' : '2px solid #d9d9d9',
                background: selectedCategory === source.id ? '#1890ff' : 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {selectedCategory === source.id && <CheckOutlined style={{ color: 'white', fontSize: 12 }} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Step 2: 지표 선택 렌더링
  const renderStep2 = () => {
    const presets = WIDGET_PRESETS[selectedCategory];
    if (!presets) return <div>해당 카테고리의 위젯이 없습니다.</div>;

    const sections = [
      { key: 'kpi', label: '숫자 카드', sublabel: '한눈에 보기', items: presets.kpi || [] },
      { key: 'chart', label: '그래프', sublabel: '추이 보기', items: presets.chart || [] },
      { key: 'list', label: '목록', sublabel: '상세 보기', items: presets.list || [] }
    ];

    return (
      <div>
        <Text style={{ display: 'block', marginBottom: 16, fontSize: 15 }}>
          어떤 정보를 볼까요?
        </Text>
        {sections.map(section => (
          section.items.length > 0 && (
            <div key={section.key} style={{ marginBottom: 20 }}>
              <div style={{ 
                fontSize: 13, 
                color: '#8c8c8c', 
                marginBottom: 10,
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: 8
              }}>
                {section.label} ({section.sublabel})
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: 10 
              }}>
                {section.items.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedPreset(item)}
                    style={{
                      padding: 14,
                      border: selectedPreset?.id === item.id ? '2px solid #1890ff' : '1px solid #e8e8e8',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: selectedPreset?.id === item.id ? '#e6f7ff' : 'white',
                      transition: 'all 0.2s ease',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{item.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: 1.3 }}>{item.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    );
  };

  // Step 3: 기간 설정 렌더링
  const renderStep3 = () => {
    const [currentStart, currentEnd] = getCurrentDateRange();
    const compareRange = getCompareDateRange();

    return (
      <div>
        <Text style={{ display: 'block', marginBottom: 16, fontSize: 15 }}>
          언제 데이터를 볼까요?
        </Text>
        
        {/* 기간 선택 */}
        <div style={{ 
          padding: 20, 
          border: '1px solid #e8e8e8', 
          borderRadius: 12, 
          marginBottom: 16,
          background: '#fafafa'
        }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>기간 선택</div>
          <Radio.Group 
            value={datePresetKey} 
            onChange={e => setDatePresetKey(e.target.value)}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
          >
            {DATE_PRESETS.map(preset => (
              <Radio.Button 
                key={preset.key} 
                value={preset.key}
                style={{ borderRadius: 6 }}
              >
                {preset.label}
              </Radio.Button>
            ))}
          </Radio.Group>
          
          {datePresetKey === 'custom' && (
            <div style={{ marginTop: 12 }}>
              <RangePicker
                value={customDateRange}
                onChange={setCustomDateRange}
                format="YYYY-MM-DD"
                style={{ width: '100%' }}
              />
            </div>
          )}
          
          {datePresetKey !== 'custom' && currentStart && (
            <div style={{ marginTop: 10, fontSize: 13, color: '#1890ff' }}>
              → {currentStart.format('YYYY-MM-DD')} ~ {currentEnd.format('YYYY-MM-DD')}
            </div>
          )}
        </div>

        {/* 비교 기간 */}
        <div style={{ 
          padding: 20, 
          border: '1px solid #e8e8e8', 
          borderRadius: 12,
          background: compareEnabled ? '#f6ffed' : '#fafafa'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <Checkbox 
              checked={compareEnabled} 
              onChange={e => setCompareEnabled(e.target.checked)}
            >
              <span style={{ fontWeight: 600 }}>📊 이전 기간과 비교하기</span>
            </Checkbox>
          </div>
          
          {compareEnabled && (
            <>
              <Radio.Group 
                value={compareType} 
                onChange={e => setCompareType(e.target.value)}
                style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 24 }}
              >
                <Radio value="auto">
                  <span>같은 일자의 이전 달 (자동 계산)</span>
                </Radio>
                <Radio value="custom">
                  <span>직접 선택</span>
                </Radio>
              </Radio.Group>
              
              {compareType === 'custom' && (
                <div style={{ marginTop: 12, marginLeft: 24 }}>
                  <RangePicker
                    value={customCompareRange}
                    onChange={setCustomCompareRange}
                    format="YYYY-MM-DD"
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              
              {compareType === 'auto' && compareRange && (
                <div style={{ marginTop: 10, marginLeft: 24, fontSize: 13, color: '#52c41a' }}>
                  → {compareRange[0].format('YYYY-MM-DD')} ~ {compareRange[1].format('YYYY-MM-DD')} 와 비교
                </div>
              )}
            </>
          )}
        </div>

        {/* 도움말 */}
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: '#fffbe6', 
          borderRadius: 8,
          fontSize: 13,
          color: '#ad8b00'
        }}>
          💡 Tip: 비교 기간을 설정하면 증감률(%)을 함께 볼 수 있어요
        </div>
      </div>
    );
  };

  const steps = [
    { title: '카테고리', description: '무엇을 볼까요?' },
    { title: '지표', description: '어떤 정보?' },
    { title: '기간', description: '언제 데이터?' }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusOutlined style={{ color: '#1890ff' }} />
          <span>위젯 추가</span>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      width={640}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button 
            onClick={handlePrev} 
            disabled={currentStep === 0}
            icon={<ArrowLeftOutlined />}
          >
            이전
          </Button>
          <div>
            <Button onClick={handleClose} style={{ marginRight: 8 }}>
              취소
            </Button>
            {currentStep < 2 ? (
              <Button 
                type="primary" 
                onClick={handleNext}
                disabled={!canGoNext()}
              >
                다음 <ArrowRightOutlined />
              </Button>
            ) : (
              <Button 
                type="primary" 
                onClick={handleComplete}
                disabled={!selectedPreset}
                icon={<CheckOutlined />}
              >
                완료
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* 스텝 인디케이터 */}
      <Steps 
        current={currentStep} 
        size="small" 
        style={{ marginBottom: 24 }}
        items={steps.map(step => ({ title: step.title }))}
      />
      
      {/* 스텝별 콘텐츠 */}
      <div style={{ minHeight: 320 }}>
        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}
      </div>
    </Modal>
  );
};

// ============================================================================
// 메인 대시보드 컴포넌트
// ============================================================================
function MyDashboard() {
  // 컨테이너 너비 측정 (커스텀 훅)
  const containerRef = useRef(null);
  const containerWidth = useContainerSize(containerRef);

  // 날짜 필터 state
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(7, 'days'),
    dayjs()
  ]);

  // 위젯 CRUD 훅
  const {
    widgets,
    setWidgets,
    initialized,
    setInitialized,
    addWidget,
    deleteWidget,
    editWidget,
    resizeWidget,
    updateWidgetData,
    updateMultipleWidgets,
    setWidgetsLoading
  } = useWidgets();

  // 위젯 데이터 로딩 훅
  const { loadWidgetData } = useWidgetData();

  // 위젯 초기화 및 자동 저장 훅
  const { loadInitialWidgets } = useWidgetPersistence(widgets, dateRange, initialized);

  // 초기 로드: localStorage에서 위젯 불러오기
  useEffect(() => {
    const loadInitialData = async () => {
      const { widgets: initialWidgets, dateRange: initialDateRange } = await loadInitialWidgets();

      setWidgets(initialWidgets);
      if (initialDateRange) {
        setDateRange(initialDateRange);
      }

      // API 연결된 위젯들 데이터 로드
      const apiWidgets = initialWidgets.filter(w => w.presetId && w.apiEndpoint);
      if (apiWidgets.length > 0) {
        const loadedWidgets = await Promise.all(apiWidgets.map(loadWidgetData));
        updateMultipleWidgets(loadedWidgets);
      }

      setInitialized(true);
    };

    loadInitialData();
  }, []);

  // 모달 state
  const [addModalVisible, setAddModalVisible] = useState(false);

  // 위젯 추가 시 데이터 로드
  const handleAddWidget = useCallback(async (newWidget) => {
    // 먼저 로딩 상태로 추가
    addWidget(newWidget);

    // API 연결된 위젯이면 데이터 로드
    if (newWidget.presetId && newWidget.apiEndpoint) {
      const loadedWidget = await loadWidgetData(newWidget);
      updateWidgetData(loadedWidget.id, loadedWidget);
    }
  }, [addWidget, loadWidgetData, updateWidgetData]);

  // 대시보드 날짜 변경 시 모든 위젯 데이터 새로고침
  const refreshAllWidgets = useCallback(async () => {
    const widgetsToRefresh = widgets.filter(w => w.presetId && w.apiEndpoint);
    if (widgetsToRefresh.length === 0) return;

    // 모든 위젯을 로딩 상태로
    setWidgetsLoading(true);

    // 병렬로 데이터 로드
    const loadedWidgets = await Promise.all(widgetsToRefresh.map(loadWidgetData));

    // 결과 업데이트
    updateMultipleWidgets(loadedWidgets);
  }, [widgets, loadWidgetData, setWidgetsLoading, updateMultipleWidgets]);

  const gap = 16;
  const colWidth = (containerWidth - gap * 2) / 3;

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      {/* 헤더 영역 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24,
        background: 'white',
        padding: '16px 24px',
        borderRadius: 8,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AppstoreOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0 }}>나만의 대시보드</Title>
        </div>
        
        <Space size="middle">
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="YYYY-MM-DD"
            allowClear={false}
            style={{ width: 260 }}
            presets={[
              { label: '오늘', value: [dayjs(), dayjs()] },
              { label: '최근 7일', value: [dayjs().subtract(7, 'days'), dayjs()] },
              { label: '최근 30일', value: [dayjs().subtract(30, 'days'), dayjs()] },
              { label: '이번 달', value: [dayjs().startOf('month'), dayjs()] }
            ]}
          />
          
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setAddModalVisible(true)}
          >
            위젯 추가
          </Button>
        </Space>
      </div>

      {/* 위젯 그리드 영역 */}
      <div ref={containerRef}>
        {widgets.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 60 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 16 }}>
                    아직 추가된 위젯이 없습니다
                  </Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
                    첫 번째 위젯 추가하기
                  </Button>
                </div>
              }
            />
          </Card>
        ) : (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: gap,
            alignItems: 'flex-start',
            paddingBottom: 40
          }}>
            {widgets.map(widget => (
              <DashboardWidget
                key={widget.id}
                widget={widget}
                onDelete={deleteWidget}
                onEdit={editWidget}
                onResize={resizeWidget}
                containerWidth={containerWidth}
                containerRef={containerRef}
              />
            ))}
            
            {/* 위젯 추가 플레이스홀더 */}
            <div 
              onClick={() => setAddModalVisible(true)}
              style={{ 
                width: colWidth,
                minWidth: 200,
                height: 150,
                border: '2px dashed #d9d9d9',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'white',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#1890ff';
                e.currentTarget.style.background = '#fafafa';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#d9d9d9';
                e.currentTarget.style.background = 'white';
              }}
            >
              <PlusOutlined style={{ fontSize: 32, color: '#bfbfbf', marginBottom: 8 }} />
              <Text type="secondary">위젯 추가</Text>
            </div>
          </div>
        )}
      </div>

      {/* 위젯 추가 모달 */}
      <AddWidgetModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAddWidget}
      />
    </div>
  );
}

export default MyDashboard;
