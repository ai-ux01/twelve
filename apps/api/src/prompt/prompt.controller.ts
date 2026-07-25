import {
  Controller,
  Post,
  Body,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { PromptService, ParsedPrompt } from './prompt.service';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService, QuantAnalysisResult, ScoreResult } from '../quant/quant.service';
import { AiService, Recommendation } from '../ai/ai.service';
import { PrismaService } from '../database/prisma.service';

class SubmitPromptDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string;
}

interface PromptResponse {
  rawPrompt: string;
  parsed: ParsedPrompt;
  recommendation: Recommendation;
}

/**
 * PromptController - Handles POST /api/prompt endpoint
 *
 * Orchestrates the complete flow:
 * 1. PromptService - Parses natural language prompt
 * 2. MarketDataService - Fetches market data for symbols
 * 3. QuantService - Sends data to Quant Engine for technical analysis
 * 4. AiService - Generates recommendation from quant results
 *
 * CRITICAL: Ensures AI only receives quant results, NOT raw market data.
 *
 * Requirements: 4.1, 4.2, 18.3
 */
@Controller('prompt')
export class PromptController {
  private readonly logger = new Logger(PromptController.name);

  constructor(
    private readonly promptService: PromptService,
    private readonly marketDataService: MarketDataService,
    private readonly quantService: QuantService,
    private readonly aiService: AiService,
    private readonly prisma: PrismaService
  ) {}

  @Post()
  async submitPrompt(@Body() dto: SubmitPromptDto): Promise<PromptResponse> {
    this.logger.log(`Received prompt: ${dto.prompt}`);

    // Step 1: Parse the natural language prompt
    const parsedPrompt = this.promptService.parsePrompt(dto.prompt);
    this.logger.debug(`Parsed prompt: ${JSON.stringify(parsedPrompt)}`);

    // Validate that we have at least one symbol
    if (!parsedPrompt.symbols || parsedPrompt.symbols.length === 0) {
      throw new BadRequestException(
        'No trading symbols found in prompt. Please specify a stock symbol (e.g., RELIANCE, TCS, INFY).'
      );
    }

    // For now, process the first symbol
    const symbol = parsedPrompt.symbols[0];
    this.logger.log(`Processing symbol: ${symbol}`);

    try {
      // Step 2: Fetch market data from Market Data Provider
      const timeframe = this.getTimeframeForAnalysis(parsedPrompt.timeframe);
      const fromDate = this.getFromDateForTimeframe(parsedPrompt.timeframe);

      this.logger.debug(
        `Fetching market data for ${symbol} (timeframe: ${timeframe}, from: ${fromDate?.toISOString()})`
      );

      const marketData = await this.marketDataService.getMarketData(
        symbol,
        timeframe,
        fromDate,
        new Date()
      );

      if (!marketData.data || marketData.data.length === 0) {
        throw new HttpException(
          `No market data available for symbol: ${symbol}`,
          HttpStatus.NOT_FOUND
        );
      }

      this.logger.debug(`Retrieved ${marketData.data.length} data points for ${symbol}`);

      // Step 3: Send market data to Quant Engine for analysis
      // CRITICAL: Raw market data goes to Quant Engine, NOT to AI
      // Task 41.2: Include trendline analysis for comprehensive insights
      this.logger.debug(
        `Sending market data to Quant Engine for analysis (with trendline analysis)`
      );
      const quantAnalysis: QuantAnalysisResult = await this.quantService.analyzeMarketData(
        symbol,
        timeframe,
        marketData.data,
        true // Enable comprehensive trendline analysis
      );

      this.logger.debug(`Received quant analysis for ${symbol} (includes trendline analysis)`);

      // Step 3.5: Get deterministic market scoring from Quant Engine (Task 32.2)
      // This provides additional context for AI reasoning
      let scoreResult = undefined;
      try {
        this.logger.debug(`Requesting market score from Quant Engine`);
        scoreResult = await this.quantService.scoreMarket(symbol, timeframe, marketData.data);
        this.logger.debug(`Received market score: ${scoreResult.score} (${scoreResult.trend})`);
      } catch (scoringError) {
        // Non-critical: Continue without score if scoring fails
        const errorMessage = scoringError instanceof Error ? scoringError.message : 'Unknown error';
        this.logger.warn(`Market scoring failed, continuing without score: ${errorMessage}`);
      }

      // Step 4: Send ONLY quantitative results to AI Service (NOT raw market data)
      // This architectural constraint prevents AI from fabricating data
      this.logger.debug(`Sending quant results to AI Service (NOT raw market data)`);
      const recommendation: Recommendation = await this.aiService.generateRecommendation(
        parsedPrompt,
        quantAnalysis
      );

      this.logger.log(
        `Generated recommendation for ${symbol}: ${recommendation.action} (confidence: ${recommendation.confidence})`
      );

      // Step 5: Attach score to recommendation if available (Task 32.2)
      if (scoreResult) {
        recommendation.score = scoreResult;
        this.logger.debug(`Attached market score to recommendation`);
      }

      // Step 6: Store recommendation in database for tracking
      await this.storeRecommendation(parsedPrompt, recommendation);

      // Step 7: Return complete response
      return {
        rawPrompt: dto.prompt,
        parsed: parsedPrompt,
        recommendation,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing prompt for ${symbol}: ${errorMessage}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to process prompt: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Map parsed timeframe to API timeframe string
   */
  private getTimeframeForAnalysis(
    timeframe?: ParsedPrompt['timeframe']
  ): '1m' | '5m' | '15m' | '1h' | '1d' {
    switch (timeframe) {
      case 'SCALPING':
        return '1m';
      case 'INTRADAY':
        return '5m';
      case 'SWING':
      case 'POSITIONAL':
        return '1d';
      default:
        return '1d'; // Default to daily
    }
  }

  /**
   * Calculate appropriate historical date range based on timeframe
   */
  private getFromDateForTimeframe(timeframe?: ParsedPrompt['timeframe']): Date {
    const now = new Date();
    switch (timeframe) {
      case 'SCALPING':
        // Last 1 day for scalping (intraday data)
        return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      case 'INTRADAY':
        // Last 5 days for intraday
        return new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      case 'SWING':
        // Last 90 days for swing trading
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'POSITIONAL':
        // Last 180 days for positional
        return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      default:
        // Default to 90 days
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Store recommendation in database as a Signal for performance tracking
   */
  private async storeRecommendation(
    parsedPrompt: ParsedPrompt,
    recommendation: Recommendation
  ): Promise<void> {
    try {
      // First, ensure the instrument exists or create it
      const instrument = await this.prisma.instrument.upsert({
        where: { symbol: recommendation.symbol },
        update: {},
        create: {
          symbol: recommendation.symbol,
          exchange: 'NSE', // Default to NSE
          name: recommendation.symbol,
          assetType: parsedPrompt.assetType || 'STOCK',
        },
      });

      // Convert recommendation to Signal model
      const direction: 'LONG' | 'SHORT' | 'FLAT' =
        recommendation.action === 'BUY'
          ? 'LONG'
          : recommendation.action === 'SELL'
            ? 'SHORT'
            : 'FLAT';

      const riskAmount = recommendation.entryPrice - recommendation.stopLoss;
      const rewardAmount = recommendation.target - recommendation.entryPrice;
      const riskRewardRatio = rewardAmount / Math.abs(riskAmount);

      await this.prisma.signal.create({
        data: {
          id: recommendation.id,
          instrumentId: instrument.id,
          signalType: 'ENTRY',
          direction,
          strength: recommendation.confidence,
          confidence: recommendation.confidence,
          entryPrice: recommendation.entryPrice,
          stopLoss: recommendation.stopLoss,
          target: recommendation.target,
          riskAmount: Math.abs(riskAmount),
          rewardAmount,
          riskRewardRatio,
          reasoning: recommendation.reasoning,
          keyFactors: [], // Can be populated from quant data if needed
          status: 'ACTIVE',
        },
      });
      this.logger.debug(`Stored recommendation ${recommendation.id} as Signal in database`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Log error but don't fail the request
      this.logger.warn(`Failed to store recommendation in database: ${errorMessage}`);
    }
  }
}
