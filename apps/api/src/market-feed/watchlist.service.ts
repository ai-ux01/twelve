import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MarketDataManager } from './market-data-manager.service';

const MAX_SYMBOLS_PER_WATCHLIST = 50;

export interface WatchlistItem {
  symbol: string;
}

@Injectable()
export class WatchlistService {
  private readonly logger = new Logger(WatchlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataManager: MarketDataManager,
  ) {}

  /**
   * Add a symbol to a user's watchlist.
   * Validates the symbol exists in the Instrument table, enforces the 50-symbol limit,
   * persists, and auto-subscribes via MarketDataManager.
   */
  async addSymbol(
    userId: string,
    watchlistId: string,
    symbol: string,
  ): Promise<void> {
    // Validate symbol exists in Instrument table
    const instrument = await this.prisma.instrument.findFirst({
      where: {
        OR: [{ symbol }, { symbol: { contains: symbol } }],
        isActive: true,
      },
    });

    if (!instrument) {
      throw new Error(`Symbol not found: ${symbol}`);
    }

    // Get the watchlist
    const watchlist = await this.prisma.watchlist.findFirst({
      where: { id: watchlistId, userId },
    });

    if (!watchlist) {
      throw new Error(`Watchlist not found: ${watchlistId}`);
    }

    // Check 50-symbol limit
    if (watchlist.symbols.length >= MAX_SYMBOLS_PER_WATCHLIST) {
      throw new Error(
        `Watchlist limit reached (max ${MAX_SYMBOLS_PER_WATCHLIST}). Remove a symbol before adding a new one.`,
      );
    }

    // Check if symbol is already in the watchlist
    if (watchlist.symbols.includes(symbol)) {
      this.logger.debug(`Symbol ${symbol} already in watchlist ${watchlistId}`);
      return;
    }

    // Persist the symbol to the watchlist
    await this.prisma.watchlist.update({
      where: { id: watchlistId },
      data: {
        symbols: { push: symbol },
      },
    });

    // Auto-subscribe via MarketDataManager
    try {
      await this.marketDataManager.subscribeStock(symbol);
      this.logger.log(
        `Added ${symbol} to watchlist ${watchlistId} and subscribed`,
      );
    } catch (error) {
      this.logger.warn(
        `Added ${symbol} to watchlist but subscription failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Remove a symbol from a user's watchlist.
   * Unsubscribes only if no other watchlist references the symbol.
   */
  async removeSymbol(
    userId: string,
    watchlistId: string,
    symbol: string,
  ): Promise<void> {
    // Get the watchlist
    const watchlist = await this.prisma.watchlist.findFirst({
      where: { id: watchlistId, userId },
    });

    if (!watchlist) {
      throw new Error(`Watchlist not found: ${watchlistId}`);
    }

    if (!watchlist.symbols.includes(symbol)) {
      this.logger.debug(
        `Symbol ${symbol} not found in watchlist ${watchlistId}`,
      );
      return;
    }

    // Remove the symbol from the watchlist
    const updatedSymbols = watchlist.symbols.filter((s) => s !== symbol);
    await this.prisma.watchlist.update({
      where: { id: watchlistId },
      data: { symbols: updatedSymbols },
    });

    // Check if any other watchlist still references this symbol
    const otherWatchlists = await this.prisma.watchlist.findMany({
      where: {
        id: { not: watchlistId },
        symbols: { has: symbol },
      },
    });

    // Only unsubscribe if no other watchlist references it
    if (otherWatchlists.length === 0) {
      try {
        const instrument = await this.prisma.instrument.findFirst({
          where: {
            OR: [{ symbol }, { symbol: { contains: symbol } }],
            isActive: true,
          },
          select: { instrumentToken: true },
        });

        if (instrument?.instrumentToken) {
          this.marketDataManager.unsubscribe(instrument.instrumentToken);
          this.logger.log(
            `Removed ${symbol} from watchlist ${watchlistId} and unsubscribed`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Removed ${symbol} from watchlist but unsubscription failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      this.logger.log(
        `Removed ${symbol} from watchlist ${watchlistId} — kept subscription (referenced by ${otherWatchlists.length} other watchlist(s))`,
      );
    }
  }

  /**
   * Get all items in a user's watchlist.
   */
  async getWatchlist(
    userId: string,
    watchlistId: string,
  ): Promise<WatchlistItem[]> {
    const watchlist = await this.prisma.watchlist.findFirst({
      where: { id: watchlistId, userId },
    });

    if (!watchlist) {
      throw new Error(`Watchlist not found: ${watchlistId}`);
    }

    return watchlist.symbols.map((symbol) => ({ symbol }));
  }

  /**
   * Get all symbols from all watchlists for startup restoration.
   * Returns a unique list of all symbols persisted across all watchlists.
   */
  async getPersistedSubscriptions(): Promise<string[]> {
    const watchlists = await this.prisma.watchlist.findMany({
      select: { symbols: true },
    });

    const allSymbols = new Set<string>();
    for (const watchlist of watchlists) {
      for (const symbol of watchlist.symbols) {
        allSymbols.add(symbol);
      }
    }

    return Array.from(allSymbols);
  }
}
