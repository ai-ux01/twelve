/**
 * RecommendationCard Component - AI Trading Lab
 *
 * Displays structured recommendation data:
 * - Signal (BUY green/SELL red/HOLD yellow) with icon
 * - Probability percentage with color coding
 * - R:R ratio
 * - Entry, SL, Target prices
 * - Position size
 * - Low-confidence warning badge
 * - High-risk warning badge
 * - Market data timestamp
 *
 * Requirements: 4.1, 4.2, 7.3, 3.1
 */

'use client';

import { TrendingUp, TrendingDown, Minus, AlertTriangle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RecommendationData } from './types';

export interface RecommendationCardProps {
  recommendation: RecommendationData;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const {
    signal,
    probability,
    riskRewardRatio,
    entryPrice,
    stopLoss,
    targetPrice,
    positionSize,
    isLowConfidence,
    isHighRisk,
    warnings,
    marketDataTimestamp,
  } = recommendation;

  const signalConfig = getSignalConfig(signal);

  return (
    <Card className="p-4 w-full max-w-md border-l-4" style={{ borderLeftColor: signalConfig.color }}>
      {/* Header: Signal + Probability */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded font-bold text-sm',
              signalConfig.bgClass
            )}
          >
            {signalConfig.icon}
            <span>{signal}</span>
          </div>
          {isLowConfidence && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-xs">
              <AlertTriangle className="h-3 w-3 mr-0.5" />
              Low Confidence
            </Badge>
          )}
          {isHighRisk && (
            <Badge variant="outline" className="text-red-600 border-red-600 text-xs">
              <AlertTriangle className="h-3 w-3 mr-0.5" />
              High Risk
            </Badge>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <MetricItem
          label="Probability"
          value={`${probability.toFixed(1)}%`}
          className={getProbabilityColor(probability)}
        />
        <MetricItem
          label="R:R Ratio"
          value={`1:${riskRewardRatio.toFixed(1)}`}
          className={riskRewardRatio >= 1.5 ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* Price Levels */}
      {(entryPrice || stopLoss || targetPrice) && (
        <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
          {entryPrice && (
            <div className="bg-muted rounded px-2 py-1.5">
              <span className="text-muted-foreground block">Entry</span>
              <span className="font-medium">₹{entryPrice.toLocaleString()}</span>
            </div>
          )}
          {stopLoss && (
            <div className="bg-red-50 dark:bg-red-950/20 rounded px-2 py-1.5">
              <span className="text-muted-foreground block">Stop Loss</span>
              <span className="font-medium text-red-600">₹{stopLoss.toLocaleString()}</span>
            </div>
          )}
          {targetPrice && (
            <div className="bg-green-50 dark:bg-green-950/20 rounded px-2 py-1.5">
              <span className="text-muted-foreground block">Target</span>
              <span className="font-medium text-green-600">₹{targetPrice.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Position Size */}
      {positionSize !== undefined && positionSize !== null && (
        <div className="text-xs text-muted-foreground mb-2">
          Position Size: <span className="font-medium text-foreground">{positionSize} shares</span>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1 mb-2">
          {warnings.map((warning, idx) => (
            <div key={idx} className="flex items-start gap-1 text-xs text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Timestamp */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
        <Clock className="h-3 w-3" />
        <span>Data as of {formatTimestamp(marketDataTimestamp)}</span>
      </div>
    </Card>
  );
}

function MetricItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <span className="text-xs text-muted-foreground block">{label}</span>
      <span className={cn('text-sm font-semibold', className)}>{value}</span>
    </div>
  );
}

function getSignalConfig(signal: string) {
  switch (signal) {
    case 'BUY':
      return {
        color: '#16a34a',
        bgClass: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
        icon: <TrendingUp className="h-4 w-4" />,
      };
    case 'SELL':
      return {
        color: '#dc2626',
        bgClass: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
        icon: <TrendingDown className="h-4 w-4" />,
      };
    case 'HOLD':
    default:
      return {
        color: '#ca8a04',
        bgClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
        icon: <Minus className="h-4 w-4" />,
      };
  }
}

function getProbabilityColor(probability: number): string {
  if (probability >= 70) return 'text-green-600';
  if (probability >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}
