import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ScoringWeightsDto } from './dto/scoring-weights.dto';

/**
 * ScoringWeightsService - Manages scoring weight configurations for swing trading
 *
 * Features:
 * - Per-user weight customization
 * - Default weights for non-customized users
 * - Weight validation (must sum to 100%)
 * - Automatic fallback to defaults
 *
 * Requirements covered: 5.3
 */
@Injectable()
export class ScoringWeightsService {
  private readonly logger = new Logger(ScoringWeightsService.name);

  // Default weights as specified in requirements
  private readonly DEFAULT_WEIGHTS = {
    trendWeight: 0.2,
    technicalWeight: 0.2,
    volumeWeight: 0.15,
    relativeStrengthWeight: 0.15,
    breakoutWeight: 0.1,
    sectorWeight: 0.1,
    riskRewardWeight: 0.1,
  };

  constructor(private readonly prisma: PrismaService) {
    this.logger.log('ScoringWeightsService initialized');
  }

  /**
   * Validate that weights sum to 100% (1.0)
   * Requirements: 5.3 - Validate weights sum to 100%
   */
  private validateWeightsSum(weights: Partial<typeof this.DEFAULT_WEIGHTS>): void {
    const sum =
      (weights.trendWeight ?? this.DEFAULT_WEIGHTS.trendWeight) +
      (weights.technicalWeight ?? this.DEFAULT_WEIGHTS.technicalWeight) +
      (weights.volumeWeight ?? this.DEFAULT_WEIGHTS.volumeWeight) +
      (weights.relativeStrengthWeight ?? this.DEFAULT_WEIGHTS.relativeStrengthWeight) +
      (weights.breakoutWeight ?? this.DEFAULT_WEIGHTS.breakoutWeight) +
      (weights.sectorWeight ?? this.DEFAULT_WEIGHTS.sectorWeight) +
      (weights.riskRewardWeight ?? this.DEFAULT_WEIGHTS.riskRewardWeight);

    // Allow small floating point rounding errors (tolerance of 0.001)
    const tolerance = 0.001;
    if (Math.abs(sum - 1.0) > tolerance) {
      throw new BadRequestException(
        `Weights must sum to 1.0 (100%). Current sum: ${sum.toFixed(3)}. ` +
          `Please adjust the weights so they total exactly 1.0.`
      );
    }
  }

  /**
   * Get scoring weights for a user (or default if not customized)
   * Requirements: 5.3 - Load weights from config, fall back to defaults
   */
  async getWeights(userId?: string) {
    this.logger.debug(`Getting weights for user: ${userId || 'default'}`);

    if (userId) {
      // Try to get user-specific weights
      const userWeights = await this.prisma.scoringWeights.findUnique({
        where: { userId },
      });

      if (userWeights) {
        this.logger.debug(`Found custom weights for user ${userId}`);
        return userWeights;
      }

      this.logger.debug(`No custom weights for user ${userId}, using default`);
    }

    // Try to get default weights (userId = null)
    let defaultWeights = await this.prisma.scoringWeights.findFirst({
      where: { userId: null },
    });

    // If no default weights exist in DB, create them
    if (!defaultWeights) {
      this.logger.log('Creating default weights in database');
      defaultWeights = await this.prisma.scoringWeights.create({
        data: {
          userId: null,
          ...this.DEFAULT_WEIGHTS,
        },
      });
    }

    return defaultWeights;
  }

  /**
   * Get default scoring weights configuration
   * Requirements: 5.3 - Load weights from config, fall back to defaults
   */
  async getDefaultWeights() {
    this.logger.debug('Getting default weights');
    return this.getWeights(undefined);
  }

  /**
   * Create or update user-specific scoring weights
   * Requirements: 5.3 - Allow per-user customization of weights
   */
  async setUserWeights(userId: string, weightsDto: ScoringWeightsDto) {
    this.logger.debug(`Setting custom weights for user ${userId}`);

    // Validate that weights sum to 100%
    this.validateWeightsSum(weightsDto);

    // Check if user already has custom weights
    const existing = await this.prisma.scoringWeights.findUnique({
      where: { userId },
    });

    let weights;
    if (existing) {
      // Update existing
      weights = await this.prisma.scoringWeights.update({
        where: { userId },
        data: {
          trendWeight: weightsDto.trendWeight ?? existing.trendWeight,
          technicalWeight: weightsDto.technicalWeight ?? existing.technicalWeight,
          volumeWeight: weightsDto.volumeWeight ?? existing.volumeWeight,
          relativeStrengthWeight:
            weightsDto.relativeStrengthWeight ?? existing.relativeStrengthWeight,
          breakoutWeight: weightsDto.breakoutWeight ?? existing.breakoutWeight,
          sectorWeight: weightsDto.sectorWeight ?? existing.sectorWeight,
          riskRewardWeight: weightsDto.riskRewardWeight ?? existing.riskRewardWeight,
        },
      });
      this.logger.log(`Updated custom weights for user ${userId}`);
    } else {
      // Create new
      weights = await this.prisma.scoringWeights.create({
        data: {
          userId,
          trendWeight: weightsDto.trendWeight ?? this.DEFAULT_WEIGHTS.trendWeight,
          technicalWeight: weightsDto.technicalWeight ?? this.DEFAULT_WEIGHTS.technicalWeight,
          volumeWeight: weightsDto.volumeWeight ?? this.DEFAULT_WEIGHTS.volumeWeight,
          relativeStrengthWeight:
            weightsDto.relativeStrengthWeight ?? this.DEFAULT_WEIGHTS.relativeStrengthWeight,
          breakoutWeight: weightsDto.breakoutWeight ?? this.DEFAULT_WEIGHTS.breakoutWeight,
          sectorWeight: weightsDto.sectorWeight ?? this.DEFAULT_WEIGHTS.sectorWeight,
          riskRewardWeight: weightsDto.riskRewardWeight ?? this.DEFAULT_WEIGHTS.riskRewardWeight,
        },
      });
      this.logger.log(`Created custom weights for user ${userId}`);
    }

    return weights;
  }

  /**
   * Update default scoring weights
   * Requirements: 5.3 - Allow customization of weights
   */
  async setDefaultWeights(weightsDto: ScoringWeightsDto) {
    this.logger.debug('Setting default weights');

    // Validate that weights sum to 100%
    this.validateWeightsSum(weightsDto);

    // Check if default weights exist
    const existing = await this.prisma.scoringWeights.findFirst({
      where: { userId: null },
    });

    let weights;
    if (existing) {
      // Update existing
      weights = await this.prisma.scoringWeights.update({
        where: { id: existing.id },
        data: {
          trendWeight: weightsDto.trendWeight ?? existing.trendWeight,
          technicalWeight: weightsDto.technicalWeight ?? existing.technicalWeight,
          volumeWeight: weightsDto.volumeWeight ?? existing.volumeWeight,
          relativeStrengthWeight:
            weightsDto.relativeStrengthWeight ?? existing.relativeStrengthWeight,
          breakoutWeight: weightsDto.breakoutWeight ?? existing.breakoutWeight,
          sectorWeight: weightsDto.sectorWeight ?? existing.sectorWeight,
          riskRewardWeight: weightsDto.riskRewardWeight ?? existing.riskRewardWeight,
        },
      });
      this.logger.log('Updated default weights');
    } else {
      // Create new
      weights = await this.prisma.scoringWeights.create({
        data: {
          userId: null,
          trendWeight: weightsDto.trendWeight ?? this.DEFAULT_WEIGHTS.trendWeight,
          technicalWeight: weightsDto.technicalWeight ?? this.DEFAULT_WEIGHTS.technicalWeight,
          volumeWeight: weightsDto.volumeWeight ?? this.DEFAULT_WEIGHTS.volumeWeight,
          relativeStrengthWeight:
            weightsDto.relativeStrengthWeight ?? this.DEFAULT_WEIGHTS.relativeStrengthWeight,
          breakoutWeight: weightsDto.breakoutWeight ?? this.DEFAULT_WEIGHTS.breakoutWeight,
          sectorWeight: weightsDto.sectorWeight ?? this.DEFAULT_WEIGHTS.sectorWeight,
          riskRewardWeight: weightsDto.riskRewardWeight ?? this.DEFAULT_WEIGHTS.riskRewardWeight,
        },
      });
      this.logger.log('Created default weights');
    }

    return weights;
  }

  /**
   * Delete user-specific weights (revert to default)
   * Requirements: 5.3 - Allow per-user customization of weights
   */
  async deleteUserWeights(userId: string) {
    this.logger.debug(`Deleting custom weights for user ${userId}`);

    const existing = await this.prisma.scoringWeights.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException(`No custom weights found for user ${userId}`);
    }

    await this.prisma.scoringWeights.delete({
      where: { userId },
    });

    this.logger.log(`Deleted custom weights for user ${userId}`);
    return { message: `Custom weights deleted for user ${userId}, will use defaults` };
  }

  /**
   * Initialize default weights if not present
   * Requirements: 5.3 - Load weights from config, fall back to defaults
   */
  async initializeDefaultWeights() {
    this.logger.log('Initializing default weights');

    const existing = await this.prisma.scoringWeights.findFirst({
      where: { userId: null },
    });

    if (existing) {
      this.logger.log('Default weights already exist');
      return existing;
    }

    const weights = await this.prisma.scoringWeights.create({
      data: {
        userId: null,
        ...this.DEFAULT_WEIGHTS,
      },
    });

    this.logger.log('Default weights initialized');
    return weights;
  }
}
