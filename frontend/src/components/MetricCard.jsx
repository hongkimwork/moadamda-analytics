import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../lib/utils';

export function MetricCard({ 
  title, 
  value, 
  subtitle,
  change, 
  changeLabel = "전일 대비",
  icon: Icon,
  trend,
  format = 'number'
}) {
  const formatValue = (val) => {
    if (format === 'currency') {
      return `${val.toLocaleString()}원`;
    } else if (format === 'percent') {
      return `${val}%`;
    } else {
      return val.toLocaleString();
    }
  };

  const getTrendIcon = () => {
    if (change > 0) return TrendingUp;
    if (change < 0) return TrendingDown;
    return Minus;
  };

  const getTrendColor = () => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const TrendIcon = getTrendIcon();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <Icon className="h-4 w-4 text-muted-foreground" />
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-2">
          <div className="text-2xl font-bold">
            {formatValue(value)}
          </div>
          
          {subtitle && (
            <div className="text-xs text-muted-foreground">
              {subtitle}
            </div>
          )}

          {change !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              <TrendIcon className={cn("h-3 w-3", getTrendColor())} />
              <span className={getTrendColor()}>
                {change > 0 && '+'}{change}%
              </span>
              <span className="text-muted-foreground">{changeLabel}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

