'use client';

/**
 * MarketFeedChart Component
 *
 * Live candlestick chart for the Market Feed page that updates in real-time
 * as WebSocket tick data arrives.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ISeriesApi, CandlestickData, HistogramData, UTCTimestamp } from 'lightweight-charts';
import { useChart } from '@/lib/hooks/useChart';
import { toCandlestickData, toVolumeData } from '@/lib/charts/chart-utils';
import type { OHLCVData } from '@/lib/api-client';

interface TickData {
  instrumentToken: string;
  symbol: string;
  lastPrice: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  timestamp: string;
}

interface MarketFeedChartProps {
  symbol: string;
  height?: number;
  isConnected?: boolean;
  onTick?: (tick: TickData) => void;
}

/**
 * Updates the last candle with a new tick price.
 * high = max(previous high, tick price)
 * low = min(previous low, tick price)
 * close = tick price
 * open remains unchanged
 */
export function updateCandleWithTick(
  candle: CandlestickData,
  tickPrice: number
): CandlestickData {
  return {
    ...candle,
    high: Math.max(candle.high, tickPrice),
    low: Math.min(candle.low, tickPrice),
    close: tickPrice,
  };
}

export default function MarketFeedChart({
  symbol,
  height = 400,
  isConnected = true,
  onTick,
}: MarketFeedChartProps) {
  const { chartContainerRef, chart, isReady } = useChart({ height });
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lastCandleRef = useRef<CandlestickData | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch OHLCV data when symbol changes
  useEffect(() => {
    if (!isReady || !chart || !symbol) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `http://localhost:8000/api/market-data/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=5minute&limit=100`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch OHLCV data: ${response.status}`);
        }

        const json = await response.json();
        const data: OHLCVData[] = json.data || json;

        if (cancelled) return;

        if (data.length === 0) {
          setError('No data available');
          setLoading(false);
          return;
        }

        // Remove existing series
        if (candlestickSeriesRef.current) {
          chart.removeSeries(candlestickSeriesRef.current);
          candlestickSeriesRef.current = null;
        }
        if (volumeSeriesRef.current) {
          chart.removeSeries(volumeSeriesRef.current);
          volumeSeriesRef.current = null;
        }

        // Add candlestick series
        const candlestickSeries = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderUpColor: '#26a69a',
          borderDownColor: '#ef5350',
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });

        const candlestickData = toCandlestickData(data);
        candlestickSeries.setData(candlestickData);
        candlestickSeriesRef.current = candlestickSeries;

        // Store last candle for real-time updates
        if (candlestickData.length > 0) {
          lastCandleRef.current = candlestickData[candlestickData.length - 1];
        }

        // Add volume histogram series
        const volumeSeries = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: '',
        });

        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });

        const volumeData = toVolumeData(data);
        volumeSeries.setData(volumeData);
        volumeSeriesRef.current = volumeSeries;

        // Auto-scroll to keep latest candle visible
        chart.timeScale().scrollToRealTime();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [symbol, isReady, chart]);

  // Subscribe to Socket.IO tick events for real-time updates
  useEffect(() => {
    if (!isReady || !chart || !symbol) return;

    const socket = io('http://localhost:4000/market-feed', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe', { token: 'all', type: 'all' });
    });

    socket.on('tick', (tick: TickData) => {
      // Only process ticks for our symbol
      if (tick.symbol !== symbol) return;

      // Notify parent via callback
      onTick?.(tick);

      // Update the last candle with new tick data
      if (candlestickSeriesRef.current && lastCandleRef.current) {
        const updatedCandle = updateCandleWithTick(lastCandleRef.current, tick.lastPrice);
        lastCandleRef.current = updatedCandle;
        candlestickSeriesRef.current.update(updatedCandle);

        // Auto-scroll to keep latest candle visible
        chart.timeScale().scrollToRealTime();
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [symbol, isReady, chart, onTick]);

  return (
    <div className="relative w-full">
      {/* Chart container */}
      <div ref={chartContainerRef as React.RefObject<HTMLDivElement>} className="w-full" />

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <span className="text-sm text-muted-foreground">Loading chart...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Disconnected overlay */}
      {!isConnected && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded bg-destructive/90 px-2 py-1 text-xs text-destructive-foreground">
          <span className="h-2 w-2 rounded-full bg-red-300 animate-pulse" />
          Feed disconnected
        </div>
      )}
    </div>
  );
}
