import { Test, TestingModule } from '@nestjs/testing';
import { OptionsService } from './options.service';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit.service';

/**
 * Integration test for audit logging with data flow tracing
 * Requirements: 18.2, 20.1
 *
 * Verifies that the complete data flow is logged:
 * Market Data → Quant Engine → Backend → Frontend
 */
describe('OptionsService - Audit Logging Integration (Task 69.3)', () => {
  let service: OptionsService;
  let auditLogService: AuditLogService;
  let marketDataService: MarketDataService;
  let quantService: QuantService;

  const mockMarketData = {
    underlying: 'NIFTY',
    spotPrice: 21500,
    expiryDates: ['2024-12-26', '2025-01-02'],
    chain: [
      {
        strike: 21500,
        expiryDate: '2024-12-26',
        callLTP: 150,
        callOI: 100000,
        callVolume: 50000,
        putLTP: 145,
        putOI: 95000,
        putVolume: 48000,
      },
    ],
  };

  const mockQuantResult = {
    symbol: 'NIFTY',
    expiry: new Date('2024-12-26'),
    spotPrice: 21500,
    timestamp: new Date(),
    totalContracts: 2,
    liquidContracts: 2,
    illiquidContracts: 0,
    contracts: [
      {
        strikePrice: 21500,
        optionType: 'CALL' as const,
        ltp: 150,
        bid: 148,
        ask: 152,
        openInterest: 100000,
        volume: 50000,
        iv: 15.5,
        greeks: {
          delta: 0.52,
          gamma: 0.003,
          theta: -12.5,
          vega: 45.2,
        },
        liquidityWarnings: ['NONE'],
        isLiquid: true,
      },
      {
        strikePrice: 21500,
        optionType: 'PUT' as const,
        ltp: 145,
        bid: 143,
        ask: 147,
        openInterest: 95000,
        volume: 48000,
        iv: 15.8,
        greeks: {
          delta: -0.48,
          gamma: 0.003,
          theta: -12.0,
          vega: 44.8,
        },
        liquidityWarnings: ['NONE'],
        isLiquid: true,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionsService,
        {
          provide: MarketDataService,
          useValue: {
            getOptionsChain: jest.fn(),
          },
        },
        {
          provide: QuantService,
          useValue: {
            processOptionsChain: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            auditLog: {
              create: jest.fn(),
            },
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

    service = module.get<OptionsService>(OptionsService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
    marketDataService = module.get<MarketDataService>(MarketDataService);
    quantService = module.get<QuantService>(QuantService);
  });

  describe('Data flow tracing (Requirement 18.2)', () => {
    it('should log Market Data → Quant Engine flow', async () => {
      jest.spyOn(marketDataService, 'getOptionsChain').mockResolvedValue(mockMarketData);
      jest.spyOn(quantService, 'processOptionsChain').mockResolvedValue(mockQuantResult);

      await service.getOptionsChain({ symbol: 'NIFTY' });

      // Verify Market Data service call was logged
      const marketDataLog = (auditLogService.log as jest.Mock).mock.calls.find(
        (call) => call[0].service === 'market-data' && call[0].action === 'get_options_chain'
      );

      expect(marketDataLog).toBeDefined();
      expect(marketDataLog[0]).toMatchObject({
        service: 'market-data',
        action: 'get_options_chain',
        entityType: 'options-chain',
        entityId: 'NIFTY',
        success: true,
        result: expect.objectContaining({
          spotPrice: 21500,
          strikes: 1,
          responseTime: expect.any(Number),
        }),
      });

      // Verify Quant Engine call was logged
      const quantLog = (auditLogService.log as jest.Mock).mock.calls.find(
        (call) => call[0].service === 'quant' && call[0].action === 'process_options_chain'
      );

      expect(quantLog).toBeDefined();
      expect(quantLog[0]).toMatchObject({
        service: 'quant',
        action: 'process_options_chain',
        entityType: 'options-analysis',
        entityId: 'NIFTY',
        success: true,
        payload: expect.objectContaining({
          symbol: 'NIFTY',
          spotPrice: 21500,
          totalContracts: 2,
        }),
        result: expect.objectContaining({
          totalContracts: 2,
          liquidContracts: 2,
          illiquidContracts: 0,
          responseTime: expect.any(Number),
        }),
      });
    });

    it('should log complete data flow with timestamps', async () => {
      jest.spyOn(marketDataService, 'getOptionsChain').mockResolvedValue(mockMarketData);
      jest.spyOn(quantService, 'processOptionsChain').mockResolvedValue(mockQuantResult);

      const startTime = Date.now();
      await service.getOptionsChain({ symbol: 'BANKNIFTY' });
      const endTime = Date.now();

      const allLogs = (auditLogService.log as jest.Mock).mock.calls;

      // Verify all logs have timestamps within the expected range
      allLogs.forEach((call) => {
        if (call[0].result?.responseTime !== undefined) {
          expect(call[0].result.responseTime).toBeGreaterThanOrEqual(0);
          expect(call[0].result.responseTime).toBeLessThan(endTime - startTime + 100);
        }
      });
    });

    it('should log symbol and expiry in all data flow steps', async () => {
      jest.spyOn(marketDataService, 'getOptionsChain').mockResolvedValue(mockMarketData);
      jest.spyOn(quantService, 'processOptionsChain').mockResolvedValue(mockQuantResult);

      await service.getOptionsChain({ symbol: 'NIFTY', expiry: '2024-12-26' });

      const marketDataLog = (auditLogService.log as jest.Mock).mock.calls.find(
        (call) => call[0].service === 'market-data'
      );

      const quantLog = (auditLogService.log as jest.Mock).mock.calls.find(
        (call) => call[0].service === 'quant'
      );

      // Both logs should include symbol
      expect(marketDataLog[0].entityId).toBe('NIFTY');
      expect(quantLog[0].entityId).toBe('NIFTY');

      // Both logs should include expiry in payload
      expect(marketDataLog[0].payload.expiry).toBe('2024-12-26');
      expect(quantLog[0].payload.expiry).toBe('2024-12-26');
    });
  });

  describe('Error handling and logging (Requirement 20.1)', () => {
    it('should log Market Data service failures', async () => {
      const error = new Error('Kite Connect API timeout');
      jest.spyOn(marketDataService, 'getOptionsChain').mockRejectedValue(error);

      await expect(service.getOptionsChain({ symbol: 'NIFTY' })).rejects.toThrow(error);

      // Verify service failure was logged
      const failureLog = (auditLogService.log as jest.Mock).mock.calls.find(
        (call) => call[0].success === false && call[0].error !== undefined
      );

      expect(failureLog).toBeDefined();
      expect(failureLog[0]).toMatchObject({
        service: 'options',
        action: 'get_options_chain_service',
        success: false,
        error: 'Kite Connect API timeout',
      });
    });

    it('should log Quant Engine failures', async () => {
      jest.spyOn(marketDataService, 'getOptionsChain').mockResolvedValue(mockMarketData);

      const error = new Error('Greeks calculation failed');
      jest.spyOn(quantService, 'processOptionsChain').mockRejectedValue(error);

      await expect(service.getOptionsChain({ symbol: 'NIFTY' })).rejects.toThrow(error);

      const failureLog = (auditLogService.log as jest.Mock).mock.calls.find(
        (call) => call[0].success === false && call[0].error !== undefined
      );

      expect(failureLog).toBeDefined();
      expect(failureLog[0].error).toContain('Greeks calculation failed');
    });

    it('should track which step in data flow failed', async () => {
      // Market Data succeeds, Quant Engine fails
      jest.spyOn(marketDataService, 'getOptionsChain').mockResolvedValue(mockMarketData);
      jest.spyOn(quantService, 'processOptionsChain').mockRejectedValue(new Error('Quant error'));

      await expect(service.getOptionsChain({ symbol: 'NIFTY' })).rejects.toThrow();

      const allLogs = (auditLogService.log as jest.Mock).mock.calls;

      // Market Data should have succeeded
      const marketDataLog = allLogs.find(
        (call) => call[0].service === 'market-data' && call[0].success === true
      );
      expect(marketDataLog).toBeDefined();

      // Overall service should have failed
      const serviceFailureLog = allLogs.find(
        (call) => call[0].service === 'options' && call[0].success === false
      );
      expect(serviceFailureLog).toBeDefined();
    });
  });

  describe('Performance metrics (Requirement 18.2)', () => {
    it('should log response times for each step', async () => {
      jest.spyOn(marketDataService, 'getOptionsChain').mockResolvedValue(mockMarketData);
      jest.spyOn(quantService, 'processOptionsChain').mockResolvedValue(mockQuantResult);

      await service.getOptionsChain({ symbol: 'NIFTY' });

      const allLogs = (auditLogService.log as jest.Mock).mock.calls;

      // Market Data should have responseTime
      const marketDataLog = allLogs.find(
        (call) => call[0].service === 'market-data' && call[0].result?.responseTime !== undefined
      );
      expect(marketDataLog).toBeDefined();
      expect(marketDataLog[0].result.responseTime).toBeGreaterThanOrEqual(0);

      // Quant Engine should have responseTime
      const quantLog = allLogs.find(
        (call) => call[0].service === 'quant' && call[0].result?.responseTime !== undefined
      );
      expect(quantLog).toBeDefined();
      expect(quantLog[0].result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should log comprehensive analysis results', async () => {
      jest.spyOn(marketDataService, 'getOptionsChain').mockResolvedValue(mockMarketData);
      jest.spyOn(quantService, 'processOptionsChain').mockResolvedValue(mockQuantResult);

      await service.getOptionsChain({ symbol: 'NIFTY' });

      const quantLog = (auditLogService.log as jest.Mock).mock.calls.find(
        (call) => call[0].service === 'quant'
      );

      expect(quantLog[0].result).toMatchObject({
        totalContracts: 2,
        liquidContracts: 2,
        illiquidContracts: 0,
        responseTime: expect.any(Number),
      });
    });
  });
});
