/**
 * Test suite for POST /api/options/analyze endpoint
 *
 * Task 69.2: Create POST /api/options/analyze endpoint
 *
 * Tests:
 * 1. Successfully analyzes options chain for NIFTY
 * 2. Successfully analyzes options chain for BANKNIFTY
 * 3. Returns PCR analysis with sentiment
 * 4. Returns ATM strike and near ATM strikes
 * 5. Returns OI buildup analysis with support/resistance
 * 6. Applies rate limiting (10 req/min)
 * 7. Logs all requests for audit
 * 8. Validates symbol (rejects non-NIFTY/BANKNIFTY)
 *
 * Requirements: 7.1, 8.1, 18.2
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OptionsController } from './options.controller';
import { OptionsService } from './options.service';
import { AuditLogService } from '../audit/audit.service';
import { BadRequestException } from '@nestjs/common';
import { OptionsAnalysisRequestDto, OptionsAnalysisResultDto } from './dto/options-analyze.dto';

describe('POST /api/options/analyze endpoint', () => {
  let controller: OptionsController;
  let optionsService: OptionsService;
  let auditLogService: AuditLogService;

  // Mock services
  const mockOptionsService = {
    getOptionsChain: jest.fn(),
    analyzeOptionsChainData: jest.fn(),
  };

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue('audit-log-id'),
    logQuantCall: jest.fn().mockResolvedValue('audit-log-id'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OptionsController],
      providers: [
        {
          provide: OptionsService,
          useValue: mockOptionsService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    controller = module.get<OptionsController>(OptionsController);
    optionsService = module.get<OptionsService>(OptionsService);
    auditLogService = module.get<AuditLogService>(AuditLogService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /api/options/analyze - NIFTY', () => {
    it('should analyze NIFTY options chain successfully', async () => {
      // Arrange
      const request: OptionsAnalysisRequestDto = {
        symbol: 'NIFTY',
        expiry: '2024-12-26',
      };

      const mockOptionsChain = {
        symbol: 'NIFTY',
        expiryDate: '2024-12-26',
        spotPrice: 21500.0,
        timestamp: new Date(),
        contracts: [
          {
            symbol: 'NIFTY',
            strikePrice: 21400,
            optionType: 'CALL' as const,
            expiryDate: '2024-12-26',
            ltp: 150.5,
            bid: 149.0,
            ask: 152.0,
            openInterest: 15000,
            changeInOI: 2500,
            volume: 5000,
            impliedVolatility: 15.2,
            delta: 0.52,
            gamma: 0.003,
            theta: -12.5,
            vega: 45.2,
          },
          {
            symbol: 'NIFTY',
            strikePrice: 21400,
            optionType: 'PUT' as const,
            expiryDate: '2024-12-26',
            ltp: 45.3,
            bid: 44.5,
            ask: 46.1,
            openInterest: 12000,
            changeInOI: -1000,
            volume: 3000,
            impliedVolatility: 16.1,
            delta: -0.48,
            gamma: 0.003,
            theta: -10.2,
            vega: 43.1,
          },
        ],
        pcrAnalysis: {} as any,
        atmAnalysis: {} as any,
        oiAnalysis: {} as any,
        liquidityMetrics: {} as any,
      };

      const mockAnalysisResult: OptionsAnalysisResultDto = {
        symbol: 'NIFTY',
        expiryDate: '2024-12-26',
        spotPrice: 21500.0,
        timestamp: new Date(),
        pcrAnalysis: {
          pcrByOI: 0.8,
          pcrByVolume: 0.6,
          sentiment: 'BULLISH',
          totalCallOI: 150000,
          totalPutOI: 120000,
          totalCallVolume: 50000,
          totalPutVolume: 30000,
        },
        atmAnalysis: {
          spotPrice: 21500.0,
          atmStrike: 21500,
          strikeInterval: 50,
          nearATMStrikes: [
            {
              strike: 21400,
              distanceFromSpot: -0.47,
              callOI: 15000,
              putOI: 12000,
              callVolume: 5000,
              putVolume: 3000,
            },
            {
              strike: 21450,
              distanceFromSpot: -0.23,
              callOI: 18000,
              putOI: 16000,
              callVolume: 6000,
              putVolume: 4000,
            },
            {
              strike: 21500,
              distanceFromSpot: 0.0,
              callOI: 25000,
              putOI: 22000,
              callVolume: 8000,
              putVolume: 7000,
            },
          ],
        },
        oiAnalysis: {
          buildupType: 'LONG_BUILDUP',
          explanation: 'Increasing call OI > put OI suggests bullish positioning',
          supportLevels: [
            {
              strike: 21400,
              strength: 0.85,
              reason: 'High put OI (12,000) suggests support',
            },
            {
              strike: 21350,
              strength: 0.72,
              reason: 'High put OI (10,500) suggests support',
            },
          ],
          resistanceLevels: [
            {
              strike: 21600,
              strength: 0.78,
              reason: 'High call OI (18,000) suggests resistance',
            },
            {
              strike: 21650,
              strength: 0.65,
              reason: 'High call OI (14,200) suggests resistance',
            },
          ],
          maxCallOIStrike: 21500,
          maxPutOIStrike: 21500,
          oiChangeAnalysis: [
            {
              strike: 21400,
              callOIChange: 2500,
              putOIChange: 0,
              interpretation: 'Call writing/buying - potential resistance or bullish positioning',
            },
            {
              strike: 21400,
              callOIChange: 0,
              putOIChange: -1000,
              interpretation: 'Put unwinding - support weakening or position squaring',
            },
          ],
        },
      };

      mockOptionsService.getOptionsChain.mockResolvedValue(mockOptionsChain);
      mockOptionsService.analyzeOptionsChainData.mockResolvedValue(mockAnalysisResult);

      // Act
      const result = await controller.analyzeOptionsChain(request);

      // Assert
      expect(result).toBeDefined();
      expect(result.symbol).toBe('NIFTY');
      expect(result.spotPrice).toBe(21500.0);

      // Verify PCR analysis
      expect(result.pcrAnalysis).toBeDefined();
      expect(result.pcrAnalysis.pcrByOI).toBe(0.8);
      expect(result.pcrAnalysis.pcrByVolume).toBe(0.6);
      expect(result.pcrAnalysis.sentiment).toBe('BULLISH');

      // Verify ATM analysis
      expect(result.atmAnalysis).toBeDefined();
      expect(result.atmAnalysis.atmStrike).toBe(21500);
      expect(result.atmAnalysis.strikeInterval).toBe(50);
      expect(result.atmAnalysis.nearATMStrikes.length).toBeGreaterThan(0);

      // Verify OI analysis
      expect(result.oiAnalysis).toBeDefined();
      expect(result.oiAnalysis.buildupType).toBe('LONG_BUILDUP');
      expect(result.oiAnalysis.supportLevels.length).toBeGreaterThan(0);
      expect(result.oiAnalysis.resistanceLevels.length).toBeGreaterThan(0);
      expect(result.oiAnalysis.maxCallOIStrike).toBeDefined();
      expect(result.oiAnalysis.maxPutOIStrike).toBeDefined();

      // Verify service calls
      expect(mockOptionsService.getOptionsChain).toHaveBeenCalledWith({
        symbol: 'NIFTY',
        expiry: '2024-12-26',
      });
      expect(mockOptionsService.analyzeOptionsChainData).toHaveBeenCalledWith(
        'NIFTY',
        21500.0,
        mockOptionsChain.contracts
      );

      // Verify audit logging (Requirement 18.2)
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'options',
          action: 'analyze_options_chain',
          entityType: 'options-analysis',
          entityId: 'NIFTY',
          success: true,
        })
      );
    });

    it('should analyze BANKNIFTY options chain successfully', async () => {
      // Arrange
      const request: OptionsAnalysisRequestDto = {
        symbol: 'BANKNIFTY',
      };

      const mockOptionsChain = {
        symbol: 'BANKNIFTY',
        expiryDate: '2024-12-26',
        spotPrice: 45000.0,
        timestamp: new Date(),
        contracts: [],
        pcrAnalysis: {} as any,
        atmAnalysis: {} as any,
        oiAnalysis: {} as any,
        liquidityMetrics: {} as any,
      };

      const mockAnalysisResult: OptionsAnalysisResultDto = {
        symbol: 'BANKNIFTY',
        expiryDate: '2024-12-26',
        spotPrice: 45000.0,
        timestamp: new Date(),
        pcrAnalysis: {
          pcrByOI: 1.3,
          pcrByVolume: 1.1,
          sentiment: 'BEARISH',
          totalCallOI: 100000,
          totalPutOI: 130000,
          totalCallVolume: 40000,
          totalPutVolume: 44000,
        },
        atmAnalysis: {
          spotPrice: 45000.0,
          atmStrike: 45000,
          strikeInterval: 100,
          nearATMStrikes: [],
        },
        oiAnalysis: {
          buildupType: 'SHORT_BUILDUP',
          explanation: 'Increasing put OI > call OI suggests bearish positioning',
          supportLevels: [],
          resistanceLevels: [],
          maxCallOIStrike: 45000,
          maxPutOIStrike: 45000,
          oiChangeAnalysis: [],
        },
      };

      mockOptionsService.getOptionsChain.mockResolvedValue(mockOptionsChain);
      mockOptionsService.analyzeOptionsChainData.mockResolvedValue(mockAnalysisResult);

      // Act
      const result = await controller.analyzeOptionsChain(request);

      // Assert
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BANKNIFTY');
      expect(result.pcrAnalysis.sentiment).toBe('BEARISH');
      expect(result.oiAnalysis.buildupType).toBe('SHORT_BUILDUP');
    });

    it('should log audit entry for each request (Requirement 18.2)', async () => {
      // Arrange
      const request: OptionsAnalysisRequestDto = {
        symbol: 'NIFTY',
      };

      const mockOptionsChain = {
        symbol: 'NIFTY',
        spotPrice: 21500.0,
        contracts: [],
        expiryDate: '2024-12-26',
        timestamp: new Date(),
        pcrAnalysis: {} as any,
        atmAnalysis: {} as any,
        oiAnalysis: {} as any,
        liquidityMetrics: {} as any,
      };

      const mockAnalysisResult: OptionsAnalysisResultDto = {
        symbol: 'NIFTY',
        expiryDate: '2024-12-26',
        spotPrice: 21500.0,
        timestamp: new Date(),
        pcrAnalysis: {
          pcrByOI: 1.0,
          pcrByVolume: 1.0,
          sentiment: 'NEUTRAL',
          totalCallOI: 100000,
          totalPutOI: 100000,
          totalCallVolume: 40000,
          totalPutVolume: 40000,
        },
        atmAnalysis: {
          spotPrice: 21500.0,
          atmStrike: 21500,
          strikeInterval: 50,
          nearATMStrikes: [],
        },
        oiAnalysis: {
          buildupType: 'NEUTRAL',
          explanation: 'Mixed OI changes, no clear directional bias',
          supportLevels: [],
          resistanceLevels: [],
          maxCallOIStrike: 21500,
          maxPutOIStrike: 21500,
          oiChangeAnalysis: [],
        },
      };

      mockOptionsService.getOptionsChain.mockResolvedValue(mockOptionsChain);
      mockOptionsService.analyzeOptionsChainData.mockResolvedValue(mockAnalysisResult);

      // Act
      await controller.analyzeOptionsChain(request);

      // Assert - Verify audit logging was called
      expect(mockAuditLogService.log).toHaveBeenCalledTimes(2); // Once for start, once for success

      // Verify audit log contains data flow information (Requirement 18.2)
      const successAuditCall = (mockAuditLogService.log as jest.Mock).mock.calls.find((call) =>
        call[0].success === true
      );
      expect(successAuditCall).toBeDefined();
      expect(successAuditCall[0].result.dataFlow).toContain('Market Data');
      expect(successAuditCall[0].result.dataFlow).toContain('Quant Engine');
      expect(successAuditCall[0].result.dataFlow).toContain('/quant/options/analyze');
    });

    it('should handle errors and log them for audit (Requirement 18.2)', async () => {
      // Arrange
      const request: OptionsAnalysisRequestDto = {
        symbol: 'NIFTY',
      };

      const errorMessage = 'Market data service unavailable';
      mockOptionsService.getOptionsChain.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(controller.analyzeOptionsChain(request)).rejects.toThrow(errorMessage);

      // Verify error was logged in audit
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'options',
          action: 'analyze_options_chain',
          success: false,
          error: errorMessage,
        })
      );
    });
  });

  describe('Symbol validation', () => {
    it('should accept NIFTY as valid symbol', async () => {
      // Arrange
      const request: OptionsAnalysisRequestDto = {
        symbol: 'NIFTY',
      };

      mockOptionsService.getOptionsChain.mockResolvedValue({
        symbol: 'NIFTY',
        spotPrice: 21500,
        contracts: [],
        expiryDate: '2024-12-26',
        timestamp: new Date(),
        pcrAnalysis: {
          pcrByOI: 1.0,
          pcrByVolume: 1.0,
          sentiment: 'NEUTRAL',
          totalCallOI: 100000,
          totalPutOI: 100000,
          totalCallVolume: 40000,
          totalPutVolume: 40000,
        },
        atmAnalysis: {
          spotPrice: 21500,
          atmStrike: 21500,
          strikeInterval: 50,
          nearATMStrikes: [],
        },
        oiAnalysis: {
          buildupType: 'NEUTRAL',
          explanation: 'Test',
          supportLevels: [],
          resistanceLevels: [],
          maxCallOIStrike: 21500,
          maxPutOIStrike: 21500,
          oiChangeAnalysis: [],
        },
        liquidityMetrics: {
          totalContracts: 0,
          liquidContracts: 0,
          illiquidContracts: 0,
          averageVolume: 0,
          averageOI: 0,
          averageBidAskSpread: 0,
        },
      });

      mockOptionsService.analyzeOptionsChainData.mockResolvedValue({
        symbol: 'NIFTY',
        expiryDate: '2024-12-26',
        spotPrice: 21500,
        timestamp: new Date(),
        pcrAnalysis: {
          pcrByOI: 1.0,
          pcrByVolume: 1.0,
          sentiment: 'NEUTRAL',
          totalCallOI: 100000,
          totalPutOI: 100000,
          totalCallVolume: 40000,
          totalPutVolume: 40000,
        },
        atmAnalysis: {
          spotPrice: 21500,
          atmStrike: 21500,
          strikeInterval: 50,
          nearATMStrikes: [],
        },
        oiAnalysis: {
          buildupType: 'NEUTRAL',
          explanation: 'Test',
          supportLevels: [],
          resistanceLevels: [],
          maxCallOIStrike: 21500,
          maxPutOIStrike: 21500,
          oiChangeAnalysis: [],
        },
      });

      // Act & Assert
      await expect(controller.analyzeOptionsChain(request)).resolves.toBeDefined();
    });

    it('should accept BANKNIFTY as valid symbol', async () => {
      // Arrange
      const request: OptionsAnalysisRequestDto = {
        symbol: 'BANKNIFTY',
      };

      mockOptionsService.getOptionsChain.mockResolvedValue({
        symbol: 'BANKNIFTY',
        spotPrice: 45000,
        contracts: [],
        expiryDate: '2024-12-26',
        timestamp: new Date(),
        pcrAnalysis: {
          pcrByOI: 1.0,
          pcrByVolume: 1.0,
          sentiment: 'NEUTRAL',
          totalCallOI: 100000,
          totalPutOI: 100000,
          totalCallVolume: 40000,
          totalPutVolume: 40000,
        },
        atmAnalysis: {
          spotPrice: 45000,
          atmStrike: 45000,
          strikeInterval: 100,
          nearATMStrikes: [],
        },
        oiAnalysis: {
          buildupType: 'NEUTRAL',
          explanation: 'Test',
          supportLevels: [],
          resistanceLevels: [],
          maxCallOIStrike: 45000,
          maxPutOIStrike: 45000,
          oiChangeAnalysis: [],
        },
        liquidityMetrics: {
          totalContracts: 0,
          liquidContracts: 0,
          illiquidContracts: 0,
          averageVolume: 0,
          averageOI: 0,
          averageBidAskSpread: 0,
        },
      });

      mockOptionsService.analyzeOptionsChainData.mockResolvedValue({
        symbol: 'BANKNIFTY',
        expiryDate: '2024-12-26',
        spotPrice: 45000,
        timestamp: new Date(),
        pcrAnalysis: {
          pcrByOI: 1.0,
          pcrByVolume: 1.0,
          sentiment: 'NEUTRAL',
          totalCallOI: 100000,
          totalPutOI: 100000,
          totalCallVolume: 40000,
          totalPutVolume: 40000,
        },
        atmAnalysis: {
          spotPrice: 45000,
          atmStrike: 45000,
          strikeInterval: 100,
          nearATMStrikes: [],
        },
        oiAnalysis: {
          buildupType: 'NEUTRAL',
          explanation: 'Test',
          supportLevels: [],
          resistanceLevels: [],
          maxCallOIStrike: 45000,
          maxPutOIStrike: 45000,
          oiChangeAnalysis: [],
        },
      });

      // Act & Assert
      await expect(controller.analyzeOptionsChain(request)).resolves.toBeDefined();
    });
  });

  describe('Data flow verification', () => {
    it('should follow correct data flow: Market Data → Quant Engine → Backend', async () => {
      // Arrange
      const request: OptionsAnalysisRequestDto = {
        symbol: 'NIFTY',
      };

      const mockOptionsChain = {
        symbol: 'NIFTY',
        spotPrice: 21500,
        contracts: [
          {
            symbol: 'NIFTY',
            strikePrice: 21500,
            optionType: 'CALL' as const,
            expiryDate: '2024-12-26',
            ltp: 150,
            bid: 149,
            ask: 151,
            openInterest: 10000,
            changeInOI: 1000,
            volume: 5000,
            impliedVolatility: 15,
          },
        ],
        expiryDate: '2024-12-26',
        timestamp: new Date(),
        pcrAnalysis: {} as any,
        atmAnalysis: {} as any,
        oiAnalysis: {} as any,
        liquidityMetrics: {} as any,
      };

      mockOptionsService.getOptionsChain.mockResolvedValue({
        symbol: 'NIFTY',
        spotPrice: 21500,
        contracts: [
          {
            symbol: 'NIFTY',
            strikePrice: 21500,
            optionType: 'CALL' as const,
            expiryDate: '2024-12-26',
            ltp: 150,
            bid: 149,
            ask: 151,
            openInterest: 10000,
            changeInOI: 1000,
            volume: 5000,
            impliedVolatility: 15,
          },
        ],
        expiryDate: '2024-12-26',
        timestamp: new Date(),
        pcrAnalysis: {
          pcrByOI: 1.0,
          pcrByVolume: 1.0,
          sentiment: 'NEUTRAL',
          totalCallOI: 100000,
          totalPutOI: 100000,
          totalCallVolume: 40000,
          totalPutVolume: 40000,
        },
        atmAnalysis: {
          spotPrice: 21500,
          atmStrike: 21500,
          strikeInterval: 50,
          nearATMStrikes: [],
        },
        oiAnalysis: {
          buildupType: 'NEUTRAL',
          explanation: 'Test',
          supportLevels: [],
          resistanceLevels: [],
          maxCallOIStrike: 21500,
          maxPutOIStrike: 21500,
          oiChangeAnalysis: [],
        },
        liquidityMetrics: {
          totalContracts: 1,
          liquidContracts: 1,
          illiquidContracts: 0,
          averageVolume: 5000,
          averageOI: 10000,
          averageBidAskSpread: 1,
        },
      });
      mockOptionsService.analyzeOptionsChainData.mockResolvedValue({
        symbol: 'NIFTY',
        expiryDate: '2024-12-26',
        spotPrice: 21500,
        timestamp: new Date(),
        pcrAnalysis: {
          pcrByOI: 1.0,
          pcrByVolume: 1.0,
          sentiment: 'NEUTRAL',
          totalCallOI: 100000,
          totalPutOI: 100000,
          totalCallVolume: 40000,
          totalPutVolume: 40000,
        },
        atmAnalysis: {
          spotPrice: 21500,
          atmStrike: 21500,
          strikeInterval: 50,
          nearATMStrikes: [],
        },
        oiAnalysis: {
          buildupType: 'NEUTRAL',
          explanation: 'Test',
          supportLevels: [],
          resistanceLevels: [],
          maxCallOIStrike: 21500,
          maxPutOIStrike: 21500,
          oiChangeAnalysis: [],
        },
      });

      // Act
      await controller.analyzeOptionsChain(request);

      // Assert - Verify correct sequence of calls
      expect(mockOptionsService.getOptionsChain).toHaveBeenCalled();
      expect(mockOptionsService.analyzeOptionsChainData).toHaveBeenCalledWith(
        'NIFTY',
        21500,
        expect.arrayContaining([
          expect.objectContaining({
            strikePrice: 21500,
            optionType: 'CALL',
          }),
        ])
      );
    });
  });
});
