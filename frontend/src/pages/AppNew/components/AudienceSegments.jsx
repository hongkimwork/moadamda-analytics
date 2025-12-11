import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

/**
 * 고객 세그먼트 비교 (신규 vs 재방문)
 */
export function AudienceSegments({ segments }) {
  if (!segments) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle>🆕 신규 방문자</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">방문자</div>
              <div className="text-2xl font-bold">{segments?.new_visitors?.visitor_count || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">전환율</div>
              <div className="text-2xl font-bold">{segments?.new_visitors?.conversion_rate || 0}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">평균 페이지뷰</div>
              <div className="text-xl font-semibold">{segments?.new_visitors?.avg_pageviews_per_session || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">매출</div>
              <div className="text-xl font-semibold">{(segments?.new_visitors?.revenue || 0).toLocaleString()}원</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle>🔄 재방문 방문자</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">방문자</div>
              <div className="text-2xl font-bold">{segments?.returning_visitors?.visitor_count || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">전환율</div>
              <div className="text-2xl font-bold">{segments?.returning_visitors?.conversion_rate || 0}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">평균 페이지뷰</div>
              <div className="text-xl font-semibold">{segments?.returning_visitors?.avg_pageviews_per_session || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">매출</div>
              <div className="text-xl font-semibold">{(segments?.returning_visitors?.revenue || 0).toLocaleString()}원</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
