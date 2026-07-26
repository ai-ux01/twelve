'use client';

/**
 * Custom hook for polling the Options Scalper quant engine API.
 *
 * Implements:
 * - Auto-refresh with configurable interval
 * - Circuit breaker (trips after 3 consecutive failures)
 * - Countdown timer (ticks every 1 second)
 * - Market hours awareness (pauses outside IST 9:15–15:30 Mon–Fri)
 * - Skip fetch when previous request is in-flight
 * - AbortController-based request timeout
 *
 * Requirements: 2.1, 2.3, 2.4, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AnalysisResult,
  UseOptionsScalperPollingOptions,
  UseOptionsScalperPollingResult,
} from '../lib/options-scalper/types';
import { isMarketHours } from '../lib/options-scalper/market-hours';

/** Number of consecutive failures before the circuit breaker trips */
const CIRCUIT_BREAKER_THRESHOLD = 3;

export function useOptionsScalperPolling(
  options: UseOptionsScalperPollingOptions
): UseOptionsScalperPollingResult {
  const { underlying, refreshIntervalSeconds, apiUrl, requestTimeoutMs } = options;

  // --- State ---
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [status, setStatus] = useState<
    'active' | 'paused' | 'error' | 'initializing' | 'market-closed'
  >('initializing');
  const [secondsRemaining, setSecondsRemaining] = useState(refreshIntervalSeconds);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  // --- Refs (mutable, not re-render triggers) ---
  const isInFlightRef = useRef(false);
  const isPausedRef = useRef(false);
  const isTabHiddenRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // Keep ref in sync with state for use in closures
  const statusRef = useRef(status);
  statusRef.current = status;

  // --- Fetch logic ---
  const executeFetch = useCallback(async () => {
    // Skip if already in-flight
    if (isInFlightRef.current) return;

    isInFlightRef.current = true;
    setIsRefreshing(true);

    // Create abort controller for timeout
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, requestTimeoutMs);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ underlying }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: AnalysisResult = await response.json();

      if (!isMountedRef.current) return;

      // Success: update data, reset failures, reset countdown
      setData(result);
      setErrorMessage(undefined);
      consecutiveFailuresRef.current = 0;
      setConsecutiveFailures(0);
      setSecondsRemaining(refreshIntervalSeconds);

      // Only set active if not paused
      if (!isPausedRef.current) {
        setStatus('active');
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (!isMountedRef.current) return;

      // Failure: retain last data, increment failures, show error
      consecutiveFailuresRef.current += 1;
      setConsecutiveFailures(consecutiveFailuresRef.current);

      const message =
        err instanceof Error
          ? err.name === 'AbortError'
            ? 'Request timed out'
            : err.message
          : 'Analysis request failed';
      setErrorMessage(message);

      // Check circuit breaker threshold
      if (consecutiveFailuresRef.current >= CIRCUIT_BREAKER_THRESHOLD) {
        // Trip circuit breaker: pause auto-refresh
        isPausedRef.current = true;
        setStatus('error');
      }
    } finally {
      if (isMountedRef.current) {
        isInFlightRef.current = false;
        setIsRefreshing(false);
        abortControllerRef.current = null;
      }
    }
  }, [apiUrl, underlying, requestTimeoutMs, refreshIntervalSeconds]);

  // --- Countdown timer ---
  useEffect(() => {
    // Only run countdown when status is 'active'
    if (status !== 'active') {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Time to fetch — trigger if not in-flight and tab is visible
          if (!isInFlightRef.current && !isTabHiddenRef.current) {
            executeFetch();
          }
          return refreshIntervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [status, refreshIntervalSeconds, executeFetch]);

  // --- Initial mount: check market hours and trigger first fetch ---
  useEffect(() => {
    isMountedRef.current = true;

    const now = new Date();
    if (isMarketHours(now)) {
      // Market is open — trigger initial fetch immediately
      setStatus('active');
      executeFetch();
    } else {
      // Market is closed — no auto-refresh
      setStatus('market-closed');
    }

    return () => {
      isMountedRef.current = false;
      // Abort any in-flight request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Page visibility handling ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab hidden: pause polling by setting ref, stop scheduling new fetches
        // Allow any in-flight request to complete naturally
        isTabHiddenRef.current = true;
      } else if (document.visibilityState === 'visible') {
        // Tab visible again
        isTabHiddenRef.current = false;

        // Don't resume if user has manually paused or circuit breaker tripped
        if (isPausedRef.current) return;

        const now = new Date();
        if (isMarketHours(now)) {
          // Market hours: resume polling with immediate fetch and restart countdown
          setStatus('active');
          setSecondsRemaining(refreshIntervalSeconds);
          executeFetch();
        } else {
          // Outside market hours: remain paused, display last data
          setStatus('market-closed');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [executeFetch, refreshIntervalSeconds]);

  // --- Manual refresh ---
  const refreshNow = useCallback(() => {
    // If circuit breaker is tripped, reset it for manual refresh
    if (consecutiveFailuresRef.current >= CIRCUIT_BREAKER_THRESHOLD) {
      consecutiveFailuresRef.current = 0;
      setConsecutiveFailures(0);
      setErrorMessage(undefined);
      // Reset paused state so successful fetch can restore 'active' status
      // (only when circuit breaker caused the pause, not user-initiated pause)
      if (statusRef.current === 'error') {
        isPausedRef.current = false;
        setStatus('active');
      }
    }
    setSecondsRemaining(refreshIntervalSeconds);
    executeFetch();
  }, [executeFetch, refreshIntervalSeconds]);

  // --- Toggle pause ---
  const togglePause = useCallback(
    (paused: boolean) => {
      if (paused) {
        isPausedRef.current = true;
        setStatus('paused');
      } else {
        // Resume: check market hours first
        const now = new Date();
        if (isMarketHours(now)) {
          isPausedRef.current = false;
          setStatus('active');
          setSecondsRemaining(refreshIntervalSeconds);
          executeFetch();
        } else {
          // Can't resume outside market hours — remain paused with market-closed message
          isPausedRef.current = true;
          setStatus('market-closed');
        }
      }
    },
    [executeFetch, refreshIntervalSeconds]
  );

  return {
    data,
    status,
    secondsUntilRefresh: secondsRemaining,
    isRefreshing,
    errorMessage,
    consecutiveFailures,
    refreshNow,
    togglePause,
  };
}
