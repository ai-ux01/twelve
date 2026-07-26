import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { NormalizedTick, NormalizedDepth, ConnectionStatus } from './interfaces';

@WebSocketGateway({
  namespace: '/market-feed',
  cors: { origin: '*' },
})
export class MarketFeedGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MarketFeedGateway.name);

  @WebSocketServer()
  server!: Server;

  /**
   * Handle new client connections.
   */
  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * Handle client disconnections.
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Listen to EventEmitter2 'tick' events and broadcast to subscribed clients.
   * Clients join a room named after the instrument token to receive targeted ticks.
   */
  @OnEvent('tick')
  handleTickEvent(tick: NormalizedTick): void {
    if (!this.server) return;

    // Broadcast to clients subscribed to this specific token room
    this.server
      .to(`token:${tick.instrumentToken}`)
      .emit('tick', tick);

    // Also broadcast to the global 'ticks' room for clients wanting all ticks
    this.server.to('all-ticks').emit('tick', tick);
  }

  /**
   * Listen to EventEmitter2 'depth.*' events and broadcast depth updates.
   */
  @OnEvent('depth')
  handleDepthEvent(depth: NormalizedDepth): void {
    if (!this.server) return;

    this.server
      .to(`depth:${depth.instrumentToken}`)
      .emit('depth', depth);
  }

  /**
   * Listen to EventEmitter2 'market-feed.status' events and broadcast to all clients.
   */
  @OnEvent('market-feed.status')
  handleStatusChange(status: ConnectionStatus): void {
    if (!this.server) return;

    this.server.emit('market-feed.status', { status });
  }

  /**
   * Handle client 'subscribe' message — join a room for that token.
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { token: string; type?: 'tick' | 'depth' },
    @ConnectedSocket() client: Socket,
  ): { event: string; data: { success: boolean; token: string } } {
    const { token, type = 'tick' } = data;

    if (type === 'depth') {
      client.join(`depth:${token}`);
    } else {
      client.join(`token:${token}`);
    }

    this.logger.debug(
      `Client ${client.id} subscribed to ${type}:${token}`,
    );

    return {
      event: 'subscribed',
      data: { success: true, token },
    };
  }

  /**
   * Handle client 'unsubscribe' message — leave the room for that token.
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { token: string; type?: 'tick' | 'depth' },
    @ConnectedSocket() client: Socket,
  ): { event: string; data: { success: boolean; token: string } } {
    const { token, type = 'tick' } = data;

    if (type === 'depth') {
      client.leave(`depth:${token}`);
    } else {
      client.leave(`token:${token}`);
    }

    this.logger.debug(
      `Client ${client.id} unsubscribed from ${type}:${token}`,
    );

    return {
      event: 'unsubscribed',
      data: { success: true, token },
    };
  }

  /**
   * Handle client 'getStatus' message — return current connection status.
   */
  @SubscribeMessage('getStatus')
  async handleGetStatus(): Promise<{
    event: string;
    data: { connected: boolean; clientCount: number };
  }> {
    let clientCount = 0;
    if (this.server) {
      const sockets = await this.server.fetchSockets();
      clientCount = sockets.length;
    }

    return {
      event: 'status',
      data: {
        connected: true,
        clientCount,
      },
    };
  }
}
