import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TradingModule } from './trading.module';
import { TradingService } from './trading.service';
import { PaperTradingService } from './paper-trading.service';
import { RiskService } from '../risk/risk.service';
import { PrismaService } from '../database/prisma.service';

describe('TradingController (E2E) - POST /api/trade/paper', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  const mockPrismaService = {
    paperTrade: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    tradeExecution: {
      create: jest.fn(),
    },
    portfolio: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    position: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    riskProfile: {
      findUnique: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TradingModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    app.setGlobalPrefix('api');
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock setup for successful trade
    mockPrismaService.riskProfile.findUnique.mockResolvedValue({
      id: 'risk-profile-123',
      userId: 'user-123',
      maxPositionSize: 100000,
      maxPortfolioExposure: 0.5,
      maxDrawdown: 0.1,
      maxOpenPositions: 10,
    });

    mockPrismaService.portfolio.findUnique.mockResolvedValue({
      id: 'portfolio-123',
      userId: 'user-123',
      totalValue: 1000000,
      cashBalance: 500000,
      investedValue: 500000,
      unrealizedPnL: 0,
      realizedPnL: 0,
      positions: [], // Include empty positions array
    });

    mockPrismaService.position.findFirst.mockResolvedValue(null);
    mockPrismaService.position.count.mockResolvedValue(0);

    mockPrismaService.paperTrade.create.mockResolvedValue({
      id: 'trade-123',
      userId: 'user-123',
      symbol: 'RELIANCE',
      direction: 'LONG',
      quantity: 10,
      entryPrice: 2502.5,
      status: 'OPEN',
    });

    mockPrismaService.tradeExecution.create.mockResolvedValue({});
    mockPrismaService.position.create.mockResolvedValue({
      id: 'position-123',
    });
  });

  describe('POST /api/trade/paper', () => {
    it('should execute a paper trade successfully', async () => {
      const tradeRequest = {
        userId: 'user-123',
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        stopLoss: 2450,
        target: 2600,
      };

      const response = await request(app.getHttpServer())
        .post('/api/trade/paper')
        .send(tradeRequest)
        .expect(201);

      expect(response.body).toHaveProperty('tradeId');
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('EXECUTED');
      expect(response.body).toHaveProperty('executedPrice');
      expect(response.body).toHaveProperty('slippage');
      expect(response.body).toHaveProperty('positionId');
      expect(response.body.positionId).toBe('position-123');
    });

    it('should validate trade with RiskService before execution', async () => {
      const tradeRequest = {
        userId: 'user-123',
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
      };

      await request(app.getHttpServer()).post('/api/trade/paper').send(tradeRequest).expect(201);

      // Verify risk validation was performed
      expect(mockPrismaService.riskProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should reject paper trade if risk validation fails', async () => {
      // Override mock to simulate position size violation
      mockPrismaService.riskProfile.findUnique.mockResolvedValue({
        id: 'risk-profile-123',
        userId: 'user-123',
        maxPositionSize: 10000, // Low limit
        maxPortfolioExposure: 0.5,
        maxDrawdown: 0.1,
        maxOpenPositions: 10,
      });

      const tradeRequest = {
        userId: 'user-123',
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 100, // Too large
        price: 2500,
      };

      const response = await request(app.getHttpServer())
        .post('/api/trade/paper')
        .send(tradeRequest)
        .expect(201);

      expect(response.body.status).toBe('FAILED');
      expect(response.body.error).toContain('Risk validation failed');
    });

    it('should validate request body with ValidationPipe', async () => {
      const invalidRequest = {
        userId: 'user-123',
        symbol: 'RELIANCE',
        action: 'INVALID_ACTION', // Invalid action
        quantity: 10,
        price: 2500,
      };

      await request(app.getHttpServer()).post('/api/trade/paper').send(invalidRequest).expect(400);
    });

    it('should reject request with missing required fields', async () => {
      const incompleteRequest = {
        userId: 'user-123',
        symbol: 'RELIANCE',
        // Missing action, quantity, price
      };

      await request(app.getHttpServer())
        .post('/api/trade/paper')
        .send(incompleteRequest)
        .expect(400);
    });

    it('should reject request with negative quantity', async () => {
      const invalidRequest = {
        userId: 'user-123',
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: -10, // Negative
        price: 2500,
      };

      await request(app.getHttpServer()).post('/api/trade/paper').send(invalidRequest).expect(400);
    });

    it('should reject request with negative price', async () => {
      const invalidRequest = {
        userId: 'user-123',
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: -2500, // Negative
      };

      await request(app.getHttpServer()).post('/api/trade/paper').send(invalidRequest).expect(400);
    });

    it('should accept optional stopLoss and target fields', async () => {
      const tradeRequest = {
        userId: 'user-123',
        symbol: 'TCS',
        action: 'BUY',
        quantity: 5,
        price: 3500,
        stopLoss: 3450,
        target: 3600,
      };

      const response = await request(app.getHttpServer())
        .post('/api/trade/paper')
        .send(tradeRequest)
        .expect(201);

      expect(response.body.status).toBe('EXECUTED');
    });

    it('should accept optional signalId field', async () => {
      const tradeRequest = {
        userId: 'user-123',
        symbol: 'INFY',
        action: 'SELL',
        quantity: 20,
        price: 1500,
        signalId: 'signal-456',
      };

      const response = await request(app.getHttpServer())
        .post('/api/trade/paper')
        .send(tradeRequest)
        .expect(201);

      expect(response.body.status).toBe('EXECUTED');
    });

    it('should handle SELL action correctly', async () => {
      mockPrismaService.paperTrade.create.mockResolvedValue({
        id: 'trade-456',
        userId: 'user-123',
        symbol: 'TCS',
        direction: 'SHORT',
        quantity: 5,
        entryPrice: 3497.5,
        status: 'OPEN',
      });

      const tradeRequest = {
        userId: 'user-123',
        symbol: 'TCS',
        action: 'SELL',
        quantity: 5,
        price: 3500,
      };

      const response = await request(app.getHttpServer())
        .post('/api/trade/paper')
        .send(tradeRequest)
        .expect(201);

      expect(response.body.status).toBe('EXECUTED');
    });

    it('should return trade result with simulated slippage', async () => {
      const tradeRequest = {
        userId: 'user-123',
        symbol: 'WIPRO',
        action: 'BUY',
        quantity: 15,
        price: 450,
      };

      const response = await request(app.getHttpServer())
        .post('/api/trade/paper')
        .send(tradeRequest)
        .expect(201);

      expect(response.body).toHaveProperty('slippage');
      expect(response.body.slippage).toBeGreaterThanOrEqual(0);
      // Slippage should be within 0-1% of price
      expect(response.body.slippage).toBeLessThanOrEqual(tradeRequest.price * 0.01);
    });
  });
});
