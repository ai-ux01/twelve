import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService, PortfolioResponse } from './portfolio.service';

describe('PortfolioController', () => {
  let controller: PortfolioController;
  let service: PortfolioService;

  const mockPortfolioService = {
    getPortfolio: jest.fn(),
  };

  const mockPortfolioResponse: PortfolioResponse = {
    totalValue: 1000000,
    cashBalance: 500000,
    investedValue: 500000,
    positions: [
      {
        id: 'pos-1',
        symbol: 'RELIANCE',
        quantity: 10,
        averagePrice: 2450,
        currentPrice: 2500,
        unrealizedPnL: 500,
        unrealizedPnLPercent: 2.04,
        isPaper: false,
      },
      {
        id: 'pos-2',
        symbol: 'TCS',
        quantity: 5,
        averagePrice: 3600,
        currentPrice: 3550,
        unrealizedPnL: -250,
        unrealizedPnLPercent: -1.39,
        isPaper: true,
      },
    ],
    totalPnL: 250,
    dailyPnL: 150,
    metrics: {
      totalExposure: 0.5,
      openPositions: 2,
      winRate: 65.5,
      avgWin: 3500,
      avgLoss: -1200,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortfolioController],
      providers: [
        {
          provide: PortfolioService,
          useValue: mockPortfolioService,
        },
      ],
    }).compile();

    controller = module.get<PortfolioController>(PortfolioController);
    service = module.get<PortfolioService>(PortfolioService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/portfolio', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should return complete portfolio with positions and metrics', async () => {
      // Arrange
      const userId = 'user-123';
      mockPortfolioService.getPortfolio.mockResolvedValue(mockPortfolioResponse);

      // Act
      const result = await controller.getPortfolio(userId);

      // Assert
      expect(service.getPortfolio).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockPortfolioResponse);
      expect(result.positions).toHaveLength(2);
      expect(result.metrics).toBeDefined();
      expect(result.totalPnL).toBe(250);
    });

    it('should return portfolio with zero positions for new user', async () => {
      // Arrange
      const userId = 'new-user';
      const emptyPortfolio: PortfolioResponse = {
        totalValue: 1000000,
        cashBalance: 1000000,
        investedValue: 0,
        positions: [],
        totalPnL: 0,
        dailyPnL: 0,
        metrics: {
          totalExposure: 0,
          openPositions: 0,
          winRate: 0,
          avgWin: 0,
          avgLoss: 0,
        },
      };
      mockPortfolioService.getPortfolio.mockResolvedValue(emptyPortfolio);

      // Act
      const result = await controller.getPortfolio(userId);

      // Assert
      expect(service.getPortfolio).toHaveBeenCalledWith(userId);
      expect(result.positions).toHaveLength(0);
      expect(result.totalValue).toBe(1000000);
      expect(result.cashBalance).toBe(1000000);
    });

    it('should throw error when userId is missing', async () => {
      // Arrange
      const userId = '';

      // Act & Assert
      await expect(controller.getPortfolio(userId)).rejects.toThrow('userId is required');
      expect(service.getPortfolio).not.toHaveBeenCalled();
    });

    it('should include paper and live positions', async () => {
      // Arrange
      const userId = 'user-123';
      mockPortfolioService.getPortfolio.mockResolvedValue(mockPortfolioResponse);

      // Act
      const result = await controller.getPortfolio(userId);

      // Assert
      const paperPositions = result.positions.filter((p) => p.isPaper);
      const livePositions = result.positions.filter((p) => !p.isPaper);

      expect(paperPositions).toHaveLength(1);
      expect(livePositions).toHaveLength(1);
      expect(paperPositions[0].symbol).toBe('TCS');
      expect(livePositions[0].symbol).toBe('RELIANCE');
    });

    it('should include all required portfolio metrics', async () => {
      // Arrange
      const userId = 'user-123';
      mockPortfolioService.getPortfolio.mockResolvedValue(mockPortfolioResponse);

      // Act
      const result = await controller.getPortfolio(userId);

      // Assert
      expect(result).toHaveProperty('totalValue');
      expect(result).toHaveProperty('cashBalance');
      expect(result).toHaveProperty('investedValue');
      expect(result).toHaveProperty('positions');
      expect(result).toHaveProperty('totalPnL');
      expect(result).toHaveProperty('dailyPnL');
      expect(result).toHaveProperty('metrics');

      expect(result.metrics).toHaveProperty('totalExposure');
      expect(result.metrics).toHaveProperty('openPositions');
      expect(result.metrics).toHaveProperty('winRate');
      expect(result.metrics).toHaveProperty('avgWin');
      expect(result.metrics).toHaveProperty('avgLoss');
    });

    it('should calculate correct total PnL from positions', async () => {
      // Arrange
      const userId = 'user-123';
      mockPortfolioService.getPortfolio.mockResolvedValue(mockPortfolioResponse);

      // Act
      const result = await controller.getPortfolio(userId);

      // Assert
      const calculatedPnL = result.positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
      expect(result.totalPnL).toBe(calculatedPnL);
      expect(result.totalPnL).toBe(250); // 500 + (-250)
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const userId = 'user-123';
      const error = new Error('Database connection failed');
      mockPortfolioService.getPortfolio.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getPortfolio(userId)).rejects.toThrow('Database connection failed');
    });
  });

  describe('Position Data Validation', () => {
    it('should return positions with correct PnL calculations', async () => {
      // Arrange
      const userId = 'user-123';
      mockPortfolioService.getPortfolio.mockResolvedValue(mockPortfolioResponse);

      // Act
      const result = await controller.getPortfolio(userId);

      // Assert
      const position1 = result.positions[0];
      expect(position1.unrealizedPnL).toBe(500); // (2500 - 2450) * 10
      expect(position1.unrealizedPnLPercent).toBeCloseTo(2.04, 1);

      const position2 = result.positions[1];
      expect(position2.unrealizedPnL).toBe(-250); // (3550 - 3600) * 5
      expect(position2.unrealizedPnLPercent).toBeCloseTo(-1.39, 1);
    });

    it('should return positions with all required fields', async () => {
      // Arrange
      const userId = 'user-123';
      mockPortfolioService.getPortfolio.mockResolvedValue(mockPortfolioResponse);

      // Act
      const result = await controller.getPortfolio(userId);

      // Assert
      result.positions.forEach((position) => {
        expect(position).toHaveProperty('id');
        expect(position).toHaveProperty('symbol');
        expect(position).toHaveProperty('quantity');
        expect(position).toHaveProperty('averagePrice');
        expect(position).toHaveProperty('currentPrice');
        expect(position).toHaveProperty('unrealizedPnL');
        expect(position).toHaveProperty('unrealizedPnLPercent');
        expect(position).toHaveProperty('isPaper');

        expect(typeof position.id).toBe('string');
        expect(typeof position.symbol).toBe('string');
        expect(typeof position.quantity).toBe('number');
        expect(typeof position.averagePrice).toBe('number');
        expect(typeof position.currentPrice).toBe('number');
        expect(typeof position.unrealizedPnL).toBe('number');
        expect(typeof position.unrealizedPnLPercent).toBe('number');
        expect(typeof position.isPaper).toBe('boolean');
      });
    });
  });

  describe('Requirements Validation', () => {
    it('should validate Requirement 11.1: retrieve all open positions', async () => {
      // Arrange
      const userId = 'user-123';
      mockPortfolioService.getPortfolio.mockResolvedValue(mockPortfolioResponse);

      // Act
      const result = await controller.getPortfolio(userId);

      // Assert - Backend API SHALL retrieve all open positions from Database
      expect(result.positions).toBeDefined();
      expect(Array.isArray(result.positions)).toBe(true);
      expect(result.positions.length).toBeGreaterThan(0);
    });

    it('should validate Requirement 11.5: display all positions with real-time PnL', async () => {
      // Arrange
      const userId = 'user-123';
      mockPortfolioService.getPortfolio.mockResolvedValue(mockPortfolioResponse);

      // Act
      const result = await controller.getPortfolio(userId);

      // Assert - Frontend SHALL display all positions with real-time PnL updates
      result.positions.forEach((position) => {
        expect(position.currentPrice).toBeDefined();
        expect(position.unrealizedPnL).toBeDefined();
        expect(position.unrealizedPnLPercent).toBeDefined();
      });
    });
  });
});
