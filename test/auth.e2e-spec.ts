import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import http from 'http';
import { createTestModule } from './factory/create-test-module';
import { startMockSubgraph, stopMockSubgraph } from './mock-subgraph/server';
import { createTestJwt, createExpiredJwt } from './helpers/jwt.helper';

const SIMPLE_QUERY = '{ users { id name } }';

describe('Authentication (e2e)', () => {
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

  it('returns 401 when Authorization header is missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: SIMPLE_QUERY })
      .expect(401);

    expect(response.body.message).toBe('Missing authorization header');
  });

  it('returns 401 when token format is not Bearer', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', 'Basic some-token')
      .send({ query: SIMPLE_QUERY })
      .expect(401);

    expect(response.body.message).toBe('Invalid bearer token format');
  });

  it('returns 401 when JWT is expired', async () => {
    const expiredToken = createExpiredJwt();

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ query: SIMPLE_QUERY })
      .expect(401);

    expect(response.body.message).toBe('Invalid or expired token');
  });

  it('returns data when JWT is valid', async () => {
    const token = createTestJwt({
      userId: 'user-123',
      permissions: ['read'],
    });

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: SIMPLE_QUERY })
      .expect(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.users).toBeInstanceOf(Array);
  });

  it('health endpoints are accessible without authentication', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty('status');
  });

  it('allows public operations (login) without authentication', async () => {
    const loginMutation = `
      mutation {
        login(email: "test@example.com", password: "password") {
          accessToken
        }
      }
    `;

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: loginMutation })
      .expect(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.login.accessToken).toBeDefined();
  });

  it('blocks private queries without authentication even when public operations are configured', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ users { id name } }' })
      .expect(401);

    expect(response.body.message).toBe('Missing authorization header');
  });
});
