import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ProgramAdmin } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

// CommonJS require gives the raw, mutable module object; the `import * as
// bcrypt` namespace above is a frozen ESM interop wrapper whose getters read
// live off this same require-cached object, so spying here also affects it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcryptModule = require('bcrypt') as typeof bcrypt;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    programAdmin: { findUnique: jest.Mock };
  };
  let jwtService: { sign: jest.Mock };

  const loginDto: LoginDto = {
    email: 'admin@example.com',
    password: 'correct-password',
  };

  const admin: ProgramAdmin = {
    id: 'admin_1',
    email: loginDto.email,
    passwordHash: bcrypt.hashSync(loginDto.password, 10),
    organizationId: 'org_1',
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
    updatedAt: new Date('2020-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      programAdmin: { findUnique: jest.fn() },
    };
    jwtService = { sign: jest.fn() };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );
  });

  describe('login', () => {
    it('returns an access token when the admin is found and the password matches', async () => {
      prisma.programAdmin.findUnique.mockResolvedValue(admin);
      jwtService.sign.mockReturnValue('signed-jwt-token');

      const result = await service.login(loginDto);

      expect(prisma.programAdmin.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: admin.id, organizationId: admin.organizationId },
        { algorithm: 'HS256' },
      );
      expect(result).toEqual({ accessToken: 'signed-jwt-token' });
    });

    it('throws UnauthorizedException when the admin is found but the password does not match', async () => {
      prisma.programAdmin.findUnique.mockResolvedValue(admin);

      await expect(
        service.login({ ...loginDto, password: 'wrong-password' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException and still runs a bcrypt comparison when the admin is not found', async () => {
      prisma.programAdmin.findUnique.mockResolvedValue(null);
      const compareSpy = jest.spyOn(bcryptModule, 'compare');

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
      expect(compareSpy).toHaveBeenCalledWith(
        loginDto.password,
        expect.any(String),
      );
      expect(jwtService.sign).not.toHaveBeenCalled();

      compareSpy.mockRestore();
    });
  });
});
