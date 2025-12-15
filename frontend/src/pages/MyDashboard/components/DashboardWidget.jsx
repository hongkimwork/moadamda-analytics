import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Dropdown, Modal, Spin, Tooltip as AntTooltip, Select } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  DragOutlined,
  MoreOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, LabelList, PieChart, Pie, LineChart, Line, Legend } from 'recharts';
import { WIDTH_SIZES, HEIGHT_SIZES } from '../constants.jsx';
import { getWidthSizeFromCols, getHeightSizeFromPixels } from '../utils/sizingUtils';

const DashboardWidget = ({ widget, onDelete, onEdit, onResize, onFilterChange, containerWidth, containerRef }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null); // 'corner-left', 'corner-right', 'bottom'
  const [previewSize, setPreviewSize] = useState(null); // { cols, height }
  const [selectedChannel, setSelectedChannel] = useState('all'); // 전환 퍼널 채널 필터
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
    
    // 공통 색상 배열 (전환 퍼널 차트용 - 5단계: 방문, 상세페이지, 장바구니, 결제시도, 구매완료)
    const funnelColors = ['#1890ff', '#722ed1', '#52c41a', '#faad14', '#f5222d'];
    
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
        
        // 날짜 포맷팅 (YYYY.MM.DD ~ DD 형식)
        const formatDateRange = (range) => {
          if (!range) return '';
          const start = range.start || '';
          const end = range.end || '';
          
          const startParts = start.split('-');
          const endParts = end.split('-');
          
          if (startParts.length < 3 || endParts.length < 3) return '';
          
          const startYear = startParts[0];
          const startMonth = startParts[1];
          const startDay = startParts[2];
          const endYear = endParts[0];
          const endMonth = endParts[1];
          const endDay = endParts[2];
          
          // 같은 년도, 같은 월: 2025.11.01 ~ 30
          if (startYear === endYear && startMonth === endMonth) {
            return `${startYear}.${startMonth}.${startDay} ~ ${endDay}`;
          }
          
          // 같은 년도, 다른 월: 2025.11.01 ~ 12.31
          if (startYear === endYear) {
            return `${startYear}.${startMonth}.${startDay} ~ ${endMonth}.${endDay}`;
          }
          
          // 다른 년도: 2024.12.25 ~ 2025.01.05
          return `${startYear}.${startMonth}.${startDay} ~ ${endYear}.${endMonth}.${endDay}`;
        };
        
        const currentDateLabel = widget.dateRange ? formatDateRange(widget.dateRange) : '이번 기간';
        // 비교 기간 계산: compareRange 또는 compareRanges[0] 또는 data.compareRange 사용
        const compareRangeForLabel = widget.compareRange || 
                                     widget.data?.compareRange || 
                                     (widget.compareRanges && widget.compareRanges.length > 0 ? widget.compareRanges[0] : null);
        const compareDateLabel = compareRangeForLabel ? formatDateRange(compareRangeForLabel) : '';
        
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
                    <div style={{ fontSize: 12, color: '#1890ff', marginBottom: 4, fontWeight: 500 }}>{currentDateLabel}</div>
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
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4, fontWeight: 500 }}>{compareDateLabel}</div>
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
                      {numericChange >= 0 ? '▲' : '▼'} {Math.abs(numericChange)}% {numericChange >= 0 ? '증가' : '감소'}
                    </>
                  )}
                </div>
              </>
            ) : (
              /* 비교 없음: 날짜 + 단일 값 표시 */
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#1890ff', marginBottom: 4, fontWeight: 500 }}>{currentDateLabel}</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#1890ff' }}>
                  {widget.data.prefix}{(widget.data.value || 0).toLocaleString()}<span style={{ fontSize: 16 }}>{widget.data.suffix}</span>
                </div>
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
      
      // 기간별 매출 비교 차트 (수평 막대 2개)
      case 'period_compare':
        const periodData = widget.data;
        if (!periodData?.chartData) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }

        // 다중 비교 기간 색상 배열 (현재: 보라색, 비교: 회색 계열)
        const periodColors = ['#7C3AED', '#94A3B8', '#CBD5E1', '#E2E8F0', '#F1F5F9'];
        const maxPeriodValue = Math.max(...periodData.chartData.map(d => d.value));
        
        // 증감률 렌더링 (2개일 때만 표시, 3개 이상은 표시하지 않음)
        const renderChangeIndicator = () => {
          // 3개 이상이면 표시하지 않음
          if (barCount > 2) return null;
          
          const compareValues = periodData.compareValues || [];
          if (compareValues.length === 0) return null;
          
          // 2개일 때: 첫 번째 비교값만 이전 스타일로 표시
          const firstCompare = compareValues[0];
          const changeValue = firstCompare.change;
          const isNew = changeValue === 'new';
          const numericChange = isNew ? 0 : (parseFloat(changeValue) || 0);

          return (
            <div style={{
              textAlign: 'center',
              padding: '8px 0 4px',
              borderTop: '1px solid #f0f0f0'
            }}>
              <span style={{
                fontSize: 13,
                padding: '4px 12px',
                borderRadius: 12,
                background: isNew ? '#e6f7ff' : (numericChange >= 0 ? '#f6ffed' : '#fff2f0'),
                color: isNew ? '#1890ff' : (numericChange >= 0 ? '#52c41a' : '#ff4d4f')
              }}>
                {isNew ? '신규 (이전 데이터 없음)' : (
                  <>
                    {numericChange >= 0 ? '▲' : '▼'} {Math.abs(numericChange)}% {numericChange >= 0 ? '증가' : '감소'}
                  </>
                )}
              </span>
            </div>
          );
        };

        // 동적 막대 높이 계산 (기간 개수에 따라)
        const barCount = periodData.chartData.length;
        const dynamicBarSize = barCount <= 2 ? 28 : (barCount <= 3 ? 24 : (barCount <= 4 ? 20 : 16));

        // 커스텀 Tooltip 렌더링 (상세 날짜 표시)
        const PeriodTooltip = ({ active, payload }) => {
          if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
              <div style={{
                background: 'white',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                padding: '8px 12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.name}</div>
                {data.detailed && (
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                    {data.detailed}
                  </div>
                )}
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1890ff' }}>
                  {data.value.toLocaleString()}원
                </div>
              </div>
            );
          }
          return null;
        };

        return (
          <div style={{ height: contentHeight, padding: '12px 0', display: 'flex', flexDirection: 'column' }}>
            {/* 차트 영역 */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={periodData.chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
                  barSize={dynamicBarSize}
                >
                  <XAxis type="number" hide domain={[0, maxPeriodValue * 1.1]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: barCount > 3 ? 11 : 13, fill: '#262626', fontWeight: 500 }}
                    width={120}
                  />
                  {/* 3개 이상일 때만 Tooltip 표시 */}
                  {barCount > 2 && (
                    <Tooltip content={<PeriodTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                  )}
                  <Bar
                    dataKey="value"
                    radius={[0, 6, 6, 0]}
                    background={{ fill: '#f5f5f5', radius: [0, 6, 6, 0] }}
                  >
                    {periodData.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={periodColors[index] || periodColors[periodColors.length - 1]} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(value) => `${value.toLocaleString()}원`}
                      style={{ fontSize: barCount > 3 ? 11 : 13, fontWeight: 600, fill: '#262626' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 증감률 표시 (2개일 때만) */}
            {renderChangeIndicator()}
          </div>
        );
      
      case 'bar':
        // 카드 너비에 따라 표시할 항목 수 결정
        const widthSize = widget.widthSize || 'medium';
        const maxItems = widthSize === 'small' ? 3 : (widthSize === 'medium' ? 5 : 7);
        const barData = (widget.data || []).slice(0, maxItems);
        
        if (barData.length === 0) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }
        
        // 항목별 다른 색상 (Mixpanel 스타일)
        const barColors = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4'];
        const maxBarValue = Math.max(...barData.map(d => d.value));
        
        return (
          <div style={{ height: contentHeight, padding: '8px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 5, right: 90, left: 10, bottom: 5 }}
                barSize={22}
              >
                <XAxis type="number" hide domain={[0, maxBarValue * 1.15]} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#262626' }}
                  width={80}
                  tickFormatter={(value) => value.length > 8 ? value.slice(0, 8) + '...' : value}
                />
                <Tooltip 
                  formatter={(value) => [`${value.toLocaleString()}원`, '매출']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e8e8e8' }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[0, 6, 6, 0]}
                  background={{ fill: '#f5f5f5', radius: [0, 6, 6, 0] }}
                >
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                  ))}
                  <LabelList 
                    dataKey="value" 
                    position="right" 
                    formatter={(value) => `${value.toLocaleString()}원`}
                    style={{ fontSize: 11, fill: '#595959' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      
      case 'table':
        // 프리셋별 테이블 렌더링
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

        // 인기 페이지 테이블
        if (widget.presetId === 'top_pages') {
          return (
            <div style={{ height: contentHeight, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, position: 'sticky', top: 0, background: 'white', width: 30 }}>#</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>페이지</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>PV</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>UV</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: i < 3 ? '#52c41a' : '#8c8c8c' }}>{row.rank || i + 1}</td>
                      <td style={{ padding: '6px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.url}>
                        {row.title || row.url}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                        {(row.pv || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        {(row.uv || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // 유입 경로 테이블
        if (widget.presetId === 'referrer_sources') {
          return (
            <div style={{ height: contentHeight, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, position: 'sticky', top: 0, background: 'white', width: 30 }}>#</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>유입 경로</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>방문자</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>비율</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: i < 3 ? '#52c41a' : '#8c8c8c' }}>{row.rank || i + 1}</td>
                      <td style={{ padding: '6px 8px' }}>{row.source}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                        {(row.uv || 0).toLocaleString()}명
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        {row.rate || 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // UTM 캠페인 테이블
        if (widget.presetId === 'utm_campaigns') {
          return (
            <div style={{ height: contentHeight, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, position: 'sticky', top: 0, background: 'white', width: 30 }}>#</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>소스</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>캠페인</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>방문자</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: i < 3 ? '#52c41a' : '#8c8c8c' }}>{row.rank || i + 1}</td>
                      <td style={{ padding: '6px 8px', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.source} / {row.medium}
                      </td>
                      <td style={{ padding: '6px 8px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.campaign}>
                        {row.campaign}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                        {(row.uv || 0).toLocaleString()}명
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

      // ============================================================================
      // 방문자 분석 차트 렌더링
      // ============================================================================

      // 파이 차트 (디바이스별 방문자)
      case 'pie':
        const pieData = widget.data;
        if (!pieData?.chartData || pieData.chartData.length === 0) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }

        const RADIAN = Math.PI / 180;
        const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
          const x = cx + radius * Math.cos(-midAngle * RADIAN);
          const y = cy + radius * Math.sin(-midAngle * RADIAN);
          
          if (percent < 0.05) return null; // 5% 미만은 라벨 생략
          
          return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
              {`${(percent * 100).toFixed(0)}%`}
            </text>
          );
        };

        return (
          <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={Math.min(contentHeight, 200) / 2 - 20}
                  dataKey="value"
                >
                  {pieData.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => [`${value.toLocaleString()}명 (${props.payload.rate}%)`, name]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e8e8e8' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value, entry) => (
                    <span style={{ color: '#262626', fontSize: 12 }}>
                      {value} ({entry.payload.rate}%)
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      // 24시간 바 차트 (시간대별 방문자)
      case 'hourly_bar':
        const hourlyData = widget.data;
        if (!hourlyData?.chartData || hourlyData.chartData.length === 0) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }

        // 피크 시간 찾기
        const peakHour = hourlyData.chartData.reduce((max, item) => item.uv > max.uv ? item : max, hourlyData.chartData[0]);

        return (
          <div style={{ height: contentHeight, padding: '8px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hourlyData.chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <XAxis 
                  dataKey="hour" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#8c8c8c' }}
                  tickFormatter={(hour) => hour % 6 === 0 ? `${hour}시` : ''}
                  interval={0}
                />
                <YAxis hide domain={[0, hourlyData.maxValue * 1.2]} />
                <Tooltip 
                  formatter={(value) => [`${value.toLocaleString()}명`, '방문자']}
                  labelFormatter={(hour) => `${hour}시`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e8e8e8' }}
                />
                <Bar 
                  dataKey="uv" 
                  radius={[2, 2, 0, 0]}
                >
                  {hourlyData.chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.hour === peakHour.hour ? '#52c41a' : '#d9d9d9'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      // 라인 차트 (일별 방문 추이)
      case 'visitor_line':
        const dailyData = widget.data;
        if (!dailyData?.chartData || dailyData.chartData.length === 0) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }

        return (
          <div style={{ height: contentHeight, padding: '8px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dailyData.chartData}
                margin={{ top: 10, right: 30, left: -10, bottom: 5 }}
              >
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#8c8c8c' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#8c8c8c' }}
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip 
                  formatter={(value, name) => [
                    `${value.toLocaleString()}${name === 'uv' ? '명' : '회'}`, 
                    name === 'uv' ? '방문자' : '페이지뷰'
                  ]}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e8e8e8' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="uv" 
                  stroke="#52c41a" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#52c41a' }}
                  activeDot={{ r: 5 }}
                  name="uv"
                />
                <Line 
                  type="monotone" 
                  dataKey="pv" 
                  stroke="#1890ff" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#1890ff' }}
                  activeDot={{ r: 5 }}
                  name="pv"
                />
                <Legend 
                  verticalAlign="top"
                  height={30}
                  formatter={(value) => (
                    <span style={{ color: '#262626', fontSize: 12 }}>
                      {value === 'uv' ? '방문자(UV)' : '페이지뷰(PV)'}
                    </span>
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      // 비교 바 차트 (신규 vs 재방문)
      case 'compare_bar':
        const compareData = widget.data;
        if (!compareData?.chartData || compareData.chartData.length === 0) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }

        const maxCompareValue = Math.max(...compareData.chartData.map(d => d.value));

        return (
          <div style={{ height: contentHeight, padding: '12px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={compareData.chartData}
                layout="vertical"
                margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
                barSize={32}
              >
                <XAxis type="number" hide domain={[0, maxCompareValue * 1.2]} />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 13, fill: '#262626', fontWeight: 500 }}
                  width={60}
                />
                <Tooltip 
                  formatter={(value, name, props) => [`${value.toLocaleString()}명 (${props.payload.rate}%)`, props.payload.name]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e8e8e8' }}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  background={{ fill: '#f5f5f5', radius: [0, 6, 6, 0] }}
                >
                  {compareData.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(value) => `${value.toLocaleString()}명`}
                    style={{ fontSize: 12, fontWeight: 600, fill: '#262626' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      
      case 'conversion_funnel':
        const funnelData = widget.data;
        if (!funnelData?.funnel && !funnelData?.channels) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }

        // 채널 선택에 따라 데이터 결정
        const isChannelView = funnelData?.channels && funnelData.channels.length > 0;
        let currentFunnelData;
        
        if (isChannelView && selectedChannel !== 'all') {
          // 특정 채널 선택 시
          currentFunnelData = funnelData.channels.find(c => c.channel === selectedChannel);
          if (!currentFunnelData) {
            // 선택한 채널이 없으면 첫 번째 채널
            currentFunnelData = funnelData.channels[0];
          }
        } else if (isChannelView && selectedChannel === 'all') {
          // 전체 선택 시 - 모든 채널 합산 (첫 번째 채널 데이터 사용 또는 전체 API 재호출 필요)
          currentFunnelData = funnelData;
        } else {
          // 일반 퍼널 데이터
          currentFunnelData = funnelData;
        }

        const funnelSteps = currentFunnelData?.funnel || [];
        const compareFunnel = funnelData.compareFunnel;
        const hasCompareData = widget.compareEnabled && compareFunnel && compareFunnel.length > 0;
        const stepCount = funnelSteps.length;
        
        // 비교용 차트 데이터 생성 (현재 + 이전)
        const funnelChartData = funnelSteps.map((step, index) => {
          const compareStep = hasCompareData ? compareFunnel[index] : null;
          return {
            name: step.step,
            current: step.count,
            currentRate: step.rate,
            compare: compareStep?.count || 0,
            compareRate: compareStep?.rate || 0,
            dropRate: step.dropRate,
            fill: funnelColors[index],
            // 증감률 계산
            change: compareStep?.count > 0 
              ? ((step.count - compareStep.count) / compareStep.count * 100).toFixed(1)
              : (step.count > 0 ? 'new' : '0')
          };
        });
        
        // 최대값 (현재와 이전 중 큰 값 기준)
        const maxFunnelValue = Math.max(
          funnelChartData[0]?.current || 1,
          hasCompareData ? (funnelChartData[0]?.compare || 0) : 0
        );
        
        // 동적 막대 크기 (비교 모드일 때 더 작게, 5단계 퍼널 지원)
        const funnelBarSize = hasCompareData 
          ? (stepCount <= 4 ? 14 : 12)
          : (stepCount <= 4 ? 26 : (stepCount <= 5 ? 22 : 18));
        
        // 높이에 따라 인사이트/전환율 비교 표시 여부 결정
        const showFunnelInsight = contentHeight > 220;
        const showConversionCompare = hasCompareData && contentHeight > 160;

        // 커스텀 Tooltip (비교 데이터 포함)
        const FunnelTooltip = ({ active, payload }) => {
          if (active && payload && payload.length) {
            const data = payload[0].payload;
            const changeNum = parseFloat(data.change);
            const isNew = data.change === 'new';
            return (
              <div style={{
                background: 'white',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                padding: '8px 12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: data.fill }}>{data.name}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  현재: {data.current.toLocaleString()}명 ({data.currentRate}%)
                </div>
                {hasCompareData && (
                  <>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                      이전: {data.compare.toLocaleString()}명 ({data.compareRate}%)
                    </div>
                    <div style={{ 
                      fontSize: 12, 
                      marginTop: 4,
                      color: isNew ? '#1890ff' : (changeNum >= 0 ? '#52c41a' : '#ff4d4f')
                    }}>
                      {isNew ? '🆕 신규' : (changeNum >= 0 ? `▲ ${changeNum}%` : `▼ ${Math.abs(changeNum)}%`)}
                    </div>
                  </>
                )}
                {data.dropRate > 0 && (
                  <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 4 }}>
                    ↓ {data.dropRate}% 이탈
                  </div>
                )}
              </div>
            );
          }
          return null;
        };

        // 채널 목록 (channel-funnel API에서 가져온 경우)
        const availableChannels = isChannelView && funnelData.channels 
          ? [{ value: 'all', label: '전체' }, ...funnelData.channels.map(c => ({ value: c.channel, label: c.channel }))]
          : [];

        return (
          <div style={{ height: contentHeight, padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
            {/* 채널 필터 (채널 데이터가 있을 때만 표시) */}
            {isChannelView && availableChannels.length > 0 && (
              <div style={{
                padding: '4px 12px 8px',
                borderBottom: '1px solid #f0f0f0',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span style={{ fontSize: 12, color: '#8c8c8c' }}>채널:</span>
                <Select
                  value={selectedChannel}
                  onChange={setSelectedChannel}
                  size="small"
                  style={{ width: 120 }}
                  options={availableChannels}
                />
                {selectedChannel !== 'all' && currentFunnelData?.overallConversion && (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: '#e6f7ff',
                    color: '#1890ff',
                    fontWeight: 600
                  }}>
                    전환율 {currentFunnelData.overallConversion}%
                  </span>
                )}
              </div>
            )}
            
            {/* 차트 영역 */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnelChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 90, left: 5, bottom: 5 }}
                  barGap={hasCompareData ? 2 : 0}
                  barCategoryGap={hasCompareData ? '15%' : '20%'}
                >
                  <XAxis type="number" hide domain={[0, maxFunnelValue * 1.1]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#262626', fontWeight: 500 }}
                    width={55}
                  />
                  <Tooltip content={<FunnelTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                  
                  {/* 이전 기간 막대 (투명하게 먼저 그림) */}
                  {hasCompareData && (
                    <Bar
                      dataKey="compare"
                      radius={[0, 6, 6, 0]}
                      barSize={funnelBarSize}
                    >
                      {funnelChartData.map((entry, index) => (
                        <Cell key={`compare-${index}`} fill={entry.fill} fillOpacity={0.3} />
                      ))}
                      <LabelList
                        dataKey="compare"
                        position="right"
                        formatter={(value) => `${value.toLocaleString()}명`}
                        style={{ fontSize: 11, fontWeight: 700, fill: '#000000' }}
                      />
                    </Bar>
                  )}
                  
                  {/* 현재 기간 막대 */}
                  <Bar
                    dataKey="current"
                    radius={[0, 6, 6, 0]}
                    barSize={funnelBarSize}
                    background={!hasCompareData ? { fill: '#f5f5f5', radius: [0, 6, 6, 0] } : false}
                  >
                    {funnelChartData.map((entry, index) => (
                      <Cell key={`current-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="current"
                      position="right"
                      formatter={(value) => `${value.toLocaleString()}명`}
                      style={{ fontSize: 11, fontWeight: 600, fill: '#262626' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 전환율 비교 (비교 모드일 때) */}
            {showConversionCompare && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '6px 8px',
                background: '#f6ffed',
                borderRadius: 4,
                margin: '0 8px 4px',
                fontSize: 12
              }}>
                <span style={{ color: '#8c8c8c' }}>전환율</span>
                <span style={{ color: '#8c8c8c', margin: '0 4px' }}>|</span>
                <span style={{ color: '#389e0d', fontSize: 11 }}>현재:</span>
                <span style={{ fontWeight: 600, color: '#52c41a' }}>{funnelData.overallConversion}%</span>
                <span style={{ color: '#8c8c8c' }}>vs</span>
                <span style={{ color: '#8c8c8c', fontSize: 11 }}>이전:</span>
                <span style={{ fontWeight: 600, color: '#8c8c8c' }}>{funnelData.compareConversion}%</span>
                {funnelData.conversionChange && funnelData.conversionChange !== 'new' && (
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: parseFloat(funnelData.conversionChange) >= 0 ? '#d9f7be' : '#ffccc7',
                    color: parseFloat(funnelData.conversionChange) >= 0 ? '#389e0d' : '#cf1322'
                  }}>
                    {parseFloat(funnelData.conversionChange) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(funnelData.conversionChange))}% {parseFloat(funnelData.conversionChange) >= 0 ? '상승' : '하락'}
                  </span>
                )}
              </div>
            )}

            {/* 결제시도 데이터 누락 안내 (현재 또는 비교 기간) */}
            {(funnelData.checkoutDataMissing || funnelData.compareCheckoutDataMissing) && (
              <AntTooltip 
                title={
                  <div>
                    {funnelData.checkoutDataMissing && (
                      <div>📊 현재 기간: {funnelData.checkoutDataMissingMessage}</div>
                    )}
                    {funnelData.compareCheckoutDataMissing && (
                      <div style={{ marginTop: funnelData.checkoutDataMissing ? 8 : 0 }}>
                        📊 비교 기간: {funnelData.compareCheckoutDataMissingMessage}
                      </div>
                    )}
                  </div>
                }
                placement="top"
                overlayStyle={{ maxWidth: 300 }}
              >
                <div style={{ 
                  padding: '4px 8px', 
                  background: '#fff1f0', 
                  borderRadius: 4,
                  fontSize: 11,
                  color: '#cf1322',
                  lineHeight: 1.4,
                  margin: '0 8px 4px',
                  textAlign: 'center',
                  cursor: 'help'
                }}>
                  ⚠️ 일부 기간에 결제시도 데이터가 없습니다 (마우스를 올려 상세 보기)
                </div>
              </AntTooltip>
            )}

            {/* 인사이트 (공간이 충분하고 비교 모드가 아닐 때) */}
            {showFunnelInsight && !hasCompareData && currentFunnelData?.insight && (
              <div style={{ 
                padding: '6px 8px', 
                background: '#fff7e6', 
                borderRadius: 4,
                fontSize: 11,
                color: '#ad6800',
                lineHeight: 1.4,
                margin: '0 8px'
              }}>
                💡 {currentFunnelData.insight}
              </div>
            )}
          </div>
        );

      case 'channel_funnel':
        const channelData = widget.data;
        
        // 데이터 없음 처리
        if (!channelData || channelData.isEmpty) {
          return (
            <div style={{ 
              height: contentHeight, 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '0 20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <Text style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                선택한 기간에 {widget.selectedChannel} 채널의 방문 데이터가 없습니다
              </Text>
              <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
                💡 다른 기간을 시도해보세요
              </Text>
            </div>
          );
        }

        // 단일 채널 데이터 처리 (새로운 API 구조)
        const channelFunnelSteps = channelData.funnel || [];
        const channelCompareFunnel = channelData.compareFunnel || [];
        const channelHasCompare = widget.compareEnabled && channelCompareFunnel.length > 0;

        // 차트 데이터 구성 (5단계 퍼널 지원)
        const channelStepCount = channelFunnelSteps.length;
        const channelBarSize = channelHasCompare 
          ? (channelStepCount <= 4 ? 14 : 12)
          : (channelStepCount <= 4 ? 26 : (channelStepCount <= 5 ? 22 : 18));

        const channelChartData = channelFunnelSteps.map((step, index) => {
          const compareStep = channelHasCompare ? channelCompareFunnel[index] : null;
          return {
            name: step.step,
            current: step.count,
            currentRate: step.rate,
            compare: compareStep?.count || 0,
            compareRate: compareStep?.rate || 0,
            dropRate: step.dropRate,
            fill: funnelColors[index] // 각 단계별로 다른 색상 적용
          };
        });

        const channelMaxValue = Math.max(
          channelChartData[0]?.current || 1,
          channelHasCompare ? (channelChartData[0]?.compare || 0) : 0
        );

        const channelShowConversionCompare = channelHasCompare && contentHeight > 160;

        return (
          <div style={{ height: contentHeight, padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
            {/* 차트 영역 */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={channelChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 90, left: 5, bottom: 5 }}
                  barGap={channelHasCompare ? 2 : 0}
                  barCategoryGap={channelHasCompare ? '15%' : '20%'}
                >
                  <XAxis type="number" hide domain={[0, channelMaxValue * 1.1]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#262626', fontWeight: 500 }}
                    width={55}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{
                            background: 'white',
                            border: '1px solid #e8e8e8',
                            borderRadius: 8,
                            padding: '8px 12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: 4, color: data.fill }}>{data.name}</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                              현재: {data.current.toLocaleString()}명 ({data.currentRate}%)
                            </div>
                            {channelHasCompare && (
                              <>
                                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                                  이전: {data.compare.toLocaleString()}명 ({data.compareRate}%)
                                </div>
                              </>
                            )}
                            {data.dropRate > 0 && (
                              <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 4 }}>
                                ↓ {data.dropRate}% 이탈
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                  />
                  
                  {/* 이전 기간 막대 (투명하게) */}
                  {channelHasCompare && (
                    <Bar
                      dataKey="compare"
                      radius={[0, 6, 6, 0]}
                      barSize={channelBarSize}
                    >
                      {channelChartData.map((entry, index) => (
                        <Cell key={`compare-${index}`} fill={entry.fill} fillOpacity={0.3} />
                      ))}
                      <LabelList
                        dataKey="compare"
                        position="right"
                        formatter={(value) => `${value.toLocaleString()}명`}
                        style={{ fontSize: 11, fontWeight: 600, fill: '#262626' }}
                      />
                    </Bar>
                  )}
                  
                  {/* 현재 기간 막대 */}
                  <Bar
                    dataKey="current"
                    radius={[0, 6, 6, 0]}
                    barSize={channelBarSize}
                    background={!channelHasCompare ? { fill: '#f5f5f5', radius: [0, 6, 6, 0] } : false}
                  >
                    {channelChartData.map((entry, index) => (
                      <Cell key={`current-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="current"
                      position="right"
                      formatter={(value) => `${value.toLocaleString()}명`}
                      style={{ fontSize: 11, fontWeight: 600, fill: '#262626' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 전환율 비교 (비교 모드일 때) */}
            {channelShowConversionCompare && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '6px 8px',
                background: '#f6ffed',
                borderRadius: 4,
                margin: '0 8px 4px',
                fontSize: 12
              }}>
                <span style={{ color: '#8c8c8c' }}>전환율</span>
                <span style={{ color: '#8c8c8c', margin: '0 4px' }}>|</span>
                <span style={{ color: '#389e0d', fontSize: 11 }}>현재:</span>
                <span style={{ fontWeight: 600, color: '#52c41a' }}>{channelData.overallConversion}%</span>
                <span style={{ color: '#8c8c8c' }}>vs</span>
                <span style={{ color: '#8c8c8c', fontSize: 11 }}>이전:</span>
                <span style={{ fontWeight: 600, color: '#8c8c8c' }}>{channelData.compareConversion}%</span>
                {channelData.conversionChange && channelData.conversionChange !== 'new' && (
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: parseFloat(channelData.conversionChange) >= 0 ? '#d9f7be' : '#ffccc7',
                    color: parseFloat(channelData.conversionChange) >= 0 ? '#389e0d' : '#cf1322'
                  }}>
                    {parseFloat(channelData.conversionChange) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(channelData.conversionChange))}% {parseFloat(channelData.conversionChange) >= 0 ? '상승' : '하락'}
                  </span>
                )}
              </div>
            )}

            {/* 결제시도 데이터 누락 안내 */}
            {(channelData.checkoutDataMissing || channelData.compareCheckoutDataMissing) && (
              <AntTooltip 
                title={
                  <div>
                    {channelData.checkoutDataMissing && (
                      <div>📊 현재 기간: {channelData.checkoutDataMissingMessage}</div>
                    )}
                    {channelData.compareCheckoutDataMissing && (
                      <div style={{ marginTop: channelData.checkoutDataMissing ? 8 : 0 }}>
                        📊 비교 기간: {channelData.compareCheckoutDataMissingMessage}
                      </div>
                    )}
                  </div>
                }
                placement="top"
                overlayStyle={{ maxWidth: 300 }}
              >
                <div style={{ 
                  padding: '4px 8px', 
                  background: '#fff1f0', 
                  borderRadius: 4,
                  fontSize: 11,
                  color: '#cf1322',
                  lineHeight: 1.4,
                  margin: '0 8px 4px',
                  textAlign: 'center',
                  cursor: 'help'
                }}>
                  ⚠️ 일부 기간에 결제시도 데이터가 없습니다 (마우스를 올려 상세 보기)
                </div>
              </AntTooltip>
            )}

            {/* 인사이트 */}
            {channelData.insight && !channelHasCompare && (
              <div style={{ 
                padding: '6px 8px', 
                background: '#fff7e6', 
                borderRadius: 4,
                fontSize: 11,
                color: '#ad6800',
                lineHeight: 1.4,
                margin: '0 8px'
              }}>
                💡 {channelData.insight}
              </div>
            )}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            {/* 왼쪽 그룹: 제목 + 날짜 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DragOutlined style={{ color: '#bfbfbf', cursor: 'grab' }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{widget.title}</span>
              
              {/* period_compare 타입일 때 날짜 정보 표시 (2개일 때만 vs 형태로 표시, 3개 이상은 Tooltip으로) */}
              {widget.type === 'period_compare' && widget.data?.detailedDates && (
                <>
                  {/* 2개일 때만 헤더에 표시 */}
                  {widget.data.chartData?.length === 2 && (
                    <>
                      <span style={{ color: '#e0e0e0', margin: '0 8px' }}>|</span>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 11,
                        color: '#595959'
                      }}>
                        {widget.data.detailedDates.current && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ color: '#7C3AED', fontSize: 12 }}>●</span>
                            {widget.data.detailedDates.current}
                          </span>
                        )}
                        {widget.data.detailedDates.compares?.[0] && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ color: '#8c8c8c', fontSize: 10 }}>vs</span>
                            <span style={{ color: '#94A3B8', fontSize: 12 }}>●</span>
                            {widget.data.detailedDates.compares[0]}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  {/* 3개 이상일 때는 안내 문구만 표시 */}
                  {widget.data.chartData?.length > 2 && (
                    <>
                      <span style={{ color: '#e0e0e0', margin: '0 8px' }}>|</span>
                      <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                        {widget.data.chartData.length}개 기간 비교 (막대에 마우스를 올리면 상세 날짜 표시)
                      </span>
                    </>
                  )}
                </>
              )}
              
              {/* 다른 타입(bar, table 등)일 때 날짜 정보 표시 (단일 기간) */}
              {/* KPI, period_compare, text 타입은 제외 */}
              {widget.type !== 'period_compare' && widget.type !== 'text' && widget.type !== 'kpi' && widget.dateRange && (
                <>
                  <span style={{ color: '#e0e0e0', margin: '0 8px' }}>|</span>
                  <span style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    color: '#595959'
                  }}>
                    <span style={{ color: '#8c8c8c' }}>조회기간 :</span>
                    {(() => {
                      const formatDateRange = (dateRange) => {
                        if (!dateRange?.start || !dateRange?.end) return '';
                        const { start, end } = dateRange;
                        
                        const startParts = start.split('-');
                        const endParts = end.split('-');
                        
                        if (startParts.length < 3 || endParts.length < 3) return '';
                        
                        const startYear = startParts[0];
                        const startMonth = startParts[1];
                        const startDay = startParts[2];
                        const endYear = endParts[0];
                        const endMonth = endParts[1];
                        const endDay = endParts[2];
                        
                        // 같은 년도, 같은 월
                        if (startYear === endYear && startMonth === endMonth) {
                          return `${startYear}.${startMonth}.${startDay} ~ ${endDay}`;
                        }
                        
                        // 같은 년도, 다른 월
                        if (startYear === endYear) {
                          return `${startYear}.${startMonth}.${startDay} ~ ${endMonth}.${endDay}`;
                        }
                        
                        // 다른 년도
                        return `${startYear}.${startMonth}.${startDay} ~ ${endYear}.${endMonth}.${endDay}`;
                      };
                      
                      const currentRange = formatDateRange(widget.dateRange);
                      
                      // conversion_funnel 또는 channel_funnel 타입이고 비교 기간이 있을 때
                      if ((widget.type === 'conversion_funnel' || widget.type === 'channel_funnel') && widget.compareEnabled && widget.compareRanges?.length > 0) {
                        const compareRange = formatDateRange(widget.compareRanges[0]);
                        if (compareRange) {
                          return (
                            <>
                              <span style={{ color: '#1890ff', fontWeight: 500 }}>{currentRange}</span>
                              <span style={{ color: '#8c8c8c', margin: '0 4px' }}>vs</span>
                              <span style={{ color: '#8c8c8c' }}>{compareRange}</span>
                            </>
                          );
                        }
                      }
                      
                      return currentRange;
                    })()}
                  </span>
                </>
              )}
            </div>
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

export default DashboardWidget;
