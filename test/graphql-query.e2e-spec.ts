import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import http from 'http';
import { createTestModule } from './factory/create-test-module';
import { startMockSubgraph, stopMockSubgraph } from './mock-subgraph/server';
import { createTestJwt } from './helpers/jwt.helper';

describe('GraphQL Query Forwarding (e2e)', () => {
  let app: INestApplication;
  let subgraphServer: http.Server;
  let authToken: string;
  const testModule = createTestModule();

  beforeAll(async () => {
    subgraphServer = await startMockSubgraph();
    const result = await testModule.init();
    app = result.app;
    authToken = createTestJwt({
      userId: 'user-123',
      permissions: ['read'],
    });
  }, 30000);

  afterAll(async () => {
    await testModule.close();
    await stopMockSubgraph(subgraphServer);
  });

  it('forwards user query and returns correct data', async () => {
    const query = '{ user(id: "1") { id name email } }';

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query })
      .expect(200);

    expect(response.body.data.user).toEqual({
      id: '1',
      name: 'Test User',
      email: 'test@test.com',
    });
  });

  it('forwards users list query and returns array', async () => {
    const query = '{ users { id name } }';

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query })
      .expect(200);

    expect(response.body.data.users).toBeInstanceOf(Array);
    expect(response.body.data.users).toHaveLength(2);
    expect(response.body.data.users[0]).toEqual({
      id: '1',
      name: 'Test User',
    });
  });

  it('returns standard GraphQL response envelope', async () => {
    const query = '{ user(id: "1") { id } }';

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query })
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.errors).toBeUndefined();
  });
});
