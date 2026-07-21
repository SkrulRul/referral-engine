import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mapPrismaError } from './prisma-error-mapper';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`Prisma error ${code}`, {
    code,
    clientVersion: '7.8.0',
  });
}

describe('mapPrismaError', () => {
  it('maps P2025 (record not found) to NotFoundException', () => {
    const result = mapPrismaError(prismaError('P2025'));

    expect(result).toBeInstanceOf(NotFoundException);
    expect(result?.getStatus()).toBe(404);
  });

  it('maps P2002 (unique constraint) to ConflictException', () => {
    const result = mapPrismaError(prismaError('P2002'));

    expect(result).toBeInstanceOf(ConflictException);
    expect(result?.getStatus()).toBe(409);
  });

  it('returns null for an unmapped Prisma error code', () => {
    const result = mapPrismaError(prismaError('P2003'));

    expect(result).toBeNull();
  });
});
