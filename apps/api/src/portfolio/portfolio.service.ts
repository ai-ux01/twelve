import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';

export interface PortfolioResponse {
  totalValue: number;
  cashBalance: number;
  investedValue: number;
  positions: PositionInfo[];
  totalPnL: number;
  dailyPnL: number;
  metrics: {
    totalExposure: number;
    openPositions: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
  };
}

export interface PositionInfo {
  id: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  isPaper: boolean;
}

export interface OptionsPositionInfo {
  id: string;
  symbol: string;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  expiry: Date;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  isPaper: boolean;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
  daysToExpiry: number;
  isExpiringSoon: boolean;
  expiryAlert?: string;
}

/**
 * Portfolio Service - Manages positions and calculates portfolio metrics
 * Requirements covered: 11.1, 11.2, 11.3
 */
@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataService: MarketDataService,
    private readonly quantService: QuantService
  ) {}

  /**
   * Get complete portfolio for a user
   * Retrieves all open positions and calculates real-time PnL
   * Requirements covered: 11.1, 11.2, 11.3
   */
  async getPortfolio(userId: string): Promise<PortfolioResponse> {
    this.logger.debug(`Fetching portfolio for user ${userId}`);

    // Get or create portfolio
    let portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      include: {
        Position: {
          where: { status: 'OPEN' },
        },
      },
    });

    if (!portfolio) {
      // Create default portfolio
      portfolio = await this.prisma.portfolio.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          totalValue: 1000000, // Default 10 lakh capital
          cashBalance: 1000000,
          investedValue: 0,
          unrealizedPnL: 0,
          realizedPnL: 0,
          updatedAt: new Date(),
        },
        include: {
          Position: true,
        },
      });
    }

    // Update all position prices from market data
    await this.updateAllPositionPrices(portfolio.Position);

    // Fetch updated positions with current prices
    const updatedPositions = await this.prisma.position.findMany({
      where: {
        portfolioId: portfolio.id,
        status: 'OPEN',
      },
    });

    // Calculate current PnL for all positions
    const positions = updatedPositions.map((pos) => {
      // PnL calculation: (currentPrice - entryPrice) × quantity
      const unrealizedPnL = (pos.currentPrice - pos.averagePrice) * pos.quantity;
      const unrealizedPnLPercent =
        pos.averagePrice > 0 ? ((pos.currentPrice - pos.averagePrice) / pos.averagePrice) * 100 : 0;

      return {
        id: pos.id,
        symbol: pos.symbol,
        quantity: pos.quantity,
        averagePrice: pos.averagePrice,
        currentPrice: pos.currentPrice,
        unrealizedPnL,
        unrealizedPnLPercent,
        isPaper: pos.paperTradeId !== null,
      };
    });

    const totalPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);

    // Calculate daily PnL (today's change)
    const dailyPnL = await this.calculateDailyPnL(portfolio.id);

    // Calculate portfolio-level metrics
    const metrics = await this.calculatePortfolioMetrics(userId, positions);

    // Update portfolio totals
    const investedValue = positions.reduce((sum, pos) => sum + pos.averagePrice * pos.quantity, 0);

    await this.prisma.portfolio.update({
      where: { id: portfolio.id },
      data: {
        investedValue,
        unrealizedPnL: totalPnL,
      },
    });

    return {
      totalValue: portfolio.totalValue,
      cashBalance: portfolio.cashBalance,
      investedValue,
      positions,
      totalPnL,
      dailyPnL,
      metrics,
    };
  }

  /**
   * Update all position prices from market data
   * Fetches current prices for all symbols and updates positions
   * Requirements covered: 11.2
   */
  private async updateAllPositionPrices(
    positions: Array<{ id: string; symbol: string; averagePrice: number; quantity: number }>
  ): Promise<void> {
    if (positions.length === 0) {
      return;
    }

    // Get unique symbols
    const symbols = Array.from(new Set(positions.map((pos) => pos.symbol)));

    this.logger.debug(`Updating prices for ${symbols.length} symbols`);

    // Fetch current prices for all symbols
    const priceUpdates = await Promise.allSettled(
      symbols.map(async (symbol) => {
        try {
          // Fetch recent market data (1-day timeframe)
          const marketData = await this.marketDataService.getMarketData(symbol, '1d');

          // Get the latest close price
          if (marketData.data && marketData.data.length > 0) {
            const latestCandle = marketData.data[marketData.data.length - 1];
            return { symbol, price: latestCandle.close };
          }

          this.logger.warn(`No market data available for ${symbol}`);
          return { symbol, price: null };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Failed to fetch price for ${symbol}: ${errorMessage}`);
          return { symbol, price: null };
        }
      })
    );

    // Create a map of symbol to price
    const priceMap = new Map<string, number>();
    priceUpdates.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.price !== null) {
        priceMap.set(result.value.symbol, result.value.price);
      }
    });

    // Update positions with fetched prices
    await Promise.allSettled(
      positions.map(async (pos) => {
        const currentPrice = priceMap.get(pos.symbol);
        if (currentPrice !== undefined) {
          await this.updatePositionPrice(pos.id, currentPrice);
        }
      })
    );

    this.logger.debug(`Updated prices for ${priceMap.size} out of ${symbols.length} symbols`);
  }

  /**
   * Calculate daily PnL (change since market open)
   * Requirements covered: 11.3
   */
  private async calculateDailyPnL(portfolioId: string): Promise<number> {
    // Get all positions for the portfolio
    const positions = await this.prisma.position.findMany({
      where: {
        portfolioId,
        status: 'OPEN',
      },
    });

    if (positions.length === 0) {
      return 0;
    }

    // For daily PnL, we need to compare current price with the opening price of today
    // Since we don't track intraday snapshots, we'll use a simplified approach:
    // Daily PnL = Current unrealized PnL change from last update
    // This is a placeholder - in production, you'd want to store daily snapshots
    let dailyPnL = 0;

    for (const pos of positions) {
      try {
        // Fetch today's market data
        const marketData = await this.marketDataService.getMarketData(pos.symbol, '1d');

        if (marketData.data && marketData.data.length > 0) {
          const todayCandle = marketData.data[marketData.data.length - 1];
          const todayOpen = todayCandle.open;
          const currentPrice = pos.currentPrice;

          // Daily PnL for this position: (currentPrice - todayOpen) × quantity
          const positionDailyPnL = (currentPrice - todayOpen) * pos.quantity;
          dailyPnL += positionDailyPnL;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Failed to calculate daily PnL for ${pos.symbol}: ${errorMessage}`);
      }
    }

    return dailyPnL;
  }

  /**
   * Calculate portfolio-level metrics
   * Includes exposure, win rate, and performance metrics
   * Requirements covered: 11.3
   */
  private async calculatePortfolioMetrics(
    userId: string,
    positions: PositionInfo[]
  ): Promise<{
    totalExposure: number;
    openPositions: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
  }> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
    });

    if (!portfolio) {
      return {
        totalExposure: 0,
        openPositions: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
      };
    }

    // Calculate total exposure: sum of current position values / total portfolio value
    const totalPositionValue = positions.reduce(
      (sum, pos) => sum + pos.currentPrice * pos.quantity,
      0
    );

    const totalExposure = portfolio.totalValue > 0 ? totalPositionValue / portfolio.totalValue : 0;

    // Get closed positions for win rate calculation
    const closedPositions = await this.prisma.position.findMany({
      where: {
        portfolioId: portfolio.id,
        status: 'CLOSED',
      },
    });

    const wins = closedPositions.filter((pos) => pos.realizedPnL > 0);
    const losses = closedPositions.filter((pos) => pos.realizedPnL < 0);

    const winRate = closedPositions.length > 0 ? (wins.length / closedPositions.length) * 100 : 0;

    const avgWin =
      wins.length > 0 ? wins.reduce((sum, pos) => sum + pos.realizedPnL, 0) / wins.length : 0;

    const avgLoss =
      losses.length > 0 ? losses.reduce((sum, pos) => sum + pos.realizedPnL, 0) / losses.length : 0;

    return {
      totalExposure,
      openPositions: positions.length,
      winRate,
      avgWin,
      avgLoss,
    };
  }

  /**
   * Update position current price and PnL
   * Requirements covered: 11.2
   */
  async updatePositionPrice(positionId: string, currentPrice: number): Promise<void> {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new NotFoundException(`Position ${positionId} not found`);
    }

    // Calculate unrealized PnL: (currentPrice - entryPrice) × quantity
    const unrealizedPnL = (currentPrice - position.averagePrice) * position.quantity;

    await this.prisma.position.update({
      where: { id: positionId },
      data: {
        currentPrice,
        unrealizedPnL,
      },
    });

    this.logger.debug(
      `Updated position ${positionId}: price=${currentPrice}, PnL=${unrealizedPnL}`
    );
  }

  /**
   * Get all open positions from database
   * Requirements covered: 11.1
   */
  async getOpenPositions(userId: string): Promise<PositionInfo[]> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      include: {
        Position: {
          where: { status: 'OPEN' },
        },
      },
    });

    if (!portfolio) {
      return [];
    }

    // Update prices for all positions
    await this.updateAllPositionPrices(portfolio.Position);

    // Fetch updated positions
    const updatedPositions = await this.prisma.position.findMany({
      where: {
        portfolioId: portfolio.id,
        status: 'OPEN',
      },
    });

    return updatedPositions.map((pos) => {
      const unrealizedPnL = (pos.currentPrice - pos.averagePrice) * pos.quantity;
      const unrealizedPnLPercent =
        pos.averagePrice > 0 ? ((pos.currentPrice - pos.averagePrice) / pos.averagePrice) * 100 : 0;

      return {
        id: pos.id,
        symbol: pos.symbol,
        quantity: pos.quantity,
        averagePrice: pos.averagePrice,
        currentPrice: pos.currentPrice,
        unrealizedPnL,
        unrealizedPnLPercent,
        isPaper: pos.paperTradeId !== null,
      };
    });
  }

  /**
   * Get all open options positions with Greeks and expiry alerts
   * Calculates options-specific P&L (mark-to-market)
   * Tracks Greeks for all option positions
   * Identifies expiring positions (< 7 days to expiry) with alerts
   * Requirements covered: 11.1, 11.2, 7.3
   */
  async getOptionsPositions(userId: string): Promise<OptionsPositionInfo[]> {
    this.logger.debug(`Fetching options positions for user ${userId}`);

    // Get portfolio
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
    });

    if (!portfolio) {
      return [];
    }

    // Get all open positions with options positions
    const positions = await this.prisma.position.findMany({
      where: {
        portfolioId: portfolio.id,
        status: 'OPEN',
      },
      include: {
        OptionsPosition: true,
      },
    });

    // Filter only positions that have options data
    const optionsPositions = positions.filter((pos) => pos.OptionsPosition !== null);

    if (optionsPositions.length === 0) {
      return [];
    }

    this.logger.debug(`Found ${optionsPositions.length} options positions`);

    // Get unique underlying symbols
    const underlyingSymbols = Array.from(
      new Set(optionsPositions.map((pos) => pos.OptionsPosition!.symbol))
    );

    // Fetch spot prices for all underlying symbols
    const spotPrices = new Map<string, number>();
    await Promise.allSettled(
      underlyingSymbols.map(async (symbol) => {
        try {
          const marketData = await this.marketDataService.getMarketData(symbol, '1d');
          if (marketData.data && marketData.data.length > 0) {
            const latestCandle = marketData.data[marketData.data.length - 1];
            spotPrices.set(symbol, latestCandle.close);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Failed to fetch spot price for ${symbol}: ${errorMessage}`);
        }
      })
    );

    // Calculate Greeks and P&L for each options position
    const optionsPositionInfos = await Promise.all(
      optionsPositions.map(async (pos) => {
        const optionData = pos.OptionsPosition!;
        const spotPrice = spotPrices.get(optionData.symbol);

        // Calculate days to expiry
        const now = new Date();
        const expiry = new Date(optionData.expiry);
        const daysToExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isExpiringSoon = daysToExpiry <= 7;

        let greeks = {
          delta: 0,
          gamma: 0,
          theta: 0,
          vega: 0,
        };

        let currentPrice = pos.currentPrice;

        // Calculate Greeks if we have spot price
        if (spotPrice) {
          try {
            // Get stored Greeks or calculate new ones
            if (optionData.greeks && typeof optionData.greeks === 'object') {
              const storedGreeks = optionData.greeks as any;
              if (
                typeof storedGreeks.delta === 'number' &&
                typeof storedGreeks.gamma === 'number' &&
                typeof storedGreeks.theta === 'number' &&
                typeof storedGreeks.vega === 'number'
              ) {
                greeks = {
                  delta: storedGreeks.delta,
                  gamma: storedGreeks.gamma,
                  theta: storedGreeks.theta,
                  vega: storedGreeks.vega,
                };
              }
            } else {
              // Calculate Greeks using Quant Engine
              // We'll use a reasonable default IV of 15% and risk-free rate of 7%
              const contracts = [
                {
                  strikePrice: optionData.strikePrice,
                  optionType: optionData.optionType as 'CALL' | 'PUT',
                  volatility: 0.15, // Default IV
                  ltp: currentPrice,
                  openInterest: 0,
                  volume: 0,
                },
              ];

              const chainResult = await this.quantService.processOptionsChain(
                optionData.symbol,
                expiry,
                spotPrice,
                contracts,
                0.07 // Risk-free rate
              );

              if (chainResult.contracts.length > 0) {
                greeks = chainResult.contracts[0].greeks;
                currentPrice = chainResult.contracts[0].ltp;

                // Update position with current price and Greeks
                await this.prisma.optionsPosition.update({
                  where: { id: optionData.id },
                  data: {
                    greeks: greeks,
                    updatedAt: new Date(),
                  },
                });

                await this.updatePositionPrice(pos.id, currentPrice);
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
              `Failed to calculate Greeks for ${optionData.symbol} ${optionData.strikePrice} ${optionData.optionType}: ${errorMessage}`
            );
          }
        }

        // Calculate P&L: (currentPrice - entryPrice) × quantity
        const unrealizedPnL = (currentPrice - optionData.entryPrice) * optionData.quantity;
        const unrealizedPnLPercent =
          optionData.entryPrice > 0
            ? ((currentPrice - optionData.entryPrice) / optionData.entryPrice) * 100
            : 0;

        // Generate expiry alert if needed
        let expiryAlert: string | undefined;
        if (isExpiringSoon) {
          if (daysToExpiry === 0) {
            expiryAlert = 'EXPIRES TODAY! Close position immediately.';
          } else if (daysToExpiry === 1) {
            expiryAlert = 'Expires tomorrow. Consider closing position.';
          } else {
            expiryAlert = `Expires in ${daysToExpiry} days. Monitor closely.`;
          }
        }

        return {
          id: pos.id,
          symbol: optionData.symbol,
          strikePrice: optionData.strikePrice,
          optionType: optionData.optionType as 'CALL' | 'PUT',
          expiry: expiry,
          quantity: optionData.quantity,
          entryPrice: optionData.entryPrice,
          currentPrice,
          unrealizedPnL,
          unrealizedPnLPercent,
          isPaper: optionData.isPaper,
          greeks,
          daysToExpiry,
          isExpiringSoon,
          expiryAlert,
        };
      })
    );

    this.logger.debug(
      `Calculated Greeks and P&L for ${optionsPositionInfos.length} options positions`
    );

    return optionsPositionInfos;
  }
}
