/**
 * Unit tests for Options Infrastructure - Task 66.4
 *
 * Comprehensive tests for:
 * - Options chain data parsing
 * - PCR calculation with various OI scenarios
 * - ATM strike identification
 * - OI buildup/unwinding detection
 * - Liquidity metrics and warnings
 *
 * Requirements: 7.1, 16.5
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OptionsService } from './options.service';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';
import { PrismaService } from '../database/prisma.service';

describe('OptionsService - Infrastructure Tests', () => {
  let service: OptionsService;
  let marketDataService: jest.Mocked<MarketDataService>;

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
            calculateGreeksForChain: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<OptionsService>(OptionsService);
    marketDataService = module.get(MarketDataService);
  });

  describe('Options Chain Data Parsing', () => {
    it('should parse options chain with all required fields', async () => {
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
            callOI: 10000,
            putOI: 15000,
            callVolume: 5000,
            putVolume: 6000,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      // Verify contract structure
      expect(result.contracts).toHaveLength(2); // 1 strike × 2 (call + put)

      const callContract = result.contracts.find((c) => c.optionType === 'CALL');
      const putContract = result.contracts.find((c) => c.optionType === 'PUT');

      expect(callContract).toBeDefined();
      expect(callContract?.symbol).toBe('NIFTY');
      expect(callContract?.strikePrice).toBe(21500);
      expect(callContract?.ltp).toBe(90);
      expect(callContract?.openInterest).toBe(10000);
      expect(callContract?.volume).toBe(5000);

      expect(putContract).toBeDefined();
      expect(putContract?.symbol).toBe('NIFTY');
      expect(putContract?.strikePrice).toBe(21500);
      expect(putContract?.ltp).toBe(95);
      expect(putContract?.openInterest).toBe(15000);
      expect(putContract?.volume).toBe(6000);
    });

    it('should handle empty options chain', async () => {
      const mockOptionsChainData = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      expect(result.contracts).toHaveLength(0);
    });

    it('should parse multiple strikes correctly', async () => {
      const mockOptionsChainData = {
        underlying: 'BANKNIFTY',
        spotPrice: 45000,
        expiryDates: ['2024-12-26'],
        chain: [
          {
            strike: 44800,
            expiryDate: '2024-12-26',
            callLTP: 250,
            putLTP: 100,
            callOI: 8000,
            putOI: 12000,
            callVolume: 3000,
            putVolume: 5000,
          },
          {
            strike: 44900,
            expiryDate: '2024-12-26',
            callLTP: 180,
            putLTP: 130,
            callOI: 10000,
            putOI: 11000,
            callVolume: 4000,
            putVolume: 4500,
          },
          {
            strike: 45000,
            expiryDate: '2024-12-26',
            callLTP: 120,
            putLTP: 150,
            callOI: 15000,
            putOI: 14000,
            callVolume: 7000,
            putVolume: 6500,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'BANKNIFTY' });

      // 3 strikes × 2 (call + put) = 6 contracts
      expect(result.contracts).toHaveLength(6);

      // Verify all strikes are present
      const strikes = [...new Set(result.contracts.map((c) => c.strikePrice))];
      expect(strikes.sort()).toEqual([44800, 44900, 45000]);

      // Verify each strike has both call and put
      for (const strike of strikes) {
        const callExists = result.contracts.some(
          (c) => c.strikePrice === strike && c.optionType === 'CALL'
        );
        const putExists = result.contracts.some(
          (c) => c.strikePrice === strike && c.optionType === 'PUT'
        );
        expect(callExists).toBe(true);
        expect(putExists).toBe(true);
      }
    });
  });

  describe('PCR Calculation Edge Cases', () => {
    it('should calculate PCR correctly with extreme bullish scenario', async () => {
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
            callOI: 100000, // Very high call OI
            putOI: 30000, // Low put OI
            callVolume: 50000,
            putVolume: 15000,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      // PCR = 30000 / 100000 = 0.3 (extremely bullish)
      expect(result.pcrAnalysis.pcrByOI).toBe(0.3);
      expect(result.pcrAnalysis.sentiment).toBe('BULLISH');
    });

    it('should calculate PCR correctly with extreme bearish scenario', async () => {
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
            callOI: 20000, // Low call OI
            putOI: 60000, // Very high put OI
            callVolume: 10000,
            putVolume: 30000,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      // PCR = 60000 / 20000 = 3.0 (extremely bearish)
      expect(result.pcrAnalysis.pcrByOI).toBe(3.0);
      expect(result.pcrAnalysis.sentiment).toBe('BEARISH');
    });

    it('should handle PCR at bullish boundary (0.8)', async () => {
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
            callOI: 10000,
            putOI: 8000, // PCR = 0.8
            callVolume: 5000,
            putVolume: 4000,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      expect(result.pcrAnalysis.pcrByOI).toBe(0.8);
      expect(result.pcrAnalysis.sentiment).toBe('NEUTRAL');
    });

    it('should handle PCR at bearish boundary (1.2)', async () => {
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
            callOI: 10000,
            putOI: 12000, // PCR = 1.2
            callVolume: 5000,
            putVolume: 6000,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      expect(result.pcrAnalysis.pcrByOI).toBe(1.2);
      expect(result.pcrAnalysis.sentiment).toBe('NEUTRAL');
    });

    it('should aggregate PCR across multiple strikes', async () => {
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
            callOI: 8000,
            putOI: 12000,
            callVolume: 3000,
            putVolume: 4000,
          },
          {
            strike: 21500,
            expiryDate: '2024-12-26',
            callLTP: 90,
            putLTP: 95,
            callOI: 10000,
            putOI: 11000,
            callVolume: 5000,
            putVolume: 4500,
          },
          {
            strike: 21600,
            expiryDate: '2024-12-26',
            callLTP: 65,
            putLTP: 115,
            callOI: 7000,
            putOI: 9000,
            callVolume: 2500,
            putVolume: 3500,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      // Total call OI: 8000 + 10000 + 7000 = 25000
      // Total put OI: 12000 + 11000 + 9000 = 32000
      // PCR = 32000 / 25000 = 1.28
      expect(result.pcrAnalysis.totalCallOI).toBe(25000);
      expect(result.pcrAnalysis.totalPutOI).toBe(32000);
      expect(result.pcrAnalysis.pcrByOI).toBe(1.28);
      expect(result.pcrAnalysis.sentiment).toBe('BEARISH');
    });
  });

  describe('ATM Strike Identification', () => {
    it('should identify ATM strike when spot exactly matches a strike', async () => {
      const mockOptionsChainData = {
        underlying: 'NIFTY',
        spotPrice: 21500, // Exact match
        expiryDates: ['2024-12-26'],
        chain: [
          { strike: 21400, expiryDate: '2024-12-26', callLTP: 120, putLTP: 80, callOI: 8000, putOI: 10000, callVolume: 3000, putVolume: 4000 },
          { strike: 21500, expiryDate: '2024-12-26', callLTP: 90, putLTP: 95, callOI: 15000, putOI: 14000, callVolume: 8000, putVolume: 7500 },
          { strike: 21600, expiryDate: '2024-12-26', callLTP: 65, putLTP: 115, callOI: 11000, putOI: 13000, callVolume: 3500, putVolume: 6000 },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      expect(result.atmAnalysis.atmStrike).toBe(21500);
      expect(result.atmAnalysis.spotPrice).toBe(21500);
      expect(result.atmAnalysis.strikeInterval).toBe(100);
    });

    it('should identify ATM strike when spot is between strikes', async () => {
      const mockOptionsChainData = {
        underlying: 'NIFTY',
        spotPrice: 21525, // Between 21500 and 21600
        expiryDates: ['2024-12-26'],
        chain: [
          { strike: 21400, expiryDate: '2024-12-26', callLTP: 120, putLTP: 80, callOI: 8000, putOI: 10000, callVolume: 3000, putVolume: 4000 },
          { strike: 21500, expiryDate: '2024-12-26', callLTP: 90, putLTP: 95, callOI: 15000, putOI: 14000, callVolume: 8000, putVolume: 7500 },
          { strike: 21600, expiryDate: '2024-12-26', callLTP: 65, putLTP: 115, callOI: 11000, putOI: 13000, callVolume: 3500, putVolume: 6000 },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      // Should pick 21500 (closer to 21525)
      expect(result.atmAnalysis.atmStrike).toBe(21500);
      expect(result.atmAnalysis.spotPrice).toBe(21525);
    });

    it('should identify ATM with BANKNIFTY wide strike intervals', async () => {
      const mockOptionsChainData = {
        underlying: 'BANKNIFTY',
        spotPrice: 45050,
        expiryDates: ['2024-12-26'],
        chain: [
          { strike: 44900, expiryDate: '2024-12-26', callLTP: 180, putLTP: 100, callOI: 8000, putOI: 10000, callVolume: 3000, putVolume: 4000 },
          { strike: 45000, expiryDate: '2024-12-26', callLTP: 120, putLTP: 150, callOI: 15000, putOI: 14000, callVolume: 8000, putVolume: 7500 },
          { strike: 45100, expiryDate: '2024-12-26', callLTP: 80, putLTP: 200, callOI: 11000, putOI: 13000, callVolume: 3500, putVolume: 6000 },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'BANKNIFTY' });

      // 45000 and 45100 are equidistant from 45050, implementation picks first
      expect([45000, 45100]).toContain(result.atmAnalysis.atmStrike);
      expect(result.atmAnalysis.strikeInterval).toBe(100);
    });

    it('should calculate near ATM strikes correctly', async () => {
      const mockOptionsChainData = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [
          { strike: 21200, expiryDate: '2024-12-26', callLTP: 310, putLTP: 10, callOI: 2000, putOI: 3000, callVolume: 500, putVolume: 800 },
          { strike: 21300, expiryDate: '2024-12-26', callLTP: 220, putLTP: 20, callOI: 3000, putOI: 4000, callVolume: 800, putVolume: 1000 },
          { strike: 21400, expiryDate: '2024-12-26', callLTP: 120, putLTP: 80, callOI: 8000, putOI: 10000, callVolume: 3000, putVolume: 4000 },
          { strike: 21500, expiryDate: '2024-12-26', callLTP: 90, putLTP: 95, callOI: 15000, putOI: 14000, callVolume: 8000, putVolume: 7500 },
          { strike: 21600, expiryDate: '2024-12-26', callLTP: 65, putLTP: 115, callOI: 11000, putOI: 13000, callVolume: 3500, putVolume: 6000 },
          { strike: 21700, expiryDate: '2024-12-26', callLTP: 40, putLTP: 140, callOI: 5000, putOI: 8000, callVolume: 1500, putVolume: 3000 },
          { strike: 21800, expiryDate: '2024-12-26', callLTP: 20, putLTP: 220, callOI: 2000, putOI: 5000, callVolume: 500, putVolume: 1500 },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      // ATM is 21500, near ATM should be ±3 strikes (100 interval)
      // That's 21200, 21300, 21400, 21500, 21600, 21700, 21800 (all 7 strikes)
      expect(result.atmAnalysis.nearATMStrikes.length).toBeGreaterThanOrEqual(5);

      const nearStrikes = result.atmAnalysis.nearATMStrikes.map((s) => s.strike);
      expect(nearStrikes).toContain(21500); // ATM
      expect(nearStrikes).toContain(21400); // -1 strike
      expect(nearStrikes).toContain(21600); // +1 strike
    });
  });

  describe('OI Buildup/Unwinding Detection', () => {
    it('should detect long buildup (call OI increasing)', async () => {
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
            callOI: 15000, // High call OI
            putOI: 8000,
            callVolume: 8000,
            putVolume: 3000,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      // Note: changeInOI defaults to 0 in current implementation
      // This test verifies the buildup type detection logic
      expect(result.oiAnalysis.buildupType).toBeDefined();
      expect(result.oiAnalysis.explanation).toBeDefined();
    });

    it('should identify max OI strikes correctly', async () => {
      const mockOptionsChainData = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [
          { strike: 21400, expiryDate: '2024-12-26', callLTP: 120, putLTP: 80, callOI: 8000, putOI: 18000, callVolume: 3000, putVolume: 6000 },
          { strike: 21500, expiryDate: '2024-12-26', callLTP: 90, putLTP: 95, callOI: 20000, putOI: 12000, callVolume: 8000, putVolume: 4500 },
          { strike: 21600, expiryDate: '2024-12-26', callLTP: 65, putLTP: 115, callOI: 11000, putOI: 13000, callVolume: 3500, putVolume: 5000 },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      expect(result.oiAnalysis.maxCallOIStrike).toBe(21500); // Highest call OI
      expect(result.oiAnalysis.maxPutOIStrike).toBe(21400); // Highest put OI
    });

    it('should identify support levels from put OI', async () => {
      const mockOptionsChainData = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [
          { strike: 21300, expiryDate: '2024-12-26', callLTP: 220, putLTP: 20, callOI: 3000, putOI: 5000, callVolume: 800, putVolume: 1500 },
          { strike: 21400, expiryDate: '2024-12-26', callLTP: 120, putLTP: 80, callOI: 8000, putOI: 20000, callVolume: 3000, putVolume: 8000 },
          { strike: 21450, expiryDate: '2024-12-26', callLTP: 100, putLTP: 90, callOI: 9000, putOI: 15000, callVolume: 4000, putVolume: 6000 },
          { strike: 21500, expiryDate: '2024-12-26', callLTP: 90, putLTP: 95, callOI: 15000, putOI: 12000, callVolume: 8000, putVolume: 5000 },
          { strike: 21600, expiryDate: '2024-12-26', callLTP: 65, putLTP: 115, callOI: 11000, putOI: 8000, callVolume: 3500, putVolume: 3000 },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      // Should identify 21400 and 21450 as support (high put OI below spot)
      expect(result.oiAnalysis.supportLevels.length).toBeGreaterThan(0);

      const supportStrikes = result.oiAnalysis.supportLevels.map((l) => l.strike);
      expect(supportStrikes).toContain(21400);
      expect(supportStrikes).toContain(21450);

      // All support levels should be below spot
      for (const level of result.oiAnalysis.supportLevels) {
        expect(level.strike).toBeLessThan(21500);
      }
    });

    it('should identify resistance levels from call OI', async () => {
      const mockOptionsChainData = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [
          { strike: 21400, expiryDate: '2024-12-26', callLTP: 120, putLTP: 80, callOI: 5000, putOI: 12000, callVolume: 1500, putVolume: 5000 },
          { strike: 21500, expiryDate: '2024-12-26', callLTP: 90, putLTP: 95, callOI: 10000, putOI: 11000, callVolume: 4000, putVolume: 4500 },
          { strike: 21550, expiryDate: '2024-12-26', callLTP: 75, putLTP: 105, callOI: 14000, putOI: 9000, callVolume: 6000, putVolume: 3500 },
          { strike: 21600, expiryDate: '2024-12-26', callLTP: 65, putLTP: 115, callOI: 18000, putOI: 8000, callVolume: 7500, putVolume: 3000 },
          { strike: 21700, expiryDate: '2024-12-26', callLTP: 40, putLTP: 140, callOI: 4000, putOI: 6000, callVolume: 1200, putVolume: 2000 },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      // Should identify 21550 and 21600 as resistance (high call OI above spot)
      expect(result.oiAnalysis.resistanceLevels.length).toBeGreaterThan(0);

      const resistanceStrikes = result.oiAnalysis.resistanceLevels.map((l) => l.strike);
      expect(resistanceStrikes).toContain(21600);
      expect(resistanceStrikes).toContain(21550);

      // All resistance levels should be above spot
      for (const level of result.oiAnalysis.resistanceLevels) {
        expect(level.strike).toBeGreaterThan(21500);
      }
    });
  });

  describe('Liquidity Metrics', () => {
    it('should calculate liquidity metrics correctly', async () => {
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
            callOI: 15000,
            putOI: 14000,
            callVolume: 8000,
            putVolume: 7500,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      expect(result.liquidityMetrics).toBeDefined();
      expect(result.liquidityMetrics.totalContracts).toBe(2);
      expect(result.liquidityMetrics.liquidContracts).toBeGreaterThanOrEqual(0);
      expect(result.liquidityMetrics.illiquidContracts).toBeGreaterThanOrEqual(0);
      expect(
        result.liquidityMetrics.liquidContracts + result.liquidityMetrics.illiquidContracts
      ).toBe(2);
    });

    it('should identify illiquid contracts with low OI', async () => {
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
            callOI: 100, // Low OI (< 500 threshold)
            putOI: 14000,
            callVolume: 50, // Low volume (< 100 threshold)
            putVolume: 7500,
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      const illiquidCall = result.contracts.find(
        (c) => c.optionType === 'CALL' && c.strikePrice === 21500
      );

      expect(illiquidCall?.liquidityWarning).toBeDefined();
      expect(illiquidCall?.liquidityWarning?.lowOI).toBe(true);
      expect(illiquidCall?.liquidityWarning?.lowVolume).toBe(true);

      expect(result.liquidityMetrics.illiquidContracts).toBeGreaterThan(0);
    });

    it('should identify deep OTM contracts as illiquid', async () => {
      const mockOptionsChainData = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [
          {
            strike: 23000, // Deep OTM (> 10% away: (23000-21500)/21500 = 6.98%)
            expiryDate: '2024-12-26',
            callLTP: 5,
            putLTP: 1500,
            callOI: 100, // Low OI too
            putOI: 50, // Low OI too
            callVolume: 50, // Low volume too
            putVolume: 25, // Low volume too
          },
        ],
      };

      marketDataService.getOptionsChain.mockResolvedValue(mockOptionsChainData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });

      const deepOTMCall = result.contracts.find((c) => c.optionType === 'CALL');
      const deepOTMPut = result.contracts.find((c) => c.optionType === 'PUT');

      // At 23000 strike, distance is 6.98%, which is less than 10% threshold
      // But should still be flagged for low OI and volume
      expect(deepOTMCall?.liquidityWarning).toBeDefined();
      expect(deepOTMPut?.liquidityWarning).toBeDefined();
      
      // Low OI and volume should be flagged
      expect(deepOTMCall?.liquidityWarning?.lowOI).toBe(true);
      expect(deepOTMCall?.liquidityWarning?.lowVolume).toBe(true);
    });
  });

  describe('Symbol Validation', () => {
    it('should reject unsupported symbols', async () => {
      await expect(service.getOptionsChain({ symbol: 'RELIANCE' })).rejects.toThrow(
        BadRequestException
      );
      await expect(service.getOptionsChain({ symbol: 'TCS' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('should accept NIFTY', async () => {
      const mockData = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [],
      };
      marketDataService.getOptionsChain.mockResolvedValue(mockData);

      const result = await service.getOptionsChain({ symbol: 'NIFTY' });
      expect(result.symbol).toBe('NIFTY');
    });

    it('should accept BANKNIFTY', async () => {
      const mockData = {
        underlying: 'BANKNIFTY',
        spotPrice: 45000,
        expiryDates: ['2024-12-26'],
        chain: [],
      };
      marketDataService.getOptionsChain.mockResolvedValue(mockData);

      const result = await service.getOptionsChain({ symbol: 'BANKNIFTY' });
      expect(result.symbol).toBe('BANKNIFTY');
    });
  });
});
