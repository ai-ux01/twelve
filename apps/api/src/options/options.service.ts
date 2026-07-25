import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import {
  OptionsChainRequestDto,
  OptionsChainDataDto,
  OptionContractDto,
  PCRAnalysisDto,
  ATMAnalysisDto,
  OIAnalysisDto,
  LiquidityMetricsDto,
} from './dto/options-chain.dto';

/**
 * OptionsService - Business logic orchestration for options chain analysis
 *
 * Orchestrates the flow of data for options analysis:
 * 1. Market data retrieval (via MarketDataService)
 * 2. Options chain processing and validation
 * 3. Greeks calculation (via QuantService)
 * 4. PCR, ATM, OI, and liquidity analysis
 *
 * CORE FUNCTIONALITY ONLY:
 * - Options chain data retrieval and analysis
 * - PCR calculation and sentiment analysis
 * - ATM strike identification
 * - OI buildup/unwinding detection
 * - Liquidity filtering and warnings
 *
 * NO multi-leg strategies, NO auto-trading
 * Only NIFTY and BANKNIFTY supported
 *
 * Requirements covered: 7.1, 18.1
 * - 7.1: Options scalping analysis for NIFTY/BANKNIFTY
 * - 18.1: Enforces data flow: Market Data → Analysis (NO direct AI access)
 */
@Injectable()
export class OptionsService {
  private readonly logger = new Logger(OptionsService.name);

  // Supported symbols for options
  private readonly SUPPORTED_SYMBOLS = ['NIFTY', 'BANKNIFTY'];

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly quantService: QuantService,
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.logger.log('OptionsService initialized with dependencies');
  }

  /**
   * Get options chain data with complete analysis
   *
   * Flow:
   * 1. Validate symbol (NIFTY or BANKNIFTY only)
   * 2. Fetch options chain from Market Data Provider
   * 3. Calculate Greeks for all contracts (via Quant Engine)
   * 4. Perform PCR analysis
   * 5. Identify ATM strike and near ATM strikes
   * 6. Analyze OI buildup/unwinding patterns
   * 7. Calculate liquidity metrics and warnings
   * 8. Return complete options chain data
   *
   * Requirements covered: 7.1, 18.1
   *
   * @param request - Options chain request with symbol and optional expiry
   * @returns Complete options chain data with analysis
   */
  async getOptionsChain(request: OptionsChainRequestDto): Promise<OptionsChainDataDto> {
    const startTime = Date.now();
    this.logger.log(`Fetching options chain for ${request.symbol}`);

    // Step 1: Validate symbol
    this.validateSymbol(request.symbol);

    try {
      // Step 2: Fetch options chain from Market Data Provider
      this.logger.debug(`Fetching options chain for ${request.symbol} from market data service`);
      const marketDataStartTime = Date.now();

      const optionsChainData = await this.marketDataService.getOptionsChain(
        request.symbol as 'NIFTY' | 'BANKNIFTY',
        request.expiry
      );

      const marketDataTime = Date.now() - marketDataStartTime;

      // Audit log: Market Data call
      await this.auditLogService.log({
        service: 'market-data',
        action: 'get_options_chain',
        entityType: 'options-chain',
        entityId: request.symbol,
        payload: {
          symbol: request.symbol,
          expiry: request.expiry,
        },
        result: {
          spotPrice: optionsChainData.spotPrice,
          strikes: optionsChainData.chain.length,
          responseTime: marketDataTime,
        },
        success: true,
      });

      this.logger.debug(
        `Retrieved options chain: ${optionsChainData.chain.length} strikes, spot: ${optionsChainData.spotPrice}`
      );

      // Step 3: Prepare contracts for Quant Engine
      const contractsForQuant = [];

      for (const chainData of optionsChainData.chain) {
        // Add CALL contract
        contractsForQuant.push({
          strikePrice: chainData.strike,
          optionType: 'CALL' as const,
          volatility: 0.15, // Default IV - will be improved with real IV calculation
          ltp: chainData.callLTP,
          openInterest: chainData.callOI,
          volume: chainData.callVolume,
          bid: chainData.callLTP * 0.99,
          ask: chainData.callLTP * 1.01,
        });

        // Add PUT contract
        contractsForQuant.push({
          strikePrice: chainData.strike,
          optionType: 'PUT' as const,
          volatility: 0.15, // Default IV - will be improved with real IV calculation
          ltp: chainData.putLTP,
          openInterest: chainData.putOI,
          volume: chainData.putVolume,
          bid: chainData.putLTP * 0.99,
          ask: chainData.putLTP * 1.01,
        });
      }

      this.logger.debug(`Prepared ${contractsForQuant.length} contracts for Quant Engine`);

      // Step 4: Call Quant Engine for Greeks calculation and liquidity filtering
      const expiryDate =
        optionsChainData.chain[0]?.expiryDate || optionsChainData.expiryDates[0] || '';

      this.logger.debug(
        `Calling Quant Engine for Greeks and liquidity analysis (expiry: ${expiryDate})`
      );
      const quantStartTime = Date.now();

      const quantResult = await this.quantService.processOptionsChain(
        request.symbol,
        new Date(expiryDate),
        optionsChainData.spotPrice,
        contractsForQuant
      );

      const quantTime = Date.now() - quantStartTime;

      // Audit log: Quant Engine call
      await this.auditLogService.log({
        service: 'quant',
        action: 'process_options_chain',
        entityType: 'options-analysis',
        entityId: request.symbol,
        payload: {
          symbol: request.symbol,
          expiry: expiryDate,
          spotPrice: optionsChainData.spotPrice,
          totalContracts: contractsForQuant.length,
        },
        result: {
          totalContracts: quantResult.totalContracts,
          liquidContracts: quantResult.liquidContracts,
          illiquidContracts: quantResult.illiquidContracts,
          responseTime: quantTime,
        },
        success: true,
      });

      this.logger.debug(
        `Quant Engine processed ${quantResult.totalContracts} contracts: ` +
          `${quantResult.liquidContracts} liquid, ${quantResult.illiquidContracts} illiquid`
      );

      // Step 5: Transform Quant Engine results to OptionContract DTOs
      const contracts: OptionContractDto[] = quantResult.contracts.map((c) => ({
        symbol: request.symbol,
        strikePrice: c.strikePrice,
        optionType: c.optionType,
        expiryDate,
        ltp: c.ltp,
        bid: c.bid || c.ltp * 0.99,
        ask: c.ask || c.ltp * 1.01,
        openInterest: c.openInterest,
        changeInOI: 0, // Will be calculated from historical data in future
        volume: c.volume,
        impliedVolatility: c.iv,
        delta: c.greeks.delta,
        gamma: c.greeks.gamma,
        theta: c.greeks.theta,
        vega: c.greeks.vega,
        bidAskSpread: c.bid && c.ask ? c.ask - c.bid : undefined,
        bidAskSpreadPercent:
          c.bid && c.ask && c.bid > 0 ? ((c.ask - c.bid) / c.bid) * 100 : undefined,
        liquidityWarning: c.liquidityWarnings.includes('NONE')
          ? undefined
          : {
              wideBidAskSpread: c.liquidityWarnings.includes('WIDE_SPREAD'),
              lowVolume: c.liquidityWarnings.includes('LOW_VOLUME'),
              lowOI: c.liquidityWarnings.includes('LOW_OI'),
              deepOTM: false, // Will be calculated below
            },
      }));

      this.logger.debug(`Transformed ${contracts.length} contracts with Greeks`);

      // Step 6: Perform PCR analysis
      const pcrAnalysis = this.calculatePCRAnalysis(contracts);
      this.logger.debug(
        `PCR Analysis: OI=${pcrAnalysis.pcrByOI.toFixed(2)}, Volume=${pcrAnalysis.pcrByVolume.toFixed(2)}, Sentiment=${pcrAnalysis.sentiment}`
      );

      // Step 7: Identify ATM strike and near ATM strikes
      const atmAnalysis = this.calculateATMAnalysis(
        optionsChainData.spotPrice,
        optionsChainData.chain
      );
      this.logger.debug(
        `ATM Analysis: Spot=${atmAnalysis.spotPrice}, ATM Strike=${atmAnalysis.atmStrike}`
      );

      // Step 8: Analyze OI buildup/unwinding patterns
      const oiAnalysis = this.calculateOIAnalysis(contracts, optionsChainData.spotPrice);
      this.logger.debug(
        `OI Analysis: Buildup Type=${oiAnalysis.buildupType}, Max Call OI=${oiAnalysis.maxCallOIStrike}, Max Put OI=${oiAnalysis.maxPutOIStrike}`
      );

      // Step 9: Calculate liquidity metrics
      const liquidityMetrics: LiquidityMetricsDto = {
        totalContracts: quantResult.totalContracts,
        liquidContracts: quantResult.liquidContracts,
        illiquidContracts: quantResult.illiquidContracts,
        averageVolume:
          contracts.reduce((sum, c) => sum + c.volume, 0) / (contracts.length || 1),
        averageOI:
          contracts.reduce((sum, c) => sum + c.openInterest, 0) / (contracts.length || 1),
        averageBidAskSpread:
          contracts
            .filter((c) => c.bidAskSpreadPercent !== undefined)
            .reduce((sum, c) => sum + (c.bidAskSpreadPercent || 0), 0) /
          (contracts.filter((c) => c.bidAskSpreadPercent !== undefined).length || 1),
      };

      this.logger.debug(
        `Liquidity Metrics: ${liquidityMetrics.liquidContracts}/${liquidityMetrics.totalContracts} liquid contracts`
      );

      // Step 10: Return complete options chain data
      const result: OptionsChainDataDto = {
        symbol: request.symbol,
        expiryDate,
        spotPrice: optionsChainData.spotPrice,
        timestamp: new Date(),
        contracts,
        pcrAnalysis,
        atmAnalysis,
        oiAnalysis,
        liquidityMetrics,
      };

      const totalTime = Date.now() - startTime;

      this.logger.log(
        `Options chain analysis complete for ${request.symbol}: ` +
          `${contracts.length} contracts, PCR=${pcrAnalysis.pcrByOI.toFixed(2)}, ` +
          `ATM=${atmAnalysis.atmStrike}, Buildup=${oiAnalysis.buildupType}, ` +
          `TotalTime=${totalTime}ms (MarketData=${marketDataTime}ms, Quant=${quantTime}ms)`
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error fetching options chain for ${request.symbol}: ${errorMessage}`);

      // Audit log: failure
      await this.auditLogService.log({
        service: 'options',
        action: 'get_options_chain_service',
        entityType: 'options-chain',
        entityId: request.symbol,
        payload: {
          symbol: request.symbol,
          expiry: request.expiry,
        },
        success: false,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Validate that the symbol is NIFTY or BANKNIFTY only
   *
   * Requirements: 7.1, 18.1 - Only NIFTY/BANKNIFTY supported
   */
  private validateSymbol(symbol: string): void {
    if (!this.SUPPORTED_SYMBOLS.includes(symbol.toUpperCase())) {
      throw new BadRequestException(
        `Invalid symbol: ${symbol}. Only NIFTY and BANKNIFTY are supported for options analysis.`
      );
    }
  }

  /**
   * Calculate PCR (Put-Call Ratio) from OI and Volume
   *
   * PCR > 1.0 = Bearish (more puts than calls)
   * PCR < 1.0 = Bullish (more calls than puts)
   * PCR ≈ 1.0 = Neutral
   *
   * Requirements: 7.1
   */
  private calculatePCRAnalysis(contracts: OptionContractDto[]): PCRAnalysisDto {
    let totalCallOI = 0;
    let totalPutOI = 0;
    let totalCallVolume = 0;
    let totalPutVolume = 0;

    for (const contract of contracts) {
      if (contract.optionType === 'CALL') {
        totalCallOI += contract.openInterest;
        totalCallVolume += contract.volume;
      } else {
        totalPutOI += contract.openInterest;
        totalPutVolume += contract.volume;
      }
    }

    const pcrByOI = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
    const pcrByVolume = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;

    // Determine sentiment based on PCR by OI
    let sentiment: string;
    if (pcrByOI > 1.2) {
      sentiment = 'BEARISH';
    } else if (pcrByOI < 0.8) {
      sentiment = 'BULLISH';
    } else {
      sentiment = 'NEUTRAL';
    }

    return {
      pcrByOI,
      pcrByVolume,
      sentiment,
      totalCallOI,
      totalPutOI,
      totalCallVolume,
      totalPutVolume,
    };
  }

  /**
   * Identify ATM strike (closest to spot) and near ATM strikes (±3 strikes)
   *
   * Requirements: 7.1
   */
  private calculateATMAnalysis(spotPrice: number, chainData: any[]): ATMAnalysisDto {
    // Find ATM strike (closest to spot price)
    let atmStrike = 0;
    let minDistance = Infinity;

    for (const data of chainData) {
      const distance = Math.abs(data.strike - spotPrice);
      if (distance < minDistance) {
        minDistance = distance;
        atmStrike = data.strike;
      }
    }

    // Determine strike interval (difference between consecutive strikes)
    const strikeInterval = chainData.length > 1 ? chainData[1].strike - chainData[0].strike : 50;

    // Find near ATM strikes (±3 strikes from ATM)
    const nearATMStrikes = chainData
      .filter((data) => {
        const strikeDistance = Math.abs(data.strike - atmStrike);
        return strikeDistance <= 3 * strikeInterval;
      })
      .map((data) => ({
        strike: data.strike,
        distanceFromSpot: ((data.strike - spotPrice) / spotPrice) * 100,
        callOI: data.callOI || 0,
        putOI: data.putOI || 0,
        callVolume: data.callVolume || 0,
        putVolume: data.putVolume || 0,
      }))
      .sort((a, b) => a.strike - b.strike);

    return {
      spotPrice,
      atmStrike,
      strikeInterval,
      nearATMStrikes,
    };
  }

  /**
   * Analyze OI buildup/unwinding patterns
   *
   * Patterns:
   * - Long Buildup: Price up + OI up (bullish)
   * - Short Buildup: Price down + OI up (bearish)
   * - Long Unwinding: Price down + OI down (bearish)
   * - Short Unwinding: Price up + OI down (bullish)
   *
   * Also identifies support/resistance from high OI concentrations
   *
   * Requirements: 7.1
   */
  private calculateOIAnalysis(contracts: OptionContractDto[], spotPrice: number): OIAnalysisDto {
    // Find max OI strikes for calls and puts
    const callContracts = contracts.filter((c) => c.optionType === 'CALL');
    const putContracts = contracts.filter((c) => c.optionType === 'PUT');

    const maxCallOI = Math.max(...callContracts.map((c) => c.openInterest));
    const maxPutOI = Math.max(...putContracts.map((c) => c.openInterest));

    const maxCallOIStrike =
      callContracts.find((c) => c.openInterest === maxCallOI)?.strikePrice || 0;
    const maxPutOIStrike = putContracts.find((c) => c.openInterest === maxPutOI)?.strikePrice || 0;

    // Calculate net OI change (total call OI change vs put OI change)
    const totalCallOIChange = callContracts.reduce((sum, c) => sum + c.changeInOI, 0);
    const totalPutOIChange = putContracts.reduce((sum, c) => sum + c.changeInOI, 0);

    // Determine buildup type based on OI changes
    // Note: We need price change data to fully determine buildup type
    // For now, we'll use OI change patterns as proxy
    let buildupType:
      'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'LONG_UNWINDING' | 'SHORT_UNWINDING' | 'NEUTRAL';
    let explanation: string;

    if (totalCallOIChange > 0 && totalPutOIChange > 0) {
      if (totalCallOIChange > totalPutOIChange) {
        buildupType = 'LONG_BUILDUP';
        explanation = 'Increasing call OI > put OI suggests bullish positioning';
      } else {
        buildupType = 'SHORT_BUILDUP';
        explanation = 'Increasing put OI > call OI suggests bearish positioning';
      }
    } else if (totalCallOIChange < 0 && totalPutOIChange < 0) {
      if (Math.abs(totalCallOIChange) > Math.abs(totalPutOIChange)) {
        buildupType = 'SHORT_UNWINDING';
        explanation = 'Decreasing call OI > put OI suggests short covering (bullish)';
      } else {
        buildupType = 'LONG_UNWINDING';
        explanation = 'Decreasing put OI > call OI suggests long unwinding (bearish)';
      }
    } else {
      buildupType = 'NEUTRAL';
      explanation = 'Mixed OI changes, no clear directional bias';
    }

    // Identify support levels (high put OI below spot)
    const supportLevels = putContracts
      .filter((c) => c.strikePrice < spotPrice)
      .filter((c) => c.openInterest > maxPutOI * 0.5) // At least 50% of max OI
      .sort((a, b) => b.openInterest - a.openInterest)
      .slice(0, 3) // Top 3 support levels
      .map((c) => ({
        strike: c.strikePrice,
        strength: c.openInterest / maxPutOI,
        reason: `High put OI (${c.openInterest.toLocaleString()}) suggests support`,
      }));

    // Identify resistance levels (high call OI above spot)
    const resistanceLevels = callContracts
      .filter((c) => c.strikePrice > spotPrice)
      .filter((c) => c.openInterest > maxCallOI * 0.5) // At least 50% of max OI
      .sort((a, b) => b.openInterest - a.openInterest)
      .slice(0, 3) // Top 3 resistance levels
      .map((c) => ({
        strike: c.strikePrice,
        strength: c.openInterest / maxCallOI,
        reason: `High call OI (${c.openInterest.toLocaleString()}) suggests resistance`,
      }));

    // Analyze significant OI changes by strike
    const significantOIChanges = contracts
      .filter((c) => Math.abs(c.changeInOI) > 1000) // Significant OI change threshold
      .sort((a, b) => Math.abs(b.changeInOI) - Math.abs(a.changeInOI))
      .slice(0, 5) // Top 5 OI changes
      .map((c) => {
        let interpretation: string;
        if (c.changeInOI > 0) {
          interpretation =
            c.optionType === 'CALL'
              ? 'Call writing/buying - potential resistance or bullish positioning'
              : 'Put writing/buying - potential support or bearish positioning';
        } else {
          interpretation =
            c.optionType === 'CALL'
              ? 'Call unwinding - resistance weakening or position squaring'
              : 'Put unwinding - support weakening or position squaring';
        }

        return {
          strike: c.strikePrice,
          callOIChange: c.optionType === 'CALL' ? c.changeInOI : 0,
          putOIChange: c.optionType === 'PUT' ? c.changeInOI : 0,
          interpretation,
        };
      });

    return {
      buildupType,
      explanation,
      supportLevels,
      resistanceLevels,
      maxCallOIStrike,
      maxPutOIStrike,
      oiChangeAnalysis: significantOIChanges,
    };
  }

  /**
   * Analyze options chain data for PCR, ATM, OI analysis, and support/resistance
   *
   * This method orchestrates calling the Quant Engine for comprehensive options analysis.
   * It transforms the options chain contracts into the format needed by Quant Engine
   * and returns structured analysis results.
   *
   * Flow:
   * 1. Receive options contracts with OI, volume, and price data
   * 2. Call QuantService.analyzeOptionsChain (which calls /quant/options/analyze)
   * 3. Transform Quant Engine response to DTO format
   * 4. Return analysis with PCR, ATM, OI buildup, support/resistance
   *
   * Requirements: 7.1, 8.1, 18.2
   *
   * @param symbol - Underlying symbol (NIFTY or BANKNIFTY)
   * @param spotPrice - Current spot price
   * @param contracts - Options contracts with strike, type, LTP, OI, volume
   * @returns Complete options chain analysis
   */
  async analyzeOptionsChainData(
    symbol: string,
    spotPrice: number,
    contracts: OptionContractDto[]
  ): Promise<{
    symbol: string;
    expiryDate: string;
    spotPrice: number;
    timestamp: Date;
    pcrAnalysis: PCRAnalysisDto;
    atmAnalysis: ATMAnalysisDto;
    oiAnalysis: OIAnalysisDto;
  }> {
    this.logger.log(`Analyzing options chain data for ${symbol} with ${contracts.length} contracts`);

    // Transform contracts to Quant Engine format
    const quantContracts = contracts.map((c) => ({
      strikePrice: c.strikePrice,
      optionType: c.optionType,
      ltp: c.ltp,
      openInterest: c.openInterest,
      changeInOI: c.changeInOI,
      volume: c.volume,
    }));

    this.logger.debug(
      `Calling Quant Engine to analyze ${quantContracts.length} contracts for ${symbol}`
    );

    // Call Quant Engine for analysis
    const quantResult = await this.quantService.analyzeOptionsChain(
      symbol,
      spotPrice,
      quantContracts
    );

    this.logger.debug(
      `Quant Engine analysis complete: PCR=${quantResult.pcrAnalysis.pcrByOI.toFixed(2)}, ` +
        `ATM=${quantResult.atmAnalysis.atmStrike}, Buildup=${quantResult.oiAnalysis.buildupType}`
    );

    // Extract expiry date from contracts (all should have same expiry)
    const expiryDate = contracts[0]?.expiryDate || '';

    // Return structured analysis result
    return {
      symbol: quantResult.symbol,
      expiryDate,
      spotPrice: quantResult.spotPrice,
      timestamp: quantResult.timestamp,
      pcrAnalysis: {
        pcrByOI: quantResult.pcrAnalysis.pcrByOI,
        pcrByVolume: quantResult.pcrAnalysis.pcrByVolume,
        sentiment: quantResult.pcrAnalysis.sentiment,
        totalCallOI: quantResult.pcrAnalysis.totalCallOI,
        totalPutOI: quantResult.pcrAnalysis.totalPutOI,
        totalCallVolume: quantResult.pcrAnalysis.totalCallVolume,
        totalPutVolume: quantResult.pcrAnalysis.totalPutVolume,
      },
      atmAnalysis: {
        spotPrice: quantResult.spotPrice,
        atmStrike: quantResult.atmAnalysis.atmStrike,
        strikeInterval: quantResult.atmAnalysis.strikeInterval,
        nearATMStrikes: quantResult.atmAnalysis.nearATMStrikes.map((strike) => ({
          strike: strike.strike,
          distanceFromSpot: strike.distanceFromSpot,
          callOI: strike.callOI,
          putOI: strike.putOI,
          callVolume: strike.callVolume,
          putVolume: strike.putVolume,
        })),
      },
      oiAnalysis: {
        buildupType: quantResult.oiAnalysis.buildupType,
        explanation: quantResult.oiAnalysis.explanation,
        supportLevels: quantResult.oiAnalysis.supportLevels.map((level) => ({
          strike: level.strike,
          strength: level.strength,
          reason: level.reason,
        })),
        resistanceLevels: quantResult.oiAnalysis.resistanceLevels.map((level) => ({
          strike: level.strike,
          strength: level.strength,
          reason: level.reason,
        })),
        maxCallOIStrike: quantResult.oiAnalysis.maxCallOIStrike,
        maxPutOIStrike: quantResult.oiAnalysis.maxPutOIStrike,
        oiChangeAnalysis: quantResult.oiAnalysis.oiChangeAnalysis.map((change) => ({
          strike: change.strike,
          callOIChange: change.callOIChange,
          putOIChange: change.putOIChange,
          interpretation: change.interpretation,
        })),
      },
    };
  }
}
