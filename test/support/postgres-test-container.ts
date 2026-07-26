import { execSync } from 'node:child_process';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

export async function startMigratedPostgresContainer(): Promise<StartedPostgreSqlContainer> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const connectionUri = container.getConnectionUri();
  process.env.DATABASE_URL = connectionUri;
  process.env.JWT_SECRET ??= 'test-jwt-secret-do-not-use-in-production';
  process.env.JWT_EXPIRES_IN ??= '1h';

  // Applies the committed migration SQL (not `db push`) so e2e suites
  // exercise the real migration, once per suite — never per test.
  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: connectionUri },
    stdio: 'inherit',
  });

  return container;
}
