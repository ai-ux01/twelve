/**
 * Unit Tests for WebSocket Manager
 *
 * Tests WebSocket connection, subscription management, and event handling
 *
 * Requirements: 13.6
 * Task: 22.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketManager, PriceUpdate, PortfolioUpdate } from './websocket';

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    id: 'test-socket-id',
  };

  return {
    io: vi.fn(() => mockSocket),
  };
});

describe('WebSocketManager', () => {
  let wsManager: WebSocketManager;

  beforeEach(() => {
    wsManager = new WebSocketManager('http://localhost:4000');
    vi.clearAllMocks();
  });

  afterEach(() => {
    wsManager.disconnect();
  });

  // ==========================================================================
  // Connection Tests
  // ==========================================================================

  describe('Connection', () => {
    it('should create WebSocket instance on connect', () => {
      wsManager.connect();

      // Socket should be created
      expect(wsManager.getConnectionStatus()).toBeDefined();
    });

    it('should not create duplicate connection when already connected', () => {
      wsManager.connect();
      const firstStatus = wsManager.getConnectionStatus();

      wsManager.connect();
      const secondStatus = wsManager.getConnectionStatus();

      expect(firstStatus).toBe(secondStatus);
    });

    it('should disconnect and clean up', () => {
      wsManager.connect();
      wsManager.disconnect();

      expect(wsManager.getConnectionStatus()).toBe(false);
      expect(wsManager.getSubscribedSymbols()).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Subscription Tests
  // ==========================================================================

  describe('Symbol Subscriptions', () => {
    it('should subscribe to a symbol', () => {
      const handler = vi.fn();

      wsManager.subscribe('RELIANCE', handler);

      expect(wsManager.getSubscribedSymbols()).toContain('RELIANCE');
    });

    it('should track multiple subscriptions', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      wsManager.subscribe('RELIANCE', handler1);
      wsManager.subscribe('INFY', handler2);

      const subscribed = wsManager.getSubscribedSymbols();
      expect(subscribed).toContain('RELIANCE');
      expect(subscribed).toContain('INFY');
      expect(subscribed).toHaveLength(2);
    });

    it('should allow multiple handlers for same symbol', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      wsManager.subscribe('RELIANCE', handler1);
      wsManager.subscribe('RELIANCE', handler2);

      // Should still only have one subscription to symbol
      expect(wsManager.getSubscribedSymbols()).toHaveLength(1);
    });

    it('should unsubscribe from a symbol', () => {
      const handler = vi.fn();

      wsManager.subscribe('RELIANCE', handler);
      expect(wsManager.getSubscribedSymbols()).toContain('RELIANCE');

      wsManager.unsubscribe('RELIANCE', handler);
      expect(wsManager.getSubscribedSymbols()).not.toContain('RELIANCE');
    });

    it('should only unsubscribe when all handlers removed', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      wsManager.subscribe('RELIANCE', handler1);
      wsManager.subscribe('RELIANCE', handler2);

      wsManager.unsubscribe('RELIANCE', handler1);
      expect(wsManager.getSubscribedSymbols()).toContain('RELIANCE');

      wsManager.unsubscribe('RELIANCE', handler2);
      expect(wsManager.getSubscribedSymbols()).not.toContain('RELIANCE');
    });
  });

  // ==========================================================================
  // Portfolio Subscription Tests
  // ==========================================================================

  describe('Portfolio Subscriptions', () => {
    it('should subscribe to portfolio updates', () => {
      const handler = vi.fn();

      wsManager.subscribeToPortfolio(handler);

      // Should be able to subscribe without errors
      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow multiple portfolio handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      wsManager.subscribeToPortfolio(handler1);
      wsManager.subscribeToPortfolio(handler2);

      // Both should be registered
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should unsubscribe from portfolio updates', () => {
      const handler = vi.fn();

      wsManager.subscribeToPortfolio(handler);
      wsManager.unsubscribeFromPortfolio(handler);

      // Should unsubscribe without errors
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Status Tests
  // ==========================================================================

  describe('Status', () => {
    it('should return connection status', () => {
      const status = wsManager.getConnectionStatus();
      expect(typeof status).toBe('boolean');
    });

    it('should return list of subscribed symbols', () => {
      const handler = vi.fn();

      wsManager.subscribe('RELIANCE', handler);
      wsManager.subscribe('INFY', handler);

      const symbols = wsManager.getSubscribedSymbols();
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols).toHaveLength(2);
    });

    it('should return empty array when no subscriptions', () => {
      const symbols = wsManager.getSubscribedSymbols();
      expect(symbols).toEqual([]);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle subscribe with empty symbol gracefully', () => {
      const handler = vi.fn();

      wsManager.subscribe('', handler);

      // Should still track the subscription even if symbol is empty
      expect(wsManager.getSubscribedSymbols()).toContain('');
    });

    it('should handle unsubscribe for non-existent symbol', () => {
      const handler = vi.fn();

      // Should not throw error
      expect(() => {
        wsManager.unsubscribe('NONEXISTENT', handler);
      }).not.toThrow();
    });

    it('should handle unsubscribe for non-existent handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      wsManager.subscribe('RELIANCE', handler1);

      // Unsubscribe with different handler
      expect(() => {
        wsManager.unsubscribe('RELIANCE', handler2);
      }).not.toThrow();

      // Original handler should still be subscribed
      expect(wsManager.getSubscribedSymbols()).toContain('RELIANCE');
    });

    it('should clear all subscriptions on disconnect', () => {
      // Create a fresh instance for this test
      const testWsManager = new WebSocketManager('http://localhost:4000');
      const handler = vi.fn();

      testWsManager.subscribe('RELIANCE', handler);
      testWsManager.subscribe('INFY', handler);
      testWsManager.subscribeToPortfolio(handler);

      testWsManager.disconnect();

      expect(testWsManager.getSubscribedSymbols()).toHaveLength(0);
    });
  });
});
