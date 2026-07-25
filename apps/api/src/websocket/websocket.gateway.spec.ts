import { Test, TestingModule } from '@nestjs/testing';
import { WebSocketGatewayService } from './websocket.gateway';

// Mock Socket interface
interface MockSocket {
  id: string;
  emit: jest.Mock;
  to: jest.Mock;
}

describe('WebSocketGatewayService', () => {
  let gateway: WebSocketGatewayService;

  // Mock Socket
  const createMockSocket = (id: string): MockSocket => ({
    id,
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebSocketGatewayService],
    }).compile();

    gateway = module.get<WebSocketGatewayService>(WebSocketGatewayService);

    // Mock the server
    gateway.server = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should handle client connection', () => {
      const client = createMockSocket('client1') as any;

      gateway.handleConnection(client);

      expect(gateway.getConnectionCount()).toBe(1);
    });

    it('should handle client disconnection', () => {
      const client = createMockSocket('client1') as any;

      gateway.handleConnection(client);
      expect(gateway.getConnectionCount()).toBe(1);

      gateway.handleDisconnect(client);
      expect(gateway.getConnectionCount()).toBe(0);
    });

    it('should clean up subscriptions on disconnect', () => {
      const client = createMockSocket('client1') as any;

      gateway.handleConnection(client);
      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client);

      expect(gateway.getSubscriberCount('RELIANCE')).toBe(1);

      gateway.handleDisconnect(client);

      expect(gateway.getSubscriberCount('RELIANCE')).toBe(0);
      expect(gateway.getSubscribedSymbols()).toHaveLength(0);
    });
  });

  describe('Subscription Management', () => {
    it('should handle subscribe message', () => {
      const client = createMockSocket('client1') as any;

      gateway.handleConnection(client);
      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client);

      expect(gateway.getSubscriberCount('RELIANCE')).toBe(1);
      expect(gateway.getSubscribedSymbols()).toContain('RELIANCE');
      expect(client.emit).toHaveBeenCalledWith('subscribed', {
        symbol: 'RELIANCE',
        timestamp: expect.any(String),
      });
    });

    it('should handle multiple clients subscribing to same symbol', () => {
      const client1 = createMockSocket('client1') as any;
      const client2 = createMockSocket('client2') as any;

      gateway.handleConnection(client1);
      gateway.handleConnection(client2);

      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client1);
      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client2);

      expect(gateway.getSubscriberCount('RELIANCE')).toBe(2);
    });

    it('should handle client subscribing to multiple symbols', () => {
      const client = createMockSocket('client1') as any;

      gateway.handleConnection(client);
      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client);
      gateway.handleSubscribe({ event: 'subscribe', symbol: 'TCS' }, client);

      expect(gateway.getSubscribedSymbols()).toContain('RELIANCE');
      expect(gateway.getSubscribedSymbols()).toContain('TCS');
      expect(gateway.getSubscriberCount('RELIANCE')).toBe(1);
      expect(gateway.getSubscriberCount('TCS')).toBe(1);
    });

    it('should handle unsubscribe message', () => {
      const client = createMockSocket('client1') as any;

      gateway.handleConnection(client);
      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client);

      expect(gateway.getSubscriberCount('RELIANCE')).toBe(1);

      gateway.handleUnsubscribe({ event: 'unsubscribe', symbol: 'RELIANCE' }, client);

      expect(gateway.getSubscriberCount('RELIANCE')).toBe(0);
      expect(client.emit).toHaveBeenCalledWith('unsubscribed', {
        symbol: 'RELIANCE',
        timestamp: expect.any(String),
      });
    });

    it('should ignore invalid subscribe message without symbol', () => {
      const client = createMockSocket('client1') as any;

      gateway.handleConnection(client);
      gateway.handleSubscribe({ event: 'subscribe', symbol: '' }, client);

      expect(gateway.getSubscribedSymbols()).toHaveLength(0);
    });

    it('should ignore invalid unsubscribe message without symbol', () => {
      const client = createMockSocket('client1') as any;

      gateway.handleConnection(client);
      gateway.handleUnsubscribe({ event: 'unsubscribe', symbol: '' }, client);

      // Should not throw error
      expect(gateway.getSubscriberCount('')).toBe(0);
    });
  });

  describe('Price Update Broadcasting', () => {
    it('should broadcast price update to subscribed clients', () => {
      const client1 = createMockSocket('client1') as any;
      const client2 = createMockSocket('client2') as any;

      gateway.handleConnection(client1);
      gateway.handleConnection(client2);

      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client1);
      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client2);

      gateway.broadcastPriceUpdate('RELIANCE', 2500, 50, 2.0);

      expect(gateway.server.to).toHaveBeenCalledWith('client1');
      expect(gateway.server.to).toHaveBeenCalledWith('client2');
    });

    it('should not broadcast if no clients subscribed', () => {
      gateway.broadcastPriceUpdate('RELIANCE', 2500, 50, 2.0);

      expect(gateway.server.to).not.toHaveBeenCalled();
    });

    it('should only broadcast to clients subscribed to specific symbol', () => {
      const client1 = createMockSocket('client1') as any;
      const client2 = createMockSocket('client2') as any;

      gateway.handleConnection(client1);
      gateway.handleConnection(client2);

      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client1);
      gateway.handleSubscribe({ event: 'subscribe', symbol: 'TCS' }, client2);

      gateway.broadcastPriceUpdate('RELIANCE', 2500, 50, 2.0);

      expect(gateway.server.to).toHaveBeenCalledWith('client1');
      expect(gateway.server.to).not.toHaveBeenCalledWith('client2');
    });

    it('should include correct data in price update message', () => {
      const client = createMockSocket('client1') as any;

      gateway.handleConnection(client);
      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client);

      const mockEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: mockEmit });

      gateway.broadcastPriceUpdate('RELIANCE', 2500, 50, 2.0);

      expect(mockEmit).toHaveBeenCalledWith('priceUpdate', {
        event: 'priceUpdate',
        symbol: 'RELIANCE',
        price: 2500,
        change: 50,
        changePercent: 2.0,
        timestamp: expect.any(String),
      });
    });
  });

  describe('Portfolio Update Broadcasting', () => {
    it('should broadcast portfolio update to all clients', () => {
      const client1 = createMockSocket('client1') as any;
      const client2 = createMockSocket('client2') as any;

      gateway.handleConnection(client1);
      gateway.handleConnection(client2);

      gateway.broadcastPortfolioUpdate(25000, 1500);

      expect(gateway.server.emit).toHaveBeenCalledWith('portfolioUpdate', {
        event: 'portfolioUpdate',
        totalPnL: 25000,
        dailyPnL: 1500,
        timestamp: expect.any(String),
      });
    });

    it('should include correct data in portfolio update message', () => {
      gateway.broadcastPortfolioUpdate(25000, 1500);

      expect(gateway.server.emit).toHaveBeenCalledWith('portfolioUpdate', {
        event: 'portfolioUpdate',
        totalPnL: 25000,
        dailyPnL: 1500,
        timestamp: expect.any(String),
      });
    });

    it('should handle negative PnL values', () => {
      gateway.broadcastPortfolioUpdate(-5000, -800);

      expect(gateway.server.emit).toHaveBeenCalledWith('portfolioUpdate', {
        event: 'portfolioUpdate',
        totalPnL: -5000,
        dailyPnL: -800,
        timestamp: expect.any(String),
      });
    });
  });

  describe('Utility Methods', () => {
    it('should return list of subscribed symbols', () => {
      const client = createMockSocket('client1') as any;

      gateway.handleConnection(client);
      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client);
      gateway.handleSubscribe({ event: 'subscribe', symbol: 'TCS' }, client);

      const symbols = gateway.getSubscribedSymbols();

      expect(symbols).toHaveLength(2);
      expect(symbols).toContain('RELIANCE');
      expect(symbols).toContain('TCS');
    });

    it('should return subscriber count for symbol', () => {
      const client1 = createMockSocket('client1') as any;
      const client2 = createMockSocket('client2') as any;

      gateway.handleConnection(client1);
      gateway.handleConnection(client2);

      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client1);
      gateway.handleSubscribe({ event: 'subscribe', symbol: 'RELIANCE' }, client2);

      expect(gateway.getSubscriberCount('RELIANCE')).toBe(2);
      expect(gateway.getSubscriberCount('TCS')).toBe(0);
    });

    it('should return total connection count', () => {
      const client1 = createMockSocket('client1') as any;
      const client2 = createMockSocket('client2') as any;
      const client3 = createMockSocket('client3') as any;

      gateway.handleConnection(client1);
      gateway.handleConnection(client2);
      gateway.handleConnection(client3);

      expect(gateway.getConnectionCount()).toBe(3);

      gateway.handleDisconnect(client1);

      expect(gateway.getConnectionCount()).toBe(2);
    });
  });
});
