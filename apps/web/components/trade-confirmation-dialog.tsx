'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  AlertTriangle,
  DollarSign,
  Activity,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { Recommendation, RiskValidationResult, PositionInfo } from '@/lib/api-client';

interface TradeConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendation: Recommendation | null;
  quantity: number;
  riskValidation: RiskValidationResult | null;
  portfolioImpact: PortfolioImpact | null;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface PortfolioImpact {
  currentValue: number;
  newInvestment: number;
  newTotalValue: number;
  newExposurePercent: number;
  maxPotentialLoss: number;
  maxPotentialProfit: number;
  existingPositions: number;
}

/**
 * TradeConfirmationDialog Component
 *
 * Modal dialog for confirming live trades with:
 * - Trade details (symbol, action, quantity, price, stop-loss, target)
 * - Risk validation result with violations
 * - Portfolio impact estimate
 * - Explicit "Confirm" and "Cancel" buttons
 *
 * Requirements covered: 10.1, 10.2
 */
export function TradeConfirmationDialog({
  open,
  onOpenChange,
  recommendation,
  quantity,
  riskValidation,
  portfolioImpact,
  isLoading = false,
  onConfirm,
  onCancel,
}: TradeConfirmationDialogProps) {
  // Don't render if no recommendation
  if (!recommendation) return null;

  const { action, symbol, entryPrice, target, stopLoss, confidence } = recommendation;

  // Calculate trade values
  const tradeValue = entryPrice * quantity;
  const potentialProfit = Math.abs(target - entryPrice) * quantity;
  const potentialLoss = Math.abs(entryPrice - stopLoss) * quantity;
  const riskRewardRatio =
    action === 'BUY'
      ? ((target - entryPrice) / (entryPrice - stopLoss)).toFixed(2)
      : ((entryPrice - target) / (stopLoss - entryPrice)).toFixed(2);

  // Calculate percentages
  const profitPercent =
    action === 'BUY'
      ? (((target - entryPrice) / entryPrice) * 100).toFixed(2)
      : (((entryPrice - target) / entryPrice) * 100).toFixed(2);

  const lossPercent =
    action === 'BUY'
      ? (((entryPrice - stopLoss) / entryPrice) * 100).toFixed(2)
      : (((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2);

  // Determine if trade can be confirmed (passed risk validation)
  const canConfirm = riskValidation?.passed ?? false;
  const hasErrors = riskValidation?.violations.some((v) => v.severity === 'ERROR') ?? false;
  const hasWarnings = riskValidation?.violations.some((v) => v.severity === 'WARNING') ?? false;

  // Get action styling
  const actionVariant =
    action === 'BUY' ? 'default' : action === 'SELL' ? 'destructive' : 'outline';
  const actionIcon =
    action === 'BUY' ? (
      <TrendingUp className="size-4" />
    ) : action === 'SELL' ? (
      <TrendingDown className="size-4" />
    ) : null;

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (canConfirm && !isLoading) {
      onConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Activity className="size-5" />
            Confirm Live Trade
          </DialogTitle>
          <DialogDescription>
            Review the trade details and risk analysis before confirming this live trade execution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Trade Summary */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {symbol}
                <Badge variant={actionVariant} className="flex items-center gap-1">
                  {actionIcon}
                  {action}
                </Badge>
              </h3>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className="text-lg font-bold">{(confidence * 100).toFixed(0)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Quantity</p>
                <p className="text-lg font-semibold">{quantity}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Trade Value</p>
                <p className="text-lg font-semibold">₹{tradeValue.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

          {/* Price Levels */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Target className="size-3" />
                Entry Price
              </div>
              <p className="text-lg font-semibold">₹{entryPrice.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <TrendingUp className="size-3" />
                Target
              </div>
              <p className="text-lg font-semibold text-green-600">₹{target.toFixed(2)}</p>
              <p className="text-xs text-green-600">+{profitPercent}%</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <ShieldAlert className="size-3" />
                Stop Loss
              </div>
              <p className="text-lg font-semibold text-red-600">₹{stopLoss.toFixed(2)}</p>
              <p className="text-xs text-red-600">-{lossPercent}%</p>
            </div>
          </div>

          {/* Risk-Reward */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">Max Potential Profit</p>
              <p className="text-lg font-bold text-green-600">
                +₹{potentialProfit.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">Max Potential Loss</p>
              <p className="text-lg font-bold text-red-600">
                -₹{potentialLoss.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <span className="text-sm font-medium">Risk:Reward Ratio</span>
            <span className="text-lg font-bold">1:{riskRewardRatio}</span>
          </div>

          <Separator />

          {/* Risk Validation Result */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="size-4" />
              Risk Validation
            </h3>

            {riskValidation ? (
              <>
                <div
                  className={cn(
                    'rounded-lg border p-3 flex items-center gap-3',
                    canConfirm && !hasWarnings
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                      : hasErrors
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                        : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900'
                  )}
                >
                  {canConfirm && !hasWarnings ? (
                    <>
                      <CheckCircle2 className="size-5 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-green-700 dark:text-green-400">
                          Risk validation passed
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-500">
                          All risk checks passed successfully
                        </p>
                      </div>
                    </>
                  ) : hasErrors ? (
                    <>
                      <XCircle className="size-5 text-red-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-red-700 dark:text-red-400">
                          Risk validation failed
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-500">
                          Trade violates risk rules and cannot be executed
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-5 text-yellow-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-yellow-700 dark:text-yellow-400">
                          Risk warnings present
                        </p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-500">
                          Review warnings before proceeding
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Violations List */}
                {riskValidation.violations.length > 0 && (
                  <div className="space-y-2">
                    {riskValidation.violations.map((violation, index) => (
                      <div
                        key={index}
                        className={cn(
                          'rounded-lg border p-3 text-sm',
                          violation.severity === 'ERROR'
                            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                            : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {violation.severity === 'ERROR' ? (
                            <XCircle className="size-4 text-red-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="size-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p
                              className={cn(
                                'font-medium',
                                violation.severity === 'ERROR'
                                  ? 'text-red-700 dark:text-red-400'
                                  : 'text-yellow-700 dark:text-yellow-400'
                              )}
                            >
                              {violation.rule.replace(/_/g, ' ')}
                            </p>
                            <p
                              className={cn(
                                'text-xs mt-1',
                                violation.severity === 'ERROR'
                                  ? 'text-red-600 dark:text-red-500'
                                  : 'text-yellow-600 dark:text-yellow-500'
                              )}
                            >
                              {violation.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                Risk validation pending...
              </div>
            )}
          </div>

          <Separator />

          {/* Portfolio Impact */}
          {portfolioImpact && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="size-4" />
                Portfolio Impact
              </h3>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Current Portfolio Value</p>
                  <p className="text-base font-semibold">
                    ₹{portfolioImpact.currentValue.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">New Investment</p>
                  <p className="text-base font-semibold">
                    ₹{portfolioImpact.newInvestment.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">New Total Value</p>
                  <p className="text-base font-semibold">
                    ₹{portfolioImpact.newTotalValue.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">New Exposure</p>
                  <p className="text-base font-semibold">
                    {portfolioImpact.newExposurePercent.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Max Portfolio Gain</p>
                  <p className="text-base font-semibold text-green-600">
                    +₹{portfolioImpact.maxPotentialProfit.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Max Portfolio Loss</p>
                  <p className="text-base font-semibold text-red-600">
                    -₹{portfolioImpact.maxPotentialLoss.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                You have {portfolioImpact.existingPositions} existing position
                {portfolioImpact.existingPositions !== 1 ? 's' : ''} in your portfolio
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            className={cn(!canConfirm && 'opacity-50 cursor-not-allowed')}
          >
            {isLoading ? 'Executing...' : 'Confirm Trade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
