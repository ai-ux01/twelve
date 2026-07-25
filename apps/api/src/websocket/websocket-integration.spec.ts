import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { WebSocketModule } from './websocket.module';
import { WebSocketGatewayService } from './websocket.gateway';

/**
 * Integration test for WebSocket Gateway
 *
 * Tests the WebSocket server initialization to ensure the gateway
 * is properly configured and ready to accept connections
 *
 * Requirements: 13.6
 */
describe('WebSocket Gateway Integration', () => {
  let app: INestApplication;
  let gateway: WebSocketGatewayService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WebSocketModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0); // Use random port for testing

    gateway = moduleFixture.get<WebSocketGatewayService>(WebSocketGatewayService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should initialize WebSocket gateway', () => {
    expect(gateway).toBeDefined();
    expect(gateway.server).toBeDefined();
  });

  it('should have subscription management methods', () => {
    expect(typeof gateway.handleConnection).toBe('function');
    expect(typeof gateway.handleDisconnect).toBe('function');
    expect(typeof gateway.broadcastPriceUpdate).toBe('function');
    expect(typeof gateway.broadcastPortfolioUpdate).toBe('function');
  });

  it('should have utility methods for monitoring', () => {
    expect(typeof gateway.getSubscribedSymbols).toBe('function');
    expect(typeof gateway.getSubscriberCount).toBe('function');
    expect(typeof gateway.getConnectionCount).toBe('function');
  });

  it('should track active connections', () => {
    // Initially no connections
    expect(gateway.getConnectionCount()).toBe(0);
    expect(gateway.getSubscribedSymbols()).toHaveLength(0);
  });

  it('should be ready to accept WebSocket connections', () => {
    // Verify gateway has server instance ready
    expect(gateway.server).toBeDefined();
    expect(gateway.server.emit).toBeDefined();
  });
});
