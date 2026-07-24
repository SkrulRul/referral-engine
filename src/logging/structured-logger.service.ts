import { ConsoleLogger } from '@nestjs/common';
import { getCorrelationId } from './request-context';

const RESERVED_LOG_KEYS = new Set([
  'level',
  'pid',
  'timestamp',
  'context',
  'stack',
]);

export class StructuredLoggerService extends ConsoleLogger {
  constructor() {
    super({ json: true });
  }

  protected override getJsonLogObject(
    message: unknown,
    options: Parameters<ConsoleLogger['getJsonLogObject']>[1],
  ) {
    const base = super.getJsonLogObject(message, options);
    const correlationId = getCorrelationId();
    // Object messages (e.g. the middleware's completion log) get their own
    // keys hoisted to the root instead of nesting under `message` —
    // otherwise `statusCode`/`durationMs` end up buried one level deep.
    // Framework-reserved keys are never overwritten by caller-supplied fields.
    const extraFields =
      typeof message === 'object' &&
      message !== null &&
      !(message instanceof Error)
        ? Object.fromEntries(
            Object.entries(message as Record<string, unknown>).filter(
              ([key]) => !RESERVED_LOG_KEYS.has(key),
            ),
          )
        : undefined;

    return {
      ...base,
      ...extraFields,
      ...(correlationId ? { correlationId } : {}),
    };
  }
}
