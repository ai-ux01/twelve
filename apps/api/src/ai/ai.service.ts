import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as AppConfigService } from '../config/config.service';
import { QuantAnalysisResult, ScoreResult } from '../quant/quant.service';
import { ParsedPrompt } from '../prompt/prompt.service';
import { PortfolioResponse } from '../portfolio/portfolio.service';
import { AiProvider } from './providers/ai-provider.interface';
import { OllamaProvider } from './providers/ollama.provider';
import { AuditLogService } from '../audit/audit.service';

export interface Recommendation {
  id: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  entryPrice: number;
  target: number;
  stopLoss: number;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  quantData: QuantAnalysisResult;
  score?: ScoreResult; // Optional market scoring from Quant Engine
  aiUnavailable?: boolean; // Flag to indicate AI failure (Requirement 20.3)
}

/**
 * AI Service - Generates trade recommendations based on quantitative analysis
 *
 * CRITICAL ARCHITECTURAL CONSTRAINT:
 * This service NEVER receives raw market data (OHLCV).
 * It only receives processed quantitative results from Quant Engine.
 * This prevents AI hallucination from affecting trade execution.
 *
 * Supports multiple AI providers through abstraction:
 * - OpenAI (external API)
 * - Ollama (local LLM)
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly provider: AiProvider;
  private readonly providerType: 'openai' | 'ollama';

  constructor(
    private readonly configService: AppConfigService,
    private readonly auditLogService: AuditLogService
  ) {
    this.providerType = this.configService.aiProvider;
    this.provider = this.createProvider();
    this.logger.log(`AI Provider: ${this.providerType}`);
  }

  /**
   * Create the appropriate AI provider based on configuration
   */
  private createProvider(): AiProvider {
    switch (this.providerType) {
      case 'ollama':
        return new OllamaProvider(this.configService);
      case 'openai':
        // TODO: Task 11.1 - Implement OpenAI provider
        throw new Error('OpenAI provider not yet implemented. Use AI_PROVIDER=ollama for now.');
      default:
        throw new Error(`Unsupported AI provider: ${this.providerType}`);
    }
  }

  /**
   * Generate trade recommendation based on quantitative analysis
   *
   * @param parsedPrompt - User's parsed intent
   * @param quantAnalysis - Processed quantitative results (NOT raw market data)
   * @param portfolioState - Optional current portfolio state
   * @returns Trade recommendation
   */
  async generateRecommendation(
    parsedPrompt: ParsedPrompt,
    quantAnalysis: QuantAnalysisResult,
    portfolioState?: PortfolioResponse
  ): Promise<Recommendation> {
    this.logger.debug(
      `Generating recommendation for ${quantAnalysis.symbol} using ${this.providerType}`
    );

    try {
      const recommendation = await this.provider.generateRecommendation(
        parsedPrompt,
        quantAnalysis,
        portfolioState
      );

      // Log successful AI Service call (Requirement 18.6)
      await this.auditLogService.logAiCall(
        'generate_recommendation',
        {
          symbol: quantAnalysis.symbol,
          intent: parsedPrompt.intent,
          timeframe: parsedPrompt.timeframe,
        },
        true,
        undefined,
        {
          action: recommendation.action,
          confidence: recommendation.confidence,
        }
      );

      // Add generated ID and attach quantData
      return {
        id: this.generateId(),
        ...recommendation,
        quantData: quantAnalysis,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to generate recommendation: ${errorMessage}`, errorStack);

      // Log failed AI Service call (Requirement 18.6)
      await this.auditLogService.logAiCall(
        'generate_recommendation',
        {
          symbol: quantAnalysis.symbol,
          intent: parsedPrompt.intent,
        },
        false,
        errorMessage
      );

      // Requirement 20.3: Return quantitative analysis without AI reasoning
      // This allows the system to continue operating even if AI fails
      return {
        id: this.generateId(),
        action: 'HOLD',
        symbol: quantAnalysis.symbol,
        entryPrice: 0,
        target: 0,
        stopLoss: 0,
        confidence: 0,
        reasoning: 'AI analysis unavailable',
        quantData: quantAnalysis,
        aiUnavailable: true, // Flag to indicate AI failure
      };
    }
  }

  /**
   * Analyze portfolio health based on current positions
   *
   * @param portfolioState - Current portfolio state
   * @param quantAnalysis - Array of quant analysis for all positions
   */
  async analyzePortfolio(
    portfolioState: PortfolioResponse,
    quantAnalysis: QuantAnalysisResult[]
  ): Promise<any> {
    this.logger.debug('Analyzing portfolio health');

    try {
      const result = await this.provider.analyzePortfolio(portfolioState, quantAnalysis);

      // Log successful AI Service call (Requirement 18.6)
      await this.auditLogService.logAiCall(
        'analyze_portfolio',
        {
          totalValue: portfolioState.totalValue,
          positionCount: portfolioState.positions.length,
        },
        true,
        undefined,
        {
          healthScore: result.healthScore,
          recommendationsCount: result.recommendations?.length || 0,
        }
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to analyze portfolio: ${errorMessage}`, errorStack);

      // Log failed AI Service call (Requirement 18.6)
      await this.auditLogService.logAiCall(
        'analyze_portfolio',
        {
          totalValue: portfolioState.totalValue,
        },
        false,
        errorMessage
      );

      return {
        healthScore: 0,
        recommendations: [],
        warnings: [`Portfolio analysis error: ${errorMessage}`],
      };
    }
  }

  private generateId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
