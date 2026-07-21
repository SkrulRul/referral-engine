# Referral Engine

A backend service for running B2B referral programs: create campaigns, issue unique referral codes, capture who signed up through which code, and (upcoming) calculate what each referrer is owed.

Built as a portfolio project to calibrate NestJS (DI, decorators, layered architecture) against prior Spring Boot experience — see [`docs/PRD.md`](docs/PRD.md) for the full product/architecture rationale, including every deliberate scope cut and open decision.

## Domain model

| Entity | Status | Notes |
|---|---|---|
| `Organization` | Implemented | Aggregate root; owns campaigns. No tenant isolation enforced yet (deferred by design, see PRD). |
| `Campaign` | Implemented | Has a validity window (`startDate`/`endDate`); "active" is derived on read (`CampaignService.isActive()`), not a persisted or cron-managed state. |
| `ReferralCode` | Implemented | Unique code issued to a Referrer within an active Campaign. Issuance is idempotent per `(campaignId, referrerEmail)` and race-safe under concurrent requests. |
| `Referral` | Implemented | Records that a Referee registered through a `ReferralCode`. Idempotent per `(referralCodeId, refereeEmail)`, enforced by a DB unique constraint, not an application-level check. Starts `pending`. |
| `RewardRule` / `Payout` | Not yet implemented | Reward calculation and the `pending → converted → approved → paid` payout lifecycle — Phase 4. |

## Tech stack

- **NestJS 11** — controller/service/module layering, dependency injection, global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) and a single `ExceptionFilter` that maps Prisma errors to a uniform HTTP error shape.
- **Prisma 7** with `@prisma/adapter-pg`, backed by PostgreSQL. Versioned migrations from the first commit — no `db push`/`synchronize` in any real environment.
- **`class-validator` / `class-transformer`** for DTO validation and normalization.
- **Jest + Supertest + Testcontainers** — e2e suites boot a real Nest app against a disposable Postgres container and apply the committed migration SQL, not `db push`.
- **pnpm**, **Node 24**, TypeScript in `strict` mode.

## Getting started

```bash
pnpm install                 # also runs `prisma generate` via postinstall
cp .env.example .env         # set DATABASE_URL to a real Postgres instance
pnpm exec prisma migrate dev # apply migrations locally
pnpm start:dev                # watch mode, http://localhost:3000
```

Optional: seed sample organizations/campaigns/referral codes:

```bash
pnpm seed
```

## API

All routes are versioned under `/v1` (URI versioning). `GET /health` is version-neutral and checks a real Postgres connection via `@nestjs/terminus`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/organizations` | Create an organization |
| `GET` | `/v1/organizations` | List organizations (paginated) |
| `GET` | `/v1/organizations/:id` | Fetch one organization |
| `POST` | `/v1/campaigns` | Create a campaign under an organization |
| `GET` | `/v1/campaigns` | List campaigns (paginated) |
| `GET` | `/v1/campaigns/:id` | Fetch one campaign |
| `POST` | `/v1/referral-codes` | Issue a referral code for a Referrer within an active campaign |
| `GET` | `/v1/referral-codes/:code` | Look up a referral code and its campaign |
| `POST` | `/v1/referrals` | Register a Referee against a valid, active referral code |
| `GET` | `/v1/referrals/:id` | Look up a referral, its status, code, and campaign |
| `GET` | `/health` | Liveness/readiness (Postgres connectivity) |

## Testing

```bash
pnpm test        # unit tests (src/**/*.spec.ts)
pnpm test:e2e     # e2e tests against a real Postgres testcontainer
pnpm test:cov     # unit test coverage
```

CI (`.github/workflows/ci.yml`) runs format check, lint, build, unit tests, and e2e tests on every push to `master` and every pull request.

## Project structure

```
src/
  organization/     # Organization CRUD
  campaign/          # Campaign CRUD + active-window logic
  referral-code/     # Referral code issuance and lookup
  referral/           # Referral capture and lookup
  common/             # Shared pagination DTOs/helpers
  prisma/             # PrismaService + Prisma error → HTTP mapping
  health/             # Liveness/readiness checks
  all-exceptions.filter.ts  # Global exception filter
prisma/
  schema.prisma       # Data model
  migrations/          # Versioned migrations
  seed.ts               # Sample data script
test/
  *.e2e-spec.ts         # One suite per resource, Testcontainers-backed
```

## Explicitly deferred (not an oversight)

Per the PRD, the following are conscious, documented cuts — not gaps discovered later:

- **Fraud/duplicate-person detection** across different referral codes (e.g. the same Referee using multiple codes).
- **Multi-tenancy enforcement** — `Organization` exists in the model, but no guard/tenant-context scoping yet.
- **Real authentication/authorization** — no login model for any persona; direction (static per-role API keys) is proposed but not implemented.
- **Campaign expiration as a background job** — currently a derived read-time check; a scheduled job is a documented open decision.
- **RewardRule/Payout calculation**, including the transactional guarantees a real payout system needs.
- **Rate limiting** and **real metrics/APM** — declared as known technical debt.

## License

Private, unlicensed portfolio project.
