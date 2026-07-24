import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { runWithCorrelationId } from './request-context';

const CORRELATION_HEADER = 'x-correlation-id';
const MAX_INCOMING_ID_LENGTH = 100;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HttpRequest');

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(CORRELATION_HEADER);
    const correlationId = incoming
      ? incoming.slice(0, MAX_INCOMING_ID_LENGTH)
      : randomUUID();
    res.setHeader(CORRELATION_HEADER, correlationId);

    runWithCorrelationId(correlationId, () => {
      const startedAtNs = process.hrtime.bigint();
      res.on('finish', () => {
        const durationMs =
          Number(process.hrtime.bigint() - startedAtNs) / 1_000_000;
        this.logger.log({
          message: 'Request completed',
          method: req.method,
          path: req.originalUrl.split('?')[0],
          statusCode: res.statusCode,
          durationMs,
        });
      });
      next();
    });
  }
}
