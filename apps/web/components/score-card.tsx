'use client';

import { ScoreResult } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface ScoreCardProps {
  score: ScoreResult;
  className?: string;
}

/**
 * ScoreCard Component
 *
 * Displays deterministic market score with:
 * - Overall score (0-100) with visual gauge
 * - Trend classification (BULLISH/BEARISH/NEUTRAL) with color coding
 * - Signal bullets in organized list
 * - Key metrics: RSI, ADX, VWAP position, volume ratio
 *
 * Requirements covered: 13.2
 */
export function ScoreCard({ score, className }: ScoreCardProps) {
  const { trend, score: scoreValue, rsi, adx, vwap, volumeRatio, signals } = score;

  // Get trend styling
  const getTrendConfig = () => {
    switch (trend) {
      case 'BULLISH':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-600',
          badgeVariant: 'default' as const,
          icon: <TrendingUp className="size-4" />,
        };
      case 'BEARISH':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-600',
          badgeVariant: 'destructive' as const,
          icon: <TrendingDown className="size-4" />,
        };
      case 'NEUTRAL':
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-600',
          badgeVariant: 'outline' as const,
          icon: <Minus className="size-4" />,
        };
    }
  };

  const trendConfig = getTrendConfig();

  // Get score color based on value
  const getScoreColor = (value: number) => {
    if (value >= 70) return 'text-green-600';
    if (value >= 50) return 'text-yellow-600';
    if (value >= 30) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreGradient = (value: number) => {
    if (value >= 70) return 'from-green-500 to-green-600';
    if (value >= 50) return 'from-yellow-500 to-yellow-600';
    if (value >= 30) return 'from-orange-500 to-orange-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5 text-muted-foreground" />
            Market Score
          </CardTitle>
          <Badge variant={trendConfig.badgeVariant} className="flex items-center gap-1">
            {trendConfig.icon}
            {trend}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Visual Score Gauge */}
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <span className="text-sm text-muted-foreground">Overall Score</span>
            <span className={cn('text-4xl font-bold', getScoreColor(scoreValue))}>
              {scoreValue.toFixed(1)}
              <span className="text-lg text-muted-foreground">/100</span>
            </span>
          </div>
          
          {/* Gauge Bar */}
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full bg-gradient-to-r transition-all duration-500',
                getScoreGradient(scoreValue)
              )}
              style={{ width: `${scoreValue}%` }}
            />
          </div>

          {/* Gauge Labels */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">RSI</p>
            <p className="text-xl font-semibold">{rsi.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : rsi > 50 ? 'Bullish' : 'Bearish'}
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">ADX</p>
            <p className="text-xl font-semibold">{adx.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {adx > 25 ? 'Strong Trend' : 'Weak Trend'}
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">VWAP Position</p>
            <p className="text-xl font-semibold">₹{vwap.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Volume Weighted</p>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Volume Ratio</p>
            <p className="text-xl font-semibold">{volumeRatio.toFixed(2)}x</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {volumeRatio > 1.2 ? 'Above Average' : volumeRatio < 0.8 ? 'Below Average' : 'Average'}
            </p>
          </div>
        </div>

        {/* Signal Bullets */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Market Signals</h3>
          <div className="rounded-lg border bg-muted/40 p-4">
            <ul className="space-y-2">
              {signals.length > 0 ? (
                signals.map((signal: string, index: number) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0', trendConfig.bgColor)} />
                    <span className="leading-relaxed">{signal}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground italic">No signals available</li>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
