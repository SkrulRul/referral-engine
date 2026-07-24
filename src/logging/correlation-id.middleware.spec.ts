import { Request, Response } from 'express';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { getCorrelationId } from './request-context';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface MockRequest {
  header: jest.Mock<string | undefined, [string]>;
  method: string;
  originalUrl: string;
}

interface MockResponse {
  setHeader: jest.Mock<void, [string, string]>;
  statusCode: number;
  on: jest.Mock<void, [string, () => void]>;
  finishHandlers: (() => void)[];
}

function createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    header: jest.fn<string | undefined, [string]>().mockReturnValue(undefined),
    method: 'GET',
    originalUrl: '/v1/campaigns?page=2',
    ...overrides,
  };
}

function createMockResponse(): MockResponse {
  const finishHandlers: (() => void)[] = [];
  return {
    setHeader: jest.fn<void, [string, string]>(),
    statusCode: 200,
    on: jest.fn<void, [string, () => void]>((event, handler) => {
      if (event === 'finish') {
        finishHandlers.push(handler);
      }
    }),
    finishHandlers,
  };
}

function callMiddleware(
  middleware: CorrelationIdMiddleware,
  req: MockRequest,
  res: MockResponse,
  next: () => void,
): void {
  middleware.use(req as unknown as Request, res as unknown as Response, next);
}

describe('CorrelationIdMiddleware', () => {
  it('generates a UUID v4 id when no header is supplied', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = createMockRequest();
    const res = createMockResponse();
    const next = jest.fn();

    callMiddleware(middleware, req, res, next);

    const [, generatedId] = res.setHeader.mock.calls[0];
    expect(generatedId).toMatch(UUID_V4_REGEX);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses a short incoming header verbatim instead of generating a new id', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = createMockRequest({
      header: jest.fn().mockReturnValue('caller-id-123'),
    });
    const res = createMockResponse();
    const next = jest.fn();

    callMiddleware(middleware, req, res, next);

    expect(res.setHeader.mock.calls[0]).toEqual([
      'x-correlation-id',
      'caller-id-123',
    ]);
  });

  it('caps an oversized incoming header at exactly 100 characters', () => {
    const oversized = 'a'.repeat(150);
    const middleware = new CorrelationIdMiddleware();
    const req = createMockRequest({
      header: jest.fn().mockReturnValue(oversized),
    });
    const res = createMockResponse();
    const next = jest.fn();

    callMiddleware(middleware, req, res, next);

    const [, cappedId] = res.setHeader.mock.calls[0];
    expect(cappedId).toHaveLength(100);
    expect(cappedId).toBe(oversized.slice(0, 100));
  });

  it('sets up the correlation context for the rest of the request', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = createMockRequest({
      header: jest.fn().mockReturnValue('caller-id-123'),
    });
    const res = createMockResponse();
    let observedDuringNext: string | undefined;

    callMiddleware(middleware, req, res, () => {
      observedDuringNext = getCorrelationId();
    });

    expect(observedDuringNext).toBe('caller-id-123');
  });

  it('logs a completion line with method/path/statusCode/durationMs on finish', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = createMockRequest();
    const res = createMockResponse();
    res.statusCode = 201;

    const logSpy = jest
      .spyOn(
        middleware['logger'] as unknown as { log: (m: unknown) => void },
        'log',
      )
      .mockImplementation(() => undefined);

    callMiddleware(middleware, req, res, () => undefined);
    res.finishHandlers.forEach((handler) => handler());

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [loggedPayload] = logSpy.mock.calls[0] as [Record<string, unknown>];
    expect(loggedPayload).toMatchObject({
      message: 'Request completed',
      method: 'GET',
      path: '/v1/campaigns',
      statusCode: 201,
    });
    expect(typeof loggedPayload.durationMs).toBe('number');
  });
});
