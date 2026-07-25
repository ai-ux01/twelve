'use client';

import { IndicatorResult } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Volume2,
  Target,
  Zap,
} from 'lucide-react';

interface IndicatorPanelProps {
  indicators: IndicatorResult;
  currentPrice?: number;
  className?: string;
}

/**
 * IndicatorPanel Component
 *
 * Displays all calculated technical indicators in an organized panel:
 * - ADX with trend strength interpretation
 * - ATR with volatility assessment
 * - VWAP with current price position
 * - Volume analysis (MA and relative volume)
 * - 52-week high/low with percentage distance
 * - Momentum indicator
 * - Additional indicators (RSI, MACD, Bollinger Bands)
 *
 * Requirements covered: 13.2
 */
export function IndicatorPanel({ indicators, currentPrice, className }: IndicatorPanelProps) {
  // ADX Trend Strength Interpretation
  const getADXInterpretation = (adx: number) => {
    if (adx < 20) return { text: 'Weak/No Trend', color: 'text-gray-500', variant: 'outline' as const };
    if (adx < 25) return { text: 'Developing Trend', color: 'text-yellow-600', variant: 'outline' as const };
    if (adx < 50) return { text: 'Strong Trend', color: 'text-green-600', variant: 'default' as const };
    return { text: 'Very Strong Trend', color: 'text-emerald-600', variant: 'default' as const };
  };

  // ATR Volatility Assessment
  const getATRInterpretation = (atr: number, price?: number) => {
    if (!price) return { text: 'Normal', color: 'text-gray-500' };
    const volatilityPercent = (atr / price) * 100;
    if (volatilityPercent < 1) return { text: 'Low Volatility', color: 'text-blue-600' };
    if (volatilityPercent < 2) return { text: 'Normal Volatility', color: 'text-gray-600' };
    if (volatilityPercent < 3) return { text: 'High Volatility', color: 'text-orange-600' };
    return { text: 'Extreme Volatility', color: 'text-red-600' };
  };

  // VWAP Position Assessment
  const getVWAPPosition = (price: number, vwap: number) => {
    const diff = ((price - vwap) / vwap) * 100;
    if (Math.abs(diff) < 0.5) return { text: 'At VWAP', color: 'text-gray-600', icon: Minus };
    if (diff > 0) return { text: `Above VWAP (+${diff.toFixed(2)}%)`, color: 'text-green-600', icon: TrendingUp };
    return { text: `Below VWAP (${diff.toFixed(2)}%)`, color: 'text-red-600', icon: TrendingDown };
  };

  // Volume Assessment
  const getVolumeAssessment = (relativeVolume: number) => {
    if (relativeVolume < 0.5) return { text: 'Very Low Volume', color: 'text-gray-500' };
    if (relativeVolume < 0.8) return { text: 'Low Volume', color: 'text-gray-600' };
    if (relativeVolume < 1.2) return { text: 'Normal Volume', color: 'text-blue-600' };
    if (relativeVolume < 2) return { text: 'High Volume', color: 'text-orange-600' };
    return { text: 'Extremely High Volume', color: 'text-red-600' };
  };

  // Momentum Assessment
  const getMomentumAssessment = (momentum: number) => {
    if (Math.abs(momentum) < 1) return { text: 'Neutral', color: 'text-gray-600', icon: Minus };
    if (momentum > 5) return { text: 'Strong Bullish', color: 'text-green-600', icon: TrendingUp };
    if (momentum > 2) return { text: 'Bullish', color: 'text-green-500', icon: TrendingUp };
    if (momentum < -5) return { text: 'Strong Bearish', color: 'text-red-600', icon: TrendingDown };
    if (momentum < -2) return { text: 'Bearish', color: 'text-red-500', icon: TrendingDown };
    return { text: 'Neutral', color: 'text-gray-600', icon: Minus };
  };

  // Calculate 52-week distance
  const get52WeekDistance = (price?: number) => {
    if (!price) return null;
    const distanceFromHigh = ((price - indicators.week_52_high) / indicators.week_52_high) * 100;
    const distanceFromLow = ((price - indicators.week_52_low) / indicators.week_52_low) * 100;
    return { distanceFromHigh, distanceFromLow };
  };

  const adxInfo = getADXInterpretation(indicators.adx);
  const atrInfo = getATRInterpretation(indicators.atr, currentPrice);
  const vwapInfo = currentPrice ? getVWAPPosition(currentPrice, indicators.vwap) : null;
  const volumeInfo = getVolumeAssessment(indicators.relative_volume);
  const momentumInfo = getMomentumAssessment(indicators.momentum);
  const weekDistance = get52WeekDistance(currentPrice);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-5" />
          Technical Indicators
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ADX - Trend Strength */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">ADX (Trend Strength)</span>
            </div>
            <Badge variant={adxInfo.variant}>{adxInfo.text}</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <span className="text-sm text-muted-foreground">Value</span>
            <span className={cn('text-lg font-bold', adxInfo.color)}>
              {indicators.adx.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {indicators.adx < 20 && 'Market is ranging with no clear trend direction.'}
            {indicators.adx >= 20 && indicators.adx < 25 && 'A trend is starting to develop.'}
            {indicators.adx >= 25 && indicators.adx < 50 && 'Strong trend present in the market.'}
            {indicators.adx >= 50 && 'Extremely strong trend - be cautious of exhaustion.'}
          </p>
        </div>

        <Separator />

        {/* ATR - Volatility */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">ATR (Average True Range)</span>
            </div>
            <span className={cn('text-sm font-medium', atrInfo.color)}>{atrInfo.text}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <span className="text-sm text-muted-foreground">Value</span>
            <span className="text-lg font-bold">₹{indicators.atr.toFixed(2)}</span>
          </div>
          {currentPrice && (
            <p className="text-xs text-muted-foreground">
              {((indicators.atr / currentPrice) * 100).toFixed(2)}% of current price - measures price movement volatility
            </p>
          )}
        </div>

        <Separator />

        {/* VWAP - Price Position */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">VWAP (Volume Weighted Avg)</span>
            </div>
            {vwapInfo && (
              <Badge variant="outline" className="flex items-center gap-1">
                <vwapInfo.icon className="size-3" />
                {vwapInfo.text}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <span className="text-sm text-muted-foreground">VWAP</span>
            <span className="text-lg font-bold">₹{indicators.vwap.toFixed(2)}</span>
          </div>
          {currentPrice && (
            <div className="flex items-center justify-between rounded-lg bg-muted/20 p-2">
              <span className="text-xs text-muted-foreground">Current Price</span>
              <span className={cn('text-sm font-semibold', vwapInfo?.color)}>
                ₹{currentPrice.toFixed(2)}
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {vwapInfo && currentPrice && currentPrice > indicators.vwap && 
              'Price above VWAP suggests bullish sentiment.'}
            {vwapInfo && currentPrice && currentPrice < indicators.vwap && 
              'Price below VWAP suggests bearish sentiment.'}
            {vwapInfo && currentPrice && Math.abs(currentPrice - indicators.vwap) / indicators.vwap < 0.005 && 
              'Price at VWAP - potential pivot point.'}
          </p>
        </div>

        <Separator />

        {/* Volume Analysis */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Volume Analysis</span>
            </div>
            <span className={cn('text-sm font-medium', volumeInfo.color)}>{volumeInfo.text}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">20-Day Avg Volume</p>
              <p className="text-sm font-bold">{indicators.volume_ma.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">Relative Volume</p>
              <p className={cn('text-sm font-bold', volumeInfo.color)}>
                {indicators.relative_volume.toFixed(2)}x
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {indicators.relative_volume < 0.8 && 'Below average volume - weak participation.'}
            {indicators.relative_volume >= 0.8 && indicators.relative_volume < 1.2 && 
              'Normal volume levels - typical market activity.'}
            {indicators.relative_volume >= 1.2 && indicators.relative_volume < 2 && 
              'Above average volume - strong market interest.'}
            {indicators.relative_volume >= 2 && 'Exceptional volume - significant market event.'}
          </p>
        </div>

        <Separator />

        {/* 52-Week High/Low */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">52-Week Range</span>
          </div>
          <div className="space-y-2">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">52-Week High</span>
                <span className="text-sm font-bold text-green-600">
                  ₹{indicators.week_52_high.toFixed(2)}
                </span>
              </div>
              {weekDistance && (
                <p className="text-xs text-muted-foreground">
                  {weekDistance.distanceFromHigh >= 0 
                    ? 'At 52-week high' 
                    : `${Math.abs(weekDistance.distanceFromHigh).toFixed(2)}% below high`}
                </p>
              )}
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">52-Week Low</span>
                <span className="text-sm font-bold text-red-600">
                  ₹{indicators.week_52_low.toFixed(2)}
                </span>
              </div>
              {weekDistance && (
                <p className="text-xs text-muted-foreground">
                  {weekDistance.distanceFromLow <= 0 
                    ? 'At 52-week low' 
                    : `${weekDistance.distanceFromLow.toFixed(2)}% above low`}
                </p>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Momentum Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Momentum</span>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <momentumInfo.icon className="size-3" />
              {momentumInfo.text}
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <span className="text-sm text-muted-foreground">Rate of Change</span>
            <span className={cn('text-lg font-bold', momentumInfo.color)}>
              {indicators.momentum > 0 ? '+' : ''}{indicators.momentum.toFixed(2)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {Math.abs(indicators.momentum) < 1 && 'Minimal momentum - consolidation phase.'}
            {indicators.momentum >= 1 && indicators.momentum < 2 && 'Positive momentum building.'}
            {indicators.momentum >= 2 && indicators.momentum < 5 && 'Strong upward momentum.'}
            {indicators.momentum >= 5 && 'Very strong momentum - watch for exhaustion.'}
            {indicators.momentum <= -1 && indicators.momentum > -2 && 'Negative momentum building.'}
            {indicators.momentum <= -2 && indicators.momentum > -5 && 'Strong downward momentum.'}
            {indicators.momentum <= -5 && 'Very strong downside momentum - watch for reversal.'}
          </p>
        </div>

        <Separator />

        {/* Additional Core Indicators */}
        <div className="space-y-2">
          <span className="text-sm font-semibold">Additional Indicators</span>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">RSI</p>
              <p className={cn(
                'text-sm font-bold',
                indicators.rsi > 70 ? 'text-red-600' : indicators.rsi < 30 ? 'text-green-600' : 'text-gray-600'
              )}>
                {indicators.rsi.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">MACD</p>
              <p className="text-sm font-bold">{indicators.macd.value.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
