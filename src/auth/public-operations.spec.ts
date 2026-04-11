import { extractOperationFields, isPublicOperation } from './public-operations';

describe('extractOperationFields', () => {
  it('extracts a single mutation field', () => {
    const body = {
      query:
        'mutation { login(input: { email: "a@b.com", password: "p" }) { accessToken } }',
    };
    expect(extractOperationFields(body)).toEqual(['login']);
  });

  it('extracts a single query field', () => {
    const body = { query: '{ me { id name } }' };
    expect(extractOperationFields(body)).toEqual(['me']);
  });

  it('extracts multiple top-level fields from a batched request', () => {
    const body = {
      query:
        'mutation { login(input: { email: "a@b.com", password: "p" }) { accessToken } signup(input: { email: "b@c.com", password: "p" }) { user { id } } }',
    };
    expect(extractOperationFields(body)).toEqual(['login', 'signup']);
  });

  it('returns empty array for invalid query string', () => {
    const body = { query: 'not valid graphql {{' };
    expect(extractOperationFields(body)).toEqual([]);
  });

  it('returns empty array when body is null', () => {
    expect(extractOperationFields(null)).toEqual([]);
  });

  it('returns empty array when body has no query field', () => {
    expect(extractOperationFields({ variables: {} })).toEqual([]);
  });

  it('returns empty array when query is not a string', () => {
    expect(extractOperationFields({ query: 123 })).toEqual([]);
  });

  it('extracts fields from named operations', () => {
    const body = {
      query:
        'mutation LoginUser { login(input: { email: "a@b.com", password: "p" }) { accessToken } }',
    };
    expect(extractOperationFields(body)).toEqual(['login']);
  });

  it('handles introspection query', () => {
    const body = {
      query: '{ __schema { types { name } } }',
    };
    expect(extractOperationFields(body)).toEqual(['__schema']);
  });
});

describe('isPublicOperation', () => {
  const allowlist = ['login', 'signup', 'refreshToken'];

  it('returns true when all fields are in the allowlist', () => {
    expect(isPublicOperation(['login'], allowlist)).toBe(true);
  });

  it('returns true for multiple public fields', () => {
    expect(isPublicOperation(['login', 'signup'], allowlist)).toBe(true);
  });

  it('returns false when a private field is mixed with public ones', () => {
    expect(isPublicOperation(['login', 'me'], allowlist)).toBe(false);
  });

  it('returns false when all fields are private', () => {
    expect(isPublicOperation(['me'], allowlist)).toBe(false);
  });

  it('returns false for empty fields array', () => {
    expect(isPublicOperation([], allowlist)).toBe(false);
  });

  it('returns false for empty allowlist', () => {
    expect(isPublicOperation(['login'], [])).toBe(false);
  });
});
