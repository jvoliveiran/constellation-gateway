import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import http from 'http';
import { createTestModule } from './factory/create-test-module';
import { startMockSubgraph, stopMockSubgraph } from './mock-subgraph/server';
import { createTestJwt } from './helpers/jwt.helper';
import { clearRateLimitStore } from '../src/common/rate-limit.plugin';

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;
  let subgraphServer: http.Server;
  let authToken: string;
  const testModule = createTestModule();

  const originalRateLimitMax = process.env.RATE_LIMIT_MAX;

  beforeAll(async () => {
    process.env.RATE_LIMIT_MAX = '5';
    clearRateLimitStore();

    subgraphServer = await startMockSubgraph();
    const result = await testModule.init();
    app = result.app;
    authToken = createTestJwt({
      userId: 'user-rate',
      permissions: ['read'],
    });
  }, 30000);

  afterAll(async () => {
    process.env.RATE_LIMIT_MAX = originalRateLimitMax;
    await testModule.close();
    await stopMockSubgraph(subgraphServer);
  });

  it('allows requests within the rate limit', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query: '{ users { id } }' })
      .expect(200);

    expect(response.body.data).toBeDefined();
  });

  it('returns RATE_LIMITED error after exceeding the rate limit', async () => {
    const query = '{ users { id } }';

    // Exhaust the remaining limit (first test used 1, limit is 5)
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query });
    }

    // The next request should be rate limited
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query });

    // Apollo plugin returns GraphQL error (HTTP 200) with RATE_LIMITED code
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].extensions.code).toBe('RATE_LIMITED');
  });
});
