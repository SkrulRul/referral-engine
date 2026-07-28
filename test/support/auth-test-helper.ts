import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/prisma/prisma.service';

const TEST_PASSWORD = 'test-password-do-not-use-in-production';

interface LoginResponseBody {
  accessToken: string;
}

export async function createAuthenticatedProgramAdmin(
  app: INestApplication<App>,
  prisma: PrismaService,
  organizationId: string,
): Promise<{ programAdminId: string; accessToken: string }> {
  const email = `program-admin-${nanoid(8)}@example.com`;
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const created = await prisma.programAdmin.create({
    data: { email, passwordHash, organizationId },
  });

  const loginResponse = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(201);

  const { accessToken } = loginResponse.body as LoginResponseBody;

  return { programAdminId: created.id, accessToken };
}
