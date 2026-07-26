import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PaperTradingService } from './paper-trading.service';
import { CreatePaperTradeDto } from './dto/create-paper-trade.dto';
import { ClosePaperTradeDto } from './dto/close-paper-trade.dto';
import { PaperTradeFiltersDto } from './dto/paper-trade-filters.dto';

/**
 * PaperTradingController - REST API for Paper Trading System (Phase 11)
 *
 * Provides endpoints for creating, listing, updating, closing, and cancelling paper trades.
 * Also proxies metrics requests to the quant engine performance calculator.
 */
@Controller('paper-trades')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PaperTradingController {
  private readonly logger = new Logger(PaperTradingController.name);

  constructor(private readonly paperTradingService: PaperTradingService) {}

  /**
   * POST /api/paper-trades — Create a new paper trade
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPaperTrade(@Body() dto: CreatePaperTradeDto) {
    this.logger.log(`Creating paper trade: ${dto.direction} ${dto.symbol} (${dto.tradeType})`);
    return this.paperTradingService.createPaperTrade(dto);
  }

  /**
   * GET /api/paper-trades — List trades with pagination and filters
   */
  @Get()
  async listPaperTrades(@Query() filters: PaperTradeFiltersDto) {
    // userId would normally come from auth context; for now accept as query param
    const userId = (filters as any).userId;
    if (!userId) {
      return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }
    return this.paperTradingService.getTradesForUser(userId, filters);
  }

  /**
   * GET /api/paper-trades/metrics — Proxy to quant engine performance calculator
   */
  @Get('metrics')
  async getMetrics(@Query('userId') userId: string, @Query('tradeType') tradeType?: string) {
    this.logger.log(`Fetching metrics for user ${userId}, tradeType=${tradeType || 'all'}`);
    // Proxy to quant engine - in production this would call the quant service
    // For now return a placeholder structure that the quant engine will fill
    try {
      const baseUrl = process.env.QUANT_ENGINE_URL || 'http://localhost:8000';
      const params = new URLSearchParams();
      if (userId) params.append('user_id', userId);
      if (tradeType) params.append('trade_type', tradeType);

      const response = await fetch(`${baseUrl}/api/paper-trading/metrics?${params.toString()}`);
      if (response.ok) {
        return response.json();
      }
      return {
        winRate: 0,
        profitFactor: 0,
        totalPnL: 0,
        expectancy: 0,
        averageR: 0,
        maxDrawdown: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
      };
    } catch {
      // If quant engine is not available, return zeros
      return {
        winRate: 0,
        profitFactor: 0,
        totalPnL: 0,
        expectancy: 0,
        averageR: 0,
        maxDrawdown: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
      };
    }
  }

  /**
   * PATCH /api/paper-trades/:id — Update current price (for trade monitor)
   */
  @Patch(':id')
  async updateTradePrice(@Param('id') id: string, @Body('currentPrice') currentPrice: number) {
    this.logger.log(`Updating trade ${id} price to ${currentPrice}`);
    return this.paperTradingService.updateTradePrice(id, currentPrice);
  }

  /**
   * PATCH /api/paper-trades/:id/close — Close a trade
   */
  @Patch(':id/close')
  async closePaperTrade(@Param('id') id: string, @Body() dto: ClosePaperTradeDto) {
    this.logger.log(`Closing trade ${id} with reason ${dto.exitReason}`);
    return this.paperTradingService.closePaperTradeV2(id, dto);
  }

  /**
   * PATCH /api/paper-trades/:id/cancel — Cancel an open trade
   */
  @Patch(':id/cancel')
  async cancelPaperTrade(@Param('id') id: string) {
    this.logger.log(`Cancelling trade ${id}`);
    return this.paperTradingService.cancelPaperTrade(id);
  }
}
