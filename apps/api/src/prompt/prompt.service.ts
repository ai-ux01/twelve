import { Injectable, Logger } from '@nestjs/common';

export interface ParsedPrompt {
  intent:
    | 'FIND_TRADE'
    | 'ANALYZE_MARKET'
    | 'GENERATE_STRATEGY'
    | 'REVIEW_POSITION'
    | 'BACKTEST'
    | 'EXPLAIN'
    | 'QUERY';
  symbols: string[];
  timeframe?: 'SWING' | 'INTRADAY' | 'SCALPING' | 'POSITIONAL';
  assetType?: 'STOCK' | 'OPTION_CALL' | 'OPTION_PUT' | 'INDEX' | 'FUTURES';
}

@Injectable()
export class PromptService {
  private readonly logger = new Logger(PromptService.name);

  /**
   * Parse natural language user prompt to extract trading intent
   * Uses regex patterns and keyword matching (no AI here)
   */
  parsePrompt(rawPrompt: string): ParsedPrompt {
    this.logger.debug(`Parsing prompt: ${rawPrompt}`);

    const normalizedPrompt = rawPrompt.toLowerCase();

    const parsed: ParsedPrompt = {
      intent: this.extractIntent(normalizedPrompt),
      symbols: this.extractSymbols(rawPrompt),
      timeframe: this.extractTimeframe(normalizedPrompt),
      assetType: this.extractAssetType(normalizedPrompt),
    };

    this.logger.debug(`Parsed result: ${JSON.stringify(parsed)}`);
    return parsed;
  }

  private extractIntent(prompt: string): ParsedPrompt['intent'] {
    const intentPatterns = [
      {
        pattern: /find|suggest|recommend|look|search|discover|show/,
        intent: 'FIND_TRADE' as const,
      },
      {
        pattern: /review.*(position|holding)|check.*(position|holding)|position.*status/,
        intent: 'REVIEW_POSITION' as const,
      },
      {
        pattern: /analyze|analysis|check|review|examine|assess/,
        intent: 'ANALYZE_MARKET' as const,
      },
      { pattern: /generate|create|build|develop.*strategy/, intent: 'GENERATE_STRATEGY' as const },
      { pattern: /backtest|test.*strategy|historical/, intent: 'BACKTEST' as const },
      { pattern: /explain|why|how|what/, intent: 'EXPLAIN' as const },
    ];

    for (const { pattern, intent } of intentPatterns) {
      if (pattern.test(prompt)) {
        return intent;
      }
    }

    return 'QUERY';
  }

  private extractSymbols(prompt: string): string[] {
    // NSE stock symbols are typically uppercase letters
    // Common patterns: RELIANCE, TCS, INFY, HDFCBANK, etc.
    const symbolPattern = /\b([A-Z]{2,}(?:BANK)?)\b/g;
    const matches = prompt.match(symbolPattern) || [];

    // Filter out common English words that might match the pattern
    const commonWords = ['NSE', 'BSE', 'STOCK', 'OPTION', 'CALL', 'PUT', 'NIFTY', 'BANKNIFTY'];
    const symbols = matches.filter((match) => !commonWords.includes(match));

    // Remove duplicates
    return [...new Set(symbols)];
  }

  private extractTimeframe(prompt: string): ParsedPrompt['timeframe'] | undefined {
    const timeframePatterns = [
      { pattern: /swing|multi[- ]?day|few days|week/, timeframe: 'SWING' as const },
      { pattern: /intraday|day trad|same day|today/, timeframe: 'INTRADAY' as const },
      { pattern: /scalp|quick|short[- ]?term|minutes/, timeframe: 'SCALPING' as const },
      { pattern: /position|long[- ]?term|weeks|months/, timeframe: 'POSITIONAL' as const },
    ];

    for (const { pattern, timeframe } of timeframePatterns) {
      if (pattern.test(prompt)) {
        return timeframe;
      }
    }

    return undefined;
  }

  private extractAssetType(prompt: string): ParsedPrompt['assetType'] | undefined {
    const assetTypePatterns = [
      { pattern: /\b(nifty|banknifty).*call\b/i, assetType: 'OPTION_CALL' as const },
      { pattern: /\b(nifty|banknifty).*put\b/i, assetType: 'OPTION_PUT' as const },
      { pattern: /\bcall\s+option\b|\boption.*call\b/i, assetType: 'OPTION_CALL' as const },
      { pattern: /\bput\s+option\b|\boption.*put\b/i, assetType: 'OPTION_PUT' as const },
      { pattern: /\b(nifty|banknifty|sensex)\b/i, assetType: 'INDEX' as const },
      { pattern: /\bfutures?\b/i, assetType: 'FUTURES' as const },
      { pattern: /\bstock|equity|share/i, assetType: 'STOCK' as const },
    ];

    for (const { pattern, assetType } of assetTypePatterns) {
      if (pattern.test(prompt)) {
        return assetType;
      }
    }

    // Default to stock if symbols are found but no specific asset type
    return 'STOCK';
  }
}
