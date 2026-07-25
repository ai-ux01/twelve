import { Module } from '@nestjs/common';
import { WebSocketGatewayService } from './websocket.gateway';

/**
 * WebSocket Module for real-time communication
 *
 * Provides WebSocket gateway for:
 * - Real-time market data price updates
 * - Portfolio PnL updates
 * - Client subscription management
 *
 * Requirements: 13.6
 */
@Module({
  providers: [WebSocketGatewayService],
  exports: [WebSocketGatewayService],
})
export class WebSocketModule {}
