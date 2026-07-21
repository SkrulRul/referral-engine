import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function mapPrismaError(
  exception: Prisma.PrismaClientKnownRequestError,
): HttpException | null {
  switch (exception.code) {
    case 'P2025':
      return new NotFoundException('Record not found');
    case 'P2002':
      return new ConflictException('A record with this value already exists');
    case 'P2003':
      return new ConflictException(
        'This operation conflicts with existing related records',
      );
    default:
      return null;
  }
}
