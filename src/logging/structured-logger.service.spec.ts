import { StructuredLoggerService } from './structured-logger.service';
import { runWithCorrelationId } from './request-context';

function captureStdoutJsonLines(fn: () => void): Record<string, unknown>[] {
  const writeSpy = jest
    .spyOn(process.stdout, 'write')
    .mockImplementation(() => true);

  fn();

  const lines = writeSpy.mock.calls
    .map((call) => String(call[0]).trim())
    .filter((line) => line.length > 0);
  writeSpy.mockRestore();

  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('StructuredLoggerService', () => {
  it('emits structured JSON for a plain string message', () => {
    const logger = new StructuredLoggerService();

    const logged = captureStdoutJsonLines(() => {
      logger.log('hello world');
    });

    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      level: 'log',
      message: 'hello world',
    });
    expect(logged[0].timestamp).toBeDefined();
  });

  it('hoists object-message fields to the root instead of nesting under message', () => {
    const logger = new StructuredLoggerService();

    const logged = captureStdoutJsonLines(() => {
      logger.log({ message: 'x', method: 'GET', statusCode: 200 });
    });

    expect(logged[0].message).toBe('x');
    expect(logged[0].method).toBe('GET');
    expect(logged[0].statusCode).toBe(200);
  });

  it('includes correlationId when logging inside a correlation context', () => {
    const logger = new StructuredLoggerService();

    const logged = captureStdoutJsonLines(() => {
      runWithCorrelationId('corr-123', () => {
        logger.log('inside context');
      });
    });

    expect(logged[0].correlationId).toBe('corr-123');
  });

  it('omits correlationId when logging outside a correlation context', () => {
    const logger = new StructuredLoggerService();

    const logged = captureStdoutJsonLines(() => {
      logger.log('outside context');
    });

    expect(logged[0].correlationId).toBeUndefined();
  });
});
