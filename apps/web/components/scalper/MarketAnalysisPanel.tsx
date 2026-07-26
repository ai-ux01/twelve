'use client';

/**
 * MarketAnalysisPanel Component
 *
 * Displays comprehensive market analysis data:
 * - Spot price (2 decimals)
 * - Trend (Bullish/Bearish/Neutral)
 * - RSI with overbought/oversold indication
 * - MACD with bullish/bearish indication
 * - Price vs VWAP percentage
 * - EMA 5, EMA 15
 * - Support and resistance levels
 * - Trendline status
 * - Call OI, Put OI with comma separators
 * - Call/Put OI changes (absolute with comma, percentage with 2 decimals)
 * - PCR with interpretation
 * - ATR
 * - "N/A" for missing or null values
 *
 * Requirements covered: 16.1-16.27
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface MarketAnalysisData {
  spotPrice: number | null;
  trend: string | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  vwap: number | null;
  ema5: number | null;
  ema15: number | null;
  supportLevel: number | null;
  resistanceLevel: number | null;
  trendlineStatus: string | null;
  callOI: number | null;
  putOI: number | null;
  callOIChange: number | null;
  putOIChange: number | null;
  callOIChangePct: number | null;
  putOIChangePct: number | null;
  pcr: number | null;
  atr: number | null;
}

export interface MarketAnalysisPanelProps {
  /** Market analysis data from the analysis engine */
  data: MarketAnalysisData | null;
}

function formatDecimal(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return 'N/A';
  if (!isFinite(value)) return 'N/A';
  return value.toFixed(decimals);
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (!isFinite(value)) return 'N/A';
  return `₹${value.toFixed(2)}`;
}

function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (!isFinite(value)) return 'N/A';
  return new Intl.NumberFormat('en-IN').format(Math.round(value));
}

function formatOIChange(abs: number | null | undefined, pct: number | null | undefined): string {
  if (abs === null || abs === undefined) return 'N/A';
  const formattedAbs = new Intl.NumberFormat('en-IN').format(Math.abs(Math.round(abs)));
  const sign = abs >= 0 ? '+' : '-';
  const pctStr = pct !== null && pct !== undefined ? ` (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)` : '';
  return `${sign}${formattedAbs}${pctStr}`;
}

function getRsiIndication(rsi: number | null): string {
  if (rsi === null) return '';
  if (rsi > 70) return 'Overbought';
  if (rsi < 30) return 'Oversold';
  return 'Neutral';
}

function getRsiColor(rsi: number | null): string {
  if (rsi === null) return '';
  if (rsi > 70) return 'text-red-600 dark:text-red-400';
  if (rsi < 30) return 'text-green-600 dark:text-green-400';
  return 'text-yellow-600 dark:text-yellow-400';
}

function getMacdIndication(macd: number | null, signal: number | null): string {
  if (macd === null || signal === null) return '';
  if (macd > signal) return 'Bullish';
  if (macd < signal) return 'Bearish';
  return 'Neutral';
}

function getMacdColor(macd: number | null, signal: number | null): string {
  if (macd === null || signal === null) return '';
  if (macd > signal) return 'text-green-600 dark:text-green-400';
  if (macd < signal) return 'text-red-600 dark:text-red-400';
  return 'text-yellow-600 dark:text-yellow-400';
}

function getVwapPercentage(spot: number | null, vwap: number | null): string {
  if (spot === null || vwap === null || vwap === 0) return 'N/A';
  const pct = ((spot - vwap) / vwap) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

function getVwapLabel(spot: number | null, vwap: number | null): string {
  if (spot === null || vwap === null) return '';
  return spot >= vwap ? 'Above VWAP' : 'Below VWAP';
}

function getPcrInterpretation(pcr: number | null): string {
  if (pcr === null) return '';
  if (pcr > 1.5) return 'Bearish';
  if (pcr < 0.7) return 'Bullish';
  return 'Neutral';
}

function getPcrColor(pcr: number | null): string {
  if (pcr === null) return '';
  if (pcr > 1.5) return 'text-red-600 dark:text-red-400';
  if (pcr < 0.7) return 'text-green-600 dark:text-green-400';
  return 'text-yellow-600 dark:text-yellow-400';
}

function getTrendIcon(trend: string | null) {
  if (!trend) return null;
  const lower = trend.toLowerCase();
  if (lower === 'bullish') return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (lower === 'bearish') return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-yellow-600" />;
}

export function MarketAnalysisPanel({ data }: MarketAnalysisPanelProps) {
  if (!data) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <span className="text-sm text-muted-foreground">Waiting for market data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Market Analysis</h3>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Spot Price & Trend */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Spot Price</p>
            <p className="text-lg font-semibold">{formatCurrency(data.spotPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trend</p>
            <div className="flex items-center gap-1.5">
              {getTrendIcon(data.trend)}
              <p className="text-base font-semibold">{data.trend || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* RSI & MACD */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">RSI (14)</p>
            <p className="text-base font-semibold">{formatDecimal(data.rsi)}</p>
            {data.rsi !== null && (
              <p className={cn('text-xs', getRsiColor(data.rsi))}>
                {getRsiIndication(data.rsi)}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">MACD</p>
            <p className="text-base font-semibold">
              {formatDecimal(data.macd)} / {formatDecimal(data.macdSignal)}
            </p>
            {data.macd !== null && data.macdSignal !== null && (
              <p className={cn('text-xs', getMacdColor(data.macd, data.macdSignal))}>
                {getMacdIndication(data.macd, data.macdSignal)}
              </p>
            )}
          </div>
        </div>

        {/* VWAP & ATR */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Price vs VWAP</p>
            <p className="text-base font-semibold">
              {getVwapPercentage(data.spotPrice, data.vwap)}
            </p>
            <p className="text-xs text-muted-foreground">
              {getVwapLabel(data.spotPrice, data.vwap)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ATR (14)</p>
            <p className="text-base font-semibold">{formatDecimal(data.atr)}</p>
          </div>
        </div>

        {/* EMA 5 & EMA 15 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">EMA 5</p>
            <p className="text-base font-semibold">{formatDecimal(data.ema5)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">EMA 15</p>
            <p className="text-base font-semibold">{formatDecimal(data.ema15)}</p>
          </div>
        </div>

        {/* Support & Resistance */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Support</p>
            <p className="text-base font-semibold text-green-600">
              {formatCurrency(data.supportLevel)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Resistance</p>
            <p className="text-base font-semibold text-red-600">
              {formatCurrency(data.resistanceLevel)}
            </p>
          </div>
        </div>

        {/* Trendline Status */}
        <div>
          <p className="text-xs text-muted-foreground">Trendline Status</p>
          <div className="flex items-center gap-1.5">
            {getTrendIcon(data.trendlineStatus)}
            <p className="text-base font-semibold">{data.trendlineStatus || 'N/A'}</p>
          </div>
        </div>

        {/* OI Data */}
        <div className="rounded-lg bg-muted/40 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Open Interest</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Call OI</p>
              <p className="text-base font-semibold">{formatInteger(data.callOI)}</p>
              <p className="text-xs text-muted-foreground">
                Change: {formatOIChange(data.callOIChange, data.callOIChangePct)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Put OI</p>
              <p className="text-base font-semibold">{formatInteger(data.putOI)}</p>
              <p className="text-xs text-muted-foreground">
                Change: {formatOIChange(data.putOIChange, data.putOIChangePct)}
              </p>
            </div>
          </div>
        </div>

        {/* PCR */}
        <div>
          <p className="text-xs text-muted-foreground">Put-Call Ratio (PCR)</p>
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold">{formatDecimal(data.pcr)}</p>
            {data.pcr !== null && (
              <Badge variant="outline" className={cn('text-xs', getPcrColor(data.pcr))}>
                {getPcrInterpretation(data.pcr)}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
