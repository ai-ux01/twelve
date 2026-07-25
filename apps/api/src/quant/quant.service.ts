import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { OHLCVData } from '../market-data/market-data.service';
import { AuditLogService } from '../audit/audit.service';

export interface QuantAnalysisResult {
  symbol: string;
  timeframe: string;
  indicators: {
    rsi: number;
    macd: { value: number; signal: number; histogram: number };
    sma_20: number;
    sma_50: number;
    sma_200: number;
    ema_5: number;
    ema_15: number;
    ema_20: number;
    ema_50: number;
    ema_200: number;
    bollingerBands: { upper: number; middle: number; lower: number };
    adx: number;
    atr: number;
    vwap: number;
    volume_ma: number;
    relative_volume: number;
    week_52_high: number;
    week_52_low: number;
    momentum: number;
  };
  supportResistance: { level: number; strength: number }[];
  trendlines: { slope: number; intercept: number; rSquared: number }[];
  trendline?: {
    support_line: { slope: number; intercept: number; rSquared: number } | null;
    resistance_line: { slope: number; intercept: number; rSquared: number } | null;
    swing_points: Array<{ timestamp: string; price: number; type: 'HIGH' | 'LOW'; index: number }>;
    breakout_status: 'NONE' | 'BREAKOUT' | 'BREAKDOWN' | 'CONFIRMED';
    direction: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
    support_status: 'ACTIVE' | 'BROKEN' | 'RETESTING';
    resistance_status: 'ACTIVE' | 'BROKEN' | 'RETESTING';
    confidence: number;
  };
  optionsGreeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
}

export interface ScoreResult {
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi: number;
  adx: number;
  vwap: number;
  volumeRatio: number;
  score: number;
  signals: string[];
}

@Injectable()
export class QuantService {
  private readonly logger = new Logger(QuantService.name);
  private readonly httpClient: AxiosInstance;
  private readonly quantEngineUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService
  ) {
    this.quantEngineUrl = this.configService.get<string>(
      'QUANT_ENGINE_URL',
      'http://localhost:8000'
    );

    this.httpClient = axios.create({
      baseURL: this.quantEngineUrl,
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`Quant Engine URL: ${this.quantEngineUrl}`);
  }

  /**
   * Send market data to Quant Engine for technical analysis
   * No retry logic - deterministic calculations should succeed or fail immediately
   *
   * Uses the new /quant/analyze endpoint which includes all indicators:
   * RSI, MACD, SMAs, EMAs (5, 15, 20, 50, 200), Bollinger Bands, ADX, ATR, VWAP,
   * volume analysis, 52-week high/low, momentum, support/resistance, and trendlines.
   *
   * @param symbol - Trading symbol
   * @param timeframe - Data timeframe
   * @param data - OHLCV data points
   * @param includeTrendline - Whether to include comprehensive trendline analysis (default: false)
   */
  async analyzeMarketData(
    symbol: string,
    timeframe: string,
    data: OHLCVData[],
    includeTrendline: boolean = false
  ): Promise<QuantAnalysisResult> {
    this.logger.debug(
      `Analyzing market data for ${symbol} (${timeframe})${includeTrendline ? ' with trendline analysis' : ''}`
    );

    try {
      const response = await this.httpClient.post(
        '/quant/analyze',
        {
          symbol,
          timeframe,
          data: data.map((d) => ({
            timestamp: d.timestamp.toISOString(),
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume,
          })),
        },
        {
          params: {
            include_trendline: includeTrendline,
          },
        }
      );

      this.logger.debug(
        `Received quant analysis for ${symbol}${includeTrendline ? ' (includes trendline)' : ''}`
      );

      // Log successful Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('analyze_market_data', symbol, true, undefined, {
        timeframe,
        dataPoints: data.length,
        indicators: Object.keys(response.data.indicators),
        includeTrendline,
      });

      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to analyze market data for ${symbol}`, errorMessage);

      // Log failed Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('analyze_market_data', symbol, false, errorMessage);

      throw new Error(`Quant Engine analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Calculate specific technical indicators
   */
  async calculateIndicators(
    symbol: string,
    timeframe: string,
    data: OHLCVData[]
  ): Promise<QuantAnalysisResult['indicators']> {
    this.logger.debug(`Calculating indicators for ${symbol}`);

    try {
      const response = await this.httpClient.post('/indicators', {
        symbol,
        timeframe,
        data: data.map((d) => ({
          timestamp: d.timestamp.toISOString(),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
        })),
      });

      // Log successful Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('calculate_indicators', symbol, true, undefined, {
        timeframe,
        indicators: Object.keys(response.data),
      });

      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to calculate indicators for ${symbol}`, errorMessage);

      // Log failed Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('calculate_indicators', symbol, false, errorMessage);

      throw new Error(`Indicator calculation failed: ${errorMessage}`);
    }
  }

  /**
   * Detect trendlines and support/resistance levels
   */
  async detectTrendlines(
    symbol: string,
    timeframe: string,
    data: OHLCVData[]
  ): Promise<{
    trendlines: QuantAnalysisResult['trendlines'];
    supportResistance: QuantAnalysisResult['supportResistance'];
  }> {
    this.logger.debug(`Detecting trendlines for ${symbol}`);

    try {
      const response = await this.httpClient.post('/trendlines', {
        symbol,
        timeframe,
        data: data.map((d) => ({
          timestamp: d.timestamp.toISOString(),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
        })),
      });

      // Log successful Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('detect_trendlines', symbol, true, undefined, {
        timeframe,
        trendlinesCount: response.data.trendlines?.length || 0,
        supportResistanceCount: response.data.supportResistance?.length || 0,
      });

      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to detect trendlines for ${symbol}`, errorMessage);

      // Log failed Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('detect_trendlines', symbol, false, errorMessage);

      throw new Error(`Trendline detection failed: ${errorMessage}`);
    }
  }

  /**
   * Get deterministic market scoring from Quant Engine
   *
   * Uses POST /quant/score endpoint which provides:
   * - Trend classification (BULLISH/BEARISH/NEUTRAL)
   * - Overall market score (0-100)
   * - Key indicator values (RSI, ADX, VWAP, volume ratio)
   * - Signal descriptions explaining the analysis
   *
   * All calculations are deterministic (no AI involved).
   */
  async scoreMarket(symbol: string, timeframe: string, data: OHLCVData[]): Promise<ScoreResult> {
    this.logger.debug(`Scoring market data for ${symbol} (${timeframe})`);

    try {
      const response = await this.httpClient.post('/quant/score', {
        symbol,
        timeframe,
        data: data.map((d) => ({
          timestamp: d.timestamp.toISOString(),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
        })),
      });

      this.logger.debug(
        `Received market score for ${symbol}: ${response.data.score} (${response.data.trend})`
      );

      // Log successful Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('score_market', symbol, true, undefined, {
        timeframe,
        dataPoints: data.length,
        trend: response.data.trend,
        score: response.data.score,
      });

      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to score market data for ${symbol}`, errorMessage);

      // Log failed Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('score_market', symbol, false, errorMessage);

      throw new Error(`Market scoring failed: ${errorMessage}`);
    }
  }

  /**
   * Perform comprehensive trendline analysis
   *
   * Calls POST /quant/trendline endpoint which provides:
   * - Swing point detection (swing highs and swing lows)
   * - Support trendline calculation (fitted to swing lows)
   * - Resistance trendline calculation (fitted to swing highs)
   * - Breakout/breakdown detection with volume confirmation
   *
   * @param symbol Trading symbol
   * @param timeframe Timeframe for analysis
   * @param data OHLCV market data
   * @param lookbackPeriod Number of candles to look back for swing detection (default: 3)
   * @returns Comprehensive trendline analysis result
   */
  async analyzeTrendline(
    symbol: string,
    timeframe: string,
    data: OHLCVData[],
    lookbackPeriod: number = 3
  ): Promise<QuantAnalysisResult['trendline']> {
    this.logger.debug(
      `Analyzing trendlines for ${symbol} (${timeframe}) with lookback ${lookbackPeriod}`
    );

    try {
      const response = await this.httpClient.post(
        '/quant/trendline',
        {
          symbol,
          timeframe,
          data: data.map((d) => ({
            timestamp: d.timestamp.toISOString(),
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume,
          })),
        },
        {
          params: {
            lookback_period: lookbackPeriod,
          },
        }
      );

      this.logger.debug(
        `Received trendline analysis for ${symbol}: ` +
          `${response.data.swing_points?.length || 0} swing points, ` +
          `breakout status: ${response.data.breakout_status || 'NONE'}`
      );

      // Log successful Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('analyze_trendline', symbol, true, undefined, {
        timeframe,
        dataPoints: data.length,
        lookbackPeriod,
        swingPoints: response.data.swing_points?.length || 0,
        breakoutStatus: response.data.breakout_status || 'NONE',
        direction: response.data.direction || 'SIDEWAYS',
      });

      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to analyze trendlines for ${symbol}`, errorMessage);

      // Log failed Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('analyze_trendline', symbol, false, errorMessage);

      throw new Error(`Trendline analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Perform comprehensive intraday analysis with scoring and recommendations
   *
   * Calls POST /quant/intraday/analyze endpoint which provides:
   * - Complete technical indicators (RSI, MACD, EMAs, VWAP, ATR, Bollinger Bands, Volume)
   * - Opening range analysis with breakout detection
   * - Previous day levels with breach detection
   * - Support/resistance levels and trendlines
   * - Data freshness validation
   * - Deterministic intraday score (0-100)
   * - Trading recommendation (BUY/SELL/HOLD/NO_TRADE)
   *
   * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6
   *
   * @param symbol Trading symbol
   * @param interval Intraday interval (1m, 5m, 15m, 30m, 1h)
   * @param data OHLCV market data (minimum 30 candles)
   * @param includeSupportResistance Include support/resistance levels (default: true)
   * @param includeOpeningRange Include opening range analysis (default: true)
   * @param includePrevDayLevels Include previous day levels (default: true)
   * @returns Comprehensive intraday analysis result with recommendation
   */
  async analyzeIntraday(
    symbol: string,
    interval: string,
    data: OHLCVData[],
    includeSupportResistance: boolean = true,
    includeOpeningRange: boolean = true,
    includePrevDayLevels: boolean = true
  ): Promise<any> {
    this.logger.debug(
      `Analyzing intraday data for ${symbol} (${interval}) with ${data.length} candles`
    );

    try {
      const response = await this.httpClient.post('/quant/intraday/analyze', {
        symbol,
        interval,
        data: data.map((d) => ({
          timestamp: d.timestamp.toISOString(),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
        })),
        include_support_resistance: includeSupportResistance,
        include_opening_range: includeOpeningRange,
        include_prev_day_levels: includePrevDayLevels,
      });

      this.logger.debug(
        `Received intraday analysis for ${symbol}: ` +
          `Score: ${response.data.score?.total_score || 0}, ` +
          `Signal: ${response.data.recommendation?.signal || 'UNKNOWN'}, ` +
          `Data age: ${response.data.data_freshness?.age_seconds || 0}s`
      );

      // Log successful Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('analyze_intraday', symbol, true, undefined, {
        interval,
        dataPoints: data.length,
        score: response.data.score?.total_score,
        signal: response.data.recommendation?.signal,
        dataAge: response.data.data_freshness?.age_seconds,
      });

      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to analyze intraday data for ${symbol}`, errorMessage);

      // Log failed Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('analyze_intraday', symbol, false, errorMessage);

      throw new Error(`Intraday analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Process options chain with Greeks calculation and liquidity filtering
   *
   * Calls POST /quant/options/chain endpoint which provides:
   * - Batch Greeks calculation for all contracts (Delta, Gamma, Theta, Vega)
   * - Liquidity filtering based on volume, OI, and bid-ask spread
   * - Illiquid contract warnings
   * - Contract classification (liquid vs illiquid)
   *
   * Requirements: 7.1, 7.3, 8.1
   *
   * @param symbol Underlying symbol (NIFTY or BANKNIFTY)
   * @param expiry Expiry date of options contracts
   * @param spotPrice Current spot price of underlying
   * @param contracts Array of option contracts with strike, IV, prices, OI, volume
   * @param riskFreeRate Risk-free interest rate (default: 0.07)
   * @returns Processed options chain with Greeks and liquidity data
   */
  async processOptionsChain(
    symbol: string,
    expiry: Date,
    spotPrice: number,
    contracts: Array<{
      strikePrice: number;
      optionType: 'CALL' | 'PUT';
      volatility: number;
      ltp: number;
      openInterest: number;
      volume: number;
      bid?: number;
      ask?: number;
    }>,
    riskFreeRate: number = 0.07
  ): Promise<{
    symbol: string;
    expiry: Date;
    spotPrice: number;
    timestamp: Date;
    totalContracts: number;
    liquidContracts: number;
    illiquidContracts: number;
    contracts: Array<{
      strikePrice: number;
      optionType: 'CALL' | 'PUT';
      ltp: number;
      openInterest: number;
      volume: number;
      bid?: number;
      ask?: number;
      greeks: {
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
      };
      iv: number;
      liquidityWarnings: string[];
      isLiquid: boolean;
    }>;
  }> {
    this.logger.debug(
      `Processing options chain for ${symbol}: ${contracts.length} contracts, expiry=${expiry.toISOString()}, spot=${spotPrice}`
    );

    try {
      const response = await this.httpClient.post('/quant/options/chain', {
        symbol,
        expiry: expiry.toISOString(),
        spot_price: spotPrice,
        risk_free_rate: riskFreeRate,
        contracts: contracts.map((c) => ({
          strike_price: c.strikePrice,
          option_type: c.optionType,
          volatility: c.volatility,
          ltp: c.ltp,
          open_interest: c.openInterest,
          volume: c.volume,
          bid: c.bid,
          ask: c.ask,
        })),
      });

      this.logger.debug(
        `Received processed options chain for ${symbol}: ` +
          `${response.data.total_contracts} contracts, ` +
          `${response.data.liquid_contracts} liquid, ` +
          `${response.data.illiquid_contracts} illiquid`
      );

      // Log successful Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('process_options_chain', symbol, true, undefined, {
        expiry: expiry.toISOString(),
        spotPrice,
        totalContracts: response.data.total_contracts,
        liquidContracts: response.data.liquid_contracts,
        illiquidContracts: response.data.illiquid_contracts,
      });

      return {
        symbol: response.data.symbol,
        expiry: new Date(response.data.expiry),
        spotPrice: response.data.spot_price,
        timestamp: new Date(response.data.timestamp),
        totalContracts: response.data.total_contracts,
        liquidContracts: response.data.liquid_contracts,
        illiquidContracts: response.data.illiquid_contracts,
        contracts: response.data.contracts.map((c: any) => ({
          strikePrice: c.strike_price,
          optionType: c.option_type,
          ltp: c.ltp,
          openInterest: c.open_interest,
          volume: c.volume,
          bid: c.bid,
          ask: c.ask,
          greeks: {
            delta: c.greeks.delta,
            gamma: c.greeks.gamma,
            theta: c.greeks.theta,
            vega: c.greeks.vega,
          },
          iv: c.iv,
          liquidityWarnings: c.liquidity_warnings,
          isLiquid: c.is_liquid,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process options chain for ${symbol}`, errorMessage);

      // Log failed Quant Engine call (Requirement 18.6)
      await this.auditLogService.logQuantCall('process_options_chain', symbol, false, errorMessage);

      throw new Error(`Options chain processing failed: ${errorMessage}`);
    }
  }

  /**
   * Analyze options chain for PCR, ATM strikes, OI analysis, and support/resistance
   *
   * Calls POST /quant/options/analyze endpoint which provides:
   * - PCR (Put-Call Ratio) calculation from OI and volume
   * - ATM strike identification and near ATM strikes
   * - OI buildup/unwinding analysis (long buildup, short buildup, etc.)
   * - Support zones from high put OI
   * - Resistance zones from high call OI
   *
   * Requirements: 7.1, 8.1, 18.2
   *
   * @param symbol Underlying symbol (NIFTY or BANKNIFTY)
   * @param spotPrice Current spot price of underlying
   * @param contracts Array of option contracts with strike, type, LTP, OI, change in OI, volume
   * @returns Options chain analysis with PCR, ATM, OI analysis, support/resistance
   */
  async analyzeOptionsChain(
    symbol: string,
    spotPrice: number,
    contracts: Array<{
      strikePrice: number;
      optionType: 'CALL' | 'PUT';
      ltp: number;
      openInterest: number;
      changeInOI: number;
      volume: number;
    }>
  ): Promise<{
    symbol: string;
    spotPrice: number;
    timestamp: Date;
    pcrAnalysis: {
      pcrByOI: number;
      pcrByVolume: number;
      sentiment: string;
      totalCallOI: number;
      totalPutOI: number;
      totalCallVolume: number;
      totalPutVolume: number;
    };
    atmAnalysis: {
      atmStrike: number;
      strikeInterval: number;
      nearATMStrikes: Array<{
        strike: number;
        distanceFromSpot: number;
        callOI: number;
        putOI: number;
        callVolume: number;
        putVolume: number;
      }>;
    };
    oiAnalysis: {
      buildupType: 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'LONG_UNWINDING' | 'SHORT_UNWINDING' | 'NEUTRAL';
      explanation: string;
      supportLevels: Array<{
        strike: number;
        strength: number;
        reason: string;
      }>;
      resistanceLevels: Array<{
        strike: number;
        strength: number;
        reason: string;
      }>;
      maxCallOIStrike: number;
      maxPutOIStrike: number;
      oiChangeAnalysis: Array<{
        strike: number;
        callOIChange: number;
        putOIChange: number;
        interpretation: string;
      }>;
    };
  }> {
    this.logger.debug(
      `Analyzing options chain for ${symbol}: ${contracts.length} contracts, spot=${spotPrice}`
    );

    try {
      const response = await this.httpClient.post('/quant/options/analyze', {
        symbol,
        spot_price: spotPrice,
        contracts: contracts.map((c) => ({
          strike_price: c.strikePrice,
          option_type: c.optionType,
          ltp: c.ltp,
          open_interest: c.openInterest,
          change_in_oi: c.changeInOI,
          volume: c.volume,
        })),
      });

      this.logger.debug(
        `Received options chain analysis for ${symbol}: ` +
          `PCR=${response.data.pcr_analysis.pcr_by_oi.toFixed(2)}, ` +
          `ATM=${response.data.atm_analysis.atm_strike}, ` +
          `Buildup=${response.data.oi_analysis.buildup_type}`
      );

      // Log successful Quant Engine call (Requirement 18.2)
      await this.auditLogService.logQuantCall('analyze_options_chain', symbol, true, undefined, {
        spotPrice,
        totalContracts: contracts.length,
        pcrByOI: response.data.pcr_analysis.pcr_by_oi,
        atmStrike: response.data.atm_analysis.atm_strike,
        buildupType: response.data.oi_analysis.buildup_type,
      });

      return {
        symbol: response.data.symbol,
        spotPrice: response.data.spot_price,
        timestamp: new Date(response.data.timestamp),
        pcrAnalysis: {
          pcrByOI: response.data.pcr_analysis.pcr_by_oi,
          pcrByVolume: response.data.pcr_analysis.pcr_by_volume,
          sentiment: response.data.pcr_analysis.sentiment,
          totalCallOI: response.data.pcr_analysis.total_call_oi,
          totalPutOI: response.data.pcr_analysis.total_put_oi,
          totalCallVolume: response.data.pcr_analysis.total_call_volume,
          totalPutVolume: response.data.pcr_analysis.total_put_volume,
        },
        atmAnalysis: {
          atmStrike: response.data.atm_analysis.atm_strike,
          strikeInterval: response.data.atm_analysis.strike_interval,
          nearATMStrikes: response.data.atm_analysis.near_atm_strikes.map((strike: any) => ({
            strike: strike.strike,
            distanceFromSpot: strike.distance_from_spot,
            callOI: strike.call_oi,
            putOI: strike.put_oi,
            callVolume: strike.call_volume,
            putVolume: strike.put_volume,
          })),
        },
        oiAnalysis: {
          buildupType: response.data.oi_analysis.buildup_type,
          explanation: response.data.oi_analysis.explanation,
          supportLevels: response.data.oi_analysis.support_levels.map((level: any) => ({
            strike: level.strike,
            strength: level.strength,
            reason: level.reason,
          })),
          resistanceLevels: response.data.oi_analysis.resistance_levels.map((level: any) => ({
            strike: level.strike,
            strength: level.strength,
            reason: level.reason,
          })),
          maxCallOIStrike: response.data.oi_analysis.max_call_oi_strike,
          maxPutOIStrike: response.data.oi_analysis.max_put_oi_strike,
          oiChangeAnalysis: response.data.oi_analysis.oi_change_analysis.map((change: any) => ({
            strike: change.strike,
            callOIChange: change.call_oi_change,
            putOIChange: change.put_oi_change,
            interpretation: change.interpretation,
          })),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to analyze options chain for ${symbol}`, errorMessage);

      // Log failed Quant Engine call (Requirement 18.2)
      await this.auditLogService.logQuantCall('analyze_options_chain', symbol, false, errorMessage);

      throw new Error(`Options chain analysis failed: ${errorMessage}`);
    }
  }
}
