import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface AuditLogEntry {
  userId?: string;
  service: string; // backend, quant, ai, broker
  action: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, any>;
  result?: Record<string, any>;
  success: boolean;
  error?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * AuditLogService - Logs all service-to-service calls for data flow enforcement
 * Requirement 18.6: Backend SHALL log all data flow for audit purposes
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a service-to-service call or action
   *
   * @param entry - Audit log entry with service, action, and result details
   * @returns The created audit log record ID
   */
  async log(entry: AuditLogEntry): Promise<string> {
    try {
      // Sanitize payload to remove sensitive data
      const sanitizedPayload = entry.payload ? this.sanitizePayload(entry.payload) : undefined;
      const sanitizedResult = entry.result ? this.sanitizePayload(entry.result) : undefined;

      const auditLog = await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          service: entry.service,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          payload: sanitizedPayload,
          result: sanitizedResult,
          success: entry.success,
          error: entry.error,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });

      this.logger.debug(
        `Audit log created: ${entry.service}.${entry.action} - ${entry.success ? 'SUCCESS' : 'FAILED'}`
      );

      return auditLog.id;
    } catch (error) {
      // Don't fail the operation if audit logging fails
      this.logger.error('Failed to create audit log', error);
      throw error;
    }
  }

  /**
   * Log a successful service call
   */
  async logSuccess(
    service: string,
    action: string,
    payload?: Record<string, any>,
    result?: Record<string, any>,
    userId?: string
  ): Promise<string> {
    return this.log({
      userId,
      service,
      action,
      payload,
      result,
      success: true,
    });
  }

  /**
   * Log a failed service call
   */
  async logFailure(
    service: string,
    action: string,
    error: string,
    payload?: Record<string, any>,
    userId?: string
  ): Promise<string> {
    return this.log({
      userId,
      service,
      action,
      payload,
      success: false,
      error,
    });
  }

  /**
   * Log market data API call
   */
  async logMarketDataCall(
    action: string,
    symbol: string,
    success: boolean,
    error?: string,
    result?: Record<string, any>
  ): Promise<string> {
    return this.log({
      service: 'market-data',
      action,
      entityType: 'symbol',
      entityId: symbol,
      success,
      error,
      result,
    });
  }

  /**
   * Log quant engine call
   */
  async logQuantCall(
    action: string,
    symbol: string,
    success: boolean,
    error?: string,
    result?: Record<string, any>
  ): Promise<string> {
    return this.log({
      service: 'quant',
      action,
      entityType: 'analysis',
      entityId: symbol,
      success,
      error,
      result,
    });
  }

  /**
   * Log AI service call
   */
  async logAiCall(
    action: string,
    payload: Record<string, any>,
    success: boolean,
    error?: string,
    result?: Record<string, any>,
    userId?: string
  ): Promise<string> {
    return this.log({
      userId,
      service: 'ai',
      action,
      payload,
      success,
      error,
      result,
    });
  }

  /**
   * Log risk engine validation
   */
  async logRiskValidation(
    userId: string,
    tradeRequest: Record<string, any>,
    validationResult: Record<string, any>,
    success: boolean
  ): Promise<string> {
    return this.log({
      userId,
      service: 'risk',
      action: 'validate_trade',
      payload: tradeRequest,
      result: validationResult,
      success,
    });
  }

  /**
   * Log broker API call
   */
  async logBrokerCall(
    action: string,
    userId: string,
    payload: Record<string, any>,
    success: boolean,
    error?: string,
    result?: Record<string, any>
  ): Promise<string> {
    return this.log({
      userId,
      service: 'broker',
      action,
      payload,
      success,
      error,
      result,
    });
  }

  /**
   * Task 63.1: Log stale data event for intraday trading
   * Requirement: 18.6
   */
  async logStaleDataEvent(
    symbol: string,
    dataAge: number,
    threshold: number,
    userId?: string
  ): Promise<string> {
    return this.log({
      userId,
      service: 'intraday',
      action: 'stale_data_detected',
      entityType: 'symbol',
      entityId: symbol,
      payload: {
        dataAge,
        threshold,
        ageMinutes: dataAge / 60,
      },
      success: false,
      error: `Data is stale: ${(dataAge / 60).toFixed(1)} minutes old (threshold: ${threshold / 60} minutes)`,
    });
  }

  /**
   * Task 63.2: Log rejected trade due to confidence or risk/reward thresholds
   * Requirement: 18.6
   */
  async logRejectedTrade(
    symbol: string,
    reason: string,
    details: {
      signal?: string;
      confidence?: number;
      riskReward?: number;
      minConfidence?: number;
      minRiskReward?: number;
    },
    userId?: string
  ): Promise<string> {
    return this.log({
      userId,
      service: 'intraday',
      action: 'trade_rejected',
      entityType: 'trade',
      entityId: symbol,
      payload: details,
      success: false,
      error: reason,
    });
  }

  /**
   * Query audit logs with filters
   */
  async queryLogs(filters: {
    service?: string;
    action?: string;
    userId?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const where: any = {};

    if (filters.service) where.service = filters.service;
    if (filters.action) where.action = filters.action;
    if (filters.userId) where.userId = filters.userId;
    if (filters.success !== undefined) where.success = filters.success;

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters.limit || 100,
    });
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserLogs(userId: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Verify data flow constraints from audit logs
   * Returns violations where AI service accessed market data or broker directly
   */
  async verifyDataFlowConstraints(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    violations: Array<{
      id: string;
      timestamp: Date;
      violation: string;
      details: any;
    }>;
    compliant: boolean;
  }> {
    const violations: Array<{
      id: string;
      timestamp: Date;
      violation: string;
      details: any;
    }> = [];

    // Check for AI → Market Data direct access (should never happen)
    const aiMarketDataLogs = await this.prisma.auditLog.findMany({
      where: {
        service: 'ai',
        action: { contains: 'market' },
        timestamp: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      },
    });

    aiMarketDataLogs.forEach((log) => {
      violations.push({
        id: log.id,
        timestamp: log.timestamp,
        violation: 'AI_DIRECT_MARKET_ACCESS',
        details: { action: log.action, payload: log.payload },
      });
    });

    // Check for AI → Broker direct access (should never happen)
    const aiBrokerLogs = await this.prisma.auditLog.findMany({
      where: {
        service: 'ai',
        action: { contains: 'broker' },
        timestamp: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      },
    });

    aiBrokerLogs.forEach((log) => {
      violations.push({
        id: log.id,
        timestamp: log.timestamp,
        violation: 'AI_DIRECT_BROKER_ACCESS',
        details: { action: log.action, payload: log.payload },
      });
    });

    return {
      violations,
      compliant: violations.length === 0,
    };
  }

  /**
   * Sanitize payload to remove sensitive data like API keys, passwords, tokens
   */
  private sanitizePayload(payload: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
      'password',
      'apiKey',
      'api_key',
      'secret',
      'token',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'apiSecret',
      'api_secret',
      'privateKey',
      'private_key',
      'credential',
      'credentials',
    ];

    const sanitized = { ...payload };

    // Recursively sanitize nested objects
    const sanitizeRecursive = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeRecursive);
      }

      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          // Check if key contains sensitive data
          const isSensitive = sensitiveKeys.some((sensitiveKey) =>
            key.toLowerCase().includes(sensitiveKey.toLowerCase())
          );

          if (isSensitive) {
            result[key] = '[REDACTED]';
          } else {
            result[key] = sanitizeRecursive(value);
          }
        }
        return result;
      }

      return obj;
    };

    return sanitizeRecursive(sanitized);
  }
}
