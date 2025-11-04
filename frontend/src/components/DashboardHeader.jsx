import React from 'react';
import { DatePicker, Space } from 'antd';
import dayjs from 'dayjs';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { RefreshCcw, Download, Settings } from 'lucide-react';

const { RangePicker } = DatePicker;

export function DashboardHeader({ 
  dateRange, 
  onDateRangeChange, 
  deviceFilter, 
  onDeviceFilterChange,
  onRefresh,
  loading 
}) {
  const quickDateButtons = [
    { label: '오늘', days: 0 },
    { label: '어제', days: 1 },
    { label: '최근 7일', days: 7 },
    { label: '최근 30일', days: 30 },
    { label: '이번 달', type: 'month' },
  ];

  const handleQuickDate = (btn) => {
    let newRange;
    
    if (btn.type === 'month') {
      // 이번 달 첫날부터 오늘까지
      newRange = [dayjs().startOf('month'), dayjs()];
    } else if (btn.days === 0) {
      // 오늘
      newRange = [dayjs(), dayjs()];
    } else if (btn.days === 1) {
      // 어제
      newRange = [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')];
    } else {
      // 최근 N일
      newRange = [dayjs().subtract(btn.days - 1, 'day'), dayjs()];
    }
    
    onDateRangeChange(newRange);
  };

  return (
    <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center px-4">
        <div className="flex flex-1 items-center justify-between space-x-4">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">Moadamda Analytics</h1>
              <p className="text-xs text-muted-foreground">마케팅 대시보드</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              내보내기
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border-t bg-muted/40">
        <div className="container flex items-center gap-4 px-4 py-3">
          {/* Device Filter Tabs */}
          <Tabs value={deviceFilter} onValueChange={onDeviceFilterChange} className="w-auto">
            <TabsList>
              <TabsTrigger value="all">전체</TabsTrigger>
              <TabsTrigger value="pc">PC</TabsTrigger>
              <TabsTrigger value="mobile">모바일</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Date Range Picker */}
          <div className="flex items-center gap-2">
            <RangePicker 
              value={dateRange}
              onChange={onDateRangeChange}
              format="YYYY-MM-DD"
              allowClear={false}
              size="small"
            />
          </div>

          {/* Quick Date Buttons */}
          <div className="flex items-center gap-1">
            {quickDateButtons.map((btn) => (
              <Button
                key={btn.label}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handleQuickDate(btn)}
              >
                {btn.label}
              </Button>
            ))}
          </div>

          {/* Period Info */}
          <div className="ml-auto text-xs text-muted-foreground">
            {dateRange && dateRange[0] && dateRange[1] && (
              <>
                {dateRange[0].format('YYYY-MM-DD')} ~ {dateRange[1].format('YYYY-MM-DD')}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

