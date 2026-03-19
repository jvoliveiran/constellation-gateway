import { parseOtlpHeaders } from './otel';

describe('parseOtlpHeaders', () => {
  it('returns undefined when input is undefined', () => {
    expect(parseOtlpHeaders(undefined)).toBeUndefined();
  });

  it('returns undefined when input is an empty string', () => {
    expect(parseOtlpHeaders('')).toBeUndefined();
  });

  it('parses a single key=value pair', () => {
    expect(parseOtlpHeaders('Authorization=Bearer token')).toEqual({
      Authorization: 'Bearer token',
    });
  });

  it('parses multiple comma-separated pairs', () => {
    expect(parseOtlpHeaders('Key1=val1,Key2=val2')).toEqual({
      Key1: 'val1',
      Key2: 'val2',
    });
  });

  it('preserves values containing equals signs', () => {
    expect(parseOtlpHeaders('Authorization=Basic dXNlcjpwYXNz')).toEqual({
      Authorization: 'Basic dXNlcjpwYXNz',
    });
  });

  it('trims whitespace around keys and values', () => {
    expect(parseOtlpHeaders('  Key1 = val1 , Key2 = val2 ')).toEqual({
      Key1: 'val1',
      Key2: 'val2',
    });
  });

  it('skips malformed pairs without an equals sign', () => {
    expect(parseOtlpHeaders('Valid=yes,malformed,Also=good')).toEqual({
      Valid: 'yes',
      Also: 'good',
    });
  });

  it('skips pairs where equals sign is at position 0', () => {
    expect(parseOtlpHeaders('=nokey,Key=val')).toEqual({
      Key: 'val',
    });
  });
});
