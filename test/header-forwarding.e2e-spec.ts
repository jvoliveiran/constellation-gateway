import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import http from 'http';
import { createTestModule } from './factory/create-test-module';
import { startMockSubgraph, stopMockSubgraph } from './mock-subgraph/server';
import { lastReceivedHeaders } from './mock-subgraph/schema';
import { createTestJwt } from './helpers/jwt.helper';

describe('Header Forwarding (e2e)', () => {
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

  it('forwards userId, authorization, permissions, and correlation-id to subgraph', async () => {
    const token = createTestJwt({
      userId: 'forwarded-user-42',
      permissions: ['read', 'write'],
    });
    const correlationId = 'test-correlation-id-abc';

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', correlationId)
      .send({ query: '{ user(id: "1") { id } }' })
      .expect(200);

    expect(lastReceivedHeaders['userid']).toBe('forwarded-user-42');
    expect(lastReceivedHeaders['authorization']).toBe(`Bearer ${token}`);
    expect(lastReceivedHeaders['x-correlation-id']).toBe(correlationId);

    const forwardedPermissions = JSON.parse(
      lastReceivedHeaders['permissions'] ?? '[]',
    );
    expect(forwardedPermissions).toEqual(['read', 'write']);
  });

  it('generates and forwards a correlation-id when none is provided', async () => {
    const token = createTestJwt({
      userId: 'user-no-corr',
      permissions: [],
    });

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: '{ user(id: "1") { id } }' })
      .expect(200);

    expect(lastReceivedHeaders['x-correlation-id']).toBeDefined();
    expect(lastReceivedHeaders['x-correlation-id']?.length).toBeGreaterThan(0);
  });
});
