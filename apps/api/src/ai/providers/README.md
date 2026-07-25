# AI Providers

This directory contains AI provider implementations for the ProfitTerminal AI service. The system supports multiple AI backends through a common provider interface.

## Available Providers

### Ollama Provider (Local LLM)

The Ollama provider enables local LLM inference using [Ollama](https://ollama.ai/), providing privacy and cost benefits.

#### Setup

1. **Install Ollama**

   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.ai/install.sh | sh

   # Or download from https://ollama.ai
   ```

2. **Pull a Model**

   ```bash
   # Recommended models for trading analysis:
   ollama pull llama2           # 7B parameters, good balance
   ollama pull mistral          # 7B parameters, excellent reasoning
   ollama pull codellama        # Better for structured outputs
   ```

3. **Configure Environment**

   ```bash
   # In .env file
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434  # Default
   AI_MODEL=llama2                          # Or your preferred model
   ```

4. **Start Ollama**
   ```bash
   # Ollama runs as a service by default after installation
   # Or start manually:
   ollama serve
   ```

#### Usage

The AI service will automatically use the Ollama provider when configured:

```typescript
import { AiService } from './ai/ai.service';

// The service automatically uses the configured provider
const recommendation = await aiService.generateRecommendation(parsedPrompt, quantAnalysis);
```

#### Configuration Options

- `OLLAMA_BASE_URL`: Ollama API endpoint (default: `http://localhost:11434`)
- `AI_MODEL`: Model name (default: `llama2`)

Supported models:

- `llama2` - Meta's LLaMA 2 (7B, 13B, 70B variants)
- `mistral` - Mistral AI's model (7B)
- `codellama` - Code-optimized LLaMA (good for structured JSON)
- `mixtral` - Mixture of Experts model (better reasoning)

#### Performance Tips

1. **GPU Acceleration**: Ollama automatically uses GPU if available (CUDA, Metal, ROCm)
2. **Model Size**: Larger models provide better analysis but are slower
   - 7B models: Fast, good for most use cases
   - 13B models: Better reasoning, moderate speed
   - 70B models: Best quality, requires powerful hardware
3. **Temperature**: Controlled in the provider (0.7 default)
4. **Timeout**: 60 seconds default for inference

#### Troubleshooting

**Connection Error**

```
Cannot connect to Ollama at http://localhost:11434
```

- Ensure Ollama is running: `ollama serve`
- Check the OLLAMA_BASE_URL setting

**Model Not Found**

```
Model 'llama2' not found
```

- Pull the model: `ollama pull llama2`
- Check available models: `ollama list`

**Slow Response**

- Use a smaller model (7B instead of 70B)
- Ensure GPU acceleration is working
- Check system resources

### OpenAI Provider (Coming Soon)

The OpenAI provider will use GPT models via OpenAI's API.

**Status**: TODO - Task 11.1

## Provider Interface

All providers implement the `AiProvider` interface:

```typescript
interface AiProvider {
  generateRecommendation(
    parsedPrompt: ParsedPrompt,
    quantAnalysis: QuantAnalysisResult
  ): Promise<Omit<Recommendation, 'id' | 'quantData'>>;

  analyzePortfolio(portfolioState: any, quantAnalysis: QuantAnalysisResult[]): Promise<any>;
}
```

## Adding a New Provider

1. Create a new provider file (e.g., `anthropic.provider.ts`)
2. Implement the `AiProvider` interface
3. Update `ai.service.ts` to support the new provider
4. Add configuration in `config.service.ts`
5. Update `.env.example` with new environment variables
6. Write tests following the pattern in `ollama.provider.spec.ts`

## Architecture Notes

**CRITICAL**: All providers MUST adhere to the architectural constraint:

- Providers receive ONLY processed quantitative results from the Quant Engine
- Providers NEVER receive raw market data (OHLCV)
- This prevents AI hallucination from affecting trade execution

The data flow is strictly enforced:

```
Market Data → Quant Engine → AI Provider → Risk Engine → User Confirmation → Broker
```

## Testing

Run provider tests:

```bash
npm test -- src/ai/providers/ollama.provider.spec.ts
```

Test coverage includes:

- Recommendation generation (BUY/SELL/HOLD)
- Portfolio analysis
- Error handling (connection, model not found, parsing errors)
- Input validation
- Response parsing
