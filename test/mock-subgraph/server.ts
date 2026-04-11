import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import express from 'express';
import http from 'http';
import { typeDefs, resolvers, lastReceivedHeaders } from './schema';

const MOCK_SUBGRAPH_PORT = 4111;

export async function startMockSubgraph(
  port = MOCK_SUBGRAPH_PORT,
): Promise<http.Server> {
  const schema = buildSubgraphSchema({ typeDefs, resolvers });
  const server = new ApolloServer({ schema });
  await server.start();

  const app = express();
  app.use(express.json());
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Capture headers so tests can assert what the gateway forwarded
        Object.keys(lastReceivedHeaders).forEach(
          (key) => delete lastReceivedHeaders[key],
        );
        Object.assign(lastReceivedHeaders, req.headers);
        return {};
      },
    }),
  );

  return new Promise((resolve) => {
    const httpServer = app.listen(port, () => resolve(httpServer));
  });
}

export async function stopMockSubgraph(httpServer: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    httpServer.close((err) => (err ? reject(err) : resolve()));
  });
}
