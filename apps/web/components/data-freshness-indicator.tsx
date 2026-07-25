/**
 * DataFreshnessIndicator Component
 * 
 * Displays data timestamp, age, and freshness indicator with color coding.
 * Shows warning banner if data is stale.
 * 
 * Requirements covered: 6.5, 6.8
 */

import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock } from 'lucide-react';

export interface DataFreshnessIndicatorProps {
  dataFreshness: {
    timestamp: string; // ISO 8601 format
    ageSeconds: number;
    isStale: boolean;
  };
  onRefreshClick?: () => void;
}

/**
 * DataFreshnessIndicator - Display data freshness with visual indicators
 * 
 * Features:
 * - Display data timestamp in readable format (e.g., "Updated: 2:45:30 PM")
 * - Calculate and display data age (e.g., "2 minutes ago")
 * - Show freshness indicator: Green (< 2 min), Yellow (2-5 min), Red (> 5 min)
 * - If data is stale (Red), show warning banner: "⚠️ Data is stale. Click REFRESH & ANALYZE for latest data."
 * - Disable trade buttons when data is stale (handled by parent components)
 */
export function DataFreshnessIndicator({ dataFreshness, onRefreshClick }: DataFreshnessIndicatorProps) {
  const { timestamp, ageSeconds, isStale } = dataFreshness;

  // Format timestamp to readable format
  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Calculate age in human-readable format
  const formatAge = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} seconds ago`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes} min ${remainingSeconds} sec ago`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hr ${minutes} min ago`;
    }
  };

  // Determine freshness level
  // Green: < 120 seconds (2 minutes)
  // Yellow: 120-300 seconds (2-5 minutes)
  // Red: > 300 seconds (5 minutes)
  const getFreshnessLevel = (seconds: number): 'fresh' | 'moderate' | 'stale' => {
    if (seconds < 120) return 'fresh';
    if (seconds < 300) return 'moderate';
    return 'stale';
  };

  const freshnessLevel = getFreshnessLevel(ageSeconds);

  const getFreshnessColor = (level: 'fresh' | 'moderate' | 'stale') => {
    switch (level) {
      case 'fresh':
        return 'bg-green-500';
      case 'moderate':
        return 'bg-yellow-500';
      case 'stale':
        return 'bg-red-500';
    }
  };

  const getFreshnessText = (level: 'fresh' | 'moderate' | 'stale') => {
    switch (level) {
      case 'fresh':
        return 'Fresh';
      case 'moderate':
        return 'Moderate';
      case 'stale':
        return 'Stale';
    }
  };

  return (
    <div className="space-y-3">
      {/* Timestamp and Age Display */}
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-3 rounded-md">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-medium">Updated: </span>
            <span className="text-muted-foreground">{formatTimestamp(timestamp)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{formatAge(ageSeconds)}</span>
          <Badge className={getFreshnessColor(freshnessLevel)}>
            {getFreshnessText(freshnessLevel)}
          </Badge>
        </div>
      </div>

      {/* Stale Data Warning Banner */}
      {isStale && (
        <div className="bg-red-50 dark:bg-red-950 border-2 border-red-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800 dark:text-red-200 mb-1">
                ⚠️ Data is stale
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                Click REFRESH & ANALYZE to get the latest data before making any trading decisions.
              </p>
              {onRefreshClick && (
                <button
                  onClick={onRefreshClick}
                  className="mt-2 text-sm font-medium text-red-800 dark:text-red-200 underline hover:no-underline"
                >
                  Refresh Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
