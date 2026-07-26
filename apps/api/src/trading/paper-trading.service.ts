import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  SignalDirection,
  OptionType,
  PaperTradeStatus,
  PaperTradeType,
} from '@prisma/client';
import { RiskService, TradeRequest } from '../risk/risk.service';
import { CreatePaperTradeDto } from './dto/create-paper-trade.dto';
import { ClosePaperTradeDto } from './dto/close-paper-trade.dto';
import { PaperTradeFiltersDto } from './dto/paper-trade-filters.dto';

export interface PaperTradeRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  stopLoss?: number;
  target?: number;
}

export interface PaperOptionTradeRequest {
  symbol: string;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  expiry: Date;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  stopLoss?: number;
  target?: number;
}

export interface PaperTradeResult {
  tradeId: string;
  status: 'EXECUTED' | 'FAILED';
  executedPrice?: number;
  slippage?: number;
  positionId?: string;
  error?: string;
}

/**
 * Task 73.1: Options-specific paper trade request
 *
 * Requirements: 9.1, 7.1
 */
export interface PaperOptionTradeRequest {
  symbol: string; // Underlying symbol (e.g., 'NIFTY', 'BANKNIFTY')
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number; // Premium price
  stopLoss?: number;
  target?: number;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  expiry: Date;
  // For realistic slippage and risk validation
  bidAskSpread?: number;
  openInterest?: number;
  impliedVolatility?: number;
  delta?: number;
}

/**
 * PaperTradingService - Handles simulated trading without broker API calls
 *
 * Requirements covered:
 * - 9.1: Record paper trades in database
 * - 9.2: Simulate trade execution with realistic slippage (0-1% of price)
 * - 9.5: Do NOT call broker API for paper trades
 * - 7.1: Options trading support (Task 73.1)
 */
@Injectable()
export class PaperTradingService {
  private readonly logger = new Logger(PaperTradingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly riskService: RiskService
  ) {}

  /**
   * Execute a paper trade (simulation only)
   *
   * This method:
   * 1. Simulates realistic slippage (0-1% of price)
   * 2. Records trade in PaperTrade table
   * 3. Creates or updates Position entry
   * 4. Does NOT call broker API
   * Task 64.1: Marks trades with intradayFlag for tracking
   *
   * @param userId - User executing the trade
   * @param tradeRequest - Trade details
   * @param signalId - Optional signal that generated this trade
   * @param intradayFlag - Optional flag to mark as intraday position (Task 64.1)
   * @returns Trade execution result with simulated slippage
   */
  async executePaperTrade(
    userId: string,
    tradeRequest: PaperTradeRequest,
    signalId?: string,
    intradayFlag?: boolean
  ): Promise<PaperTradeResult> {
    this.logger.log(
      `Executing paper trade: ${tradeRequest.action} ${tradeRequest.quantity} ${tradeRequest.symbol}${intradayFlag ? ' (INTRADAY)' : ''}`
    );

    try {
      // Simulate realistic slippage (0-1% of price)
      const slippagePercent = Math.random() * 0.01; // 0% to 1%
      const slippage = tradeRequest.price * slippagePercent;

      // Apply slippage in the direction that hurts the trader (realistic simulation)
      // BUY orders get worse (higher) prices, SELL orders get worse (lower) prices
      const executedPrice =
        tradeRequest.action === 'BUY'
          ? tradeRequest.price + slippage
          : tradeRequest.price - slippage;

      const direction: SignalDirection = tradeRequest.action === 'BUY' ? 'LONG' : 'SHORT';

      // Create paper trade in database
      const paperTrade = await this.prisma.paperTrade.create({
        data: {
          userId,
          signalId,
          symbol: tradeRequest.symbol,
          direction,
          quantity: tradeRequest.quantity,
          entryPrice: executedPrice,
          stopLoss: tradeRequest.stopLoss || 0,
          target: tradeRequest.target || 0,
          simulatedSlippage: slippage,
          status: PaperTradeStatus.OPEN,
          currentPrice: executedPrice,
          unrealizedPnL: 0, // Initial PnL is 0 at entry
        },
      });

      // Create trade execution record
      await this.prisma.tradeExecution.create({
        data: {
          paperTradeId: paperTrade.id,
          executionType: 'ENTRY',
          quantity: tradeRequest.quantity,
          price: executedPrice,
          fees: 0, // No fees for paper trading
        },
      });

      // Task 64.1: Create or update Position entry with intradayFlag
      const positionId = await this.createOrUpdatePosition(
        userId,
        paperTrade.id,
        tradeRequest.symbol,
        tradeRequest.quantity,
        executedPrice,
        direction,
        intradayFlag
      );

      this.logger.log(
        `Paper trade executed: ${paperTrade.id}, position: ${positionId}, slippage: ${slippage.toFixed(2)}${intradayFlag ? ' (INTRADAY)' : ''}`
      );

      return {
        tradeId: paperTrade.id,
        status: 'EXECUTED',
        executedPrice,
        slippage,
        positionId,
      };
    } catch (error) {
      this.logger.error('Failed to execute paper trade', error);
      return {
        tradeId: '',
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create or update Position entry for the paper trade
   *
   * If a position for this symbol already exists and is open, update it.
   * Otherwise, create a new position.
   * Task 64.2: Sets intradayFlag on position for intraday tracking
   *
   * @returns Position ID
   */
  private async createOrUpdatePosition(
    userId: string,
    paperTradeId: string,
    symbol: string,
    quantity: number,
    executedPrice: number,
    direction: SignalDirection,
    intradayFlag?: boolean
  ): Promise<string> {
    // Find user's portfolio (create if doesn't exist)
    let portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
    });

    if (!portfolio) {
      // Create portfolio if it doesn't exist
      portfolio = await this.prisma.portfolio.create({
        data: {
          userId,
          totalValue: 0,
          cashBalance: 0,
          investedValue: 0,
          unrealizedPnL: 0,
          realizedPnL: 0,
        },
      });
      this.logger.log(`Created portfolio for user ${userId}`);
    }

    // Check if there's an existing open position for this symbol
    const existingPosition = await this.prisma.position.findFirst({
      where: {
        portfolioId: portfolio.id,
        symbol,
        status: 'OPEN',
      },
    });

    if (existingPosition) {
      // Update existing position (average price calculation)
      const totalQuantity = existingPosition.quantity + quantity;
      const totalCost =
        existingPosition.averagePrice * existingPosition.quantity + executedPrice * quantity;
      const newAveragePrice = totalCost / totalQuantity;

      const updatedPosition = await this.prisma.position.update({
        where: { id: existingPosition.id },
        data: {
          quantity: totalQuantity,
          averagePrice: newAveragePrice,
          currentPrice: executedPrice,
          unrealizedPnL:
            (executedPrice - newAveragePrice) * totalQuantity * (direction === 'LONG' ? 1 : -1),
          paperTradeId, // Link to latest paper trade
          intradayFlag: intradayFlag || existingPosition.intradayFlag, // Task 64.2: Preserve or set intradayFlag
        },
      });

      this.logger.log(
        `Updated position ${updatedPosition.id}: ${totalQuantity} @ ${newAveragePrice.toFixed(2)}`
      );

      return updatedPosition.id;
    } else {
      // Create new position
      const newPosition = await this.prisma.position.create({
        data: {
          portfolioId: portfolio.id,
          symbol,
          quantity,
          averagePrice: executedPrice,
          currentPrice: executedPrice,
          unrealizedPnL: 0, // Initial PnL is 0
          realizedPnL: 0,
          status: 'OPEN',
          paperTradeId,
          intradayFlag: intradayFlag || false, // Task 64.2: Set intradayFlag
        },
      });

      this.logger.log(
        `Created position ${newPosition.id}: ${quantity} @ ${executedPrice.toFixed(2)}${intradayFlag ? ' (INTRADAY)' : ''}`
      );

      return newPosition.id;
    }
  }

  /**
   * Update current price and unrealized PnL for a paper trade
   * This would be called by a price update service
   */
  async updatePaperTradePnL(paperTradeId: string, currentPrice: number): Promise<void> {
    const paperTrade = await this.prisma.paperTrade.findUnique({
      where: { id: paperTradeId },
    });

    if (!paperTrade || paperTrade.status !== PaperTradeStatus.OPEN) {
      this.logger.warn(`Paper trade ${paperTradeId} not found or not open`);
      return;
    }

    // Calculate unrealized PnL
    // LONG: (currentPrice - entryPrice) * quantity
    // SHORT: (entryPrice - currentPrice) * quantity
    const pnlMultiplier = paperTrade.direction === 'LONG' ? 1 : -1;
    const unrealizedPnL =
      (currentPrice - paperTrade.entryPrice) * paperTrade.quantity * pnlMultiplier;

    await this.prisma.paperTrade.update({
      where: { id: paperTradeId },
      data: {
        currentPrice,
        unrealizedPnL,
      },
    });

    this.logger.debug(`Updated paper trade ${paperTradeId} PnL: ${unrealizedPnL.toFixed(2)}`);
  }

  /**
   * Close a paper trade position
   *
   * @param paperTradeId - ID of the paper trade to close
   * @param exitPrice - Price at which to close the position
   */
  async closePaperTrade(paperTradeId: string, exitPrice: number): Promise<PaperTradeResult> {
    try {
      const paperTrade = await this.prisma.paperTrade.findUnique({
        where: { id: paperTradeId },
      });

      if (!paperTrade) {
        return {
          tradeId: paperTradeId,
          status: 'FAILED',
          error: 'Paper trade not found',
        };
      }

      if (paperTrade.status !== PaperTradeStatus.OPEN) {
        return {
          tradeId: paperTradeId,
          status: 'FAILED',
          error: 'Paper trade is not open',
        };
      }

      // Calculate final PnL
      const pnlMultiplier = paperTrade.direction === 'LONG' ? 1 : -1;
      const realizedPnL = (exitPrice - paperTrade.entryPrice) * paperTrade.quantity * pnlMultiplier;

      // Simulate exit slippage
      const exitSlippage = exitPrice * (Math.random() * 0.01);
      const executedExitPrice =
        paperTrade.direction === 'LONG'
          ? exitPrice - exitSlippage // SELL gets lower price
          : exitPrice + exitSlippage; // BUY to cover gets higher price

      // Update paper trade
      const updatedTrade = await this.prisma.paperTrade.update({
        where: { id: paperTradeId },
        data: {
          status: PaperTradeStatus.MANUAL_EXIT,
          currentPrice: executedExitPrice,
          realizedPnL,
          exitedAt: new Date(),
        },
      });

      // Create exit execution record
      await this.prisma.tradeExecution.create({
        data: {
          paperTradeId: paperTrade.id,
          executionType: 'FULL_EXIT',
          quantity: paperTrade.quantity,
          price: executedExitPrice,
          fees: 0,
        },
      });

      // Update position to closed
      await this.prisma.position.updateMany({
        where: {
          paperTradeId,
          status: 'OPEN',
        },
        data: {
          status: 'CLOSED',
          currentPrice: executedExitPrice,
          realizedPnL,
          closedAt: new Date(),
        },
      });

      this.logger.log(
        `Closed paper trade ${paperTradeId}, realized PnL: ${realizedPnL.toFixed(2)}`
      );

      return {
        tradeId: paperTradeId,
        status: 'EXECUTED',
        executedPrice: executedExitPrice,
        slippage: exitSlippage,
      };
    } catch (error) {
      this.logger.error('Failed to close paper trade', error);
      return {
        tradeId: paperTradeId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all open paper trades for a user
   */
  async getOpenPaperTrades(userId: string) {
    return this.prisma.paperTrade.findMany({
      where: {
        userId,
        status: PaperTradeStatus.OPEN,
      },
      include: {
        Signal: true,
        TradeExecution: true,
      },
      orderBy: {
        enteredAt: 'desc',
      },
    });
  }

  /**
   * Get all paper trades for a user (including closed)
   */
  async getAllPaperTrades(userId: string) {
    return this.prisma.paperTrade.findMany({
      where: {
        userId,
      },
      include: {
        Signal: true,
      },
      orderBy: {
        enteredAt: 'desc',
      },
    });
  }

  // ============================================================
  // Paper Trading System (Phase 11) - New Methods
  // ============================================================

  /**
   * Create a new paper trade from AI decision or manual entry.
   * Stores all AI context as JSON in the aiContext field.
   */
  async createPaperTrade(dto: CreatePaperTradeDto) {
    const aiContext: Record<string, any> | undefined =
      dto.originalPrompt || dto.aiResponse || dto.indicators || dto.trendlineAnalysis || dto.marketDataSnapshot
        ? {
            prompt: dto.originalPrompt || null,
            response: dto.aiResponse || null,
            indicators: dto.indicators || null,
            trendlineAnalysis: dto.trendlineAnalysis || null,
            marketDataSnapshot: dto.marketDataSnapshot || null,
            promptVersion: dto.promptVersion || null,
          }
        : undefined;

    const trade = await this.prisma.paperTrade.create({
      data: {
        userId: dto.userId,
        symbol: dto.symbol,
        direction: dto.direction as SignalDirection,
        tradeType: dto.tradeType as PaperTradeType,
        quantity: dto.quantity,
        entryPrice: dto.entryPrice,
        stopLoss: dto.stopLoss,
        target: dto.target,
        status: PaperTradeStatus.OPEN,
        decisionId: dto.decisionId || null,
        agentId: dto.agentId || null,
        aiContext: aiContext as any,
        probability: dto.probability || null,
        riskRewardRatio: dto.riskRewardRatio || null,
        strikePrice: dto.strikePrice || null,
        optionType: dto.optionType || null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        underlying: dto.underlying || null,
        signalId: dto.signalId || null,
      },
    });

    this.logger.log(
      `Created paper trade ${trade.id}: ${dto.direction} ${dto.symbol} @ ${dto.entryPrice} (${dto.tradeType})`
    );

    return trade;
  }

  /**
   * Close an open paper trade with exit data and P&L calculation.
   * Returns 409 if trade is not OPEN, 404 if not found.
   */
  async closePaperTradeV2(tradeId: string, dto: ClosePaperTradeDto) {
    const trade = await this.prisma.paperTrade.findUnique({ where: { id: tradeId } });

    if (!trade) {
      throw new NotFoundException(`Paper trade ${tradeId} not found`);
    }

    if (trade.status !== PaperTradeStatus.OPEN) {
      throw new ConflictException(`Trade is already closed with status: ${trade.status}`);
    }

    // P&L: LONG = (exit - entry) × qty, SHORT = (entry - exit) × qty
    const realizedPnL =
      trade.direction === 'LONG'
        ? (dto.exitPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - dto.exitPrice) * trade.quantity;

    const updatedTrade = await this.prisma.paperTrade.update({
      where: { id: tradeId },
      data: {
        status: dto.exitReason as PaperTradeStatus,
        exitPrice: dto.exitPrice,
        realizedPnL,
        exitedAt: new Date(),
        currentPrice: dto.exitPrice,
        unrealizedPnL: 0,
      },
    });

    this.logger.log(`Closed paper trade ${tradeId} with status ${dto.exitReason}, P&L: ${realizedPnL.toFixed(2)}`);
    return updatedTrade;
  }

  /**
   * Cancel an open paper trade. Sets status to CANCELLED without exit data.
   * Returns 409 if not OPEN, 404 if not found.
   */
  async cancelPaperTrade(tradeId: string) {
    const trade = await this.prisma.paperTrade.findUnique({ where: { id: tradeId } });

    if (!trade) {
      throw new NotFoundException(`Paper trade ${tradeId} not found`);
    }

    if (trade.status !== PaperTradeStatus.OPEN) {
      throw new ConflictException(`Trade is already closed with status: ${trade.status}`);
    }

    const updatedTrade = await this.prisma.paperTrade.update({
      where: { id: tradeId },
      data: {
        status: PaperTradeStatus.CANCELLED,
      },
    });

    this.logger.log(`Cancelled paper trade ${tradeId}`);
    return updatedTrade;
  }

  /**
   * Get paginated trades for a user with optional status and tradeType filters.
   */
  async getTradesForUser(userId: string, filters: PaperTradeFiltersDto) {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = { userId };

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }

    if (filters.tradeType) {
      where.tradeType = filters.tradeType;
    }

    const [trades, total] = await Promise.all([
      this.prisma.paperTrade.findMany({
        where,
        orderBy: { enteredAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.paperTrade.count({ where }),
    ]);

    return {
      data: trades,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get all open trades for a user (new PaperTradeStatus-based).
   */
  async getOpenTradesV2(userId: string) {
    return this.prisma.paperTrade.findMany({
      where: {
        userId,
        status: PaperTradeStatus.OPEN,
      },
      orderBy: { enteredAt: 'desc' },
    });
  }

  /**
   * Update current price and recalculate unrealized P&L for a trade.
   */
  async updateTradePrice(tradeId: string, currentPrice: number) {
    const trade = await this.prisma.paperTrade.findUnique({ where: { id: tradeId } });

    if (!trade) {
      throw new NotFoundException(`Paper trade ${tradeId} not found`);
    }

    // Calculate unrealized P&L
    const unrealizedPnL =
      trade.direction === 'LONG'
        ? (currentPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - currentPrice) * trade.quantity;

    await this.prisma.paperTrade.update({
      where: { id: tradeId },
      data: {
        currentPrice,
        unrealizedPnL,
      },
    });

    return { tradeId, currentPrice, unrealizedPnL };
  }

  /**
   * Task 73.1: Execute a paper options trade
   *
   * Requirements: 9.1, 7.1
   *
   * This method:
   * 1. Validates trade request with RiskService (options-specific rules)
   * 2. Records option trade in OptionsPosition table with isPaper=true
   * 3. Simulates realistic execution (slippage based on spread)
   * 4. Returns execution result with trade ID
   *
   * @param userId - User executing the trade
   * @param tradeRequest - Options trade details
   * @param signalId - Optional signal that generated this trade
   * @returns Trade execution result with simulated slippage
   */
  async executePaperOptionTrade(
    userId: string,
    tradeRequest: PaperOptionTradeRequest,
    signalId?: string
  ): Promise<PaperTradeResult> {
    this.logger.log(
      `Executing paper options trade: ${tradeRequest.action} ${tradeRequest.quantity} ${tradeRequest.symbol} ${tradeRequest.strikePrice} ${tradeRequest.optionType} (expiry: ${tradeRequest.expiry.toISOString()})`
    );

    try {
      // Step 1: Validate trade request with RiskService (options-specific rules)
      const assetType = tradeRequest.optionType === 'CALL' ? 'OPTION_CALL' : 'OPTION_PUT';
      
      const riskValidation = await this.riskService.validateTrade(userId, {
        symbol: tradeRequest.symbol,
        action: tradeRequest.action,
        quantity: tradeRequest.quantity,
        price: tradeRequest.price,
        stopLoss: tradeRequest.stopLoss,
        target: tradeRequest.target,
        assetType,
        bidAskSpread: tradeRequest.bidAskSpread,
        openInterest: tradeRequest.openInterest,
        impliedVolatility: tradeRequest.impliedVolatility,
        delta: tradeRequest.delta,
      } as TradeRequest);

      // Check if risk validation passed (only ERROR violations block execution)
      const hasErrors = riskValidation.violations.filter((v) => v.severity === 'ERROR').length > 0;
      if (hasErrors) {
        const errorMessages = riskValidation.violations
          .filter((v) => v.severity === 'ERROR')
          .map((v) => v.message)
          .join('; ');

        this.logger.warn(`Risk validation failed for options trade: ${errorMessages}`);
        
        return {
          tradeId: '',
          status: 'FAILED',
          error: `Risk validation failed: ${errorMessages}`,
        };
      }

      // Log warnings if any
      const warnings = riskValidation.violations.filter((v) => v.severity === 'WARNING');
      if (warnings.length > 0) {
        this.logger.warn(
          `Risk validation warnings: ${warnings.map((w) => w.message).join('; ')}`
        );
      }

      // Step 2: Simulate realistic execution with slippage based on spread
      let slippage: number;
      let executedPrice: number;

      if (tradeRequest.bidAskSpread && tradeRequest.bidAskSpread > 0) {
        // Use bid-ask spread for more realistic slippage simulation
        // Slippage is typically half the spread (you cross the spread)
        slippage = tradeRequest.bidAskSpread / 2;
      } else {
        // Fallback to percentage-based slippage (0-1% of premium)
        const slippagePercent = Math.random() * 0.01; // 0% to 1%
        slippage = tradeRequest.price * slippagePercent;
      }

      // Apply slippage in the direction that hurts the trader (realistic simulation)
      // BUY orders get worse (higher) prices, SELL orders get worse (lower) prices
      executedPrice =
        tradeRequest.action === 'BUY'
          ? tradeRequest.price + slippage
          : tradeRequest.price - slippage;

      const direction: SignalDirection = tradeRequest.action === 'BUY' ? 'LONG' : 'SHORT';

      // Build full options symbol (e.g., "NIFTY24DEC21500CE")
      const expiryStr = tradeRequest.expiry.toISOString().slice(0, 10).replace(/-/g, '');
      const optionTypeCode = tradeRequest.optionType === 'CALL' ? 'CE' : 'PE';
      const optionsSymbol = `${tradeRequest.symbol}${expiryStr}${tradeRequest.strikePrice}${optionTypeCode}`;

      // Step 3: Create paper trade in database
      const paperTrade = await this.prisma.paperTrade.create({
        data: {
          userId,
          signalId,
          symbol: optionsSymbol,
          direction,
          quantity: tradeRequest.quantity,
          entryPrice: executedPrice,
          stopLoss: tradeRequest.stopLoss || 0,
          target: tradeRequest.target || 0,
          simulatedSlippage: slippage,
          status: PaperTradeStatus.OPEN,
          currentPrice: executedPrice,
          unrealizedPnL: 0, // Initial PnL is 0 at entry
        },
      });

      // Create trade execution record
      await this.prisma.tradeExecution.create({
        data: {
          paperTradeId: paperTrade.id,
          executionType: 'ENTRY',
          quantity: tradeRequest.quantity,
          price: executedPrice,
          fees: 0, // No fees for paper trading
        },
      });

      // Step 4: Create Position entry (stocks use generic Position table)
      const positionId = await this.createOrUpdatePosition(
        userId,
        paperTrade.id,
        optionsSymbol,
        tradeRequest.quantity,
        executedPrice,
        direction,
        false // Options are not intraday by default
      );

      // Step 5: Record option trade in OptionsPosition table with isPaper=true
      const optionsPositionData: any = {
        positionId,
        symbol: tradeRequest.symbol, // Underlying symbol
        strikePrice: tradeRequest.strikePrice,
        optionType: tradeRequest.optionType as OptionType,
        expiry: tradeRequest.expiry,
        entryPrice: executedPrice,
        quantity: tradeRequest.quantity,
        isPaper: true, // Mark as paper trade
      };

      // Add Greeks if available
      if (tradeRequest.delta !== undefined) {
        optionsPositionData.greeks = {
          delta: tradeRequest.delta,
          // Other Greeks can be added if provided
        };
      }

      await this.prisma.optionsPosition.create({
        data: optionsPositionData,
      });

      this.logger.log(
        `Paper options trade executed: ${paperTrade.id}, position: ${positionId}, slippage: ${slippage.toFixed(2)}`
      );

      return {
        tradeId: paperTrade.id,
        status: 'EXECUTED',
        executedPrice,
        slippage,
        positionId,
      };
    } catch (error) {
      this.logger.error('Failed to execute paper options trade', error);
      return {
        tradeId: '',
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
