'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portfolioKeys } from '@/lib/query-keys';
import { apiClient } from '@/lib/api-client';
import { kotakApi } from '@/lib/kotak-api';
import { PortfolioTable } from '@/components/portfolio-table';
import { KotakOrdersPanel } from '@/components/kotak-orders-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wallet, TrendingUp, TrendingDown } from 'lucide-react';

import { DEFAULT_USER_ID } from '@/lib/constants';


function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getPnLColorClass(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-500';
  if (value < 0) return 'text-red-600 dark:text-red-500';
  return 'text-muted-foreground';
}

interface KotakHolding {
  instrumentName: string;
  symbol: string;
  displaySymbol: string;
  quantity: number;
  averagePrice: number;
  closingPrice: number;
  mktValue: number;
  holdingCost: number;
  unrealisedGainLoss: number;
  exchangeSegment: string;
  sellableQuantity: number;
  instrumentType: string;
  sector: string;
}

interface KotakPosition {
  trdSym: string;
  sym: string;
  qty: string;
  buyAmt: string;
  sellAmt: string;
  prod: string;
  exSeg: string;
  flBuyQty: string;
  flSellQty: string;
}

export default function PortfolioPage() {
  const [kotakConnected, setKotakConnected] = useState(false);
  const [holdings, setHoldings] = useState<KotakHolding[]>([]);
  const [positions, setPositions] = useState<KotakPosition[]>([]);
  const [isLoadingKotak, setIsLoadingKotak] = useState(false);
  const [kotakError, setKotakError] = useState<string | null>(null);
  const [limits, setLimits] = useState<any>(null);

  // Check if Kotak is connected
  useEffect(() => {
    const sessionId = kotakApi.getSessionId();
    setKotakConnected(!!sessionId);
  }, []);

  // Fetch Kotak data
  const fetchKotakData = useCallback(async () => {
    if (!kotakApi.getSessionId()) return;

    setIsLoadingKotak(true);
    setKotakError(null);

    try {
      const [holdingsRes, positionsRes, limitsRes] = await Promise.allSettled([
        kotakApi.getHoldings(),
        kotakApi.getPositions(),
        kotakApi.getLimits(),
      ]);

      if (holdingsRes.status === 'fulfilled') {
        const data = holdingsRes.value?.data || holdingsRes.value || [];
        setHoldings(Array.isArray(data) ? data : []);
      }

      if (positionsRes.status === 'fulfilled') {
        const data = positionsRes.value?.data || positionsRes.value || [];
        setPositions(Array.isArray(data) ? data : []);
      }

      if (limitsRes.status === 'fulfilled') {
        setLimits(limitsRes.value);
      }
    } catch (err: any) {
      setKotakError(err.message || 'Failed to fetch Kotak data');
    } finally {
      setIsLoadingKotak(false);
    }
  }, []);

  useEffect(() => {
    if (kotakConnected) {
      fetchKotakData();
    }
  }, [kotakConnected, fetchKotakData]);

  // Handle Add/Sell actions on holdings
  const [orderMsg, setOrderMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleHoldingAction = async (tradingSymbol: string, tt: 'B' | 'S', symbolName: string, sellableQty?: number) => {
    const action = tt === 'B' ? 'BUY (Add)' : 'SELL';
    const defaultQty = tt === 'S' && sellableQty ? sellableQty : 1;
    const qty = window.prompt(`${action} ${symbolName}\n\nQuantity:${tt === 'S' ? ` (Sellable: ${sellableQty})` : ''}`, String(defaultQty));
    if (!qty || isNaN(Number(qty)) || Number(qty) <= 0) return;

    // Check if market is open (9:15 AM - 3:30 PM IST, weekdays)
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hours = ist.getHours();
    const mins = ist.getMinutes();
    const isWeekday = ist.getDay() >= 1 && ist.getDay() <= 5;
    const isMarketOpen = isWeekday && ((hours === 9 && mins >= 15) || (hours > 9 && hours < 15) || (hours === 15 && mins <= 30));

    const orderType = isMarketOpen ? 'MKT' : 'L';
    const isAmo = !isMarketOpen;
    let price = '0';

    if (!isMarketOpen) {
      const holding = holdings.find(h => (h.displaySymbol || h.symbol) === symbolName);
      const suggestedPrice = holding?.closingPrice?.toFixed(2) || '0';
      const inputPrice = window.prompt(
        `Market is closed. Placing AMO Limit Order.\n\nPrice for ${symbolName}:`,
        suggestedPrice
      );
      if (!inputPrice) return;
      price = inputPrice;
    }

    const confirmed = window.confirm(
      `⚠️ ${isAmo ? 'AMO ' : ''}LIVE ORDER\n\n${action} ${symbolName}\nQty: ${qty}\nType: ${isAmo ? 'AMO Limit' : 'Market'} ${price !== '0' ? `@ ₹${price}` : ''}\nProduct: CNC\n\nThis uses REAL money. Continue?`
    );
    if (!confirmed) return;

    try {
      const result = await kotakApi.placeOrder({
        am: isAmo ? 'YES' : 'NO',
        dq: '0', es: 'nse_cm', mp: '0',
        pc: 'CNC', pf: 'N',
        pr: price,
        pt: orderType,
        qt: qty, rt: 'DAY', tp: '0',
        ts: tradingSymbol, tt,
      });
      if (result?.stat === 'Ok' || result?.nOrdNo) {
        setOrderMsg({ type: 'success', text: `${action} order placed for ${symbolName}! Order ID: ${result.nOrdNo}` });
        setTimeout(fetchKotakData, 2000);
      } else {
        setOrderMsg({ type: 'error', text: result?.emsg || `${action} order failed` });
      }
    } catch (err: any) {
      setOrderMsg({ type: 'error', text: err.message || 'Order failed' });
    }
  };

  // Paper trading portfolio (fallback)
  const { data: portfolio, isLoading } = useQuery({
    queryKey: portfolioKeys.overview(),
    queryFn: () => apiClient.getPortfolio(DEFAULT_USER_ID),
    refetchInterval: 30000,
    staleTime: 10000,
    enabled: !kotakConnected,
  });

  // Calculate totals from Kotak holdings
  const totalMktValue = holdings.reduce((sum, h) => sum + (h.mktValue || 0), 0);
  const totalHoldingCost = holdings.reduce((sum, h) => sum + (h.holdingCost || 0), 0);
  const totalUnrealised = holdings.reduce((sum, h) => sum + (h.unrealisedGainLoss || 0), 0);
  const availableCash = limits?.Net ? parseFloat(limits.Net) : 0;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Portfolio</h1>
          <p className="text-muted-foreground">
            {kotakConnected
              ? 'Live portfolio from Kotak Neo'
              : 'Monitor your positions, track PnL, and manage your trades'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {kotakConnected && (
            <>
              <Badge variant="default" className="bg-green-600">Live — Kotak Neo</Badge>
              <Button variant="outline" size="sm" onClick={fetchKotakData} disabled={isLoadingKotak}>
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingKotak ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </>
          )}
          {!kotakConnected && (
            <Badge variant="secondary">Paper Trading Mode</Badge>
          )}
        </div>
      </div>

      {kotakError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {kotakError}
        </div>
      )}

      {orderMsg && (
        <div className={`mb-6 rounded-lg border p-4 text-sm ${
          orderMsg.type === 'success'
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {orderMsg.text}
          <button onClick={() => setOrderMsg(null)} className="ml-3 text-xs underline">dismiss</button>
        </div>
      )}

      {/* Summary Cards */}
      {kotakConnected ? (
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Portfolio Value</h3>
            </div>
            {isLoadingKotak ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <p className="text-3xl font-bold">{formatCurrency(totalMktValue)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">{holdings.length} holdings</p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Available Cash</h3>
            {isLoadingKotak ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <p className="text-3xl font-bold">{formatCurrency(availableCash)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">Net available margin</p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-2 mb-2">
              {totalUnrealised >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <h3 className="text-sm font-medium text-muted-foreground">Unrealised P&L</h3>
            </div>
            {isLoadingKotak ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <p className={`text-3xl font-bold ${getPnLColorClass(totalUnrealised)}`}>
                {formatCurrency(totalUnrealised)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {totalHoldingCost > 0 ? `${((totalUnrealised / totalHoldingCost) * 100).toFixed(2)}%` : '0%'} return
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Investment</h3>
            {isLoadingKotak ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <p className="text-3xl font-bold">{formatCurrency(totalHoldingCost)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">Total cost basis</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Value</h3>
            {isLoading ? <Skeleton className="h-10 w-32" /> : (
              <p className="text-3xl font-bold">{formatCurrency(portfolio?.totalValue || 0)}</p>
            )}
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Cash Balance</h3>
            {isLoading ? <Skeleton className="h-10 w-32" /> : (
              <p className="text-3xl font-bold">{formatCurrency(portfolio?.cashBalance || 0)}</p>
            )}
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Total P&L</h3>
            {isLoading ? <Skeleton className="h-10 w-32" /> : (
              <p className={`text-3xl font-bold ${getPnLColorClass(portfolio?.totalPnL || 0)}`}>
                {formatCurrency(portfolio?.totalPnL || 0)}
              </p>
            )}
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Daily P&L</h3>
            {isLoading ? <Skeleton className="h-10 w-32" /> : (
              <p className={`text-3xl font-bold ${getPnLColorClass(portfolio?.dailyPnL || 0)}`}>
                {formatCurrency(portfolio?.dailyPnL || 0)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Kotak Holdings Table */}
      {kotakConnected && holdings.length > 0 && (
        <div className="rounded-lg border bg-card mb-8">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Holdings ({holdings.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Symbol</th>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-right p-3 font-medium">Qty</th>
                  <th className="text-right p-3 font-medium">Avg Price</th>
                  <th className="text-right p-3 font-medium">LTP</th>
                  <th className="text-right p-3 font-medium">Current Value</th>
                  <th className="text-right p-3 font-medium">P&L</th>
                  <th className="text-right p-3 font-medium">P&L %</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, i) => {
                  const pnlPct = h.holdingCost > 0 ? (h.unrealisedGainLoss / h.holdingCost) * 100 : 0;
                  const tradingSymbol = `${h.displaySymbol || h.symbol}-EQ`;
                  return (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">{h.displaySymbol || h.symbol}</td>
                      <td className="p-3 text-muted-foreground text-xs">{h.instrumentName}</td>
                      <td className="p-3 text-right">{h.quantity}</td>
                      <td className="p-3 text-right">{formatCurrency(h.averagePrice)}</td>
                      <td className="p-3 text-right">{formatCurrency(h.closingPrice)}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(h.mktValue)}</td>
                      <td className={`p-3 text-right font-medium ${getPnLColorClass(h.unrealisedGainLoss)}`}>
                        {formatCurrency(h.unrealisedGainLoss)}
                      </td>
                      <td className={`p-3 text-right ${getPnLColorClass(pnlPct)}`}>
                        {pnlPct.toFixed(2)}%
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700"
                            onClick={() => handleHoldingAction(tradingSymbol, 'B', h.displaySymbol || h.symbol)}
                          >
                            Add
                          </button>
                          <button
                            className="px-2 py-1 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700"
                            onClick={() => handleHoldingAction(tradingSymbol, 'S', h.displaySymbol || h.symbol, h.sellableQuantity)}
                          >
                            Sell
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kotak Positions Table */}
      {kotakConnected && positions.length > 0 && (
        <div className="rounded-lg border bg-card mb-8">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Open Positions ({positions.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Symbol</th>
                  <th className="text-left p-3 font-medium">Product</th>
                  <th className="text-left p-3 font-medium">Exchange</th>
                  <th className="text-right p-3 font-medium">Net Qty</th>
                  <th className="text-right p-3 font-medium">Buy Amt</th>
                  <th className="text-right p-3 font-medium">Sell Amt</th>
                  <th className="text-right p-3 font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p, i) => {
                  const pnl = parseFloat(p.sellAmt || '0') - parseFloat(p.buyAmt || '0');
                  return (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">{p.trdSym || p.sym}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">{p.prod}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{p.exSeg}</td>
                      <td className="p-3 text-right">{p.qty}</td>
                      <td className="p-3 text-right">{formatCurrency(parseFloat(p.buyAmt || '0'))}</td>
                      <td className="p-3 text-right">{formatCurrency(parseFloat(p.sellAmt || '0'))}</td>
                      <td className={`p-3 text-right font-medium ${getPnLColorClass(pnl)}`}>
                        {formatCurrency(pnl)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state for Kotak connected but no data */}
      {kotakConnected && holdings.length === 0 && !isLoadingKotak && (
        <div className="rounded-lg border bg-card p-6 mb-8 text-center">
          <p className="text-muted-foreground">No holdings found in your Kotak Neo account.</p>
        </div>
      )}

      {/* Kotak Order Book with Cancel/Modify */}
      {kotakConnected && <div className="mb-8"><KotakOrdersPanel /></div>}

      {/* Paper trading positions table (when Kotak not connected) */}
      {!kotakConnected && (
        <PortfolioTable userId={DEFAULT_USER_ID} refetchInterval={30000} />
      )}

      {/* Info Card */}
      <div className="mt-6 rounded-lg border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">
          {kotakConnected ? (
            <><strong>Live Portfolio:</strong> Showing real holdings and positions from your Kotak Neo account. Data refreshes on demand.</>
          ) : (
            <><strong>Paper Trading:</strong> Connect Kotak Neo from the header to see your real portfolio. Paper trades are shown below.</>
          )}
        </p>
      </div>
    </div>
  );
}
