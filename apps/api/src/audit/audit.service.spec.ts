import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit.service';
import { PrismaService } from '../database/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      const mockAuditLog = {
        id: 'test-id',
        service: 'backend',
        action: 'test-action',
        success: true,
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.log({
        service: 'backend',
        action: 'test-action',
        success: true,
      });

      expect(result).toBe('test-id');
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          service: 'backend',
          action: 'test-action',
          entityType: undefined,
          entityId: undefined,
          payload: undefined,
          result: undefined,
          success: true,
          error: undefined,
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('should sanitize sensitive data from payload', async () => {
      const mockAuditLog = {
        id: 'test-id',
        service: 'backend',
        action: 'test-action',
        success: true,
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.log({
        service: 'backend',
        action: 'test-action',
        success: true,
        payload: {
          username: 'testuser',
          password: 'secret123',
          apiKey: 'sk-test',
          data: 'normal data',
        },
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payload: {
              username: 'testuser',
              password: '[REDACTED]',
              apiKey: '[REDACTED]',
              data: 'normal data',
            },
          }),
        })
      );
    });

    it('should sanitize nested sensitive data', async () => {
      const mockAuditLog = {
        id: 'test-id',
        service: 'backend',
        action: 'test-action',
        success: true,
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.log({
        service: 'backend',
        action: 'test-action',
        success: true,
        payload: {
          user: {
            name: 'testuser',
            credentials: {
              token: 'secret-token',
              refreshToken: 'refresh-token',
            },
          },
          normalData: 'value',
        },
      });

      const call = mockPrismaService.auditLog.create.mock.calls[0][0];
      // Since "credentials" is a sensitive key, the entire object should be redacted
      expect(call.data.payload.user.credentials).toBe('[REDACTED]');
      expect(call.data.payload.user.name).toBe('testuser');
      expect(call.data.payload.normalData).toBe('value');
    });
  });

  describe('logSuccess', () => {
    it('should log a successful operation', async () => {
      const mockAuditLog = {
        id: 'test-id',
        service: 'backend',
        action: 'test-action',
        success: true,
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logSuccess('backend', 'test-action', { data: 'test' });

      expect(result).toBe('test-id');
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            service: 'backend',
            action: 'test-action',
            success: true,
          }),
        })
      );
    });
  });

  describe('logFailure', () => {
    it('should log a failed operation', async () => {
      const mockAuditLog = {
        id: 'test-id',
        service: 'backend',
        action: 'test-action',
        success: false,
        error: 'Test error',
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logFailure('backend', 'test-action', 'Test error');

      expect(result).toBe('test-id');
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            service: 'backend',
            action: 'test-action',
            success: false,
            error: 'Test error',
          }),
        })
      );
    });
  });

  describe('logMarketDataCall', () => {
    it('should log market data API call', async () => {
      const mockAuditLog = {
        id: 'test-id',
        service: 'market-data',
        action: 'fetch-price',
        entityType: 'symbol',
        entityId: 'RELIANCE',
        success: true,
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logMarketDataCall('fetch-price', 'RELIANCE', true);

      expect(result).toBe('test-id');
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            service: 'market-data',
            action: 'fetch-price',
            entityType: 'symbol',
            entityId: 'RELIANCE',
            success: true,
          }),
        })
      );
    });
  });

  describe('logQuantCall', () => {
    it('should log quant engine call', async () => {
      const mockAuditLog = {
        id: 'test-id',
        service: 'quant',
        action: 'analyze',
        entityType: 'analysis',
        entityId: 'RELIANCE',
        success: true,
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logQuantCall('analyze', 'RELIANCE', true);

      expect(result).toBe('test-id');
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            service: 'quant',
            action: 'analyze',
            entityType: 'analysis',
            entityId: 'RELIANCE',
            success: true,
          }),
        })
      );
    });
  });

  describe('logAiCall', () => {
    it('should log AI service call', async () => {
      const mockAuditLog = {
        id: 'test-id',
        service: 'ai',
        action: 'generate-recommendation',
        success: true,
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logAiCall(
        'generate-recommendation',
        { quantData: 'test' },
        true,
        undefined,
        undefined,
        'user-123'
      );

      expect(result).toBe('test-id');
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            service: 'ai',
            action: 'generate-recommendation',
            success: true,
          }),
        })
      );
    });
  });

  describe('logRiskValidation', () => {
    it('should log risk engine validation', async () => {
      const mockAuditLog = {
        id: 'test-id',
        service: 'risk',
        action: 'validate_trade',
        success: true,
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const tradeRequest = { symbol: 'RELIANCE', action: 'BUY', quantity: 10, price: 2460 };
      const validationResult = { passed: true, violations: [] };

      const result = await service.logRiskValidation(
        'user-123',
        tradeRequest,
        validationResult,
        true
      );

      expect(result).toBe('test-id');
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            service: 'risk',
            action: 'validate_trade',
            success: true,
          }),
        })
      );
    });
  });

  describe('logBrokerCall', () => {
    it('should log broker API call', async () => {
      const mockAuditLog = {
        id: 'test-id',
        service: 'broker',
        action: 'place-order',
        success: true,
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const payload = { symbol: 'RELIANCE', action: 'BUY', quantity: 10 };

      const result = await service.logBrokerCall('place-order', 'user-123', payload, true);

      expect(result).toBe('test-id');
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            service: 'broker',
            action: 'place-order',
            success: true,
          }),
        })
      );
    });
  });

  describe('queryLogs', () => {
    it('should query logs with filters', async () => {
      const mockLogs = [
        { id: '1', service: 'backend', action: 'test', timestamp: new Date() },
        { id: '2', service: 'backend', action: 'test', timestamp: new Date() },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.queryLogs({
        service: 'backend',
        action: 'test',
        limit: 10,
      });

      expect(result).toEqual(mockLogs);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          service: 'backend',
          action: 'test',
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });
    });

    it('should query logs with date range', async () => {
      const mockLogs = [{ id: '1', service: 'backend', timestamp: new Date() }];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await service.queryLogs({
        startDate,
        endDate,
        limit: 10,
      });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });
    });
  });

  describe('getUserLogs', () => {
    it('should get logs for a specific user', async () => {
      const mockLogs = [{ id: '1', userId: 'user-123', service: 'backend', timestamp: new Date() }];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getUserLogs('user-123', 50);

      expect(result).toEqual(mockLogs);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });
    });
  });

  describe('verifyDataFlowConstraints', () => {
    it('should detect AI direct market data access violations', async () => {
      const mockViolationLogs = [
        {
          id: 'violation-1',
          service: 'ai',
          action: 'fetch-market-data',
          timestamp: new Date(),
          payload: { symbol: 'RELIANCE' },
        },
      ];

      mockPrismaService.auditLog.findMany
        .mockResolvedValueOnce(mockViolationLogs) // First call for market data
        .mockResolvedValueOnce([]); // Second call for broker

      const result = await service.verifyDataFlowConstraints();

      expect(result.compliant).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].violation).toBe('AI_DIRECT_MARKET_ACCESS');
      expect(result.violations[0].id).toBe('violation-1');
    });

    it('should detect AI direct broker access violations', async () => {
      const mockViolationLogs = [
        {
          id: 'violation-2',
          service: 'ai',
          action: 'place-broker-order',
          timestamp: new Date(),
          payload: { symbol: 'RELIANCE' },
        },
      ];

      mockPrismaService.auditLog.findMany
        .mockResolvedValueOnce([]) // First call for market data
        .mockResolvedValueOnce(mockViolationLogs); // Second call for broker

      const result = await service.verifyDataFlowConstraints();

      expect(result.compliant).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].violation).toBe('AI_DIRECT_BROKER_ACCESS');
      expect(result.violations[0].id).toBe('violation-2');
    });

    it('should return compliant when no violations found', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);

      const result = await service.verifyDataFlowConstraints();

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should filter by date range when provided', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await service.verifyDataFlowConstraints(startDate, endDate);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });
  });
});
