'use client';

/**
 * ActionButtons Component
 *
 * Displays action buttons for trade execution:
 * - "BUY ON PAPER" button when signal is BUY
 * - Disabled when signal is HOLD or trade parameters are missing
 * - Disabled while paper trade creation is in progress
 * - Creates paper trade with underlying, option type, strike, expiry, entry, target, stop loss, quantity
 * - Quantity: 1 lot = 50 for NIFTY, 25 for BANKNIFTY
 * - Success confirmation for 3 seconds or until dismissed
 * - Navigation to paper trading portfolio within 2 seconds on success
 * - Error message on failure
 * - 5-second timeout for Paper_Trading_System API call
 *
 * Requirements covered: 18.1-18.9, 26.1-26.3, 26.7-26.10
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, Loader2, ShoppingCart } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { DEFAULT_USER_ID } from '@/lib/constants';

export interface PaperTradeParams {
  signalType: 'BUY CE' | 'BUY PE' | 'HOLD';
  underlying: 'NIFTY' | 'BANKNIFTY' | null;
  optionType: 'CE' | 'PE' | null;
  strikePrice: number | null;
  expiryDate: string | Date | null;
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
}

export interface ActionButtonsProps {
  /** Trade parameters from the signal */
  tradeParams: PaperTradeParams | null;
  /** User ID for creating paper trades */
  userId?: string;
}

/** Lot sizes per underlying */
const LOT_SIZES: Record<string, number> = {
  NIFTY: 50,
  BANKNIFTY: 25,
};

export function ActionButtons({ tradeParams, userId = DEFAULT_USER_ID }: ActionButtonsProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navigationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
    };
  }, []);

  const isBuySignal =
    tradeParams?.signalType === 'BUY CE' || tradeParams?.signalType === 'BUY PE';

  const hasAllParams =
    tradeParams !== null &&
    tradeParams.underlying !== null &&
    tradeParams.optionType !== null &&
    tradeParams.strikePrice !== null &&
    tradeParams.expiryDate !== null &&
    tradeParams.entryPrice !== null &&
    tradeParams.targetPrice !== null &&
    tradeParams.stopLoss !== null;

  const isDisabled = !isBuySignal || !hasAllParams || isCreating;

  const handleBuyOnPaper = useCallback(async () => {
    if (!tradeParams || !hasAllParams || isCreating) return;

    setIsCreating(true);
    setError(null);
    setSuccess(false);

    const quantity = tradeParams.underlying ? LOT_SIZES[tradeParams.underlying] : 50;
    const expiryStr =
      tradeParams.expiryDate instanceof Date
        ? tradeParams.expiryDate.toISOString().split('T')[0]
        : typeof tradeParams.expiryDate === 'string'
          ? tradeParams.expiryDate
          : '';

    try {
      // 5-second timeout for Paper_Trading_System API call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await apiClient.executePaperOptionTrade({
        userId,
        symbol: tradeParams.underlying!,
        strikePrice: tradeParams.strikePrice!,
        optionType: tradeParams.optionType === 'CE' ? 'CALL' : 'PUT',
        expiry: expiryStr,
        action: 'BUY',
        quantity,
        price: tradeParams.entryPrice!,
        stopLoss: tradeParams.stopLoss!,
        target: tradeParams.targetPrice!,
        signalId: 'options-scalper',
      });

      clearTimeout(timeoutId);

      if (response.status === 'EXECUTED') {
        setSuccess(true);

        // Display success for 3 seconds then dismiss
        successTimerRef.current = setTimeout(() => {
          setSuccess(false);
        }, 3000);

        // Navigate to paper trading portfolio within 2 seconds
        navigationTimerRef.current = setTimeout(() => {
          try {
            router.push('/portfolio');
          } catch {
            setError('Navigation failed. Please go to Portfolio manually.');
          }
        }, 2000);
      } else {
        setError(response.message || response.error || 'Paper trade creation failed');
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timed out after 5 seconds');
        } else {
          setError(err.message || 'Paper trade creation failed');
        }
      } else {
        setError('Paper trade creation failed');
      }
    } finally {
      setIsCreating(false);
    }
  }, [tradeParams, hasAllParams, isCreating, userId, router]);

  const dismissSuccess = useCallback(() => {
    setSuccess(false);
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  return (
    <div className="space-y-3">
      {/* BUY ON PAPER button */}
      <Button
        variant="default"
        size="lg"
        onClick={handleBuyOnPaper}
        disabled={isDisabled}
        className={cn(
          'w-full flex items-center justify-center gap-2 min-h-[44px]',
          isBuySignal && hasAllParams && !isCreating
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : ''
        )}
        aria-label="Buy on paper"
      >
        {isCreating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Creating Paper Trade...
          </>
        ) : (
          <>
            <ShoppingCart className="h-5 w-5" />
            BUY ON PAPER
          </>
        )}
      </Button>

      {/* Success Confirmation */}
      {success && (
        <div
          className="flex items-center justify-between gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-400"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <span>Paper trade created successfully! Redirecting to portfolio...</span>
          </div>
          <button
            onClick={dismissSuccess}
            className="text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200 text-xs underline"
            aria-label="Dismiss success message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          <XCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
