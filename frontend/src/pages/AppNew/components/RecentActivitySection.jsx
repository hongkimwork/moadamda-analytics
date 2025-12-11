import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';

dayjs.extend(relativeTime);
dayjs.locale('ko');

/**
 * 실시간 활동 섹션
 */
export function RecentActivitySection({ recentActivity }) {
  if (!recentActivity) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          실시간 활동
          <span className="text-xs text-muted-foreground ml-auto">3분마다 자동 갱신</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="font-medium mb-3 flex items-center justify-between">
              <span>📦 최근 주문</span>
              <span className="text-xs text-muted-foreground">최근 24시간 내</span>
            </div>
            <div className="space-y-2">
              {recentActivity?.recent_orders?.length > 0 ? (
                recentActivity.recent_orders.slice(0, 3).map((order, idx) => (
                  <div key={idx} className="text-sm p-2 bg-muted rounded flex justify-between items-center gap-2">
                    <span className="truncate flex-1">{order.product_name}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{dayjs(order.timestamp).fromNow()}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">최근 주문이 없습니다</div>
              )}
            </div>
          </div>
          <div>
            <div className="font-medium mb-3 flex items-center justify-between">
              <span>👀 인기 조회 상품</span>
              <span className="text-xs text-muted-foreground">최근 1시간 내</span>
            </div>
            <div className="space-y-2">
              {recentActivity?.recently_viewed?.length > 0 ? (
                recentActivity.recently_viewed.slice(0, 3).map((product, idx) => (
                  <div key={idx} className="text-sm p-2 bg-muted rounded flex justify-between items-center gap-2">
                    <span className="truncate flex-1">{product.product_name}</span>
                    <span className="text-xs font-semibold text-blue-600">{product.view_count}회 조회</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">최근 조회 상품이 없습니다</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
