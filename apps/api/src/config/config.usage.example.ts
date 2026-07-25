/**
 * Example usage of ConfigService
 *
 * This file demonstrates how to use the ConfigService in various scenarios.
 * This is not a test file but rather documentation through code examples.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from './config.service';

/**
 * Example 1: Using ConfigService in a Market Data Service
 */
@Injectable()
export class MarketDataServiceExample {
  constructor(private readonly configService: ConfigService) {}

  async connectToKiteConnect() {
    const apiKey = this.configService.kiteApiKey;
    const apiSecret = this.configService.kiteApiSecret;

    if (!apiKey || !apiSecret) {
      throw new Error('Kite Connect credentials not configured');
    }

    // Use credentials to connect to Kite Connect API
    console.log('Connecting to Kite Connect with key:', apiKey);
  }
}

/**
 * Example 2: Using ConfigService in an AI Service
 */
@Injectable()
export class AiServiceExample {
  constructor(private readonly configService: ConfigService) {}

  async getAiClient() {
    const provider = this.configService.aiProvider;

    if (provider === 'openai') {
      const apiKey = this.configService.openaiApiKey;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      // Return OpenAI client
      return { provider: 'openai', apiKey };
    } else {
      const baseUrl = this.configService.ollamaBaseUrl;
      // Return Ollama client
      return { provider: 'ollama', baseUrl };
    }
  }

  async getModel() {
    return this.configService.aiModel;
  }
}

/**
 * Example 3: Using ConfigService in a Risk Engine
 */
@Injectable()
export class RiskEngineExample {
  constructor(private readonly configService: ConfigService) {}

  validatePositionSize(positionValue: number): boolean {
    const maxPositionSize = this.configService.defaultMaxPositionSize;
    return positionValue <= maxPositionSize;
  }

  calculateStopLoss(entryPrice: number): number {
    const stopLossPercentage = this.configService.defaultStopLoss;
    return entryPrice * (1 - stopLossPercentage);
  }

  validatePortfolioExposure(currentExposure: number, totalPortfolioValue: number): boolean {
    const maxExposure = this.configService.defaultMaxPortfolioExposure;
    const exposureRatio = currentExposure / totalPortfolioValue;
    return exposureRatio <= maxExposure;
  }
}

/**
 * Example 4: Using ConfigService in a Quant Service
 */
@Injectable()
export class QuantServiceExample {
  constructor(private readonly configService: ConfigService) {}

  async sendAnalysisRequest(data: any) {
    const quantEngineUrl = this.configService.quantEngineUrl;
    const endpoint = `${quantEngineUrl}/analyze`;

    // Make HTTP request to Quant Engine
    console.log(`Sending analysis request to ${endpoint}`);
  }
}

/**
 * Example 5: Using ConfigService for environment-specific logic
 */
@Injectable()
export class FeatureFlagExample {
  constructor(private readonly configService: ConfigService) {}

  shouldEnableDebugLogging(): boolean {
    return this.configService.isDevelopment;
  }

  shouldEnableRateLimiting(): boolean {
    return this.configService.isProduction;
  }

  getEnvironmentInfo() {
    return {
      environment: this.configService.nodeEnv,
      isProduction: this.configService.isProduction,
      isDevelopment: this.configService.isDevelopment,
      port: this.configService.port,
    };
  }
}

/**
 * Example 6: Using ConfigService in Database Module
 */
@Injectable()
export class DatabaseConnectionExample {
  constructor(private readonly configService: ConfigService) {}

  getDatabaseConfig() {
    const url = this.configService.databaseUrl;

    return {
      url,
      // Additional Prisma configuration
      log: this.configService.isDevelopment ? ['query', 'info', 'warn', 'error'] : ['error'],
    };
  }
}
