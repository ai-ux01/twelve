import { Logger } from '@nestjs/common';
import { OptionContractDto, OptionsChainDataDto } from '../../options/dto/options-chain.dto';

/**
 * Options Recommendation Interface
 *
 * Represents a structured options trading recommendation from AI.
 * Includes contract details, risk assessment, and invalidation criteria.
 *
 * Requirements: 4.7, 7.1
 */
export interface OptionsRecommendation {
  symbol: string; // NIFTY or BANKNIFTY
  strike: number; // Strike price
  type: 'CALL' | 'PUT'; // Option type
  expiry: string; // Expiry date (YYYY-MM-DD format)
  action: 'BUY' | 'SELL' | 'HOLD'; // Trading action
  confidence: number; // 0.0 to 1.0
  reasoning: string; // AI reasoning for the recommendation
  riskAssessment: {
    maxLoss: number; // Maximum potential loss
    maxGain: number; // Maximum potential gain
    riskRewardRatio: number; // Risk:Reward ratio
    liquidityRisk: 'LOW' | 'MEDIUM' | 'HIGH'; // Liquidity risk level
    iVRisk: 'LOW' | 'MEDIUM' | 'HIGH'; // Implied volatility risk
    timeDecayRisk: 'LOW' | 'MEDIUM' | 'HIGH'; // Theta decay risk
  };
  invalidationCriteria: {
    stopLoss: number; // Stop loss price for the underlying
    timeStop: string; // Time-based exit (e.g., "Exit if no movement in 1 hour")
    technicalStop: string; // Technical level invalidation (e.g., "Exit if support breaks at 21000")
  };
  contractDetails?: {
    ltp: number; // Last traded price
    bid: number;
    ask: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    impliedVolatility: number;
    openInterest: number;
    volume: number;
  };
}

/**
 * Options Recommendation Parser
 *
 * Parses AI responses into structured OptionsRecommendation objects.
 * Validates recommendations against available contracts in the options chain.
 *
 * CRITICAL: Ensures recommended options contracts actually exist.
 *
 * Requirements: 4.7, 7.1
 */
export class OptionsRecommendationParser {
  private readonly logger = new Logger(OptionsRecommendationParser.name);

  /**
   * Parse AI response into OptionsRecommendation object
   *
   * @param aiResponse - Raw AI response string
   * @param optionsChain - Available options chain data for validation
   * @returns Parsed and validated OptionsRecommendation
   * @throws Error if parsing fails or recommendation is invalid
   */
  parseRecommendation(
    aiResponse: string,
    optionsChain: OptionsChainDataDto
  ): OptionsRecommendation {
    this.logger.debug('Parsing options recommendation from AI response');

    try {
      // Extract JSON from response (in case there's additional text)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      this.validateRequiredFields(parsed);

      // Extract recommendation details
      const recommendation: OptionsRecommendation = {
        symbol: parsed.symbol || optionsChain.symbol,
        strike: parseFloat(parsed.strike),
        type: parsed.type,
        expiry: parsed.expiry || optionsChain.expiryDate,
        action: parsed.action,
        confidence: Math.min(Math.max(parseFloat(parsed.confidence), 0), 1), // Clamp 0-1
        reasoning: parsed.reasoning || 'No reasoning provided',
        riskAssessment: this.parseRiskAssessment(parsed.riskAssessment),
        invalidationCriteria: this.parseInvalidationCriteria(parsed.invalidationCriteria),
      };

      // Validate recommendation matches available contracts
      const matchingContract = this.findMatchingContract(recommendation, optionsChain);
      if (!matchingContract) {
        throw new Error(
          `Recommended contract not found: ${recommendation.symbol} ${recommendation.strike} ${recommendation.type} expiring ${recommendation.expiry}`
        );
      }

      // Attach contract details
      recommendation.contractDetails = this.extractContractDetails(matchingContract);

      // Validate liquidity and warn if contract is illiquid
      this.validateLiquidity(matchingContract);

      this.logger.debug(
        `Parsed recommendation: ${recommendation.action} ${recommendation.symbol} ${recommendation.strike} ${recommendation.type}`
      );

      return recommendation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to parse options recommendation: ${errorMessage}`);
      this.logger.debug(`Raw response: ${aiResponse}`);
      throw new Error(`Options recommendation parsing failed: ${errorMessage}`);
    }
  }

  /**
   * Validate required fields in parsed response
   */
  private validateRequiredFields(parsed: any): void {
    const requiredFields = ['strike', 'type', 'action', 'confidence', 'reasoning'];
    const missingFields = requiredFields.filter((field) => !(field in parsed));

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate action
    if (!['BUY', 'SELL', 'HOLD'].includes(parsed.action)) {
      throw new Error(`Invalid action: ${parsed.action}. Must be BUY, SELL, or HOLD`);
    }

    // Validate option type
    if (!['CALL', 'PUT'].includes(parsed.type)) {
      throw new Error(`Invalid option type: ${parsed.type}. Must be CALL or PUT`);
    }

    // Validate strike
    const strike = parseFloat(parsed.strike);
    if (isNaN(strike) || strike <= 0) {
      throw new Error(`Invalid strike price: ${parsed.strike}`);
    }

    // Validate confidence
    const confidence = parseFloat(parsed.confidence);
    if (isNaN(confidence)) {
      throw new Error(`Invalid confidence: ${parsed.confidence}. Must be a number`);
    }
  }

  /**
   * Parse risk assessment from AI response
   */
  private parseRiskAssessment(riskData: any): OptionsRecommendation['riskAssessment'] {
    if (!riskData) {
      // Provide default risk assessment if not provided
      return {
        maxLoss: 0,
        maxGain: 0,
        riskRewardRatio: 0,
        liquidityRisk: 'MEDIUM',
        iVRisk: 'MEDIUM',
        timeDecayRisk: 'MEDIUM',
      };
    }

    return {
      maxLoss: parseFloat(riskData.maxLoss) || 0,
      maxGain: parseFloat(riskData.maxGain) || 0,
      riskRewardRatio: parseFloat(riskData.riskRewardRatio) || 0,
      liquidityRisk: this.validateRiskLevel(riskData.liquidityRisk),
      iVRisk: this.validateRiskLevel(riskData.iVRisk),
      timeDecayRisk: this.validateRiskLevel(riskData.timeDecayRisk),
    };
  }

  /**
   * Parse invalidation criteria from AI response
   */
  private parseInvalidationCriteria(
    invalidationData: any
  ): OptionsRecommendation['invalidationCriteria'] {
    if (!invalidationData) {
      // Provide default invalidation criteria if not provided
      return {
        stopLoss: 0,
        timeStop: 'Exit if no movement in 1 hour',
        technicalStop: 'Exit if key technical level breaks',
      };
    }

    return {
      stopLoss: parseFloat(invalidationData.stopLoss) || 0,
      timeStop: invalidationData.timeStop || 'Exit if no movement in 1 hour',
      technicalStop: invalidationData.technicalStop || 'Exit if key technical level breaks',
    };
  }

  /**
   * Validate risk level value
   */
  private validateRiskLevel(level: any): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (['LOW', 'MEDIUM', 'HIGH'].includes(level)) {
      return level;
    }
    return 'MEDIUM'; // Default to MEDIUM if invalid
  }

  /**
   * Find matching contract in options chain
   *
   * Validates that the recommended contract actually exists in the available chain.
   * This prevents AI from recommending non-existent contracts.
   */
  private findMatchingContract(
    recommendation: OptionsRecommendation,
    optionsChain: OptionsChainDataDto
  ): OptionContractDto | null {
    return (
      optionsChain.contracts.find(
        (contract) =>
          contract.strikePrice === recommendation.strike &&
          contract.optionType === recommendation.type &&
          contract.expiryDate === recommendation.expiry
      ) || null
    );
  }

  /**
   * Extract contract details from matching contract
   */
  private extractContractDetails(
    contract: OptionContractDto
  ): OptionsRecommendation['contractDetails'] {
    return {
      ltp: contract.ltp,
      bid: contract.bid,
      ask: contract.ask,
      delta: contract.delta || 0,
      gamma: contract.gamma || 0,
      theta: contract.theta || 0,
      vega: contract.vega || 0,
      impliedVolatility: contract.impliedVolatility,
      openInterest: contract.openInterest,
      volume: contract.volume,
    };
  }

  /**
   * Validate contract liquidity and log warnings
   *
   * Checks liquidity warnings and logs concerns about illiquid contracts.
   * Does not reject the recommendation but warns the user.
   */
  private validateLiquidity(contract: OptionContractDto): void {
    if (!contract.liquidityWarning) {
      return; // No liquidity concerns
    }

    const warnings: string[] = [];

    if (contract.liquidityWarning.wideBidAskSpread) {
      warnings.push('Wide bid-ask spread');
    }
    if (contract.liquidityWarning.lowVolume) {
      warnings.push('Low trading volume');
    }
    if (contract.liquidityWarning.lowOI) {
      warnings.push('Low open interest');
    }
    if (contract.liquidityWarning.deepOTM) {
      warnings.push('Deep out-of-the-money');
    }

    if (warnings.length > 0) {
      this.logger.warn(
        `Liquidity concerns for ${contract.symbol} ${contract.strikePrice} ${contract.optionType}: ${warnings.join(', ')}`
      );
    }
  }

  /**
   * Parse multiple recommendations from AI response
   *
   * Some AI responses may contain multiple options recommendations.
   * This method extracts all recommendations and validates each one.
   *
   * @param aiResponse - Raw AI response string
   * @param optionsChain - Available options chain data for validation
   * @returns Array of parsed and validated OptionsRecommendations
   */
  parseMultipleRecommendations(
    aiResponse: string,
    optionsChain: OptionsChainDataDto
  ): OptionsRecommendation[] {
    this.logger.debug('Parsing multiple options recommendations from AI response');

    try {
      // Try to extract JSON array
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => {
              try {
                // Convert each item to JSON string and parse
                const itemJson = JSON.stringify(item);
                return this.parseRecommendation(itemJson, optionsChain);
              } catch (error) {
                this.logger.warn(`Skipping invalid recommendation: ${error}`);
                return null;
              }
            })
            .filter((rec): rec is OptionsRecommendation => rec !== null);
        }
      }

      // If no array found, try parsing as single recommendation
      return [this.parseRecommendation(aiResponse, optionsChain)];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to parse multiple options recommendations: ${errorMessage}`);
      throw new Error(`Multiple options recommendations parsing failed: ${errorMessage}`);
    }
  }
}
