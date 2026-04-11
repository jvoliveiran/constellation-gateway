process.env.JWT_SECRET =
  'test-secret-that-is-at-least-thirty-two-characters-long!!';
process.env.SUPERGRAPH_PATH = './test/fixtures/test-supergraph.graphql';
process.env.NODE_ENV = 'test';
process.env.OTEL_SDK_DISABLED = 'true';
process.env.RATE_LIMIT_TTL = '60';
process.env.RATE_LIMIT_MAX = '100';
process.env.QUERY_MAX_DEPTH = '10';
process.env.QUERY_MAX_COMPLEXITY = '1000';
process.env.SUBGRAPH = 'constellation|http://localhost:4111/graphql';
process.env.PUBLIC_OPERATIONS =
  'login,signup,refreshToken,verifyEmail,requestPasswordReset,resetPassword,resendVerificationEmail';
process.env.LOG_LEVEL = 'error';
process.env.APQ_ENABLED = 'true';
process.env.RESPONSE_CACHE_ENABLED = 'false';
process.env.RESPONSE_CACHE_TTL = '60';
process.env.RESPONSE_CACHE_MAX_SIZE = '500';
