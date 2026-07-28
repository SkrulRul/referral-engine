import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ProgramAdminAuthGuard, ProgramAdminJwtPayload } from './auth.guard';

describe('ProgramAdminAuthGuard', () => {
  let guard: ProgramAdminAuthGuard;
  let jwtService: { verifyAsync: jest.Mock };

  const buildContext = (headers: Record<string, string | undefined>) => {
    const request: { headers: Record<string, string | undefined> } = {
      headers,
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    guard = new ProgramAdminAuthGuard(jwtService as unknown as JwtService);
  });

  it('returns true and attaches programAdmin to the request for a valid token', async () => {
    const payload: ProgramAdminJwtPayload = {
      sub: 'admin-id',
      organizationId: 'org-id',
    };
    jwtService.verifyAsync.mockResolvedValue(payload);
    const { context, request } = buildContext({
      authorization: 'Bearer valid-token',
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
      algorithms: ['HS256'],
    });
    expect((request as { programAdmin?: unknown }).programAdmin).toEqual({
      id: 'admin-id',
      organizationId: 'org-id',
    });
  });

  it('throws UnauthorizedException when the Authorization header is missing', async () => {
    const { context } = buildContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the Authorization header is malformed', async () => {
    const { context } = buildContext({ authorization: 'Token abc123' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when jwtService.verifyAsync rejects', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
    const { context } = buildContext({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
