import gql from 'graphql-tag';
import { GraphQLError } from 'graphql';

export const typeDefs = gql`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

  type Query {
    user(id: ID!): User
    users: [User!]!
    error: String
    nested: Level1
  }

  type Mutation {
    login(email: String!, password: String!): LoginResult!
  }

  type LoginResult {
    accessToken: String!
  }

  type User @key(fields: "id") {
    id: ID!
    name: String!
    email: String!
  }

  type Level1 {
    level2: Level2
  }
  type Level2 {
    level3: Level3
  }
  type Level3 {
    level4: Level4
  }
  type Level4 {
    level5: Level5
  }
  type Level5 {
    level6: Level6
  }
  type Level6 {
    level7: Level7
  }
  type Level7 {
    level8: Level8
  }
  type Level8 {
    level9: Level9
  }
  type Level9 {
    level10: Level10
  }
  type Level10 {
    level11: Level11
  }
  type Level11 {
    value: String
  }
`;

export let lastReceivedHeaders: Record<string, string | undefined> = {};

export function resetLastReceivedHeaders(): void {
  lastReceivedHeaders = {};
}

const NESTED_STUB = {};

export const resolvers = {
  Mutation: {
    login: (_: unknown, { email }: { email: string }) => ({
      accessToken: `mock-token-for-${email}`,
    }),
  },
  Query: {
    user: (_: unknown, { id }: { id: string }) => ({
      id,
      name: 'Test User',
      email: 'test@test.com',
    }),
    users: () => [
      { id: '1', name: 'Test User', email: 'test@test.com' },
      { id: '2', name: 'Another User', email: 'another@test.com' },
    ],
    error: () => {
      throw new GraphQLError('Subgraph error', {
        extensions: { code: 'SUBGRAPH_ERROR' },
      });
    },
    nested: () => NESTED_STUB,
  },
  Level1: { level2: () => NESTED_STUB },
  Level2: { level3: () => NESTED_STUB },
  Level3: { level4: () => NESTED_STUB },
  Level4: { level5: () => NESTED_STUB },
  Level5: { level6: () => NESTED_STUB },
  Level6: { level7: () => NESTED_STUB },
  Level7: { level8: () => NESTED_STUB },
  Level8: { level9: () => NESTED_STUB },
  Level9: { level10: () => NESTED_STUB },
  Level10: { level11: () => NESTED_STUB },
  Level11: { value: () => 'deep-value' },
};
