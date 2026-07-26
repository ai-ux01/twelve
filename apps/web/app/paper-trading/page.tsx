/**
 * Paper Trading Dashboard Page
 *
 * Main page for the Paper Trading System. Displays:
 * - Header with title and TradeTypeFilter
 * - Performance Metrics panel (top)
 * - Open Trades table and Closed Trades table (below)
 *
 * Requirements: 7.1, 8.1, 9.1, 9.3, 9.4
 */

'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { OpenTradesTable } from '@/components/paper-trading/open-trades-table';
import { ClosedTradesTable } from '@/components/paper-trading/closed-trades-table';
import { PerformanceMetricsPanel } from '@/components/paper-trading/performance-metrics-panel';
import { usePaperTrades } from '@/components/paper-trading/use-paper-trades';
import type { TradeTypeFilter } from '@/components/paper-trading/types';

const EquityCurveChart = dynamic(() => import('@/components/charts/EquityCurveChart'), { ssr: false });
const TradePnLChart = dynamic(() => import('@/components/charts/TradePnLChart'), { ssr: false });

const TRADE_TYPE_OPTIONS: { value: TradeTypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SWING', label: 'Swing' },
  { value: 'INTRADAY', label: 'Intraday' },
  { value: 'OPTIONS_SCALPING', label: 'Options Scalping' },
];

export default function PaperTradingPage() {
  const [tradeTypeFilter, setTradeTypeFilter] = useState<TradeTypeFilter>('ALL');
  const [closedTradesPage, setClosedTradesPage] = useState(1);

  const {
    openTrades,
    closedTrades,
    metrics,
    isLoadingOpen,
    isLoadingClosed,
    isLoadingMetrics,
    errorOpen,
    errorClosed,
    errorMetrics,
    closeTrade,
    cancelTrade,
  } = usePaperTrades({
    tradeTypeFilter,
    closedTradesPage,
    closedTradesPageSize: 20,
  });

  const handleFilterChange = (filter: TradeTypeFilter) => {
    setTradeTypeFilter(filter);
    setClosedTradesPage(1); // Reset pagination on filter change
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Paper Trading</h1>
          <p className="text-sm text-muted-foreground">
            Track simulated trades and performance metrics
          </p>
        </div>

        {/* Trade Type Filter */}
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {TRADE_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleFilterChange(option.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tradeTypeFilter === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {/* Performance Metrics Panel (top) */}
      <div className="mb-6">
        <PerformanceMetricsPanel
          metrics={metrics}
          isLoading={isLoadingMetrics}
          error={errorMetrics}
        />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 gap-6">
        {/* Open Trades */}
        <OpenTradesTable
          trades={openTrades}
          isLoading={isLoadingOpen}
          error={errorOpen}
          onClose={closeTrade}
          onCancel={cancelTrade}
        />

        {/* Closed Trades */}
        <ClosedTradesTable
          data={closedTrades}
          isLoading={isLoadingClosed}
          error={errorClosed}
          onPageChange={setClosedTradesPage}
        />
      </div>

      {/* Performance Charts */}
      {(() => {
        const chartTrades = (closedTrades?.data ?? [])
          .filter((t) => t.exitedAt && t.realizedPnL != null)
          .map((t) => ({ closedAt: t.exitedAt!, realizedPnL: t.realizedPnL! }));

        if (chartTrades.length === 0) {
          return (
            <div className="mt-6 rounded-lg border p-8 text-center text-sm text-muted-foreground">
              No closed trades yet. Charts will appear once you close some trades.
            </div>
          );
        }

        return (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-medium mb-2">Equity Curve</h3>
              <EquityCurveChart trades={chartTrades} height={250} />
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-medium mb-2">Trade P&L</h3>
              <TradePnLChart trades={chartTrades} height={250} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
