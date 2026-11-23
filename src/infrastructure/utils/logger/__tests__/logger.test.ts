import { Writable } from 'stream';
import winston from 'winston';

type Logger = winston.Logger;

function loadLogger(nodeEnv: string | undefined): Logger {
  const previous = process.env.NODE_ENV;
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  let logger!: Logger;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    logger = require('../index').default;
  });
  process.env.NODE_ENV = previous;
  return logger;
}

function capture(logger: Logger): string[] {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  logger.add(new winston.transports.Stream({ stream }));
  return lines;
}

describe('logger', () => {
  test('production writes one JSON line per entry with the metadata and the error stack', () => {
    const logger = loadLogger('production');
    const lines = capture(logger);

    logger.error('System error occurred', { requestId: 'req-abc123', error: new Error('boom') });

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({ level: 'error', message: 'System error occurred', requestId: 'req-abc123' });
    expect(entry.error.message).toBe('boom');
    expect(entry.error.stack).toContain('Error: boom');
    expect(lines[0]).not.toContain('\u001b[');
  });

  test('production has no file transports, since the container disk is not persistent', () => {
    const logger = loadLogger('production');
    expect(logger.transports.map((t) => t.constructor.name)).toEqual(['Console']);
  });

  test('development output stays readable and still carries the metadata', () => {
    const logger = loadLogger('development');
    const lines = capture(logger);

    logger.error('System error occurred', { requestId: 'req-abc123', userId: 'user-1', error: new Error('boom') });

    expect(lines[0]).toContain('System error occurred');
    expect(lines[0]).toContain('req-abc123');
    expect(lines[0]).toContain('user-1');
    expect(lines[0]).toContain('Error: boom');
  });

  test('an unset NODE_ENV logs at info, not debug', () => {
    expect(loadLogger(undefined).level).toBe('info');
    expect(loadLogger('development').level).toBe('debug');
  });
});
