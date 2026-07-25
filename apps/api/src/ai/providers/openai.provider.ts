import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '../../config/config.service';
import { QuantAnalysisResult } from '../../quant/quant.service';
import { ParsedPrompt } from '../../prompt/prompt.service';
import { Recommendation } from '../ai.service';

/**
 * OpenAI Provider - External AI API integration for trade recommendations
 *
 * CRITICAL: This provider ONLY receives quantitative analysis results,
 * NEVER raw market data. This prevents AI hallucination from affecting trades.
 */
@Injectable()
export class OpenAIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly client: OpenAI | null = null;
  private readonly model: string;
  private readonly maxRetries = 1;
  private readonly retryDelayMs = 2000;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.openaiApiKey;
    this.model = this.configService.aiModel;

    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured. Provider will not be functional.');
    } else {
      this.client = new OpenAI({
        apiKey,
        maxRetries: 0, // We handle retries manually
      });
      this.logger.log(`OpenAI provider initialized with model: ${this.model}`);
    }
  }

  /**
   * Generate trade recommendation using OpenAI API
   * Implements retry logic: retry once after 2 seconds on failure
   *
   * @param parsedPrompt - User's parsed intent
   * @param quantAnalysis - Processed quantitative results (NOT raw market data)
   * @returns Trade recommendation
   */
  async generateRecommendation(
    parsedPrompt: ParsedPrompt,
    quantAnalysis: QuantAnalysisResult
  ): Promise<Recommendation> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured');
    }

    let lastError: Error | null = null;

    // Attempt 1: Initial request
    try {
      return await this.makeRecommendationRequest(parsedPrompt, quantAnalysis);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(
        `Initial OpenAI request failed: ${lastError.message}. Retrying in ${this.retryDelayMs}ms...`
      );
    }

    // Wait before retry
    await this.delay(this.retryDelayMs);

    // Attempt 2: Retry once
    try {
      this.logger.debug('Retrying OpenAI request...');
      return await this.makeRecommendationRequest(parsedPrompt, quantAnalysis);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`OpenAI request failed after retry: ${lastError.message}`);
      throw new Error(`Failed to generate recommendation from OpenAI: ${lastError.message}`);
    }
  }

  /**
   * Make a single recommendation request to OpenAI
   */
  private async makeRecommendationRequest(
    parsedPrompt: ParsedPrompt,
    quantAnalysis: QuantAnalysisResult
  ): Promise<Recommendation> {
    const prompt = this.buildPrompt(parsedPrompt, quantAnalysis);

    this.logger.debug(`Sending recommendation request to OpenAI for ${quantAnalysis.symbol}`);

    const response = await this.client!.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return this.parseResponse(content, quantAnalysis);
  }

  /**
   * Build structured prompt with quantitative results ONLY
   * NEVER includes raw market data
   */
  private buildPrompt(parsedPrompt: ParsedPrompt, quantAnalysis: QuantAnalysisResult): string {
    const { symbol, timeframe, indicators, supportResistance, trendlines, optionsGreeks } =
      quantAnalysis;

    let prompt = `Analyze the following quantitative data and provide a trade recommendation.\n\n`;

    prompt += `**Symbol:** ${symbol}\n`;
    prompt += `**Timeframe:** ${timeframe}\n`;
    prompt += `**User Intent:** ${parsedPrompt.intent}\n`;
    if (parsedPrompt.timeframe) {
      prompt += `**Trade Type:** ${parsedPrompt.timeframe}\n`;
    }
    if (parsedPrompt.assetType) {
      prompt += `**Asset Type:** ${parsedPrompt.assetType}\n`;
    }

    prompt += `\n**Technical Indicators:**\n`;
    prompt += `- RSI: ${indicators.rsi.toFixed(2)}\n`;
    prompt += `- MACD: Value=${indicators.macd.value.toFixed(2)}, Signal=${indicators.macd.signal.toFixed(2)}, Histogram=${indicators.macd.histogram.toFixed(2)}\n`;
    prompt += `- SMA 20: ${indicators.sma_20.toFixed(2)}\n`;
    prompt += `- SMA 50: ${indicators.sma_50.toFixed(2)}\n`;
    prompt += `- SMA 200: ${indicators.sma_200.toFixed(2)}\n`;
    prompt += `- EMA 20: ${indicators.ema_20.toFixed(2)}\n`;
    prompt += `- Bollinger Bands: Upper=${indicators.bollingerBands.upper.toFixed(2)}, Middle=${indicators.bollingerBands.middle.toFixed(2)}, Lower=${indicators.bollingerBands.lower.toFixed(2)}\n`;

    if (supportResistance.length > 0) {
      prompt += `\n**Support & Resistance Levels:**\n`;
      supportResistance.forEach((level, idx) => {
        prompt += `- Level ${idx + 1}: ${level.level.toFixed(2)} (Strength: ${(level.strength * 100).toFixed(0)}%)\n`;
      });
    }

    if (trendlines.length > 0) {
      prompt += `\n**Trendlines:**\n`;
      trendlines.forEach((trendline, idx) => {
        const direction = trendline.slope > 0 ? 'Uptrend' : 'Downtrend';
        prompt += `- Trendline ${idx + 1}: ${direction}, Slope=${trendline.slope.toFixed(4)}, R²=${trendline.rSquared.toFixed(3)}\n`;
      });
    }

    if (optionsGreeks) {
      prompt += `\n**Options Greeks:**\n`;
      prompt += `- Delta: ${optionsGreeks.delta.toFixed(4)}\n`;
      prompt += `- Gamma: ${optionsGreeks.gamma.toFixed(4)}\n`;
      prompt += `- Theta: ${optionsGreeks.theta.toFixed(4)}\n`;
      prompt += `- Vega: ${optionsGreeks.vega.toFixed(4)}\n`;
    }

    prompt += `\nBased on this quantitative analysis, provide your recommendation.`;

    return prompt;
  }

  /**
   * System prompt defining the AI's role and output format
   */
  private getSystemPrompt(): string {
    return `You are an expert trading analyst for Indian equity markets (NSE). Your role is to analyze quantitative data and provide trade recommendations.

**CRITICAL RULES:**
1. You receive ONLY quantitative analysis results (technical indicators, trendlines, support/resistance)
2. You NEVER receive raw market data (OHLCV, order book)
3. You provide recommendations, NOT trading orders
4. All recommendations must pass through Risk Engine validation
5. When conditions are unclear or unfavorable, recommend HOLD

**OUTPUT FORMAT:**
You must respond with a valid JSON object containing:
{
  "action": "BUY" | "SELL" | "HOLD",
  "entryPrice": number,
  "target": number,
  "stopLoss": number,
  "confidence": number (0.0 to 1.0),
  "reasoning": "string explaining your recommendation"
}

**GUIDELINES:**
- For BUY: stopLoss < entryPrice < target
- For SELL: target < entryPrice < stopLoss
- For HOLD: set all prices to 0
- Confidence should reflect the strength of indicators (0.0 = very uncertain, 1.0 = very confident)
- Reasoning should cite specific indicators and why they support the recommendation
- Consider RSI for overbought/oversold conditions
- Consider MACD for momentum and trend changes
- Consider moving averages for trend direction
- Consider Bollinger Bands for volatility and potential reversals
- Consider support/resistance levels for entry/exit points
- Consider trendlines for trend confirmation
- For swing trades, focus on daily/weekly patterns
- For intraday trades, focus on shorter-term momentum
- For scalping, focus on immediate support/resistance and quick moves

Be conservative. When in doubt, recommend HOLD.`;
  }

  /**
   * Parse OpenAI response into Recommendation object
   */
  private parseResponse(content: string, quantAnalysis: QuantAnalysisResult): Recommendation {
    try {
      const parsed = JSON.parse(content);

      // Validate required fields
      if (!parsed.action || !['BUY', 'SELL', 'HOLD'].includes(parsed.action)) {
        throw new Error('Invalid action in response');
      }

      if (
        typeof parsed.entryPrice !== 'number' ||
        typeof parsed.target !== 'number' ||
        typeof parsed.stopLoss !== 'number' ||
        typeof parsed.confidence !== 'number'
      ) {
        throw new Error('Invalid numeric fields in response');
      }

      if (!parsed.reasoning || typeof parsed.reasoning !== 'string') {
        throw new Error('Invalid reasoning in response');
      }

      // Validate confidence is between 0 and 1
      const confidence = Math.max(0, Math.min(1, parsed.confidence));

      // Validate price relationships
      if (parsed.action === 'BUY') {
        if (parsed.stopLoss >= parsed.entryPrice || parsed.target <= parsed.entryPrice) {
          this.logger.warn('Invalid BUY price relationships, adjusting to HOLD');
          parsed.action = 'HOLD';
          parsed.entryPrice = 0;
          parsed.target = 0;
          parsed.stopLoss = 0;
        }
      } else if (parsed.action === 'SELL') {
        if (parsed.stopLoss <= parsed.entryPrice || parsed.target >= parsed.entryPrice) {
          this.logger.warn('Invalid SELL price relationships, adjusting to HOLD');
          parsed.action = 'HOLD';
          parsed.entryPrice = 0;
          parsed.target = 0;
          parsed.stopLoss = 0;
        }
      }

      return {
        id: this.generateId(),
        action: parsed.action,
        symbol: quantAnalysis.symbol,
        entryPrice: parsed.entryPrice,
        target: parsed.target,
        stopLoss: parsed.stopLoss,
        confidence,
        reasoning: parsed.reasoning,
        quantData: quantAnalysis,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown parse error';
      this.logger.error(`Failed to parse OpenAI response: ${errorMessage}`);
      this.logger.debug(`Raw response: ${content}`);

      // Return safe HOLD recommendation on parse failure
      return {
        id: this.generateId(),
        action: 'HOLD',
        symbol: quantAnalysis.symbol,
        entryPrice: 0,
        target: 0,
        stopLoss: 0,
        confidence: 0,
        reasoning: `Failed to parse AI response: ${errorMessage}`,
        quantData: quantAnalysis,
      };
    }
  }

  /**
   * Generate unique recommendation ID
   */
  private generateId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
