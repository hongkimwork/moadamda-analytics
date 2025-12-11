import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

/**
 * 디바이스 분석 (PC/모바일 비율)
 */
export function DeviceAnalysis({ stats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>디바이스 분석</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-3xl font-bold">{stats?.devices?.pc || 0}</div>
            <div className="text-sm text-muted-foreground mt-1">PC</div>
            <div className="text-xs text-muted-foreground mt-2">
              {(stats?.visitors?.total > 0 ? ((stats.devices.pc / stats.visitors.total) * 100).toFixed(1) : 0)}%
            </div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-3xl font-bold">{stats?.devices?.mobile || 0}</div>
            <div className="text-sm text-muted-foreground mt-1">모바일</div>
            <div className="text-xs text-muted-foreground mt-2">
              {(stats?.visitors?.total > 0 ? ((stats.devices.mobile / stats.visitors.total) * 100).toFixed(1) : 0)}%
            </div>
          </div>
          <div className="text-center p-4 bg-primary/10 rounded-lg">
            <div className="text-3xl font-bold text-primary">{stats?.visitors?.total || 0}</div>
            <div className="text-sm text-muted-foreground mt-1">전체</div>
            <div className="text-xs text-muted-foreground mt-2">100%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
