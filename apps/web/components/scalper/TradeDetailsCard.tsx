'use client';

/**
 * TradeDetailsCard Component
 *
 * Displays detailed trade parameters when signal is BUY:
 * - Underlying (NIFTY/BANKNIFTY)
 * - Option type (CE/PE)
 * - Strike price (integer with comma separator)
 * - Expiry (DD-MMM-YYYY format)
 * - Entry price (₹X.XX)
 * - Target with profit calculation
 * - Stop loss with loss calculation
 * - R:R ratio (1:X format, 1 decimal)
 * - Lot size (integer)
 * - "N/A" for missing fields
 * - Error handling for invalid strike/lot size
 * - Warning for expired contracts
 *
 * Requirements covered: 15.1-15.15
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export interface TradeDetails {
  signalType: 'BUY CE' | 'BUY PE' | 'HOLD';
  underlying: 'NIFTY' | 'BANKNIFTY' | null;
  optionType: 'CE' | 'PE' | null;
  strikePrice: number | null;
  expiryDate: string | Date | null;
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  riskRewardRatio: number | null;
  lotSize: number | null;
}

export interface TradeDetailsCardProps {
  /** Trade details from the analysis engine */
  trade: TradeDetails | null;
}

/** Default lot sizes for each underlying */
const LOT_SIZES: Record<string, number> = {
  NIFTY: 50,
  BANKNIFTY: 25,
};

/**
 * Format strike price as integer with comma separators (e.g., "19,500")
 */
function formatStrikePrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (!isFinite(value)) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.round(value));
}

/**
 * Format currency value as ₹X.XX
 */
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (!isFinite(value)) return 'N/A';
  return `₹${value.toFixed(2)}`;
}

/**
 * Format profit/loss amount with comma separators: ₹X,XXX.XX
 */
function formatProfitLoss(value: number): string {
  return `₹${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
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
 * Format R:R ratio as "1:X" with 1 decimal
 */
function formatRiskReward(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (!isFinite(value) || value < 0) return 'N/A';
  return `1:${value.toFixed(1)}`;
}

/**
 * Check if an expiry date is in the past (expired contract)
 */
function isExpired(date: string | Date | null): boolean {
  if (!date) return false;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDay = new Date(d);
  expiryDay.setHours(0, 0, 0, 0);

  return expiryDay < today;
}

export function TradeDetailsCard({ trade }: TradeDetailsCardProps) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trade) {
      setVisible(false);
      setError(null);
      return;
    }

    const isBuy = trade.signalType === 'BUY CE' || trade.signalType === 'BUY PE';

    // Validate strike price and lot size
    if (isBuy) {
      if (trade.strikePrice !== null && trade.strikePrice <= 0) {
        setError('Invalid strike price');
        setVisible(false);
        return;
      }
      if (trade.lotSize !== null && trade.lotSize <= 0) {
        setError('Invalid lot size');
        setVisible(false);
        return;
      }
    }

    setError(null);

    if (isBuy) {
      setVisible(true);
    } else {
      // Hide within 500ms when signal changes to HOLD
      const timeout = setTimeout(() => {
        setVisible(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [trade]);

  // Display error message if validation fails
  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!visible || !trade) {
    return null;
  }

  const lotSize = trade.lotSize ?? (trade.underlying ? LOT_SIZES[trade.underlying] : null);
  const expired = isExpired(trade.expiryDate);

  // Calculate profit and loss amounts
  const profitAmount =
    trade.targetPrice !== null && trade.entryPrice !== null && lotSize !== null
      ? (trade.targetPrice - trade.entryPrice) * lotSize
      : null;

  const lossAmount =
    trade.entryPrice !== null && trade.stopLoss !== null && lotSize !== null
      ? (trade.entryPrice - trade.stopLoss) * lotSize
      : null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Trade Details</h3>
          {expired && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600 gap-1">
              <AlertTriangle className="h-3 w-3" />
              Expired
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Underlying & Option Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Underlying</p>
            <p className="text-base font-semibold">
              {trade.underlying || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Option Type</p>
            <p className="text-base font-semibold">
              {trade.optionType || 'N/A'}
            </p>
          </div>
        </div>

        {/* Strike & Expiry */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Strike Price</p>
            <p className="text-base font-semibold">
              {formatStrikePrice(trade.strikePrice)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expiry</p>
            <p className={cn('text-base font-semibold', expired && 'text-yellow-600')}>
              {formatExpiryDate(trade.expiryDate)}
            </p>
          </div>
        </div>

        {/* Entry Price */}
        <div>
          <p className="text-xs text-muted-foreground">Entry Price</p>
          <p className="text-base font-semibold">
            {formatCurrency(trade.entryPrice)}
          </p>
        </div>

        {/* Target with profit */}
        <div>
          <p className="text-xs text-muted-foreground">Target</p>
          <div className="flex items-baseline gap-2">
            <p className="text-base font-semibold text-green-600">
              {formatCurrency(trade.targetPrice)}
            </p>
            {profitAmount !== null && (
              <span className="text-sm text-green-600">
                {formatProfitLoss(profitAmount)} profit
              </span>
            )}
          </div>
        </div>

        {/* Stop Loss with loss */}
        <div>
          <p className="text-xs text-muted-foreground">Stop Loss</p>
          <div className="flex items-baseline gap-2">
            <p className="text-base font-semibold text-red-600">
              {formatCurrency(trade.stopLoss)}
            </p>
            {lossAmount !== null && (
              <span className="text-sm text-red-600">
                {formatProfitLoss(lossAmount)} loss
              </span>
            )}
          </div>
        </div>

        {/* R:R Ratio & Lot Size */}
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-3">
          <div>
            <p className="text-xs text-muted-foreground">R:R Ratio</p>
            <p className="text-lg font-bold">
              {formatRiskReward(trade.riskRewardRatio)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lot Size</p>
            <p className="text-lg font-bold">
              {lotSize !== null ? lotSize : 'N/A'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
