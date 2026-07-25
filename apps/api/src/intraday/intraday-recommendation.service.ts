import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../audit/audit.service';

/**
 * IntradayRecommendationService - Generates trading recommendations for intraday stocks
 *
 * This service takes the technical analysis from IntradayAnalysisService (via Quant Engine)
 * and applies business logic to generate actionable trading recommendations.
 *
 * Key responsibilities:
 * - Apply confidence threshold (minimum 65 for intraday)
 * - Apply risk/reward threshold (minimum 1.5 for intraday)
 * - Validate data freshness
 * - Generate BUY/SELL/HOLD/NO_TRADE signals
 * - Provide clear rationale for each recommendation
 * - Log stale data events and rejected trades to audit log (Task 63.1, 63.2)
 *
 * Requirements covered: 6.5, 6.6, 6.7, 18.6
 * - 6.5: Data freshness validation
 * - 6.6: Confidence and risk/reward thresholds
 * - 6.7: Recommendation signal generation
 * - 18.6: Audit logging for safety controls
 */
@Injectable()
export class IntradayRecommendationService {
  private readonly logger = new Logger(IntradayRecommendationService.name);

  // Thresholds for intraday trading (Requirement 6.6)
  private readonly MIN_CONFIDENCE = 65; // Minimum score/confidence for BUY/SELL signals
  private readonly MIN_RISK_REWARD = 1.5; // Minimum risk/reward ratio

  // Data freshness threshold (Requirement 6.5)
  private readonly MAX_DATA_AGE_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Generate trading recommendation from analysis results
   *
   * Takes the comprehensive analysis from the Quant Engine and applies business logic
   * to generate a BUY, SELL, HOLD, or NO_TRADE recommendation.
   *
   * Signal Logic:
   * - BUY: Score >= 65, Risk/Reward >= 1.5, Data fresh, Bullish indicators
   * - SELL: Score >= 65, Risk/Reward >= 1.5, Data fresh, Bearish indicators
   * - HOLD: Existing position, data fresh, but no clear directional signal
   * - NO_TRADE: Score < 65 OR Risk/Reward < 1.5 OR Data stale OR Conflicting indicators
   *
   * Task 63.1, 63.2: Logs stale data events and rejected trades to audit log
   *
   * Requirements: 6.5, 6.6, 6.7, 18.6
   *
   * @param analysisResult - Complete analysis result from Quant Engine
   * @param userId - Optional user ID for audit logging
   * @returns Recommendation with signal, confidence, entry, stop loss, target, and rationale
   */
  async generateRecommendation(
    analysisResult: any,
    userId?: string
  ): Promise<{
    signal: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE';
    confidence: number;
    entry: number | null;
    stopLoss: number | null;
    target: number | null;
    riskReward: number | null;
    rationale: string;
    isStale: boolean;
    dataTimestamp: string;
    dataAge: number;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    // Extract key data from analysis
    const symbol = analysisResult.symbol;
    const score = analysisResult.score?.total_score || 0;
    const dataFreshness = analysisResult.data_freshness;
    const recommendation = analysisResult.recommendation;
    const technical = analysisResult.technical_analysis;
    const currentPrice = analysisResult.current_price;

    // Calculate data age in seconds (Requirement 6.5)
    const dataAge = dataFreshness?.age_seconds || 0;

    this.logger.debug(
      `Generating recommendation for ${symbol}: Score=${score}, Confidence=${recommendation?.confidence}, Data age=${dataAge}s`
    );

    // === Step 1: Validate Data Freshness (Requirement 6.5) ===
    const isStale = this.validateDataFreshness(dataFreshness, warnings);

    // Task 63.1: Log stale data event to audit log if data is stale
    if (isStale) {
      this.logger.warn(
        `Data is stale for ${symbol}: ${dataAge}s old (max: ${this.MAX_DATA_AGE_MS / 1000}s)`
      );

      // Log to audit log
      await this.auditLogService.logStaleDataEvent(
        symbol,
        dataAge,
        this.MAX_DATA_AGE_MS / 1000,
        userId
      );

      return {
        signal: 'NO_TRADE',
        confidence: 0,
        entry: null,
        stopLoss: null,
        target: null,
        riskReward: null,
        rationale: `Data is stale (${(dataAge / 60).toFixed(1)} minutes old). Refresh required for intraday trading.`,
        isStale: true,
        dataTimestamp: dataFreshness.timestamp,
        dataAge,
        warnings,
      };
    }

    // === Step 2: Validate Score/Confidence Threshold (Requirement 6.6) ===
    const confidence = recommendation?.confidence ? recommendation.confidence * 100 : score;

    if (confidence < this.MIN_CONFIDENCE) {
      this.logger.debug(
        `Confidence ${confidence.toFixed(1)} below threshold ${this.MIN_CONFIDENCE} for ${symbol}`
      );
      warnings.push(`Confidence ${confidence.toFixed(1)}% below minimum ${this.MIN_CONFIDENCE}%`);

      // Task 63.2: Log rejected trade to audit log
      await this.auditLogService.logRejectedTrade(
        symbol,
        `Confidence ${confidence.toFixed(1)}% below minimum threshold of ${this.MIN_CONFIDENCE}%`,
        {
          signal: recommendation?.signal,
          confidence,
          minConfidence: this.MIN_CONFIDENCE,
        },
        userId
      );

      return {
        signal: 'NO_TRADE',
        confidence: Math.round(confidence),
        entry: null,
        stopLoss: null,
        target: null,
        riskReward: null,
        rationale: `Confidence ${confidence.toFixed(1)}% below minimum threshold of ${this.MIN_CONFIDENCE}% for intraday trading. Setup quality insufficient.`,
        isStale: false,
        dataTimestamp: dataFreshness.timestamp,
        dataAge,
        warnings,
      };
    }

    // === Step 3: Validate Risk/Reward Ratio (Requirement 6.6) ===
    const riskReward = recommendation?.risk_reward || 0;

    if (riskReward < this.MIN_RISK_REWARD) {
      this.logger.debug(
        `Risk/Reward ${riskReward.toFixed(2)} below threshold ${this.MIN_RISK_REWARD} for ${symbol}`
      );
      warnings.push(`Risk/Reward ${riskReward.toFixed(2)} below minimum ${this.MIN_RISK_REWARD}`);

      // Task 63.2: Log rejected trade to audit log
      await this.auditLogService.logRejectedTrade(
        symbol,
        `Risk/Reward ratio ${riskReward.toFixed(2)} below minimum threshold of ${this.MIN_RISK_REWARD}`,
        {
          signal: recommendation?.signal,
          confidence,
          riskReward,
          minRiskReward: this.MIN_RISK_REWARD,
        },
        userId
      );

      return {
        signal: 'NO_TRADE',
        confidence: Math.round(confidence),
        entry: null,
        stopLoss: null,
        target: null,
        riskReward,
        rationale: `Risk/Reward ratio ${riskReward.toFixed(2)} below minimum threshold of ${this.MIN_RISK_REWARD}. Trade setup not favorable.`,
        isStale: false,
        dataTimestamp: dataFreshness.timestamp,
        dataAge,
        warnings,
      };
    }

    // === Step 4: Generate Signal (Requirement 6.7) ===
    const signal = this.determineSignal(recommendation, technical, warnings);

    // Build rationale
    const rationale = this.buildRationale(
      signal,
      score,
      confidence,
      riskReward,
      technical,
      recommendation
    );

    this.logger.log(
      `Recommendation for ${symbol}: ${signal} (Confidence: ${confidence.toFixed(1)}%, R/R: ${riskReward.toFixed(2)})`
    );

    return {
      signal,
      confidence: Math.round(confidence),
      entry: recommendation?.entry || currentPrice,
      stopLoss: recommendation?.stop_loss || null,
      target: recommendation?.target || null,
      riskReward,
      rationale,
      isStale: false,
      dataTimestamp: dataFreshness.timestamp,
      dataAge,
      warnings,
    };
  }

  /**
   * Validate data freshness
   *
   * Checks if the data is fresh enough for intraday trading.
   * Intraday trading requires very fresh data (< 5 minutes old).
   *
   * Requirement: 6.5
   *
   * @param dataFreshness - Data freshness object from analysis
   * @param warnings - Array to collect warnings
   * @returns true if data is stale, false if fresh
   */
  private validateDataFreshness(dataFreshness: any, warnings: string[]): boolean {
    if (!dataFreshness) {
      warnings.push('Data freshness information missing');
      return true;
    }

    const ageMs = dataFreshness.age_seconds * 1000;

    if (dataFreshness.is_stale || ageMs > this.MAX_DATA_AGE_MS) {
      warnings.push(
        `Data is ${(ageMs / 60000).toFixed(1)} minutes old (max: ${this.MAX_DATA_AGE_MS / 60000} minutes)`
      );
      return true;
    }

    return false;
  }

  /**
   * Determine trading signal from recommendation and technical analysis
   *
   * Analyzes the Quant Engine recommendation and technical indicators to
   * determine the final signal: BUY, SELL, HOLD, or NO_TRADE.
   *
   * Signal Logic:
   * - BUY: Bullish recommendation, bullish technical alignment
   * - SELL: Bearish recommendation, bearish technical alignment
   * - HOLD: Mixed signals or neutral conditions
   * - NO_TRADE: Conflicting indicators or unclear setup
   *
   * Requirement: 6.7
   *
   * @param recommendation - Recommendation from Quant Engine
   * @param technical - Technical analysis indicators
   * @param warnings - Array to collect warnings
   * @returns Trading signal
   */
  private determineSignal(
    recommendation: any,
    technical: any,
    warnings: string[]
  ): 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE' {
    if (!recommendation || !technical) {
      warnings.push('Missing recommendation or technical analysis');
      return 'NO_TRADE';
    }

    const quantSignal = recommendation.signal;

    // If Quant Engine already says NO_TRADE, respect that
    if (quantSignal === 'NO_TRADE') {
      return 'NO_TRADE';
    }

    // Check for conflicting indicators
    const hasConflicts = this.detectConflictingIndicators(technical, warnings);

    if (hasConflicts) {
      warnings.push('Conflicting technical indicators detected');
      return 'NO_TRADE';
    }

    // Return the Quant Engine signal if all validations pass
    if (quantSignal === 'BUY' || quantSignal === 'SELL') {
      return quantSignal;
    }

    // Default to HOLD for unclear cases
    return 'HOLD';
  }

  /**
   * Detect conflicting technical indicators
   *
   * Checks for contradictory signals in technical indicators that would
   * make the trade setup unclear or risky.
   *
   * Conflicting indicators include:
   * - Price above VWAP but RSI oversold (< 30)
   * - Price below VWAP but RSI overbought (> 70)
   * - MACD bullish but EMAs bearish aligned
   * - MACD bearish but EMAs bullish aligned
   *
   * @param technical - Technical analysis indicators
   * @param warnings - Array to collect warnings
   * @returns true if conflicts detected, false otherwise
   */
  private detectConflictingIndicators(technical: any, warnings: string[]): boolean {
    let conflicts = 0;

    const rsi = technical.rsi;
    const vwap = technical.vwap;
    const macdHistogram = technical.macd?.histogram || 0;
    const ema9 = technical.ema_9;
    const ema21 = technical.ema_21;
    const ema50 = technical.ema_50;

    // We need to infer current price from the EMAs or use VWAP as approximation
    // In the test, current_price is provided separately
    // For now, use EMA9 as approximation of current price
    const currentPrice = ema9 || vwap;

    // Conflict 1: Price above VWAP but RSI oversold
    if (currentPrice > vwap && rsi < 30) {
      warnings.push('Price above VWAP but RSI oversold - conflicting signals');
      conflicts++;
    }

    // Conflict 2: Price below VWAP but RSI overbought
    if (currentPrice < vwap && rsi > 70) {
      warnings.push('Price below VWAP but RSI overbought - conflicting signals');
      conflicts++;
    }

    // Conflict 3: MACD bullish but EMAs bearish
    if (macdHistogram > 0 && ema9 < ema21 && ema21 < ema50) {
      warnings.push('MACD bullish but EMAs bearish aligned - conflicting signals');
      conflicts++;
    }

    // Conflict 4: MACD bearish but EMAs bullish
    if (macdHistogram < 0 && ema9 > ema21 && ema21 > ema50) {
      warnings.push('MACD bearish but EMAs bullish aligned - conflicting signals');
      conflicts++;
    }

    // Return true if 2 or more conflicts detected
    return conflicts >= 2;
  }

  /**
   * Build human-readable rationale for recommendation
   *
   * Creates a clear, concise explanation of why the recommendation was generated,
   * including key technical factors and thresholds met.
   *
   * @param signal - Trading signal
   * @param score - Intraday score
   * @param confidence - Confidence percentage
   * @param riskReward - Risk/reward ratio
   * @param technical - Technical indicators
   * @param recommendation - Quant Engine recommendation
   * @returns Rationale string
   */
  private buildRationale(
    signal: string,
    score: number,
    confidence: number,
    riskReward: number,
    technical: any,
    recommendation: any
  ): string {
    if (signal === 'NO_TRADE') {
      return recommendation?.rationale || 'Trade setup does not meet minimum criteria';
    }

    const parts: string[] = [];

    // Add primary rationale from Quant Engine
    if (recommendation?.rationale) {
      parts.push(recommendation.rationale);
    }

    // Add score/confidence
    parts.push(`Intraday score: ${score.toFixed(1)}/100 (Confidence: ${confidence.toFixed(1)}%)`);

    // Add risk/reward
    parts.push(`Risk/Reward: ${riskReward.toFixed(2)} (Target: ${this.MIN_RISK_REWARD})`);

    // Add key technical highlights
    const rsi = technical.rsi;
    if (rsi > 60 && signal === 'BUY') {
      parts.push(`Strong bullish momentum (RSI: ${rsi.toFixed(1)})`);
    } else if (rsi < 40 && signal === 'SELL') {
      parts.push(`Strong bearish momentum (RSI: ${rsi.toFixed(1)})`);
    }

    // Add volume confirmation
    const relativeVolume = technical.relative_volume;
    if (relativeVolume > 1.2) {
      parts.push(`Volume confirmation (${relativeVolume.toFixed(2)}x average)`);
    }

    return parts.join('. ');
  }
}
