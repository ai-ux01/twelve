'use client';

/**
 * OptionsAnalysisPanel Component
 * 
 * Displays comprehensive options analysis including:
 * - PCR (Put-Call Ratio) by OI and Volume
 * - Market sentiment gauge
 * - ATM and near-ATM strikes analysis
 * - OI buildup/unwinding signals
 * - Support and resistance zones
 * 
 * Requirements: 7.1, 13.2
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface OptionsAnalysisResult {
  symbol: string;
  expiryDate: string;
  spotPrice: number;
  timestamp: Date;
  pcrAnalysis: {
    pcrByOI: number;
    pcrByVolume: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    totalCallOI: number;
    totalPutOI: number;
    totalCallVolume: number;
    totalPutVolume: number;
  };
  atmAnalysis: {
    spotPrice: number;
    atmStrike: number;
    strikeInterval: number;
    nearATMStrikes: Array<{
      strike: number;
      distanceFromSpot: number;
      callOI: number;
      putOI: number;
      callVolume: number;
      putVolume: number;
    }>;
  };
  oiAnalysis: {
    buildupType: 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'LONG_UNWINDING' | 'SHORT_UNWINDING';
    explanation: string;
    supportLevels: Array<{
      strike: number;
      strength: number;
      reason: string;
    }>;
    resistanceLevels: Array<{
      strike: number;
      strength: number;
      reason: string;
    }>;
    maxCallOIStrike: number;
    maxPutOIStrike: number;
  };
}

export interface OptionsAnalysisPanelProps {
  data: OptionsAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
}

export function OptionsAnalysisPanel({ data, isLoading, error }: OptionsAnalysisPanelProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Error: {error}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No analysis data available. Fetch options chain data to see analysis.
        </AlertDescription>
      </Alert>
    );
  }

  const { pcrAnalysis, atmAnalysis, oiAnalysis } = data;

  // Determine sentiment icon and color
  const getSentimentConfig = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH':
        return {
          icon: <TrendingUp className="h-4 w-4" />,
          color: 'bg-green-500',
          textColor: 'text-green-700',
        };
      case 'BEARISH':
        return {
          icon: <TrendingDown className="h-4 w-4" />,
          color: 'bg-red-500',
          textColor: 'text-red-700',
        };
      default:
        return {
          icon: <Minus className="h-4 w-4" />,
          color: 'bg-gray-500',
          textColor: 'text-gray-700',
        };
    }
  };

  const sentimentConfig = getSentimentConfig(pcrAnalysis.sentiment);

  // Determine OI buildup badge color
  const getBuildupColor = (buildupType: string) => {
    switch (buildupType) {
      case 'LONG_BUILDUP':
        return 'bg-green-500 text-white';
      case 'SHORT_BUILDUP':
        return 'bg-red-500 text-white';
      case 'LONG_UNWINDING':
        return 'bg-orange-500 text-white';
      case 'SHORT_UNWINDING':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* PCR Analysis Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>PCR (Put-Call Ratio) Analysis</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-normal">Sentiment:</span>
              <Badge className={sentimentConfig.color}>
                {sentimentConfig.icon}
                <span className="ml-1">{pcrAnalysis.sentiment}</span>
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">PCR by OI</div>
              <div className="text-2xl font-bold">{pcrAnalysis.pcrByOI.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">PCR by Volume</div>
              <div className="text-2xl font-bold">{pcrAnalysis.pcrByVolume.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Call OI</div>
              <div className="text-lg font-semibold text-green-600">
                {pcrAnalysis.totalCallOI.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                Vol: {pcrAnalysis.totalCallVolume.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Put OI</div>
              <div className="text-lg font-semibold text-red-600">
                {pcrAnalysis.totalPutOI.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                Vol: {pcrAnalysis.totalPutVolume.toLocaleString()}
              </div>
            </div>
          </div>

          {/* PCR Gauge */}
          <div className="mt-6">
            <div className="text-sm font-medium mb-2">PCR Gauge (by OI)</div>
            <div className="relative h-8 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full overflow-hidden">
              <div
                className="absolute top-0 bottom-0 w-1 bg-white border-2 border-gray-800"
                style={{
                  left: `${Math.min(100, (pcrAnalysis.pcrByOI / 2) * 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Bullish (&lt;0.7)</span>
              <span>Neutral (0.7-1.3)</span>
              <span>Bearish (&gt;1.3)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ATM Strikes Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>ATM Strike Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex items-baseline gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Spot Price:</span>
                <span className="ml-2 text-lg font-semibold">{atmAnalysis.spotPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">ATM Strike:</span>
                <span className="ml-2 text-lg font-semibold text-yellow-600">
                  {atmAnalysis.atmStrike.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-sm font-medium mb-3">Near ATM Strikes (±3):</div>
          <div className="space-y-2">
            {atmAnalysis.nearATMStrikes.map((strike) => {
              const isATM = strike.strike === atmAnalysis.atmStrike;
              return (
                <div
                  key={strike.strike}
                  className={`p-3 rounded-lg border ${
                    isATM ? 'bg-yellow-50 border-yellow-400 dark:bg-yellow-950' : 'bg-gray-50 dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{strike.strike.toFixed(2)}</span>
                      {isATM && (
                        <Badge className="bg-yellow-500 text-xs">ATM</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        ({strike.distanceFromSpot > 0 ? '+' : ''}{strike.distanceFromSpot.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Call OI / Vol</div>
                      <div className="font-medium text-green-600">
                        {strike.callOI.toLocaleString()} / {strike.callVolume.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Put OI / Vol</div>
                      <div className="font-medium text-red-600">
                        {strike.putOI.toLocaleString()} / {strike.putVolume.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* OI Buildup/Unwinding Signals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>OI Buildup Analysis</span>
            <Badge className={getBuildupColor(oiAnalysis.buildupType)}>
              {oiAnalysis.buildupType.replace('_', ' ')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">{oiAnalysis.explanation}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-sm text-muted-foreground">Max Call OI Strike</div>
              <div className="text-xl font-bold text-green-700 dark:text-green-400">
                {oiAnalysis.maxCallOIStrike.toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-sm text-muted-foreground">Max Put OI Strike</div>
              <div className="text-xl font-bold text-red-700 dark:text-red-400">
                {oiAnalysis.maxPutOIStrike.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Support Zones */}
          {oiAnalysis.supportLevels.length > 0 && (
            <div className="mb-4">
              <div className="text-sm font-medium mb-2">Support Zones</div>
              <div className="space-y-2">
                {oiAnalysis.supportLevels.map((level) => (
                  <div
                    key={level.strike}
                    className="p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-green-700 dark:text-green-400">
                        {level.strike.toFixed(2)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Strength: {(level.strength * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{level.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resistance Zones */}
          {oiAnalysis.resistanceLevels.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Resistance Zones</div>
              <div className="space-y-2">
                {oiAnalysis.resistanceLevels.map((level) => (
                  <div
                    key={level.strike}
                    className="p-2 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-700 dark:text-red-400">
                        {level.strike.toFixed(2)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Strength: {(level.strength * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{level.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
