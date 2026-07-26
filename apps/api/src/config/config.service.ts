import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

/**
 * Configuration service for managing environment variables in ProfitTerminal.
 * Provides typed getters for all environment variables with validation.
 */
@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  constructor(private readonly configService: NestConfigService) {
    this.validateConfiguration();
  }

  /**
   * Validates that all required environment variables are set on startup.
   * Throws an error if any required variable is missing.
   */
  private validateConfiguration(): void {
    const requiredEnvVars = ['DATABASE_URL'];

    const missingVars = requiredEnvVars.filter(
      (varName) => !this.configService.get<string>(varName)
    );

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }

  // Database Configuration
  get databaseUrl(): string {
    return this.configService.get<string>('DATABASE_URL')!;
  }

  // Kite Connect API Configuration
  get kiteApiKey(): string | undefined {
    return this.configService.get<string>('KITE_API_KEY');
  }

  get kiteApiSecret(): string | undefined {
    return this.configService.get<string>('KITE_API_SECRET');
  }

  get kiteRedirectUri(): string | undefined {
    return this.configService.get<string>('KITE_REDIRECT_URI');
  }

  // Kotak Neo API Configuration
  get kotakApiKey(): string | undefined {
    return this.configService.get<string>('KOTAK_API_KEY');
  }

  get kotakApiSecret(): string | undefined {
    return this.configService.get<string>('KOTAK_API_SECRET');
  }

  get kotakNeoConsumerKey(): string | undefined {
    return this.configService.get<string>('KOTAK_NEO_CONSUMER_KEY');
  }

  get kotakNeoConsumerSecret(): string | undefined {
    return this.configService.get<string>('KOTAK_NEO_CONSUMER_SECRET');
  }

  get kotakNeoAccessToken(): string | undefined {
    return this.configService.get<string>('KOTAK_NEO_ACCESS_TOKEN');
  }

  get kotakNeoSessionToken(): string | undefined {
    return this.configService.get<string>('KOTAK_NEO_SESSION_TOKEN');
  }

  // AI Provider Configuration
  get aiProvider(): 'openai' | 'ollama' {
    const provider = this.configService.get<string>('AI_PROVIDER', 'openai');
    if (provider !== 'openai' && provider !== 'ollama') {
      throw new Error(`Invalid AI_PROVIDER: ${provider}. Must be 'openai' or 'ollama'`);
    }
    return provider as 'openai' | 'ollama';
  }

  get openaiApiKey(): string | undefined {
    return this.configService.get<string>('OPENAI_API_KEY');
  }

  get ollamaBaseUrl(): string {
    return this.configService.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434');
  }

  /**
   * Generic AI API key getter that returns the appropriate key based on the provider.
   */
  get aiApiKey(): string | undefined {
    return this.aiProvider === 'openai' ? this.openaiApiKey : undefined; // Ollama doesn't need an API key
  }

  get aiModel(): string {
    const provider = this.aiProvider;
    if (provider === 'openai') {
      return this.configService.get<string>('AI_MODEL', 'gpt-4');
    } else {
      return this.configService.get<string>('AI_MODEL', 'llama2');
    }
  }

  // Service URLs
  get backendApiUrl(): string {
    return this.configService.get<string>('BACKEND_API_URL', 'http://localhost:4000');
  }

  get quantEngineUrl(): string {
    return this.configService.get<string>('QUANT_ENGINE_URL', 'http://localhost:8000');
  }

  // JWT Configuration
  get jwtSecret(): string {
    return this.configService.get<string>(
      'JWT_SECRET',
      'your-super-secret-jwt-key-change-this-in-production'
    );
  }

  // Default Risk Parameters
  get defaultMaxPositionSize(): number {
    return Number(this.configService.get<number>('DEFAULT_MAX_POSITION_SIZE', 100000));
  }

  get defaultMaxDrawdown(): number {
    return Number(this.configService.get<number>('DEFAULT_MAX_DRAWDOWN', 0.05));
  }

  get defaultMaxPortfolioExposure(): number {
    return Number(this.configService.get<number>('DEFAULT_MAX_PORTFOLIO_EXPOSURE', 0.3));
  }

  get defaultStopLoss(): number {
    return Number(this.configService.get<number>('DEFAULT_STOP_LOSS', 0.02));
  }

  // Server Configuration
  get port(): number {
    return Number(this.configService.get<number>('PORT', 4000));
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  // Historical Market Data Configuration

  /**
   * Returns the market data retention period in years.
   * Defaults to 2 if the value is missing or invalid.
   */
  get marketDataRetentionYears(): number {
    const defaultValue = 2;
    const raw = this.configService.get<string>('MARKET_DATA_RETENTION_YEARS');
    if (raw === undefined || raw === null || raw === '') {
      return defaultValue;
    }
    const parsed = Number(raw);
    if (isNaN(parsed) || parsed < 1 || !Number.isFinite(parsed)) {
      this.logger.warn(
        `Invalid MARKET_DATA_RETENTION_YEARS value "${raw}". Using default: ${defaultValue}`,
      );
      return defaultValue;
    }
    return parsed;
  }

  /**
   * Returns whether tick storage is enabled.
   * Defaults to false if the value is missing or invalid.
   */
  get storeTicks(): boolean {
    const defaultValue = false;
    const raw = this.configService.get<string>('STORE_TICKS');
    if (raw === undefined || raw === null || raw === '') {
      return defaultValue;
    }
    const lower = raw.toLowerCase().trim();
    if (lower === 'true' || lower === '1') {
      return true;
    }
    if (lower === 'false' || lower === '0') {
      return false;
    }
    this.logger.warn(`Invalid STORE_TICKS value "${raw}". Using default: ${defaultValue}`);
    return defaultValue;
  }

  /**
   * Returns the tick batch size threshold for flushing.
   * Defaults to 1000 if the value is missing or invalid.
   */
  get tickBatchSize(): number {
    const defaultValue = 1000;
    const raw = this.configService.get<string>('TICK_BATCH_SIZE');
    if (raw === undefined || raw === null || raw === '') {
      return defaultValue;
    }
    const parsed = Number(raw);
    if (isNaN(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
      this.logger.warn(
        `Invalid TICK_BATCH_SIZE value "${raw}". Using default: ${defaultValue}`,
      );
      return defaultValue;
    }
    return parsed;
  }

  /**
   * Returns the tick batch interval in milliseconds.
   * Defaults to 5000 if the value is missing or invalid.
   */
  get tickBatchIntervalMs(): number {
    const defaultValue = 5000;
    const raw = this.configService.get<string>('TICK_BATCH_INTERVAL_MS');
    if (raw === undefined || raw === null || raw === '') {
      return defaultValue;
    }
    const parsed = Number(raw);
    if (isNaN(parsed) || parsed < 100 || !Number.isFinite(parsed)) {
      this.logger.warn(
        `Invalid TICK_BATCH_INTERVAL_MS value "${raw}". Using default: ${defaultValue}`,
      );
      return defaultValue;
    }
    return parsed;
  }

  /**
   * Returns whether background sync should run on startup.
   * Defaults to true if the value is missing or invalid.
   */
  get syncOnStartup(): boolean {
    const defaultValue = true;
    const raw = this.configService.get<string>('SYNC_ON_STARTUP');
    if (raw === undefined || raw === null || raw === '') {
      return defaultValue;
    }
    const lower = raw.toLowerCase().trim();
    if (lower === 'true' || lower === '1') {
      return true;
    }
    if (lower === 'false' || lower === '0') {
      return false;
    }
    this.logger.warn(`Invalid SYNC_ON_STARTUP value "${raw}". Using default: ${defaultValue}`);
    return defaultValue;
  }

  /**
   * Returns the cron expression for the retention cleanup job.
   * Defaults to "0 2 * * *" (daily at 2 AM) if not set.
   */
  get retentionCron(): string {
    const defaultValue = '0 2 * * *';
    const raw = this.configService.get<string>('RETENTION_CRON');
    if (raw === undefined || raw === null || raw.trim() === '') {
      return defaultValue;
    }
    return raw.trim();
  }

  /**
   * Returns the broker API rate limit in requests per second.
   * Defaults to 10 if the value is missing or invalid.
   */
  get brokerRateLimitRps(): number {
    const defaultValue = 10;
    const raw = this.configService.get<string>('BROKER_RATE_LIMIT_RPS');
    if (raw === undefined || raw === null || raw === '') {
      return defaultValue;
    }
    const parsed = Number(raw);
    if (isNaN(parsed) || parsed < 1 || !Number.isFinite(parsed)) {
      this.logger.warn(
        `Invalid BROKER_RATE_LIMIT_RPS value "${raw}". Using default: ${defaultValue}`,
      );
      return defaultValue;
    }
    return parsed;
  }
}
