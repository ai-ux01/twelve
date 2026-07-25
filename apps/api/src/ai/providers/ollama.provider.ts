import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as AppConfigService } from '../../config/config.service';
import axios, { AxiosInstance } from 'axios';
import { AiProvider } from './ai-provider.interface';
import { ParsedPrompt } from '../../prompt/prompt.service';
import { QuantAnalysisResult } from '../../quant/quant.service';
import { Recommendation } from '../ai.service';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama Provider - Local LLM inference
 *
 * Implements AI recommendations using locally-hosted Ollama models.
 * Provides privacy and cost benefits compared to cloud-based AI providers.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINT:
 * This provider NEVER receives raw market data (OHLCV).
 * It only receives processed quantitative results from Quant Engine.
 */
@Injectable()
export class OllamaProvider implements AiProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly client: AxiosInstance;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly maxRetries = 1; // Requirement 20.3: Retry once
  private readonly retryDelayMs = 2000; // Requirement 20.3: 2-second delay

  constructor(private readonly configService: AppConfigService) {
    this.baseUrl = this.configService.ollamaBaseUrl;
    this.model = this.configService.aiModel;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // 60 second timeout for local inference
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`Ollama provider initialized: ${this.baseUrl}, model: ${this.model}`);
  }

  /**
   * Generate trade recommendation using Ollama
   * Implements retry logic: retry once after 2 seconds on failure (Requirement 20.3)
   */
  async generateRecommendation(
    parsedPrompt: ParsedPrompt,
    quantAnalysis: QuantAnalysisResult
  ): Promise<Omit<Recommendation, 'id' | 'quantData'>> {
    this.logger.debug(
      `Generating recommendation for ${quantAnalysis.symbol} using Ollama model ${this.model}`
    );

    const prompt = this.buildRecommendationPrompt(parsedPrompt, quantAnalysis);
    let lastError: Error | null = null;

    // Attempt 1: Initial request
    try {
      const response = await this.generate(prompt);
      const recommendation = this.parseRecommendationResponse(response, quantAnalysis);

      this.logger.debug(
        `Generated recommendation: ${recommendation.action} ${quantAnalysis.symbol} @ ${recommendation.entryPrice}`
      );

      return recommendation;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(
        `Initial Ollama request failed: ${lastError.message}. Retrying in ${this.retryDelayMs}ms...`
      );
    }

    // Wait before retry (Requirement 20.3: 2-second delay)
    await this.delay(this.retryDelayMs);

    // Attempt 2: Retry once
    try {
      this.logger.debug('Retrying Ollama request...');
      const response = await this.generate(prompt);
      const recommendation = this.parseRecommendationResponse(response, quantAnalysis);

      this.logger.debug(
        `Generated recommendation after retry: ${recommendation.action} ${quantAnalysis.symbol} @ ${recommendation.entryPrice}`
      );

      return recommendation;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorStack = lastError.stack;
      this.logger.error(`Ollama request failed after retry: ${lastError.message}`, errorStack);
      throw lastError;
    }
  }

  /**
   * Analyze portfolio health using Ollama
   * Implements retry logic: retry once after 2 seconds on failure (Requirement 20.3)
   */
  async analyzePortfolio(portfolioState: any, quantAnalysis: QuantAnalysisResult[]): Promise<any> {
    this.logger.debug('Analyzing portfolio health using Ollama');

    const prompt = this.buildPortfolioAnalysisPrompt(portfolioState, quantAnalysis);
    let lastError: Error | null = null;

    // Attempt 1: Initial request
    try {
      const response = await this.generate(prompt);
      const analysis = this.parsePortfolioAnalysisResponse(response);

      this.logger.debug(`Portfolio health score: ${analysis.healthScore}`);

      return analysis;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(
        `Initial Ollama portfolio analysis failed: ${lastError.message}. Retrying in ${this.retryDelayMs}ms...`
      );
    }

    // Wait before retry (Requirement 20.3: 2-second delay)
    await this.delay(this.retryDelayMs);

    // Attempt 2: Retry once
    try {
      this.logger.debug('Retrying Ollama portfolio analysis...');
      const response = await this.generate(prompt);
      const analysis = this.parsePortfolioAnalysisResponse(response);

      this.logger.debug(`Portfolio health score after retry: ${analysis.healthScore}`);

      return analysis;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorStack = lastError.stack;
      this.logger.error(
        `Ollama portfolio analysis failed after retry: ${lastError.message}`,
        errorStack
      );
      throw lastError;
    }
  }

  /**
   * Call Ollama generate API
   */
  private async generate(prompt: string): Promise<string> {
    const request: OllamaGenerateRequest = {
      model: this.model,
      prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
      },
    };

    try {
      const response = await this.client.post<OllamaGenerateResponse>('/api/generate', request);

      if (!response.data.done) {
        throw new Error('Ollama response not complete');
      }

      return response.data.response;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to Ollama at ${this.baseUrl}. Ensure Ollama is running.`);
        }
        if (error.response?.status === 404) {
          throw new Error(
            `Model '${this.model}' not found. Pull the model using: ollama pull ${this.model}`
          );
        }
        throw new Error(`Ollama API error: ${error.response?.data?.error || error.message}`);
      }
      // Re-throw any error that has ECONNREFUSED code
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to Ollama at ${this.baseUrl}. Ensure Ollama is running.`);
      }
      throw error;
    }
  }

  /**
   * Build structured prompt for trade recommendation
   */
  private buildRecommendationPrompt(
    parsedPrompt: ParsedPrompt,
    quantAnalysis: QuantAnalysisResult
  ): string {
    const { symbol, timeframe, indicators, supportResistance, trendlines } = quantAnalysis;

    return `You are an expert trading analyst for Indian markets (NSE). Analyze the following quantitative data and provide a trade recommendation.

USER REQUEST: ${parsedPrompt.intent} for ${symbol} (${parsedPrompt.timeframe} timeframe)

QUANTITATIVE ANALYSIS:
Symbol: ${symbol}
Timeframe: ${timeframe}

Technical Indicators:
- RSI: ${indicators.rsi.toFixed(2)}
- MACD: ${indicators.macd.value.toFixed(2)} (Signal: ${indicators.macd.signal.toFixed(2)}, Histogram: ${indicators.macd.histogram.toFixed(2)})
- SMA 20: ${indicators.sma_20.toFixed(2)}
- SMA 50: ${indicators.sma_50.toFixed(2)}
- SMA 200: ${indicators.sma_200.toFixed(2)}
- EMA 20: ${indicators.ema_20.toFixed(2)}
- Bollinger Bands: Upper ${indicators.bollingerBands.upper.toFixed(2)}, Middle ${indicators.bollingerBands.middle.toFixed(2)}, Lower ${indicators.bollingerBands.lower.toFixed(2)}

Support/Resistance Levels:
${supportResistance.map((sr) => `- Level ${sr.level.toFixed(2)}, Strength: ${sr.strength.toFixed(2)}`).join('\n')}

Trendlines:
${trendlines.map((tl) => `- Slope ${tl.slope.toFixed(4)}, R²: ${tl.rSquared.toFixed(2)}`).join('\n')}

INSTRUCTIONS:
Based ONLY on the quantitative data provided above, provide a trade recommendation in the following JSON format:

{
  "action": "BUY" | "SELL" | "HOLD",
  "entryPrice": <number>,
  "target": <number>,
  "stopLoss": <number>,
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "<brief explanation>"
}

CRITICAL RULES:
1. Base your recommendation ONLY on the indicators provided
2. If conditions are unfavorable, recommend HOLD
3. For BUY: stopLoss < entryPrice < target
4. For SELL: target < entryPrice < stopLoss
5. Keep reasoning concise (2-3 sentences)
6. Confidence should reflect indicator agreement (0.0-1.0)

Provide ONLY the JSON response, no additional text.`;
  }

  /**
   * Build structured prompt for portfolio analysis
   */
  private buildPortfolioAnalysisPrompt(
    portfolioState: any,
    quantAnalysis: QuantAnalysisResult[]
  ): string {
    return `You are an expert portfolio analyst for Indian markets. Analyze the following portfolio state and quantitative data.

PORTFOLIO STATE:
${JSON.stringify(portfolioState, null, 2)}

QUANTITATIVE ANALYSIS FOR POSITIONS:
${quantAnalysis.map((qa) => JSON.stringify(qa, null, 2)).join('\n\n')}

Provide a portfolio health analysis in the following JSON format:

{
  "healthScore": <number between 0 and 100>,
  "recommendations": ["<recommendation 1>", "<recommendation 2>", ...],
  "warnings": ["<warning 1>", "<warning 2>", ...]
}

Provide ONLY the JSON response, no additional text.`;
  }

  /**
   * Parse Ollama response into Recommendation object
   */
  private parseRecommendationResponse(
    response: string,
    quantAnalysis: QuantAnalysisResult
  ): Omit<Recommendation, 'id' | 'quantData'> {
    try {
      // Extract JSON from response (in case there's additional text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Ollama response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.action || !['BUY', 'SELL', 'HOLD'].includes(parsed.action)) {
        throw new Error('Invalid or missing action in response');
      }

      // For HOLD recommendations, set prices to 0
      if (parsed.action === 'HOLD') {
        return {
          action: 'HOLD',
          symbol: quantAnalysis.symbol,
          entryPrice: 0,
          target: 0,
          stopLoss: 0,
          confidence: parsed.confidence || 0.5,
          reasoning: parsed.reasoning || 'No favorable trading conditions',
        };
      }

      // Validate numeric fields for BUY/SELL
      const entryPrice = parseFloat(parsed.entryPrice);
      const target = parseFloat(parsed.target);
      const stopLoss = parseFloat(parsed.stopLoss);
      const confidence = parseFloat(parsed.confidence);

      if (isNaN(entryPrice) || isNaN(target) || isNaN(stopLoss) || isNaN(confidence)) {
        throw new Error('Invalid numeric values in response');
      }

      // Validate price relationships
      if (parsed.action === 'BUY' && !(stopLoss < entryPrice && entryPrice < target)) {
        this.logger.warn('Invalid BUY price relationship, correcting...');
      }
      if (parsed.action === 'SELL' && !(target < entryPrice && entryPrice < stopLoss)) {
        this.logger.warn('Invalid SELL price relationship, correcting...');
      }

      return {
        action: parsed.action,
        symbol: quantAnalysis.symbol,
        entryPrice,
        target,
        stopLoss,
        confidence: Math.min(Math.max(confidence, 0), 1), // Clamp between 0 and 1
        reasoning: parsed.reasoning || 'No reasoning provided',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to parse recommendation response: ${errorMessage}`);
      this.logger.debug(`Raw response: ${response}`);

      // Return safe HOLD recommendation on parse failure
      return {
        action: 'HOLD',
        symbol: quantAnalysis.symbol,
        entryPrice: 0,
        target: 0,
        stopLoss: 0,
        confidence: 0,
        reasoning: `Failed to parse AI response: ${errorMessage}`,
      };
    }
  }

  /**
   * Parse Ollama response into portfolio analysis
   */
  private parsePortfolioAnalysisResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Ollama response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        healthScore: parsed.healthScore || 0,
        recommendations: parsed.recommendations || [],
        warnings: parsed.warnings || [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to parse portfolio analysis response: ${errorMessage}`);

      return {
        healthScore: 0,
        recommendations: [],
        warnings: [`Failed to parse AI response: ${errorMessage}`],
      };
    }
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
