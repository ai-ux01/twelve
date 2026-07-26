/**
 * OpenTradesTable - Displays all OPEN paper trades with live P&L
 *
 * Shows columns: symbol, trade type, direction, entry price, current price,
 * stop loss, target, unrealized P&L, time since entry.
 * Includes Close and Cancel action buttons per row.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { PaperTrade } from './types';

export interface OpenTradesTableProps {
  trades: PaperTrade[];
  isLoading: boolean;
  error: string | null;
  onClose: (tradeId: string, exitPrice: number) => Promise<boolean>;
  onCancel: (tradeId: string) => Promise<boolean>;
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const tradeTypeLabels: Record<string, string> = {
  SWING: 'Swing',
  INTRADAY: 'Intraday',
  OPTIONS_SCALPING: 'Options',
};

function formatTimeSince(dateStr: string): string {
  const now = new Date();
  const entered = new Date(dateStr);
  const diffMs = now.getTime() - entered.getTime();

  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function OpenTradesTable({
  trades,
  isLoading,
  error,
  onClose,
  onCancel,
}: OpenTradesTableProps) {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const handleClose = async (trade: PaperTrade) => {
    const exitPrice = trade.currentPrice ?? trade.entryPrice;
    setActionInProgress(trade.id);
    await onClose(trade.id, exitPrice);
    setActionInProgress(null);
  };

  const handleCancel = async (trade: PaperTrade) => {
    setActionInProgress(trade.id);
    await onCancel(trade.id);
    setActionInProgress(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Open Trades
          {trades.length > 0 && (
            <Badge variant="secondary">{trades.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        {isLoading && trades.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading open trades...
          </div>
        ) : trades.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No open trades
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Entry</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Stop Loss</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Unrealized P&L</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => {
                const pnl = trade.unrealizedPnL ?? 0;
                const isPositive = pnl >= 0;
                const isActioning = actionInProgress === trade.id;

                return (
                  <TableRow key={trade.id}>
                    <TableCell className="font-medium">{trade.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tradeTypeLabels[trade.tradeType] || trade.tradeType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={trade.direction === 'LONG' ? 'default' : 'destructive'}>
                        {trade.direction}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {currencyFormatter.format(trade.entryPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {trade.currentPrice
                        ? currencyFormatter.format(trade.currentPrice)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {currencyFormatter.format(trade.stopLoss)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {currencyFormatter.format(trade.target)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono font-medium',
                        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {currencyFormatter.format(pnl)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimeSince(trade.enteredAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActioning}
                          onClick={() => handleClose(trade)}
                        >
                          Close
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isActioning}
                          onClick={() => handleCancel(trade)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
