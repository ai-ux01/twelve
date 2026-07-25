# Configuration Module

The Configuration Module provides type-safe access to environment variables with validation using `class-validator`.

## Features

- **Type-safe environment variable access**: All configuration values are accessed through typed getters
- **Validation on startup**: Required environment variables are validated when the application starts
- **Default values**: Sensible defaults are provided for optional configuration
- **Provider abstraction**: Support for multiple AI providers (OpenAI, Ollama)
- **Risk parameter configuration**: Default risk parameters for trading

## Usage

### Import the ConfigModule

```typescript
import { ConfigModule } from './config/config.module';

@Module({
  imports: [ConfigModule],
})
export class AppModule {}
```

### Inject ConfigService

```typescript
import { ConfigService } from './config/config.service';

@Injectable()
export class MyService {
  constructor(private readonly configService: ConfigService) {}

  someMethod() {
    const databaseUrl = this.configService.databaseUrl;
    const kiteApiKey = this.configService.kiteApiKey;
    // ... etc
  }
}
```

## Environment Variables

### Required

- `DATABASE_URL`: PostgreSQL connection string

### Optional - Market Data & Broker APIs

- `KITE_API_KEY`: Kite Connect API key for market data
- `KITE_API_SECRET`: Kite Connect API secret
- `KOTAK_API_KEY`: Kotak Neo API key for broker execution
- `KOTAK_API_SECRET`: Kotak Neo API secret

### Optional - AI Provider Configuration

- `AI_PROVIDER`: AI provider to use (`openai` or `ollama`, default: `openai`)
- `OPENAI_API_KEY`: OpenAI API key (required if using OpenAI)
- `OLLAMA_BASE_URL`: Ollama base URL (default: `http://localhost:11434`)
- `AI_MODEL`: AI model to use (default: `gpt-4` for OpenAI, `llama2` for Ollama)

### Optional - Service URLs

- `BACKEND_API_URL`: Backend API URL (default: `http://localhost:4000`)
- `QUANT_ENGINE_URL`: Quant Engine URL (default: `http://localhost:8000`)

### Optional - Security

- `JWT_SECRET`: Secret key for JWT token generation (default: `your-super-secret-jwt-key-change-this-in-production`)

### Optional - Risk Parameters

- `DEFAULT_MAX_POSITION_SIZE`: Maximum position size in currency (default: `100000`)
- `DEFAULT_MAX_DRAWDOWN`: Maximum drawdown percentage (default: `0.05`)
- `DEFAULT_MAX_PORTFOLIO_EXPOSURE`: Maximum portfolio exposure percentage (default: `0.3`)
- `DEFAULT_STOP_LOSS`: Default stop loss percentage (default: `0.02`)

### Optional - Server Configuration

- `PORT`: Server port (default: `4000`)
- `NODE_ENV`: Node environment (`development`, `production`, etc., default: `development`)

## Available Getters

### Database

- `databaseUrl: string`

### Kite Connect API

- `kiteApiKey: string | undefined`
- `kiteApiSecret: string | undefined`

### Kotak Neo API

- `kotakApiKey: string | undefined`
- `kotakApiSecret: string | undefined`

### AI Provider

- `aiProvider: 'openai' | 'ollama'`
- `openaiApiKey: string | undefined`
- `ollamaBaseUrl: string`
- `aiApiKey: string | undefined` (returns appropriate key based on provider)
- `aiModel: string`

### Service URLs

- `backendApiUrl: string`
- `quantEngineUrl: string`

### Security

- `jwtSecret: string`

### Risk Parameters

- `defaultMaxPositionSize: number`
- `defaultMaxDrawdown: number`
- `defaultMaxPortfolioExposure: number`
- `defaultStopLoss: number`

### Server

- `port: number`
- `nodeEnv: string`
- `isProduction: boolean`
- `isDevelopment: boolean`

## Validation

The module uses `class-validator` to validate environment variables on startup. If validation fails, the application will throw an error with details about the invalid configuration.

## Testing

The module includes comprehensive unit tests:

- `config.service.spec.ts`: Tests for ConfigService
- `env.validation.spec.ts`: Tests for environment variable validation

Run tests with:

```bash
npm test -- --testPathPattern=config
```
