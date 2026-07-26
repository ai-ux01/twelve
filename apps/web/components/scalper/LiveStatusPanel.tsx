'use client';

/**
 * LiveStatusPanel Component
 *
 * Displays real-time system status for the Options Scalping Agent including:
 * - Pulsing indicator dot (green=active, gray=paused, red=error)
 * - Last updated timestamp (HH:MM:SS AM/PM)
 * - Countdown timer to next refresh
 * - "REFRESH NOW" button
 * - "PAUSE AUTO REFRESH" toggle
 * - "PAUSED" indicator
 *
 * Requirements covered: 2.1-2.9, 3.1-3.9, 23.3, 23.4
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshCw, Pause, Play } from 'lucide-react';

export type LiveStatus = 'active' | 'paused' | 'error' | 'initializing';

export interface LiveStatusPanelProps {
  /** Current status of the auto-refresh system */
  status: LiveStatus;
  /** Timestamp of last successful data fetch (ISO string or Date) */
  lastUpdated: Date | string | null;
  /** Seconds remaining until next refresh */
  secondsUntilRefresh: number;
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
  /** Error message when status is 'error' */
  errorMessage?: string;
  /** Callback when user clicks "REFRESH NOW" */
  onRefreshNow: () => void;
  /** Callback when user toggles auto-refresh pause */
  onTogglePause: (paused: boolean) => void;
}

export function LiveStatusPanel({
  status,
  lastUpdated,
  secondsUntilRefresh,
  isRefreshing,
  errorMessage,
  onRefreshNow,
  onTogglePause,
}: LiveStatusPanelProps) {
  const [countdown, setCountdown] = useState(secondsUntilRefresh);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const isPaused = status === 'paused';

  // Sync countdown with prop changes
  useEffect(() => {
    setCountdown(secondsUntilRefresh);
  }, [secondsUntilRefresh]);

  // Countdown timer that updates every second (±50ms deviation acceptable per req 23.3)
  useEffect(() => {
    if (status === 'active' && !isRefreshing) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [status, isRefreshing]);

  // Format last updated timestamp in HH:MM:SS AM/PM format (local time)
  const formatLastUpdated = useCallback((timestamp: Date | string | null): string => {
    if (!timestamp) return '--:--:-- --';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }, []);

  // Format countdown as MM:SS
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRefreshNow = useCallback(() => {
    if (!isRefreshing) {
      onRefreshNow();
    }
  }, [isRefreshing, onRefreshNow]);

  const handleTogglePause = useCallback(() => {
    onTogglePause(!isPaused);
  }, [isPaused, onTogglePause]);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
      {/* Status Indicator Dot */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center" title={errorMessage || ''}>
          <span
            className={cn(
              'inline-block h-3 w-3 rounded-full transition-colors duration-100',
              status === 'active' && 'bg-green-500 animate-pulse-dot',
              status === 'paused' && 'bg-gray-400',
              status === 'error' && 'bg-red-500',
              status === 'initializing' && 'bg-gray-300'
            )}
            aria-label={
              status === 'active'
                ? 'Auto-refresh active'
                : status === 'paused'
                  ? 'Auto-refresh paused'
                  : status === 'error'
                    ? `Error: ${errorMessage || 'Fetch failed'}`
                    : 'Initializing'
            }
          />
          {status === 'error' && errorMessage && (
            <span className="sr-only">{errorMessage}</span>
          )}
        </div>

        {/* Status text */}
        {status === 'initializing' && (
          <span className="text-sm text-muted-foreground">Initializing...</span>
        )}
      </div>

      {/* Last Updated Timestamp */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Last Updated:</span>
        <span className="font-medium">{formatLastUpdated(lastUpdated)}</span>
      </div>

      {/* Countdown Timer */}
      {status === 'active' && !isRefreshing && (
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Next refresh:</span>
          <span className="font-mono font-medium">{formatCountdown(countdown)}</span>
        </div>
      )}

      {/* PAUSED Indicator */}
      {isPaused && (
        <span
          className="text-sm font-semibold text-orange-600 dark:text-orange-400"
          style={{ fontSize: '14px' }}
          aria-live="polite"
        >
          PAUSED
        </span>
      )}

      {/* Action Buttons */}
      <div className="ml-auto flex items-center gap-2">
        {/* REFRESH NOW Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshNow}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 min-h-[44px] min-w-[44px]"
          aria-label="Refresh now"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          REFRESH NOW
        </Button>

        {/* PAUSE AUTO REFRESH Toggle */}
        <Button
          variant={isPaused ? 'default' : 'outline'}
          size="sm"
          onClick={handleTogglePause}
          className="flex items-center gap-1.5 min-h-[44px] min-w-[44px]"
          aria-label={isPaused ? 'Resume auto refresh' : 'Pause auto refresh'}
          aria-pressed={isPaused}
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          {isPaused ? 'RESUME AUTO REFRESH' : 'PAUSE AUTO REFRESH'}
        </Button>
      </div>
    </div>
  );
}
