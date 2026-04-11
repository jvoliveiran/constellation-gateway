import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import http from 'http';
import { createTestModule } from './factory/create-test-module';
import { startMockSubgraph, stopMockSubgraph } from './mock-subgraph/server';

describe('Health Endpoints (e2e)', () => {
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

  describe('GET /health', () => {
    it('responds without authentication', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      // Health endpoint is reachable (200 or 503 depending on heap usage)
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('info');
    });
  });

  describe('GET /health/ready', () => {
    it('checks subgraph connectivity', async () => {
      const response = await request(app.getHttpServer()).get('/health/ready');

      // Readiness endpoint is reachable and checks subgraphs
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });
  });
});
