/**
 * Unit Tests for WebSocket React Hooks
 *
 * Tests React hooks for WebSocket integration
 *
 * Requirements: 13.6
 * Task: 22.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  usePriceUpdates,
  usePortfolioUpdates,
  useWebSocketConnection,
  useWebSocketDebug,
} from './useWebSocket';
import { wsManager } from '../websocket';

// Mock WebSocket manager
vi.mock('../websocket', () => {
  const subscribedSymbols = new Set<string>();
  const priceHandlers = new Map<string, Set<Function>>();
  const portfolioHandlers = new Set<Function>();

  return {
    wsManager: {
      subscribe: vi.fn((symbol: string, handler: Function) => {
        if (!priceHandlers.has(symbol)) {
          priceHandlers.set(symbol, new Set());
        }
        priceHandlers.get(symbol)!.add(handler);
        subscribedSymbols.add(symbol);
      }),
      unsubscribe: vi.fn((symbol: string, handler: Function) => {
        const handlers = priceHandlers.get(symbol);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            priceHandlers.delete(symbol);
            subscribedSymbols.delete(symbol);
          }
        }
      }),
      subscribeToPortfolio: vi.fn((handler: Function) => {
        portfolioHandlers.add(handler);
      }),
      unsubscribeFromPortfolio: vi.fn((handler: Function) => {
        portfolioHandlers.delete(handler);
      }),
      getConnectionStatus: vi.fn(() => true),
      getSubscribedSymbols: vi.fn(() => Array.from(subscribedSymbols)),
      // Test helper to simulate price update
      _simulatePriceUpdate: (symbol: string, update: any) => {
        const handlers = priceHandlers.get(symbol);
        if (handlers) {
          handlers.forEach((handler) => handler(update));
        }
      },
      // Test helper to simulate portfolio update
      _simulatePortfolioUpdate: (update: any) => {
        portfolioHandlers.forEach((handler) => handler(update));
      },
    },
  };
});

describe('WebSocket React Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // usePriceUpdates Hook Tests
  // ==========================================================================

  describe('usePriceUpdates', () => {
    it('should subscribe to symbol on mount', () => {
      const { result } = renderHook(() => usePriceUpdates('RELIANCE'));

      expect(wsManager.subscribe).toHaveBeenCalledWith('RELIANCE', expect.any(Function));
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => usePriceUpdates('RELIANCE'));

      unmount();

      expect(wsManager.unsubscribe).toHaveBeenCalledWith('RELIANCE', expect.any(Function));
    });

    it('should not subscribe when enabled is false', () => {
      renderHook(() => usePriceUpdates('RELIANCE', false));

      expect(wsManager.subscribe).not.toHaveBeenCalled();
    });

    it('should not subscribe when symbol is null', () => {
      renderHook(() => usePriceUpdates(null));

      expect(wsManager.subscribe).not.toHaveBeenCalled();
    });

    it('should not subscribe when symbol is undefined', () => {
      renderHook(() => usePriceUpdates(undefined));

      expect(wsManager.subscribe).not.toHaveBeenCalled();
    });

    it('should return null initially', () => {
      const { result } = renderHook(() => usePriceUpdates('RELIANCE'));

      expect(result.current).toBeNull();
    });

    it('should update when price update received', async () => {
      const { result } = renderHook(() => usePriceUpdates('RELIANCE'));

      const priceUpdate = {
        event: 'priceUpdate' as const,
        symbol: 'RELIANCE',
        price: 2500,
        change: 50,
        changePercent: 2.0,
        timestamp: new Date().toISOString(),
      };

      // Simulate price update
      (wsManager as any)._simulatePriceUpdate('RELIANCE', priceUpdate);

      await waitFor(() => {
        expect(result.current).toEqual(priceUpdate);
      });
    });

    it('should resubscribe when symbol changes', () => {
      const { rerender } = renderHook(({ symbol }) => usePriceUpdates(symbol), {
        initialProps: { symbol: 'RELIANCE' },
      });

      expect(wsManager.subscribe).toHaveBeenCalledWith('RELIANCE', expect.any(Function));

      rerender({ symbol: 'INFY' });

      expect(wsManager.unsubscribe).toHaveBeenCalledWith('RELIANCE', expect.any(Function));
      expect(wsManager.subscribe).toHaveBeenCalledWith('INFY', expect.any(Function));
    });
  });

  // ==========================================================================
  // usePortfolioUpdates Hook Tests
  // ==========================================================================

  describe('usePortfolioUpdates', () => {
    it('should subscribe to portfolio updates on mount', () => {
      renderHook(() => usePortfolioUpdates());

      expect(wsManager.subscribeToPortfolio).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => usePortfolioUpdates());

      unmount();

      expect(wsManager.unsubscribeFromPortfolio).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should not subscribe when enabled is false', () => {
      renderHook(() => usePortfolioUpdates(false));

      expect(wsManager.subscribeToPortfolio).not.toHaveBeenCalled();
    });

    it('should return null initially', () => {
      const { result } = renderHook(() => usePortfolioUpdates());

      expect(result.current).toBeNull();
    });

    it('should update when portfolio update received', async () => {
      const { result } = renderHook(() => usePortfolioUpdates());

      const portfolioUpdate = {
        event: 'portfolioUpdate' as const,
        totalPnL: 25000,
        dailyPnL: 1200,
        timestamp: new Date().toISOString(),
      };

      // Simulate portfolio update
      (wsManager as any)._simulatePortfolioUpdate(portfolioUpdate);

      await waitFor(() => {
        expect(result.current).toEqual(portfolioUpdate);
      });
    });
  });

  // ==========================================================================
  // useWebSocketConnection Hook Tests
  // ==========================================================================

  describe('useWebSocketConnection', () => {
    it('should return connection status', () => {
      const { result } = renderHook(() => useWebSocketConnection());

      expect(typeof result.current).toBe('boolean');
    });

    it('should return true when connected', () => {
      vi.mocked(wsManager.getConnectionStatus).mockReturnValue(true);

      const { result } = renderHook(() => useWebSocketConnection());

      expect(result.current).toBe(true);
    });

    it('should return false when disconnected', () => {
      vi.mocked(wsManager.getConnectionStatus).mockReturnValue(false);

      const { result } = renderHook(() => useWebSocketConnection());

      expect(result.current).toBe(false);
    });
  });

  // ==========================================================================
  // useWebSocketDebug Hook Tests
  // ==========================================================================

  describe('useWebSocketDebug', () => {
    it('should return debug information', () => {
      const { result } = renderHook(() => useWebSocketDebug());

      expect(result.current).toHaveProperty('isConnected');
      expect(result.current).toHaveProperty('subscribedSymbols');
    });

    it('should return connection status in debug info', () => {
      vi.mocked(wsManager.getConnectionStatus).mockReturnValue(true);

      const { result } = renderHook(() => useWebSocketDebug());

      expect(result.current.isConnected).toBe(true);
    });

    it('should return subscribed symbols in debug info', () => {
      vi.mocked(wsManager.getSubscribedSymbols).mockReturnValue(['RELIANCE', 'INFY']);

      const { result } = renderHook(() => useWebSocketDebug());

      expect(result.current.subscribedSymbols).toEqual(['RELIANCE', 'INFY']);
    });
  });
});
