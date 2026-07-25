import { Controller, Get, Post, Put, Delete, Param, Body, Query, Logger } from '@nestjs/common';
import { SwingService } from './swing.service';
import { ScoringWeightsService } from './scoring-weights.service';
import { AddStockDto, UpdateStockDto, FilterStockUniverseDto } from './dto/stock-universe.dto';
import { ScoringWeightsDto } from './dto/scoring-weights.dto';
import { ScanSwingUniverseDto, ScanSwingUniverseResponseDto } from './dto/scan-universe.dto';
import {
  ExecuteSwingPaperTradeDto,
  ExecuteSwingPaperTradeResponseDto,
} from './dto/paper-trade.dto';

/**
 * SwingController - HTTP endpoints for swing trading operations
 *
 * Provides REST API endpoints for:
 * - Scanning stock universe for swing trade opportunities
 * - Deep analysis of specific symbols
 * - Retrieving swing trade recommendations
 * - Managing scoring weights configuration
 *
 * Requirements covered: 5.1, 5.3, 18.1
 */
@Controller('swing')
export class SwingController {
  private readonly logger = new Logger(SwingController.name);

  constructor(
    private readonly swingService: SwingService,
    private readonly scoringWeightsService: ScoringWeightsService
  ) {}

  /**
   * Health check endpoint for swing trading module
   */
  @Get('health')
  async health() {
    this.logger.log('Swing module health check');
    return {
      status: 'ok',
      module: 'swing-trading',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Scan stock universe for swing trading opportunities
   * POST /swing/scan
   *
   * Orchestrates the complete scanning workflow:
   * 1. Fetch active stocks from universe
   * 2. Get market data for each stock (90+ days)
   * 3. Perform technical analysis via Quant Engine
   * 4. Calculate scores using SwingScoringService
   * 5. Filter by minimum score threshold
   * 6. Sort by total score descending
   * 7. Return top N candidates
   *
   * Requirements covered: 5.4
   */
  @Post('scan')
  async scanStockUniverse(
    @Body() scanRequest: ScanSwingUniverseDto
  ): Promise<ScanSwingUniverseResponseDto> {
    this.logger.log('Scanning stock universe for swing trades');
    return this.swingService.scanStockUniverse(scanRequest);
  }

  /**
   * Deep analysis of a specific symbol for swing trading
   * POST /swing/analyze/:symbol
   *
   * Body params:
   * - userId: User ID (optional, for risk validation)
   * - includeAI: Include AI recommendation (optional, default: true)
   *
   * Requirements covered: 5.1, 4.1, 8.1
   */
  @Post('analyze/:symbol')
  async analyzeSymbol(@Param('symbol') symbol: string, @Body() analysisRequest: any) {
    this.logger.log(`Analyzing ${symbol} for swing trading`);
    return this.swingService.analyzeSymbol(symbol, analysisRequest);
  }

  /**
   * Execute paper trade for a swing trading opportunity
   * POST /swing/paper-trade
   *
   * This endpoint allows users to execute paper trades for swing trading opportunities
   * identified by the scan endpoint. It integrates with the existing PaperTradingService
   * to simulate trade execution without risking real capital.
   *
   * Requirements covered: 5.7 (21.7)
   */
  @Post('paper-trade')
  async executePaperTrade(
    @Body() tradeRequest: ExecuteSwingPaperTradeDto
  ): Promise<ExecuteSwingPaperTradeResponseDto> {
    this.logger.log(`Executing paper trade for swing opportunity: ${tradeRequest.symbol}`);
    return this.swingService.executePaperTrade(tradeRequest);
  }

  /**
   * Get all swing trade recommendations
   * GET /swing/recommendations
   *
   * Requirements covered: 5.1
   */
  @Get('recommendations')
  async getRecommendations() {
    this.logger.log('Fetching swing trade recommendations');
    // TODO: Implement recommendations retrieval
    // Will be implemented in subsequent tasks
    return {
      message: 'Swing trading recommendations endpoint ready',
      status: 'not_implemented',
      recommendations: [],
    };
  }

  // ============================================================================
  // STOCK UNIVERSE MANAGEMENT ENDPOINTS
  // ============================================================================

  /**
   * Get all stocks in the universe
   * GET /swing/universe
   *
   * Query params:
   * - sector: Filter by sector
   * - isActive: Filter by active status
   *
   * Requirements covered: 5.1
   */
  @Get('universe')
  async getStockUniverse(@Query() filter: FilterStockUniverseDto) {
    this.logger.log('Fetching stock universe');
    return this.swingService.getStockUniverse(filter);
  }

  /**
   * Get a single stock from the universe
   * GET /swing/universe/:symbol
   *
   * Requirements covered: 5.1
   */
  @Get('universe/:symbol')
  async getStock(@Param('symbol') symbol: string) {
    this.logger.log(`Fetching stock ${symbol} from universe`);
    return this.swingService.getStock(symbol);
  }

  /**
   * Add a stock to the universe
   * POST /swing/universe
   *
   * Requirements covered: 5.1
   */
  @Post('universe')
  async addStock(@Body() addStockDto: AddStockDto) {
    this.logger.log(`Adding stock ${addStockDto.symbol} to universe`);
    return this.swingService.addStock(addStockDto);
  }

  /**
   * Update a stock in the universe
   * PUT /swing/universe/:symbol
   *
   * Requirements covered: 5.1
   */
  @Put('universe/:symbol')
  async updateStock(@Param('symbol') symbol: string, @Body() updateStockDto: UpdateStockDto) {
    this.logger.log(`Updating stock ${symbol} in universe`);
    return this.swingService.updateStock(symbol, updateStockDto);
  }

  /**
   * Remove a stock from the universe
   * DELETE /swing/universe/:symbol
   *
   * Requirements covered: 5.1
   */
  @Delete('universe/:symbol')
  async removeStock(@Param('symbol') symbol: string) {
    this.logger.log(`Removing stock ${symbol} from universe`);
    return this.swingService.removeStock(symbol);
  }

  /**
   * Initialize default NSE F&O stocks universe
   * POST /swing/universe/initialize
   *
   * Requirements covered: 5.1
   */
  @Post('universe/initialize')
  async initializeDefaultUniverse() {
    this.logger.log('Initializing default NSE F&O stocks universe');
    return this.swingService.initializeDefaultUniverse();
  }

  // ============================================================================
  // SCORING WEIGHTS MANAGEMENT ENDPOINTS
  // ============================================================================

  /**
   * Get scoring weights for a user (or default)
   * GET /swing/weights?userId=xxx
   *
   * Query params:
   * - userId: User ID (optional, returns default if not provided)
   *
   * Requirements covered: 5.3 - Load weights from config, fall back to defaults
   */
  @Get('weights')
  async getWeights(@Query('userId') userId?: string) {
    this.logger.log(`Fetching weights for user: ${userId || 'default'}`);
    return this.scoringWeightsService.getWeights(userId);
  }

  /**
   * Get default scoring weights
   * GET /swing/weights/default
   *
   * Requirements covered: 5.3 - Load weights from config, fall back to defaults
   */
  @Get('weights/default')
  async getDefaultWeights() {
    this.logger.log('Fetching default weights');
    return this.scoringWeightsService.getDefaultWeights();
  }

  /**
   * Set or update user-specific scoring weights
   * PUT /swing/weights/:userId
   *
   * Requirements covered: 5.3 - Allow per-user customization of weights
   */
  @Put('weights/:userId')
  async setUserWeights(@Param('userId') userId: string, @Body() weightsDto: ScoringWeightsDto) {
    this.logger.log(`Setting custom weights for user ${userId}`);
    return this.scoringWeightsService.setUserWeights(userId, weightsDto);
  }

  /**
   * Update default scoring weights
   * PUT /swing/weights/default
   *
   * Requirements covered: 5.3 - Allow customization of weights
   */
  @Put('weights/default')
  async setDefaultWeights(@Body() weightsDto: ScoringWeightsDto) {
    this.logger.log('Setting default weights');
    return this.scoringWeightsService.setDefaultWeights(weightsDto);
  }

  /**
   * Delete user-specific weights (revert to default)
   * DELETE /swing/weights/:userId
   *
   * Requirements covered: 5.3 - Allow per-user customization of weights
   */
  @Delete('weights/:userId')
  async deleteUserWeights(@Param('userId') userId: string) {
    this.logger.log(`Deleting custom weights for user ${userId}`);
    return this.scoringWeightsService.deleteUserWeights(userId);
  }

  /**
   * Initialize default weights
   * POST /swing/weights/initialize
   *
   * Requirements covered: 5.3 - Load weights from config, fall back to defaults
   */
  @Post('weights/initialize')
  async initializeDefaultWeights() {
    this.logger.log('Initializing default weights');
    return this.scoringWeightsService.initializeDefaultWeights();
  }
}
