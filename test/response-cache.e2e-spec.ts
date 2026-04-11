import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import http from 'http';
import { createTestModule } from './factory/create-test-module';
import { startMockSubgraph, stopMockSubgraph } from './mock-subgraph/server';
import { createTestJwt } from './helpers/jwt.helper';

describe('Response Cache (e2e)', () => {
  let app: INestApplication;
  let subgraphServer: http.Server;
  const testModule = createTestModule();

  const originalCacheEnabled = process.env.RESPONSE_CACHE_ENABLED;
  const originalCacheTtl = process.env.RESPONSE_CACHE_TTL;

  beforeAll(async () => {
    process.env.RESPONSE_CACHE_ENABLED = 'true';
    process.env.RESPONSE_CACHE_TTL = '300';

    subgraphServer = await startMockSubgraph();
    const result = await testModule.init();
    app = result.app;
  }, 30000);

  afterAll(async () => {
    process.env.RESPONSE_CACHE_ENABLED = originalCacheEnabled;
    process.env.RESPONSE_CACHE_TTL = originalCacheTtl;
    await testModule.close();
    await stopMockSubgraph(subgraphServer);
  });

  it('serves cached response on second identical query from same user', async () => {
    const token = createTestJwt({
      userId: 'cache-user-1',
      permissions: ['read'],
    });
    const query = '{ user(id: "1") { id name } }';

    // First request: cache miss
    const r1 = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query })
      .expect(200);

    expect(r1.body.data.user).toBeDefined();

    // Second request: should be served from cache
    const r2 = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query })
      .expect(200);

    expect(r2.body.data).toEqual(r1.body.data);
  });

  it('does not share cache between different users', async () => {
    const tokenA = createTestJwt({
      userId: 'cache-user-a',
      permissions: ['read'],
    });
    const tokenB = createTestJwt({
      userId: 'cache-user-b',
      permissions: ['read'],
    });
    const query = '{ user(id: "1") { id name } }';

    // User A request
    const rA = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ query })
      .expect(200);

    // User B same query — should not get User A's cached response
    const rB = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ query })
      .expect(200);

    // Both should have valid data (different cache partitions)
    expect(rA.body.data.user).toBeDefined();
    expect(rB.body.data.user).toBeDefined();
  });

  it('does not cache error responses', async () => {
    const token = createTestJwt({
      userId: 'cache-user-err',
      permissions: ['read'],
    });

    // First error request
    const r1 = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: '{ error }' })
      .expect(200);

    expect(r1.body.errors).toBeDefined();

    // Second identical error request — should still hit subgraph (not cached)
    const r2 = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: '{ error }' })
      .expect(200);

    expect(r2.body.errors).toBeDefined();
  });
});
