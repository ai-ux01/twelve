import { OptionsRecommendationParser, OptionsRecommendation } from './options-recommendation.parser';
import { OptionsChainDataDto, OptionContractDto } from '../../options/dto/options-chain.dto';

describe('OptionsRecommendationParser', () => {
  let parser: OptionsRecommendationParser;
  let mockOptionsChain: OptionsChainDataDto;

  beforeEach(() => {
    parser = new OptionsRecommendationParser();

    // Create mock options chain data
    mockOptionsChain = {
      symbol: 'NIFTY',
      expiryDate: '2024-12-26',
      spotPrice: 21500,
      timestamp: new Date('2024-12-20T10:00:00Z'),
      contracts: [
        {
          symbol: 'NIFTY',
          strikePrice: 21000,
          optionType: 'CALL',
          expiryDate: '2024-12-26',
          ltp: 550,
          bid: 548,
          ask: 552,
          openInterest: 1000000,
          changeInOI: 50000,
          volume: 50000,
          impliedVolatility: 15.5,
          delta: 0.75,
          gamma: 0.002,
          theta: -10.5,
          vega: 25.3,
        },
        {
          symbol: 'NIFTY',
          strikePrice: 21500,
          optionType: 'CALL',
          expiryDate: '2024-12-26',
          ltp: 300,
          bid: 298,
          ask: 302,
          openInterest: 2000000,
          changeInOI: 100000,
          volume: 100000,
          impliedVolatility: 16.0,
          delta: 0.52,
          gamma: 0.003,
          theta: -12.5,
          vega: 45.2,
        },
        {
          symbol: 'NIFTY',
          strikePrice: 21500,
          optionType: 'PUT',
          expiryDate: '2024-12-26',
          ltp: 280,
          bid: 278,
          ask: 282,
          openInterest: 1800000,
          changeInOI: 80000,
          volume: 90000,
          impliedVolatility: 15.8,
          delta: -0.48,
          gamma: 0.003,
          theta: -11.8,
          vega: 44.5,
        },
        {
          symbol: 'NIFTY',
          strikePrice: 22000,
          optionType: 'CALL',
          expiryDate: '2024-12-26',
          ltp: 120,
          bid: 118,
          ask: 122,
          openInterest: 500000,
          changeInOI: 20000,
          volume: 10000,
          impliedVolatility: 17.5,
          delta: 0.28,
          gamma: 0.002,
          theta: -8.5,
          vega: 30.2,
          liquidityWarning: {
            wideBidAskSpread: false,
            lowVolume: true,
            lowOI: false,
            deepOTM: false,
          },
        },
      ],
      pcrAnalysis: {
        pcrByOI: 0.9,
        pcrByVolume: 0.95,
        sentiment: 'NEUTRAL',
        totalCallOI: 3500000,
        totalPutOI: 3150000,
        totalCallVolume: 160000,
        totalPutVolume: 152000,
      },
      atmAnalysis: {
        spotPrice: 21500,
        atmStrike: 21500,
        strikeInterval: 50,
        nearATMStrikes: [],
      },
      oiAnalysis: {
        buildupType: 'NEUTRAL',
        explanation: 'No significant buildup pattern',
        supportLevels: [],
        resistanceLevels: [],
        maxCallOIStrike: 21500,
        maxPutOIStrike: 21500,
        oiChangeAnalysis: [],
      },
      liquidityMetrics: {
        totalContracts: 4,
        liquidContracts: 3,
        illiquidContracts: 1,
        averageVolume: 62500,
        averageOI: 1325000,
        averageBidAskSpread: 3.5,
      },
    };
  });

  describe('parseRecommendation', () => {
    it('should parse valid options recommendation with all fields', () => {
      const aiResponse = JSON.stringify({
        symbol: 'NIFTY',
        strike: 21500,
        type: 'CALL',
        expiry: '2024-12-26',
        action: 'BUY',
        confidence: 0.75,
        reasoning: 'Strong uptrend with high volume at ATM strike',
        riskAssessment: {
          maxLoss: 300,
          maxGain: 500,
          riskRewardRatio: 1.67,
          liquidityRisk: 'LOW',
          iVRisk: 'MEDIUM',
          timeDecayRisk: 'LOW',
        },
        invalidationCriteria: {
          stopLoss: 21400,
          timeStop: 'Exit if no movement in 2 hours',
          technicalStop: 'Exit if support at 21450 breaks',
        },
      });

      const result = parser.parseRecommendation(aiResponse, mockOptionsChain);

      expect(result.symbol).toBe('NIFTY');
      expect(result.strike).toBe(21500);
      expect(result.type).toBe('CALL');
      expect(result.expiry).toBe('2024-12-26');
      expect(result.action).toBe('BUY');
      expect(result.confidence).toBe(0.75);
      expect(result.reasoning).toBe('Strong uptrend with high volume at ATM strike');

      // Check risk assessment
      expect(result.riskAssessment.maxLoss).toBe(300);
      expect(result.riskAssessment.maxGain).toBe(500);
      expect(result.riskAssessment.riskRewardRatio).toBe(1.67);
      expect(result.riskAssessment.liquidityRisk).toBe('LOW');

      // Check invalidation criteria
      expect(result.invalidationCriteria.stopLoss).toBe(21400);
      expect(result.invalidationCriteria.timeStop).toBe('Exit if no movement in 2 hours');

      // Check contract details are attached
      expect(result.contractDetails).toBeDefined();
      expect(result.contractDetails?.ltp).toBe(300);
      expect(result.contractDetails?.delta).toBe(0.52);
    });

    it('should parse recommendation with default risk assessment if not provided', () => {
      const aiResponse = JSON.stringify({
        strike: 21000,
        type: 'CALL',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Breakout confirmation',
      });

      const result = parser.parseRecommendation(aiResponse, mockOptionsChain);

      expect(result.riskAssessment).toBeDefined();
      expect(result.riskAssessment.liquidityRisk).toBe('MEDIUM');
      expect(result.riskAssessment.iVRisk).toBe('MEDIUM');
      expect(result.riskAssessment.timeDecayRisk).toBe('MEDIUM');
    });

    it('should parse recommendation with default invalidation criteria if not provided', () => {
      const aiResponse = JSON.stringify({
        strike: 21000,
        type: 'CALL',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Breakout confirmation',
      });

      const result = parser.parseRecommendation(aiResponse, mockOptionsChain);

      expect(result.invalidationCriteria).toBeDefined();
      expect(result.invalidationCriteria.stopLoss).toBe(0);
      expect(result.invalidationCriteria.timeStop).toBe('Exit if no movement in 1 hour');
      expect(result.invalidationCriteria.technicalStop).toBe('Exit if key technical level breaks');
    });

    it('should use chain symbol and expiry if not provided in response', () => {
      const aiResponse = JSON.stringify({
        strike: 21500,
        type: 'PUT',
        action: 'SELL',
        confidence: 0.65,
        reasoning: 'Resistance holding',
      });

      const result = parser.parseRecommendation(aiResponse, mockOptionsChain);

      expect(result.symbol).toBe('NIFTY');
      expect(result.expiry).toBe('2024-12-26');
    });

    it('should clamp confidence to 0-1 range', () => {
      const aiResponse1 = JSON.stringify({
        strike: 21000,
        type: 'CALL',
        action: 'BUY',
        confidence: 1.5, // > 1
        reasoning: 'Test',
      });

      const result1 = parser.parseRecommendation(aiResponse1, mockOptionsChain);
      expect(result1.confidence).toBe(1);

      const aiResponse2 = JSON.stringify({
        strike: 21000,
        type: 'CALL',
        action: 'BUY',
        confidence: -0.2, // < 0
        reasoning: 'Test',
      });

      const result2 = parser.parseRecommendation(aiResponse2, mockOptionsChain);
      expect(result2.confidence).toBe(0);
    });

    it('should extract JSON from response with additional text', () => {
      const aiResponse = `
        Here is my recommendation:
        ${JSON.stringify({
          strike: 21500,
          type: 'CALL',
          action: 'BUY',
          confidence: 0.7,
          reasoning: 'Good setup',
        })}
        Hope this helps!
      `;

      const result = parser.parseRecommendation(aiResponse, mockOptionsChain);

      expect(result.strike).toBe(21500);
      expect(result.action).toBe('BUY');
    });

    it('should throw error if no JSON found in response', () => {
      const aiResponse = 'This is just text without JSON';

      expect(() => parser.parseRecommendation(aiResponse, mockOptionsChain)).toThrow(
        'No JSON found in AI response'
      );
    });

    it('should throw error if required field is missing', () => {
      const aiResponse = JSON.stringify({
        strike: 21500,
        type: 'CALL',
        // Missing action
        confidence: 0.7,
        reasoning: 'Test',
      });

      expect(() => parser.parseRecommendation(aiResponse, mockOptionsChain)).toThrow(
        'Missing required fields: action'
      );
    });

    it('should throw error if action is invalid', () => {
      const aiResponse = JSON.stringify({
        strike: 21500,
        type: 'CALL',
        action: 'MAYBE', // Invalid action
        confidence: 0.7,
        reasoning: 'Test',
      });

      expect(() => parser.parseRecommendation(aiResponse, mockOptionsChain)).toThrow(
        'Invalid action: MAYBE'
      );
    });

    it('should throw error if option type is invalid', () => {
      const aiResponse = JSON.stringify({
        strike: 21500,
        type: 'FUTURE', // Invalid type
        action: 'BUY',
        confidence: 0.7,
        reasoning: 'Test',
      });

      expect(() => parser.parseRecommendation(aiResponse, mockOptionsChain)).toThrow(
        'Invalid option type: FUTURE'
      );
    });

    it('should throw error if strike price is invalid', () => {
      const aiResponse = JSON.stringify({
        strike: 'invalid', // Non-numeric
        type: 'CALL',
        action: 'BUY',
        confidence: 0.7,
        reasoning: 'Test',
      });

      expect(() => parser.parseRecommendation(aiResponse, mockOptionsChain)).toThrow(
        'Invalid strike price'
      );
    });

    it('should throw error if confidence is out of range', () => {
      const aiResponse = JSON.stringify({
        strike: 21500,
        type: 'CALL',
        action: 'BUY',
        confidence: 'high', // Non-numeric
        reasoning: 'Test',
      });

      expect(() => parser.parseRecommendation(aiResponse, mockOptionsChain)).toThrow(
        'Invalid confidence'
      );
    });

    it('should throw error if recommended contract does not exist in chain', () => {
      const aiResponse = JSON.stringify({
        strike: 99999, // Non-existent strike
        type: 'CALL',
        expiry: '2024-12-26',
        action: 'BUY',
        confidence: 0.7,
        reasoning: 'Test',
      });

      expect(() => parser.parseRecommendation(aiResponse, mockOptionsChain)).toThrow(
        'Recommended contract not found'
      );
    });

    it('should log warning for illiquid contracts but not reject', () => {
      const aiResponse = JSON.stringify({
        strike: 22000, // Contract with low volume
        type: 'CALL',
        action: 'BUY',
        confidence: 0.7,
        reasoning: 'Test',
      });

      // Should not throw, but log warning
      const result = parser.parseRecommendation(aiResponse, mockOptionsChain);
      expect(result.strike).toBe(22000);
    });

    it('should validate risk level values and default to MEDIUM for invalid', () => {
      const aiResponse = JSON.stringify({
        strike: 21500,
        type: 'CALL',
        action: 'BUY',
        confidence: 0.7,
        reasoning: 'Test',
        riskAssessment: {
          maxLoss: 100,
          maxGain: 200,
          riskRewardRatio: 2.0,
          liquidityRisk: 'INVALID', // Invalid level
          iVRisk: 'LOW',
          timeDecayRisk: 'HIGH',
        },
      });

      const result = parser.parseRecommendation(aiResponse, mockOptionsChain);
      expect(result.riskAssessment.liquidityRisk).toBe('MEDIUM'); // Defaulted
      expect(result.riskAssessment.iVRisk).toBe('LOW'); // Valid
      expect(result.riskAssessment.timeDecayRisk).toBe('HIGH'); // Valid
    });
  });

  describe('parseMultipleRecommendations', () => {
    it('should parse array of multiple recommendations', () => {
      const aiResponse = JSON.stringify([
        {
          strike: 21000,
          type: 'CALL',
          action: 'BUY',
          confidence: 0.8,
          reasoning: 'First recommendation',
        },
        {
          strike: 21500,
          type: 'PUT',
          action: 'SELL',
          confidence: 0.7,
          reasoning: 'Second recommendation',
        },
      ]);

      const results = parser.parseMultipleRecommendations(aiResponse, mockOptionsChain);

      expect(results).toHaveLength(2);
      expect(results[0].strike).toBe(21000);
      expect(results[0].type).toBe('CALL');
      expect(results[1].strike).toBe(21500);
      expect(results[1].type).toBe('PUT');
    });

    it('should skip invalid recommendations in array', () => {
      const aiResponse = JSON.stringify([
        {
          strike: 21000,
          type: 'CALL',
          action: 'BUY',
          confidence: 0.8,
          reasoning: 'Valid',
        },
        {
          strike: 99999, // Invalid - contract doesn't exist
          type: 'CALL',
          action: 'BUY',
          confidence: 0.7,
          reasoning: 'Invalid',
        },
        {
          strike: 21500,
          type: 'PUT',
          action: 'SELL',
          confidence: 0.6,
          reasoning: 'Valid',
        },
      ]);

      const results = parser.parseMultipleRecommendations(aiResponse, mockOptionsChain);

      // Should only return valid recommendations
      expect(results).toHaveLength(2);
      expect(results[0].strike).toBe(21000);
      expect(results[1].strike).toBe(21500);
    });

    it('should parse single recommendation if no array found', () => {
      const aiResponse = JSON.stringify({
        strike: 21500,
        type: 'CALL',
        action: 'BUY',
        confidence: 0.75,
        reasoning: 'Single recommendation',
      });

      const results = parser.parseMultipleRecommendations(aiResponse, mockOptionsChain);

      expect(results).toHaveLength(1);
      expect(results[0].strike).toBe(21500);
    });

    it('should throw error if parsing completely fails', () => {
      const aiResponse = 'Not valid JSON at all';

      expect(() => parser.parseMultipleRecommendations(aiResponse, mockOptionsChain)).toThrow(
        'Multiple options recommendations parsing failed'
      );
    });
  });

  describe('contract validation', () => {
    it('should match contract by strike, type, and expiry', () => {
      const aiResponse = JSON.stringify({
        strike: 21000,
        type: 'CALL',
        expiry: '2024-12-26',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Test',
      });

      const result = parser.parseRecommendation(aiResponse, mockOptionsChain);

      expect(result.contractDetails).toBeDefined();
      expect(result.contractDetails?.ltp).toBe(550);
      expect(result.contractDetails?.delta).toBe(0.75);
    });

    it('should throw error if strike exists but wrong option type', () => {
      const aiResponse = JSON.stringify({
        strike: 21000,
        type: 'PUT', // CALL exists, but not PUT at this strike
        expiry: '2024-12-26',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Test',
      });

      expect(() => parser.parseRecommendation(aiResponse, mockOptionsChain)).toThrow(
        'Recommended contract not found'
      );
    });

    it('should throw error if expiry does not match', () => {
      const aiResponse = JSON.stringify({
        strike: 21000,
        type: 'CALL',
        expiry: '2025-01-30', // Different expiry
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Test',
      });

      expect(() => parser.parseRecommendation(aiResponse, mockOptionsChain)).toThrow(
        'Recommended contract not found'
      );
    });
  });

  describe('contract details extraction', () => {
    it('should extract all contract details correctly', () => {
      const aiResponse = JSON.stringify({
        strike: 21500,
        type: 'CALL',
        action: 'BUY',
        confidence: 0.75,
        reasoning: 'Test',
      });

      const result = parser.parseRecommendation(aiResponse, mockOptionsChain);

      expect(result.contractDetails).toEqual({
        ltp: 300,
        bid: 298,
        ask: 302,
        delta: 0.52,
        gamma: 0.003,
        theta: -12.5,
        vega: 45.2,
        impliedVolatility: 16.0,
        openInterest: 2000000,
        volume: 100000,
      });
    });

    it('should handle missing Greeks gracefully', () => {
      // Add contract without Greeks
      const chainWithoutGreeks = {
        ...mockOptionsChain,
        contracts: [
          {
            symbol: 'NIFTY',
            strikePrice: 23000,
            optionType: 'CALL' as const,
            expiryDate: '2024-12-26',
            ltp: 50,
            bid: 48,
            ask: 52,
            openInterest: 100000,
            changeInOI: 5000,
            volume: 5000,
            impliedVolatility: 20.0,
            // No Greeks
          },
        ],
      };

      const aiResponse = JSON.stringify({
        strike: 23000,
        type: 'CALL',
        action: 'BUY',
        confidence: 0.6,
        reasoning: 'Test',
      });

      const result = parser.parseRecommendation(aiResponse, chainWithoutGreeks);

      expect(result.contractDetails?.delta).toBe(0);
      expect(result.contractDetails?.gamma).toBe(0);
      expect(result.contractDetails?.theta).toBe(0);
      expect(result.contractDetails?.vega).toBe(0);
    });
  });
});
