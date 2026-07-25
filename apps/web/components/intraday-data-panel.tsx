/**
 * IntradayDataPanel Component
 * 
 * Displays comprehensive technical indicators in organized sections for intraday trading.
 * Highlights stale data with warning colors.
 * 
 * Requirements covered: 6.8, 13.2
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle } from 'lucide-react';

export interface IntradayDataPanelProps {
  data: {
    symbol: string;
    interval: string;
    timestamp: string;
    dataFreshness: {
      timestamp: string;
      ageSeconds: number;
      isStale: boolean;
    };
    technicalAnalysis: {
      rsi: number;
      macd: {
        value: number;
        signal: number;
        histogram: number;
      };
      ema_9: number;
      ema_21: number;
      ema_50: number;
      vwap: number;
      atr: number;
      volume: number;
      relativeVolume: number;
      bollingerBands: {
        upper: number;
        middle: number;
        lower: number;
      };
      supportLevels: number[];
      resistanceLevels: number[];
    };
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;
  };
}

/**
 * IntradayDataPanel - Comprehensive technical indicators display
 * 
 * Sections:
 * - Price Action (current price, VWAP, EMA 5, EMA 15)
 * - Momentum (RSI, MACD histogram)
 * - Volume (current volume, relative volume, ATR)
 * - Intraday Levels (opening range high/low, previous day high/low)
 * - Support/Resistance (nearest levels)
 * - Trendlines (active trendlines from Phase 5)
 * 
 * Highlights stale data with warning color if isStale = true
 */
export function IntradayDataPanel({ data }: IntradayDataPanelProps) {
  const { symbol, interval, dataFreshness, technicalAnalysis, currentPrice, priceChange, priceChangePercent } = data;

  const isStale = dataFreshness.isStale;
  const priceColor = priceChange >= 0 ? 'text-green-600' : 'text-red-600';
  const priceSymbol = priceChange >= 0 ? '+' : '';

  return (
    <Card className={isStale ? 'border-yellow-500 border-2' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{symbol}</CardTitle>
            <CardDescription>Intraday Technical Analysis - {interval} interval</CardDescription>
          </div>
          {isStale && (
            <Badge variant="destructive" className="flex gap-2">
              <AlertCircle className="h-4 w-4" />
              Stale Data
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Stale Data Warning Banner */}
          {isStale && (
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                ⚠️ Data is stale (Age: {Math.floor(dataFreshness.ageSeconds / 60)} min {dataFreshness.ageSeconds % 60} sec)
              </p>
            </div>
          )}

          {/* Price Action Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Price Action</h3>
            <div className="grid grid-cols-2 gap-4">
              <DataField label="Current Price" value={`₹${currentPrice.toFixed(2)}`} />
              <DataField
                label="Change"
                value={`${priceSymbol}₹${priceChange.toFixed(2)} (${priceSymbol}${priceChangePercent.toFixed(2)}%)`}
                valueClassName={priceColor}
              />
              <DataField label="VWAP" value={`₹${technicalAnalysis.vwap.toFixed(2)}`} />
              <DataField label="EMA 9" value={`₹${technicalAnalysis.ema_9.toFixed(2)}`} />
              <DataField label="EMA 21" value={`₹${technicalAnalysis.ema_21.toFixed(2)}`} />
              <DataField label="EMA 50" value={`₹${technicalAnalysis.ema_50.toFixed(2)}`} />
            </div>
          </div>

          <Separator />

          {/* Momentum Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Momentum</h3>
            <div className="grid grid-cols-2 gap-4">
              <DataField
                label="RSI"
                value={technicalAnalysis.rsi.toFixed(2)}
                badge={getRsiBadge(technicalAnalysis.rsi)}
              />
              <DataField
                label="MACD Histogram"
                value={technicalAnalysis.macd.histogram.toFixed(2)}
                valueClassName={technicalAnalysis.macd.histogram >= 0 ? 'text-green-600' : 'text-red-600'}
              />
              <DataField label="MACD Value" value={technicalAnalysis.macd.value.toFixed(2)} />
              <DataField label="MACD Signal" value={technicalAnalysis.macd.signal.toFixed(2)} />
            </div>
          </div>

          <Separator />

          {/* Volume Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Volume</h3>
            <div className="grid grid-cols-2 gap-4">
              <DataField label="Current Volume" value={technicalAnalysis.volume.toLocaleString()} />
              <DataField
                label="Relative Volume"
                value={`${technicalAnalysis.relativeVolume.toFixed(2)}x`}
                badge={getVolumeBadge(technicalAnalysis.relativeVolume)}
              />
              <DataField label="ATR" value={`₹${technicalAnalysis.atr.toFixed(2)}`} />
            </div>
          </div>

          <Separator />

          {/* Bollinger Bands Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Bollinger Bands</h3>
            <div className="grid grid-cols-3 gap-4">
              <DataField label="Upper Band" value={`₹${technicalAnalysis.bollingerBands.upper.toFixed(2)}`} />
              <DataField label="Middle Band" value={`₹${technicalAnalysis.bollingerBands.middle.toFixed(2)}`} />
              <DataField label="Lower Band" value={`₹${technicalAnalysis.bollingerBands.lower.toFixed(2)}`} />
            </div>
          </div>

          <Separator />

          {/* Support/Resistance Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Support & Resistance Levels</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Support Levels</p>
                <div className="space-y-1">
                  {technicalAnalysis.supportLevels.length > 0 ? (
                    technicalAnalysis.supportLevels.slice(0, 3).map((level, i) => (
                      <div key={i} className="text-sm font-medium text-green-600">
                        ₹{level.toFixed(2)}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No levels detected</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Resistance Levels</p>
                <div className="space-y-1">
                  {technicalAnalysis.resistanceLevels.length > 0 ? (
                    technicalAnalysis.resistanceLevels.slice(0, 3).map((level, i) => (
                      <div key={i} className="text-sm font-medium text-red-600">
                        ₹{level.toFixed(2)}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No levels detected</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * DataField - Reusable component for displaying label/value pairs
 */
function DataField({
  label,
  value,
  valueClassName,
  badge,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  badge?: { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' };
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`text-lg font-medium ${valueClassName || ''}`}>{value}</p>
        {badge && (
          <Badge variant={badge.variant} className="text-xs">
            {badge.text}
          </Badge>
        )}
      </div>
    </div>
  );
}

/**
 * Helper function to get RSI badge
 */
function getRsiBadge(rsi: number): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } | undefined {
  if (rsi >= 70) {
    return { text: 'Overbought', variant: 'destructive' };
  } else if (rsi <= 30) {
    return { text: 'Oversold', variant: 'default' };
  }
  return undefined;
}

/**
 * Helper function to get volume badge
 */
function getVolumeBadge(relativeVolume: number): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } | undefined {
  if (relativeVolume >= 2.0) {
    return { text: 'High', variant: 'default' };
  } else if (relativeVolume < 0.5) {
    return { text: 'Low', variant: 'secondary' };
  }
  return undefined;
}
