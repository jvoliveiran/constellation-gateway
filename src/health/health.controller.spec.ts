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
});
