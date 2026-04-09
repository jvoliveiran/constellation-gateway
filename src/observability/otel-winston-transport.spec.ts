import { OtelWinstonTransport } from './otel-winston-transport';

jest.mock('@opentelemetry/api-logs', () => ({
  logs: {
    getLogger: () => ({
      emit: jest.fn(),
    }),
  },
  SeverityNumber: {
    ERROR: 17,
    WARN: 13,
    INFO: 9,
    INFO2: 10,
    DEBUG2: 6,
    DEBUG: 5,
    TRACE: 1,
  },
}));

describe('OtelWinstonTransport', () => {
  let transport: OtelWinstonTransport;

  beforeEach(() => {
    transport = new OtelWinstonTransport();
  });

  it('should call callback after logging', (done) => {
    transport.log({ level: 'info', message: 'test message' }, () => {
      done();
    });
  });

  it('should emit log record with correct severity', (done) => {
    const emitSpy = jest.fn();
    (transport as any).logger = { emit: emitSpy };

    transport.log(
      { level: 'error', message: 'error occurred', service: 'test' },
      () => {
        expect(emitSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            severityNumber: 17,
            severityText: 'ERROR',
            body: 'error occurred',
          }),
        );
        done();
      },
    );
  });

  it('should fall back to INFO severity for unknown log levels', (done) => {
    const emitSpy = jest.fn();
    (transport as any).logger = { emit: emitSpy };

    transport.log(
      { level: 'custom-level', message: 'unknown level log' },
      () => {
        expect(emitSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            severityNumber: 9, // SeverityNumber.INFO
            severityText: 'CUSTOM-LEVEL',
          }),
        );
        done();
      },
    );
  });

  it('should sanitize attributes removing non-primitive values', (done) => {
    const emitSpy = jest.fn();
    (transport as any).logger = { emit: emitSpy };

    transport.log(
      {
        level: 'info',
        message: 'test',
        stringAttr: 'value',
        numAttr: 42,
        boolAttr: true,
        objAttr: { nested: true },
        nullAttr: null,
      },
      () => {
        const attributes = emitSpy.mock.calls[0][0].attributes;
        expect(attributes.stringAttr).toBe('value');
        expect(attributes.numAttr).toBe(42);
        expect(attributes.boolAttr).toBe(true);
        expect(attributes.objAttr).toBe('[object Object]');
        expect(attributes.nullAttr).toBeUndefined();
        done();
      },
    );
  });

  it('should exclude undefined attribute values', (done) => {
    const emitSpy = jest.fn();
    (transport as any).logger = { emit: emitSpy };

    transport.log(
      { level: 'info', message: 'test', undefinedAttr: undefined },
      () => {
        const attributes = emitSpy.mock.calls[0][0].attributes;
        expect(attributes).not.toHaveProperty('undefinedAttr');
        done();
      },
    );
  });

  it('should filter out stringified Symbol keys from Winston internals', (done) => {
    const emitSpy = jest.fn();
    (transport as any).logger = { emit: emitSpy };

    transport.log(
      {
        level: 'info',
        message: 'test',
        'Symbol(level)': 'info',
        'Symbol(splat)': [],
        'Symbol(custom)': 'other',
        realKey: 'kept',
      },
      () => {
        const attributes = emitSpy.mock.calls[0][0].attributes;
        expect(attributes).not.toHaveProperty('Symbol(level)');
        expect(attributes).not.toHaveProperty('Symbol(splat)');
        expect(attributes).not.toHaveProperty('Symbol(custom)');
        expect(attributes.realKey).toBe('kept');
        done();
      },
    );
  });
});
