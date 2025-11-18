import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Table, Tag, Typography, Space, Button, Alert, Tooltip, message, Divider } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import SearchFilterBar from '../components/SearchFilterBar';
import DynamicUtmFilterBar from '../components/DynamicUtmFilterBar';
import { ShortId, ShortIp, ShortUrl, EllipsisText, DeviceText } from '../components/tables';

const { Title } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================================================
// 테이블별 설정
// ============================================================================
const TABLE_CONFIGS = {
  visitors: {
    title: '👤 방문자',
    description: '방문자 정보 테이블',
    columns: [
      {
        title: '쿠키 ID',
        dataIndex: 'visitor_id',
        key: 'visitor_id',
        width: 95,
        render: (id) => <ShortId id={id} length={6} />,
        sorter: (a, b) => (a.visitor_id || '').localeCompare(b.visitor_id || ''),
        showSorterTooltip: false
      },
      {
        title: '첫 방문',
        dataIndex: 'first_visit',
        key: 'first_visit',
        width: 150,
        render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
        sorter: (a, b) => new Date(a.first_visit) - new Date(b.first_visit),
        showSorterTooltip: false
      },
      {
        title: '마지막 방문',
        dataIndex: 'last_visit',
        key: 'last_visit',
        width: 150,
        render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
        sorter: (a, b) => new Date(a.last_visit) - new Date(b.last_visit),
        showSorterTooltip: false
      },
      {
        title: '방문 횟수',
        dataIndex: 'visit_count',
        key: 'visit_count',
        width: 85,
        align: 'center',
        sorter: (a, b) => a.visit_count - b.visit_count,
        showSorterTooltip: false
      },
      {
        title: '디바이스',
        dataIndex: 'device_type',
        key: 'device_type',
        width: 75,
        render: (device) => <DeviceText device={device} />,
        sorter: (a, b) => {
          const order = { 'pc': 1, 'mobile': 2, 'tablet': 3 };
          return (order[a.device_type] || 999) - (order[b.device_type] || 999);
        },
        showSorterTooltip: false
      },
      {
        title: '브라우저',
        dataIndex: 'browser',
        key: 'browser',
        width: 85,
        sorter: (a, b) => (a.browser || '').localeCompare(b.browser || ''),
        showSorterTooltip: false
      },
      {
        title: 'OS',
        dataIndex: 'os',
        key: 'os',
        width: 80,
        sorter: (a, b) => (a.os || '').localeCompare(b.os || ''),
        showSorterTooltip: false
      },
      {
        title: 'IP 주소',
        dataIndex: 'last_ip',
        key: 'last_ip',
        width: 110,
        render: (ip) => <ShortIp ip={ip} />,
        sorter: (a, b) => (a.last_ip || '').localeCompare(b.last_ip || ''),
        showSorterTooltip: false
      },
      {
        title: 'UTM Source',
        dataIndex: 'utm_source',
        key: 'utm_source',
        width: 95,
        render: (source) => source ? <Tag color="blue">{source}</Tag> : '-',
        sorter: (a, b) => (a.utm_source || '').localeCompare(b.utm_source || ''),
        showSorterTooltip: false
      },
      {
        title: 'UTM Medium',
        dataIndex: 'utm_medium',
        key: 'utm_medium',
        width: 95,
        render: (medium) => medium ? <Tag color="cyan">{medium}</Tag> : '-',
        sorter: (a, b) => (a.utm_medium || '').localeCompare(b.utm_medium || ''),
        showSorterTooltip: false
      },
      {
        title: 'UTM Campaign',
        dataIndex: 'utm_campaign',
        key: 'utm_campaign',
        width: 130,
        render: (campaign) => <EllipsisText text={campaign} maxLength={12} />,
        sorter: (a, b) => (a.utm_campaign || '').localeCompare(b.utm_campaign || ''),
        showSorterTooltip: false
      }
    ]
  },
  sessions: {
    title: '🕐 세션',
    description: '세션 정보 테이블',
    columns: [
      {
        title: '세션 ID',
        dataIndex: 'session_id',
        key: 'session_id',
        width: 85,
        render: (id) => <ShortId id={id} length={5} />,
        sorter: (a, b) => (a.session_id || '').localeCompare(b.session_id || ''),
        showSorterTooltip: false
      },
      {
        title: '쿠키 ID',
        dataIndex: 'visitor_id',
        key: 'visitor_id',
        width: 85,
        render: (id) => <ShortId id={id} length={5} />,
        sorter: (a, b) => (a.visitor_id || '').localeCompare(b.visitor_id || ''),
        showSorterTooltip: false
      },
      {
        title: '시작 시간',
        dataIndex: 'start_time',
        key: 'start_time',
        width: 110,
        render: (date) => dayjs(date).format('MM-DD HH:mm'),
        sorter: (a, b) => new Date(a.start_time) - new Date(b.start_time),
        showSorterTooltip: false
      },
      {
        title: '종료 시간',
        dataIndex: 'end_time',
        key: 'end_time',
        width: 110,
        render: (date) => date ? dayjs(date).format('MM-DD HH:mm') : '-',
        sorter: (a, b) => new Date(a.end_time || 0) - new Date(b.end_time || 0),
        showSorterTooltip: false
      },
      {
        title: '페이지뷰',
        dataIndex: 'pageview_count',
        key: 'pageview_count',
        width: 68,
        align: 'center',
        sorter: (a, b) => a.pageview_count - b.pageview_count,
        showSorterTooltip: false
      },
      {
        title: '체류 시간',
        dataIndex: 'duration_seconds',
        key: 'duration_seconds',
        width: 72,
        align: 'right',
        render: (duration) => duration ? `${duration}초` : '-',
        sorter: (a, b) => (a.duration_seconds || 0) - (b.duration_seconds || 0),
        showSorterTooltip: false
      },
      {
        title: '진입 페이지',
        dataIndex: 'entry_url',
        key: 'entry_url',
        width: 140,
        render: (url) => <ShortUrl url={url} />,
        sorter: (a, b) => {
          const decodedA = safeDecodeURI(a.entry_url || '');
          const decodedB = safeDecodeURI(b.entry_url || '');
          return decodedA.localeCompare(decodedB, 'ko');
        },
        showSorterTooltip: false
      },
      {
        title: '이탈 페이지',
        dataIndex: 'exit_url',
        key: 'exit_url',
        width: 140,
        render: (url) => <ShortUrl url={url} />,
        sorter: (a, b) => {
          const decodedA = safeDecodeURI(a.exit_url || '');
          const decodedB = safeDecodeURI(b.exit_url || '');
          return decodedA.localeCompare(decodedB, 'ko');
        },
        showSorterTooltip: false
      },
      {
        title: 'IP 주소',
        dataIndex: 'ip_address',
        key: 'ip_address',
        width: 100,
        render: (ip) => <ShortIp ip={ip} />,
        sorter: (a, b) => (a.ip_address || '').localeCompare(b.ip_address || ''),
        showSorterTooltip: false
      },
      {
        title: '기기',
        dataIndex: 'device_type',
        key: 'device_type',
        width: 65,
        render: (device) => <DeviceText device={device} />,
        sorter: (a, b) => {
          const order = { 'pc': 1, 'mobile': 2, 'tablet': 3 };
          return (order[a.device_type] || 999) - (order[b.device_type] || 999);
        },
        showSorterTooltip: false
      },
      {
        title: '브라우저',
        dataIndex: 'browser',
        key: 'browser',
        width: 80,
        render: (browser) => <EllipsisText text={browser} maxLength={7} />,
        sorter: (a, b) => (a.browser || '').localeCompare(b.browser || ''),
        showSorterTooltip: false
      },
      {
        title: '운영체제',
        dataIndex: 'os',
        key: 'os',
        width: 70,
        render: (os) => <EllipsisText text={os} maxLength={6} />,
        sorter: (a, b) => (a.os || '').localeCompare(b.os || ''),
        showSorterTooltip: false
      },
      {
        title: <div style={{ lineHeight: '1.2', fontSize: '12px' }}>즉시<br/>이탈</div>,
        dataIndex: 'is_bounced',
        key: 'is_bounced',
        width: 60,
        align: 'center',
        render: (bounced) => bounced ? <Tag color="red">Y</Tag> : <Tag color="green">N</Tag>,
        sorter: (a, b) => (a.is_bounced === b.is_bounced ? 0 : a.is_bounced ? 1 : -1),
        showSorterTooltip: false
      },
      {
        title: <div style={{ lineHeight: '1.2', fontSize: '12px' }}>구매<br/>여부</div>,
        dataIndex: 'is_converted',
        key: 'is_converted',
        width: 60,
        align: 'center',
        render: (converted) => converted ? <Tag color="success">✅</Tag> : <Tag>-</Tag>,
        sorter: (a, b) => (a.is_converted === b.is_converted ? 0 : a.is_converted ? 1 : -1),
        showSorterTooltip: false
      }
    ]
  },
  pageviews: {
    title: '👁️ 페이지뷰',
    description: '페이지뷰 데이터 테이블',
    columns: [
      {
        title: '번호',
        dataIndex: 'id',
        key: 'id',
        width: 65,
        align: 'center',
        sorter: (a, b) => a.id - b.id,
        showSorterTooltip: false
      },
      {
        title: '쿠키 ID',
        dataIndex: 'visitor_id',
        key: 'visitor_id',
        width: 85,
        render: (id) => <ShortId id={id} length={5} />,
        sorter: (a, b) => (a.visitor_id || '').localeCompare(b.visitor_id || ''),
        showSorterTooltip: false
      },
      {
        title: '세션 ID',
        dataIndex: 'session_id',
        key: 'session_id',
        width: 85,
        render: (id) => <ShortId id={id} length={5} />,
        sorter: (a, b) => (a.session_id || '').localeCompare(b.session_id || ''),
        showSorterTooltip: false
      },
      {
        title: '시간',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 110,
        render: (date) => dayjs(date).format('MM-DD HH:mm'),
        sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
        showSorterTooltip: false
      },
      {
        title: '페이지 URL',
        dataIndex: 'page_url',
        key: 'page_url',
        width: 280,
        render: (url) => <ShortUrl url={url} />,
        sorter: (a, b) => {
          const decodedA = safeDecodeURI(a.page_url || '');
          const decodedB = safeDecodeURI(b.page_url || '');
          return decodedA.localeCompare(decodedB, 'ko');
        },
        showSorterTooltip: false
      },
      {
        title: '페이지 제목',
        dataIndex: 'page_title',
        key: 'page_title',
        width: 160,
        render: (title) => <EllipsisText text={title} maxLength={20} />,
        sorter: (a, b) => (a.page_title || '').localeCompare(b.page_title || ''),
        showSorterTooltip: false
      },
      {
        title: '체류 시간',
        dataIndex: 'time_spent_seconds',
        key: 'time_spent_seconds',
        width: 80,
        align: 'center',
        render: (seconds) => {
          if (!seconds || seconds === 0) return '-';
          if (seconds >= 60) {
            return (
              <Tag color={seconds >= 180 ? 'red' : 'orange'}>
                🔥 {Math.floor(seconds / 60)}분 {seconds % 60}초
              </Tag>
            );
          }
          return (
            <Tag color={seconds < 10 ? 'cyan' : 'blue'}>
              {seconds < 10 ? '⚡' : '⏱️'} {seconds}초
            </Tag>
          );
        },
        sorter: (a, b) => (a.time_spent_seconds || 0) - (b.time_spent_seconds || 0),
        showSorterTooltip: false
      },
      {
        title: '기기',
        dataIndex: 'device_type',
        key: 'device_type',
        width: 65,
        render: (device) => <DeviceText device={device} />,
        sorter: (a, b) => {
          const order = { 'pc': 1, 'mobile': 2, 'tablet': 3 };
          return (order[a.device_type] || 999) - (order[b.device_type] || 999);
        },
        showSorterTooltip: false
      },
      {
        title: '브라우저',
        dataIndex: 'browser',
        key: 'browser',
        width: 80,
        render: (browser) => <EllipsisText text={browser} maxLength={7} />,
        sorter: (a, b) => (a.browser || '').localeCompare(b.browser || ''),
        showSorterTooltip: false
      },
      {
        title: '기록 시간',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 110,
        render: (date) => dayjs(date).format('MM-DD HH:mm'),
        sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
        showSorterTooltip: false
      }
    ]
  },
  events: {
    title: '⚡ 이벤트',
    description: '이벤트 데이터 테이블 (상품 조회, 장바구니 등)',
    columns: [
      {
        title: '번호',
        dataIndex: 'id',
        key: 'id',
        width: 65,
        align: 'center',
        sorter: (a, b) => a.id - b.id,
        showSorterTooltip: false
      },
      {
        title: '쿠키 ID',
        dataIndex: 'visitor_id',
        key: 'visitor_id',
        width: 85,
        render: (id) => <ShortId id={id} length={5} />,
        sorter: (a, b) => (a.visitor_id || '').localeCompare(b.visitor_id || ''),
        showSorterTooltip: false
      },
      {
        title: '세션 ID',
        dataIndex: 'session_id',
        key: 'session_id',
        width: 85,
        render: (id) => <ShortId id={id} length={5} />,
        sorter: (a, b) => (a.session_id || '').localeCompare(b.session_id || ''),
        showSorterTooltip: false
      },
      {
        title: '시간',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 110,
        render: (date) => dayjs(date).format('MM-DD HH:mm'),
        sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
        showSorterTooltip: false
      },
      {
        title: '이벤트 타입',
        dataIndex: 'event_type',
        key: 'event_type',
        width: 105,
        render: (type) => {
          const colorMap = {
            pageview: 'blue',
            view_product: 'green',
            add_to_cart: 'orange',
            purchase: 'red'
          };
          return <Tag color={colorMap[type] || 'default'}>{type}</Tag>;
        },
        sorter: (a, b) => {
          const order = { 'view_product': 1, 'add_to_cart': 2, 'purchase': 3, 'pageview': 4 };
          return (order[a.event_type] || 999) - (order[b.event_type] || 999);
        },
        showSorterTooltip: false
      },
      {
        title: '상품명',
        dataIndex: 'product_name',
        key: 'product_name',
        width: 160,
        render: (name) => <EllipsisText text={name} maxLength={22} />,
        sorter: (a, b) => (a.product_name || '').localeCompare(b.product_name || ''),
        showSorterTooltip: false
      },
      {
        title: '상품 ID',
        dataIndex: 'product_id',
        key: 'product_id',
        width: 75,
        render: (id) => id || '-',
        sorter: (a, b) => (a.product_id || '').localeCompare(b.product_id || ''),
        showSorterTooltip: false
      },
      {
        title: '가격',
        dataIndex: 'product_price',
        key: 'product_price',
        width: 85,
        align: 'right',
        render: (price) => price ? `${price.toLocaleString()}원` : '-',
        sorter: (a, b) => (a.product_price || 0) - (b.product_price || 0),
        showSorterTooltip: false
      },
      {
        title: '수량',
        dataIndex: 'quantity',
        key: 'quantity',
        width: 58,
        align: 'center',
        sorter: (a, b) => (a.quantity || 0) - (b.quantity || 0),
        showSorterTooltip: false
      },
      {
        title: '기기',
        dataIndex: 'device_type',
        key: 'device_type',
        width: 65,
        render: (device) => <DeviceText device={device} />,
        sorter: (a, b) => {
          const order = { 'pc': 1, 'mobile': 2, 'tablet': 3 };
          return (order[a.device_type] || 999) - (order[b.device_type] || 999);
        },
        showSorterTooltip: false
      },
      {
        title: '브라우저',
        dataIndex: 'browser',
        key: 'browser',
        width: 80,
        render: (browser) => <EllipsisText text={browser} maxLength={7} />,
        sorter: (a, b) => (a.browser || '').localeCompare(b.browser || ''),
        showSorterTooltip: false
      },
      {
        title: '기록 시간',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 110,
        render: (date) => dayjs(date).format('MM-DD HH:mm'),
        sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
        showSorterTooltip: false
      }
    ]
  },
  conversions: {
    title: '💰 구매전환',
    description: '구매 전환 데이터 테이블',
    columns: [
      {
        title: '번호',
        dataIndex: 'id',
        key: 'id',
        width: 60,
        align: 'center',
        sorter: (a, b) => a.id - b.id,
        showSorterTooltip: false
      },
      {
        title: '쿠키 ID',
        dataIndex: 'visitor_id',
        key: 'visitor_id',
        width: 80,
        render: (id) => <ShortId id={id} length={5} />,
        sorter: (a, b) => (a.visitor_id || '').localeCompare(b.visitor_id || ''),
        showSorterTooltip: false
      },
      {
        title: '세션 ID',
        dataIndex: 'session_id',
        key: 'session_id',
        width: 80,
        render: (id) => <ShortId id={id} length={5} />,
        sorter: (a, b) => (a.session_id || '').localeCompare(b.session_id || ''),
        showSorterTooltip: false
      },
      {
        title: '주문번호',
        dataIndex: 'order_id',
        key: 'order_id',
        width: 130,
        render: (text) => (
          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{text}</span>
        ),
        sorter: (a, b) => (a.order_id || '').localeCompare(b.order_id || ''),
        showSorterTooltip: false
      },
      {
        title: '시간',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 100,
        render: (date) => dayjs(date).format('MM-DD HH:mm'),
        sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
        showSorterTooltip: false
      },
      {
        title: '결제 금액',
        dataIndex: 'final_payment',
        key: 'final_payment',
        width: 85,
        align: 'right',
        render: (amount) => (
          <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
            {amount?.toLocaleString()}원
          </span>
        ),
        sorter: (a, b) => (a.final_payment || 0) - (b.final_payment || 0),
        showSorterTooltip: false
      },
      {
        title: '상품 금액',
        dataIndex: 'total_amount',
        key: 'total_amount',
        width: 85,
        align: 'right',
        render: (amount) => `${amount?.toLocaleString()}원`,
        sorter: (a, b) => (a.total_amount || 0) - (b.total_amount || 0),
        showSorterTooltip: false
      },
      {
        title: '할인',
        dataIndex: 'discount_amount',
        key: 'discount_amount',
        width: 70,
        align: 'right',
        render: (amount) => amount ? `-${amount.toLocaleString()}원` : '-',
        sorter: (a, b) => (a.discount_amount || 0) - (b.discount_amount || 0),
        showSorterTooltip: false
      },
      {
        title: '적립금',
        dataIndex: 'mileage_used',
        key: 'mileage_used',
        width: 70,
        align: 'right',
        render: (amount) => amount ? `-${amount.toLocaleString()}원` : '-',
        sorter: (a, b) => (a.mileage_used || 0) - (b.mileage_used || 0),
        showSorterTooltip: false
      },
      {
        title: '배송비',
        dataIndex: 'shipping_fee',
        key: 'shipping_fee',
        width: 70,
        align: 'right',
        render: (amount) => amount ? `+${amount.toLocaleString()}원` : '-',
        sorter: (a, b) => (a.shipping_fee || 0) - (b.shipping_fee || 0),
        showSorterTooltip: false
      },
      {
        title: '상품 수',
        dataIndex: 'product_count',
        key: 'product_count',
        width: 75,
        align: 'center',
        sorter: (a, b) => (a.product_count || 0) - (b.product_count || 0),
        showSorterTooltip: false
      },
      {
        title: 'IP',
        dataIndex: 'ip_address',
        key: 'ip_address',
        width: 58,
        render: (ip) => <ShortIp ip={ip} />,
        sorter: (a, b) => (a.ip_address || '').localeCompare(b.ip_address || ''),
        showSorterTooltip: false
      },
      {
        title: '기기',
        dataIndex: 'device_type',
        key: 'device_type',
        width: 60,
        render: (device) => <DeviceText device={device} />,
        sorter: (a, b) => {
          const order = { 'pc': 1, 'mobile': 2, 'tablet': 3 };
          return (order[a.device_type] || 999) - (order[b.device_type] || 999);
        },
        showSorterTooltip: false
      },
      {
        title: '브라우저',
        dataIndex: 'browser',
        key: 'browser',
        width: 90,
        render: (browser) => <EllipsisText text={browser} maxLength={7} />,
        sorter: (a, b) => (a.browser || '').localeCompare(b.browser || ''),
        showSorterTooltip: false
      },
      {
        title: '운영체제',
        dataIndex: 'os',
        key: 'os',
        width: 85,
        render: (os) => <EllipsisText text={os} maxLength={6} />,
        sorter: (a, b) => (a.os || '').localeCompare(b.os || ''),
        showSorterTooltip: false
      },
      {
        title: 'UTM Source',
        dataIndex: 'utm_source',
        key: 'utm_source',
        width: 85,
        render: (source) => source ? <Tag>{source}</Tag> : '-',
        sorter: (a, b) => (a.utm_source || '').localeCompare(b.utm_source || ''),
        showSorterTooltip: false
      },
      {
        title: 'UTM Campaign',
        dataIndex: 'utm_campaign',
        key: 'utm_campaign',
        width: 90,
        render: (campaign) => <EllipsisText text={campaign} maxLength={11} />,
        sorter: (a, b) => (a.utm_campaign || '').localeCompare(b.utm_campaign || ''),
        showSorterTooltip: false
      },
      {
        title: '기록 시간',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 100,
        render: (date) => dayjs(date).format('MM-DD HH:mm'),
        sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
        showSorterTooltip: false
      }
    ]
  },
  'utm-sessions': {
    title: '🌐 UTM 세션',
    description: 'UTM 세션 히스토리 테이블 (멀티터치 어트리뷰션)',
    columns: [
      {
        title: '번호',
        dataIndex: 'id',
        key: 'id',
        width: 65,
        align: 'center',
        sorter: (a, b) => a.id - b.id,
        showSorterTooltip: false
      },
      {
        title: '쿠키 ID',
        dataIndex: 'visitor_id',
        key: 'visitor_id',
        width: 85,
        render: (id) => <ShortId id={id} length={5} />,
        sorter: (a, b) => (a.visitor_id || '').localeCompare(b.visitor_id || ''),
        showSorterTooltip: false
      },
      {
        title: '세션 ID',
        dataIndex: 'session_id',
        key: 'session_id',
        width: 85,
        render: (id) => <ShortId id={id} length={5} />,
        sorter: (a, b) => (a.session_id || '').localeCompare(b.session_id || ''),
        showSorterTooltip: false
      },
      {
        title: '순서',
        dataIndex: 'sequence_order',
        key: 'sequence_order',
        width: 58,
        align: 'center',
        render: (order) => <Tag color="blue">{order}</Tag>,
        sorter: (a, b) => a.sequence_order - b.sequence_order,
        showSorterTooltip: false
      },
      {
        title: '진입 시간',
        dataIndex: 'entry_timestamp',
        key: 'entry_timestamp',
        width: 110,
        render: (date) => dayjs(date).format('MM-DD HH:mm'),
        sorter: (a, b) => new Date(a.entry_timestamp) - new Date(b.entry_timestamp),
        showSorterTooltip: false
      },
      {
        title: '이탈 시간',
        dataIndex: 'exit_timestamp',
        key: 'exit_timestamp',
        width: 110,
        render: (date) => date ? dayjs(date).format('MM-DD HH:mm') : '-',
        sorter: (a, b) => new Date(a.exit_timestamp || 0) - new Date(b.exit_timestamp || 0),
        showSorterTooltip: false
      },
      {
        title: '체류 시간',
        dataIndex: 'duration_seconds',
        key: 'duration_seconds',
        width: 85,
        align: 'right',
        render: (duration) => duration ? `${duration}초` : '-',
        sorter: (a, b) => (a.duration_seconds || 0) - (b.duration_seconds || 0),
        showSorterTooltip: false
      },
      {
        title: '페이지 URL',
        dataIndex: 'page_url',
        key: 'page_url',
        width: 180,
        render: (url) => <ShortUrl url={url} />,
        sorter: (a, b) => {
          const decodedA = safeDecodeURI(a.page_url || '');
          const decodedB = safeDecodeURI(b.page_url || '');
          return decodedA.localeCompare(decodedB, 'ko');
        },
        showSorterTooltip: false
      },
      {
        title: 'UTM Source',
        dataIndex: 'utm_source',
        key: 'utm_source',
        width: 95,
        render: (source) => source ? <Tag>{source}</Tag> : '-',
        sorter: (a, b) => (a.utm_source || '').localeCompare(b.utm_source || ''),
        showSorterTooltip: false
      },
      {
        title: 'UTM Medium',
        dataIndex: 'utm_medium',
        key: 'utm_medium',
        width: 95,
        render: (medium) => <EllipsisText text={medium} maxLength={9} />,
        sorter: (a, b) => (a.utm_medium || '').localeCompare(b.utm_medium || ''),
        showSorterTooltip: false
      },
      {
        title: 'UTM Campaign',
        dataIndex: 'utm_campaign',
        key: 'utm_campaign',
        width: 140,
        render: (campaign) => <EllipsisText text={campaign} maxLength={16} />,
        sorter: (a, b) => (a.utm_campaign || '').localeCompare(b.utm_campaign || ''),
        showSorterTooltip: false
      },
      {
        title: '페이지뷰',
        dataIndex: 'pageview_count',
        key: 'pageview_count',
        width: 75,
        align: 'center',
        sorter: (a, b) => a.pageview_count - b.pageview_count,
        showSorterTooltip: false
      },
      {
        title: '기기',
        dataIndex: 'device_type',
        key: 'device_type',
        width: 60,
        render: (device) => <DeviceText device={device} />,
        sorter: (a, b) => {
          const order = { 'pc': 1, 'mobile': 2, 'tablet': 3 };
          return (order[a.device_type] || 999) - (order[b.device_type] || 999);
        },
        showSorterTooltip: false
      },
      {
        title: '브라우저',
        dataIndex: 'browser',
        key: 'browser',
        width: 80,
        render: (browser) => <EllipsisText text={browser} maxLength={7} />,
        sorter: (a, b) => (a.browser || '').localeCompare(b.browser || ''),
        showSorterTooltip: false
      },
      {
        title: '기록 시간',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 110,
        render: (date) => dayjs(date).format('MM-DD HH:mm'),
        sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
        showSorterTooltip: false
      }
    ]
  },
  'realtime-visitors': {
    title: '🔴 실시간 방문자',
    description: '실시간 방문자 추적 테이블 (최근 5분)',
    columns: [
      {
        title: '쿠키 ID',
        dataIndex: 'visitor_id',
        key: 'visitor_id',
        width: 260,
        fixed: 'left',
        render: (text) => (
          <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{text}</span>
        ),
        sorter: (a, b) => (a.visitor_id || '').localeCompare(b.visitor_id || ''),
        showSorterTooltip: false
      },
      {
        title: '마지막 활동',
        dataIndex: 'last_activity',
        key: 'last_activity',
        width: 170,
        render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
        sorter: (a, b) => new Date(a.last_activity) - new Date(b.last_activity),
        showSorterTooltip: false
      },
      {
        title: '현재 페이지',
        dataIndex: 'current_url',
        key: 'current_url',
        width: 380,
        ellipsis: true,
        render: (url) => (
          <span style={{ fontSize: '11px', wordBreak: 'break-all' }}>{url || '-'}</span>
        ),
        sorter: (a, b) => (a.current_url || '').localeCompare(b.current_url || ''),
        showSorterTooltip: false
      },
      {
        title: '디바이스',
        dataIndex: 'device_type',
        key: 'device_type',
        width: 95,
        render: (device) => device ? (
          <Tag color={device === 'mobile' ? 'blue' : 'green'}>
            {device === 'mobile' ? '📱' : '💻'} {device}
          </Tag>
        ) : '-',
        sorter: (a, b) => {
          const order = { 'pc': 1, 'mobile': 2, 'tablet': 3 };
          return (order[a.device_type] || 999) - (order[b.device_type] || 999);
        },
        showSorterTooltip: false
      },
      {
        title: '브라우저',
        dataIndex: 'browser',
        key: 'browser',
        width: 110,
        render: (browser) => browser || '-',
        sorter: (a, b) => (a.browser || '').localeCompare(b.browser || ''),
        showSorterTooltip: false
      },
      {
        title: 'OS',
        dataIndex: 'os',
        key: 'os',
        width: 110,
        render: (os) => os || '-',
        sorter: (a, b) => (a.os || '').localeCompare(b.os || ''),
        showSorterTooltip: false
      }
    ]
  }
};

// ============================================================================
// DataTables 컴포넌트
// ============================================================================
function DataTables() {
  const { tableName } = useParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [error, setError] = useState(null);
  
  // 검색 및 필터 state
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    device: 'all',
    browser: 'all',
    os: 'all',
    is_bounced: 'all',
    is_converted: 'all',
    utm_source: 'all',
    utm_medium: 'all',
    utm_campaign: 'all',
    dateRange: null
  });

  // 동적 UTM 필터 state
  const [activeUtmFilters, setActiveUtmFilters] = useState([]);

  const tableConfig = TABLE_CONFIGS[tableName];

  // 동적 컬럼을 useMemo로 메모이제이션하여 불필요한 재생성 방지
  const tableColumns = useMemo(() => {
    if (!tableConfig || !tableConfig.columns) return [];
    
    const baseColumns = tableConfig.columns;
    
    // UTM 필터가 없거나 비어있으면 원본 컬럼 반환
    if (!activeUtmFilters || activeUtmFilters.length === 0) {
      return baseColumns;
    }
    
    // 기본 UTM 컬럼 위치 찾기 (utm_source, utm_medium, utm_campaign)
    const utmSourceIndex = baseColumns.findIndex(col => col.key === 'utm_source');
    const utmMediumIndex = baseColumns.findIndex(col => col.key === 'utm_medium');
    const utmCampaignIndex = baseColumns.findIndex(col => col.key === 'utm_campaign');
    
    // 가장 마지막 기본 UTM 컬럼 위치 찾기
    const lastUtmIndex = Math.max(utmSourceIndex, utmMediumIndex, utmCampaignIndex);
    
    // UTM 컬럼이 없으면 원본 반환
    if (lastUtmIndex === -1) {
      return baseColumns;
    }
    
    // 컬럼 복사 (원본 변경 방지)
    const columns = [...baseColumns];
    
    // 추가 UTM 컬럼 생성 (기본 3개 제외)
    const additionalUtmColumns = activeUtmFilters
      .filter(filter => !['utm_source', 'utm_medium', 'utm_campaign'].includes(filter.key))
      .map(filter => ({
        title: filter.key.replace('utm_', '').replace(/_/g, ' ').toUpperCase(),
        dataIndex: ['utm_params', filter.key],
        key: `dynamic_${filter.key}`,
        width: 120,
        render: (value, record) => {
          // JSONB 데이터 확인
          if (record.utm_params && record.utm_params[filter.key]) {
            return <Tag color="purple">{record.utm_params[filter.key]}</Tag>;
          }
          return '-';
        }
      }));
    
    // 기본 UTM 컬럼 뒤에 동적 컬럼 삽입
    columns.splice(lastUtmIndex + 1, 0, ...additionalUtmColumns);
    
    return columns;
  }, [tableName, activeUtmFilters]);

  useEffect(() => {
    if (tableConfig) {
      fetchData();
    }
  }, [tableName, currentPage, pageSize, searchTerm, filters, activeUtmFilters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      setData([]); // 로딩 시작 시 데이터 초기화
      
      const offset = (currentPage - 1) * pageSize;
      
      // API 파라미터 구성
      const params = {
        limit: pageSize,
        offset: offset
      };
      
      // 검색어 추가
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      // 디바이스 필터 추가
      if (filters.device && filters.device !== 'all') {
        params.device_type = filters.device;
      }
      
      // 브라우저 필터 추가
      if (filters.browser && filters.browser !== 'all') {
        params.browser = filters.browser;
      }
      
      // OS 필터 추가
      if (filters.os && filters.os !== 'all') {
        params.os = filters.os;
      }
      
      // 이벤트 타입 필터 추가
      if (filters.event_type && filters.event_type !== 'all') {
        params.event_type = filters.event_type;
      }
      
      // 즉시 이탈 여부 필터 추가
      if (filters.is_bounced && filters.is_bounced !== 'all') {
        params.is_bounced = filters.is_bounced === 'true';
      }
      
      // 구매 여부 필터 추가
      if (filters.is_converted && filters.is_converted !== 'all') {
        params.is_converted = filters.is_converted === 'true';
      }
      
      // 동적 UTM 필터 추가 (Phase 3: Dynamic UTM Filter)
      if (activeUtmFilters && activeUtmFilters.length > 0) {
        params.utm_filters = JSON.stringify(activeUtmFilters);
      }
      
      // 날짜 범위 필터 추가
      if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
        params.start_date = filters.dateRange[0].format('YYYY-MM-DD');
        params.end_date = filters.dateRange[1].format('YYYY-MM-DD');
      }
      
      const response = await axios.get(`${API_URL}/api/tables/${tableName}`, { params });

      // 안전한 데이터 처리
      const fetchedData = response.data?.data || [];
      const filteredData = fetchedData.filter(item => item && Object.keys(item).length > 0);
      
      setData(filteredData);
      setTotal(parseInt(response.data?.total || 0));
      setLoading(false);
    } catch (err) {
      console.error('테이블 데이터 조회 실패:', err);
      setError(err.response?.data?.error || '데이터를 불러올 수 없습니다.');
      setData([]); // 에러 시에도 빈 배열로 초기화
      setLoading(false);
    }
  };

  // 검색 핸들러
  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1); // 검색 시 첫 페이지로 이동
  };

  // 필터 변경 핸들러
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
  };

  // 초기화 핸들러
  const handleReset = () => {
    setSearchTerm('');
    setFilters({
      device: 'all',
      browser: 'all',
      os: 'all',
      is_bounced: 'all',
      is_converted: 'all',
      utm_source: 'all',
      utm_medium: 'all',
      utm_campaign: 'all',
      dateRange: null
    });
    setCurrentPage(1);
  };

  if (!tableConfig) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="잘못된 테이블 이름"
          description={`'${tableName}' 테이블을 찾을 수 없습니다.`}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 헤더 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>
                {tableConfig.title}
              </Title>
              <div style={{ color: '#999', fontSize: '14px', marginTop: '4px' }}>
                {tableConfig.description}
              </div>
            </div>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchData}
              loading={loading}
            >
              새로고침
            </Button>
          </div>
          <Tag color="blue">총 {total.toLocaleString()}건</Tag>
        </Space>
      </Card>

      {/* 검색 및 필터 */}
      <SearchFilterBar
        searchPlaceholder={
          tableName === 'sessions' 
            ? `세션 ID, 쿠키 ID, IP 주소, 진입/이탈 페이지 검색`
            : tableName === 'pageviews'
              ? `쿠키 ID, 세션 ID, 페이지 URL, 페이지 제목 검색`
              : tableName === 'events'
                ? `쿠키 ID, 세션 ID, 상품 ID, 상품명 검색`
                : tableName === 'conversions'
                  ? `쿠키 ID, 세션 ID, 주문번호, IP 주소 검색`
                  : tableName === 'utm-sessions'
                    ? `쿠키 ID, 세션 ID, 페이지 URL 검색`
                    : `쿠키 ID, IP 주소 검색`
        }
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        showDeviceFilter={tableName === 'visitors' || tableName === 'sessions' || tableName === 'pageviews' || tableName === 'events' || tableName === 'conversions' || tableName === 'utm-sessions'}
        showBrowserFilter={tableName === 'visitors' || tableName === 'sessions' || tableName === 'pageviews' || tableName === 'events' || tableName === 'conversions' || tableName === 'utm-sessions'}
        showOsFilter={tableName === 'visitors' || tableName === 'sessions' || tableName === 'conversions'}
        showEventTypeFilter={tableName === 'events'}
        showBouncedFilter={tableName === 'sessions'}
        showConvertedFilter={tableName === 'sessions'}
        showDateFilter={true}
        loading={loading}
      />

      {/* 동적 UTM 필터 (Phase 3) - visitors, conversions, utm-sessions 테이블만 */}
      {(tableName === 'visitors' || tableName === 'conversions' || tableName === 'utm-sessions') && (
        <Card size="small" style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px', fontSize: '13px', color: '#666', fontWeight: 500 }}>
            🔍 UTM 필터
          </div>
          <DynamicUtmFilterBar
            tableName={tableName}
            onFilterChange={setActiveUtmFilters}
            loading={loading}
          />
        </Card>
      )}

      {/* 에러 표시 */}
      {error && (
        <Alert
          message="데이터 조회 실패"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* 테이블 */}
      <Card>
        <Table
          columns={tableColumns}
          dataSource={data}
          rowKey={(record) => record.id || record.visitor_id || record.session_id}
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showTotal: (total) => `총 ${total.toLocaleString()}건`,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100', '200'],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            }
          }}
          scroll={{ x: 'max-content' }}
          size="small"
        />
      </Card>

      {/* 푸터 */}
      <div style={{ marginTop: '16px', textAlign: 'center', color: '#999' }}>
        마지막 갱신: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
      </div>
    </div>
  );
}

export default DataTables;
