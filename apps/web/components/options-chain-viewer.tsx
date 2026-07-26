/**
 * OptionsChainViewer Component
 * 
 * Displays options chain in tabular format with Call and Put columns.
 * Features ATM/near-ATM highlighting, ITM/OTM color coding, and liquidity warnings.
 * 
 * Task 73.2: Added Paper Trade button per contract with trade confirmation dialog
 * 
 * Requirements covered: 13.2, 9.1, 18.2
 * 
 * Columns:
 * - Call: LTP, OI, ChangeOI, Vol, IV, Bid/Ask, Actions
 * - Strike (center, highlighted for ATM)
 * - Put: Actions, Bid/Ask, LTP, OI, ChangeOI, Vol, IV
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, RefreshCw, AlertTriangle, ShoppingCart } from 'lucide-react';
import { apiClient, OptionsChainResponse } from '@/lib/api-client';
import { DEFAULT_USER_ID } from '@/lib/constants';
import { OptionsTradeConfirmationDialog } from './options-trade-confirmation-dialog';

export interface OptionsChainViewerProps {
  underlying: 'NIFTY' | 'BANKNIFTY';
  expiryDate?: string;
  initialData?: OptionsChainResponse;
  onDataFetch?: (data: OptionsChainResponse) => void;
  onError?: (error: Error) => void;
  userId?: string; // Required for paper trading
}

interface StrikeData {
  strikePrice: number;
  call: {
    ltp: number;
    volume: number;
    oi: number;
    iv: number;
    bid?: number;
    ask?: number;
    changeOI?: number;
  };
  put: {
    ltp: number;
    volume: number;
    oi: number;
    iv: number;
    bid?: number;
    ask?: number;
    changeOI?: number;
  };
}

/**
 * OptionsChainViewer - Tabular options chain display
 * 
 * Features:
 * - Call and Put columns side-by-side
 * - ATM strike highlighted with bold text
 * - Near-ATM strikes (±3) with light highlight
 * - ITM/OTM color coding
 * - Liquidity warnings (wide spreads, low volume, low OI)
 * - Manual "FETCH CHAIN" button (NO auto-refresh)
 */
export function OptionsChainViewer({
  underlying,
  expiryDate,
  initialData,
  onDataFetch,
  onError,
  userId = DEFAULT_USER_ID,
}: OptionsChainViewerProps) {
  const [chainData, setChainData] = useState<OptionsChainResponse | null>(initialData || null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<{
    optionType: 'CALL' | 'PUT';
    strikePrice: number;
    ltp: number;
    bid?: number;
    ask?: number;
    volume: number;
    oi: number;
    iv: number;
  } | null>(null);

  const handleFetchChain = async () => {
    setIsFetching(true);
    setFetchError(null);

    try {
      const data = await apiClient.getOptionsChain(underlying, expiryDate);
      setChainData(data);

      if (onDataFetch) {
        onDataFetch(data);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch options chain';
      setFetchError(errorMessage);

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
    } finally {
      setIsFetching(false);
    }
  };

  const handleTradeClick = (
    optionType: 'CALL' | 'PUT',
    strikePrice: number,
    ltp: number,
    bid: number | undefined,
    ask: number | undefined,
    volume: number,
    oi: number,
    iv: number
  ) => {
    setSelectedTrade({
      optionType,
      strikePrice,
      ltp,
      bid,
      ask,
      volume,
      oi,
      iv,
    });
    setTradeDialogOpen(true);
  };

  const handleTradeSuccess = () => {
    // Optionally refresh chain data or show success notification
    // For now, we just close the dialog
  };

  const handleTradeError = (error: Error) => {
    // Optionally show error notification
    console.error('Trade execution failed:', error);
  };

  // Calculate ATM strike (closest to spot price)
  const getATMStrike = (): number | null => {
    if (!chainData) return null;
    
    const strikes = chainData.strikes.map((s) => s.strikePrice);
    const spotPrice = chainData.spotPrice;
    
    let closestStrike = strikes[0];
    let minDiff = Math.abs(strikes[0] - spotPrice);
    
    for (const strike of strikes) {
      const diff = Math.abs(strike - spotPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closestStrike = strike;
      }
    }
    
    return closestStrike;
  };

  // Check if strike is near ATM (±3 strikes)
  const isNearATM = (strikePrice: number, atmStrike: number | null): boolean => {
    if (!atmStrike || !chainData) return false;
    
    const strikes = chainData.strikes.map((s) => s.strikePrice).sort((a, b) => a - b);
    const atmIndex = strikes.indexOf(atmStrike);
    const strikeIndex = strikes.indexOf(strikePrice);
    
    if (atmIndex === -1 || strikeIndex === -1) return false;
    
    const distance = Math.abs(strikeIndex - atmIndex);
    return distance > 0 && distance <= 3;
  };

  // Check if option is ITM (In The Money)
  const isITM = (strikePrice: number, spotPrice: number, optionType: 'CALL' | 'PUT'): boolean => {
    if (optionType === 'CALL') {
      return strikePrice < spotPrice;
    } else {
      return strikePrice > spotPrice;
    }
  };

  // Check liquidity warnings
  const getLiquidityWarnings = (strike: StrikeData, optionType: 'CALL' | 'PUT'): string[] => {
    const warnings: string[] = [];
    const option = optionType === 'CALL' ? strike.call : strike.put;
    
    // Low volume warning
    if (option.volume < 100) {
      warnings.push('Low Volume');
    }
    
    // Low OI warning
    if (option.oi < 500) {
      warnings.push('Low OI');
    }
    
    // Wide spread warning (if bid/ask available)
    if (option.bid !== undefined && option.ask !== undefined && option.ltp > 0) {
      const spread = ((option.ask - option.bid) / option.ltp) * 100;
      if (spread > 5) {
        warnings.push('Wide Spread');
      }
    }
    
    return warnings;
  };

  const atmStrike = getATMStrike();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{underlying} Options Chain</CardTitle>
        <CardDescription>
          {chainData ? (
            <>
              Spot Price: ₹{chainData.spotPrice.toFixed(2)}
              {chainData.expiryDate && ` | Expiry: ${chainData.expiryDate}`}
            </>
          ) : (
            'Click "FETCH CHAIN" to load options data'
          )}
        </CardDescription>
        <div className="mt-4">
          <Button
            onClick={handleFetchChain}
            disabled={isFetching}
            variant="outline"
          >
            {isFetching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                FETCH CHAIN
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Error Display */}
        {fetchError && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 rounded-lg">
            <p className="text-sm font-medium">{fetchError}</p>
          </div>
        )}

        {/* Options Chain Table */}
        {chainData ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Call Headers */}
                  <TableHead className="text-right bg-green-50 dark:bg-green-950">Call LTP</TableHead>
                  <TableHead className="text-right bg-green-50 dark:bg-green-950">Call OI</TableHead>
                  <TableHead className="text-right bg-green-50 dark:bg-green-950">Call ΔOI</TableHead>
                  <TableHead className="text-right bg-green-50 dark:bg-green-950">Call Vol</TableHead>
                  <TableHead className="text-right bg-green-50 dark:bg-green-950">Call IV</TableHead>
                  <TableHead className="text-right bg-green-50 dark:bg-green-950">Call Bid/Ask</TableHead>
                  <TableHead className="text-center bg-green-50 dark:bg-green-950">Actions</TableHead>
                  
                  {/* Strike Header */}
                  <TableHead className="text-center font-bold bg-blue-100 dark:bg-blue-900">Strike</TableHead>
                  
                  {/* Put Headers */}
                  <TableHead className="text-center bg-red-50 dark:bg-red-950">Actions</TableHead>
                  <TableHead className="text-left bg-red-50 dark:bg-red-950">Put Bid/Ask</TableHead>
                  <TableHead className="text-left bg-red-50 dark:bg-red-950">Put LTP</TableHead>
                  <TableHead className="text-left bg-red-50 dark:bg-red-950">Put OI</TableHead>
                  <TableHead className="text-left bg-red-50 dark:bg-red-950">Put ΔOI</TableHead>
                  <TableHead className="text-left bg-red-50 dark:bg-red-950">Put Vol</TableHead>
                  <TableHead className="text-left bg-red-50 dark:bg-red-950">Put IV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chainData.strikes.map((strike) => {
                  const isATM = strike.strikePrice === atmStrike;
                  const nearATM = isNearATM(strike.strikePrice, atmStrike);
                  const callITM = isITM(strike.strikePrice, chainData.spotPrice, 'CALL');
                  const putITM = isITM(strike.strikePrice, chainData.spotPrice, 'PUT');
                  const callWarnings = getLiquidityWarnings(strike, 'CALL');
                  const putWarnings = getLiquidityWarnings(strike, 'PUT');

                  // Row background based on ATM proximity
                  const rowClass = isATM
                    ? 'bg-yellow-100 dark:bg-yellow-950'
                    : nearATM
                    ? 'bg-slate-50 dark:bg-slate-900'
                    : '';

                  return (
                    <TableRow key={strike.strikePrice} className={rowClass}>
                      {/* Call Data */}
                      <TableCell className={`text-right ${callITM ? 'font-semibold text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                        <div className="flex flex-col items-end gap-1">
                          <span>₹{strike.call.ltp.toFixed(2)}</span>
                          {callWarnings.length > 0 && (
                            <div className="flex gap-1">
                              {callWarnings.map((warning, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs bg-yellow-100 dark:bg-yellow-900"
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {warning}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right ${callITM ? 'font-medium' : ''}`}>
                        {strike.call.oi.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {strike.call.changeOI !== undefined ? (
                          <span className={strike.call.changeOI > 0 ? 'text-green-600' : strike.call.changeOI < 0 ? 'text-red-600' : ''}>
                            {strike.call.changeOI > 0 ? '+' : ''}{strike.call.changeOI.toLocaleString()}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {strike.call.volume.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {strike.call.iv.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {strike.call.bid !== undefined && strike.call.ask !== undefined ? (
                          <span>
                            {strike.call.bid.toFixed(2)} / {strike.call.ask.toFixed(2)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>

                      {/* Call Actions */}
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs bg-green-50 hover:bg-green-100 dark:bg-green-950 dark:hover:bg-green-900"
                          onClick={() =>
                            handleTradeClick(
                              'CALL',
                              strike.strikePrice,
                              strike.call.ltp,
                              strike.call.bid,
                              strike.call.ask,
                              strike.call.volume,
                              strike.call.oi,
                              strike.call.iv
                            )
                          }
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Buy
                        </Button>
                      </TableCell>

                      {/* Strike Price */}
                      <TableCell className={`text-center ${isATM ? 'font-bold text-lg' : 'font-medium'}`}>
                        {strike.strikePrice}
                        {isATM && (
                          <Badge className="ml-2 bg-yellow-500">ATM</Badge>
                        )}
                      </TableCell>

                      {/* Put Actions */}
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900"
                          onClick={() =>
                            handleTradeClick(
                              'PUT',
                              strike.strikePrice,
                              strike.put.ltp,
                              strike.put.bid,
                              strike.put.ask,
                              strike.put.volume,
                              strike.put.oi,
                              strike.put.iv
                            )
                          }
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Buy
                        </Button>
                      </TableCell>

                      {/* Put Data */}
                      <TableCell className="text-left text-sm">
                        {strike.put.bid !== undefined && strike.put.ask !== undefined ? (
                          <span>
                            {strike.put.bid.toFixed(2)} / {strike.put.ask.toFixed(2)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className={`text-left ${putITM ? 'font-semibold text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>
                        <div className="flex flex-col items-start gap-1">
                          <span>₹{strike.put.ltp.toFixed(2)}</span>
                          {putWarnings.length > 0 && (
                            <div className="flex gap-1">
                              {putWarnings.map((warning, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs bg-yellow-100 dark:bg-yellow-900"
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {warning}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={`text-left ${putITM ? 'font-medium' : ''}`}>
                        {strike.put.oi.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-left">
                        {strike.put.changeOI !== undefined ? (
                          <span className={strike.put.changeOI > 0 ? 'text-green-600' : strike.put.changeOI < 0 ? 'text-red-600' : ''}>
                            {strike.put.changeOI > 0 ? '+' : ''}{strike.put.changeOI.toLocaleString()}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-left">
                        {strike.put.volume.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-left">
                        {strike.put.iv.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No options chain data loaded.</p>
            <p className="text-sm mt-2">Click &quot;FETCH CHAIN&quot; to load the latest data.</p>
          </div>
        )}

        {/* Legend */}
        {chainData && (
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <h4 className="text-sm font-semibold mb-3">Legend</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="font-bold">ATM:</span> At-The-Money strike
              </div>
              <div>
                <span className="font-semibold text-green-700 dark:text-green-400">Bold Green:</span> ITM Calls
              </div>
              <div>
                <span className="font-semibold text-red-700 dark:text-red-400">Bold Red:</span> ITM Puts
              </div>
              <div>
                <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Warning
                </Badge>
                <span className="ml-2">Liquidity Issue</span>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <p>• Low Volume: &lt;100 contracts</p>
              <p>• Low OI: &lt;500 contracts</p>
              <p>• Wide Spread: Bid-Ask spread &gt;5% of LTP</p>
            </div>
          </div>
        )}
      </CardContent>

      {/* Trade Confirmation Dialog */}
      {selectedTrade && chainData && (
        <OptionsTradeConfirmationDialog
          open={tradeDialogOpen}
          onOpenChange={setTradeDialogOpen}
          contractDetails={{
            underlying,
            strikePrice: selectedTrade.strikePrice,
            optionType: selectedTrade.optionType,
            expiryDate: chainData.expiryDate,
            ltp: selectedTrade.ltp,
            bid: selectedTrade.bid,
            ask: selectedTrade.ask,
            volume: selectedTrade.volume,
            oi: selectedTrade.oi,
            iv: selectedTrade.iv,
          }}
          action="BUY"
          quantity={1} // Default to 1 lot
          userId={userId}
          onSuccess={handleTradeSuccess}
          onError={handleTradeError}
        />
      )}
    </Card>
  );
}
