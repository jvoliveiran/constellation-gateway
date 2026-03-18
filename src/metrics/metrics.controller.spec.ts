import { register } from 'prom-client';
// Import the module to trigger collectDefaultMetrics
import './metrics.module';
import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  let controller: MetricsController;

  beforeEach(() => {
    controller = new MetricsController();
  });

  afterAll(() => {
    register.clear();
  });

  it('should return metrics in Prometheus format', async () => {
    const result = await controller.getMetrics();

    expect(typeof result).toBe('string');
    expect(result).toContain('# HELP');
    expect(result).toContain('# TYPE');
  });

  it('should include default Node.js metrics', async () => {
    const result = await controller.getMetrics();

    expect(result).toContain('gateway_');
  });
});
