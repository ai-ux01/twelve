import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface SubscriptionMessage {
  event: 'subscribe' | 'unsubscribe';
  symbol: string;
}

interface PriceUpdateMessage {
  event: 'priceUpdate';
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

interface PortfolioUpdateMessage {
  event: 'portfolioUpdate';
  totalPnL: number;
  dailyPnL: number;
  timestamp: string;
}

/**
 * WebSocket Gateway for real-time market data and portfolio updates
 *
 * Provides WebSocket server at ws://localhost:4000 for:
 * - Client subscriptions to symbols for real-time price updates
 * - Broadcasting price updates to subscribed clients
 * - Broadcasting portfolio PnL updates
 *
 * Requirements: 13.6
 */
@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
})
export class WebSocketGatewayService implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebSocketGatewayService.name);

  // Track which clients are subscribed to which symbols
  private symbolSubscriptions: Map<string, Set<string>> = new Map();

  // Track which symbols each client is subscribed to (for cleanup)
  private clientSubscriptions: Map<string, Set<string>> = new Map();

  /**
   * Handle client connection
   */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.clientSubscriptions.set(client.id, new Set());
  }

  /**
   * Handle client disconnection and cleanup subscriptions
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Clean up subscriptions for this client
    const symbols = this.clientSubscriptions.get(client.id);
    if (symbols) {
      symbols.forEach((symbol) => {
        const clients = this.symbolSubscriptions.get(symbol);
        if (clients) {
          clients.delete(client.id);
          if (clients.size === 0) {
            this.symbolSubscriptions.delete(symbol);
          }
        }
      });
    }

    this.clientSubscriptions.delete(client.id);
  }

  /**
   * Handle subscription requests from clients
   *
   * Client sends: { event: 'subscribe', symbol: 'RELIANCE' }
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: SubscriptionMessage,
    @ConnectedSocket() client: Socket
  ): void {
    const { symbol } = data;

    if (!symbol) {
      this.logger.warn(`Client ${client.id} sent invalid subscribe message`);
      return;
    }

    this.logger.log(`Client ${client.id} subscribing to ${symbol}`);

    // Add client to symbol subscribers
    if (!this.symbolSubscriptions.has(symbol)) {
      this.symbolSubscriptions.set(symbol, new Set());
    }
    this.symbolSubscriptions.get(symbol)!.add(client.id);

    // Track client's subscriptions
    const clientSymbols = this.clientSubscriptions.get(client.id);
    if (clientSymbols) {
      clientSymbols.add(symbol);
    }

    // Send confirmation to client
    client.emit('subscribed', { symbol, timestamp: new Date().toISOString() });
  }

  /**
   * Handle unsubscription requests from clients
   *
   * Client sends: { event: 'unsubscribe', symbol: 'RELIANCE' }
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: SubscriptionMessage,
    @ConnectedSocket() client: Socket
  ): void {
    const { symbol } = data;

    if (!symbol) {
      this.logger.warn(`Client ${client.id} sent invalid unsubscribe message`);
      return;
    }

    this.logger.log(`Client ${client.id} unsubscribing from ${symbol}`);

    // Remove client from symbol subscribers
    const clients = this.symbolSubscriptions.get(symbol);
    if (clients) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.symbolSubscriptions.delete(symbol);
      }
    }

    // Remove from client's subscriptions
    const clientSymbols = this.clientSubscriptions.get(client.id);
    if (clientSymbols) {
      clientSymbols.delete(symbol);
    }

    // Send confirmation to client
    client.emit('unsubscribed', { symbol, timestamp: new Date().toISOString() });
  }

  /**
   * Broadcast price update to all clients subscribed to the symbol
   *
   * Called by market data service or scheduled jobs
   */
  broadcastPriceUpdate(symbol: string, price: number, change: number, changePercent: number): void {
    const clients = this.symbolSubscriptions.get(symbol);

    if (!clients || clients.size === 0) {
      // No clients subscribed to this symbol
      return;
    }

    const message: PriceUpdateMessage = {
      event: 'priceUpdate',
      symbol,
      price,
      change,
      changePercent,
      timestamp: new Date().toISOString(),
    };

    this.logger.debug(`Broadcasting price update for ${symbol} to ${clients.size} clients`);

    // Emit to all subscribed clients
    clients.forEach((clientId) => {
      this.server.to(clientId).emit('priceUpdate', message);
    });
  }

  /**
   * Broadcast portfolio PnL update to all connected clients
   *
   * Called by portfolio service when PnL changes
   */
  broadcastPortfolioUpdate(totalPnL: number, dailyPnL: number): void {
    const message: PortfolioUpdateMessage = {
      event: 'portfolioUpdate',
      totalPnL,
      dailyPnL,
      timestamp: new Date().toISOString(),
    };

    this.logger.debug(
      `Broadcasting portfolio update to all clients: totalPnL=${totalPnL}, dailyPnL=${dailyPnL}`
    );

    // Emit to all connected clients
    this.server.emit('portfolioUpdate', message);
  }

  /**
   * Get list of currently subscribed symbols
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.symbolSubscriptions.keys());
  }

  /**
   * Get number of clients subscribed to a symbol
   */
  getSubscriberCount(symbol: string): number {
    return this.symbolSubscriptions.get(symbol)?.size || 0;
  }

  /**
   * Get total number of active connections
   */
  getConnectionCount(): number {
    return this.clientSubscriptions.size;
  }
}
