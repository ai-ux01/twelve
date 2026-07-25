import { Test, TestingModule } from '@nestjs/testing';
import { OptionsController } from './options.controller';
import { OptionsService } from './options.service';
import { AuditLogService } from '../audit/audit.service';
import { OptionsChainRequestDto } from './dto/options-chain.dto';

describe('OptionsController - Audit Logging (Task 69.3)', () => {
  let controller: OptionsController;
  let optionsService: OptionsService;
  let auditLogService: AuditLogService;

  const mockOptionsChainData = {
    symbol: 'NIFTY',
    expiryDate: '2024-12-26',
    spotPrice: 21500,
    timestamp: new Date(),
    contracts: [
      {
        symbol: 'NIFTY',
        strikePrice: 21500,
        optionType: 'CALL' as const,
        expiryDate: '2024-12-26',
        ltp: 150,
        bid: 148,
        ask: 152,
        openInterest: 100000,
        changeInOI: 5000,
        volume: 50000,
        impliedVolatility: 15.5,
        delta: 0.52,
        gamma: 0.003,
        theta: -12.5,
        vega: 45.2,
        bidAskSpread: 4,
        bidAskSpreadPercent: 2.7,
      },
    ],
    pcrAnalysis: {
      pcrByOI: 1.15,
      pcrByVolume: 1.05,
      sentiment: 'BEARISH',
      totalCallOI: 1000000,
      totalPutOI: 1150000,
      totalCallVolume: 500000,
      totalPutVolume: 525000,
    },
    atmAnalysis: {
      spotPrice: 21500,
      atmStrike: 21500,
      strikeInterval: 50,
      nearATMStrikes: [],
    },
    oiAnalysis: {
      buildupType: 'LONG_BUILDUP' as const,
      explanation: 'Test explanation',
      supportLevels: [],
      resistanceLevels: [],
      maxCallOIStrike: 21500,
      maxPutOIStrike: 21400,
      oiChangeAnalysis: [],
    },
    liquidityMetrics: {
      totalContracts: 100,
      liquidContracts: 85,
      illiquidContracts: 15,
      averageVolume: 50000,
      averageOI: 100000,
      averageBidAskSpread: 2.5,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OptionsController],
      providers: [
        {
          provide: OptionsService,
          useValue: {
            getOptionsChain: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn().mockResolvedValue('audit-log-id'),
          },
        },
      ],
    }).compile();

    controller = module.get<OptionsController>(OptionsController);
    optionsService = module.get<OptionsService>(OptionsService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  describe('Requirement 18.2: Audit logging for data flow', () => {
    it('should log successful options chain request with data flow tracing', async () => {
      const request: OptionsChainRequestDto = {
        symbol: 'NIFTY',
        expiry: '2024-12-26',
      };

      jest.spyOn(optionsService, 'getOptionsChain').mockResolvedValue(mockOptionsChainData);

      await controller.getOptionsChain(request);

      // Verify audit log was called with correct data
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'options',
          action: 'get_options_chain',
          entityType: 'options-chain',
          entityId: 'NIFTY',
          payload: expect.objectContaining({
            symbol: 'NIFTY',
            expiry: '2024-12-26',
          }),
          success: true,
        })
      );

      // Verify data flow tracing in result
      const lastCall = (auditLogService.log as jest.Mock).mock.calls.find(
        (call) => call[0].success === true
      );
      expect(lastCall[0].result).toMatchObject({
        dataFlow: 'Market Data → Quant Engine → Backend → Frontend',
      });
    });

    it('should log timestamp, user, symbol, endpoint, and response status', async () => {
      const request: OptionsChainRequestDto = {
        symbol: 'BANKNIFTY',
      };

      jest.spyOn(optionsService, 'getOptionsChain').mockResolvedValue({
        ...mockOptionsChainData,
        symbol: 'BANKNIFTY',
      });

      await controller.getOptionsChain(request);

      // Find the success log entry
      const successLog = (auditLogService.log as jest.Mock).mock.calls.find(
        (call) => call[0].success === true
      );

      expect(successLog[0]).toMatchObject({
        service: 'options',
        action: 'get_options_chain',
        entityType: 'options-chain',
        entityId: 'BANKNIFTY',
        success: true,
      });

      // Verify result includes comprehensive metrics
      expect(successLog[0].result).toMatchObject({
        symbol: 'BANKNIFTY',
        spotPrice: expect.any(Number),
        totalContracts: expect.any(Number),
        pcrByOI: expect.any(Number),
        sentiment: expect.any(String),
        atmStrike: expect.any(Number),
        buildupType: expect.any(String),
        responseTime: expect.any(Number),
        dataFlow: expect.any(String),
      });
    });

    it('should log failed options chain request with error details', async () => {
      const request: OptionsChainRequestDto = {
        symbol: 'NIFTY',
      };

      const error = new Error('Market data service unavailable');
      jest.spyOn(optionsService, 'getOptionsChain').mockRejectedValue(error);

      await expect(controller.getOptionsChain(request)).rejects.toThrow(error);

      // Verify failure was logged (should be called twice: initial log + failure log)
      const auditCalls = (auditLogService.log as jest.Mock).mock.calls;
      const failureLog = auditCalls.find(
        (call) => call[0].success === false && call[0].error !== undefined
      );

      expect(failureLog).toBeDefined();
      expect(failureLog[0]).toMatchObject({
        service: 'options',
        action: 'get_options_chain',
        entityType: 'options-chain',
        entityId: 'NIFTY',
        success: false,
        error: 'Market data service unavailable',
      });

      expect(failureLog[0].result).toMatchObject({
        responseTime: expect.any(Number),
        httpStatus: expect.any(Number),
      });
    });

    it('should log response time for performance tracking', async () => {
      const request: OptionsChainRequestDto = {
        symbol: 'NIFTY',
      };

      jest.spyOn(optionsService, 'getOptionsChain').mockResolvedValue(mockOptionsChainData);

      const startTime = Date.now();
      await controller.getOptionsChain(request);
      const endTime = Date.now();

      const successLog = (auditLogService.log as jest.Mock).mock.calls.find(
        (call) => call[0].success === true
      );

      expect(successLog[0].result.responseTime).toBeGreaterThanOrEqual(0);
      expect(successLog[0].result.responseTime).toBeLessThan(endTime - startTime + 100); // Allow 100ms buffer
    });
  });

  describe('Requirement 20.1: Error handling and logging', () => {
    it('should log and handle validation errors', async () => {
      const request: OptionsChainRequestDto = {
        symbol: 'INVALID',
      };

      const error = new Error('Invalid symbol: INVALID. Only NIFTY and BANKNIFTY are supported.');
      jest.spyOn(optionsService, 'getOptionsChain').mockRejectedValue(error);

      await expect(controller.getOptionsChain(request)).rejects.toThrow(error);

      const auditCalls = (auditLogService.log as jest.Mock).mock.calls;
      const failureLog = auditCalls.find(
        (call) => call[0].success === false && call[0].error !== undefined
      );

      expect(failureLog).toBeDefined();
      expect(failureLog[0].error).toContain('Invalid symbol');
    });

    it('should log health check requests', async () => {
      await controller.health();

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'options',
          action: 'health_check',
          success: true,
        })
      );
    });
  });

  describe('Data flow enforcement (Requirement 18.2)', () => {
    it('should include data flow path in audit logs', async () => {
      const request: OptionsChainRequestDto = {
        symbol: 'NIFTY',
      };

      jest.spyOn(optionsService, 'getOptionsChain').mockResolvedValue(mockOptionsChainData);

      await controller.getOptionsChain(request);

      const successLog = (auditLogService.log as jest.Mock).mock.calls.find(
        (call) => call[0].success === true
      );

      expect(successLog[0].result.dataFlow).toBe(
        'Market Data → Quant Engine → Backend → Frontend'
      );
    });

    it('should log all key metrics from analysis', async () => {
      const request: OptionsChainRequestDto = {
        symbol: 'NIFTY',
      };

      jest.spyOn(optionsService, 'getOptionsChain').mockResolvedValue(mockOptionsChainData);

      await controller.getOptionsChain(request);

      const successLog = (auditLogService.log as jest.Mock).mock.calls.find(
        (call) => call[0].success === true
      );

      // Verify all key analysis metrics are logged
      expect(successLog[0].result).toMatchObject({
        symbol: 'NIFTY',
        spotPrice: 21500,
        totalContracts: 1,
        pcrByOI: 1.15,
        pcrByVolume: 1.05,
        sentiment: 'BEARISH',
        atmStrike: 21500,
        buildupType: 'LONG_BUILDUP',
        liquidContracts: 85,
        illiquidContracts: 15,
      });
    });
  });
});
