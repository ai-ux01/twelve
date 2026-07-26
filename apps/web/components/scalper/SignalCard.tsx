'use client';

/**
 * SignalCard Component
 *
 * Displays the current trading signal with all relevant details:
 * - Signal type (BUY CE, BUY PE, HOLD) in large font (≥32px)
 * - Strike price, expiry date (DD-MMM-YYYY)
 * - Entry, target, stop loss prices (2 decimals)
 * - Probability percentage (1 decimal)
 * - Risk/reward ratio (1:X.X format)
 * - Trend, OI interpretation, PCR, trendline status
 * - Support and resistance levels
 * - "N/A" for null/missing values
 * - "Error" with icon for invalid calculations
 *
 * Requirements covered: 13.1-13.17, 23.2
 */

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface SignalData {
  signalType: 'BUY CE' | 'BUY PE' | 'HOLD';
  strikePrice: number | null;
  expiryDate: string | Date | null;
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  probability: number | null;
  riskRewardRatio: number | null;
  trend: string | null;
  oiInterpretation: string | null;
  pcr: number | null;
  trendlineStatus: string | null;
  supportLevel: number | null;
  resistanceLevel: number | null;
  holdReason?: string | null;
}

export interface SignalCardProps {
  /** Signal data from the analysis engine */
  signal: SignalData | null;
}

/**
 * Format a number to fixed decimal places, or return "N/A" for null/undefined
 */
function formatPrice(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return 'N/A';
  if (!isFinite(value)) return 'Error';
  return `₹${value.toFixed(decimals)}`;
}

/**
 * Format a number with decimals or return "N/A"
 */
function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return 'N/A';
  if (!isFinite(value)) return 'Error';
  return value.toFixed(decimals);
}

/**
 * Format expiry date as DD-MMM-YYYY
 */
function formatExpiryDate(date: string | Date | null): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'N/A';

  const day = d.getDate().toString().padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format probability with 1 decimal place
 */
function formatProbability(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (!isFinite(value) || value < 0 || value > 100) return 'Error';
  return `${value.toFixed(1)}%`;
}

/**
 * Format risk/reward ratio as "1:X.X"
 */
function formatRiskReward(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (!isFinite(value) || value < 0) return 'Error';
  return `1:${value.toFixed(1)}`;
}

export function SignalCard({ signal }: SignalCardProps) {
  const [displayedSignal, setDisplayedSignal] = useState<SignalData | null>(signal);
  const lastUpdateRef = useRef<number>(Date.now());

  // Update display within 500ms of receiving new analysis (req 23.2)
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (timeSinceLastUpdate < 500) {
      // Schedule update to stay within 500ms window
      const timeout = setTimeout(() => {
        setDisplayedSignal(signal);
        lastUpdateRef.current = Date.now();
      }, Math.max(0, 500 - timeSinceLastUpdate));
      return () => clearTimeout(timeout);
    }

    setDisplayedSignal(signal);
    lastUpdateRef.current = now;
  }, [signal]);

  if (!displayedSignal) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <span className="text-lg text-muted-foreground">Waiting for analysis...</span>
        </CardContent>
      </Card>
    );
  }

  const { signalType } = displayedSignal;
  const isBuy = signalType === 'BUY CE' || signalType === 'BUY PE';

  const getSignalColor = () => {
    if (signalType === 'BUY CE') return 'text-green-600 dark:text-green-400';
    if (signalType === 'BUY PE') return 'text-red-600 dark:text-red-400';
    return 'text-yellow-600 dark:text-yellow-400';
  };

  const getSignalBadgeVariant = (): 'default' | 'destructive' | 'outline' => {
    if (signalType === 'BUY CE') return 'default';
    if (signalType === 'BUY PE') return 'destructive';
    return 'outline';
  };

  const getTrendIcon = (trend: string | null) => {
    if (!trend) return null;
    if (trend.toLowerCase() === 'bullish') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend.toLowerCase() === 'bearish') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-yellow-600" />;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        {/* Signal Type - Large prominent text ≥32px */}
        <div className="flex items-center justify-between">
          <h2
            className={cn('font-bold', getSignalColor())}
            style={{ fontSize: '32px', lineHeight: '1.2' }}
          >
            {signalType}
          </h2>
          <Badge variant={getSignalBadgeVariant()} className="text-sm">
            {formatProbability(displayedSignal.probability)}
          </Badge>
        </div>
        {displayedSignal.holdReason && signalType === 'HOLD' && (
          <p className="text-sm text-muted-foreground mt-1">
            Reason: {displayedSignal.holdReason}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Strike Price & Expiry (shown for BUY signals) */}
        {isBuy && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Strike Price</p>
              <p className="text-lg font-semibold">
                {displayedSignal.strikePrice !== null
                  ? `₹${displayedSignal.strikePrice.toFixed(2)}`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="text-lg font-semibold">
                {formatExpiryDate(displayedSignal.expiryDate)}
              </p>
            </div>
          </div>
        )}

        {/* Entry, Target, Stop Loss (shown for BUY signals) */}
        {isBuy && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Entry</p>
              <p className="text-base font-semibold">
                {formatPrice(displayedSignal.entryPrice)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Target</p>
              <p className="text-base font-semibold text-green-600">
                {formatPrice(displayedSignal.targetPrice)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stop Loss</p>
              <p className="text-base font-semibold text-red-600">
                {formatPrice(displayedSignal.stopLoss)}
              </p>
            </div>
          </div>
        )}

        {/* Probability & Risk/Reward */}
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Probability</p>
            <p className="text-lg font-bold">
              {formatProbability(displayedSignal.probability)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Risk/Reward</p>
            <p className="text-lg font-bold">
              {formatRiskReward(displayedSignal.riskRewardRatio)}
            </p>
          </div>
        </div>

        {/* Market Context: Trend, OI, PCR, Trendline */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Trend:</span>
            <span className="flex items-center gap-1 font-medium">
              {getTrendIcon(displayedSignal.trend)}
              {displayedSignal.trend || 'N/A'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">OI:</span>
            <span className="font-medium">
              {displayedSignal.oiInterpretation || 'N/A'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">PCR:</span>
            <span className="font-medium">
              {formatNumber(displayedSignal.pcr, 2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Trendline:</span>
            <span className="font-medium">
              {displayedSignal.trendlineStatus || 'N/A'}
            </span>
          </div>
        </div>

        {/* Support & Resistance Levels */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Support: </span>
            <span className="font-medium">
              {displayedSignal.supportLevel !== null && displayedSignal.supportLevel !== undefined
                ? `₹${displayedSignal.supportLevel.toFixed(2)}`
                : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Resistance: </span>
            <span className="font-medium">
              {displayedSignal.resistanceLevel !== null && displayedSignal.resistanceLevel !== undefined
                ? `₹${displayedSignal.resistanceLevel.toFixed(2)}`
                : 'N/A'}
            </span>
          </div>
        </div>

        {/* Error indicator for invalid calculations */}
        {displayedSignal.probability !== null &&
          (!isFinite(displayedSignal.probability) ||
            displayedSignal.probability < 0 ||
            displayedSignal.probability > 100) && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>Error: Invalid calculation detected</span>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
