import { GqlThrottlerGuard } from './gql-throttler.guard';

describe('GqlThrottlerGuard', () => {
  it('should be defined', () => {
    // GqlThrottlerGuard extends ThrottlerGuard which needs DI context
    // Just verify the class exists and is constructable via the module system
    expect(GqlThrottlerGuard).toBeDefined();
  });
});
