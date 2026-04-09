import { buildSchema, parse, GraphQLError } from 'graphql';
import { LoggerService } from '@nestjs/common';
import {
  createQueryComplexityPlugin,
  isIntrospectionQuery,
} from './query-complexity.plugin';
import { QueryComplexityPluginConfig } from './query-complexity.types';

const testSchema = buildSchema(`
  type Query {
    user(id: ID!): User
    users: [User]
  }

  type User {
    id: ID!
    name: String
    email: String
    posts: [Post]
  }

  type Post {
    id: ID!
    title: String
    body: String
  }
`);

function createMockLogger(): LoggerService {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    fatal: jest.fn(),
  };
}

type RequestDidStartResult = {
  didResolveOperation: (context: Record<string, unknown>) => Promise<void>;
};

async function getListener(
  config: QueryComplexityPluginConfig,
  logger: LoggerService,
): Promise<RequestDidStartResult> {
  const plugin = createQueryComplexityPlugin(config, logger);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestDidStart = plugin.requestDidStart as any;

  return requestDidStart({ schema: testSchema });
}

function buildResolveContext(
  query: string,
  operationName?: string,
  variables?: Record<string, unknown>,
) {
  return {
    document: parse(query),
    operationName: operationName ?? null,
    request: {
      query,
      variables: variables ?? {},
    },
  };
}

describe('createQueryComplexityPlugin', () => {
  const defaultConfig: QueryComplexityPluginConfig = {
    maxComplexity: 1000,
    defaultListSize: 1,
    warnThreshold: 0.8,
  };

  describe('query rejection', () => {
    it('should throw GraphQLError when complexity exceeds max', async () => {
      const config: QueryComplexityPluginConfig = {
        maxComplexity: 5,
        defaultListSize: 1,
        warnThreshold: 0.8,
      };
      const logger = createMockLogger();
      const listener = await getListener(config, logger);

      // This query has complexity: 1(user) + 1(id) + 1(name) + 1(email) + 1(posts) + 1(id) + 1(title) + 1(body) = 8
      const context = buildResolveContext(`
        query {
          user(id: "1") {
            id
            name
            email
            posts {
              id
              title
              body
            }
          }
        }
      `);

      try {
        await listener.didResolveOperation(context);
        fail('Expected GraphQLError to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(GraphQLError);
        const graphqlError = error as GraphQLError;
        expect(graphqlError.message).toMatch(
          /exceeds the maximum allowed complexity/,
        );
        expect(graphqlError.extensions.code).toBe('QUERY_TOO_COMPLEX');
        expect(graphqlError.extensions.complexity).toBeDefined();
        expect(graphqlError.extensions.maxComplexity).toBe(5);
      }
    });

    it('should allow queries under complexity limit', async () => {
      const logger = createMockLogger();
      const listener = await getListener(defaultConfig, logger);

      const context = buildResolveContext(`
        query {
          user(id: "1") {
            id
            name
          }
        }
      `);

      await expect(
        listener.didResolveOperation(context),
      ).resolves.toBeUndefined();
    });

    it('should allow a query with complexity exactly at the limit', async () => {
      // { user(id: "1") { id name } } has complexity 3 with defaultListSize=1
      const config: QueryComplexityPluginConfig = {
        maxComplexity: 3,
        defaultListSize: 1,
        warnThreshold: 1,
      };
      const logger = createMockLogger();
      const listener = await getListener(config, logger);

      const context = buildResolveContext(`
        query {
          user(id: "1") {
            id
            name
          }
        }
      `);

      await expect(
        listener.didResolveOperation(context),
      ).resolves.toBeUndefined();
    });

    it('should compute higher complexity when defaultListSize is increased', async () => {
      // Same query, but defaultListSize=10 makes each field cost 10 instead of 1
      // So { user(id: "1") { id name } } costs 10 + (10 + 10) = 30
      const config: QueryComplexityPluginConfig = {
        maxComplexity: 20,
        defaultListSize: 10,
        warnThreshold: 0.8,
      };
      const logger = createMockLogger();
      const listener = await getListener(config, logger);

      const context = buildResolveContext(`
        query {
          user(id: "1") {
            id
            name
          }
        }
      `);

      try {
        await listener.didResolveOperation(context);
        fail('Expected GraphQLError to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(GraphQLError);
        const graphqlError = error as GraphQLError;
        expect(graphqlError.extensions.code).toBe('QUERY_TOO_COMPLEX');
        expect(graphqlError.extensions.complexity).toBe(30);
      }
    });

    it('should fail-open and log error when getComplexity throws', async () => {
      const logger = createMockLogger();
      const plugin = createQueryComplexityPlugin(defaultConfig, logger);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestDidStart = plugin.requestDidStart as any;

      // Pass a null schema to force getComplexity to throw
      const listener = await requestDidStart({ schema: null });

      const context = buildResolveContext(`
        query {
          user(id: "1") {
            id
          }
        }
      `);

      await expect(
        listener.didResolveOperation(context),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to calculate query complexity',
        expect.objectContaining({
          context: 'QueryComplexityPlugin',
          operationName: 'anonymous',
        }),
      );
    });
  });

  describe('warning threshold', () => {
    it('should log warning when complexity exceeds warn threshold', async () => {
      const config: QueryComplexityPluginConfig = {
        maxComplexity: 10,
        defaultListSize: 1,
        warnThreshold: 0.5,
      };
      const logger = createMockLogger();
      const listener = await getListener(config, logger);

      // complexity: 1(user) + 1(id) + 1(name) + 1(email) + 1(posts) + 1(id) + 1(title) + 1(body) = 8
      // warn threshold: 10 * 0.5 = 5, so 8 >= 5 triggers warning
      const context = buildResolveContext(`
        query {
          user(id: "1") {
            id
            name
            email
            posts {
              id
              title
              body
            }
          }
        }
      `);

      await listener.didResolveOperation(context);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('approaching complexity limit'),
        expect.objectContaining({
          complexity: expect.any(Number),
          maxComplexity: 10,
        }),
      );
    });

    it('should not warn when complexity is below warn threshold', async () => {
      const logger = createMockLogger();
      const listener = await getListener(defaultConfig, logger);

      const context = buildResolveContext(`
        query {
          user(id: "1") {
            id
          }
        }
      `);

      await listener.didResolveOperation(context);

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('introspection exemption', () => {
    it('should skip analysis for IntrospectionQuery operation name', async () => {
      const config: QueryComplexityPluginConfig = {
        maxComplexity: 1,
        defaultListSize: 1,
        warnThreshold: 0.8,
      };
      const logger = createMockLogger();
      const listener = await getListener(config, logger);

      // Even with maxComplexity=1, introspection should pass
      const context = buildResolveContext(
        `query IntrospectionQuery { __schema { types { name } } }`,
        'IntrospectionQuery',
      );

      await expect(
        listener.didResolveOperation(context),
      ).resolves.toBeUndefined();
    });

    it('should skip analysis for queries containing __schema', async () => {
      const config: QueryComplexityPluginConfig = {
        maxComplexity: 1,
        defaultListSize: 1,
        warnThreshold: 0.8,
      };
      const logger = createMockLogger();
      const listener = await getListener(config, logger);

      const context = buildResolveContext(
        `query { __schema { types { name } } }`,
      );

      await expect(
        listener.didResolveOperation(context),
      ).resolves.toBeUndefined();
    });
  });
});

describe('isIntrospectionQuery', () => {
  it('should return true for IntrospectionQuery operation name', () => {
    expect(isIntrospectionQuery('IntrospectionQuery', '')).toBe(true);
  });

  it('should return true for queries containing __schema', () => {
    expect(
      isIntrospectionQuery(undefined, '{ __schema { types { name } } }'),
    ).toBe(true);
  });

  it('should return true for queries containing __type', () => {
    expect(
      isIntrospectionQuery(undefined, '{ __type(name: "User") { name } }'),
    ).toBe(true);
  });

  it('should return false for regular queries', () => {
    expect(isIntrospectionQuery(undefined, '{ user(id: "1") { name } }')).toBe(
      false,
    );
  });
});
