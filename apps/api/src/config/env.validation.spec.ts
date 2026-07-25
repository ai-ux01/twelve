import 'reflect-metadata';
import { validate, EnvironmentVariables } from './env.validation';

describe('Environment Validation', () => {
  describe('validate function', () => {
    it('should validate valid configuration', () => {
      const config = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'openai',
      };

      const result = validate(config);
      expect(result).toBeInstanceOf(EnvironmentVariables);
      expect(result.DATABASE_URL).toBe('postgresql://localhost:5432/test');
    });

    it('should throw error for missing DATABASE_URL', () => {
      const config = {
        AI_PROVIDER: 'openai',
      };

      expect(() => validate(config)).toThrow('Environment variable validation failed');
    });

    it('should throw error for invalid AI_PROVIDER', () => {
      const config = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'invalid-provider',
      };

      expect(() => validate(config)).toThrow('Environment variable validation failed');
    });

    it('should accept openai as valid AI_PROVIDER', () => {
      const config = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'openai',
      };

      const result = validate(config);
      expect(result.AI_PROVIDER).toBe('openai');
    });

    it('should accept ollama as valid AI_PROVIDER', () => {
      const config = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'ollama',
      };

      const result = validate(config);
      expect(result.AI_PROVIDER).toBe('ollama');
    });

    it('should validate URL format for OLLAMA_BASE_URL', () => {
      const config = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'openai',
        OLLAMA_BASE_URL: 'this is not a url at all',
      };

      expect(() => validate(config)).toThrow('Environment variable validation failed');
    });

    it('should accept valid URL for OLLAMA_BASE_URL', () => {
      const config = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'openai',
        OLLAMA_BASE_URL: 'http://localhost:11434',
      };

      const result = validate(config);
      expect(result.OLLAMA_BASE_URL).toBe('http://localhost:11434');
    });

    it('should validate URL format for QUANT_ENGINE_URL', () => {
      const config = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'openai',
        QUANT_ENGINE_URL: 'this is not a url at all',
      };

      expect(() => validate(config)).toThrow('Environment variable validation failed');
    });

    it('should convert numeric strings to numbers', () => {
      const config = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'openai',
        PORT: '5000',
        DEFAULT_MAX_POSITION_SIZE: '200000',
        DEFAULT_MAX_DRAWDOWN: '0.1',
        DEFAULT_MAX_PORTFOLIO_EXPOSURE: '0.5',
        DEFAULT_STOP_LOSS: '0.03',
      };

      const result = validate(config);
      expect(result.PORT).toBe(5000);
      expect(typeof result.PORT).toBe('number');
      expect(result.DEFAULT_MAX_POSITION_SIZE).toBe(200000);
      expect(typeof result.DEFAULT_MAX_POSITION_SIZE).toBe('number');
      expect(result.DEFAULT_MAX_DRAWDOWN).toBe(0.1);
      expect(typeof result.DEFAULT_MAX_DRAWDOWN).toBe('number');
    });

    it('should throw error for invalid numeric values', () => {
      const config = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'openai',
        PORT: 'not-a-number',
      };

      expect(() => validate(config)).toThrow('Environment variable validation failed');
    });

    it('should allow all optional fields to be undefined', () => {
      const config = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        AI_PROVIDER: 'openai',
      };

      const result = validate(config);
      expect(result.KITE_API_KEY).toBeUndefined();
      expect(result.KITE_API_SECRET).toBeUndefined();
      expect(result.KOTAK_API_KEY).toBeUndefined();
      expect(result.KOTAK_API_SECRET).toBeUndefined();
      expect(result.OPENAI_API_KEY).toBeUndefined();
      expect(result.JWT_SECRET).toBeUndefined();
    });

    it('should validate complete configuration with all fields', () => {
      const config = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        KITE_API_KEY: 'kite_key',
        KITE_API_SECRET: 'kite_secret',
        KOTAK_API_KEY: 'kotak_key',
        KOTAK_API_SECRET: 'kotak_secret',
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test-key',
        OLLAMA_BASE_URL: 'http://localhost:11434',
        AI_MODEL: 'gpt-4',
        BACKEND_API_URL: 'http://localhost:4000',
        QUANT_ENGINE_URL: 'http://localhost:8000',
        JWT_SECRET: 'secret',
        DEFAULT_MAX_POSITION_SIZE: '100000',
        DEFAULT_MAX_DRAWDOWN: '0.05',
        DEFAULT_MAX_PORTFOLIO_EXPOSURE: '0.3',
        DEFAULT_STOP_LOSS: '0.02',
        PORT: '4000',
        NODE_ENV: 'development',
      };

      const result = validate(config);
      expect(result).toBeInstanceOf(EnvironmentVariables);
      expect(result.DATABASE_URL).toBe('postgresql://localhost:5432/test');
      expect(result.KITE_API_KEY).toBe('kite_key');
      expect(result.AI_PROVIDER).toBe('openai');
      expect(result.PORT).toBe(4000);
    });
  });
});
