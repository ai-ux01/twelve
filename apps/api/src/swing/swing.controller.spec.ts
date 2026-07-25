import { Test, TestingModule } from '@nestjs/testing';
import { SwingController } from './swing.controller';
import { SwingService } from './swing.service';
import { ScoringWeightsService } from './scoring-weights.service';

describe('SwingController', () => {
  let controller: SwingController;
  let service: SwingService;

  const mockSwingService = {
    scanStockUniverse: jest.fn(),
    analyzeSymbol: jest.fn(),
    getRecommendations: jest.fn(),
  };

  const mockScoringWeightsService = {
    getWeights: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SwingController],
      providers: [
        {
          provide: SwingService,
          useValue: mockSwingService,
        },
        {
          provide: ScoringWeightsService,
          useValue: mockScoringWeightsService,
        },
      ],
    }).compile();

    controller = module.get<SwingController>(SwingController);
    service = module.get<SwingService>(SwingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Module Structure', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have SwingService injected', () => {
      expect(service).toBeDefined();
    });
  });

  describe('GET /swing/health', () => {
    it('should return health check status', async () => {
      // Act
      const result = await controller.health();

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.module).toBe('swing-trading');
      expect(result.timestamp).toBeDefined();
    });

    it('should return ISO timestamp', async () => {
      // Act
      const result = await controller.health();

      // Assert
      const timestamp = new Date(result.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toISOString()).toBe(result.timestamp);
    });
  });

  describe('POST /swing/scan', () => {
    it('should call SwingService.scanStockUniverse', async () => {
      // Arrange
      const scanRequest = {
        minScore: 60,
        maxResults: 20,
      };
      const mockResponse = {
        scannedCount: 150,
        candidatesFound: 10,
        candidates: [],
      };
      mockSwingService.scanStockUniverse.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.scanStockUniverse(scanRequest);

      // Assert
      expect(service.scanStockUniverse).toHaveBeenCalledWith(scanRequest);
      expect(result).toEqual(mockResponse);
    });

    it('should accept scan request with sector filter', async () => {
      // Arrange
      const scanRequest = {
        minScore: 70,
        sectorFilter: 'Banking',
        maxResults: 10,
      };
      const mockResponse = {
        scannedCount: 50,
        candidatesFound: 5,
        candidates: [],
      };
      mockSwingService.scanStockUniverse.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.scanStockUniverse(scanRequest);

      // Assert
      expect(service.scanStockUniverse).toHaveBeenCalledWith(scanRequest);
      expect(result).toBeDefined();
    });
  });

  describe('POST /swing/analyze/:symbol', () => {
    it('should return analysis endpoint status for given symbol', async () => {
      // Arrange
      const symbol = 'RELIANCE';
      const analysisRequest = { timeframe: '1d' };

      // Act
      const result = await controller.analyzeSymbol(symbol, analysisRequest);

      // Assert
      expect(result).toBeDefined();
      expect(result.message).toContain('RELIANCE');
      expect(result.status).toBe('not_implemented');
    });

    it('should accept different symbols', async () => {
      // Arrange
      const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFC'];
      const analysisRequest = { timeframe: '1d' };

      // Act & Assert
      for (const symbol of symbols) {
        const result = await controller.analyzeSymbol(symbol, analysisRequest);
        expect(result.message).toContain(symbol);
      }
    });

    it('should accept analysis request body', async () => {
      // Arrange
      const symbol = 'TCS';
      const analysisRequest = {
        timeframe: '1d',
        indicators: ['RSI', 'MACD', 'EMA'],
      };

      // Act
      const result = await controller.analyzeSymbol(symbol, analysisRequest);

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe('GET /swing/recommendations', () => {
    it('should return recommendations endpoint status', async () => {
      // Act
      const result = await controller.getRecommendations();

      // Assert
      expect(result).toBeDefined();
      expect(result.message).toBe('Swing trading recommendations endpoint ready');
      expect(result.status).toBe('not_implemented');
      expect(result.recommendations).toEqual([]);
    });

    it('should return empty recommendations array', async () => {
      // Act
      const result = await controller.getRecommendations();

      // Assert
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations).toHaveLength(0);
    });
  });

  describe('Requirements Validation', () => {
    it('should validate Requirement 5.1: swing trade analysis endpoints exist', async () => {
      // Assert - Backend API SHALL provide endpoints for swing trading
      expect(controller.scanStockUniverse).toBeDefined();
      expect(controller.analyzeSymbol).toBeDefined();
      expect(controller.getRecommendations).toBeDefined();
    });

    it('should validate Requirement 18.1: controller prepared for data flow enforcement', async () => {
      // Assert - Endpoints structured to enforce: Market Data → Quant → AI flow
      // Controller accepts requests but delegates to service for orchestration
      expect(controller.scanStockUniverse).toBeDefined();
      expect(controller.analyzeSymbol).toBeDefined();

      // Service will implement the data flow enforcement
      expect(service).toBeDefined();
    });
  });

  describe('Endpoint Structure', () => {
    it('should have correct route structure', () => {
      // Assert - Controller should be decorated with @Controller('swing')
      const controllerMetadata = Reflect.getMetadata('path', SwingController);
      expect(controllerMetadata).toBe('swing');
    });

    it('should have all expected endpoints', () => {
      // Assert
      expect(typeof controller.health).toBe('function');
      expect(typeof controller.scanStockUniverse).toBe('function');
      expect(typeof controller.analyzeSymbol).toBe('function');
      expect(typeof controller.getRecommendations).toBe('function');
    });
  });
});
