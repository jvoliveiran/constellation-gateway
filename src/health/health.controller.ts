import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/public.decorator';
import { GatewayConfig, SubgraphConfig } from '../config/config.types';

const HEAP_THRESHOLD_BYTES = 256 * 1024 * 1024;

@Public()
@Controller('/health')
export class HealthController {
  private readonly subgraphs: SubgraphConfig[];

  constructor(
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.get<GatewayConfig>('gateway');
    this.subgraphs = config?.subgraphs || [];
  }

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('heap', HEAP_THRESHOLD_BYTES),
    ]);
  }

  @Get('/ready')
  @HealthCheck()
  ready() {
    const subgraphChecks = this.subgraphs.map(
      (subgraph) => () =>
        this.http.pingCheck(`subgraph-${subgraph.name}`, subgraph.url),
    );

    return this.health.check(subgraphChecks);
  }
}
