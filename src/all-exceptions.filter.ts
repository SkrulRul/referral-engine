import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { mapPrismaError } from './prisma/prisma-error-mapper';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // Resolved here rather than the constructor: the adapter host may not
    // be available yet at construction time (see Nest's exception filter docs).
    const { httpAdapter } = this.httpAdapterHost;
    const response = host.switchToHttp().getResponse<unknown>();

    const httpException = this.toHttpException(exception);

    const body = httpException.getResponse();
    httpAdapter.reply(
      response,
      typeof body === 'object' && body !== null
        ? body
        : { statusCode: httpException.getStatus(), message: body },
      httpException.getStatus(),
    );
  }

  private toHttpException(exception: unknown): HttpException {
    if (exception instanceof HttpException) {
      return exception;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = mapPrismaError(exception);
      if (mapped) {
        return mapped;
      }
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );
    return new InternalServerErrorException('Internal server error');
  }
}
