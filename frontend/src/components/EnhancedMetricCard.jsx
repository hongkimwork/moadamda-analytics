import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';

export function EnhancedMetricCard({ 
  title, 
  value, 
  subtitle,
  change, 
  changeLabel = "전일 대비",
  icon: Icon,
  sparklineData = [],
  format = 'number',
  status = 'neutral', // 'good' | 'warning' | 'bad' | 'neutral'
  size = 'default' // 'default' | 'large'
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
    if (change > 0) return 'text-green-600 bg-green-50';
    if (change < 0) return 'text-red-600 bg-red-50';
    return 'text-muted-foreground bg-muted';
  };

  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'border-l-4 border-l-green-500';
      case 'warning': return 'border-l-4 border-l-yellow-500';
      case 'bad': return 'border-l-4 border-l-red-500';
      default: return '';
    }
  };

  const TrendIcon = getTrendIcon();

  return (
    <Card className={cn("relative overflow-hidden", getStatusColor())}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-3">
          <div className={cn(
            "font-bold",
            size === 'large' ? 'text-4xl' : 'text-2xl'
          )}>
            {formatValue(value)}
          </div>
          
          {subtitle && (
            <div className="text-xs text-muted-foreground">
              {subtitle}
            </div>
          )}

          <div className="flex items-center justify-between">
            {change !== undefined && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                getTrendColor()
              )}>
                <TrendIcon className="h-3 w-3" />
                <span>
                  {change > 0 && '+'}{change}%
                </span>
              </div>
            )}

            {/* Sparkline Chart */}
            {sparklineData && sparklineData.length > 0 && (
              <div className="h-8 w-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke={change >= 0 ? '#10b981' : '#ef4444'}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {changeLabel && change !== undefined && (
            <div className="text-xs text-muted-foreground">
              {changeLabel}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

