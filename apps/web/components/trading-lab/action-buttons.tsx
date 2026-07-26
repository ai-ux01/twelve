/**
 * ActionButtons Component - AI Trading Lab
 *
 * Displays action buttons after each recommendation:
 * ANALYZE MARKET, BUY ON PAPER, IGNORE, STOP.
 *
 * Requirements: 6.5, 6.6, 6.7, 6.8, 8.4
 */

'use client';

import { BarChart3, ShoppingCart, X, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ActionType } from './types';

export interface ActionButtonsProps {
  decisionId: string;
  onAction: (action: ActionType, decisionId: string) => void;
  isLoading?: boolean;
  dismissed?: boolean;
}

export function ActionButtons({
  decisionId,
  onAction,
  isLoading = false,
  dismissed = false,
}: ActionButtonsProps) {
  if (dismissed) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAction('ANALYZE_MARKET', decisionId)}
        disabled={isLoading}
        className="text-xs h-8"
      >
        <BarChart3 className="h-3 w-3 mr-1" />
        Analyze Market
      </Button>
      <Button
        variant="default"
        size="sm"
        onClick={() => onAction('BUY_ON_PAPER', decisionId)}
        disabled={isLoading}
        className="text-xs h-8 bg-green-600 hover:bg-green-700"
      >
        <ShoppingCart className="h-3 w-3 mr-1" />
        {isLoading ? 'Processing...' : 'Buy on Paper'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAction('IGNORE', decisionId)}
        disabled={isLoading}
        className="text-xs h-8 text-muted-foreground"
      >
        <X className="h-3 w-3 mr-1" />
        Ignore
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAction('STOP', decisionId)}
        disabled={isLoading}
        className="text-xs h-8 text-destructive"
      >
        <Square className="h-3 w-3 mr-1" />
        Stop
      </Button>
    </div>
  );
}
