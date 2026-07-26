/**
 * Paper Trading - Data Fetching Hooks
 *
 * Custom hooks for fetching open trades, closed trades, and performance metrics
 * from the NestJS backend API. Supports auto-refresh, trade type filtering,
 * and pagination.
 *
 * Requirements: 7.3, 9.4, 10.1, 10.6
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  PaperTrade,
  PerformanceMetrics,
  PaginatedTradesResponse,
  TradeTypeFilter,
} from './types';

const API_BASE = 'http://localhost:4000/api';
import { DEFAULT_USER_ID } from '@/lib/constants';
const USER_ID = DEFAULT_USER_ID;
const OPEN_TRADES_REFRESH_INTERVAL = 30_000; // 30 seconds

interface UsePaperTradesOptions {
  tradeTypeFilter: TradeTypeFilter;
  closedTradesPage: number;
  closedTradesPageSize: number;
}

interface UsePaperTradesResult {
  openTrades: PaperTrade[];
  closedTrades: PaginatedTradesResponse | null;
  metrics: PerformanceMetrics | null;
  isLoadingOpen: boolean;
  isLoadingClosed: boolean;
  isLoadingMetrics: boolean;
  errorOpen: string | null;
  errorClosed: string | null;
  errorMetrics: string | null;
  refetchOpen: () => Promise<void>;
  refetchClosed: () => Promise<void>;
  refetchMetrics: () => Promise<void>;
  refetchAll: () => Promise<void>;
  closeTrade: (tradeId: string, exitPrice: number) => Promise<boolean>;
  cancelTrade: (tradeId: string) => Promise<boolean>;
}

export function usePaperTrades({
  tradeTypeFilter,
  closedTradesPage,
  closedTradesPageSize,
}: UsePaperTradesOptions): UsePaperTradesResult {
  const [openTrades, setOpenTrades] = useState<PaperTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<PaginatedTradesResponse | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  const [isLoadingOpen, setIsLoadingOpen] = useState(true);
  const [isLoadingClosed, setIsLoadingClosed] = useState(true);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

  const [errorOpen, setErrorOpen] = useState<string | null>(null);
  const [errorClosed, setErrorClosed] = useState<string | null>(null);
  const [errorMetrics, setErrorMetrics] = useState<string | null>(null);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Build trade type query param
  const tradeTypeParam = tradeTypeFilter !== 'ALL' ? `&tradeType=${tradeTypeFilter}` : '';

  // Fetch open trades
  const fetchOpenTrades = useCallback(async () => {
    setIsLoadingOpen(true);
    setErrorOpen(null);
    try {
      const url = `${API_BASE}/paper-trades?status=OPEN&userId=${USER_ID}${tradeTypeParam}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch open trades: ${response.status}`);
      const data = await response.json();
      // API returns paginated response, extract data array
      setOpenTrades(data.data || []);
    } catch (err) {
      setErrorOpen(err instanceof Error ? err.message : 'Failed to fetch open trades');
    } finally {
      setIsLoadingOpen(false);
    }
  }, [tradeTypeParam]);

  // Fetch closed trades (paginated)
  const fetchClosedTrades = useCallback(async () => {
    setIsLoadingClosed(true);
    setErrorClosed(null);
    try {
      const url = `${API_BASE}/paper-trades?status=TARGET_HIT,STOP_HIT,MANUAL_EXIT,EXPIRED,CANCELLED&userId=${USER_ID}&page=${closedTradesPage}&pageSize=${closedTradesPageSize}${tradeTypeParam}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch closed trades: ${response.status}`);
      const data: PaginatedTradesResponse = await response.json();
      setClosedTrades(data);
    } catch (err) {
      setErrorClosed(err instanceof Error ? err.message : 'Failed to fetch closed trades');
    } finally {
      setIsLoadingClosed(false);
    }
  }, [closedTradesPage, closedTradesPageSize, tradeTypeParam]);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    setErrorMetrics(null);
    try {
      const url = `${API_BASE}/paper-trades/metrics?userId=${USER_ID}${tradeTypeFilter !== 'ALL' ? `&tradeType=${tradeTypeFilter}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch metrics: ${response.status}`);
      const data: PerformanceMetrics = await response.json();
      setMetrics(data);
    } catch (err) {
      setErrorMetrics(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [tradeTypeFilter]);

  // Refetch all
  const refetchAll = useCallback(async () => {
    await Promise.all([fetchOpenTrades(), fetchClosedTrades(), fetchMetrics()]);
  }, [fetchOpenTrades, fetchClosedTrades, fetchMetrics]);

  // Close a trade
  const closeTrade = useCallback(async (tradeId: string, exitPrice: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/paper-trades/${tradeId}/close`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exitPrice, exitReason: 'MANUAL_EXIT' }),
      });
      if (!response.ok) throw new Error(`Failed to close trade: ${response.status}`);
      // Refetch data after close
      await refetchAll();
      return true;
    } catch {
      return false;
    }
  }, [refetchAll]);

  // Cancel a trade
  const cancelTrade = useCallback(async (tradeId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/paper-trades/${tradeId}/cancel`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error(`Failed to cancel trade: ${response.status}`);
      // Refetch data after cancel
      await refetchAll();
      return true;
    } catch {
      return false;
    }
  }, [refetchAll]);

  // Initial fetch and refetch on filter/page change
  useEffect(() => {
    fetchOpenTrades();
  }, [fetchOpenTrades]);

  useEffect(() => {
    fetchClosedTrades();
  }, [fetchClosedTrades]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Auto-refresh open trades every 30s
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      fetchOpenTrades();
    }, OPEN_TRADES_REFRESH_INTERVAL);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [fetchOpenTrades]);

  return {
    openTrades,
    closedTrades,
    metrics,
    isLoadingOpen,
    isLoadingClosed,
    isLoadingMetrics,
    errorOpen,
    errorClosed,
    errorMetrics,
    refetchOpen: fetchOpenTrades,
    refetchClosed: fetchClosedTrades,
    refetchMetrics: fetchMetrics,
    refetchAll,
    closeTrade,
    cancelTrade,
  };
}
