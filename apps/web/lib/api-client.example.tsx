/**
 * Example usage of API Client with React components
 *
 * This file demonstrates how to use the API client in various scenarios:
 * - Submitting prompts
 * - Fetching portfolio data
 * - Executing trades
 * - Using with TanStack Query
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './api-client';
import type { PromptResponse, Portfolio, TradeResult } from './api-client';

// ============================================================================
// Example 1: Submit Prompt Component
// ============================================================================

export function PromptSubmitExample() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<PromptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setError(null);
      const response = await apiClient.submitPrompt(prompt);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Submit Prompt</h2>
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., Find swing trade in RELIANCE"
        className="border p-2 rounded w-full mb-2"
      />
      <button onClick={handleSubmit} className="bg-blue-500 text-white px-4 py-2 rounded">
        Submit
      </button>

      {error && <div className="text-red-500 mt-2">{error}</div>}

      {result && (
        <div className="mt-4">
          <h3 className="font-bold">Recommendation:</h3>
          <p>Action: {result.recommendation.action}</p>
          <p>Symbol: {result.recommendation.symbol}</p>
          <p>Entry: ₹{result.recommendation.entryPrice}</p>
          <p>Target: ₹{result.recommendation.target}</p>
          <p>Stop Loss: ₹{result.recommendation.stopLoss}</p>
          <p>Confidence: {(result.recommendation.confidence * 100).toFixed(0)}%</p>
          <p className="mt-2">{result.recommendation.reasoning}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 2: Portfolio Display with TanStack Query
// ============================================================================

export function PortfolioExample({ userId }: { userId: string }) {
  const { data, isLoading, error, refetch } = useQuery<Portfolio>({
    queryKey: ['portfolio', userId],
    queryFn: () => apiClient.getPortfolio(userId),
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  if (isLoading) return <div>Loading portfolio...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Portfolio</h2>
        <button onClick={() => refetch()} className="bg-gray-200 px-3 py-1 rounded text-sm">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border p-4 rounded">
          <p className="text-sm text-gray-600">Total Value</p>
          <p className="text-2xl font-bold">₹{data.totalValue.toLocaleString()}</p>
        </div>
        <div className="border p-4 rounded">
          <p className="text-sm text-gray-600">Total P&L</p>
          <p
            className={`text-2xl font-bold ${data.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            ₹{data.totalPnL.toLocaleString()}
          </p>
        </div>
        <div className="border p-4 rounded">
          <p className="text-sm text-gray-600">Daily P&L</p>
          <p
            className={`text-2xl font-bold ${data.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            ₹{data.dailyPnL.toLocaleString()}
          </p>
        </div>
      </div>

      <h3 className="font-bold mb-2">Open Positions ({data.positions.length})</h3>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Symbol</th>
            <th className="text-right p-2">Qty</th>
            <th className="text-right p-2">Avg Price</th>
            <th className="text-right p-2">Current Price</th>
            <th className="text-right p-2">P&L</th>
            <th className="text-right p-2">P&L %</th>
          </tr>
        </thead>
        <tbody>
          {data.positions.map((pos) => (
            <tr key={pos.id} className="border-b">
              <td className="p-2">{pos.symbol}</td>
              <td className="text-right p-2">{pos.quantity}</td>
              <td className="text-right p-2">₹{pos.averagePrice.toFixed(2)}</td>
              <td className="text-right p-2">₹{pos.currentPrice.toFixed(2)}</td>
              <td
                className={`text-right p-2 ${pos.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                ₹{pos.unrealizedPnL.toFixed(2)}
              </td>
              <td
                className={`text-right p-2 ${pos.unrealizedPnLPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {pos.unrealizedPnLPercent.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6">
        <h3 className="font-bold mb-2">Portfolio Metrics</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Exposure</p>
            <p className="font-bold">{(data.metrics.totalExposure * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Win Rate</p>
            <p className="font-bold">{data.metrics.winRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Avg Win</p>
            <p className="font-bold text-green-600">₹{data.metrics.avgWin.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Avg Loss</p>
            <p className="font-bold text-red-600">₹{data.metrics.avgLoss.toFixed(0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example 3: Execute Paper Trade with Mutation
// ============================================================================

export function PaperTradeExample({
  userId,
  recommendation,
}: {
  userId: string;
  recommendation: PromptResponse['recommendation'];
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (quantity: number) =>
      apiClient.executePaperTrade({
        userId,
        symbol: recommendation.symbol,
        action: recommendation.action === 'HOLD' ? 'BUY' : recommendation.action,
        quantity,
        price: recommendation.entryPrice,
        stopLoss: recommendation.stopLoss,
        target: recommendation.target,
      }),
    onSuccess: () => {
      // Invalidate portfolio query to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['portfolio', userId] });
    },
  });

  const [quantity, setQuantity] = useState(10);

  if (recommendation.action === 'HOLD') {
    return <div className="p-4 text-gray-600">No trade action recommended</div>;
  }

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Execute Paper Trade</h3>
      <div className="mb-4">
        <label className="block text-sm mb-1">Quantity:</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="border p-2 rounded w-full"
        />
      </div>

      <button
        onClick={() => mutation.mutate(quantity)}
        disabled={mutation.isPending}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
      >
        {mutation.isPending ? 'Executing...' : `Execute Paper Trade (${recommendation.action})`}
      </button>

      {mutation.isError && <div className="text-red-500 mt-2">Error: {mutation.error.message}</div>}

      {mutation.isSuccess && (
        <div className="text-green-600 mt-2">✓ Trade executed! ID: {mutation.data.tradeId}</div>
      )}
    </div>
  );
}

// ============================================================================
// Example 4: Market Data Chart with Real-time Updates
// ============================================================================

export function MarketDataExample({ symbol }: { symbol: string }) {
  const [timeframe, setTimeframe] = useState<'1d' | '5m' | '1m'>('1d');

  const { data, isLoading, error } = useQuery({
    queryKey: ['market', symbol, timeframe],
    queryFn: () => apiClient.getMarketData(symbol, timeframe),
    staleTime: 60000, // Cache for 60 seconds
    refetchInterval: 60000, // Auto-refresh every minute
  });

  if (isLoading) return <div>Loading market data...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{symbol} Market Data</h2>
        <div className="flex gap-2">
          {(['1d', '5m', '1m'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded ${
                timeframe === tf ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="border rounded p-4">
        <p className="text-sm text-gray-600">Latest Candle</p>
        {data.data.length > 0 && (
          <div className="grid grid-cols-5 gap-4 mt-2">
            <div>
              <p className="text-xs text-gray-500">Open</p>
              <p className="font-bold">₹{data.data[data.data.length - 1].open}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">High</p>
              <p className="font-bold">₹{data.data[data.data.length - 1].high}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Low</p>
              <p className="font-bold">₹{data.data[data.data.length - 1].low}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Close</p>
              <p className="font-bold">₹{data.data[data.data.length - 1].close}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Volume</p>
              <p className="font-bold">{data.data[data.data.length - 1].volume.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-600 mt-4">Showing {data.data.length} candles</p>
    </div>
  );
}

// ============================================================================
// Example 5: Risk Validation Before Trade
// ============================================================================

export function RiskValidationExample({
  userId,
  recommendation,
}: {
  userId: string;
  recommendation: PromptResponse['recommendation'];
}) {
  const [quantity, setQuantity] = useState(10);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['risk-validation', recommendation.symbol, quantity],
    queryFn: () =>
      apiClient.validateTrade({
        userId,
        symbol: recommendation.symbol,
        action: recommendation.action === 'HOLD' ? 'BUY' : recommendation.action,
        quantity,
        price: recommendation.entryPrice,
        stopLoss: recommendation.stopLoss,
        target: recommendation.target,
      }),
    enabled: false, // Don't auto-fetch, only on button click
  });

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Risk Validation</h3>

      <div className="mb-4">
        <label className="block text-sm mb-1">Quantity to validate:</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="border p-2 rounded w-full"
        />
      </div>

      <button
        onClick={() => refetch()}
        disabled={isLoading}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
      >
        {isLoading ? 'Validating...' : 'Validate Trade'}
      </button>

      {data && (
        <div className="mt-4">
          {data.passed ? (
            <div className="text-green-600 font-bold">✓ Trade passed all risk checks</div>
          ) : (
            <div>
              <div className="text-red-600 font-bold mb-2">✗ Trade failed risk validation</div>
              {data.violations.map((violation, idx) => (
                <div
                  key={idx}
                  className={`p-2 border rounded mb-2 ${
                    violation.severity === 'ERROR' ? 'border-red-500' : 'border-yellow-500'
                  }`}
                >
                  <p className="font-bold">{violation.rule}</p>
                  <p className="text-sm">{violation.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
