/**
 * WebSocket Client for ProfitTerminal
 *
 * Provides real-time communication with Backend WebSocket Gateway for:
 * - Symbol price updates when chart is viewed
 * - Portfolio PnL updates
 *
 * Requirements: 13.6
 * Task: 22.2
 */

import { io, Socket } from 'socket.io-client';

// ============================================================================
// Type Definitions
// ============================================================================

export interface PriceUpdate {
  event: 'priceUpdate';
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface PortfolioUpdate {
  event: 'portfolioUpdate';
  totalPnL: number;
  dailyPnL: number;
  timestamp: string;
}

export interface SubscriptionConfirmation {
  symbol: string;
  timestamp: string;
}

export type PriceUpdateHandler = (update: PriceUpdate) => void;
export type PortfolioUpdateHandler = (update: PortfolioUpdate) => void;

// ============================================================================
// WebSocket Manager Class
// ============================================================================

/**
 * WebSocket Manager
 *
 * Singleton class that manages WebSocket connection to Backend Gateway.
 * Handles subscriptions, unsubscriptions, and event listeners.
 */
class WebSocketManager {
  private socket: Socket | null = null;
  private url: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000; // 2 seconds

  // Track subscriptions and listeners
  private subscribedSymbols: Set<string> = new Set();
  private priceUpdateListeners: Map<string, Set<PriceUpdateHandler>> = new Map();
  private portfolioUpdateListeners: Set<PortfolioUpdateHandler> = new Set();

  constructor(url: string = 'http://localhost:4000') {
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.socket && this.isConnected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    console.log('[WebSocket] Connecting to', this.url);

    this.socket = io(this.url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventHandlers();
  }

  /**
   * Set up socket.io event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection established
    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Resubscribe to symbols after reconnect
      this.resubscribeAll();
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.isConnected = false;
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnect attempts reached');
      }
    });

    // Disconnection
    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      this.isConnected = false;

      if (reason === 'io server disconnect') {
        // Server disconnected, manually reconnect
        this.socket?.connect();
      }
    });

    // Subscription confirmation
    this.socket.on('subscribed', (data: SubscriptionConfirmation) => {
      console.log('[WebSocket] Subscribed to', data.symbol);
    });

    // Unsubscription confirmation
    this.socket.on('unsubscribed', (data: SubscriptionConfirmation) => {
      console.log('[WebSocket] Unsubscribed from', data.symbol);
    });

    // Price updates
    this.socket.on('priceUpdate', (update: PriceUpdate) => {
      console.log('[WebSocket] Price update:', update.symbol, update.price);
      this.handlePriceUpdate(update);
    });

    // Portfolio updates
    this.socket.on('portfolioUpdate', (update: PortfolioUpdate) => {
      console.log('[WebSocket] Portfolio update:', update.totalPnL, update.dailyPnL);
      this.handlePortfolioUpdate(update);
    });
  }

  /**
   * Resubscribe to all symbols after reconnection
   */
  private resubscribeAll(): void {
    if (!this.isConnected || !this.socket) return;

    console.log('[WebSocket] Resubscribing to', this.subscribedSymbols.size, 'symbols');

    this.subscribedSymbols.forEach((symbol) => {
      this.socket?.emit('subscribe', { event: 'subscribe', symbol });
    });
  }

  /**
   * Subscribe to price updates for a symbol
   */
  subscribe(symbol: string, handler: PriceUpdateHandler): void {
    console.log('[WebSocket] Subscribing to', symbol);

    // Add handler to listeners
    if (!this.priceUpdateListeners.has(symbol)) {
      this.priceUpdateListeners.set(symbol, new Set());
    }
    this.priceUpdateListeners.get(symbol)!.add(handler);

    // Subscribe to symbol if not already subscribed
    if (!this.subscribedSymbols.has(symbol)) {
      this.subscribedSymbols.add(symbol);

      if (this.isConnected && this.socket) {
        this.socket.emit('subscribe', { event: 'subscribe', symbol });
      }
    }
  }

  /**
   * Unsubscribe from price updates for a symbol
   */
  unsubscribe(symbol: string, handler: PriceUpdateHandler): void {
    console.log('[WebSocket] Unsubscribing from', symbol);

    // Remove handler from listeners
    const handlers = this.priceUpdateListeners.get(symbol);
    if (handlers) {
      handlers.delete(handler);

      // If no more handlers for this symbol, unsubscribe
      if (handlers.size === 0) {
        this.priceUpdateListeners.delete(symbol);
        this.subscribedSymbols.delete(symbol);

        if (this.isConnected && this.socket) {
          this.socket.emit('unsubscribe', { event: 'unsubscribe', symbol });
        }
      }
    }
  }

  /**
   * Subscribe to portfolio updates
   */
  subscribeToPortfolio(handler: PortfolioUpdateHandler): void {
    console.log('[WebSocket] Subscribing to portfolio updates');
    this.portfolioUpdateListeners.add(handler);
  }

  /**
   * Unsubscribe from portfolio updates
   */
  unsubscribeFromPortfolio(handler: PortfolioUpdateHandler): void {
    console.log('[WebSocket] Unsubscribing from portfolio updates');
    this.portfolioUpdateListeners.delete(handler);
  }

  /**
   * Handle incoming price update
   */
  private handlePriceUpdate(update: PriceUpdate): void {
    const handlers = this.priceUpdateListeners.get(update.symbol);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(update);
        } catch (error) {
          console.error('[WebSocket] Error in price update handler:', error);
        }
      });
    }
  }

  /**
   * Handle incoming portfolio update
   */
  private handlePortfolioUpdate(update: PortfolioUpdate): void {
    this.portfolioUpdateListeners.forEach((handler) => {
      try {
        handler(update);
      } catch (error) {
        console.error('[WebSocket] Error in portfolio update handler:', error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('[WebSocket] Disconnecting');

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.subscribedSymbols.clear();
    this.priceUpdateListeners.clear();
    this.portfolioUpdateListeners.clear();
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get list of subscribed symbols
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const wsManager = new WebSocketManager();

// Auto-connect on module load (only in browser environment)
if (typeof window !== 'undefined') {
  wsManager.connect();
}

// Also export the class for testing/custom instances
export { WebSocketManager };
