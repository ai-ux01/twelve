/**
 * ClosedTradesTable - Displays closed/terminal paper trades
 *
 * Shows columns: symbol, trade type, direction, entry price, exit price,
 * realized P&L, R-multiple, exit reason, duration.
 * Supports sorting and expandable rows showing AI context.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
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
import type { PaperTrade, PaginatedTradesResponse } from './types';

export interface ClosedTradesTableProps {
  data: PaginatedTradesResponse | null;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
}

type SortField = 'date' | 'pnl' | 'r-multiple';
type SortDirection = 'asc' | 'desc';

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

const exitReasonLabels: Record<string, string> = {
  TARGET_HIT: 'Target Hit',
  STOP_HIT: 'Stop Hit',
  MANUAL_EXIT: 'Manual Exit',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

function calculateRMultiple(trade: PaperTrade): number | null {
  if (!trade.realizedPnL || !trade.entryPrice || !trade.stopLoss) return null;
  const initialRisk = Math.abs(trade.entryPrice - trade.stopLoss) * trade.quantity;
  if (initialRisk === 0) return null;
  return trade.realizedPnL / initialRisk;
}

function formatDuration(enteredAt: string, exitedAt: string | null): string {
  if (!exitedAt) return '—';
  const start = new Date(enteredAt);
  const end = new Date(exitedAt);
  const diffMs = end.getTime() - start.getTime();

  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function ClosedTradesTable({
  data,
  isLoading,
  error,
  onPageChange,
}: ClosedTradesTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const trades = data?.data || [];

  // Sort trades locally
  const sortedTrades = [...trades].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'date': {
        const dateA = new Date(a.exitedAt || a.enteredAt).getTime();
        const dateB = new Date(b.exitedAt || b.enteredAt).getTime();
        return (dateA - dateB) * dir;
      }
      case 'pnl': {
        const pnlA = a.realizedPnL ?? 0;
        const pnlB = b.realizedPnL ?? 0;
        return (pnlA - pnlB) * dir;
      }
      case 'r-multiple': {
        const rA = calculateRMultiple(a) ?? 0;
        const rB = calculateRMultiple(b) ?? 0;
        return (rA - rB) * dir;
      }
      default:
        return 0;
    }
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  const toggleRow = (tradeId: string) => {
    setExpandedRow((prev) => (prev === tradeId ? null : tradeId));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Closed Trades
          {data && data.total > 0 && (
            <Badge variant="secondary">{data.total}</Badge>
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
            Loading closed trades...
          </div>
        ) : trades.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No closed trades yet
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Entry</TableHead>
                  <TableHead className="text-right">Exit</TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('pnl')}
                  >
                    P&L{getSortIndicator('pnl')}
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('r-multiple')}
                  >
                    R-Multiple{getSortIndicator('r-multiple')}
                  </TableHead>
                  <TableHead>Exit Reason</TableHead>
                  <TableHead
                    className="cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('date')}
                  >
                    Duration{getSortIndicator('date')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTrades.map((trade) => {
                  const pnl = trade.realizedPnL ?? 0;
                  const rMultiple = calculateRMultiple(trade);
                  const isPositive = pnl >= 0;
                  const isExpanded = expandedRow === trade.id;
                  const hasAiContext = trade.aiContext && Object.keys(trade.aiContext).length > 0;

                  return (
                    <>
                      <TableRow
                        key={trade.id}
                        className={cn(hasAiContext && 'cursor-pointer')}
                        onClick={() => hasAiContext && toggleRow(trade.id)}
                        aria-expanded={isExpanded}
                      >
                        <TableCell className="w-8">
                          {hasAiContext && (
                            <span className="text-muted-foreground text-xs">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          )}
                        </TableCell>
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
                          {trade.exitPrice ? currencyFormatter.format(trade.exitPrice) : '—'}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono font-medium',
                            isPositive
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {currencyFormatter.format(pnl)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono',
                            rMultiple !== null && rMultiple >= 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {rMultiple !== null ? `${rMultiple.toFixed(2)}R` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              trade.status === 'TARGET_HIT'
                                ? 'default'
                                : trade.status === 'STOP_HIT'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {exitReasonLabels[trade.status] || trade.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDuration(trade.enteredAt, trade.exitedAt)}
                        </TableCell>
                      </TableRow>

                      {/* Expanded AI Context Row */}
                      {isExpanded && hasAiContext && (
                        <TableRow key={`${trade.id}-expanded`}>
                          <TableCell colSpan={10} className="bg-muted/30 p-4">
                            <AIContextPanel aiContext={trade.aiContext!} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">
                  Page {data.page} of {data.totalPages} ({data.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page <= 1}
                    onClick={() => onPageChange(data.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page >= data.totalPages}
                    onClick={() => onPageChange(data.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Displays AI context details in the expanded row */
function AIContextPanel({ aiContext }: { aiContext: NonNullable<PaperTrade['aiContext']> }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">AI Decision Context</h4>

      {aiContext.prompt && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Prompt</p>
          <p className="text-sm bg-background rounded p-2 border">{aiContext.prompt}</p>
        </div>
      )}

      {aiContext.response && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">AI Response</p>
          <p className="text-sm bg-background rounded p-2 border whitespace-pre-wrap">
            {aiContext.response}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {aiContext.indicators && Object.keys(aiContext.indicators).length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Indicators</p>
            <pre className="text-xs bg-background rounded p-2 border overflow-auto max-h-40">
              {JSON.stringify(aiContext.indicators, null, 2)}
            </pre>
          </div>
        )}

        {aiContext.trendlineAnalysis && Object.keys(aiContext.trendlineAnalysis).length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Trendline Analysis</p>
            <pre className="text-xs bg-background rounded p-2 border overflow-auto max-h-40">
              {JSON.stringify(aiContext.trendlineAnalysis, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
