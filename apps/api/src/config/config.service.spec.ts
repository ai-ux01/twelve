import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;

  // Helper function to create a testing module with custom env vars
  const createTestingModule = async (envVars: Record<string, string>) => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        NestConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => envVars],
        }),
      ],
      providers: [ConfigService],
    }).compile();

    return module.get<ConfigService>(ConfigService);
  };

  describe('Database Configuration', () => {
    it('should return database URL', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.databaseUrl).toBe('postgresql://localhost:5432/test');
    });

    it('should throw error if DATABASE_URL is missing', async () => {
      await expect(createTestingModule({})).rejects.toThrow(
        'Missing required environment variables: DATABASE_URL'
      );
    });
  });

  describe('Kite Connect API Configuration', () => {
    beforeEach(async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        KITE_API_KEY: 'test_kite_key',
        KITE_API_SECRET: 'test_kite_secret',
      });
    });

    it('should return Kite API key', () => {
      expect(service.kiteApiKey).toBe('test_kite_key');
    });

    it('should return Kite API secret', () => {
      expect(service.kiteApiSecret).toBe('test_kite_secret');
    });

    it('should return undefined for missing Kite credentials', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.kiteApiKey).toBeUndefined();
      expect(service.kiteApiSecret).toBeUndefined();
    });
  });

  describe('Kotak Neo API Configuration', () => {
    beforeEach(async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        KOTAK_API_KEY: 'test_kotak_key',
        KOTAK_API_SECRET: 'test_kotak_secret',
      });
    });

    it('should return Kotak API key', () => {
      expect(service.kotakApiKey).toBe('test_kotak_key');
    });

    it('should return Kotak API secret', () => {
      expect(service.kotakApiSecret).toBe('test_kotak_secret');
    });

    it('should return undefined for missing Kotak credentials', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.kotakApiKey).toBeUndefined();
      expect(service.kotakApiSecret).toBeUndefined();
    });
  });

  describe('AI Provider Configuration', () => {
    it('should return OpenAI as default provider', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.aiProvider).toBe('openai');
    });

    it('should return configured AI provider (openai)', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'openai',
      });
      expect(service.aiProvider).toBe('openai');
    });

    it('should return configured AI provider (ollama)', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'ollama',
      });
      expect(service.aiProvider).toBe('ollama');
    });

    it('should throw error for invalid AI provider', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'invalid',
      });
      expect(() => service.aiProvider).toThrow(
        "Invalid AI_PROVIDER: invalid. Must be 'openai' or 'ollama'"
      );
    });

    it('should return OpenAI API key', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        OPENAI_API_KEY: 'sk-test-key',
      });
      expect(service.openaiApiKey).toBe('sk-test-key');
    });

    it('should return Ollama base URL with default', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.ollamaBaseUrl).toBe('http://localhost:11434');
    });

    it('should return configured Ollama base URL', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        OLLAMA_BASE_URL: 'http://custom:8080',
      });
      expect(service.ollamaBaseUrl).toBe('http://custom:8080');
    });

    it('should return OpenAI API key when provider is openai', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test-key',
      });
      expect(service.aiApiKey).toBe('sk-test-key');
    });

    it('should return undefined for aiApiKey when provider is ollama', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'ollama',
      });
      expect(service.aiApiKey).toBeUndefined();
    });

    it('should return default model for openai provider', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'openai',
      });
      expect(service.aiModel).toBe('gpt-4');
    });

    it('should return default model for ollama provider', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'ollama',
      });
      expect(service.aiModel).toBe('llama2');
    });

    it('should return custom model when specified', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'openai',
        AI_MODEL: 'gpt-3.5-turbo',
      });
      expect(service.aiModel).toBe('gpt-3.5-turbo');
    });
  });

  describe('Service URLs Configuration', () => {
    it('should return backend API URL with default', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.backendApiUrl).toBe('http://localhost:4000');
    });

    it('should return configured backend API URL', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        BACKEND_API_URL: 'http://custom:5000',
      });
      expect(service.backendApiUrl).toBe('http://custom:5000');
    });

    it('should return Quant Engine URL with default', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.quantEngineUrl).toBe('http://localhost:8000');
    });

    it('should return configured Quant Engine URL', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        QUANT_ENGINE_URL: 'http://quant:9000',
      });
      expect(service.quantEngineUrl).toBe('http://quant:9000');
    });
  });

  describe('JWT Configuration', () => {
    it('should return JWT secret with default', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.jwtSecret).toBe('your-super-secret-jwt-key-change-this-in-production');
    });

    it('should return configured JWT secret', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        JWT_SECRET: 'custom-secret',
      });
      expect(service.jwtSecret).toBe('custom-secret');
    });
  });

  describe('Risk Parameters Configuration', () => {
    it('should return default max position size', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.defaultMaxPositionSize).toBe(100000);
    });

    it('should return configured max position size', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        DEFAULT_MAX_POSITION_SIZE: '200000',
      });
      expect(service.defaultMaxPositionSize).toBe(200000);
    });

    it('should return default max drawdown', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.defaultMaxDrawdown).toBe(0.05);
    });

    it('should return configured max drawdown', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        DEFAULT_MAX_DRAWDOWN: '0.1',
      });
      expect(service.defaultMaxDrawdown).toBe(0.1);
    });

    it('should return default max portfolio exposure', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.defaultMaxPortfolioExposure).toBe(0.3);
    });

    it('should return configured max portfolio exposure', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        DEFAULT_MAX_PORTFOLIO_EXPOSURE: '0.5',
      });
      expect(service.defaultMaxPortfolioExposure).toBe(0.5);
    });

    it('should return default stop loss', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.defaultStopLoss).toBe(0.02);
    });

    it('should return configured stop loss', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        DEFAULT_STOP_LOSS: '0.03',
      });
      expect(service.defaultStopLoss).toBe(0.03);
    });
  });

  describe('Server Configuration', () => {
    it('should return default port', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      expect(service.port).toBe(4000);
    });

    it('should return configured port', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        PORT: '5000',
      });
      expect(service.port).toBe(5000);
    });

    it('should return default node environment', async () => {
      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
      });
      // Jest sets NODE_ENV to 'test' by default
      expect(service.nodeEnv).toBe('test');
    });

    it('should return configured node environment', async () => {
      // Note: When using ignoreEnvFile and load, the actual process.env.NODE_ENV
      // (which Jest sets to 'test') may still be picked up. This test verifies
      // that explicit config takes precedence when properly set.
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        NODE_ENV: 'production',
      });

      expect(service.nodeEnv).toBe('production');

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should correctly identify production environment', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        NODE_ENV: 'production',
      });

      expect(service.isProduction).toBe(true);
      expect(service.isDevelopment).toBe(false);

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should correctly identify development environment', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      service = await createTestingModule({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        NODE_ENV: 'development',
      });

      expect(service.isProduction).toBe(false);
      expect(service.isDevelopment).toBe(true);

      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});
