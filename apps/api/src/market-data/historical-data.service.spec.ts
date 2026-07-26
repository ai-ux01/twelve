import { Test, TestingModule } from '@nestjs/testing';
import { HistoricalDataService, CandleInput } from './historical-data.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '../config/config.service';
import { Timeframe } from '@prisma/client';

describe('HistoricalDataService', () => {
  let service: HistoricalDataService;
  let prismaService: any;
  let configService: any;

  beforeEach(async () => {
    const mockPrismaService = {
      candle: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    };

    const mockConfigService = {
      marketDataRetentionYears: 2,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoricalDataService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<HistoricalDataService>(HistoricalDataService);
    prismaService = module.get(PrismaService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHistoricalCandles', () => {
    it('should return empty array when no candles exist', async () => {
      prismaService.candle.findMany.mockResolvedValue([]);

      const result = await service.getHistoricalCandles({
        instrumentId: 'inst-1',
        timeframe: Timeframe.ONE_DAY,
        fromDate: new Date('2023-01-01'),
        toDate: new Date('2024-01-01'),
      });

      expect(result.candles).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.instrumentId).toBe('inst-1');
      expect(result.timeframe).toBe(Timeframe.ONE_DAY);
    });

    it('should clamp fromDate to retention boundary when too old', async () => {
      prismaService.candle.findMany.mockResolvedValue([]);

      const veryOldDate = new Date('2010-01-01');
      const now = new Date();
      const expectedBoundary = new Date(now);
      expectedBoundary.setFullYear(expectedBoundary.getFullYear() - 2);

      await service.getHistoricalCandles({
        instrumentId: 'inst-1',
        timeframe: Timeframe.ONE_DAY,
        fromDate: veryOldDate,
        toDate: new Date(),
      });

      const callArgs = prismaService.candle.findMany.mock.calls[0][0];
      const queryFrom = callArgs.where.timestamp.gte;

      // The effective from should be approximately 2 years ago, not 2010
      expect(queryFrom.getFullYear()).toBeGreaterThanOrEqual(now.getFullYear() - 2);
      expect(queryFrom.getTime()).toBeGreaterThan(veryOldDate.getTime());
    });

    it('should clamp toDate to now when in the future', async () => {
      prismaService.candle.findMany.mockResolvedValue([]);

      const futureDate = new Date('2099-01-01');
      const beforeCall = new Date();

      await service.getHistoricalCandles({
        instrumentId: 'inst-1',
        timeframe: Timeframe.ONE_DAY,
        fromDate: new Date('2023-01-01'),
        toDate: futureDate,
      });

      const callArgs = prismaService.candle.findMany.mock.calls[0][0];
      const queryTo = callArgs.where.timestamp.lte;

      // The effective toDate should be approximately now, not 2099
      expect(queryTo.getTime()).toBeLessThanOrEqual(new Date().getTime());
      expect(queryTo.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    });

    it('should query with ascending timestamp order', async () => {
      prismaService.candle.findMany.mockResolvedValue([]);

      await service.getHistoricalCandles({
        instrumentId: 'inst-1',
        timeframe: Timeframe.ONE_HOUR,
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-02-01'),
      });

      const callArgs = prismaService.candle.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ timestamp: 'asc' });
    });

    it('should return candles with correct result shape', async () => {
      const mockCandles = [
        {
          id: 'uuid-1',
          instrumentId: 'inst-1',
          timeframe: Timeframe.ONE_DAY,
          timestamp: new Date('2024-01-01'),
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          volume: BigInt(1000),
          createdAt: new Date(),
        },
      ];
      prismaService.candle.findMany.mockResolvedValue(mockCandles);

      const result = await service.getHistoricalCandles({
        instrumentId: 'inst-1',
        timeframe: Timeframe.ONE_DAY,
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-02-01'),
      });

      expect(result.count).toBe(1);
      expect(result.candles).toEqual(mockCandles);
    });
  });

  describe('upsertCandles', () => {
    it('should return 0 when given empty array', async () => {
      const result = await service.upsertCandles([]);
      expect(result).toBe(0);
      expect(prismaService.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('should call executeRawUnsafe with ON CONFLICT DO UPDATE for batch upsert', async () => {
      prismaService.$executeRawUnsafe.mockResolvedValue(2);

      const candles: CandleInput[] = [
        {
          instrumentId: 'inst-1',
          timeframe: Timeframe.ONE_DAY,
          timestamp: new Date('2024-01-01'),
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          volume: BigInt(1000),
        },
        {
          instrumentId: 'inst-1',
          timeframe: Timeframe.ONE_DAY,
          timestamp: new Date('2024-01-02'),
          open: 105,
          high: 115,
          low: 100,
          close: 110,
          volume: BigInt(1200),
        },
      ];

      const result = await service.upsertCandles(candles);

      expect(result).toBe(2);
      expect(prismaService.$executeRawUnsafe).toHaveBeenCalledTimes(1);

      const query = prismaService.$executeRawUnsafe.mock.calls[0][0];
      expect(query).toContain('INSERT INTO "Candle"');
      expect(query).toContain('ON CONFLICT');
      expect(query).toContain('DO UPDATE SET');
    });
  });

  describe('getLatestTimestamp', () => {
    it('should return null when no candles exist', async () => {
      prismaService.candle.findFirst.mockResolvedValue(null);

      const result = await service.getLatestTimestamp('inst-1', Timeframe.ONE_DAY);

      expect(result).toBeNull();
    });

    it('should return the latest timestamp when candles exist', async () => {
      const latestDate = new Date('2024-06-15T10:00:00Z');
      prismaService.candle.findFirst.mockResolvedValue({ timestamp: latestDate });

      const result = await service.getLatestTimestamp('inst-1', Timeframe.ONE_DAY);

      expect(result).toEqual(latestDate);
    });

    it('should query with descending order to find the latest', async () => {
      prismaService.candle.findFirst.mockResolvedValue(null);

      await service.getLatestTimestamp('inst-1', Timeframe.FIVE_MIN);

      const callArgs = prismaService.candle.findFirst.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ timestamp: 'desc' });
      expect(callArgs.where.instrumentId).toBe('inst-1');
      expect(callArgs.where.timeframe).toBe(Timeframe.FIVE_MIN);
    });
  });

  describe('deleteOlderThan', () => {
    it('should delete in batches and return total count', async () => {
      // First batch: 5000 deleted (full batch), second batch: 3000 deleted (partial)
      prismaService.$executeRawUnsafe
        .mockResolvedValueOnce(5000)
        .mockResolvedValueOnce(3000);

      const boundary = new Date('2022-01-01');
      const result = await service.deleteOlderThan(boundary, 5000);

      expect(result).toBe(8000);
      expect(prismaService.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it('should stop after a batch returns fewer than batchSize', async () => {
      prismaService.$executeRawUnsafe.mockResolvedValueOnce(100);

      const boundary = new Date('2022-01-01');
      const result = await service.deleteOlderThan(boundary, 5000);

      expect(result).toBe(100);
      expect(prismaService.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('should use configurable batch size', async () => {
      prismaService.$executeRawUnsafe.mockResolvedValueOnce(50);

      const boundary = new Date('2022-01-01');
      await service.deleteOlderThan(boundary, 100);

      const query = prismaService.$executeRawUnsafe.mock.calls[0][0];
      const batchSizeArg = prismaService.$executeRawUnsafe.mock.calls[0][2];
      expect(query).toContain('LIMIT');
      expect(batchSizeArg).toBe(100);
    });

    it('should use default batch size of 5000', async () => {
      prismaService.$executeRawUnsafe.mockResolvedValueOnce(0);

      const boundary = new Date('2022-01-01');
      await service.deleteOlderThan(boundary);

      const batchSizeArg = prismaService.$executeRawUnsafe.mock.calls[0][2];
      expect(batchSizeArg).toBe(5000);
    });
  });
});
