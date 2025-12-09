/**
 * 대시보드 위젯 컴포넌트
 * 리사이즈 기능 + 위젯 타입별 렌더링
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Dropdown } from 'antd';
import {
  DragOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { WIDTH_SIZES, HEIGHT_SIZES, getWidthSizeFromCols, getHeightSizeFromPixels } from '../constants';
import {
  KPIWidget,
  LineChartWidget,
  BarChartWidget,
  TableWidget,
  FunnelWidget,
  TextWidget,
  LoadingState,
  ErrorState,
  EmptyState
} from './index';

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
      return <LoadingState contentHeight={contentHeight} />;
    }

    // 에러 상태
    if (widget.error) {
      return <ErrorState contentHeight={contentHeight} />;
    }

    // 데이터 없음
    if (!widget.data) {
      return <EmptyState contentHeight={contentHeight} />;
    }

    // 위젯 타입별 컴포넌트 렌더링
    switch (widget.type) {
      case 'kpi':
        return <KPIWidget widget={widget} contentHeight={contentHeight} />;
      case 'line':
        return <LineChartWidget widget={widget} contentHeight={contentHeight} />;
      case 'bar':
        return <BarChartWidget widget={widget} contentHeight={contentHeight} />;
      case 'table':
        return <TableWidget widget={widget} contentHeight={contentHeight} />;
      case 'funnel':
        return <FunnelWidget widget={widget} contentHeight={contentHeight} />;
      case 'text':
        return <TextWidget widget={widget} contentHeight={contentHeight} />;
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

export default DashboardWidget;
