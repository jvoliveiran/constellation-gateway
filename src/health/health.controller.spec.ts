import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;

  beforeEach(async () => {
    const mockHealthCheckService = {
      check: jest.fn().mockImplementation(() => {
        return Promise.resolve({
          status: 'ok',
          details: {},
        });
      }),
    };

    const mockHttpHealthIndicator = {
      pingCheck: jest.fn().mockResolvedValue({
        status: 'up',
      }),
    };

    const mockMemoryHealthIndicator = {
      checkHeap: jest.fn().mockResolvedValue({
        heap: { status: 'up' },
      }),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: unknown) => {
        const config: Record<string, unknown> = {
          gateway: {
            subgraphs: [
              {
                name: 'constellation',
                url: 'http://localhost:3001/graphql',
              },
            ],
          },
          SERVICE_PORT: 3000,
        };
        return config[key] ?? defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: HttpHealthIndicator, useValue: mockHttpHealthIndicator },
        { provide: MemoryHealthIndicator, useValue: mockMemoryHealthIndicator },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', async () => {
    const result = await controller.check();
    expect(result).toEqual({ status: 'ok', details: {} });
    expect(healthCheckService.check).toHaveBeenCalled();
  });

  it('should return readiness status', async () => {
    const result = await controller.ready();
    expect(result).toEqual({ status: 'ok', details: {} });
    expect(healthCheckService.check).toHaveBeenCalled();
  });

  describe('when SUBGRAPH is not configured', () => {
    let controllerNoSubgraphs: HealthController;
    let healthCheckServiceNoSubgraphs: HealthCheckService;
    let httpIndicatorNoSubgraphs: HttpHealthIndicator;

    beforeEach(async () => {
      const mockHealthCheckService = {
        check: jest.fn().mockResolvedValue({ status: 'ok', details: {} }),
      };

      const mockHttpIndicator = { pingCheck: jest.fn() };

      const mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'gateway') {
            return { subgraphs: [] };
          }
          return undefined;
        }),
      };

      const moduleNoSubgraphs: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          { provide: HealthCheckService, useValue: mockHealthCheckService },
          { provide: HttpHealthIndicator, useValue: mockHttpIndicator },
          {
            provide: MemoryHealthIndicator,
            useValue: { checkHeap: jest.fn() },
          },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      controllerNoSubgraphs =
        moduleNoSubgraphs.get<HealthController>(HealthController);
      healthCheckServiceNoSubgraphs =
        moduleNoSubgraphs.get<HealthCheckService>(HealthCheckService);
      httpIndicatorNoSubgraphs =
        moduleNoSubgraphs.get<HttpHealthIndicator>(HttpHealthIndicator);
    });

    it('should return healthy readiness without subgraph pings', async () => {
      const result = await controllerNoSubgraphs.ready();

      expect(result).toEqual({ status: 'ok', details: {} });
      expect(healthCheckServiceNoSubgraphs.check).toHaveBeenCalledWith([]);
      expect(httpIndicatorNoSubgraphs.pingCheck).not.toHaveBeenCalled();
    });
  });
});
