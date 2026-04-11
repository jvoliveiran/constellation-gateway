import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import http from 'http';
import { createTestModule } from './factory/create-test-module';
import { startMockSubgraph, stopMockSubgraph } from './mock-subgraph/server';
import { createTestJwt } from './helpers/jwt.helper';

describe('Error Propagation (e2e)', () => {
  let app: INestApplication;
  let subgraphServer: http.Server;
  let authToken: string;
  const testModule = createTestModule();

  beforeAll(async () => {
    subgraphServer = await startMockSubgraph();
    const result = await testModule.init();
    app = result.app;
    authToken = createTestJwt({
      userId: 'user-err',
      permissions: ['read'],
    });
  }, 30000);

  afterAll(async () => {
    await testModule.close();
    await stopMockSubgraph(subgraphServer);
  });

  it('propagates subgraph errors in the GraphQL response', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query: '{ error }' })
      .expect(200);

    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it('includes error message from subgraph', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query: '{ error }' })
      .expect(200);

    const errorMessages = response.body.errors.map(
      (e: { message: string }) => e.message,
    );
    expect(
      errorMessages.some((msg: string) => msg.includes('Subgraph error')),
    ).toBe(true);
  });
});
