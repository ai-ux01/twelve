import { Controller, Post, Body, Logger, UseInterceptors, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OptionsService } from './options.service';
import { OptionsChainRequestDto, OptionsChainDataDto } from './dto/options-chain.dto';
import { OptionsAnalysisRequestDto, OptionsAnalysisResultDto } from './dto/options-analyze.dto';
import { RateLimitLoggerInterceptor } from '../common/interceptors/rate-limit-logger.interceptor';
import { AuditLogService } from '../audit/audit.service';

/**
 * OptionsController - HTTP endpoints for options chain operations
 *
 * Provides REST API endpoints for:
 * - Fetching options chain data with complete analysis
 * - PCR (Put-Call Ratio) analysis
 * - ATM strike identification
 * - OI buildup/unwinding detection
 * - Liquidity filtering and warnings
 *
 * CORE FUNCTIONALITY ONLY:
 * - NO multi-leg strategies
 * - NO auto-trading
 * - Only NIFTY and BANKNIFTY supported
 *
 * RATE LIMITING:
 * - 10 requests per minute per user
 * - Returns 429 status code with Retry-After header when limit exceeded
 * - All rate limit violations are logged
 *
 * Requirements covered: 7.1, 8.1, 18.1, 20.1
 */
@Controller('options')
@UseInterceptors(RateLimitLoggerInterceptor)
@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per 60 seconds (1 minute)
export class OptionsController {
  private readonly logger = new Logger(OptionsController.name);

  constructor(
    private readonly optionsService: OptionsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Health check endpoint for options module
   */
  @Post('health')
  async health() {
    const startTime = Date.now();
    this.logger.log('Options module health check');

    try {
      const result = {
        status: 'ok',
        module: 'options-chain',
        timestamp: new Date().toISOString(),
        supportedSymbols: ['NIFTY', 'BANKNIFTY'],
        features: ['PCR Analysis', 'ATM Identification', 'OI Analysis', 'Liquidity Filtering'],
      };

      // Audit log: health check success
      await this.auditLogService.log({
        service: 'options',
        action: 'health_check',
        success: true,
        result: {
          responseTime: Date.now() - startTime,
          status: result.status,
        },
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Audit log: health check failure
      await this.auditLogService.log({
        service: 'options',
        action: 'health_check',
        success: false,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Fetch options chain with complete analysis
   * POST /options/chain
   *
   * Request body:
   * {
   *   "symbol": "NIFTY" | "BANKNIFTY",
   *   "expiry": "YYYY-MM-DD" (optional)
   * }
   *
   * Response includes:
   * - All option contracts (calls and puts) with Greeks, IV, liquidity warnings
   * - PCR analysis (OI and volume based)
   * - ATM strike identification and near ATM strikes (±3)
   * - OI buildup/unwinding analysis
   * - Support/resistance levels from OI concentrations
   * - Liquidity metrics and illiquid contract warnings
   *
   * Requirements covered: 7.1, 18.1, 18.2, 20.1
   */
  @Post('chain')
  async getOptionsChain(@Body() request: OptionsChainRequestDto): Promise<OptionsChainDataDto> {
    const startTime = Date.now();
    this.logger.log(`Fetching options chain for ${request.symbol}`);

    // Audit log: incoming request
    const auditLogId = await this.auditLogService.log({
      service: 'options',
      action: 'get_options_chain',
      entityType: 'options-chain',
      entityId: request.symbol,
      payload: {
        symbol: request.symbol,
        expiry: request.expiry,
      },
      success: false, // Will update to true if successful
    });

    try {
      // Data flow: Market Data → Quant → Backend
      const optionsChainData = await this.optionsService.getOptionsChain(request);

      const responseTime = Date.now() - startTime;

      this.logger.log(
        `Options chain fetched successfully for ${request.symbol}: ` +
          `${optionsChainData.contracts.length} contracts, ` +
          `PCR=${optionsChainData.pcrAnalysis.pcrByOI.toFixed(2)}, ` +
          `ATM=${optionsChainData.atmAnalysis.atmStrike}, ` +
          `Buildup=${optionsChainData.oiAnalysis.buildupType}, ` +
          `ResponseTime=${responseTime}ms`
      );

      // Audit log: success with data flow tracing
      await this.auditLogService.log({
        service: 'options',
        action: 'get_options_chain',
        entityType: 'options-chain',
        entityId: request.symbol,
        payload: {
          symbol: request.symbol,
          expiry: request.expiry,
        },
        result: {
          symbol: optionsChainData.symbol,
          spotPrice: optionsChainData.spotPrice,
          totalContracts: optionsChainData.contracts.length,
          pcrByOI: optionsChainData.pcrAnalysis.pcrByOI,
          pcrByVolume: optionsChainData.pcrAnalysis.pcrByVolume,
          sentiment: optionsChainData.pcrAnalysis.sentiment,
          atmStrike: optionsChainData.atmAnalysis.atmStrike,
          buildupType: optionsChainData.oiAnalysis.buildupType,
          liquidContracts: optionsChainData.liquidityMetrics.liquidContracts,
          illiquidContracts: optionsChainData.liquidityMetrics.illiquidContracts,
          responseTime,
          dataFlow: 'Market Data → Quant Engine → Backend → Frontend',
        },
        success: true,
      });

      return optionsChainData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseTime = Date.now() - startTime;

      this.logger.error(`Error fetching options chain for ${request.symbol}: ${errorMessage}`);

      // Audit log: failure with error details
      await this.auditLogService.log({
        service: 'options',
        action: 'get_options_chain',
        entityType: 'options-chain',
        entityId: request.symbol,
        payload: {
          symbol: request.symbol,
          expiry: request.expiry,
        },
        result: {
          responseTime,
          httpStatus: this.getHttpStatusFromError(error),
        },
        success: false,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Helper method to extract HTTP status from error
   */
  private getHttpStatusFromError(error: any): number {
    if (error?.status) {
      return error.status;
    }
    if (error?.response?.status) {
      return error.response.status;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Analyze options chain for PCR, ATM strikes, OI analysis, and support/resistance
   * POST /api/options/analyze
   *
   * Request body:
   * {
   *   "symbol": "NIFTY" | "BANKNIFTY",
   *   "expiry": "YYYY-MM-DD" (optional)
   * }
   *
   * Response includes:
   * - PCR (Put-Call Ratio) analysis from OI and volume
   * - ATM strike identification and near ATM strikes (±3)
   * - OI buildup/unwinding analysis (long buildup, short buildup, long unwinding, short unwinding)
   * - Support zones identified from high put OI
   * - Resistance zones identified from high call OI
   * - Max Call/Put OI strikes
   * - OI change analysis with interpretations
   *
   * Data Flow: Market Data → Quant Engine (/quant/options/analyze) → Backend → Frontend
   *
   * Requirements covered: 7.1, 8.1, 18.2
   */
  @Post('analyze')
  async analyzeOptionsChain(
    @Body() request: OptionsAnalysisRequestDto
  ): Promise<OptionsAnalysisResultDto> {
    const startTime = Date.now();
    this.logger.log(`Analyzing options chain for ${request.symbol}`);

    // Audit log: incoming request (Requirement 18.2)
    await this.auditLogService.log({
      service: 'options',
      action: 'analyze_options_chain',
      entityType: 'options-analysis',
      entityId: request.symbol,
      payload: {
        symbol: request.symbol,
        expiry: request.expiry,
      },
      success: false, // Will update to true if successful
    });

    try {
      // Step 1: Fetch options chain via MarketDataService
      const optionsChainData = await this.optionsService.getOptionsChain({
        symbol: request.symbol,
        expiry: request.expiry,
      });

      this.logger.debug(
        `Fetched options chain for ${request.symbol}: ${optionsChainData.contracts.length} contracts, spot=${optionsChainData.spotPrice}`
      );

      // Step 2: Prepare contracts for Quant Engine analysis
      // We need to group contracts by strike to get both call and put data
      const contractsByStrike = new Map<number, { call?: any; put?: any }>();

      for (const contract of optionsChainData.contracts) {
        if (!contractsByStrike.has(contract.strikePrice)) {
          contractsByStrike.set(contract.strikePrice, {});
        }
        const strikeData = contractsByStrike.get(contract.strikePrice)!;
        
        if (contract.optionType === 'CALL') {
          strikeData.call = contract;
        } else {
          strikeData.put = contract;
        }
      }

      // Step 3: Call Quant Engine for analysis (via QuantService)
      // The QuantService method will handle the /quant/options/analyze call
      const analysisResult = await this.optionsService.analyzeOptionsChainData(
        request.symbol,
        optionsChainData.spotPrice,
        optionsChainData.contracts
      );

      const responseTime = Date.now() - startTime;

      this.logger.log(
        `Options chain analysis complete for ${request.symbol}: ` +
          `PCR=${analysisResult.pcrAnalysis.pcrByOI.toFixed(2)}, ` +
          `Sentiment=${analysisResult.pcrAnalysis.sentiment}, ` +
          `ATM=${analysisResult.atmAnalysis.atmStrike}, ` +
          `Buildup=${analysisResult.oiAnalysis.buildupType}, ` +
          `Support Levels=${analysisResult.oiAnalysis.supportLevels.length}, ` +
          `Resistance Levels=${analysisResult.oiAnalysis.resistanceLevels.length}, ` +
          `ResponseTime=${responseTime}ms`
      );

      // Audit log: success with complete data flow tracing (Requirement 18.2)
      await this.auditLogService.log({
        service: 'options',
        action: 'analyze_options_chain',
        entityType: 'options-analysis',
        entityId: request.symbol,
        payload: {
          symbol: request.symbol,
          expiry: request.expiry,
        },
        result: {
          symbol: analysisResult.symbol,
          spotPrice: analysisResult.spotPrice,
          pcrByOI: analysisResult.pcrAnalysis.pcrByOI,
          pcrByVolume: analysisResult.pcrAnalysis.pcrByVolume,
          sentiment: analysisResult.pcrAnalysis.sentiment,
          atmStrike: analysisResult.atmAnalysis.atmStrike,
          buildupType: analysisResult.oiAnalysis.buildupType,
          maxCallOIStrike: analysisResult.oiAnalysis.maxCallOIStrike,
          maxPutOIStrike: analysisResult.oiAnalysis.maxPutOIStrike,
          supportLevelsCount: analysisResult.oiAnalysis.supportLevels.length,
          resistanceLevelsCount: analysisResult.oiAnalysis.resistanceLevels.length,
          responseTime,
          dataFlow: 'Market Data → Quant Engine (/quant/options/analyze) → Backend → Frontend',
        },
        success: true,
      });

      return analysisResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseTime = Date.now() - startTime;

      this.logger.error(`Error analyzing options chain for ${request.symbol}: ${errorMessage}`);

      // Audit log: failure with error details (Requirement 18.2)
      await this.auditLogService.log({
        service: 'options',
        action: 'analyze_options_chain',
        entityType: 'options-analysis',
        entityId: request.symbol,
        payload: {
          symbol: request.symbol,
          expiry: request.expiry,
        },
        result: {
          responseTime,
          httpStatus: this.getHttpStatusFromError(error),
        },
        success: false,
        error: errorMessage,
      });

      throw error;
    }
  }
}
