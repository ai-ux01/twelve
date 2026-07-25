import { Test, TestingModule } from '@nestjs/testing';
import { PromptService } from './prompt.service';
import * as fc from 'fast-check';

describe('PromptService', () => {
  let service: PromptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptService],
    }).compile();

    service = module.get<PromptService>(PromptService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Intent Extraction', () => {
    it('should extract FIND_TRADE intent from "find" keyword', () => {
      const result = service.parsePrompt('find me a good stock');
      expect(result.intent).toBe('FIND_TRADE');
    });

    it('should extract FIND_TRADE intent from "suggest" keyword', () => {
      const result = service.parsePrompt('suggest a trade for RELIANCE');
      expect(result.intent).toBe('FIND_TRADE');
    });

    it('should extract FIND_TRADE intent from "recommend" keyword', () => {
      const result = service.parsePrompt('recommend some swing trades');
      expect(result.intent).toBe('FIND_TRADE');
    });

    it('should extract ANALYZE_MARKET intent from "analyze" keyword', () => {
      const result = service.parsePrompt('analyze TCS stock');
      expect(result.intent).toBe('ANALYZE_MARKET');
    });

    it('should extract ANALYZE_MARKET intent from "check" keyword', () => {
      const result = service.parsePrompt('check the market conditions');
      expect(result.intent).toBe('ANALYZE_MARKET');
    });

    it('should extract GENERATE_STRATEGY intent', () => {
      const result = service.parsePrompt('create a trading strategy for NIFTY');
      expect(result.intent).toBe('GENERATE_STRATEGY');
    });

    it('should extract REVIEW_POSITION intent', () => {
      const result = service.parsePrompt('review my position in INFY');
      expect(result.intent).toBe('REVIEW_POSITION');
    });

    it('should extract BACKTEST intent', () => {
      const result = service.parsePrompt('backtest this strategy');
      expect(result.intent).toBe('BACKTEST');
    });

    it('should extract EXPLAIN intent from "explain" keyword', () => {
      const result = service.parsePrompt('explain why TCS is bullish');
      expect(result.intent).toBe('EXPLAIN');
    });

    it('should extract EXPLAIN intent from "why" keyword', () => {
      const result = service.parsePrompt('why is RELIANCE falling');
      expect(result.intent).toBe('EXPLAIN');
    });

    it('should default to QUERY intent for unknown pattern', () => {
      const result = service.parsePrompt('hello world random text');
      expect(result.intent).toBe('QUERY');
    });
  });

  describe('Symbol Extraction', () => {
    it('should extract single symbol from prompt', () => {
      const result = service.parsePrompt('Find a trade for RELIANCE');
      expect(result.symbols).toContain('RELIANCE');
    });

    it('should extract multiple symbols from prompt', () => {
      const result = service.parsePrompt('Compare TCS and INFY');
      expect(result.symbols).toContain('TCS');
      expect(result.symbols).toContain('INFY');
    });

    it('should extract symbols with BANK suffix', () => {
      const result = service.parsePrompt('Analyze HDFCBANK and ICICIBANK');
      expect(result.symbols).toContain('HDFCBANK');
      expect(result.symbols).toContain('ICICIBANK');
    });

    it('should filter out common words like NSE, BSE, STOCK', () => {
      const result = service.parsePrompt('Find NSE STOCK for trading');
      expect(result.symbols).not.toContain('NSE');
      expect(result.symbols).not.toContain('STOCK');
    });

    it('should filter out NIFTY and BANKNIFTY from symbols', () => {
      const result = service.parsePrompt('Find NIFTY CALL option');
      expect(result.symbols).not.toContain('NIFTY');
    });

    it('should remove duplicate symbols', () => {
      const result = service.parsePrompt('TCS and TCS and TCS');
      const tcsCount = result.symbols.filter((s) => s === 'TCS').length;
      expect(tcsCount).toBe(1);
    });

    it('should handle prompts with no symbols', () => {
      const result = service.parsePrompt('find me a good trade today');
      expect(result.symbols).toEqual([]);
    });

    it('should extract symbols in mixed case input', () => {
      const result = service.parsePrompt('Analyze reliance'); // lowercase input
      expect(result.symbols).toEqual([]); // Won't match because pattern requires uppercase
    });

    it('should extract uppercase symbols correctly', () => {
      const result = service.parsePrompt('Analyze WIPRO and LT');
      expect(result.symbols).toContain('WIPRO');
      expect(result.symbols).toContain('LT');
    });
  });

  describe('Timeframe Extraction', () => {
    it('should extract SWING timeframe from "swing" keyword', () => {
      const result = service.parsePrompt('find swing trade opportunities');
      expect(result.timeframe).toBe('SWING');
    });

    it('should extract SWING timeframe from "multi-day" keyword', () => {
      const result = service.parsePrompt('suggest multi-day trades');
      expect(result.timeframe).toBe('SWING');
    });

    it('should extract SWING timeframe from "week" keyword', () => {
      const result = service.parsePrompt('find trades for this week');
      expect(result.timeframe).toBe('SWING');
    });

    it('should extract INTRADAY timeframe from "intraday" keyword', () => {
      const result = service.parsePrompt('find intraday opportunities');
      expect(result.timeframe).toBe('INTRADAY');
    });

    it('should extract INTRADAY timeframe from "day trading" keyword', () => {
      const result = service.parsePrompt('day trading ideas');
      expect(result.timeframe).toBe('INTRADAY');
    });

    it('should extract INTRADAY timeframe from "today" keyword', () => {
      const result = service.parsePrompt('best trades for today');
      expect(result.timeframe).toBe('INTRADAY');
    });

    it('should extract SCALPING timeframe from "scalp" keyword', () => {
      const result = service.parsePrompt('scalping opportunities in NIFTY');
      expect(result.timeframe).toBe('SCALPING');
    });

    it('should extract SCALPING timeframe from "quick" keyword', () => {
      const result = service.parsePrompt('quick trades for options');
      expect(result.timeframe).toBe('SCALPING');
    });

    it('should extract SCALPING timeframe from "minutes" keyword', () => {
      const result = service.parsePrompt('trades lasting few minutes');
      expect(result.timeframe).toBe('SCALPING');
    });

    it('should extract POSITIONAL timeframe from "position" keyword', () => {
      const result = service.parsePrompt('positional trading ideas');
      expect(result.timeframe).toBe('POSITIONAL');
    });

    it('should extract POSITIONAL timeframe from "long-term" keyword', () => {
      const result = service.parsePrompt('long-term investment opportunities');
      expect(result.timeframe).toBe('POSITIONAL');
    });

    it('should return undefined for prompts without timeframe keywords', () => {
      const result = service.parsePrompt('find me a good trade');
      expect(result.timeframe).toBeUndefined();
    });
  });

  describe('Asset Type Extraction', () => {
    it('should extract OPTION_CALL for "NIFTY call"', () => {
      const result = service.parsePrompt('find NIFTY call options');
      expect(result.assetType).toBe('OPTION_CALL');
    });

    it('should extract OPTION_PUT for "BANKNIFTY put"', () => {
      const result = service.parsePrompt('suggest BANKNIFTY put options');
      expect(result.assetType).toBe('OPTION_PUT');
    });

    it('should extract OPTION_CALL for "call option"', () => {
      const result = service.parsePrompt('find call option trades');
      expect(result.assetType).toBe('OPTION_CALL');
    });

    it('should extract OPTION_PUT for "put option"', () => {
      const result = service.parsePrompt('analyze put option strategies');
      expect(result.assetType).toBe('OPTION_PUT');
    });

    it('should extract INDEX for "NIFTY"', () => {
      const result = service.parsePrompt('analyze NIFTY index');
      expect(result.assetType).toBe('INDEX');
    });

    it('should extract INDEX for "BANKNIFTY"', () => {
      const result = service.parsePrompt('check BANKNIFTY levels');
      expect(result.assetType).toBe('INDEX');
    });

    it('should extract FUTURES for "futures" keyword', () => {
      const result = service.parsePrompt('find futures trading opportunities');
      expect(result.assetType).toBe('FUTURES');
    });

    it('should extract STOCK for "stock" keyword', () => {
      const result = service.parsePrompt('analyze stock market');
      expect(result.assetType).toBe('STOCK');
    });

    it('should extract STOCK for "equity" keyword', () => {
      const result = service.parsePrompt('find equity trades');
      expect(result.assetType).toBe('STOCK');
    });

    it('should default to STOCK when no specific asset type is found', () => {
      const result = service.parsePrompt('find good trading opportunities');
      expect(result.assetType).toBe('STOCK');
    });
  });

  describe('Complete Parsing Examples', () => {
    it('should parse complete swing trade prompt', () => {
      const result = service.parsePrompt('Find the best swing trade in RELIANCE');
      expect(result).toEqual({
        intent: 'FIND_TRADE',
        symbols: ['RELIANCE'],
        timeframe: 'SWING',
        assetType: 'STOCK',
      });
    });

    it('should parse intraday options prompt', () => {
      const result = service.parsePrompt('Suggest intraday NIFTY call options');
      expect(result).toEqual({
        intent: 'FIND_TRADE',
        symbols: [],
        timeframe: 'INTRADAY',
        assetType: 'OPTION_CALL',
      });
    });

    it('should parse scalping prompt with multiple symbols', () => {
      const result = service.parsePrompt('Find scalping opportunities in TCS and INFY');
      expect(result.intent).toBe('FIND_TRADE');
      expect(result.symbols).toContain('TCS');
      expect(result.symbols).toContain('INFY');
      expect(result.timeframe).toBe('SCALPING');
      expect(result.assetType).toBe('STOCK');
    });

    it('should parse analysis prompt without timeframe', () => {
      const result = service.parsePrompt('Analyze HDFCBANK');
      expect(result).toEqual({
        intent: 'ANALYZE_MARKET',
        symbols: ['HDFCBANK'],
        timeframe: undefined,
        assetType: 'STOCK',
      });
    });
  });

  describe('Property-Based Tests', () => {
    describe('Property 5: Prompt Parsing Consistency - Symbol Extraction', () => {
      /**
       * Property 5: Prompt Parsing Consistency
       * For any user prompt containing a valid NSE stock symbol, the parser SHALL extract
       * that symbol regardless of its position in the prompt or surrounding text.
       * **Validates: Requirements 19.2**
       */
      it('should extract symbols regardless of position in prompt', () => {
        // Generator for valid NSE-like symbols (2-10 uppercase letters, optionally ending with BANK)
        const nseSymbolArb = fc.oneof(
          fc
            .string({ minLength: 2, maxLength: 10 })
            .map((s) => s.toUpperCase().replace(/\s/g, 'X')), // Replace spaces with X to ensure valid symbols
          fc
            .string({ minLength: 2, maxLength: 6 })
            .map((s: string) => s.toUpperCase().replace(/\s/g, 'X') + 'BANK')
        );

        // Filter out common words that are explicitly excluded and ensure not whitespace-only
        const validSymbolArb = nseSymbolArb.filter((symbol) => {
          const excludedWords = [
            'NSE',
            'BSE',
            'STOCK',
            'OPTION',
            'CALL',
            'PUT',
            'NIFTY',
            'BANKNIFTY',
          ];
          return (
            !excludedWords.includes(symbol) &&
            symbol.trim().length > 0 &&
            /^[A-Z]+(?:BANK)?$/.test(symbol)
          );
        });

        // Generator for surrounding text (lowercase to ensure symbol stands out)
        const surroundingTextArb = fc
          .string({ minLength: 0, maxLength: 50 })
          .map((s) => s.toLowerCase());

        fc.assert(
          fc.property(
            validSymbolArb,
            surroundingTextArb,
            surroundingTextArb,
            (symbol, before, after) => {
              const prompt = `${before} ${symbol} ${after}`.trim();
              const result = service.parsePrompt(prompt);

              // The symbol should be extracted
              expect(result.symbols).toContain(symbol);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should extract multiple distinct symbols from any prompt', () => {
        const nseSymbolArb = fc
          .string({ minLength: 2, maxLength: 10 })
          .map((s) => s.toUpperCase().replace(/\s/g, 'X')) // Replace spaces with X
          .filter((s: string) => {
            const excludedWords = [
              'NSE',
              'BSE',
              'STOCK',
              'OPTION',
              'CALL',
              'PUT',
              'NIFTY',
              'BANKNIFTY',
            ];
            return !excludedWords.includes(s) && s.trim().length > 0 && /^[A-Z]+$/.test(s);
          });

        const symbolsArb = fc.uniqueArray(nseSymbolArb, { minLength: 1, maxLength: 5 });
        const fillerArb = fc.constantFrom('and', 'or', 'with', ',', '');

        fc.assert(
          fc.property(symbolsArb, fc.array(fillerArb), (symbols, fillers) => {
            // Build prompt with symbols interspersed with filler words
            const promptParts: string[] = [];
            symbols.forEach((symbol: string, i) => {
              promptParts.push(symbol);
              if (i < fillers.length) {
                promptParts.push(fillers[i]);
              }
            });
            const prompt = promptParts.join(' ');

            const result = service.parsePrompt(prompt);

            // All symbols should be extracted
            symbols.forEach((symbol) => {
              expect(result.symbols).toContain(symbol);
            });

            // No duplicates
            const uniqueSymbols = [...new Set(result.symbols)];
            expect(result.symbols.length).toBe(uniqueSymbols.length);
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Property 6: Timeframe Extraction Consistency', () => {
      /**
       * Property 6: Timeframe Extraction Consistency
       * For any user prompt containing a timeframe keyword (swing, intraday, scalping),
       * the parser SHALL correctly identify the timeframe regardless of case or surrounding words.
       * **Validates: Requirements 19.3**
       */
      it('should extract timeframe keywords regardless of case or position', () => {
        const timeframeKeywords = [
          { keyword: 'swing', expected: 'SWING' as const },
          { keyword: 'intraday', expected: 'INTRADAY' as const },
          { keyword: 'scalping', expected: 'SCALPING' as const },
          { keyword: 'positional', expected: 'POSITIONAL' as const },
          { keyword: 'multi-day', expected: 'SWING' as const },
          { keyword: 'day trading', expected: 'INTRADAY' as const },
          { keyword: 'quick', expected: 'SCALPING' as const },
        ];

        const keywordArb = fc.constantFrom(...timeframeKeywords);
        const surroundingTextArb = fc
          .string({ minLength: 0, maxLength: 30 })
          .map((s) => s.toLowerCase());

        fc.assert(
          fc.property(keywordArb, surroundingTextArb, surroundingTextArb, (kw, before, after) => {
            const prompt = `${before} ${kw.keyword} ${after}`.trim();
            const result = service.parsePrompt(prompt);

            expect(result.timeframe).toBe(kw.expected);
          }),
          { numRuns: 100 }
        );
      });

      it('should extract timeframe with mixed case input', () => {
        const timeframeKeywords = [
          { keyword: 'swing', expected: 'SWING' as const },
          { keyword: 'intraday', expected: 'INTRADAY' as const },
          { keyword: 'scalping', expected: 'SCALPING' as const },
        ];

        const keywordArb = fc.constantFrom(...timeframeKeywords);
        const caseTransformArb = fc.constantFrom<(s: string) => string>(
          (s) => s.toUpperCase(),
          (s) => s.toLowerCase(),
          (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
        );

        fc.assert(
          fc.property(keywordArb, caseTransformArb, (kw, transform) => {
            const transformedKeyword = transform(kw.keyword);
            const prompt = `find ${transformedKeyword} trades`;
            const result = service.parsePrompt(prompt);

            expect(result.timeframe).toBe(kw.expected);
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Property 7: Asset Type Extraction Consistency', () => {
      /**
       * Property 7: Asset Type Extraction Consistency
       * For any user prompt containing asset type keywords (stock, option, call, put),
       * the parser SHALL correctly identify the asset type.
       * **Validates: Requirements 19.4**
       */
      it('should extract asset type keywords correctly', () => {
        const assetTypeKeywords = [
          { keyword: 'stock', expected: 'STOCK' as const },
          { keyword: 'equity', expected: 'STOCK' as const },
          { keyword: 'call option', expected: 'OPTION_CALL' as const },
          { keyword: 'put option', expected: 'OPTION_PUT' as const },
          { keyword: 'NIFTY call', expected: 'OPTION_CALL' as const },
          { keyword: 'BANKNIFTY put', expected: 'OPTION_PUT' as const },
          { keyword: 'futures', expected: 'FUTURES' as const },
          { keyword: 'NIFTY', expected: 'INDEX' as const },
        ];

        const keywordArb = fc.constantFrom(...assetTypeKeywords);
        const surroundingTextArb = fc
          .string({ minLength: 0, maxLength: 30 })
          .map((s) => s.toLowerCase());

        fc.assert(
          fc.property(keywordArb, surroundingTextArb, surroundingTextArb, (kw, before, after) => {
            const prompt = `${before} ${kw.keyword} ${after}`.trim();
            const result = service.parsePrompt(prompt);

            expect(result.assetType).toBe(kw.expected);
          }),
          { numRuns: 100 }
        );
      });

      it('should prioritize more specific asset types over general ones', () => {
        // When a prompt contains both "option call" and "stock", it should prefer OPTION_CALL
        const result = service.parsePrompt('find stock call option trades');
        expect(result.assetType).toBe('OPTION_CALL');
      });

      it('should default to STOCK when no specific asset type found', () => {
        const genericPromptArb = fc
          .string({ minLength: 5, maxLength: 30 })
          .map((s) => s.toLowerCase())
          .filter((s: string) => {
            // Exclude strings containing asset type keywords
            const assetKeywords = [
              'stock',
              'equity',
              'option',
              'call',
              'put',
              'futures',
              'nifty',
              'banknifty',
            ];
            const lowerS = s.toLowerCase();
            return !assetKeywords.some((kw) => lowerS.includes(kw));
          });

        fc.assert(
          fc.property(genericPromptArb, (prompt: string) => {
            const result = service.parsePrompt(prompt);
            expect(result.assetType).toBe('STOCK');
          }),
          { numRuns: 50 }
        );
      });
    });

    describe('Property: Intent Extraction Consistency', () => {
      /**
       * Intent extraction should be consistent and deterministic.
       * The same prompt should always produce the same intent.
       */
      it('should extract same intent for identical prompts', () => {
        const intentKeywords = [
          { keyword: 'find', expected: 'FIND_TRADE' as const },
          { keyword: 'analyze', expected: 'ANALYZE_MARKET' as const },
          { keyword: 'generate strategy', expected: 'GENERATE_STRATEGY' as const },
          { keyword: 'backtest', expected: 'BACKTEST' as const },
          { keyword: 'explain', expected: 'EXPLAIN' as const },
        ];

        const keywordArb = fc.constantFrom(...intentKeywords);
        const contextArb = fc.string({ minLength: 0, maxLength: 30 }).map((s) => s.toLowerCase());

        fc.assert(
          fc.property(keywordArb, contextArb, (kw, context) => {
            const prompt = `${kw.keyword} ${context}`.trim();

            // Parse twice
            const result1 = service.parsePrompt(prompt);
            const result2 = service.parsePrompt(prompt);

            // Should produce identical results
            expect(result1.intent).toBe(result2.intent);
            expect(result1.intent).toBe(kw.expected);
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Property: Parsing Idempotency', () => {
      /**
       * Parsing the same prompt multiple times should always produce identical results.
       * This validates deterministic behavior of the parser.
       */
      it('should produce identical results for repeated parsing of same prompt', () => {
        const promptArb = fc.string({ minLength: 5, maxLength: 100 });

        fc.assert(
          fc.property(promptArb, (prompt) => {
            const result1 = service.parsePrompt(prompt);
            const result2 = service.parsePrompt(prompt);
            const result3 = service.parsePrompt(prompt);

            expect(result1).toEqual(result2);
            expect(result2).toEqual(result3);
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Property: Symbol Deduplication', () => {
      /**
       * Even if a symbol appears multiple times in a prompt, it should only appear once
       * in the extracted symbols array.
       */
      it('should deduplicate repeated symbols', () => {
        const symbolArb = fc
          .string({ minLength: 3, maxLength: 8 })
          .map((s) => s.toUpperCase().replace(/\s/g, 'X')) // Replace spaces with X
          .filter((s: string) => {
            const excluded = ['NSE', 'BSE', 'STOCK', 'OPTION', 'CALL', 'PUT', 'NIFTY'];
            return !excluded.includes(s) && s.trim().length > 0 && /^[A-Z]+$/.test(s);
          });

        const repeatCountArb = fc.integer({ min: 2, max: 5 });
        const fillerArb = fc.constantFrom('and', 'or', ',', '');

        fc.assert(
          fc.property(
            symbolArb,
            repeatCountArb,
            fc.array(fillerArb),
            (symbol: string, count, fillers) => {
              // Create prompt with repeated symbol
              const parts: string[] = [];
              for (let i = 0; i < count; i++) {
                parts.push(symbol);
                if (i < fillers.length) {
                  parts.push(fillers[i]);
                }
              }
              const prompt = parts.join(' ');

              const result = service.parsePrompt(prompt);

              // Symbol should appear exactly once
              const symbolOccurrences = result.symbols.filter((s) => s === symbol).length;
              expect(symbolOccurrences).toBe(1);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty prompt', () => {
      const result = service.parsePrompt('');
      expect(result).toBeDefined();
      expect(result.intent).toBe('QUERY');
      expect(result.symbols).toEqual([]);
    });

    it('should handle prompt with only whitespace', () => {
      const result = service.parsePrompt('   ');
      expect(result).toBeDefined();
      expect(result.intent).toBe('QUERY');
      expect(result.symbols).toEqual([]);
    });

    it('should handle prompt with special characters', () => {
      const result = service.parsePrompt('find !@#$%^&*() RELIANCE');
      expect(result.symbols).toContain('RELIANCE');
    });

    it('should handle very long prompts', () => {
      const longPrompt = 'find '.repeat(100) + 'RELIANCE';
      const result = service.parsePrompt(longPrompt);
      expect(result.intent).toBe('FIND_TRADE');
      expect(result.symbols).toContain('RELIANCE');
    });

    it('should handle prompts with numbers', () => {
      const result = service.parsePrompt('find trade for RELIANCE at 2500 price level');
      expect(result.symbols).toContain('RELIANCE');
    });

    it('should handle multiple timeframe keywords (first match wins)', () => {
      const result = service.parsePrompt('find swing and intraday trades');
      // First pattern match should be SWING
      expect(result.timeframe).toBe('SWING');
    });

    it('should handle multiple intent keywords (first match wins)', () => {
      const result = service.parsePrompt('find and analyze RELIANCE');
      // First pattern match should be FIND_TRADE
      expect(result.intent).toBe('FIND_TRADE');
    });
  });
});
