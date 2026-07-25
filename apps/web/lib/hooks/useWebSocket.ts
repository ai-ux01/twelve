/**
 * React Hooks for WebSocket Integration
 *
 * Provides easy-to-use hooks for components to subscribe to WebSocket events:
 * - usePriceUpdates: Subscribe to price updates for a symbol
 * - usePortfolioUpdates: Subscribe to portfolio PnL updates
 *
 * Requirements: 13.6
 * Task: 22.2
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { wsManager, PriceUpdate, PortfolioUpdate } from '../websocket';

// ============================================================================
// usePriceUpdates Hook
// ============================================================================

/**
 * Hook to subscribe to price updates for a symbol
 *
 * Automatically subscribes when component mounts and unsubscribes on unmount.
 * Updates are received in real-time and trigger re-renders.
 *
 * @param symbol - Stock symbol to subscribe to (e.g., 'RELIANCE')
 * @param enabled - Whether subscription is enabled (default: true)
 * @returns Latest price update for the symbol
 *
 * @example
 * ```tsx
 * function MyChart({ symbol }) {
 *   const priceUpdate = usePriceUpdates(symbol);
 *
 *   if (priceUpdate) {
 *     console.log('New price:', priceUpdate.price);
 *   }
 *
 *   return <div>Current: {priceUpdate?.price}</div>;
 * }
 * ```
 */
export function usePriceUpdates(
  symbol: string | null | undefined,
  enabled: boolean = true
): PriceUpdate | null {
  const [priceUpdate, setPriceUpdate] = useState<PriceUpdate | null>(null);

  useEffect(() => {
    // Skip if not enabled or no symbol
    if (!enabled || !symbol) {
      return;
    }

    // Create handler
    const handler = (update: PriceUpdate) => {
      setPriceUpdate(update);
    };

    // Subscribe
    wsManager.subscribe(symbol, handler);

    // Cleanup: unsubscribe on unmount
    return () => {
      wsManager.unsubscribe(symbol, handler);
    };
  }, [symbol, enabled]);

  return priceUpdate;
}

// ============================================================================
// usePortfolioUpdates Hook
// ============================================================================

/**
 * Hook to subscribe to portfolio PnL updates
 *
 * Automatically subscribes when component mounts and unsubscribes on unmount.
 * Updates are received in real-time and trigger re-renders.
 *
 * @param enabled - Whether subscription is enabled (default: true)
 * @returns Latest portfolio update
 *
 * @example
 * ```tsx
 * function PortfolioSummary() {
 *   const portfolioUpdate = usePortfolioUpdates();
 *
 *   if (portfolioUpdate) {
 *     console.log('Total PnL:', portfolioUpdate.totalPnL);
 *   }
 *
 *   return <div>PnL: ₹{portfolioUpdate?.totalPnL}</div>;
 * }
 * ```
 */
export function usePortfolioUpdates(enabled: boolean = true): PortfolioUpdate | null {
  const [portfolioUpdate, setPortfolioUpdate] = useState<PortfolioUpdate | null>(null);

  useEffect(() => {
    // Skip if not enabled
    if (!enabled) {
      return;
    }

    // Create handler
    const handler = (update: PortfolioUpdate) => {
      setPortfolioUpdate(update);
    };

    // Subscribe
    wsManager.subscribeToPortfolio(handler);

    // Cleanup: unsubscribe on unmount
    return () => {
      wsManager.unsubscribeFromPortfolio(handler);
    };
  }, [enabled]);

  return portfolioUpdate;
}

// ============================================================================
// useWebSocketConnection Hook
// ============================================================================

/**
 * Hook to monitor WebSocket connection status
 *
 * @returns Connection status (true if connected, false otherwise)
 *
 * @example
 * ```tsx
 * function ConnectionIndicator() {
 *   const isConnected = useWebSocketConnection();
 *
 *   return (
 *     <div>
 *       Status: {isConnected ? 'Connected' : 'Disconnected'}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWebSocketConnection(): boolean {
  const [isConnected, setIsConnected] = useState(wsManager.getConnectionStatus());

  useEffect(() => {
    // Poll connection status every second
    const interval = setInterval(() => {
      setIsConnected(wsManager.getConnectionStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return isConnected;
}

// ============================================================================
// useWebSocketDebug Hook
// ============================================================================

/**
 * Hook to get WebSocket debug information
 *
 * @returns Debug information including subscribed symbols and connection status
 *
 * @example
 * ```tsx
 * function DebugPanel() {
 *   const debug = useWebSocketDebug();
 *
 *   return (
 *     <div>
 *       <p>Connected: {debug.isConnected ? 'Yes' : 'No'}</p>
 *       <p>Subscribed: {debug.subscribedSymbols.join(', ')}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWebSocketDebug() {
  const [debugInfo, setDebugInfo] = useState({
    isConnected: wsManager.getConnectionStatus(),
    subscribedSymbols: wsManager.getSubscribedSymbols(),
  });

  useEffect(() => {
    // Update debug info every 2 seconds
    const interval = setInterval(() => {
      setDebugInfo({
        isConnected: wsManager.getConnectionStatus(),
        subscribedSymbols: wsManager.getSubscribedSymbols(),
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return debugInfo;
}
