import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Lightbulb, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

export function InsightsPanel({ insights = [] }) {
  const getInsightIcon = (type) => {
    switch (type) {
      case 'success': return CheckCircle;
      case 'warning': return AlertCircle;
      default: return Lightbulb;
    }
  };

  const getInsightColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  // 자동 생성된 인사이트 예시
  const defaultInsights = [
    {
      type: 'success',
      title: '매출 성장',
      message: '오늘 매출이 전일 대비 100% 증가했습니다.',
      action: '상세 보기'
    },
    {
      type: 'warning',
      title: '장바구니 이탈률 높음',
      message: '장바구니 이탈률이 62.5%입니다. 결제 프로세스 개선을 권장합니다.',
      action: '개선 방안 보기'
    },
    {
      type: 'info',
      title: '재방문 고객 활성',
      message: '재방문 고객의 평균 페이지뷰가 7.03으로 높습니다.',
      action: null
    }
  ];

  const displayInsights = insights.length > 0 ? insights : defaultInsights;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-primary" />
          AI 인사이트 & 추천
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayInsights.map((insight, index) => {
          const Icon = getInsightIcon(insight.type);
          return (
            <div 
              key={index}
              className={cn(
                "p-3 rounded-lg flex items-start gap-3",
                "hover:shadow-sm transition-shadow"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                getInsightColor(insight.type)
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="font-medium text-sm">{insight.title}</div>
                <div className="text-xs text-muted-foreground">{insight.message}</div>
                {insight.action && (
                  <button className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                    {insight.action}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

