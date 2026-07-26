import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { ProgramAdminIdentity } from './auth.guard';

export function extractProgramAdmin(request: {
  programAdmin?: ProgramAdminIdentity;
}): ProgramAdminIdentity {
  if (!request.programAdmin) {
    throw new InternalServerErrorException(
      'programAdmin missing from request — ProgramAdminAuthGuard must run before @CurrentProgramAdmin() is resolved',
    );
  }

  return request.programAdmin;
}

export const CurrentProgramAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ProgramAdminIdentity => {
    return extractProgramAdmin(context.switchToHttp().getRequest());
  },
);
