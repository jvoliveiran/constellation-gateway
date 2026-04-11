import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import http from 'http';
import { createTestModule } from './factory/create-test-module';
import { startMockSubgraph, stopMockSubgraph } from './mock-subgraph/server';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('Correlation ID (e2e)', () => {
  let app: INestApplication;
  let subgraphServer: http.Server;
  const testModule = createTestModule();

  beforeAll(async () => {
    subgraphServer = await startMockSubgraph();
    const result = await testModule.init();
    app = result.app;
  }, 30000);

  afterAll(async () => {
    await testModule.close();
    await stopMockSubgraph(subgraphServer);
  });

  it('auto-generates a UUID correlation-id when none is provided', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    const correlationId = response.headers['x-correlation-id'];
    expect(correlationId).toBeDefined();
    expect(correlationId).toMatch(UUID_REGEX);
  });

  it('echoes back the provided correlation-id', async () => {
    const customId = 'my-custom-correlation-id-789';

    const response = await request(app.getHttpServer())
      .get('/health')
      .set('x-correlation-id', customId);

    expect(response.headers['x-correlation-id']).toBe(customId);
  });
});
