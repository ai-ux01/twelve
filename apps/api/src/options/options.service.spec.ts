import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OptionsService } from './options.service';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit.service';

describe('OptionsService', () => {
  let service: OptionsService;
  let marketDataService: jest.Mocked<MarketDataService>;
  let quantService: jest.Mocked<QuantService>;

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
          useValue: {},
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
            logMarketDataCall: jest.fn(),
            logQuantCall: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OptionsService>(OptionsService);
    marketDataService = module.get(MarketDataService);
    quantService = module.get(QuantService);
    // prismaService is available but not used in current tests
    module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOptionsChain', () => {
    it('should reject invalid symbols (not NIFTY or BANKNIFTY)', async () => {
      const request = {
        symbol: 'RELIANCE',
      };

      await expect(service.getOptionsChain(request)).rejects.toThrow(BadRequestException);
      await expect(service.getOptionsChain(request)).rejects.toThrow(
        'Invalid symbol: RELIANCE. Only NIFTY and BANKNIFTY are supported for options analysis.'
      );
    });

    it('should accept NIFTY symbol', async () => {
      const request = {
        symbol: 'NIFTY',
      };

      const mockOptionsChainData = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [
          {
            strike: 21400,
            expiryDate: '2024-12-26',
            callLTP: 120,
            putLTP: 80,
            callOI: 10000,
            putOI: 12000,
            callVolume: 5000,
            putVolume: 4000,
          },
          {
            strike: 21500,
            expiryDate: '2024-12-26',
            callLTP: 90,
            putLTP: 95,
            callOI: 15000,
            putOI: 14000,
            callVolume: 8000,
            putVolume: 7500,
          },
          {
            strike: 21600,
            expiryDate: '2024-12-26',
            callLTP: 65,
            putLTP: 115,
            callOI: 11000,
            putOI: 13000,
            callVolume: 3500,
            putVolume: 6000,
          },
        ],
      };

      // Mock Quant Engine response with Greeks and liquidity analysis
      const mockQuantResponse = {
        symbol: 'NIFTY',
        expiry: new Date('2024-12-26'),
        spotPrice: 21500,
        timestamp: new Date(),
        totalContracts: 6,
        liquidContracts: 6,
        illiquidContracts: 0,
        contracts: [
          // Call contracts
          {
            strikePrice: 21400,
            optionType: 'CALL' as const,
            ltp: 120,
            openInterest: 10000,
            volume: 5000,
            bid: 118.8,
            ask: 121.2,
            greeks: { delta: 0.62, gamma: 0.003, theta: -15.2, vega: 42.1 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
          {
            strikePrice: 21500,
            optionType: 'CALL' as const,
            ltp: 90,
            openInterest: 15000,
            volume: 8000,
            bid: 89.1,
            ask: 90.9,
            greeks: { delta: 0.52, gamma: 0.0035, theta: -12.8, vega: 45.2 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
          {
            strikePrice: 21600,
            optionType: 'CALL' as const,
            ltp: 65,
            openInterest: 11000,
            volume: 3500,
            bid: 64.35,
            ask: 65.65,
            greeks: { delta: 0.42, gamma: 0.0032, theta: -10.5, vega: 38.7 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
          // Put contracts
          {
            strikePrice: 21400,
            optionType: 'PUT' as const,
            ltp: 80,
            openInterest: 12000,
            volume: 4000,
            bid: 79.2,
            ask: 80.8,
            greeks: { delta: -0.38, gamma: 0.003, theta: -12.1, vega: 40.5 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
          {
            strikePrice: 21500,
            optionType: 'PUT' as const,
            ltp: 95,
            openInterest: 14000,
            volume: 7500,
            bid: 94.05,
            ask: 95.95,
            greeks: { delta: -0.48, gamma: 0.0035, theta: -13.5, vega: 44.8 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
          {
            strikePrice: 21600,
            optionType: 'PUT' as const,
            ltp: 115,
            openInterest: 13000,
            volume: 6000,
            bid: 113.85,
            ask: 116.15,
            greeks: { delta: -0.58, gamma: 0.0032, theta: -14.8, vega: 39.2 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);
      quantService.processOptionsChain.mockResolvedValue(mockQuantResponse);

      const result = await service.getOptionsChain(request);

      expect(result).toBeDefined();
      expect(result.symbol).toBe('NIFTY');
      expect(result.spotPrice).toBe(21500);
      expect(result.contracts).toBeDefined();
      expect(result.contracts.length).toBe(6); // 3 strikes × 2 (call + put)

      // Verify Greeks are populated
      expect(result.contracts[0].delta).toBeDefined();
      expect(result.contracts[0].gamma).toBeDefined();
      expect(result.contracts[0].theta).toBeDefined();
      expect(result.contracts[0].vega).toBeDefined();

      // Verify PCR analysis is present
      expect(result.pcrAnalysis).toBeDefined();
      expect(result.pcrAnalysis.pcrByOI).toBeDefined();
      expect(result.pcrAnalysis.pcrByVolume).toBeDefined();
      expect(result.pcrAnalysis.sentiment).toBeDefined();

      // Verify ATM analysis is present
      expect(result.atmAnalysis).toBeDefined();
      expect(result.atmAnalysis.atmStrike).toBe(21500); // Closest to spot 21500

      // Verify OI analysis is present
      expect(result.oiAnalysis).toBeDefined();
      expect(result.oiAnalysis.buildupType).toBeDefined();

      // Verify liquidity metrics are present
      expect(result.liquidityMetrics).toBeDefined();
      expect(result.liquidityMetrics.totalContracts).toBe(6);
    });

    it('should accept BANKNIFTY symbol', async () => {
      const request = {
        symbol: 'BANKNIFTY',
      };

      const mockOptionsChainData = {
        underlying: 'BANKNIFTY',
        spotPrice: 45000,
        expiryDates: ['2024-12-26'],
        chain: [
          {
            strike: 44900,
            expiryDate: '2024-12-26',
            callLTP: 150,
            putLTP: 100,
            callOI: 8000,
            putOI: 9000,
            callVolume: 4000,
            putVolume: 3500,
          },
        ],
      };

      const mockQuantResponse = {
        symbol: 'BANKNIFTY',
        expiry: new Date('2024-12-26'),
        spotPrice: 45000,
        timestamp: new Date(),
        totalContracts: 2,
        liquidContracts: 2,
        illiquidContracts: 0,
        contracts: [
          {
            strikePrice: 44900,
            optionType: 'CALL' as const,
            ltp: 150,
            openInterest: 8000,
            volume: 4000,
            bid: 148.5,
            ask: 151.5,
            greeks: { delta: 0.55, gamma: 0.003, theta: -14.5, vega: 42.0 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
          {
            strikePrice: 44900,
            optionType: 'PUT' as const,
            ltp: 100,
            openInterest: 9000,
            volume: 3500,
            bid: 99.0,
            ask: 101.0,
            greeks: { delta: -0.45, gamma: 0.003, theta: -12.0, vega: 40.0 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);
      quantService.processOptionsChain.mockResolvedValue(mockQuantResponse);

      const result = await service.getOptionsChain(request);

      expect(result).toBeDefined();
      expect(result.symbol).toBe('BANKNIFTY');
      expect(result.spotPrice).toBe(45000);
    });

    it('should calculate PCR correctly', async () => {
      const request = {
        symbol: 'NIFTY',
      };

      const mockOptionsChainData = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [
          {
            strike: 21500,
            expiryDate: '2024-12-26',
            callLTP: 90,
            putLTP: 95,
            callOI: 10000, // Total call OI: 10000
            putOI: 15000, // Total put OI: 15000
            callVolume: 5000, // Total call volume: 5000
            putVolume: 6000, // Total put volume: 6000
          },
        ],
      };

      const mockQuantResponse = {
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
            ltp: 90,
            openInterest: 10000,
            volume: 5000,
            bid: 89.1,
            ask: 90.9,
            greeks: { delta: 0.52, gamma: 0.0035, theta: -12.8, vega: 45.2 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
          {
            strikePrice: 21500,
            optionType: 'PUT' as const,
            ltp: 95,
            openInterest: 15000,
            volume: 6000,
            bid: 94.05,
            ask: 95.95,
            greeks: { delta: -0.48, gamma: 0.0035, theta: -13.5, vega: 44.8 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);
      quantService.processOptionsChain.mockResolvedValue(mockQuantResponse);

      const result = await service.getOptionsChain(request);

      expect(result.pcrAnalysis.pcrByOI).toBe(1.5); // 15000 / 10000 = 1.5
      expect(result.pcrAnalysis.pcrByVolume).toBe(1.2); // 6000 / 5000 = 1.2
      expect(result.pcrAnalysis.sentiment).toBe('BEARISH'); // PCR > 1.2
      expect(result.pcrAnalysis.totalCallOI).toBe(10000);
      expect(result.pcrAnalysis.totalPutOI).toBe(15000);
      expect(result.pcrAnalysis.totalCallVolume).toBe(5000);
      expect(result.pcrAnalysis.totalPutVolume).toBe(6000);
    });

    it('should identify ATM strike correctly', async () => {
      const request = {
        symbol: 'NIFTY',
      };

      const mockOptionsChainData = {
        underlying: 'NIFTY',
        spotPrice: 21525, // Between 21500 and 21600
        expiryDates: ['2024-12-26'],
        chain: [
          {
            strike: 21400,
            expiryDate: '2024-12-26',
            callLTP: 120,
            putLTP: 80,
            callOI: 10000,
            putOI: 12000,
            callVolume: 5000,
            putVolume: 4000,
          },
          {
            strike: 21500,
            expiryDate: '2024-12-26',
            callLTP: 90,
            putLTP: 95,
            callOI: 15000,
            putOI: 14000,
            callVolume: 8000,
            putVolume: 7500,
          },
          {
            strike: 21600,
            expiryDate: '2024-12-26',
            callLTP: 65,
            putLTP: 115,
            callOI: 11000,
            putOI: 13000,
            callVolume: 3500,
            putVolume: 6000,
          },
        ],
      };

      const mockQuantResponse = {
        symbol: 'NIFTY',
        expiry: new Date('2024-12-26'),
        spotPrice: 21525,
        timestamp: new Date(),
        totalContracts: 6,
        liquidContracts: 6,
        illiquidContracts: 0,
        contracts: [
          {
            strikePrice: 21400,
            optionType: 'CALL' as const,
            ltp: 120,
            openInterest: 10000,
            volume: 5000,
            bid: 118.8,
            ask: 121.2,
            greeks: { delta: 0.62, gamma: 0.003, theta: -15.2, vega: 42.1 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
          {
            strikePrice: 21500,
            optionType: 'CALL' as const,
            ltp: 90,
            openInterest: 15000,
            volume: 8000,
            bid: 89.1,
            ask: 90.9,
            greeks: { delta: 0.52, gamma: 0.0035, theta: -12.8, vega: 45.2 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
          {
            strikePrice: 21600,
            optionType: 'CALL' as const,
            ltp: 65,
            openInterest: 11000,
            volume: 3500,
            bid: 64.35,
            ask: 65.65,
            greeks: { delta: 0.42, gamma: 0.0032, theta: -10.5, vega: 38.7 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
          {
            strikePrice: 21400,
            optionType: 'PUT' as const,
            ltp: 80,
            openInterest: 12000,
            volume: 4000,
            bid: 79.2,
            ask: 80.8,
            greeks: { delta: -0.38, gamma: 0.003, theta: -12.1, vega: 40.5 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
          {
            strikePrice: 21500,
            optionType: 'PUT' as const,
            ltp: 95,
            openInterest: 14000,
            volume: 7500,
            bid: 94.05,
            ask: 95.95,
            greeks: { delta: -0.48, gamma: 0.0035, theta: -13.5, vega: 44.8 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
          {
            strikePrice: 21600,
            optionType: 'PUT' as const,
            ltp: 115,
            openInterest: 13000,
            volume: 6000,
            bid: 113.85,
            ask: 116.15,
            greeks: { delta: -0.58, gamma: 0.0032, theta: -14.8, vega: 39.2 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);
      quantService.processOptionsChain.mockResolvedValue(mockQuantResponse);

      const result = await service.getOptionsChain(request);

      expect(result.atmAnalysis.atmStrike).toBe(21500); // Closest to spot 21525
      expect(result.atmAnalysis.spotPrice).toBe(21525);
      expect(result.atmAnalysis.strikeInterval).toBe(100); // 21500 - 21400 = 100
      expect(result.atmAnalysis.nearATMStrikes.length).toBeGreaterThan(0);
    });

    it('should add liquidity warnings for illiquid contracts', async () => {
      const request = {
        symbol: 'NIFTY',
      };

      const mockOptionsChainData = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [
          {
            strike: 21500,
            expiryDate: '2024-12-26',
            callLTP: 90,
            putLTP: 95,
            callOI: 100, // Low OI (< 500)
            putOI: 14000,
            callVolume: 50, // Low volume (< 100)
            putVolume: 7500,
          },
        ],
      };

      const mockQuantResponse = {
        symbol: 'NIFTY',
        expiry: new Date('2024-12-26'),
        spotPrice: 21500,
        timestamp: new Date(),
        totalContracts: 2,
        liquidContracts: 1,
        illiquidContracts: 1,
        contracts: [
          {
            strikePrice: 21500,
            optionType: 'CALL' as const,
            ltp: 90,
            openInterest: 100,
            volume: 50,
            bid: 89.1,
            ask: 90.9,
            greeks: { delta: 0.52, gamma: 0.0035, theta: -12.8, vega: 45.2 },
            iv: 0.15,
            liquidityWarnings: ['LOW_OI', 'LOW_VOLUME'],
            isLiquid: false,
          },
          {
            strikePrice: 21500,
            optionType: 'PUT' as const,
            ltp: 95,
            openInterest: 14000,
            volume: 7500,
            bid: 94.05,
            ask: 95.95,
            greeks: { delta: -0.48, gamma: 0.0035, theta: -13.5, vega: 44.8 },
            iv: 0.15,
            liquidityWarnings: ['NONE'],
            isLiquid: true,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);
      quantService.processOptionsChain.mockResolvedValue(mockQuantResponse);

      const result = await service.getOptionsChain(request);

      // Find the illiquid call contract
      const illiquidCall = result.contracts.find(
        (c) => c.optionType === 'CALL' && c.strikePrice === 21500
      );

      expect(illiquidCall?.liquidityWarning).toBeDefined();
      // With approximated bid-ask (LTP * 0.99 to LTP * 1.01), spread will be ~2%, not wide
      // But low volume and low OI should trigger warnings
      expect(illiquidCall?.liquidityWarning?.lowVolume).toBe(true);
      expect(illiquidCall?.liquidityWarning?.lowOI).toBe(true);

      // Check liquidity metrics
      expect(result.liquidityMetrics.illiquidContracts).toBeGreaterThan(0);
    });
  });
});
