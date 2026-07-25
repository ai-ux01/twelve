import { Test, TestingModule } from '@nestjs/testing';
import { TradingService } from './trading.service';
import { PaperTradingService } from './paper-trading.service';
import { RiskService } from '../risk/risk.service';
import { PrismaService } from '../database/prisma.service';

describe('TradingService Integration with PaperTradingService', () => {
  let tradingService: TradingService;
  let paperTradingService: PaperTradingService;
  let riskService: RiskService;

  const mockRiskService = {
    validateTrade: jest.fn(),
  };

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
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradingService,
        PaperTradingService,
        {
          provide: RiskService,
          useValue: mockRiskService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    tradingService = module.get<TradingService>(TradingService);
    paperTradingService = module.get<PaperTradingService>(PaperTradingService);
    riskService = module.get<RiskService>(RiskService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should delegate paper trade execution to PaperTradingService', async () => {
    const userId = 'user-123';
    const tradeRequest = {
      symbol: 'RELIANCE',
      action: 'BUY' as const,
      quantity: 10,
      price: 2500,
      stopLoss: 2450,
      target: 2600,
    };

    // Mock risk validation to pass
    mockRiskService.validateTrade.mockResolvedValue({
      passed: true,
      violations: [],
    });

    // Mock database responses
    mockPrismaService.paperTrade.create.mockResolvedValue({
      id: 'trade-123',
      userId,
      symbol: 'RELIANCE',
      direction: 'LONG',
      quantity: 10,
      entryPrice: 2502.5,
      status: 'OPEN',
    });

    mockPrismaService.tradeExecution.create.mockResolvedValue({});
    mockPrismaService.portfolio.findUnique.mockResolvedValue({
      id: 'portfolio-123',
      userId,
    });
    mockPrismaService.position.findFirst.mockResolvedValue(null);
    mockPrismaService.position.create.mockResolvedValue({
      id: 'position-123',
    });

    // Execute paper trade through TradingService
    const result = await tradingService.executePaperTrade(userId, tradeRequest);

    // Verify results
    expect(result.status).toBe('EXECUTED');
    expect(result.tradeId).toBe('trade-123');
    expect(result.executedPrice).toBeDefined();
    expect(result.slippage).toBeDefined();
    expect(result.positionId).toBe('position-123');

    // Verify risk validation was called
    expect(mockRiskService.validateTrade).toHaveBeenCalledWith(userId, tradeRequest);

    // Verify database operations were performed
    expect(mockPrismaService.paperTrade.create).toHaveBeenCalled();
    expect(mockPrismaService.tradeExecution.create).toHaveBeenCalled();
  });

  it('should reject paper trade if risk validation fails', async () => {
    const userId = 'user-123';
    const tradeRequest = {
      symbol: 'RELIANCE',
      action: 'BUY' as const,
      quantity: 1000, // Too large
      price: 2500,
    };

    // Mock risk validation to fail
    mockRiskService.validateTrade.mockResolvedValue({
      passed: false,
      violations: [
        {
          rule: 'MAX_POSITION_SIZE',
          message: 'Position size exceeds maximum allowed',
          severity: 'ERROR',
        },
      ],
    });

    const result = await tradingService.executePaperTrade(userId, tradeRequest);

    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('Risk validation failed');
    expect(result.error).toContain('Position size exceeds maximum allowed');

    // Verify paper trading service was not called
    expect(mockPrismaService.paperTrade.create).not.toHaveBeenCalled();
  });

  it('should include positionId in the response', async () => {
    const userId = 'user-123';
    const tradeRequest = {
      symbol: 'TCS',
      action: 'BUY' as const,
      quantity: 5,
      price: 3500,
    };

    mockRiskService.validateTrade.mockResolvedValue({
      passed: true,
      violations: [],
    });

    mockPrismaService.paperTrade.create.mockResolvedValue({
      id: 'trade-456',
      status: 'OPEN',
    });

    mockPrismaService.tradeExecution.create.mockResolvedValue({});
    mockPrismaService.portfolio.findUnique.mockResolvedValue({
      id: 'portfolio-123',
      userId,
    });
    mockPrismaService.position.findFirst.mockResolvedValue(null);
    mockPrismaService.position.create.mockResolvedValue({
      id: 'position-456',
    });

    const result = await tradingService.executePaperTrade(userId, tradeRequest);

    expect(result.positionId).toBe('position-456');
  });
});
