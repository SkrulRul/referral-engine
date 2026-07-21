import { ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`Prisma error ${code}`, {
    code,
    clientVersion: '7.8.0',
  });
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let reply: jest.Mock;
  let host: ArgumentsHost;
  const response = { marker: 'the-response-object' };

  beforeEach(() => {
    reply = jest.fn();
    const httpAdapterHost = {
      httpAdapter: { reply },
    } as unknown as HttpAdapterHost;
    filter = new AllExceptionsFilter(httpAdapterHost);
    host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;
  });

  it('passes an HttpException through with its own status and body', () => {
    filter.catch(new NotFoundException('Organization org_1 not found'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({
        statusCode: 404,
        message: 'Organization org_1 not found',
      }),
      404,
    );
  });

  it('maps a known Prisma error code (P2002) via the Prisma mapper', () => {
    filter.catch(prismaError('P2002'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({ statusCode: 409 }),
      409,
    );
  });

  it('maps a known Prisma error code (P2003) via the Prisma mapper', () => {
    filter.catch(prismaError('P2003'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({ statusCode: 409 }),
      409,
    );
  });

  it('falls back to a generic 500 for an unmapped Prisma error code, logging the detail', () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();

    filter.catch(prismaError('P2011'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
      500,
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      'Unhandled exception',
      expect.stringContaining('P2011'),
    );

    loggerSpy.mockRestore();
  });

  it('falls back to a generic 500 for a plain unrecognized error, without leaking its message to the client', () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();

    filter.catch(new Error('connection refused: password exposed'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
      500,
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      'Unhandled exception',
      expect.stringContaining('connection refused'),
    );

    loggerSpy.mockRestore();
  });
});
