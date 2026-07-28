import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

const BEARER_PREFIX = 'Bearer ';

export interface ProgramAdminJwtPayload {
  sub: string;
  organizationId: string;
}

export interface ProgramAdminIdentity {
  id: string;
  organizationId: string;
}

interface RequestWithProgramAdmin extends Request {
  programAdmin?: ProgramAdminIdentity;
}

@Injectable()
export class ProgramAdminAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithProgramAdmin>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException(
        'Missing or malformed authentication token',
      );
    }

    const token = authHeader.slice(BEARER_PREFIX.length);

    let payload: ProgramAdminJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<ProgramAdminJwtPayload>(
        token,
        { algorithms: ['HS256'] },
      );
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    request.programAdmin = {
      id: payload.sub,
      organizationId: payload.organizationId,
    };

    return true;
  }
}
