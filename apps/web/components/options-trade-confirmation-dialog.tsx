/**
 * OptionsTradeConfirmationDialog Component
 * 
 * Task 73.2: Trade confirmation dialog for options paper trading
 * 
 * Displays:
 * - Contract details (symbol, strike, type, expiry)
 * - Trade details (action, quantity, price, P&L estimates)
 * - Risk metrics (position value, max loss, break-even)
 * - Liquidity warnings (wide spread, low volume, low OI)
 * 
 * On confirmation, calls POST /api/trade/paper/option
 * Shows success message with trade ID or error message
 * 
 * **CRITICAL**: NO live trade button - paper trading ONLY for options
 * 
 * Requirements covered: 9.1, 13.2, 18.2
 */

import { useState } from 'react';
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
import { AlertTriangle, TrendingUp, TrendingDown, Shield, Loader2 } from 'lucide-react';
import { apiClient, PaperOptionTradeRequest, TradeResult } from '@/lib/api-client';

export interface OptionsTradeConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractDetails: {
    underlying: 'NIFTY' | 'BANKNIFTY';
    strikePrice: number;
    optionType: 'CALL' | 'PUT';
    expiryDate: string;
    ltp: number;
    bid?: number;
    ask?: number;
    volume: number;
    oi: number;
    iv: number;
  };
  action: 'BUY' | 'SELL';
  quantity: number;
  userId: string;
  onSuccess?: (result: TradeResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Check if contract has liquidity warnings
 */
function getLiquidityWarnings(contract: {
  volume: number;
  oi: number;
  ltp: number;
  bid?: number;
  ask?: number;
}): { warning: string; severity: 'WARNING' | 'CRITICAL' }[] {
  const warnings: { warning: string; severity: 'WARNING' | 'CRITICAL' }[] = [];

  // Low volume
  if (contract.volume < 100) {
    warnings.push({
      warning: `Low Volume (${contract.volume} contracts)`,
      severity: contract.volume < 50 ? 'CRITICAL' : 'WARNING',
    });
  }

  // Low OI
  if (contract.oi < 500) {
    warnings.push({
      warning: `Low Open Interest (${contract.oi.toLocaleString()} contracts)`,
      severity: contract.oi < 250 ? 'CRITICAL' : 'WARNING',
    });
  }

  // Wide spread
  if (contract.bid !== undefined && contract.ask !== undefined && contract.ltp > 0) {
    const spread = ((contract.ask - contract.bid) / contract.ltp) * 100;
    if (spread > 5) {
      warnings.push({
        warning: `Wide Bid-Ask Spread (${spread.toFixed(2)}%)`,
        severity: spread > 10 ? 'CRITICAL' : 'WARNING',
      });
    }
  }

  return warnings;
}

export function OptionsTradeConfirmationDialog({
  open,
  onOpenChange,
  contractDetails,
  action,
  quantity,
  userId,
  onSuccess,
  onError,
}: OptionsTradeConfirmationDialogProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    message: string;
    tradeId?: string;
  } | null>(null);

  const liquidityWarnings = getLiquidityWarnings(contractDetails);
  const hasCriticalWarnings = liquidityWarnings.some((w) => w.severity === 'CRITICAL');

  // Calculate trade metrics
  const lotSize = contractDetails.underlying === 'NIFTY' ? 50 : 25; // Typical lot sizes
  const actualQuantity = quantity * lotSize;
  const positionValue = contractDetails.ltp * actualQuantity;
  const maxLoss = action === 'BUY' ? positionValue : Infinity;
  
  // Break-even for options
  const breakEven =
    action === 'BUY'
      ? contractDetails.strikePrice + contractDetails.ltp
      : contractDetails.strikePrice - contractDetails.ltp;

  const handleConfirm = async () => {
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const tradeRequest: PaperOptionTradeRequest = {
        userId,
        symbol: contractDetails.underlying,
        strikePrice: contractDetails.strikePrice,
        optionType: contractDetails.optionType,
        expiry: contractDetails.expiryDate,
        action,
        quantity: actualQuantity,
        price: contractDetails.ltp,
        bidAskSpread: contractDetails.bid && contractDetails.ask 
          ? contractDetails.ask - contractDetails.bid 
          : undefined,
        openInterest: contractDetails.oi,
        impliedVolatility: contractDetails.iv,
      };

      const result = await apiClient.executePaperOptionTrade(tradeRequest);

      if (result.status === 'EXECUTED') {
        setExecutionResult({
          success: true,
          message: 'Paper trade executed successfully!',
          tradeId: result.tradeId,
        });

        if (onSuccess) {
          onSuccess(result);
        }

        // Close dialog after 2 seconds
        setTimeout(() => {
          onOpenChange(false);
          setExecutionResult(null);
        }, 2000);
      } else {
        throw new Error(result.error || 'Trade execution failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setExecutionResult({
        success: false,
        message: errorMessage,
      });

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setExecutionResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'BUY' ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            Confirm Paper Options Trade
          </DialogTitle>
          <DialogDescription>
            Review contract details and risk metrics before executing this paper trade.
            <br />
            <span className="text-xs text-muted-foreground">
              This is a simulated trade (paper trading only). No real money involved.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contract Details */}
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Contract Details
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Symbol:</span>
                <p className="font-medium">{contractDetails.underlying}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <p className="font-medium">
                  <Badge variant={contractDetails.optionType === 'CALL' ? 'default' : 'destructive'}>
                    {contractDetails.optionType}
                  </Badge>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Strike Price:</span>
                <p className="font-medium">₹{contractDetails.strikePrice.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Expiry:</span>
                <p className="font-medium">{contractDetails.expiryDate}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Premium (LTP):</span>
                <p className="font-medium">₹{contractDetails.ltp.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">IV:</span>
                <p className="font-medium">{contractDetails.iv.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          {/* Trade Details */}
          <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-900">
            <h3 className="text-sm font-semibold mb-3">Trade Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Action:</span>
                <p className={`font-bold ${action === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                  {action} ({action === 'BUY' ? 'Go Long' : 'Go Short'})
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Quantity:</span>
                <p className="font-medium">{quantity} lots ({actualQuantity} contracts)</p>
              </div>
              <div>
                <span className="text-muted-foreground">Position Value:</span>
                <p className="font-bold">₹{positionValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Max Loss:</span>
                <p className="font-bold text-red-600">
                  {maxLoss === Infinity
                    ? 'Unlimited'
                    : `₹${maxLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Break-even:</span>
                <p className="font-medium">₹{breakEven.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Liquidity Warnings */}
          {liquidityWarnings.length > 0 && (
            <div
              className={`rounded-lg border p-4 ${
                hasCriticalWarnings
                  ? 'border-red-500 bg-red-50 dark:bg-red-950'
                  : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
              }`}
            >
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle
                  className={`h-4 w-4 ${
                    hasCriticalWarnings ? 'text-red-600' : 'text-yellow-600'
                  }`}
                />
                Liquidity Warnings
              </h3>
              <ul className="space-y-2">
                {liquidityWarnings.map((warning, idx) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    <Badge
                      variant="outline"
                      className={
                        warning.severity === 'CRITICAL'
                          ? 'bg-red-100 dark:bg-red-900'
                          : 'bg-yellow-100 dark:bg-yellow-900'
                      }
                    >
                      {warning.severity}
                    </Badge>
                    <span>{warning.warning}</span>
                  </li>
                ))}
              </ul>
              {hasCriticalWarnings && (
                <p className="text-xs mt-3 text-red-700 dark:text-red-300">
                  ⚠️ This contract has critical liquidity issues. Execution may be difficult and slippage may be high.
                </p>
              )}
            </div>
          )}

          {/* Execution Result */}
          {executionResult && (
            <div
              className={`rounded-lg border p-4 ${
                executionResult.success
                  ? 'border-green-500 bg-green-50 dark:bg-green-950'
                  : 'border-red-500 bg-red-50 dark:bg-red-950'
              }`}
            >
              <p className="text-sm font-medium">{executionResult.message}</p>
              {executionResult.tradeId && (
                <p className="text-xs mt-2 text-muted-foreground">
                  Trade ID: {executionResult.tradeId}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isExecuting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isExecuting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              <>Confirm Paper Trade</>
            )}
          </Button>
        </DialogFooter>

        {/* Critical Notice */}
        <div className="text-xs text-center text-muted-foreground border-t pt-4">
          <p className="font-semibold">⚠️ PAPER TRADING ONLY</p>
          <p>This is a simulated trade. Live trading is NOT available for options.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
