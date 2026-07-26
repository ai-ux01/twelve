/**
 * Error Display Components - AI Trading Lab
 *
 * Handles error UI for various failure scenarios:
 * - Intent detection failures with rephrasing suggestion
 * - Market data unavailable when Quant Engine unreachable
 * - "Retrying..." indicator during GPT-4 retries
 * - Paper trade failure with retry button
 * - SSE drop: show last content + "connection lost"
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

'use client';

import { AlertCircle, WifiOff, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorBannerProps {
  type: 'intent' | 'market_data' | 'retrying' | 'paper_trade' | 'connection_lost' | 'generic';
  message: string;
  detail?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({
  type,
  message,
  detail,
  onRetry,
  onDismiss,
  className,
}: ErrorBannerProps) {
  const config = getErrorConfig(type);

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3',
        config.containerClass,
        className
      )}
      role="alert"
    >
      <div className={cn('flex-shrink-0 mt-0.5', config.iconClass)}>{config.icon}</div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', config.textClass)}>{message}</p>
        {detail && (
          <p className="text-xs text-muted-foreground mt-1">{detail}</p>
        )}
        {type === 'intent' && (
          <p className="text-xs text-muted-foreground mt-1">
            Try rephrasing with a specific stock or trading intent, e.g. &quot;Should I buy RELIANCE
            for swing?&quot;
          </p>
        )}
        {type === 'retrying' && (
          <div className="flex items-center gap-2 mt-2">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span className="text-xs">Retrying...</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onRetry && type !== 'retrying' && (
          <Button variant="outline" size="sm" onClick={onRetry} className="h-7 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-7 w-7 p-0"
            aria-label="Dismiss error"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Connection lost banner - shown when SSE stream drops
 */
export interface ConnectionLostBannerProps {
  onReconnect?: () => void;
  className?: string;
}

export function ConnectionLostBanner({ onReconnect, className }: ConnectionLostBannerProps) {
  return (
    <ErrorBanner
      type="connection_lost"
      message="Connection lost"
      detail="The stream was interrupted. Your last content is still visible above."
      onRetry={onReconnect}
      className={className}
    />
  );
}

/**
 * Paper trade error with retry
 */
export interface PaperTradeErrorProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function PaperTradeError({ message, onRetry, onDismiss, className }: PaperTradeErrorProps) {
  return (
    <ErrorBanner
      type="paper_trade"
      message="Paper trade failed"
      detail={message}
      onRetry={onRetry}
      onDismiss={onDismiss}
      className={className}
    />
  );
}

function getErrorConfig(type: ErrorBannerProps['type']) {
  switch (type) {
    case 'intent':
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        containerClass: 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30',
        iconClass: 'text-yellow-600',
        textClass: 'text-yellow-800 dark:text-yellow-200',
      };
    case 'market_data':
      return {
        icon: <WifiOff className="h-4 w-4" />,
        containerClass: 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30',
        iconClass: 'text-orange-600',
        textClass: 'text-orange-800 dark:text-orange-200',
      };
    case 'retrying':
      return {
        icon: <RefreshCw className="h-4 w-4 animate-spin" />,
        containerClass: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
        iconClass: 'text-blue-600',
        textClass: 'text-blue-800 dark:text-blue-200',
      };
    case 'paper_trade':
      return {
        icon: <XCircle className="h-4 w-4" />,
        containerClass: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
        iconClass: 'text-red-600',
        textClass: 'text-red-800 dark:text-red-200',
      };
    case 'connection_lost':
      return {
        icon: <WifiOff className="h-4 w-4" />,
        containerClass: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50',
        iconClass: 'text-gray-600',
        textClass: 'text-gray-800 dark:text-gray-200',
      };
    case 'generic':
    default:
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        containerClass: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
        iconClass: 'text-red-600',
        textClass: 'text-red-800 dark:text-red-200',
      };
  }
}
