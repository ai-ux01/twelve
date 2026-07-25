/**
 * WebSocket Integration Examples
 *
 * Examples showing how to integrate WebSocket updates with Chart and Portfolio components
 *
 * Requirements: 13.6
 * Task: 22.2
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ChartViewer } from '@/components/ChartViewer';
import { PortfolioTable } from '@/components/portfolio-table';
import { usePriceUpdates, usePortfolioUpdates, useWebSocketConnection } from './hooks/useWebSocket';
import { Badge } from '@/components/ui/badge';
import type { OHLCVData } from './api-client';

// ============================================================================
// Example 1: Chart with Real-time Price Updates
// ============================================================================

/**
 * Chart component that subscribes to price updates and updates the chart in real-time
 */
export function ChartWithRealTimeUpdates() {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [chartData, setChartData] = useState<OHLCVData[]>([
    // Initial data would come from API
    {
      timestamp: new Date().toISOString(),
      open: 2450,
      high: 2470,
      low: 2445,
      close: 2460,
      volume: 1000000,
    },
  ]);

  // Subscribe to price updates for current symbol
  const priceUpdate = usePriceUpdates(symbol);

  useEffect(() => {
    if (priceUpdate) {
      console.log('Received price update:', priceUpdate);

      // Update chart with new price
      // In real implementation, you would update the last candle or add a new one
      setChartData((prev) => {
        const newData = [...prev];
        const lastCandle = newData[newData.length - 1];

        // Update last candle with new price
        if (lastCandle) {
          lastCandle.close = priceUpdate.price;
          lastCandle.high = Math.max(lastCandle.high, priceUpdate.price);
          lastCandle.low = Math.min(lastCandle.low, priceUpdate.price);
        }

        return newData;
      });
    }
  }, [priceUpdate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Real-time Chart</h2>
        {priceUpdate && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last update:</span>
            <Badge variant="default">
              ₹{priceUpdate.price.toFixed(2)} ({priceUpdate.changePercent.toFixed(2)}%)
            </Badge>
          </div>
        )}
      </div>

      <ChartViewer symbol={symbol} data={chartData} />

      <div className="flex gap-2">
        <button
          onClick={() => setSymbol('RELIANCE')}
          className="px-4 py-2 rounded bg-primary text-primary-foreground"
        >
          RELIANCE
        </button>
        <button
          onClick={() => setSymbol('INFY')}
          className="px-4 py-2 rounded bg-primary text-primary-foreground"
        >
          INFY
        </button>
        <button
          onClick={() => setSymbol('TCS')}
          className="px-4 py-2 rounded bg-primary text-primary-foreground"
        >
          TCS
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Example 2: Portfolio with Real-time PnL Updates
// ============================================================================

/**
 * Portfolio component that subscribes to portfolio updates and shows real-time PnL
 */
export function PortfolioWithRealTimeUpdates() {
  const userId = 'user-1'; // In real app, get from auth context

  // Subscribe to portfolio updates
  const portfolioUpdate = usePortfolioUpdates();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Portfolio</h2>
        {portfolioUpdate && (
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Total P&L:</span>{' '}
              <span
                className={`font-semibold ${
                  portfolioUpdate.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                ₹
                {portfolioUpdate.totalPnL.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Daily P&L:</span>{' '}
              <span
                className={`font-semibold ${
                  portfolioUpdate.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                ₹
                {portfolioUpdate.dailyPnL.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <Badge variant="secondary" className="text-xs">
              Updated: {new Date(portfolioUpdate.timestamp).toLocaleTimeString()}
            </Badge>
          </div>
        )}
      </div>

      <PortfolioTable userId={userId} />
    </div>
  );
}

// ============================================================================
// Example 3: Connection Status Indicator
// ============================================================================

/**
 * Component that shows WebSocket connection status
 */
export function ConnectionStatusIndicator() {
  const isConnected = useWebSocketConnection();

  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${
          isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`}
      />
      <span className="text-sm text-muted-foreground">
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
}

// ============================================================================
// Example 4: Full Dashboard with Real-time Updates
// ============================================================================

/**
 * Full dashboard combining chart and portfolio with real-time updates
 */
export function RealTimeDashboard() {
  const isConnected = useWebSocketConnection();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header with connection status */}
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">ProfitTerminal</h1>
          <ConnectionStatusIndicator />
        </div>

        {/* Show warning if disconnected */}
        {!isConnected && (
          <div className="rounded-lg border border-yellow-500 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              ⚠️ WebSocket disconnected. Real-time updates are paused.
            </p>
          </div>
        )}

        {/* Portfolio with real-time PnL */}
        <PortfolioWithRealTimeUpdates />

        {/* Chart with real-time price updates */}
        <ChartWithRealTimeUpdates />
      </div>
    </div>
  );
}

// ============================================================================
// Example 5: Multiple Symbol Tracking
// ============================================================================

/**
 * Component that tracks multiple symbols simultaneously
 */
export function MultiSymbolTracker() {
  const symbols = ['RELIANCE', 'INFY', 'TCS', 'HDFCBANK'];
  const [prices, setPrices] = useState<Record<string, number>>({});

  // Subscribe to all symbols
  const relianceUpdate = usePriceUpdates('RELIANCE');
  const infyUpdate = usePriceUpdates('INFY');
  const tcsUpdate = usePriceUpdates('TCS');
  const hdfcUpdate = usePriceUpdates('HDFCBANK');

  // Update prices when updates received
  useEffect(() => {
    if (relianceUpdate) setPrices((p) => ({ ...p, RELIANCE: relianceUpdate.price }));
  }, [relianceUpdate]);

  useEffect(() => {
    if (infyUpdate) setPrices((p) => ({ ...p, INFY: infyUpdate.price }));
  }, [infyUpdate]);

  useEffect(() => {
    if (tcsUpdate) setPrices((p) => ({ ...p, TCS: tcsUpdate.price }));
  }, [tcsUpdate]);

  useEffect(() => {
    if (hdfcUpdate) setPrices((p) => ({ ...p, HDFCBANK: hdfcUpdate.price }));
  }, [hdfcUpdate]);

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-lg font-semibold mb-4">Live Prices</h3>
      <div className="grid grid-cols-2 gap-4">
        {symbols.map((symbol) => (
          <div key={symbol} className="flex items-center justify-between rounded-md border p-3">
            <span className="font-medium">{symbol}</span>
            <span className="text-lg font-bold">
              {prices[symbol] ? `₹${prices[symbol].toFixed(2)}` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
