import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioService, OptionsPositionInfo } from './portfolio.service';
import { PrismaService } from '../database/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';

describe('PortfolioService - Options Positions', () => {
  let service: PortfolioService;
  let prismaService: any;
  let marketDataService: any;
  let quantService: any;

  const mockUserId = 'user-123';
  const mockPortfolioId = 'portfolio-456';

  beforeEach(async () => {
    const mockPrismaService = {
      portfolio: {
        findUnique: jest.fn(),
      },
      position: {
        findMany: jest.fn(),
      },
      optionsPosition: {
        update: jest.fn(),
      },
    };

    const mockMarketDataService = {
      getMarketData: jest.fn(),
    };

    const mockQuantService = {
      processOptionsChain: jest.fn(),
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
        {
          provide: QuantService,
          useValue: mockQuantService,
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    prismaService = module.get(PrismaService);
    marketDataService = module.get(MarketDataService);
    quantService = module.get(QuantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOptionsPositions', () => {
    it('should return empty array if portfolio does not exist', async () => {
      // Arrange
      prismaService.portfolio.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.getOptionsPositions(mockUserId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should return empty array if no options positions exist', async () => {
      // Arrange
      prismaService.portfolio.findUnique.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
      });

      prismaService.position.findMany.mockResolvedValue([
        {
          id: 'pos-1',
          symbol: 'RELIANCE',
          OptionsPosition: null, // Not an options position
        },
      ]);

      // Act
      const result = await service.getOptionsPositions(mockUserId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should calculate Greeks and P&L for options positions', async () => {
      // Arrange
      const now = new Date();
      const expiryDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now

      prismaService.portfolio.findUnique.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
      });

      prismaService.position.findMany.mockResolvedValue([
        {
          id: 'pos-1',
          portfolioId: mockPortfolioId,
          symbol: 'NIFTY',
          quantity: 50,
          averagePrice: 100,
          currentPrice: 120,
          status: 'OPEN',
          paperTradeId: null,
          OptionsPosition: {
            id: 'opt-1',
            positionId: 'pos-1',
            symbol: 'NIFTY',
            strikePrice: 21500,
            optionType: 'CALL',
            expiry: expiryDate,
            entryPrice: 100,
            quantity: 50,
            greeks: null,
            isPaper: false,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);

      // Mock spot price fetch
      marketDataService.getMarketData.mockResolvedValue({
        symbol: 'NIFTY',
        timeframe: '1d',
        data: [
          {
            timestamp: now,
            open: 21480,
            high: 21550,
            low: 21470,
            close: 21520,
            volume: 1000000,
          },
        ],
      });

      // Mock Greeks calculation
      quantService.processOptionsChain.mockResolvedValue({
        symbol: 'NIFTY',
        expiry: expiryDate,
        spotPrice: 21520,
        timestamp: now,
        totalContracts: 1,
        liquidContracts: 1,
        illiquidContracts: 0,
        contracts: [
          {
            strikePrice: 21500,
            optionType: 'CALL',
            ltp: 120,
            openInterest: 50000,
            volume: 10000,
            greeks: {
              delta: 0.52,
              gamma: 0.003,
              theta: -12.5,
              vega: 45.2,
            },
            iv: 0.15,
            liquidityWarnings: [],
            isLiquid: true,
          },
        ],
      });

      // Act
      const result = await service.getOptionsPositions(mockUserId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('NIFTY');
      expect(result[0].strikePrice).toBe(21500);
      expect(result[0].optionType).toBe('CALL');
      expect(result[0].quantity).toBe(50);
      expect(result[0].entryPrice).toBe(100);
      expect(result[0].currentPrice).toBe(120);
      expect(result[0].unrealizedPnL).toBe(1000); // (120 - 100) * 50 = 1000
      expect(result[0].unrealizedPnLPercent).toBeCloseTo(20, 1); // 20%
      expect(result[0].greeks.delta).toBe(0.52);
      expect(result[0].greeks.gamma).toBe(0.003);
      expect(result[0].greeks.theta).toBe(-12.5);
      expect(result[0].greeks.vega).toBe(45.2);
      expect(result[0].daysToExpiry).toBe(10);
      expect(result[0].isExpiringSoon).toBe(false);
      expect(result[0].expiryAlert).toBeUndefined();
    });

    it('should identify expiring positions and generate alerts', async () => {
      // Arrange
      const now = new Date();
      const expiryDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

      prismaService.portfolio.findUnique.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
      });

      prismaService.position.findMany.mockResolvedValue([
        {
          id: 'pos-1',
          portfolioId: mockPortfolioId,
          symbol: 'NIFTY',
          quantity: 50,
          averagePrice: 100,
          currentPrice: 120,
          status: 'OPEN',
          paperTradeId: null,
          OptionsPosition: {
            id: 'opt-1',
            positionId: 'pos-1',
            symbol: 'NIFTY',
            strikePrice: 21500,
            optionType: 'CALL',
            expiry: expiryDate,
            entryPrice: 100,
            quantity: 50,
            greeks: {
              delta: 0.52,
              gamma: 0.003,
              theta: -12.5,
              vega: 45.2,
            },
            isPaper: false,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);

      // Mock spot price fetch
      marketDataService.getMarketData.mockResolvedValue({
        symbol: 'NIFTY',
        timeframe: '1d',
        data: [
          {
            timestamp: now,
            open: 21480,
            high: 21550,
            low: 21470,
            close: 21520,
            volume: 1000000,
          },
        ],
      });

      // Act
      const result = await service.getOptionsPositions(mockUserId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].daysToExpiry).toBe(3);
      expect(result[0].isExpiringSoon).toBe(true);
      expect(result[0].expiryAlert).toContain('Expires in 3 days');
    });

    it('should generate EXPIRES TODAY alert for same-day expiry', async () => {
      // Arrange
      const now = new Date();
      const expiryDate = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour from now (same day)

      prismaService.portfolio.findUnique.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
      });

      prismaService.position.findMany.mockResolvedValue([
        {
          id: 'pos-1',
          portfolioId: mockPortfolioId,
          symbol: 'NIFTY',
          quantity: 50,
          averagePrice: 100,
          currentPrice: 50,
          status: 'OPEN',
          paperTradeId: null,
          OptionsPosition: {
            id: 'opt-1',
            positionId: 'pos-1',
            symbol: 'NIFTY',
            strikePrice: 21500,
            optionType: 'PUT',
            expiry: expiryDate,
            entryPrice: 100,
            quantity: 50,
            greeks: {
              delta: -0.25,
              gamma: 0.001,
              theta: -20.0,
              vega: 30.5,
            },
            isPaper: false,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);

      // Mock spot price fetch
      marketDataService.getMarketData.mockResolvedValue({
        symbol: 'NIFTY',
        timeframe: '1d',
        data: [
          {
            timestamp: now,
            open: 21600,
            high: 21650,
            low: 21580,
            close: 21620,
            volume: 1000000,
          },
        ],
      });

      // Act
      const result = await service.getOptionsPositions(mockUserId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].daysToExpiry).toBe(0);
      expect(result[0].isExpiringSoon).toBe(true);
      expect(result[0].expiryAlert).toContain('EXPIRES TODAY');
    });

    it('should handle multiple options positions from different underlyings', async () => {
      // Arrange
      const now = new Date();
      const niftyExpiry = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      const bankniftyExpiry = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      prismaService.portfolio.findUnique.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
      });

      prismaService.position.findMany.mockResolvedValue([
        {
          id: 'pos-1',
          portfolioId: mockPortfolioId,
          symbol: 'NIFTY',
          quantity: 50,
          averagePrice: 100,
          currentPrice: 120,
          status: 'OPEN',
          paperTradeId: null,
          OptionsPosition: {
            id: 'opt-1',
            positionId: 'pos-1',
            symbol: 'NIFTY',
            strikePrice: 21500,
            optionType: 'CALL',
            expiry: niftyExpiry,
            entryPrice: 100,
            quantity: 50,
            greeks: {
              delta: 0.52,
              gamma: 0.003,
              theta: -12.5,
              vega: 45.2,
            },
            isPaper: false,
            createdAt: now,
            updatedAt: now,
          },
        },
        {
          id: 'pos-2',
          portfolioId: mockPortfolioId,
          symbol: 'BANKNIFTY',
          quantity: 25,
          averagePrice: 200,
          currentPrice: 180,
          status: 'OPEN',
          paperTradeId: null,
          OptionsPosition: {
            id: 'opt-2',
            positionId: 'pos-2',
            symbol: 'BANKNIFTY',
            strikePrice: 46000,
            optionType: 'PUT',
            expiry: bankniftyExpiry,
            entryPrice: 200,
            quantity: 25,
            greeks: {
              delta: -0.45,
              gamma: 0.002,
              theta: -15.0,
              vega: 35.0,
            },
            isPaper: false,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);

      // Mock spot price fetches
      marketDataService.getMarketData
        .mockResolvedValueOnce({
          symbol: 'NIFTY',
          timeframe: '1d',
          data: [{ timestamp: now, open: 21480, high: 21550, low: 21470, close: 21520, volume: 1000000 }],
        })
        .mockResolvedValueOnce({
          symbol: 'BANKNIFTY',
          timeframe: '1d',
          data: [{ timestamp: now, open: 45980, high: 46050, low: 45950, close: 46020, volume: 500000 }],
        });

      // Act
      const result = await service.getOptionsPositions(mockUserId);

      // Assert
      expect(result).toHaveLength(2);
      
      // NIFTY position
      expect(result[0].symbol).toBe('NIFTY');
      expect(result[0].optionType).toBe('CALL');
      expect(result[0].unrealizedPnL).toBe(1000); // (120 - 100) * 50
      expect(result[0].isExpiringSoon).toBe(false);
      
      // BANKNIFTY position
      expect(result[1].symbol).toBe('BANKNIFTY');
      expect(result[1].optionType).toBe('PUT');
      expect(result[1].unrealizedPnL).toBe(-500); // (180 - 200) * 25
      expect(result[1].isExpiringSoon).toBe(true);
      expect(result[1].expiryAlert).toContain('Expires in 5 days');
    });

    it('should handle Greeks calculation failure gracefully', async () => {
      // Arrange
      const now = new Date();
      const expiryDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      prismaService.portfolio.findUnique.mockResolvedValue({
        id: mockPortfolioId,
        userId: mockUserId,
      });

      prismaService.position.findMany.mockResolvedValue([
        {
          id: 'pos-1',
          portfolioId: mockPortfolioId,
          symbol: 'NIFTY',
          quantity: 50,
          averagePrice: 100,
          currentPrice: 120,
          status: 'OPEN',
          paperTradeId: null,
          OptionsPosition: {
            id: 'opt-1',
            positionId: 'pos-1',
            symbol: 'NIFTY',
            strikePrice: 21500,
            optionType: 'CALL',
            expiry: expiryDate,
            entryPrice: 100,
            quantity: 50,
            greeks: null,
            isPaper: false,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);

      // Mock spot price fetch
      marketDataService.getMarketData.mockResolvedValue({
        symbol: 'NIFTY',
        timeframe: '1d',
        data: [
          {
            timestamp: now,
            open: 21480,
            high: 21550,
            low: 21470,
            close: 21520,
            volume: 1000000,
          },
        ],
      });

      // Mock Greeks calculation failure
      quantService.processOptionsChain.mockRejectedValue(new Error('Quant Engine unavailable'));

      // Act
      const result = await service.getOptionsPositions(mockUserId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].greeks).toEqual({ delta: 0, gamma: 0, theta: 0, vega: 0 });
      expect(result[0].unrealizedPnL).toBe(1000); // P&L still calculated
    });
  });
});
