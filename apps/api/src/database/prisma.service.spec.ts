import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should extend PrismaClient', () => {
    expect(service.$connect).toBeDefined();
    expect(service.$disconnect).toBeDefined();
    expect(typeof service.$connect).toBe('function');
    expect(typeof service.$disconnect).toBe('function');
  });

  it('should implement OnModuleInit interface', () => {
    expect(service.onModuleInit).toBeDefined();
    expect(typeof service.onModuleInit).toBe('function');
  });

  it('should implement OnModuleDestroy interface', () => {
    expect(service.onModuleDestroy).toBeDefined();
    expect(typeof service.onModuleDestroy).toBe('function');
  });

  describe('onModuleInit', () => {
    it('should call $connect on initialization', async () => {
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValueOnce(undefined);

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('should throw error if connection fails', async () => {
      const error = new Error('Connection failed');
      jest.spyOn(service, '$connect').mockRejectedValueOnce(error);

      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect on destruction', async () => {
      const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValueOnce(undefined);

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    it('should throw error if disconnection fails', async () => {
      const error = new Error('Disconnection failed');
      jest.spyOn(service, '$disconnect').mockRejectedValueOnce(error);

      await expect(service.onModuleDestroy()).rejects.toThrow('Disconnection failed');
    });
  });
});
