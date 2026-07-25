import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

/**
 * Configuration service for managing environment variables in ProfitTerminal.
 * Provides typed getters for all environment variables with validation.
 */
@Injectable()
export class ConfigService {
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

  // Kotak Neo API Configuration
  get kotakApiKey(): string | undefined {
    return this.configService.get<string>('KOTAK_API_KEY');
  }

  get kotakApiSecret(): string | undefined {
    return this.configService.get<string>('KOTAK_API_SECRET');
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
}
