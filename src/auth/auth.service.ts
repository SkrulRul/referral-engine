import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

// Fixed bcrypt hash used to pay the same comparison cost on the missing-admin
// path as on the wrong-password path, closing a user-enumeration timing side-channel.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing-safety', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const admin = await this.prisma.programAdmin.findUnique({
      where: { email: dto.email },
    });

    if (!admin) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      admin.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.jwtService.sign(
      { sub: admin.id, organizationId: admin.organizationId },
      { algorithm: 'HS256' },
    );

    return { accessToken };
  }
}
