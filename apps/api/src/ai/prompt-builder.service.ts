import { Injectable, Logger } from '@nestjs/common';
import { ParsedPrompt } from '../prompt/prompt.service';
import { QuantAnalysisResult } from '../quant/quant.service';
import { PortfolioResponse } from '../portfolio/portfolio.service';
import { OptionsAnalysisResultDto } from '../options/dto/options-analyze.dto';

/**
 * Structured prompt that will be sent to AI provider
 */
export interface StructuredPrompt {
  systemPrompt: string;
  userPrompt: string;
  context: {
    userIntent: string;
    symbol: string;
    timeframe: string;
    assetType: string;
    quantitativeAnalysis: string;
    portfolioState?: string;
    optionsAnalysis?: string;
  };
}

/**
 * PromptBuilderService - Constructs structured prompts for AI providers
 *
 * CRITICAL ARCHITECTURAL CONSTRAINT:
 * This service NEVER includes raw OHLCV data in prompts.
 * It only includes processed quantitative indicators and analysis results.
 *
 * Requirements covered: 4.2, 4.4
 */
@Injectable()
export class PromptBuilderService {
  private readonly logger = new Logger(PromptBuilderService.name);

  /**
   * Build a structured prompt for AI trade recommendation
   *
   * @param parsedPrompt - User's parsed intent and parameters
   * @param quantAnalysis - Processed quantitative analysis (NO raw market data)
   * @param portfolioState - Optional current portfolio state
   * @param optionsAnalysis - Optional options chain analysis (PCR, ATM, OI buildup, support/resistance)
   * @returns Structured prompt ready for AI provider
   */
  buildTradeRecommendationPrompt(
    parsedPrompt: ParsedPrompt,
    quantAnalysis: QuantAnalysisResult,
    portfolioState?: PortfolioResponse,
    optionsAnalysis?: OptionsAnalysisResultDto
  ): StructuredPrompt {
    this.logger.debug(`Building trade recommendation prompt for ${quantAnalysis.symbol}`);

    const systemPrompt = this.buildTradeRecommendationSystemPrompt(
      parsedPrompt.timeframe || 'SWING',
      !!optionsAnalysis
    );
    const quantitativeContext = this.formatQuantitativeAnalysis(quantAnalysis);
    const portfolioContext = portfolioState ? this.formatPortfolioState(portfolioState) : undefined;
    const optionsContext = optionsAnalysis ? this.formatOptionsAnalysis(optionsAnalysis) : undefined;

    const userPrompt = this.buildTradeRecommendationUserPrompt(
      parsedPrompt,
      quantitativeContext,
      portfolioContext,
      optionsContext
    );

    return {
      systemPrompt,
      userPrompt,
      context: {
        userIntent: parsedPrompt.intent,
        symbol: quantAnalysis.symbol,
        timeframe: parsedPrompt.timeframe || 'SWING',
        assetType: parsedPrompt.assetType || 'STOCK',
        quantitativeAnalysis: quantitativeContext,
        portfolioState: portfolioContext,
        optionsAnalysis: optionsContext,
      },
    };
  }

  /**
   * Build a structured prompt for portfolio analysis
   *
   * @param userPrompt - User's original prompt
   * @param portfolioState - Current portfolio state
   * @param quantAnalyses - Array of quant analyses for all positions
   * @returns Structured prompt ready for AI provider
   */
  buildPortfolioAnalysisPrompt(
    userPrompt: string,
    portfolioState: PortfolioResponse,
    quantAnalyses: QuantAnalysisResult[]
  ): StructuredPrompt {
    this.logger.debug('Building portfolio analysis prompt');

    const systemPrompt = this.buildPortfolioAnalysisSystemPrompt();
    const portfolioContext = this.formatPortfolioState(portfolioState);
    const positionAnalyses = quantAnalyses
      .map((qa) => this.formatQuantitativeAnalysis(qa))
      .join('\n\n---\n\n');

    const finalUserPrompt = `
User Request: ${userPrompt}

Current Portfolio State:
${portfolioContext}

Position Analyses:
${positionAnalyses}

Please analyze the portfolio health and provide recommendations.
`.trim();

    return {
      systemPrompt,
      userPrompt: finalUserPrompt,
      context: {
        userIntent: 'ANALYZE_PORTFOLIO',
        symbol: 'PORTFOLIO',
        timeframe: 'N/A',
        assetType: 'PORTFOLIO',
        quantitativeAnalysis: positionAnalyses,
        portfolioState: portfolioContext,
      },
    };
  }

  /**
   * Build a structured prompt for strategy generation
   *
   * @param userPrompt - User's strategy request
   * @param quantAnalysis - Historical quantitative analysis
   * @returns Structured prompt ready for AI provider
   */
  buildStrategyGenerationPrompt(
    userPrompt: string,
    quantAnalysis: QuantAnalysisResult
  ): StructuredPrompt {
    this.logger.debug('Building strategy generation prompt');

    const systemPrompt = this.buildStrategyGenerationSystemPrompt();
    const quantitativeContext = this.formatQuantitativeAnalysis(quantAnalysis);

    const finalUserPrompt = `
User Request: ${userPrompt}

Market Analysis:
${quantitativeContext}

Please generate a trading strategy with clear entry/exit conditions and risk parameters.
`.trim();

    return {
      systemPrompt,
      userPrompt: finalUserPrompt,
      context: {
        userIntent: 'GENERATE_STRATEGY',
        symbol: quantAnalysis.symbol,
        timeframe: 'N/A',
        assetType: 'STOCK',
        quantitativeAnalysis: quantitativeContext,
      },
    };
  }

  /**
   * Build system prompt for trade recommendations
   * Task 41.2: Enhanced to emphasize trendline analysis and breakout/breakdown consideration
   * Task 74.1: Enhanced to include options analysis guidance
   */
  private buildTradeRecommendationSystemPrompt(timeframe: string, isOptionsAnalysis: boolean = false): string {
    const timeframeContext = this.getTimeframeContext(timeframe);

    let systemPrompt = `
You are an expert trading analyst specializing in Indian equity markets (NSE).
Your role is to provide trade recommendations based on quantitative technical analysis.

Trading Context: ${timeframeContext}

CRITICAL RULES:
1. Base recommendations ONLY on the quantitative indicators provided
2. NEVER make up or assume market data - only use the provided technical analysis
3. If conditions are unfavorable or unclear, recommend HOLD
4. Always provide clear entry price, target, stop-loss, and confidence level
5. Provide detailed reasoning explaining the technical basis for your recommendation
6. Consider risk management principles (risk-reward ratio should be at least 1:2)

TRENDLINE ANALYSIS PRIORITY (Task 41.2):
7. PAY SPECIAL ATTENTION to the Comprehensive Trendline Analysis section
8. BREAKOUT signals (resistance broken) are STRONG BULLISH indicators - favor BUY
9. BREAKDOWN signals (support broken) are STRONG BEARISH indicators - favor SELL or HOLD
10. When trendline status shows RETESTING, this indicates HIGH PROBABILITY setups
11. Align your recommendations with the detected Market Direction (UPTREND/DOWNTREND/SIDEWAYS)
12. Use support/resistance trendline status to inform stop-loss placement
13. Consider trendline confidence scores - higher confidence warrants stronger conviction

TRENDLINE-BASED DECISION FRAMEWORK:
- BREAKOUT + CONFIRMED: Strong BUY signal (if other indicators support)
- BREAKDOWN: Strong SELL signal or avoid LONG positions
- UPTREND + Support ACTIVE: BUY on dips near support trendline
- DOWNTREND + Resistance ACTIVE: SELL on rallies near resistance trendline
- SIDEWAYS: Trade range-bound, wait for breakout confirmation
- RETESTING status: High-probability entry points, watch for confirmation
`;

    if (isOptionsAnalysis) {
      systemPrompt += `
OPTIONS ANALYSIS PRIORITY (Task 74.1):
14. PAY SPECIAL ATTENTION to the Options Chain Analysis section
15. PCR (Put-Call Ratio) indicates market sentiment:
    - PCR > 1.2: BULLISH (high put OI suggests support)
    - PCR < 0.8: BEARISH (high call OI suggests resistance)
    - PCR 0.8-1.2: NEUTRAL (balanced)
16. ATM strike and near ATM strikes show highest liquidity - prefer these for trading
17. OI Buildup patterns are critical signals:
    - LONG_BUILDUP: Price up + OI up = STRONG BULLISH (fresh buying)
    - SHORT_BUILDUP: Price down + OI up = STRONG BEARISH (fresh selling)
    - LONG_UNWINDING: Price down + OI down = Bearish (longs exiting)
    - SHORT_UNWINDING: Price up + OI down = Bullish (shorts covering)
18. Support levels from high PUT OI act as price floors
19. Resistance levels from high CALL OI act as price ceilings
20. Consider strike prices with max OI for key support/resistance zones

OPTIONS TRADING FRAMEWORK:
- High PUT OI at strike = Strong SUPPORT (consider buying CALLs above this level)
- High CALL OI at strike = Strong RESISTANCE (consider buying PUTs below this level)
- LONG_BUILDUP + Price near support = Strong BUY signal
- SHORT_BUILDUP + Price near resistance = Strong SELL signal
- Recommend strikes close to ATM for better liquidity and risk management
- Factor in options Greeks if provided (Delta, Theta decay)
- ALWAYS consider risk-reward: options can decay quickly, ensure setup justifies risk
`;
    }

    systemPrompt += `
Response Format (JSON):
{
  "action": "BUY" | "SELL" | "HOLD",
  "entryPrice": number,
  "target": number,
  "stopLoss": number,
  "confidence": number (0.0 to 1.0),
  "reasoning": "detailed explanation based on technical indicators${isOptionsAnalysis ? ', options chain analysis,' : ''} AND trendline analysis"
}
`.trim();

    return systemPrompt;
  }

  /**
   * Build system prompt for portfolio analysis
   */
  private buildPortfolioAnalysisSystemPrompt(): string {
    return `
You are an expert portfolio manager specializing in Indian equity markets (NSE).
Your role is to analyze portfolio health and provide actionable recommendations.

CRITICAL RULES:
1. Base analysis ONLY on the provided portfolio state and position analyses
2. Evaluate portfolio diversification, risk exposure, and position health
3. Identify positions that may need attention (trailing stops, profit booking, etc.)
4. Consider overall portfolio risk and suggest rebalancing if needed
5. Provide specific, actionable recommendations with clear reasoning

Response Format:
Provide a clear analysis covering:
- Portfolio health score (0-100)
- Risk assessment
- Individual position recommendations
- Overall portfolio recommendations
- Warnings or concerns
`.trim();
  }

  /**
   * Build system prompt for strategy generation
   */
  private buildStrategyGenerationSystemPrompt(): string {
    return `
You are an expert quantitative trading strategist specializing in Indian equity markets (NSE).
Your role is to generate trading strategies with clear, testable rules.

CRITICAL RULES:
1. Create strategies based on technical indicators and quantitative rules
2. Define clear entry conditions (specific indicator values/combinations)
3. Define clear exit conditions (both profit targets and stop losses)
4. Specify risk parameters (position size, max drawdown, etc.)
5. Ensure strategy is backtestable and mechanical (no subjective decisions)

Response Format:
Provide a structured strategy with:
- Strategy name and description
- Entry conditions (precise rules)
- Exit conditions (profit target and stop loss rules)
- Risk parameters (position sizing, max loss per trade, etc.)
- Expected win rate and risk-reward ratio
`.trim();
  }

  /**
   * Build user prompt for trade recommendation
   */
  private buildTradeRecommendationUserPrompt(
    parsedPrompt: ParsedPrompt,
    quantitativeContext: string,
    portfolioContext?: string,
    optionsContext?: string
  ): string {
    const parts = [
      `Symbol: ${parsedPrompt.symbols.join(', ')}`,
      `Trade Type: ${parsedPrompt.timeframe || 'SWING'}`,
      `Asset Type: ${parsedPrompt.assetType || 'STOCK'}`,
      '',
      'Quantitative Analysis:',
      quantitativeContext,
    ];

    if (optionsContext) {
      parts.push('', 'Options Chain Analysis:', optionsContext);
    }

    if (portfolioContext) {
      parts.push('', 'Current Portfolio State:', portfolioContext);
    }

    parts.push(
      '',
      'Based on this analysis, provide your trade recommendation.',
      'If conditions are not favorable, recommend HOLD with clear reasoning.'
    );

    return parts.join('\n');
  }

  /**
   * Format quantitative analysis for prompt (NEVER includes raw OHLCV)
   * Task 41.2: Enhanced to include comprehensive trendline analysis
   */
  private formatQuantitativeAnalysis(quantAnalysis: QuantAnalysisResult): string {
    const parts: string[] = [];

    parts.push(`Symbol: ${quantAnalysis.symbol}`);
    parts.push(`Timeframe: ${quantAnalysis.timeframe}`);
    parts.push('');

    // Technical Indicators
    parts.push('Technical Indicators:');
    if (quantAnalysis.indicators.rsi !== undefined) {
      const rsiSignal = this.interpretRSI(quantAnalysis.indicators.rsi);
      parts.push(`- RSI: ${quantAnalysis.indicators.rsi.toFixed(2)} ${rsiSignal}`);
    }

    if (quantAnalysis.indicators.macd) {
      const { value, signal, histogram } = quantAnalysis.indicators.macd;
      const macdSignal = histogram > 0 ? '(Bullish)' : '(Bearish)';
      parts.push(`- MACD: ${value.toFixed(2)}, Signal: ${signal.toFixed(2)} ${macdSignal}`);
    }

    if (quantAnalysis.indicators.sma_20) {
      parts.push(`- SMA 20: ${quantAnalysis.indicators.sma_20.toFixed(2)}`);
    }

    if (quantAnalysis.indicators.sma_50) {
      parts.push(`- SMA 50: ${quantAnalysis.indicators.sma_50.toFixed(2)}`);
    }

    if (quantAnalysis.indicators.sma_200) {
      parts.push(`- SMA 200: ${quantAnalysis.indicators.sma_200.toFixed(2)}`);
    }

    if (quantAnalysis.indicators.bollingerBands) {
      const { upper, middle, lower } = quantAnalysis.indicators.bollingerBands;
      parts.push(
        `- Bollinger Bands: Upper=${upper.toFixed(2)}, Middle=${middle.toFixed(2)}, Lower=${lower.toFixed(2)}`
      );
    }

    // Support and Resistance
    if (quantAnalysis.supportResistance && quantAnalysis.supportResistance.length > 0) {
      parts.push('');
      parts.push('Support/Resistance Levels:');
      quantAnalysis.supportResistance
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 3)
        .forEach((level) => {
          parts.push(`- ${level.level.toFixed(2)} (Strength: ${level.strength.toFixed(2)})`);
        });
    }

    // Trendlines
    if (quantAnalysis.trendlines && quantAnalysis.trendlines.length > 0) {
      parts.push('');
      parts.push('Trendlines:');
      quantAnalysis.trendlines.forEach((trendline) => {
        const direction = trendline.slope > 0 ? 'Uptrend' : 'Downtrend';
        parts.push(
          `- ${direction}: Slope=${trendline.slope.toFixed(4)}, R²=${trendline.rSquared.toFixed(3)}`
        );
      });
    }

    // Comprehensive Trendline Analysis (Task 41.2)
    if (quantAnalysis.trendline) {
      parts.push('');
      parts.push('=== COMPREHENSIVE TRENDLINE ANALYSIS ===');

      const trendlineAnalysis = quantAnalysis.trendline;

      // Overall trend direction
      parts.push(`Market Direction: ${trendlineAnalysis.direction}`);
      parts.push(`Analysis Confidence: ${(trendlineAnalysis.confidence * 100).toFixed(1)}%`);

      // Support trendline
      if (trendlineAnalysis.support_line) {
        const supportLine = trendlineAnalysis.support_line;
        parts.push('');
        parts.push('Support Trendline:');
        parts.push(`- Status: ${trendlineAnalysis.support_status}`);
        parts.push(
          `- Slope: ${supportLine.slope.toFixed(4)} (${supportLine.slope > 0 ? 'Rising' : 'Falling'})`
        );
        parts.push(`- Fit Quality (R²): ${supportLine.rSquared.toFixed(3)}`);
      } else {
        parts.push('');
        parts.push('Support Trendline: NOT DETECTED (insufficient swing lows)');
      }

      // Resistance trendline
      if (trendlineAnalysis.resistance_line) {
        const resistanceLine = trendlineAnalysis.resistance_line;
        parts.push('');
        parts.push('Resistance Trendline:');
        parts.push(`- Status: ${trendlineAnalysis.resistance_status}`);
        parts.push(
          `- Slope: ${resistanceLine.slope.toFixed(4)} (${resistanceLine.slope > 0 ? 'Rising' : 'Falling'})`
        );
        parts.push(`- Fit Quality (R²): ${resistanceLine.rSquared.toFixed(3)}`);
      } else {
        parts.push('');
        parts.push('Resistance Trendline: NOT DETECTED (insufficient swing highs)');
      }

      // Breakout/Breakdown status
      parts.push('');
      parts.push(`Breakout Status: ${trendlineAnalysis.breakout_status}`);

      if (trendlineAnalysis.breakout_status === 'BREAKOUT') {
        parts.push('⚠️ RESISTANCE BREAKOUT DETECTED - Strong bullish signal');
        parts.push('   Price has broken above resistance trendline with volume confirmation');
      } else if (trendlineAnalysis.breakout_status === 'BREAKDOWN') {
        parts.push('⚠️ SUPPORT BREAKDOWN DETECTED - Strong bearish signal');
        parts.push('   Price has broken below support trendline with volume confirmation');
      } else if (trendlineAnalysis.breakout_status === 'CONFIRMED') {
        parts.push('✓ BREAKOUT CONFIRMED - Momentum continuation expected');
      }

      // Swing points summary
      if (trendlineAnalysis.swing_points && trendlineAnalysis.swing_points.length > 0) {
        const swingHighs = trendlineAnalysis.swing_points.filter((p) => p.type === 'HIGH').length;
        const swingLows = trendlineAnalysis.swing_points.filter((p) => p.type === 'LOW').length;
        parts.push('');
        parts.push(`Swing Points: ${swingHighs} highs, ${swingLows} lows detected`);
      }

      parts.push('');
      parts.push('⚡ TRADING IMPLICATIONS:');

      // Provide context-aware trading implications
      if (
        trendlineAnalysis.breakout_status === 'BREAKOUT' ||
        trendlineAnalysis.breakout_status === 'CONFIRMED'
      ) {
        parts.push('- Consider BUY positions if other indicators confirm');
        parts.push('- Watch for pullback to broken resistance (now support) for entry');
        parts.push('- Place stop loss below the previous resistance level');
      } else if (trendlineAnalysis.breakout_status === 'BREAKDOWN') {
        parts.push('- Consider SELL or avoid LONG positions');
        parts.push('- Watch for retest of broken support (now resistance)');
        parts.push('- Place stop loss above the previous support level if shorting');
      } else if (trendlineAnalysis.direction === 'UPTREND') {
        parts.push('- Uptrend intact - favor BUY on dips to support trendline');
        parts.push('- Use support trendline as dynamic stop loss reference');
      } else if (trendlineAnalysis.direction === 'DOWNTREND') {
        parts.push('- Downtrend intact - avoid LONG or consider SHORT on rallies');
        parts.push('- Use resistance trendline as dynamic target reference');
      } else if (trendlineAnalysis.direction === 'SIDEWAYS') {
        parts.push('- Range-bound market - trade support/resistance bounces');
        parts.push('- Wait for clear breakout before taking directional positions');
      }

      if (
        trendlineAnalysis.support_status === 'RETESTING' ||
        trendlineAnalysis.resistance_status === 'RETESTING'
      ) {
        parts.push('- Trendline retest in progress - HIGH PROBABILITY setup');
        parts.push('- Watch for confirmation before entry');
      }

      parts.push('==========================================');
    }

    // Options Greeks (if available)
    if (quantAnalysis.optionsGreeks) {
      parts.push('');
      parts.push('Options Greeks:');
      parts.push(`- Delta: ${quantAnalysis.optionsGreeks.delta.toFixed(4)}`);
      parts.push(`- Gamma: ${quantAnalysis.optionsGreeks.gamma.toFixed(4)}`);
      parts.push(`- Theta: ${quantAnalysis.optionsGreeks.theta.toFixed(4)}`);
      parts.push(`- Vega: ${quantAnalysis.optionsGreeks.vega.toFixed(4)}`);
    }

    return parts.join('\n');
  }

  /**
   * Format portfolio state for prompt (summary only, no raw data)
   */
  private formatPortfolioState(portfolioState: PortfolioResponse): string {
    const parts: string[] = [];

    parts.push(`Total Value: ₹${portfolioState.totalValue.toFixed(2)}`);
    parts.push(`Cash Balance: ₹${portfolioState.cashBalance.toFixed(2)}`);
    parts.push(`Invested Value: ₹${portfolioState.investedValue.toFixed(2)}`);
    parts.push(`Total PnL: ₹${portfolioState.totalPnL.toFixed(2)}`);
    parts.push('');

    parts.push('Portfolio Metrics:');
    parts.push(`- Total Exposure: ${(portfolioState.metrics.totalExposure * 100).toFixed(1)}%`);
    parts.push(`- Open Positions: ${portfolioState.metrics.openPositions}`);
    parts.push(`- Win Rate: ${portfolioState.metrics.winRate.toFixed(1)}%`);
    parts.push(`- Avg Win: ₹${portfolioState.metrics.avgWin.toFixed(2)}`);
    parts.push(`- Avg Loss: ₹${portfolioState.metrics.avgLoss.toFixed(2)}`);

    if (portfolioState.positions.length > 0) {
      parts.push('');
      parts.push('Current Positions:');
      portfolioState.positions.forEach((pos) => {
        const pnlSign = pos.unrealizedPnL >= 0 ? '+' : '';
        parts.push(
          `- ${pos.symbol}: ${pos.quantity} @ ₹${pos.averagePrice.toFixed(2)}, PnL: ${pnlSign}₹${pos.unrealizedPnL.toFixed(2)} (${pnlSign}${pos.unrealizedPnLPercent.toFixed(2)}%)`
        );
      });
    }

    return parts.join('\n');
  }

  /**
   * Get timeframe-specific context for system prompt
   */
  private getTimeframeContext(timeframe: string): string {
    switch (timeframe) {
      case 'SWING':
        return 'Swing trading (multi-day positions). Focus on daily chart patterns and medium-term trends.';
      case 'INTRADAY':
        return 'Intraday trading (same-day positions). Focus on intraday momentum and short-term setups.';
      case 'SCALPING':
        return 'Scalping (very short-term positions). Focus on quick price movements and high-probability setups.';
      default:
        return 'General trading analysis.';
    }
  }

  /**
   * Interpret RSI value
   */
  private interpretRSI(rsi: number): string {
    if (rsi > 70) return '(Overbought)';
    if (rsi < 30) return '(Oversold)';
    if (rsi > 50) return '(Bullish)';
    return '(Bearish)';
  }

  /**
   * Format options chain analysis for prompt (NEVER includes raw options chain data)
   * Task 74.1: Format processed options analysis (PCR, ATM, OI buildup, support/resistance)
   * 
   * CRITICAL ARCHITECTURAL CONSTRAINT:
   * AI receives ONLY processed analysis data, NOT raw options chain contracts.
   * This includes: PCR ratios, ATM strikes, OI buildup patterns, support/resistance levels.
   * 
   * Requirements: 4.2, 4.4, 7.1, 18.1
   */
  private formatOptionsAnalysis(optionsAnalysis: OptionsAnalysisResultDto): string {
    const parts: string[] = [];

    parts.push('=== OPTIONS CHAIN ANALYSIS ===');
    parts.push(`Symbol: ${optionsAnalysis.symbol}`);
    parts.push(`Expiry Date: ${optionsAnalysis.expiryDate}`);
    parts.push(`Spot Price: ₹${optionsAnalysis.spotPrice.toFixed(2)}`);
    parts.push(`Analysis Time: ${new Date(optionsAnalysis.timestamp).toLocaleString()}`);
    parts.push('');

    // PCR Analysis
    parts.push('--- PUT-CALL RATIO (PCR) ANALYSIS ---');
    const pcr = optionsAnalysis.pcrAnalysis;
    parts.push(`PCR by Open Interest: ${pcr.pcrByOI.toFixed(2)}`);
    parts.push(`PCR by Volume: ${pcr.pcrByVolume.toFixed(2)}`);
    parts.push(`Market Sentiment: ${pcr.sentiment}`);
    
    // Interpret PCR
    if (pcr.pcrByOI > 1.2) {
      parts.push(`⚡ BULLISH SIGNAL: High PUT OI (${pcr.totalPutOI.toLocaleString()}) vs CALL OI (${pcr.totalCallOI.toLocaleString()})`);
      parts.push('   High put writing suggests strong support, bullish outlook');
    } else if (pcr.pcrByOI < 0.8) {
      parts.push(`⚠️ BEARISH SIGNAL: High CALL OI (${pcr.totalCallOI.toLocaleString()}) vs PUT OI (${pcr.totalPutOI.toLocaleString()})`);
      parts.push('   High call writing suggests strong resistance, bearish outlook');
    } else {
      parts.push(`📊 NEUTRAL: Balanced CALL OI (${pcr.totalCallOI.toLocaleString()}) and PUT OI (${pcr.totalPutOI.toLocaleString()})`);
    }
    parts.push('');

    // ATM Analysis
    parts.push('--- AT-THE-MONEY (ATM) ANALYSIS ---');
    const atm = optionsAnalysis.atmAnalysis;
    parts.push(`Current Spot: ₹${atm.spotPrice.toFixed(2)}`);
    parts.push(`ATM Strike: ₹${atm.atmStrike.toFixed(0)}`);
    parts.push(`Strike Interval: ₹${atm.strikeInterval}`);
    parts.push('');
    parts.push('Near ATM Strikes (Highest Liquidity):');
    
    atm.nearATMStrikes.forEach((strike) => {
      const distancePercent = (strike.distanceFromSpot / atm.spotPrice * 100).toFixed(2);
      parts.push(`  Strike ₹${strike.strike}:`);
      parts.push(`    Distance from Spot: ${strike.distanceFromSpot > 0 ? '+' : ''}₹${strike.distanceFromSpot.toFixed(2)} (${distancePercent}%)`);
      parts.push(`    CALL OI: ${strike.callOI.toLocaleString()}, Volume: ${strike.callVolume.toLocaleString()}`);
      parts.push(`    PUT OI: ${strike.putOI.toLocaleString()}, Volume: ${strike.putVolume.toLocaleString()}`);
    });
    parts.push('');

    // OI Analysis
    parts.push('--- OPEN INTEREST (OI) BUILDUP ANALYSIS ---');
    const oi = optionsAnalysis.oiAnalysis;
    parts.push(`Buildup Pattern: ${oi.buildupType}`);
    parts.push(`Interpretation: ${oi.explanation}`);
    parts.push('');

    // Interpret buildup type
    if (oi.buildupType === 'LONG_BUILDUP') {
      parts.push('⚡ STRONG BULLISH: Fresh long positions being added (Price ↑ + OI ↑)');
      parts.push('   Aggressive buying suggests upward momentum continuation expected');
    } else if (oi.buildupType === 'SHORT_BUILDUP') {
      parts.push('⚠️ STRONG BEARISH: Fresh short positions being added (Price ↓ + OI ↑)');
      parts.push('   Aggressive selling suggests downward momentum continuation expected');
    } else if (oi.buildupType === 'LONG_UNWINDING') {
      parts.push('📉 BEARISH: Long positions being closed (Price ↓ + OI ↓)');
      parts.push('   Longs exiting indicates weakening support');
    } else if (oi.buildupType === 'SHORT_UNWINDING') {
      parts.push('📈 BULLISH: Short positions being covered (Price ↑ + OI ↓)');
      parts.push('   Shorts covering indicates weakening resistance');
    }
    parts.push('');

    // Support Levels
    if (oi.supportLevels.length > 0) {
      parts.push('SUPPORT LEVELS (High PUT OI):');
      oi.supportLevels.slice(0, 3).forEach((level, index) => {
        parts.push(`  ${index + 1}. ₹${level.strike} - Strength: ${(level.strength * 100).toFixed(0)}%`);
        parts.push(`     Reason: ${level.reason}`);
      });
      parts.push('');
    }

    // Resistance Levels
    if (oi.resistanceLevels.length > 0) {
      parts.push('RESISTANCE LEVELS (High CALL OI):');
      oi.resistanceLevels.slice(0, 3).forEach((level, index) => {
        parts.push(`  ${index + 1}. ₹${level.strike} - Strength: ${(level.strength * 100).toFixed(0)}%`);
        parts.push(`     Reason: ${level.reason}`);
      });
      parts.push('');
    }

    // Max OI Strikes
    parts.push('KEY STRIKES:');
    parts.push(`Max CALL OI: ₹${oi.maxCallOIStrike} (Strong Resistance Zone)`);
    parts.push(`Max PUT OI: ₹${oi.maxPutOIStrike} (Strong Support Zone)`);
    parts.push('');

    // OI Change Analysis
    if (oi.oiChangeAnalysis && oi.oiChangeAnalysis.length > 0) {
      parts.push('SIGNIFICANT OI CHANGES:');
      oi.oiChangeAnalysis.slice(0, 5).forEach((change) => {
        parts.push(`  ₹${change.strike}:`);
        parts.push(`    CALL OI Change: ${change.callOIChange > 0 ? '+' : ''}${change.callOIChange.toLocaleString()}`);
        parts.push(`    PUT OI Change: ${change.putOIChange > 0 ? '+' : ''}${change.putOIChange.toLocaleString()}`);
        parts.push(`    → ${change.interpretation}`);
      });
      parts.push('');
    }

    // Trading Implications
    parts.push('⚡ OPTIONS TRADING IMPLICATIONS:');
    
    // Based on PCR
    if (pcr.pcrByOI > 1.2) {
      parts.push('- Bullish sentiment: Consider CALL options near ATM strikes');
      parts.push(`- Strong support expected at ₹${oi.maxPutOIStrike}`);
    } else if (pcr.pcrByOI < 0.8) {
      parts.push('- Bearish sentiment: Consider PUT options near ATM strikes');
      parts.push(`- Strong resistance expected at ₹${oi.maxCallOIStrike}`);
    }

    // Based on buildup type
    if (oi.buildupType === 'LONG_BUILDUP') {
      parts.push('- Fresh buying momentum: Look for CALL buying opportunities');
      parts.push('- Place stop loss below nearest support level');
    } else if (oi.buildupType === 'SHORT_BUILDUP') {
      parts.push('- Fresh selling momentum: Look for PUT buying opportunities');
      parts.push('- Place stop loss above nearest resistance level');
    }

    // Recommend ATM strikes for best liquidity
    parts.push(`- Prefer strikes near ATM (₹${atm.atmStrike}) for better liquidity and tighter spreads`);
    parts.push('- Monitor strike interval for appropriate strike selection');
    
    parts.push('========================================');

    return parts.join('\n');
  }
}
