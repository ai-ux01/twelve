import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';
import { AiService } from '../ai/ai.service';
import { RiskService } from '../risk/risk.service';
import { PrismaService } from '../database/prisma.service';
import { PaperTradingService, PaperTradeRequest } from '../trading/paper-trading.service';
import { AddStockDto, UpdateStockDto, FilterStockUniverseDto } from './dto/stock-universe.dto';
import {
  ScanSwingUniverseDto,
  ScanSwingUniverseResponseDto,
  SwingCandidate,
} from './dto/scan-universe.dto';
import {
  ExecuteSwingPaperTradeDto,
  ExecuteSwingPaperTradeResponseDto,
} from './dto/paper-trade.dto';
import { ScoringWeightsService } from './scoring-weights.service';

/**
 * SwingService - Business logic orchestration for swing trading
 *
 * Orchestrates the flow of data for swing trading analysis:
 * 1. Market data retrieval (via MarketDataService)
 * 2. Quantitative analysis (via QuantService)
 * 3. AI reasoning (via AiService - receives only verified quant data)
 * 4. Risk validation (via RiskService)
 *
 * Requirements covered: 5.1, 18.1
 * - 5.1: Swing trading analysis orchestration
 * - 18.1: Enforces data flow: Market Data → Quant → AI (NO direct AI access to raw data)
 */
@Injectable()
export class SwingService {
  private readonly logger = new Logger(SwingService.name);

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly quantService: QuantService,
    private readonly aiService: AiService,
    private readonly riskService: RiskService,
    private readonly prisma: PrismaService,
    private readonly scoringWeightsService: ScoringWeightsService,
    private readonly paperTradingService: PaperTradingService
  ) {
    this.logger.log('SwingService initialized with dependencies');
  }

  /**
   * Scan configured stock universe for swing trading opportunities
   *
   * Flow:
   * 1. Retrieve stock universe configuration (with optional sector filter)
   * 2. Fetch market data for all stocks (90+ days for swing analysis)
   * 3. Send to Quant Engine for technical analysis
   * 4. Calculate scores using SwingScoringService (via Quant Engine)
   * 5. Filter by minimum score threshold
   * 6. Sort by total score descending
   * 7. Return top N candidates
   *
   * Error Handling:
   * - Individual stock failures are logged and tracked
   * - Scanning continues even if some stocks fail
   * - Partial failure reporting included in response
   *
   * Requirements covered: 5.1, 5.4, 18.1, 20.1
   */
  async scanStockUniverse(
    scanRequest: ScanSwingUniverseDto
  ): Promise<ScanSwingUniverseResponseDto> {
    this.logger.debug('Starting stock universe scan');

    // Extract parameters with defaults
    const minScore = scanRequest.minScore ?? 60;
    const maxResults = scanRequest.maxResults ?? 20;
    const sectorFilter = scanRequest.sectorFilter;
    const userId = scanRequest.userId;

    // 1. Retrieve stock universe (active stocks only)
    const filter: FilterStockUniverseDto = {
      isActive: true,
    };
    if (sectorFilter) {
      filter.sector = sectorFilter;
    }

    const stocks = await this.getStockUniverse(filter);
    this.logger.log(`Scanning ${stocks.length} stocks from universe`);

    if (stocks.length === 0) {
      return {
        scannedCount: 0,
        candidatesFound: 0,
        candidates: [],
        failures: [],
      };
    }

    // 2. Get scoring weights for scoring consistency
    const weights = await this.scoringWeightsService.getWeights(userId);

    // 3. Scan each stock and collect candidates
    const candidates: SwingCandidate[] = [];
    const failures: Array<{ symbol: string; error: string }> = [];
    let scannedCount = 0;

    for (const stock of stocks) {
      try {
        scannedCount++;
        this.logger.debug(`Scanning ${stock.symbol} (${scannedCount}/${stocks.length})`);

        // Fetch 90+ days of historical data (daily timeframe for swing trading)
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 200); // 200 days for EMA-200 calculation

        const marketData = await this.marketDataService.getMarketData(
          stock.symbol,
          '1d', // Daily timeframe for swing trading
          fromDate,
          toDate
        );

        // Need at least 200 data points for full technical analysis
        if (marketData.data.length < 200) {
          const message = `Insufficient data: ${marketData.data.length} candles, need 200`;
          this.logger.warn(`${stock.symbol}: ${message}`);
          failures.push({
            symbol: stock.symbol,
            error: message,
          });
          continue;
        }

        // Get comprehensive technical analysis from Quant Engine
        const analysis = await this.quantService.analyzeMarketData(
          stock.symbol,
          '1d',
          marketData.data,
          true // Include trendline analysis
        );

        // Calculate swing score based on technical analysis
        const swingScore = this.calculateSwingScore(analysis, weights);

        // Filter by minimum score threshold
        if (swingScore.totalScore < minScore) {
          this.logger.debug(
            `${stock.symbol} score ${swingScore.totalScore.toFixed(1)} below threshold ${minScore}`
          );
          continue;
        }

        // Determine entry, stop loss, and target based on technical levels
        const tradeLevels = this.calculateTradeLevels(analysis);

        // Create candidate result
        const candidate: SwingCandidate = {
          symbol: stock.symbol,
          score: swingScore.totalScore,
          trend: this.determineTrend(analysis),
          setupType: this.determineSetupType(analysis),
          entry: tradeLevels.entry,
          stopLoss: tradeLevels.stopLoss,
          target: tradeLevels.target,
          riskReward: tradeLevels.riskReward,
          components: {
            trendScore: swingScore.trendScore,
            technicalScore: swingScore.technicalScore,
            volumeScore: swingScore.volumeScore,
            relativeStrengthScore: swingScore.relativeStrengthScore,
            breakoutScore: swingScore.breakoutScore,
            sectorScore: swingScore.sectorScore,
            riskRewardScore: swingScore.riskRewardScore,
          },
        };

        candidates.push(candidate);
        this.logger.debug(
          `${stock.symbol}: Score ${swingScore.totalScore.toFixed(1)}, ` +
            `Entry ${tradeLevels.entry.toFixed(2)}, R:R ${tradeLevels.riskReward.toFixed(2)}`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Error scanning ${stock.symbol}: ${errorMessage}`);

        // Track failure for reporting
        failures.push({
          symbol: stock.symbol,
          error: errorMessage,
        });

        // Continue with next stock even if one fails (Requirement 20.1)
        continue;
      }
    }

    // Sort candidates by total score descending
    candidates.sort((a, b) => b.score - a.score);

    // Limit results to maxResults
    const topCandidates = candidates.slice(0, maxResults);

    this.logger.log(
      `Scan complete: ${scannedCount} scanned, ` +
        `${candidates.length} candidates found, ` +
        `${failures.length} failures, ` +
        `returning top ${topCandidates.length}`
    );

    return {
      scannedCount,
      candidatesFound: candidates.length,
      candidates: topCandidates,
      failures: failures.length > 0 ? failures : undefined,
    };
  }

  /**
   * Calculate swing trading score from technical analysis.
   * This is a simplified scoring based on available analysis data.
   *
   * In a full implementation, this would call the Quant Engine's
   * SwingScoringService for comprehensive scoring.
   */
  private calculateSwingScore(
    analysis: any,
    weights: any
  ): {
    totalScore: number;
    trendScore: number;
    technicalScore: number;
    volumeScore: number;
    relativeStrengthScore: number;
    breakoutScore: number;
    sectorScore: number;
    riskRewardScore: number;
  } {
    const indicators = analysis.indicators;
    const currentPrice = analysis.indicators.vwap; // Use VWAP as proxy for current price

    // 1. Trend Score (0-100) - EMA alignment and ADX
    let trendScore = 0;
    if (
      currentPrice > indicators.ema_20 &&
      indicators.ema_20 > indicators.ema_50 &&
      indicators.ema_50 > indicators.ema_200
    ) {
      trendScore = 100;
    } else if (currentPrice > indicators.ema_20 && indicators.ema_20 > indicators.ema_50) {
      trendScore = 80;
    } else if (currentPrice > indicators.ema_20) {
      trendScore = 60;
    } else {
      trendScore = 30;
    }
    // Adjust by ADX strength
    if (indicators.adx > 30) {
      trendScore = Math.min(100, trendScore * 1.1);
    } else if (indicators.adx < 20) {
      trendScore = trendScore * 0.8;
    }

    // 2. Technical Score (0-100) - RSI, MACD, ATR
    let technicalScore = 50;
    if (indicators.rsi >= 40 && indicators.rsi <= 70) {
      technicalScore += 25;
    }
    if (indicators.macd.histogram > 0) {
      technicalScore += 25;
    }
    technicalScore = Math.max(0, Math.min(100, technicalScore));

    // 3. Volume Score (0-100) - Relative volume
    let volumeScore = 50;
    if (indicators.relative_volume >= 1.5) {
      volumeScore = 100;
    } else if (indicators.relative_volume >= 1.0) {
      volumeScore = 70 + (indicators.relative_volume - 1.0) * 60;
    } else {
      volumeScore = 40 + indicators.relative_volume * 30;
    }

    // 4. Relative Strength Score (0-100) - Position in 52-week range
    const distFromHigh = ((currentPrice - indicators.week_52_high) / indicators.week_52_high) * 100;
    const distFromLow = ((currentPrice - indicators.week_52_low) / indicators.week_52_low) * 100;
    const relativeStrengthScore = Math.min(100, Math.max(0, 50 + distFromHigh + distFromLow));

    // 5. Breakout Score (0-100) - Based on trendline analysis
    let breakoutScore = 0;
    if (analysis.trendline && analysis.trendline.breakout_status === 'CONFIRMED') {
      breakoutScore = 100;
    } else if (analysis.trendline && analysis.trendline.breakout_status === 'BREAKOUT') {
      breakoutScore = 70;
    }

    // 6. Sector Score (0-100) - Default to 50 (would be calculated from sector analysis)
    const sectorScore = 50;

    // 7. Risk/Reward Score (0-100) - Will be calculated after entry/exit determination
    const riskRewardScore = 70; // Default moderate score

    // Calculate total weighted score
    const totalScore =
      trendScore * weights.trendWeight +
      technicalScore * weights.technicalWeight +
      volumeScore * weights.volumeWeight +
      relativeStrengthScore * weights.relativeStrengthWeight +
      breakoutScore * weights.breakoutWeight +
      sectorScore * weights.sectorWeight +
      riskRewardScore * weights.riskRewardWeight;

    return {
      totalScore,
      trendScore,
      technicalScore,
      volumeScore,
      relativeStrengthScore,
      breakoutScore,
      sectorScore,
      riskRewardScore,
    };
  }

  /**
   * Calculate entry, stop loss, and target levels from technical analysis
   */
  private calculateTradeLevels(analysis: any): {
    entry: number;
    stopLoss: number;
    target: number;
    riskReward: number;
  } {
    const currentPrice = analysis.indicators.vwap;
    const atr = analysis.indicators.atr;

    // Entry: Current price (or slightly below for better entry)
    const entry = currentPrice;

    // Stop Loss: 2 x ATR below entry, or nearest support level
    let stopLoss = entry - 2 * atr;

    // Check if there's a support level nearby
    if (analysis.supportResistance && analysis.supportResistance.length > 0) {
      const nearestSupport = analysis.supportResistance
        .filter((level: any) => level.level < entry)
        .sort((a: any, b: any) => b.level - a.level)[0];

      if (nearestSupport && nearestSupport.level > stopLoss) {
        stopLoss = nearestSupport.level * 0.98; // Slightly below support
      }
    }

    // Target: 3 x ATR above entry (2:1 R:R minimum), or nearest resistance
    let target = entry + 3 * atr;

    // Check if there's a resistance level that offers better R:R
    if (analysis.supportResistance && analysis.supportResistance.length > 0) {
      const nearestResistance = analysis.supportResistance
        .filter((level: any) => level.level > entry)
        .sort((a: any, b: any) => a.level - b.level)[0];

      if (nearestResistance) {
        const resistanceTarget = nearestResistance.level * 0.99;
        const resistanceRR = (resistanceTarget - entry) / (entry - stopLoss);
        if (resistanceRR >= 1.5) {
          target = resistanceTarget;
        }
      }
    }

    // Calculate risk/reward ratio
    const risk = entry - stopLoss;
    const reward = target - entry;
    const riskReward = risk > 0 ? reward / risk : 0;

    return {
      entry: Math.round(entry * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      target: Math.round(target * 100) / 100,
      riskReward: Math.round(riskReward * 100) / 100,
    };
  }

  /**
   * Determine trend classification from technical analysis
   */
  private determineTrend(analysis: any): string {
    const indicators = analysis.indicators;
    const currentPrice = indicators.vwap;

    if (currentPrice > indicators.ema_20 && indicators.ema_20 > indicators.ema_50) {
      if (indicators.adx > 25) {
        return 'STRONG_UPTREND';
      }
      return 'UPTREND';
    } else if (currentPrice < indicators.ema_20 && indicators.ema_20 < indicators.ema_50) {
      return 'DOWNTREND';
    }
    return 'SIDEWAYS';
  }

  /**
   * Determine setup type from technical analysis
   */
  private determineSetupType(analysis: any): string {
    // Check for breakout pattern
    if (analysis.trendline && analysis.trendline.breakout_status === 'CONFIRMED') {
      // Check if there's a retest
      if (analysis.trendline.resistance_status === 'RETESTING') {
        return 'BREAKOUT_RETEST';
      }
      return 'BREAKOUT';
    }

    // Check for EMA bounce
    const currentPrice = analysis.indicators.vwap;
    const ema20 = analysis.indicators.ema_20;
    const ema50 = analysis.indicators.ema_50;

    const distanceFrom20 = Math.abs((currentPrice - ema20) / ema20) * 100;
    const distanceFrom50 = Math.abs((currentPrice - ema50) / ema50) * 100;

    if (distanceFrom20 < 2 && currentPrice > ema20) {
      return 'EMA20_BOUNCE';
    } else if (distanceFrom50 < 3 && currentPrice > ema50) {
      return 'EMA50_BOUNCE';
    }

    // Check RSI oversold bounce
    if (analysis.indicators.rsi < 40 && analysis.indicators.rsi > 30) {
      return 'RSI_BOUNCE';
    }

    return 'TREND_CONTINUATION';
  }

  /**
   * Perform deep analysis on a specific symbol for swing trading
   *
   * Flow:
   * 1. Fetch historical data (200+ days for EMA-200)
   * 2. Send to Quant Engine for comprehensive technical analysis
   * 3. Calculate swing trading score
   * 4. Optionally send quant results to AI for reasoning (AI receives ONLY verified data)
   * 5. Validate recommendation through Risk Engine (if AI generated recommendation)
   * 6. Return complete analysis result
   *
   * Requirements covered: 4.1, 8.1, 5.1, 18.1
   *
   * @param symbol - Stock symbol to analyze
   * @param analysisRequest - Optional request parameters (userId, includeAI)
   */
  async analyzeSymbol(
    symbol: string,
    analysisRequest?: { userId?: string; includeAI?: boolean }
  ): Promise<any> {
    this.logger.log(`Starting deep analysis for ${symbol}`);

    try {
      // Step 1: Fetch market data (200+ days for complete technical analysis)
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 200); // 200 days for EMA-200

      this.logger.debug(
        `Fetching market data for ${symbol} from ${fromDate.toISOString()} to ${toDate.toISOString()}`
      );

      const marketData = await this.marketDataService.getMarketData(
        symbol,
        '1d', // Daily timeframe for swing trading
        fromDate,
        toDate
      );

      // Validate sufficient data
      if (marketData.data.length < 200) {
        throw new Error(
          `Insufficient data for ${symbol}: ${marketData.data.length} candles, need 200 for complete analysis`
        );
      }

      this.logger.debug(`Retrieved ${marketData.data.length} candles for ${symbol}`);

      // Step 2: Call Quant Engine for comprehensive technical analysis
      this.logger.debug(`Sending ${symbol} to Quant Engine for technical analysis`);

      const technicalAnalysis = await this.quantService.analyzeMarketData(
        symbol,
        '1d',
        marketData.data,
        true // Include comprehensive trendline analysis
      );

      this.logger.debug(`Received technical analysis for ${symbol}`);

      // Step 3: Calculate swing trading score
      const userId = analysisRequest?.userId;
      const weights = await this.scoringWeightsService.getWeights(userId);

      this.logger.debug(`Calculating swing score for ${symbol} with weights:`, weights);

      const swingScore = this.calculateSwingScore(technicalAnalysis, weights);

      this.logger.debug(
        `Calculated swing score for ${symbol}: ${swingScore.totalScore.toFixed(1)}`
      );

      // Step 4: Determine trade levels based on technical analysis
      const tradeLevels = this.calculateTradeLevels(technicalAnalysis);

      // Step 5: Optionally call AI Service for recommendation
      let aiRecommendation = null;
      const includeAI = analysisRequest?.includeAI !== false; // Default to true

      if (includeAI) {
        try {
          this.logger.debug(`Calling AI Service for ${symbol} recommendation`);

          // Create a parsed prompt for swing trading
          const parsedPrompt = {
            intent: 'FIND_TRADE',
            symbols: [symbol],
            timeframe: 'SWING',
            assetType: 'STOCK',
          };

          // AI receives ONLY verified quantitative analysis, NEVER raw market data
          const recommendation = await this.aiService.generateRecommendation(
            parsedPrompt as any,
            technicalAnalysis
          );

          this.logger.debug(`Received AI recommendation for ${symbol}: ${recommendation.action}`);

          aiRecommendation = {
            stock: symbol,
            signal: recommendation.action,
            setup: this.determineSetupType(technicalAnalysis),
            entry: recommendation.entryPrice,
            stopLoss: recommendation.stopLoss,
            target: recommendation.target,
            riskReward: this.calculateRiskReward(
              recommendation.entryPrice,
              recommendation.stopLoss,
              recommendation.target
            ),
            probability: recommendation.confidence,
            trend: this.determineTrend(technicalAnalysis),
            volume: this.formatVolumeAnalysis(technicalAnalysis.indicators),
            trendline: this.formatTrendlineAnalysis(technicalAnalysis.trendline),
            support: this.formatSupportLevels(technicalAnalysis.supportResistance),
            resistance: this.formatResistanceLevels(technicalAnalysis.supportResistance),
            marketRegime: 'BULL_MARKET', // TODO: This should come from MarketRegimeService
            rationale: recommendation.reasoning,
            invalidation: this.generateInvalidationCriteria(recommendation, technicalAnalysis),
          };

          // Step 6: Validate with Risk Engine if AI generated BUY or SELL recommendation
          if (userId && (recommendation.action === 'BUY' || recommendation.action === 'SELL')) {
            this.logger.debug(
              `Validating ${recommendation.action} recommendation with Risk Engine`
            );

            const tradeRequest = {
              symbol: symbol,
              action: recommendation.action as 'BUY' | 'SELL',
              quantity: 1, // Default quantity for validation
              price: recommendation.entryPrice,
              stopLoss: recommendation.stopLoss,
              target: recommendation.target,
            };

            const riskValidation = await this.riskService.validateTrade(userId, tradeRequest);

            this.logger.debug(
              `Risk validation for ${symbol}: ${riskValidation.passed ? 'PASSED' : 'FAILED'}`
            );

            // Attach risk validation to recommendation (with explicit any type to allow dynamic property)
            (aiRecommendation as any).riskValidation = riskValidation;

            // If risk validation failed, override signal to HOLD
            if (!riskValidation.passed) {
              const errorViolations = riskValidation.violations.filter(
                (v) => v.severity === 'ERROR'
              );
              if (errorViolations.length > 0) {
                aiRecommendation.signal = 'HOLD';
                aiRecommendation.rationale += `\n\nRISK WARNING: Trade blocked by Risk Engine - ${errorViolations[0].message}`;
              }
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`AI Service failed for ${symbol}: ${errorMessage}`);
          // Continue without AI recommendation - return quantitative analysis only
        }
      }

      // Step 7: Return complete analysis result
      const result = {
        symbol: symbol,
        analysis: {
          technical: technicalAnalysis,
          score: swingScore,
          tradeLevels: tradeLevels,
          trend: this.determineTrend(technicalAnalysis),
          setupType: this.determineSetupType(technicalAnalysis),
        },
        recommendation: aiRecommendation,
      };

      this.logger.log(
        `Deep analysis complete for ${symbol}: ` +
          `Score ${swingScore.totalScore.toFixed(1)}, ` +
          `${aiRecommendation ? `AI Signal: ${aiRecommendation.signal}` : 'No AI recommendation'}`
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error analyzing ${symbol}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Calculate risk/reward ratio
   */
  private calculateRiskReward(entry: number, stopLoss: number, target: number): number {
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(target - entry);
    return risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;
  }

  /**
   * Format volume analysis for AI recommendation
   */
  private formatVolumeAnalysis(indicators: any): string {
    const relVol = indicators.relative_volume || 1.0;
    if (relVol >= 1.5) {
      return 'Above average with strong participation';
    } else if (relVol >= 1.0) {
      return 'Average volume';
    } else {
      return 'Below average - weak participation';
    }
  }

  /**
   * Format trendline analysis for AI recommendation
   */
  private formatTrendlineAnalysis(trendline: any): string {
    if (!trendline) {
      return 'No clear trendlines detected';
    }

    const parts: string[] = [];

    if (trendline.direction) {
      parts.push(`${trendline.direction} trend`);
    }

    if (trendline.breakout_status && trendline.breakout_status !== 'NONE') {
      parts.push(`${trendline.breakout_status.toLowerCase()} detected`);
    }

    if (trendline.support_line && trendline.support_status === 'ACTIVE') {
      parts.push('support line intact');
    }

    if (trendline.resistance_line && trendline.resistance_status === 'ACTIVE') {
      parts.push('resistance line intact');
    }

    return parts.length > 0 ? parts.join(', ') : 'Trendline analysis available';
  }

  /**
   * Format support levels for AI recommendation
   */
  private formatSupportLevels(supportResistance: any[]): string {
    if (!supportResistance || supportResistance.length === 0) {
      return 'No clear support levels';
    }

    const currentPrice = supportResistance[0]?.level || 0;
    const supports = supportResistance
      .filter((level) => level.level < currentPrice)
      .sort((a, b) => b.level - a.level)
      .slice(0, 2);

    if (supports.length === 0) {
      return 'No support levels below current price';
    }

    return supports.map((s) => s.level.toFixed(2)).join(', ');
  }

  /**
   * Format resistance levels for AI recommendation
   */
  private formatResistanceLevels(supportResistance: any[]): string {
    if (!supportResistance || supportResistance.length === 0) {
      return 'No clear resistance levels';
    }

    const currentPrice = supportResistance[0]?.level || 0;
    const resistances = supportResistance
      .filter((level) => level.level > currentPrice)
      .sort((a, b) => a.level - b.level)
      .slice(0, 2);

    if (resistances.length === 0) {
      return 'No resistance levels above current price';
    }

    return resistances.map((r) => r.level.toFixed(2)).join(', ');
  }

  /**
   * Generate invalidation criteria based on recommendation and technical analysis
   */
  private generateInvalidationCriteria(recommendation: any, technicalAnalysis: any): string {
    const criteria: string[] = [];

    if (recommendation.action === 'BUY') {
      // For buy signals, invalidation is below stop loss
      criteria.push(`Break below ${recommendation.stopLoss.toFixed(2)} on high volume`);

      // Add trendline invalidation if available
      if (technicalAnalysis.trendline?.support_line) {
        criteria.push('Break of rising support trendline');
      }
    } else if (recommendation.action === 'SELL') {
      // For sell signals, invalidation is above stop loss
      criteria.push(`Break above ${recommendation.stopLoss.toFixed(2)} on high volume`);

      // Add trendline invalidation if available
      if (technicalAnalysis.trendline?.resistance_line) {
        criteria.push('Break of falling resistance trendline');
      }
    } else {
      // For HOLD signals
      criteria.push('Wait for clearer technical setup');
    }

    return criteria.join(' OR ');
  }

  /**
   * Retrieve swing trade recommendations
   *
   * Requirements covered: 5.1
   */
  async getRecommendations(): Promise<any[]> {
    this.logger.debug('Fetching swing trade recommendations');
    // TODO: Implement recommendations retrieval from database
    // Will be implemented in subsequent tasks
    return [];
  }

  /**
   * Execute paper trade for a swing trading opportunity
   *
   * This method integrates swing trading analysis with paper trading execution.
   * It delegates to the existing PaperTradingService to simulate trade execution
   * without risking real capital.
   *
   * Requirements covered: 5.7 (21.7) - Paper trading for swing opportunities
   *
   * @param tradeRequest - Swing paper trade request details
   * @returns Paper trade execution result
   */
  async executePaperTrade(
    tradeRequest: ExecuteSwingPaperTradeDto
  ): Promise<ExecuteSwingPaperTradeResponseDto> {
    this.logger.log(`Executing paper trade for swing opportunity: ${tradeRequest.symbol}`);

    try {
      // Convert swing trade request to PaperTradingService format
      const paperTradeRequest: PaperTradeRequest = {
        symbol: tradeRequest.symbol,
        action: 'BUY', // Swing trades are typically long positions
        quantity: tradeRequest.quantity,
        price: tradeRequest.entryPrice,
        stopLoss: tradeRequest.stopLoss,
        target: tradeRequest.target,
      };

      // Execute paper trade via PaperTradingService
      const result = await this.paperTradingService.executePaperTrade(
        tradeRequest.userId,
        paperTradeRequest,
        tradeRequest.signalId
      );

      // Check if execution was successful
      if (result.status === 'FAILED') {
        return {
          success: false,
          tradeId: '',
          message: `Failed to execute paper trade: ${result.error || 'Unknown error'}`,
          trade: {
            symbol: tradeRequest.symbol,
            quantity: tradeRequest.quantity,
            entryPrice: tradeRequest.entryPrice,
            stopLoss: tradeRequest.stopLoss,
            target: tradeRequest.target,
            status: 'FAILED',
            simulatedSlippage: 0,
          },
        };
      }

      // Return successful result
      return {
        success: true,
        tradeId: result.tradeId,
        message: `Paper trade executed successfully for ${tradeRequest.symbol}`,
        trade: {
          symbol: tradeRequest.symbol,
          quantity: tradeRequest.quantity,
          entryPrice: result.executedPrice || tradeRequest.entryPrice,
          stopLoss: tradeRequest.stopLoss,
          target: tradeRequest.target,
          status: 'OPEN',
          simulatedSlippage: result.slippage || 0,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error executing paper trade: ${errorMessage}`);

      return {
        success: false,
        tradeId: '',
        message: `Error executing paper trade: ${errorMessage}`,
        trade: {
          symbol: tradeRequest.symbol,
          quantity: tradeRequest.quantity,
          entryPrice: tradeRequest.entryPrice,
          stopLoss: tradeRequest.stopLoss,
          target: tradeRequest.target,
          status: 'FAILED',
          simulatedSlippage: 0,
        },
      };
    }
  }

  // ============================================================================
  // STOCK UNIVERSE MANAGEMENT
  // ============================================================================

  /**
   * Add a stock to the universe
   *
   * Requirements covered: 5.1
   */
  async addStock(addStockDto: AddStockDto) {
    this.logger.debug(`Adding stock ${addStockDto.symbol} to universe`);

    // Check if stock already exists
    const existing = await this.prisma.stockUniverse.findUnique({
      where: { symbol: addStockDto.symbol },
    });

    if (existing) {
      throw new ConflictException(`Stock ${addStockDto.symbol} already exists in universe`);
    }

    const stock = await this.prisma.stockUniverse.create({
      data: {
        symbol: addStockDto.symbol,
        sector: addStockDto.sector,
        marketCap: addStockDto.marketCap,
        isActive: addStockDto.isActive ?? true,
      },
    });

    this.logger.log(`Stock ${stock.symbol} added to universe`);
    return stock;
  }

  /**
   * Update a stock in the universe
   *
   * Requirements covered: 5.1
   */
  async updateStock(symbol: string, updateStockDto: UpdateStockDto) {
    this.logger.debug(`Updating stock ${symbol} in universe`);

    // Check if stock exists
    const existing = await this.prisma.stockUniverse.findUnique({
      where: { symbol },
    });

    if (!existing) {
      throw new NotFoundException(`Stock ${symbol} not found in universe`);
    }

    const stock = await this.prisma.stockUniverse.update({
      where: { symbol },
      data: updateStockDto,
    });

    this.logger.log(`Stock ${stock.symbol} updated in universe`);
    return stock;
  }

  /**
   * Remove a stock from the universe
   *
   * Requirements covered: 5.1
   */
  async removeStock(symbol: string) {
    this.logger.debug(`Removing stock ${symbol} from universe`);

    // Check if stock exists
    const existing = await this.prisma.stockUniverse.findUnique({
      where: { symbol },
    });

    if (!existing) {
      throw new NotFoundException(`Stock ${symbol} not found in universe`);
    }

    await this.prisma.stockUniverse.delete({
      where: { symbol },
    });

    this.logger.log(`Stock ${symbol} removed from universe`);
    return { message: `Stock ${symbol} removed from universe` };
  }

  /**
   * Get all stocks in the universe (with optional filtering)
   *
   * Requirements covered: 5.1
   */
  async getStockUniverse(filter?: FilterStockUniverseDto) {
    this.logger.debug('Fetching stock universe');

    const where: any = {};

    if (filter?.sector) {
      where.sector = filter.sector;
    }

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    const stocks = await this.prisma.stockUniverse.findMany({
      where,
      orderBy: [{ sector: 'asc' }, { symbol: 'asc' }],
    });

    this.logger.debug(`Retrieved ${stocks.length} stocks from universe`);
    return stocks;
  }

  /**
   * Get a single stock from the universe
   *
   * Requirements covered: 5.1
   */
  async getStock(symbol: string) {
    this.logger.debug(`Fetching stock ${symbol} from universe`);

    const stock = await this.prisma.stockUniverse.findUnique({
      where: { symbol },
    });

    if (!stock) {
      throw new NotFoundException(`Stock ${symbol} not found in universe`);
    }

    return stock;
  }

  /**
   * Initialize default NSE F&O stocks universe
   *
   * Requirements covered: 5.1
   */
  async initializeDefaultUniverse() {
    this.logger.log('Initializing default NSE F&O stocks universe');

    // Default NSE F&O stocks with sector and approximate market cap (in crores)
    const defaultStocks = [
      // Banking & Finance
      { symbol: 'HDFCBANK', sector: 'Banking', marketCap: 1200000 },
      { symbol: 'ICICIBANK', sector: 'Banking', marketCap: 700000 },
      { symbol: 'SBIN', sector: 'Banking', marketCap: 600000 },
      { symbol: 'AXISBANK', sector: 'Banking', marketCap: 300000 },
      { symbol: 'KOTAKBANK', sector: 'Banking', marketCap: 350000 },
      { symbol: 'INDUSINDBK', sector: 'Banking', marketCap: 120000 },
      { symbol: 'BAJFINANCE', sector: 'Finance', marketCap: 400000 },
      { symbol: 'BAJAJFINSV', sector: 'Finance', marketCap: 250000 },

      // IT
      { symbol: 'TCS', sector: 'IT', marketCap: 1300000 },
      { symbol: 'INFY', sector: 'IT', marketCap: 700000 },
      { symbol: 'WIPRO', sector: 'IT', marketCap: 250000 },
      { symbol: 'HCLTECH', sector: 'IT', marketCap: 350000 },
      { symbol: 'TECHM', sector: 'IT', marketCap: 120000 },

      // Oil & Gas
      { symbol: 'RELIANCE', sector: 'Oil & Gas', marketCap: 1700000 },
      { symbol: 'ONGC', sector: 'Oil & Gas', marketCap: 200000 },
      { symbol: 'BPCL', sector: 'Oil & Gas', marketCap: 100000 },

      // Automobiles
      { symbol: 'MARUTI', sector: 'Automobile', marketCap: 350000 },
      { symbol: 'TATAMOTORS', sector: 'Automobile', marketCap: 300000 },
      { symbol: 'M&M', sector: 'Automobile', marketCap: 250000 },
      { symbol: 'BAJAJ-AUTO', sector: 'Automobile', marketCap: 200000 },

      // Metals
      { symbol: 'TATASTEEL', sector: 'Metals', marketCap: 150000 },
      { symbol: 'HINDALCO', sector: 'Metals', marketCap: 100000 },
      { symbol: 'JSWSTEEL', sector: 'Metals', marketCap: 200000 },

      // Pharma
      { symbol: 'SUNPHARMA', sector: 'Pharma', marketCap: 350000 },
      { symbol: 'DRREDDY', sector: 'Pharma', marketCap: 100000 },
      { symbol: 'CIPLA', sector: 'Pharma', marketCap: 110000 },
      { symbol: 'DIVISLAB', sector: 'Pharma', marketCap: 120000 },

      // Telecom
      { symbol: 'BHARTIARTL', sector: 'Telecom', marketCap: 700000 },

      // FMCG
      { symbol: 'HINDUNILVR', sector: 'FMCG', marketCap: 600000 },
      { symbol: 'ITC', sector: 'FMCG', marketCap: 550000 },
      { symbol: 'NESTLEIND', sector: 'FMCG', marketCap: 230000 },

      // Infrastructure & Cement
      { symbol: 'LT', sector: 'Infrastructure', marketCap: 500000 },
      { symbol: 'ULTRACEMCO', sector: 'Cement', marketCap: 250000 },
      { symbol: 'GRASIM', sector: 'Cement', marketCap: 120000 },

      // Power
      { symbol: 'POWERGRID', sector: 'Power', marketCap: 200000 },
      { symbol: 'NTPC', sector: 'Power', marketCap: 180000 },

      // Others
      { symbol: 'ASIANPAINT', sector: 'Paints', marketCap: 300000 },
      { symbol: 'ADANIPORTS', sector: 'Infrastructure', marketCap: 250000 },
      { symbol: 'TITAN', sector: 'Consumer Goods', marketCap: 280000 },
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const stock of defaultStocks) {
      try {
        const existing = await this.prisma.stockUniverse.findUnique({
          where: { symbol: stock.symbol },
        });

        if (!existing) {
          await this.prisma.stockUniverse.create({
            data: {
              symbol: stock.symbol,
              sector: stock.sector,
              marketCap: stock.marketCap,
              isActive: true,
            },
          });
          addedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Error adding stock ${stock.symbol}: ${errorMessage}`);
      }
    }

    this.logger.log(`Default universe initialized: ${addedCount} added, ${skippedCount} skipped`);
    return {
      message: 'Default universe initialized',
      added: addedCount,
      skipped: skippedCount,
      total: defaultStocks.length,
    };
  }
}
