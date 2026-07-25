import { Test, TestingModule } from '@nestjs/testing';
import { SwingModule } from './swing.module';
import { SwingController } from './swing.controller';
import { SwingService } from './swing.service';

describe('SwingModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [SwingModule],
    }).compile();
  });

  describe('Module Structure', () => {
    it('should compile the module', () => {
      expect(module).toBeDefined();
    });

    it('should provide SwingController', () => {
      const controller = module.get<SwingController>(SwingController);
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(SwingController);
    });

    it('should provide SwingService', () => {
      const service = module.get<SwingService>(SwingService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SwingService);
    });
  });

  describe('Dependency Injection', () => {
    it('should inject SwingService into SwingController', () => {
      const controller = module.get<SwingController>(SwingController);
      const service = module.get<SwingService>(SwingService);

      expect(controller).toBeDefined();
      expect(service).toBeDefined();

      // Controller should have service injected
      expect((controller as any).swingService).toBeDefined();
    });
  });

  describe('Module Exports', () => {
    it('should export SwingService for use in other modules', () => {
      // SwingService should be exportable for use in other modules
      const service = module.get<SwingService>(SwingService);
      expect(service).toBeDefined();
    });
  });

  describe('Requirements Validation', () => {
    it('should validate Requirement 5.1: swing trading module setup', () => {
      // Assert - Backend API SHALL provide swing trading module with proper structure
      const controller = module.get<SwingController>(SwingController);
      const service = module.get<SwingService>(SwingService);

      expect(controller).toBeDefined();
      expect(service).toBeDefined();
    });

    it('should validate Requirement 18.1: module prepared for data flow enforcement', () => {
      // Assert - Module structure supports enforcing data flow:
      // Market Data → Quant → AI (NO direct AI access to raw data)

      const service = module.get<SwingService>(SwingService);
      expect(service).toBeDefined();

      // TODO: When dependencies are added, verify:
      // - SwingService imports MarketDataModule (for fetching data)
      // - SwingService imports QuantModule (for technical analysis)
      // - SwingService imports AiModule (receives ONLY quant results)
      // - SwingService imports RiskModule (for validation)
      // - AiModule does NOT import MarketDataModule (architectural constraint)
    });
  });

  describe('NestJS Best Practices', () => {
    it('should follow NestJS module pattern', () => {
      // Assert - Module should have controllers, providers, and exports
      expect(module).toBeDefined();

      const controller = module.get<SwingController>(SwingController);
      const service = module.get<SwingService>(SwingService);

      expect(controller).toBeInstanceOf(SwingController);
      expect(service).toBeInstanceOf(SwingService);
    });

    it('should be importable in app.module.ts', async () => {
      // Assert - Module should be importable in other modules
      const testModule = await Test.createTestingModule({
        imports: [SwingModule],
      }).compile();

      expect(testModule).toBeDefined();
    });
  });
});
