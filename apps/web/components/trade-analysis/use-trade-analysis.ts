/**
 * useTradeAnalysis Hook - Trade Analysis
 *
 * Custom hook that provides all API calls and state management for the
 * Trade Analysis page. Connects to the quant engine at http://localhost:8000.
 *
 * API Endpoints:
 * - POST /api/trade-analysis/import/csv (FormData with file)
 * - POST /api/trade-analysis/trades (JSON body)
 * - GET  /api/trade-analysis/metrics?user_id=default
 * - GET  /api/trade-analysis/metrics/grouped?dimension=X&user_id=default
 * - POST /api/trade-analysis/ai/analyze?user_id=default (JSON body)
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  CSVImportResponse,
  PerformanceMetrics,
  GroupedMetricsItem,
  AIAnalysisResponse,
  ManualTradeRequest,
  GroupingDimension,
} from './types';

const API_BASE = 'http://localhost:8000';
const USER_ID = 'default';

interface UseTradeAnalysisResult {
  // Data
  metrics: PerformanceMetrics | null;
  groupedMetrics: GroupedMetricsItem[] | null;
  importResult: CSVImportResponse | null;
  aiResponse: AIAnalysisResponse | null;

  // Loading states
  isLoadingMetrics: boolean;
  isLoadingGrouped: boolean;
  isImporting: boolean;
  isCreatingTrade: boolean;
  isAnalyzing: boolean;

  // Errors
  errorMetrics: string | null;
  errorGrouped: string | null;
  errorImport: string | null;
  errorCreate: string | null;
  errorAI: string | null;

  // Actions
  importCSV: (file: File) => Promise<void>;
  createTrade: (trade: ManualTradeRequest) => Promise<void>;
  getGroupedMetrics: (dimension: GroupingDimension) => Promise<void>;
  analyzeWithAI: (prompt: string) => Promise<void>;
  refreshMetrics: () => Promise<void>;
}

export function useTradeAnalysis(): UseTradeAnalysisResult {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [groupedMetrics, setGroupedMetrics] = useState<GroupedMetricsItem[] | null>(null);
  const [importResult, setImportResult] = useState<CSVImportResponse | null>(null);
  const [aiResponse, setAiResponse] = useState<AIAnalysisResponse | null>(null);

  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isLoadingGrouped, setIsLoadingGrouped] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreatingTrade, setIsCreatingTrade] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [errorMetrics, setErrorMetrics] = useState<string | null>(null);
  const [errorGrouped, setErrorGrouped] = useState<string | null>(null);
  const [errorImport, setErrorImport] = useState<string | null>(null);
  const [errorCreate, setErrorCreate] = useState<string | null>(null);
  const [errorAI, setErrorAI] = useState<string | null>(null);

  // Fetch aggregate metrics
  const fetchMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    setErrorMetrics(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/trade-analysis/metrics?user_id=${USER_ID}`
      );
      if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.status}`);
      const data = await res.json();
      setMetrics(data.metrics);
    } catch (err) {
      setErrorMetrics(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  // Fetch grouped metrics by dimension
  const getGroupedMetrics = useCallback(async (dimension: GroupingDimension) => {
    setIsLoadingGrouped(true);
    setErrorGrouped(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/trade-analysis/metrics/grouped?dimension=${dimension}&user_id=${USER_ID}`
      );
      if (!res.ok) throw new Error(`Failed to fetch grouped metrics: ${res.status}`);
      const data = await res.json();
      setGroupedMetrics(data.groups);
    } catch (err) {
      setErrorGrouped(
        err instanceof Error ? err.message : 'Failed to fetch grouped metrics'
      );
    } finally {
      setIsLoadingGrouped(false);
    }
  }, []);

  // Import CSV file
  const importCSV = useCallback(async (file: File) => {
    setIsImporting(true);
    setErrorImport(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(
        `${API_BASE}/api/trade-analysis/import/csv?user_id=${USER_ID}`,
        {
          method: 'POST',
          body: formData,
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.detail || `Import failed: ${res.status}`
        );
      }
      const data: CSVImportResponse = await res.json();
      setImportResult(data);
      // Refresh metrics after successful import
      if (data.trades_imported > 0) {
        await fetchMetrics();
      }
    } catch (err) {
      setErrorImport(err instanceof Error ? err.message : 'Failed to import CSV');
    } finally {
      setIsImporting(false);
    }
  }, [fetchMetrics]);

  // Create a manual trade
  const createTrade = useCallback(async (trade: ManualTradeRequest) => {
    setIsCreatingTrade(true);
    setErrorCreate(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/trade-analysis/trades?user_id=${USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(trade),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const message =
          errData?.detail ||
          errData?.errors?.map((e: { message: string }) => e.message).join(', ') ||
          `Failed to create trade: ${res.status}`;
        throw new Error(message);
      }
      // Refresh metrics after creating a trade
      await fetchMetrics();
    } catch (err) {
      setErrorCreate(err instanceof Error ? err.message : 'Failed to create trade');
    } finally {
      setIsCreatingTrade(false);
    }
  }, [fetchMetrics]);

  // AI analysis
  const analyzeWithAI = useCallback(async (prompt: string) => {
    setIsAnalyzing(true);
    setErrorAI(null);
    setAiResponse(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/trade-analysis/ai/analyze?user_id=${USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `AI analysis failed: ${res.status}`);
      }
      const data: AIAnalysisResponse = await res.json();
      setAiResponse(data);
    } catch (err) {
      setErrorAI(err instanceof Error ? err.message : 'AI analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Fetch metrics on mount
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    groupedMetrics,
    importResult,
    aiResponse,
    isLoadingMetrics,
    isLoadingGrouped,
    isImporting,
    isCreatingTrade,
    isAnalyzing,
    errorMetrics,
    errorGrouped,
    errorImport,
    errorCreate,
    errorAI,
    importCSV,
    createTrade,
    getGroupedMetrics,
    analyzeWithAI,
    refreshMetrics: fetchMetrics,
  };
}
