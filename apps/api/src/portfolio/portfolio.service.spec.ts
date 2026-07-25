import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioService, PositionInfo } from './portfolio.service';
import { PrismaService } from '../database/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';
import { NotFoundException } from '@nestjs/common';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let prismaService: any;
  let marketDataService: any;

  const mockUserId = 'user-123';
  const mockPortfolioId = 'portfolio-456';

  beforeEach(async () => {
    const mockPrismaService = {
      portfolio: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      position: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockMarketDataService = {
      getMarketData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MarketDataService,
          useValue: mockMarketDataService,
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    prismaService = module.get(PrismaService);
    marketDataService = module.get(MarketDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPortfolio', () => {
    it('should create a new portfolio if none exists', async () => {
      // Arrange
      prismaService.portfolio.findUnique.mockResolvedValue(null);
      prismaService.portfolio.create.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
        totalValue: 1000000,
        cashBalance: 1000000,
        investedValue: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        updatedAt: new Date(),
        positions: [],
      });
      prismaService.position.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getPortfolio(mockUserId);

      // Assert
      expect(prismaService.portfolio.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          totalValue: 1000000,
          cashBalance: 1000000,
          investedValue: 0,
          unrealizedPnL: 0,
          realizedPnL: 0,
        },
        include: {
          positions: true,
        },
      });
      expect(result.totalValue).toBe(1000000);
      expect(result.cashBalance).toBe(1000000);
      expect(result.positions).toHaveLength(0);
    });

    it('should retrieve existing portfolio and update position prices', async () => {
      // Arrange
      const mockPosition = {
        id: 'pos-1',
        portfolioId: mockPortfolioId,
        symbol: 'RELIANCE',
        quantity: 10,
        averagePrice: 2400,
        currentPrice: 2400, // Will be updated
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'OPEN',
        paperTradeId: null,
        liveTradeId: null,
        openedAt: new Date(),
        closedAt: null,
        updatedAt: new Date(),
      };

      prismaService.portfolio.findUnique.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
        totalValue: 1000000,
        cashBalance: 900000,
        investedValue: 24000,
        unrealizedPnL: 0,
        realizedPnL: 0,
        updatedAt: new Date(),
        positions: [mockPosition],
      });

      // Mock market data with updated price
      marketDataService.getMarketData.mockResolvedValue({
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: [
          {
            timestamp: new Date(),
            open: 2450,
            high: 2470,
            low: 2440,
            close: 2460, // Current price
            volume: 1000000,
          },
        ],
      });

      // Mock position update
      prismaService.position.update.mockResolvedValue({
        ...mockPosition,
        currentPrice: 2460,
        unrealizedPnL: 600, // (2460 - 2400) * 10 = 600
      });

      // Mock findMany to return updated positions (first call), then closed positions (second call)
      prismaService.position.findMany
        .mockResolvedValueOnce([
          {
            ...mockPosition,
            currentPrice: 2460,
            unrealizedPnL: 600,
          },
        ])
        .mockResolvedValueOnce([]); // For closed positions query in calculatePortfolioMetrics

      // Mock portfolio update
      prismaService.portfolio.update.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
        totalValue: 1000000,
        cashBalance: 900000,
        investedValue: 24000,
        unrealizedPnL: 600,
        realizedPnL: 0,
        updatedAt: new Date(),
      });

      // Act
      const result = await service.getPortfolio(mockUserId);

      // Assert
      expect(marketDataService.getMarketData).toHaveBeenCalledWith('RELIANCE', '1d');
      expect(prismaService.position.update).toHaveBeenCalled();
      expect(result.positions).toHaveLength(1);
      expect(result.positions[0].currentPrice).toBe(2460);
      expect(result.positions[0].unrealizedPnL).toBe(600);
      expect(result.positions[0].unrealizedPnLPercent).toBeCloseTo(2.5, 1);
    });

    it('should calculate total PnL correctly for multiple positions', async () => {
      // Arrange
      const positions = [
        {
          id: 'pos-1',
          portfolioId: mockPortfolioId,
          symbol: 'RELIANCE',
          quantity: 10,
          averagePrice: 2400,
          currentPrice: 2460,
          unrealizedPnL: 600,
          realizedPnL: 0,
          status: 'OPEN' as const,
          paperTradeId: null,
          liveTradeId: null,
          openedAt: new Date(),
          closedAt: null,
          updatedAt: new Date(),
        },
        {
          id: 'pos-2',
          portfolioId: mockPortfolioId,
          symbol: 'TCS',
          quantity: 5,
          averagePrice: 3500,
          currentPrice: 3450,
          unrealizedPnL: -250,
          realizedPnL: 0,
          status: 'OPEN' as const,
          paperTradeId: null,
          liveTradeId: null,
          openedAt: new Date(),
          closedAt: null,
          updatedAt: new Date(),
        },
      ];

      prismaService.portfolio.findUnique.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
        totalValue: 1000000,
        cashBalance: 850000,
        investedValue: 41500,
        unrealizedPnL: 0,
        realizedPnL: 0,
        updatedAt: new Date(),
        positions,
      });

      // Mock market data for both symbols
      marketDataService.getMarketData
        .mockResolvedValueOnce({
          symbol: 'RELIANCE',
          timeframe: '1d',
          data: [
            {
              timestamp: new Date(),
              open: 2450,
              high: 2470,
              low: 2440,
              close: 2460,
              volume: 1000000,
            },
          ],
        })
        .mockResolvedValueOnce({
          symbol: 'TCS',
          timeframe: '1d',
          data: [
            {
              timestamp: new Date(),
              open: 3480,
              high: 3490,
              low: 3440,
              close: 3450,
              volume: 500000,
            },
          ],
        });

      prismaService.position.update.mockResolvedValue(positions[0]);
      // First findMany call returns open positions, second returns closed positions for metrics
      prismaService.position.findMany.mockResolvedValueOnce(positions).mockResolvedValueOnce([]);
      prismaService.portfolio.update.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
        totalValue: 1000000,
        cashBalance: 850000,
        investedValue: 41500,
        unrealizedPnL: 350,
        realizedPnL: 0,
        updatedAt: new Date(),
      });

      // Act
      const result = await service.getPortfolio(mockUserId);

      // Assert
      expect(result.positions).toHaveLength(2);
      // Total PnL should be 600 + (-250) = 350
      expect(result.totalPnL).toBe(350);
    });

    it('should calculate portfolio exposure correctly', async () => {
      // Arrange
      const positions = [
        {
          id: 'pos-1',
          portfolioId: mockPortfolioId,
          symbol: 'RELIANCE',
          quantity: 100,
          averagePrice: 2400,
          currentPrice: 2500,
          unrealizedPnL: 10000,
          realizedPnL: 0,
          status: 'OPEN' as const,
          paperTradeId: null,
          liveTradeId: null,
          openedAt: new Date(),
          closedAt: null,
          updatedAt: new Date(),
        },
      ];

      prismaService.portfolio.findUnique.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
        totalValue: 1000000, // 10 lakh
        cashBalance: 750000,
        investedValue: 240000,
        unrealizedPnL: 0,
        realizedPnL: 0,
        updatedAt: new Date(),
        positions,
      });

      marketDataService.getMarketData.mockResolvedValue({
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: [
          {
            timestamp: new Date(),
            open: 2490,
            high: 2510,
            low: 2480,
            close: 2500,
            volume: 1000000,
          },
        ],
      });

      prismaService.position.update.mockResolvedValue(positions[0]);
      // First findMany call returns open positions, second returns closed positions for metrics
      prismaService.position.findMany.mockResolvedValueOnce(positions).mockResolvedValueOnce([]);
      prismaService.portfolio.update.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
        totalValue: 1000000,
        cashBalance: 750000,
        investedValue: 240000,
        unrealizedPnL: 10000,
        realizedPnL: 0,
        updatedAt: new Date(),
      });

      // Act
      const result = await service.getPortfolio(mockUserId);

      // Assert
      // Current position value: 100 * 2500 = 250000
      // Total exposure: 250000 / 1000000 = 0.25 (25%)
      expect(result.metrics.totalExposure).toBeCloseTo(0.25, 2);
      expect(result.metrics.openPositions).toBe(1);
    });
  });

  describe('updatePositionPrice', () => {
    it('should update position price and calculate PnL correctly', async () => {
      // Arrange
      const positionId = 'pos-1';
      const mockPosition = {
        id: positionId,
        portfolioId: mockPortfolioId,
        symbol: 'RELIANCE',
        quantity: 10,
        averagePrice: 2400,
        currentPrice: 2400,
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'OPEN' as const,
        paperTradeId: null,
        liveTradeId: null,
        openedAt: new Date(),
        closedAt: null,
        updatedAt: new Date(),
      };

      prismaService.position.findUnique.mockResolvedValue(mockPosition);
      prismaService.position.update.mockResolvedValue({
        ...mockPosition,
        currentPrice: 2500,
        unrealizedPnL: 1000, // (2500 - 2400) * 10 = 1000
      });

      // Act
      await service.updatePositionPrice(positionId, 2500);

      // Assert
      expect(prismaService.position.update).toHaveBeenCalledWith({
        where: { id: positionId },
        data: {
          currentPrice: 2500,
          unrealizedPnL: 1000,
        },
      });
    });

    it('should throw NotFoundException if position does not exist', async () => {
      // Arrange
      const positionId = 'nonexistent-pos';
      prismaService.position.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updatePositionPrice(positionId, 2500)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should calculate negative PnL correctly', async () => {
      // Arrange
      const positionId = 'pos-1';
      const mockPosition = {
        id: positionId,
        portfolioId: mockPortfolioId,
        symbol: 'TCS',
        quantity: 20,
        averagePrice: 3500,
        currentPrice: 3500,
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'OPEN' as const,
        paperTradeId: null,
        liveTradeId: null,
        openedAt: new Date(),
        closedAt: null,
        updatedAt: new Date(),
      };

      prismaService.position.findUnique.mockResolvedValue(mockPosition);
      prismaService.position.update.mockResolvedValue({
        ...mockPosition,
        currentPrice: 3400,
        unrealizedPnL: -2000, // (3400 - 3500) * 20 = -2000
      });

      // Act
      await service.updatePositionPrice(positionId, 3400);

      // Assert
      expect(prismaService.position.update).toHaveBeenCalledWith({
        where: { id: positionId },
        data: {
          currentPrice: 3400,
          unrealizedPnL: -2000,
        },
      });
    });
  });

  describe('getOpenPositions', () => {
    it('should return empty array if portfolio does not exist', async () => {
      // Arrange
      prismaService.portfolio.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.getOpenPositions(mockUserId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should return all open positions with updated prices', async () => {
      // Arrange
      const positions = [
        {
          id: 'pos-1',
          portfolioId: mockPortfolioId,
          symbol: 'RELIANCE',
          quantity: 10,
          averagePrice: 2400,
          currentPrice: 2400,
          unrealizedPnL: 0,
          realizedPnL: 0,
          status: 'OPEN' as const,
          paperTradeId: null,
          liveTradeId: null,
          openedAt: new Date(),
          closedAt: null,
          updatedAt: new Date(),
        },
        {
          id: 'pos-2',
          portfolioId: mockPortfolioId,
          symbol: 'TCS',
          quantity: 5,
          averagePrice: 3500,
          currentPrice: 3500,
          unrealizedPnL: 0,
          realizedPnL: 0,
          status: 'OPEN' as const,
          paperTradeId: 'paper-123',
          liveTradeId: null,
          openedAt: new Date(),
          closedAt: null,
          updatedAt: new Date(),
        },
      ];

      prismaService.portfolio.findUnique.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
        totalValue: 1000000,
        cashBalance: 900000,
        investedValue: 41500,
        unrealizedPnL: 0,
        realizedPnL: 0,
        updatedAt: new Date(),
        positions,
      });

      marketDataService.getMarketData
        .mockResolvedValueOnce({
          symbol: 'RELIANCE',
          timeframe: '1d',
          data: [
            {
              timestamp: new Date(),
              open: 2450,
              high: 2470,
              low: 2440,
              close: 2460,
              volume: 1000000,
            },
          ],
        })
        .mockResolvedValueOnce({
          symbol: 'TCS',
          timeframe: '1d',
          data: [
            {
              timestamp: new Date(),
              open: 3480,
              high: 3490,
              low: 3440,
              close: 3450,
              volume: 500000,
            },
          ],
        });

      prismaService.position.update.mockResolvedValue(positions[0]);
      prismaService.position.findMany.mockResolvedValue([
        { ...positions[0], currentPrice: 2460, unrealizedPnL: 600 },
        { ...positions[1], currentPrice: 3450, unrealizedPnL: -250 },
      ]);

      // Act
      const result = await service.getOpenPositions(mockUserId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('RELIANCE');
      expect(result[0].currentPrice).toBe(2460);
      expect(result[0].unrealizedPnL).toBe(600);
      expect(result[0].isPaper).toBe(false);
      expect(result[1].symbol).toBe('TCS');
      expect(result[1].currentPrice).toBe(3450);
      expect(result[1].unrealizedPnL).toBe(-250);
      expect(result[1].isPaper).toBe(true);
    });
  });

  describe('PnL Calculation Edge Cases', () => {
    it('should handle zero average price correctly', async () => {
      // Arrange
      const positionId = 'pos-1';
      const mockPosition = {
        id: positionId,
        portfolioId: mockPortfolioId,
        symbol: 'TEST',
        quantity: 10,
        averagePrice: 0,
        currentPrice: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'OPEN' as const,
        paperTradeId: null,
        liveTradeId: null,
        openedAt: new Date(),
        closedAt: null,
        updatedAt: new Date(),
      };

      prismaService.portfolio.findUnique.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
        totalValue: 1000000,
        cashBalance: 1000000,
        investedValue: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        updatedAt: new Date(),
        positions: [mockPosition],
      });

      marketDataService.getMarketData.mockResolvedValue({
        symbol: 'TEST',
        timeframe: '1d',
        data: [
          {
            timestamp: new Date(),
            open: 100,
            high: 110,
            low: 90,
            close: 100,
            volume: 1000,
          },
        ],
      });

      prismaService.position.update.mockResolvedValue(mockPosition);
      // First findMany call returns open positions, second returns closed positions for metrics
      prismaService.position.findMany
        .mockResolvedValueOnce([{ ...mockPosition, currentPrice: 100 }])
        .mockResolvedValueOnce([]);
      prismaService.portfolio.update.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
        totalValue: 1000000,
        cashBalance: 1000000,
        investedValue: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        updatedAt: new Date(),
      });

      // Act
      const result = await service.getPortfolio(mockUserId);

      // Assert
      expect(result.positions[0].unrealizedPnLPercent).toBe(0);
    });

    it('should handle market data fetch failure gracefully', async () => {
      // Arrange
      const mockPosition = {
        id: 'pos-1',
        portfolioId: mockPortfolioId,
        symbol: 'INVALID',
        quantity: 10,
        averagePrice: 2400,
        currentPrice: 2400,
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'OPEN' as const,
        paperTradeId: null,
        liveTradeId: null,
        openedAt: new Date(),
        closedAt: null,
        updatedAt: new Date(),
      };

      prismaService.portfolio.findUnique.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
        totalValue: 1000000,
        cashBalance: 900000,
        investedValue: 24000,
        unrealizedPnL: 0,
        realizedPnL: 0,
        updatedAt: new Date(),
        positions: [mockPosition],
      });

      // Mock market data fetch failure
      marketDataService.getMarketData.mockRejectedValue(new Error('Market data unavailable'));

      // First findMany call returns open positions, second returns closed positions for metrics
      prismaService.position.findMany
        .mockResolvedValueOnce([mockPosition])
        .mockResolvedValueOnce([]);
      prismaService.portfolio.update.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
        totalValue: 1000000,
        cashBalance: 900000,
        investedValue: 24000,
        unrealizedPnL: 0,
        realizedPnL: 0,
        updatedAt: new Date(),
      });

      // Act
      const result = await service.getPortfolio(mockUserId);

      // Assert - Should not throw, should use existing price
      expect(result).toBeDefined();
      expect(result.positions[0].currentPrice).toBe(2400);
    });
  });
});
