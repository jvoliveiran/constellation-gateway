import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import http from 'http';
import { createTestModule } from './factory/create-test-module';
import { startMockSubgraph, stopMockSubgraph } from './mock-subgraph/server';
import { createTestJwt } from './helpers/jwt.helper';

describe('Query Depth Limit (e2e)', () => {
  let app: INestApplication;
  let subgraphServer: http.Server;
  let authToken: string;
  const testModule = createTestModule();

  beforeAll(async () => {
    subgraphServer = await startMockSubgraph();
    const result = await testModule.init();
    app = result.app;
    authToken = createTestJwt({
      userId: 'user-depth',
      permissions: ['read'],
    });
  }, 30000);

  afterAll(async () => {
    await testModule.close();
    await stopMockSubgraph(subgraphServer);
  });

  it('rejects queries that exceed the depth limit of 10', async () => {
    // Depth 11: nested > level2 > level3 > ... > level10 > level11 > value
    const deepQuery = `{
      nested {
        level2 {
          level3 {
            level4 {
              level5 {
                level6 {
                  level7 {
                    level8 {
                      level9 {
                        level10 {
                          level11 {
                            value
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`;

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query: deepQuery });

    // Apollo returns 400 for validation errors (depth limit)
    expect([200, 400]).toContain(response.status);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it('accepts queries within the depth limit', async () => {
    const safeQuery = `{
      user(id: "1") {
        id
        name
        email
      }
    }`;

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query: safeQuery })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.user).toBeDefined();
  });
});
