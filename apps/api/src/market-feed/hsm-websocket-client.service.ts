import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import WebSocket from 'ws';
import {
  IMarketDataProvider,
  ConnectionStatus,
  RawHsmTick,
  RawHsmDepth,
} from './interfaces';

const HSM_WS_URL = 'wss://mlhsm.kotaksecurities.com';
const HEARTBEAT_TIMEOUT_MS = 5000;
const MAX_BACKOFF_MS = 60_000;
const BASE_BACKOFF_MS = 1_000;
const CONNECTION_CRITICAL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class HsmWebSocketClient implements IMarketDataProvider {
  private readonly logger = new Logger(HsmWebSocketClient.name);

  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'DISCONNECTED';
  private activeSubscriptions: Set<string> = new Set();
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private criticalTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = true;

  // Authentication credentials stored for reconnection
  private auth: string | null = null;
  private sid: string | null = null;
  private dataCenter: string | null = null;

  // Callbacks
  private tickHandlers: Array<(rawTick: RawHsmTick) => void> = [];
  private depthHandlers: Array<(rawDepth: RawHsmDepth) => void> = [];
  private statusChangeHandlers: Array<(status: ConnectionStatus) => void> = [];

  // Reconnection metrics
  private metrics = {
    totalReconnectAttempts: 0,
    successfulReconnections: 0,
    disconnectedSince: null as Date | null,
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Connect to the HSM WebSocket server.
   */
  async connect(auth: string, sid: string, dataCenter: string): Promise<void> {
    this.auth = auth;
    this.sid = sid;
    this.dataCenter = dataCenter;
    this.shouldReconnect = true;

    return this.establishConnection();
  }

  /**
   * Disconnect from the HSM WebSocket server.
   */
  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setStatus('DISCONNECTED');
  }

  /**
   * Subscribe to instruments by sending subscription strings to HSM.
   */
  subscribe(subscriptionStrings: string[]): void {
    for (const sub of subscriptionStrings) {
      this.activeSubscriptions.add(sub);
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribeMessage(subscriptionStrings);
    }
  }

  /**
   * Unsubscribe from instruments.
   */
  unsubscribe(subscriptionStrings: string[]): void {
    for (const sub of subscriptionStrings) {
      this.activeSubscriptions.delete(sub);
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendUnsubscribeMessage(subscriptionStrings);
    }
  }

  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.activeSubscriptions);
  }

  onTick(handler: (rawTick: RawHsmTick) => void): void {
    this.tickHandlers.push(handler);
  }

  onDepth(handler: (rawDepth: RawHsmDepth) => void): void {
    this.depthHandlers.push(handler);
  }

  onStatusChange(handler: (status: ConnectionStatus) => void): void {
    this.statusChangeHandlers.push(handler);
  }

  /**
   * Get reconnection metrics.
   */
  getMetrics() {
    return { ...this.metrics };
  }

  // --- Private Methods ---

  private async establishConnection(): Promise<void> {
    this.setStatus('CONNECTING');

    return new Promise<void>((resolve, reject) => {
      try {
        // TODO: The exact URL format and query params may differ with live HSM.
        // The auth/sid/dataCenter may be sent as headers or in the initial message.
        const url = `${HSM_WS_URL}`;
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          this.logger.log('WebSocket connected to HSM');
          this.setStatus('CONNECTED');
          this.reconnectAttempts = 0;
          this.metrics.disconnectedSince = null;
          this.clearCriticalTimer();

          // TODO: The initial auth handshake message format may need adjustment
          // when tested with live HSM data.
          this.sendAuthMessage();
          this.startHeartbeat();

          // Restore subscriptions if reconnecting
          if (this.activeSubscriptions.size > 0) {
            const subs = Array.from(this.activeSubscriptions);
            this.sendSubscribeMessage(subs);
            this.logger.log(
              `Restored ${subs.length} subscriptions after reconnection`,
            );
            this.metrics.successfulReconnections++;
          }

          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('ping', () => {
          // Respond to server pings to maintain connection
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.pong();
          }
        });

        this.ws.on('pong', () => {
          // Server responded to our ping — connection is alive
          this.resetHeartbeatTimeout();
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.logger.warn(
            `WebSocket closed: code=${code}, reason=${reason.toString()}`,
          );
          this.handleDisconnection(code);
        });

        this.ws.on('error', (error: Error) => {
          this.logger.error(`WebSocket error: ${error.message}`);
          // Don't reject here; the 'close' event will handle reconnection
        });
      } catch (error) {
        this.logger.error(`Failed to create WebSocket: ${(error as Error).message}`);
        this.handleDisconnection(1006);
        reject(error);
      }
    });
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // TODO: The HSM message format detection logic may need adjustment
      // based on actual production messages. Current implementation assumes:
      // - Ticks have a 'tk' (token) and 'lp' (last price) field
      // - Depth messages have 'bp1'/'sp1' (bid price 1/sell price 1) fields
      // - Heartbeat/status messages have a 'type' field

      if (message.type === 'heartbeat' || message.type === 'pong') {
        // Server heartbeat message
        this.resetHeartbeatTimeout();
        return;
      }

      if (message.type === 'session-expired' || message.type === 'auth-failed') {
        this.logger.error('Session expired or auth failed — ceasing reconnection');
        this.shouldReconnect = false;
        this.eventEmitter.emit('session-expired', {
          reason: message.reason || 'Session expired',
        });
        this.disconnect();
        return;
      }

      // Determine if this is a tick or depth message
      if (message.tk) {
        if (this.isDepthMessage(message)) {
          this.emitDepth(message as RawHsmDepth);
        } else {
          this.emitTick(message as RawHsmTick);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to parse HSM message: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Determine if a message is a depth update (has multiple bid/ask levels).
   * TODO: The exact field detection may need adjustment with live data.
   */
  private isDepthMessage(message: Record<string, unknown>): boolean {
    return (
      'bp1' in message &&
      'sp1' in message &&
      ('bp2' in message || 'sp2' in message)
    );
  }

  private emitTick(rawTick: RawHsmTick): void {
    for (const handler of this.tickHandlers) {
      try {
        handler(rawTick);
      } catch (error) {
        this.logger.error(`Tick handler error: ${(error as Error).message}`);
      }
    }
  }

  private emitDepth(rawDepth: RawHsmDepth): void {
    for (const handler of this.depthHandlers) {
      try {
        handler(rawDepth);
      } catch (error) {
        this.logger.error(`Depth handler error: ${(error as Error).message}`);
      }
    }
  }

  private handleDisconnection(code: number): void {
    this.stopHeartbeat();

    if (!this.metrics.disconnectedSince) {
      this.metrics.disconnectedSince = new Date();
    }

    // Check for auth failure codes
    // TODO: Determine exact close codes HSM uses for auth failures
    if (code === 4001 || code === 4003) {
      this.logger.error('Auth failure detected — ceasing reconnection');
      this.shouldReconnect = false;
      this.eventEmitter.emit('session-expired', { code });
      this.setStatus('DISCONNECTED');
      return;
    }

    if (this.shouldReconnect) {
      this.setStatus('RECONNECTING');
      this.scheduleReconnect();
    } else {
      this.setStatus('DISCONNECTED');
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    this.metrics.totalReconnectAttempts++;

    const backoff = this.calculateBackoff(this.reconnectAttempts);
    this.logger.log(
      `Reconnecting in ${backoff}ms (attempt ${this.reconnectAttempts})`,
    );

    // Start critical timer if not already running
    if (!this.criticalTimer) {
      this.criticalTimer = setTimeout(() => {
        this.logger.error(
          'Connection critical: failed to reconnect for 5 minutes',
        );
        this.eventEmitter.emit('connection-critical', {
          attempts: this.metrics.totalReconnectAttempts,
          disconnectedSince: this.metrics.disconnectedSince,
        });
      }, CONNECTION_CRITICAL_THRESHOLD_MS);
    }

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.establishConnection();
      } catch {
        // establishConnection handles its own error via 'close' event
      }
    }, backoff);
  }

  /**
   * Calculate exponential backoff delay.
   * Formula: min(1000 * 2^(N-1), 60000) where N is the attempt number.
   */
  calculateBackoff(attempt: number): number {
    return Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
  }

  private sendAuthMessage(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // TODO: The exact auth message format may differ from this implementation.
    // Adjust based on HSM protocol documentation or live testing.
    const authMessage = JSON.stringify({
      type: 'auth',
      auth: this.auth,
      sid: this.sid,
      dataCenter: this.dataCenter,
    });

    this.ws.send(authMessage);
  }

  private sendSubscribeMessage(subscriptions: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // TODO: The exact subscribe message format may need adjustment.
    // HSM protocol may use a different structure for batch subscriptions.
    const message = JSON.stringify({
      type: 'subscribe',
      scrips: subscriptions.join('&'),
    });

    this.ws.send(message);
    this.logger.debug(`Subscribed to ${subscriptions.length} instruments`);
  }

  private sendUnsubscribeMessage(subscriptions: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // TODO: The exact unsubscribe message format may need adjustment.
    const message = JSON.stringify({
      type: 'unsubscribe',
      scrips: subscriptions.join('&'),
    });

    this.ws.send(message);
    this.logger.debug(`Unsubscribed from ${subscriptions.length} instruments`);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    // Send periodic pings to detect connection health
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, HEARTBEAT_TIMEOUT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private resetHeartbeatTimeout(): void {
    // Heartbeat is alive — nothing extra needed since we use interval-based pinging
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const handler of this.statusChangeHandlers) {
        try {
          handler(newStatus);
        } catch (error) {
          this.logger.error(
            `Status change handler error: ${(error as Error).message}`,
          );
        }
      }
    }
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.clearCriticalTimer();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearCriticalTimer(): void {
    if (this.criticalTimer) {
      clearTimeout(this.criticalTimer);
      this.criticalTimer = null;
    }
  }
}
