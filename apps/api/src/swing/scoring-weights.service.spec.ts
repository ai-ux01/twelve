import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ScoringWeightsService } from './scoring-weights.service';
import { PrismaService } from '../database/prisma.service';

describe('ScoringWeightsService', () => {
  let service: ScoringWeightsService;
  let prisma: any;

  const DEFAULT_WEIGHTS = {
    trendWeight: 0.2,
    technicalWeight: 0.2,
    volumeWeight: 0.15,
    relativeStrengthWeight: 0.15,
    breakoutWeight: 0.1,
    sectorWeight: 0.1,
    riskRewardWeight: 0.1,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      scoringWeights: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringWeightsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ScoringWeightsService>(ScoringWeightsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWeights', () => {
    it('should return user-specific weights if they exist', async () => {
      const userId = 'user-123';
      const userWeights = {
        id: 'weight-id',
        userId,
        ...DEFAULT_WEIGHTS,
        trendWeight: 0.3, // customized
        technicalWeight: 0.1, // customized
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.scoringWeights.findUnique.mockResolvedValueOnce(userWeights);

      const result = await service.getWeights(userId);

      expect(result).toEqual(userWeights);
      expect(prisma.scoringWeights.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should return default weights if user-specific weights do not exist', async () => {
      const userId = 'user-123';
      const defaultWeights = {
        id: 'default-weight-id',
        userId: null,
        ...DEFAULT_WEIGHTS,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.scoringWeights.findUnique.mockResolvedValueOnce(null); // user weights don't exist

      prisma.scoringWeights.findFirst.mockResolvedValueOnce(defaultWeights); // default weights exist

      const result = await service.getWeights(userId);

      expect(result).toEqual(defaultWeights);
      expect(prisma.scoringWeights.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.scoringWeights.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should create and return default weights if they do not exist in DB', async () => {
      const userId = 'user-123';
      const createdWeights = {
        id: 'new-default-id',
        userId: null,
        ...DEFAULT_WEIGHTS,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.scoringWeights.findUnique.mockResolvedValueOnce(null); // user weights don't exist

      prisma.scoringWeights.findFirst.mockResolvedValueOnce(null); // default weights don't exist

      prisma.scoringWeights.create.mockResolvedValueOnce(createdWeights);

      const result = await service.getWeights(userId);

      expect(result).toEqual(createdWeights);
      expect(prisma.scoringWeights.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          ...DEFAULT_WEIGHTS,
        },
      });
    });

    it('should return default weights when no userId is provided', async () => {
      const defaultWeights = {
        id: 'default-weight-id',
        userId: null,
        ...DEFAULT_WEIGHTS,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.scoringWeights.findFirst.mockResolvedValueOnce(defaultWeights);

      const result = await service.getWeights();

      expect(result).toEqual(defaultWeights);
      expect(prisma.scoringWeights.findFirst).toHaveBeenCalledWith({
        where: { userId: null },
      });
    });
  });

  describe('setUserWeights', () => {
    it('should create new user weights if they do not exist', async () => {
      const userId = 'user-123';
      const weightsDto = {
        trendWeight: 0.25,
        technicalWeight: 0.25,
        volumeWeight: 0.15,
        relativeStrengthWeight: 0.15,
        breakoutWeight: 0.05,
        sectorWeight: 0.1,
        riskRewardWeight: 0.05,
      };

      const createdWeights = {
        id: 'new-weight-id',
        userId,
        ...weightsDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.scoringWeights.findUnique.mockResolvedValueOnce(null);
      prisma.scoringWeights.create.mockResolvedValueOnce(createdWeights);

      const result = await service.setUserWeights(userId, weightsDto);

      expect(result).toEqual(createdWeights);
      expect(prisma.scoringWeights.create).toHaveBeenCalledWith({
        data: {
          userId,
          ...weightsDto,
        },
      });
    });

    it('should update existing user weights', async () => {
      const userId = 'user-123';
      const existingWeights = {
        id: 'weight-id',
        userId,
        ...DEFAULT_WEIGHTS,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weightsDto = {
        trendWeight: 0.3,
        technicalWeight: 0.1,
      };

      const updatedWeights = {
        ...existingWeights,
        trendWeight: 0.3,
        technicalWeight: 0.1,
      };

      prisma.scoringWeights.findUnique.mockResolvedValueOnce(existingWeights);
      prisma.scoringWeights.update.mockResolvedValueOnce(updatedWeights);

      const result = await service.setUserWeights(userId, weightsDto);

      expect(result).toEqual(updatedWeights);
      expect(prisma.scoringWeights.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          trendWeight: 0.3,
          technicalWeight: 0.1,
          volumeWeight: existingWeights.volumeWeight,
          relativeStrengthWeight: existingWeights.relativeStrengthWeight,
          breakoutWeight: existingWeights.breakoutWeight,
          sectorWeight: existingWeights.sectorWeight,
          riskRewardWeight: existingWeights.riskRewardWeight,
        },
      });
    });

    it('should throw BadRequestException if weights do not sum to 1.0', async () => {
      const userId = 'user-123';
      const weightsDto = {
        trendWeight: 0.3,
        technicalWeight: 0.3,
        volumeWeight: 0.2,
        relativeStrengthWeight: 0.2,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.1, // sum = 1.30, invalid!
      };

      await expect(service.setUserWeights(userId, weightsDto)).rejects.toThrow(BadRequestException);
      await expect(service.setUserWeights(userId, weightsDto)).rejects.toThrow(
        /Weights must sum to 1\.0/
      );
    });

    it('should allow small floating point rounding errors', async () => {
      const userId = 'user-123';
      const weightsDto = {
        trendWeight: 0.2001, // Small rounding error
        technicalWeight: 0.2,
        volumeWeight: 0.15,
        relativeStrengthWeight: 0.15,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.0999,
      };

      const createdWeights = {
        id: 'new-weight-id',
        userId,
        ...weightsDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.scoringWeights.findUnique.mockResolvedValueOnce(null);
      prisma.scoringWeights.create.mockResolvedValueOnce(createdWeights);

      const result = await service.setUserWeights(userId, weightsDto);

      expect(result).toEqual(createdWeights);
    });
  });

  describe('deleteUserWeights', () => {
    it('should delete user-specific weights', async () => {
      const userId = 'user-123';
      const existingWeights = {
        id: 'weight-id',
        userId,
        ...DEFAULT_WEIGHTS,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.scoringWeights.findUnique.mockResolvedValueOnce(existingWeights);
      prisma.scoringWeights.delete.mockResolvedValueOnce(existingWeights);

      const result = await service.deleteUserWeights(userId);

      expect(result).toEqual({
        message: `Custom weights deleted for user ${userId}, will use defaults`,
      });
      expect(prisma.scoringWeights.delete).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should throw NotFoundException if user weights do not exist', async () => {
      const userId = 'user-123';

      prisma.scoringWeights.findUnique.mockResolvedValueOnce(null);

      await expect(service.deleteUserWeights(userId)).rejects.toThrow(NotFoundException);
      await expect(service.deleteUserWeights(userId)).rejects.toThrow(
        `No custom weights found for user ${userId}`
      );
    });
  });

  describe('initializeDefaultWeights', () => {
    it('should create default weights if they do not exist', async () => {
      const defaultWeights = {
        id: 'default-id',
        userId: null,
        ...DEFAULT_WEIGHTS,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.scoringWeights.findFirst.mockResolvedValueOnce(null);
      prisma.scoringWeights.create.mockResolvedValueOnce(defaultWeights);

      const result = await service.initializeDefaultWeights();

      expect(result).toEqual(defaultWeights);
      expect(prisma.scoringWeights.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          ...DEFAULT_WEIGHTS,
        },
      });
    });

    it('should return existing default weights if they already exist', async () => {
      const existingWeights = {
        id: 'default-id',
        userId: null,
        ...DEFAULT_WEIGHTS,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.scoringWeights.findFirst.mockResolvedValueOnce(existingWeights);

      const result = await service.initializeDefaultWeights();

      expect(result).toEqual(existingWeights);
      expect(prisma.scoringWeights.create).not.toHaveBeenCalled();
    });
  });

  describe('weight validation', () => {
    it('should reject weights that sum to less than 1.0', async () => {
      const userId = 'user-123';
      const weightsDto = {
        trendWeight: 0.1,
        technicalWeight: 0.1,
        volumeWeight: 0.1,
        relativeStrengthWeight: 0.1,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.1, // sum = 0.70, too low
      };

      await expect(service.setUserWeights(userId, weightsDto)).rejects.toThrow(BadRequestException);
    });

    it('should reject weights that sum to more than 1.0', async () => {
      const userId = 'user-123';
      const weightsDto = {
        trendWeight: 0.3,
        technicalWeight: 0.3,
        volumeWeight: 0.3,
        relativeStrengthWeight: 0.3,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.1, // sum = 1.50, too high
      };

      await expect(service.setUserWeights(userId, weightsDto)).rejects.toThrow(BadRequestException);
    });

    it('should accept exactly 1.0 sum', async () => {
      const userId = 'user-123';
      const weightsDto = {
        trendWeight: 0.2,
        technicalWeight: 0.2,
        volumeWeight: 0.15,
        relativeStrengthWeight: 0.15,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.1, // sum = 1.00, perfect
      };

      const createdWeights = {
        id: 'new-weight-id',
        userId,
        ...weightsDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.scoringWeights.findUnique.mockResolvedValueOnce(null);
      prisma.scoringWeights.create.mockResolvedValueOnce(createdWeights);

      const result = await service.setUserWeights(userId, weightsDto);

      expect(result).toEqual(createdWeights);
    });
  });
});
