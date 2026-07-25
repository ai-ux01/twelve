import { Test, TestingModule } from '@nestjs/testing';
import { PromptService } from './prompt.service';
import * as fc from 'fast-check';
import { it } from '@fast-check/jest';

/**
 * Property-Based Tests for PromptService - Asset Type Extraction Consistency
 *
 * **Validates: Requirements 19.4**
 *
 * Property 7: Asset Type Extraction Consistency
 *
 * For any user prompt containing asset type keywords (stock, option, call, put),
 * the parser SHALL correctly identify the asset type.
 */
describe('PromptService - Property 7: Asset Type Extraction Consistency', () => {
  let service: PromptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptService],
    }).compile();

    service = module.get<PromptService>(PromptService);
  });

  /**
   * Arbitrary generators for test data
   */

  // Generator for surrounding text (non-asset-type words)
  const surroundingTextArb = fc
    .string({ minLength: 0, maxLength: 30 })
    .map((s) => s.toLowerCase())
    .filter((s: string) => {
      // Exclude strings that might contain asset type keywords
      const assetKeywords = [
        'stock',
        'equity',
        'share',
        'option',
        'call',
        'put',
        'futures',
        'nifty',
        'banknifty',
        'sensex',
        'index',
      ];
      const lowerS = s.toLowerCase();
      return !assetKeywords.some((kw) => lowerS.includes(kw));
    });

  // Generator for position (before/middle/after)
  const positionArb = fc.constantFrom('before', 'after', 'middle');

  // Generator for case variations
  const caseTransformArb = fc.constantFrom<(s: string) => string>(
    (s) => s.toLowerCase(),
    (s) => s.toUpperCase(),
    (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(), // Title case
    (s) => s // Original case
  );

  /**
   * Property Test: STOCK asset type extraction
   *
   * Test that stock-related keywords are correctly identified as STOCK asset type
   */
  it.prop([
    fc.constantFrom('stock', 'equity', 'share'),
    surroundingTextArb,
    surroundingTextArb,
    caseTransformArb,
  ])(
    'should consistently extract STOCK asset type regardless of keyword position or case',
    async (
      keyword: string,
      beforeText: string,
      afterText: string,
      caseTransform: (s: string) => string
    ) => {
      // Apply case transformation
      const transformedKeyword = caseTransform(keyword);

      // Build prompt with keyword at different positions
      const prompt = `${beforeText} ${transformedKeyword} ${afterText}`.trim();

      // Parse prompt
      const result = service.parsePrompt(prompt);

      // Verify STOCK is extracted
      expect(result.assetType).toBe('STOCK');
    }
  );

  /**
   * Property Test: INDEX asset type extraction
   *
   * Test that index-related keywords (NIFTY, BANKNIFTY, SENSEX) are correctly identified
   */
  it.prop([
    fc.constantFrom('nifty', 'banknifty', 'sensex', 'NIFTY', 'BANKNIFTY', 'SENSEX'),
    surroundingTextArb,
    surroundingTextArb,
  ])(
    'should consistently extract INDEX asset type for index keywords',
    async (keyword: string, beforeText: string, afterText: string) => {
      // Build prompt
      const prompt = `${beforeText} ${keyword} ${afterText}`.trim();

      // Parse prompt
      const result = service.parsePrompt(prompt);

      // Verify INDEX is extracted (unless it's a more specific option type)
      // Note: NIFTY/BANKNIFTY with "call" or "put" should be OPTION_CALL/OPTION_PUT
      if (!prompt.toLowerCase().includes('call') && !prompt.toLowerCase().includes('put')) {
        expect(result.assetType).toBe('INDEX');
      }
    }
  );

  /**
   * Property Test: OPTION_CALL asset type extraction
   *
   * Test that call option keywords are correctly identified as OPTION_CALL
   * Note: Standalone "call" without "option" or "nifty/banknifty" context is not recognized
   * as it could be ambiguous (e.g., "call the broker")
   */
  it.prop([
    fc.constantFrom(
      'call option',
      'option call',
      'nifty call',
      'banknifty call',
      'CALL OPTION',
      'Call Option',
      'NIFTY CALL',
      'BANKNIFTY Call'
    ),
    surroundingTextArb,
    surroundingTextArb,
  ])(
    'should consistently extract OPTION_CALL asset type',
    async (keyword: string, beforeText: string, afterText: string) => {
      // Build prompt
      const prompt = `${beforeText} ${keyword} ${afterText}`.trim();

      // Parse prompt
      const result = service.parsePrompt(prompt);

      // Verify OPTION_CALL is extracted
      expect(result.assetType).toBe('OPTION_CALL');
    }
  );

  /**
   * Property Test: OPTION_PUT asset type extraction
   *
   * Test that put option keywords are correctly identified as OPTION_PUT
   * Note: Standalone "put" without "option" or "nifty/banknifty" context is not recognized
   * as it could be ambiguous (e.g., "put the order")
   */
  it.prop([
    fc.constantFrom(
      'put option',
      'option put',
      'nifty put',
      'banknifty put',
      'PUT OPTION',
      'Put Option',
      'NIFTY PUT',
      'BANKNIFTY Put'
    ),
    surroundingTextArb,
    surroundingTextArb,
  ])(
    'should consistently extract OPTION_PUT asset type',
    async (keyword: string, beforeText: string, afterText: string) => {
      // Build prompt
      const prompt = `${beforeText} ${keyword} ${afterText}`.trim();

      // Parse prompt
      const result = service.parsePrompt(prompt);

      // Verify OPTION_PUT is extracted
      expect(result.assetType).toBe('OPTION_PUT');
    }
  );

  /**
   * Property Test: FUTURES asset type extraction
   *
   * Test that futures keywords are correctly identified as FUTURES
   */
  it.prop([
    fc.constantFrom('futures', 'future', 'FUTURES', 'Future'),
    surroundingTextArb,
    surroundingTextArb,
  ])(
    'should consistently extract FUTURES asset type',
    async (keyword: string, beforeText: string, afterText: string) => {
      // Build prompt
      const prompt = `${beforeText} ${keyword} ${afterText}`.trim();

      // Parse prompt
      const result = service.parsePrompt(prompt);

      // Verify FUTURES is extracted
      expect(result.assetType).toBe('FUTURES');
    }
  );

  /**
   * Property Test: Asset type extraction with multiple symbols
   *
   * Test that asset type is consistently extracted even when prompt contains multiple stock symbols
   */
  it.prop([
    fc.constantFrom('stock', 'call option', 'put option', 'futures', 'nifty'),
    fc.uniqueArray(
      fc
        .string({ minLength: 2, maxLength: 10 })
        .filter((s) => /^[A-Z]+$/.test(s))
        .map((s) => s.toUpperCase()),
      { minLength: 1, maxLength: 3 }
    ),
  ])(
    'should extract asset type consistently regardless of number of symbols',
    async (assetKeyword: string, symbols: string[]) => {
      // Map asset keywords to expected types
      const expectedTypes: Record<string, string> = {
        stock: 'STOCK',
        'call option': 'OPTION_CALL',
        'put option': 'OPTION_PUT',
        futures: 'FUTURES',
        nifty: 'INDEX',
      };

      // Build prompt with symbols
      const symbolsText = symbols.join(' and ');
      const prompt = `find ${assetKeyword} for ${symbolsText}`;

      // Parse prompt
      const result = service.parsePrompt(prompt);

      // Verify asset type is correctly extracted
      expect(result.assetType).toBe(expectedTypes[assetKeyword]);
    }
  );

  /**
   * Property Test: Asset type priority and specificity
   *
   * Test that more specific asset types take precedence over general ones
   * (e.g., "call option" should be OPTION_CALL, not just STOCK or INDEX)
   */
  it.prop([
    fc.constantFrom('nifty call', 'banknifty put', 'stock call option'),
    surroundingTextArb,
  ])(
    'should prioritize specific asset types over general ones',
    async (specificKeyword: string, surroundingText: string) => {
      // Map specific keywords to expected types
      const expectedTypes: Record<string, string> = {
        'nifty call': 'OPTION_CALL',
        'banknifty put': 'OPTION_PUT',
        'stock call option': 'OPTION_CALL',
      };

      // Build prompt
      const prompt = `${surroundingText} ${specificKeyword}`.trim();

      // Parse prompt
      const result = service.parsePrompt(prompt);

      // Verify specific asset type is extracted
      expect(result.assetType).toBe(expectedTypes[specificKeyword]);
    }
  );

  /**
   * Property Test: Default to STOCK when no specific asset type found
   *
   * Test that the parser defaults to STOCK when no asset type keywords are present
   */
  it.prop([
    fc
      .string({ minLength: 5, maxLength: 40 })
      .map((s) => s.toLowerCase())
      .filter((s: string) => {
        // Exclude strings containing asset type keywords
        const assetKeywords = [
          'stock',
          'equity',
          'share',
          'option',
          'call',
          'put',
          'futures',
          'nifty',
          'banknifty',
          'sensex',
        ];
        const lowerS = s.toLowerCase();
        return !assetKeywords.some((kw) => lowerS.includes(kw));
      }),
  ])(
    'should default to STOCK when no specific asset type keywords found',
    async (prompt: string) => {
      // Parse prompt
      const result = service.parsePrompt(prompt);

      // Verify defaults to STOCK
      expect(result.assetType).toBe('STOCK');
    }
  );

  /**
   * Property Test: Idempotency - parsing same prompt multiple times
   *
   * Test that parsing the same prompt multiple times always produces the same asset type
   */
  it.prop([
    fc.constantFrom(
      'find stock trades',
      'analyze nifty call options',
      'look for futures opportunities',
      'banknifty put analysis'
    ),
    fc.integer({ min: 2, max: 5 }),
  ])(
    'should produce identical asset type results when parsing same prompt multiple times',
    async (prompt: string, parseCount: number) => {
      // Parse the same prompt multiple times
      const results = [];
      for (let i = 0; i < parseCount; i++) {
        results.push(service.parsePrompt(prompt));
      }

      // Verify all results have the same asset type
      const firstAssetType = results[0].assetType;
      for (const result of results) {
        expect(result.assetType).toBe(firstAssetType);
      }
    }
  );

  /**
   * Property Test: Case insensitivity
   *
   * Test that asset type extraction is case-insensitive
   */
  it.prop([
    fc.constantFrom(
      { keyword: 'stock', expected: 'STOCK' },
      { keyword: 'CALL OPTION', expected: 'OPTION_CALL' },
      { keyword: 'Put Option', expected: 'OPTION_PUT' },
      { keyword: 'FUTURES', expected: 'FUTURES' },
      { keyword: 'Nifty', expected: 'INDEX' }
    ),
    surroundingTextArb,
  ])(
    'should extract asset type correctly regardless of case',
    async (assetConfig: { keyword: string; expected: string }, surroundingText: string) => {
      // Build prompt
      const prompt = `${surroundingText} ${assetConfig.keyword}`.trim();

      // Parse prompt
      const result = service.parsePrompt(prompt);

      // Verify correct asset type is extracted
      expect(result.assetType).toBe(assetConfig.expected);
    }
  );
});
