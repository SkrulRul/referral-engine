# 📋 PRD — Referral Engine

## Vision
Give a Growth team at a B2B SaaS a way to launch referral campaigns, generate unique codes, track who referred whom, and automatically calculate the reward each referrer is owed when a referee converts.

## Problem
B2B referral programs are usually improvised in spreadsheets: nobody audits who generated which code, reward rules change with no record, and calculating payouts is manual and error-prone. We need a system that is the source of truth for campaigns, codes, referrals, and payouts — auditable, with versionable reward rules.

## Personas
- **Program Admin** — creates campaigns, defines reward rules, approves payouts.
- **Referrer** — a user (typically a customer of the B2B SaaS) who shares their referral code.
- **Referee** — the person/company referred, who signs up using that code.

## MVP scope — entities

| Entity | Role |
|---|---|
| `Organization` | Aggregate root. Owns campaigns. Modeled from the start, **with no isolation enforcement yet** (see Open decisions). |
| `Campaign` | Referral program with a validity period and one associated `RewardRule`. |
| `ReferralCode` | Unique code issued to a Referrer within a Campaign. |
| `Referral` | The fact that a Referee signed up using a ReferralCode. Has a state (`pending` → `converted`) with a conversion timestamp — this is the minimum payout trigger (see Open decisions). |
| `RewardRule` | Reward calculation rule tied to a Campaign (e.g. fixed amount, % of a metric). |
| `Payout` | Calculated reward and its state (`pending` → `approved` → `paid`) for a converted Referral. |
| Referrer / Referee identity | Minimal contact data, no dedicated authentication model in the MVP. |

## Out of scope for the MVP (explicitly deferred, not an oversight)
- **Full attribution tracking** (click events, visits, pre-conversion funnel). Replaced by a single `pending → converted` state transition on `Referral`. Revisit if there's ever a need to attribute *why* something converted, not just *that* it converted.
- **Duplicate/fraud detection.** Present in the original domain idea; left out of the MVP so it doesn't dilute the learning focus (DI/decorators/layers). Good candidate for a post-MVP ticket, same as in Facility Agent.
- **Multi-tenancy enforcement** (guards, tenant context derived from auth, per-request scoping). `Organization` exists in the domain model; real isolation lands in a later phase, equivalent to the auth phase in Facility Agent.
- **Real authentication/roles.** Program Admin as a domain concept, not a login system.

## Product/architecture decisions — proposed by PM, pending your confirmation
1. **Multi-tenancy:** model `Organization` as a real aggregate root now; defer enforcement. Pure alternatives rejected: neither "full multi-tenant from day one" (would mix auth with Nest calibration) nor "no Organization at all" (hard to defend for a B2B SaaS domain).
2. **Payout trigger:** minimal state transition on `Referral` (`pending → converted`, with timestamp), not full attribution tracking. Reason: without this, `RewardRule`/`Payout` had no real event to trigger them.
3. **ORM:** TypeORM recommended (decorators + reflect-metadata are part of what you want to calibrate; maps better to the Repository pattern you already know from Spring Data JPA). Final confirmation and the ADR are yours to write in Phase 0 of setup — this is not closed.

> **Note (2026-07-20):** point 3 above is stale — the ORM decision was later closed as **Prisma**, not TypeORM. Kept here verbatim as translated from the Spanish original; not corrected in this file. See the ADR Log for the actual decision and rationale.

## Success criteria (as a portfolio piece)
- Every non-trivial decision has its own ADR, with no undocumented open gaps.
- Test coverage at the port level (fixtures/mocks), not implementation mocks.
- The repo is defensible: any shortcut taken is explicitly flagged, not hidden.
- Explicit comparisons with Spring Boot documented in the NestJS Calibration doc, ready as interview talking points.

## Non-functional requirements and technical needs
This is what separates a toy CRUD from a real backend — and it's where most of the NestJS learning you're after lives. Each point notes which Nest mechanism addresses it, so the Engineering Log/Calibration have something to hook into.

### Data reliability and consistency
- **Idempotency when registering a `Referral`**: a double submit of the same `ReferralCode` by the same Referee must not create two referrals. Needs a real constraint (unique constraint + conflict handling), not just an application-level check with a race condition.
- **Consistency in `Payout` calculation**: a Referral must not generate two payouts due to a race between concurrent requests. Requires a real database-level transaction, not an `if` in the service.
- **Money as `Decimal`, never JS `float`/`number`** in `RewardRule`/`Payout` — the classic floating-point precision error in monetary calculations.
- **Explicit timeouts on I/O operations** (Postgres queries, any future external call) — without a timeout, a slow resource hangs the request indefinitely.
- **Retry with backoff for operations that can fail transiently** (e.g. recalculating a payout if the write fails due to a DB lock) — same pattern as `ExtractionService` in Facility Agent (typed failures, explicit retry, never silent).

### Background and scheduled jobs
Omitted from the first version of this document — corrected here, not silently. A real referral engine isn't just request/response: there's work that happens without anyone asking for it in the moment.
- **Campaign expiration**: a `Campaign` with a past `endDate` must stop issuing valid `ReferralCode`s. Two honest ways to solve this, decision pending an ADR: (a) lazy check on every read (derived `campaign.isActive`, no job) — simpler, but the "expired" state is never persisted; (b) scheduled job (`@nestjs/schedule`, `@Cron`) that periodically marks expired campaigns — more operationally realistic, first real use of a Nest mechanism outside the request/response cycle.
- **Batch processing of `Payout`**: approving/paying out accumulated payouts isn't always synchronous with conversion — in a real system it usually runs as a periodic job (e.g. "nightly close"), not an instant per-request calculation. Strong candidate for `@nestjs/schedule`.
- **Open decision, ADR candidate**: in-process cron (`@nestjs/schedule`) vs. a real queue (BullMQ + Redis). In-process cron is simpler and consistent with the "no unjustified infrastructure" philosophy already applied in Facility Agent (ADR-0027, no Celery/Redis); a queue provides retries/persistence of failed jobs that a cron doesn't give for free. To be decided with explicit trade-offs when the corresponding ticket reaches the backlog, not assumed now.
- **Scope note:** no background job is part of the initial MVP (Phases 1-4). It activates as a post-MVP phase, same pattern as the other "added" phases in Facility Agent.

### Security
- Strict validation on **all** input DTOs (`class-validator`/`class-transformer`, global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` — rejects undeclared fields, doesn't silently ignore them).
- Secrets management: environment variables, real `.env` outside git, versioned `.env.example`. Never hardcode connection strings.
- Query design prepared so that adding `Organization` enforcement later doesn't require rewriting the model (even though the enforcement itself is deferred, see above).
- CORS configured explicitly, not left at default.
- **Real authentication/authorization**: in the previous version of this document this was listed only as "out of scope for the MVP", which was imprecise — deferring the *implementation* is not the same as having no declared direction. Proposed direction (same pattern as Facility Agent Phase 9): static per-role API keys (`X-API-Key`, Nest's `APIKeyHeader`) as the minimal defensible mechanism, with JWT/OAuth2 explicitly ruled out for now due to the lack of an accounts/login model — to be decided via ADR when the corresponding phase arrives, not silently assumed. Until that phase, no write endpoint should be considered secure outside a controlled environment.
- Rate limiting: out of scope for the MVP, but declared here as known technical debt, not a silent omission.

### Observability
- Structured logging with a correlation id per request (middleware/interceptor + Node's equivalent of `contextvars`: `AsyncLocalStorage`).
- Real health checks: `GET /health` (liveness) and `GET /health/ready` (readiness, checks the real connection to Postgres) via `@nestjs/terminus`.
- Consistent error handling across the whole API: a single global `ExceptionFilter` that translates domain exceptions into a uniform error shape (code, message, no stack trace or internal details leaked to the client).
- **Real metrics/APM (Datadog, Prometheus, etc.)**: explicitly out of scope for this portfolio project (requires external infrastructure not justifiable here) — declared as a conscious limit, not a knowledge gap. Structured logging is the deliberate substitute at this scale.
- **PII redaction in logs** (Referrer/Referee email/name): a code-review discipline, no automatic guarantee unless explicitly implemented — same accepted, documented gap as Facility Agent Phase 8.

### Configuration
- `ConfigModule` with environment variable validation at startup (fails fast if a required var is missing, no silent `undefined` in production mid-request).
- Never read `process.env` directly outside the configuration module — it's injected via DI like any other provider.

### Persistence
- Versioned migrations from the first domain commit (TypeORM migrations or Prisma Migrate, depending on the ORM decided) — never `synchronize: true` outside a local environment.
- Explicitly configured connection pool (size, timeout), not the unreviewed default.
- Indexes on frequently searched/joined columns (`organization_id`, `referral_code`) from the initial schema design, not added reactively after a performance problem.

### Testing
- Service-level unit tests with mocks/fakes injected via the DI container (`Test.createTestingModule` + `overrideProvider`), not module mocks with `jest.mock()`.
- Integration/e2e tests with `supertest` against a real Nest module booted in memory — validates DI, pipes, guards, and filters working together, not just isolated business logic.
- Reusable fixtures, no magic data repeated across tests.

### API design and documentation
- Auto-generated OpenAPI/Swagger via `@nestjs/swagger` (decorators on the same validation DTOs) — living documentation, not a Postman collection that drifts out of sync.
- Explicit API versioning (`/v1`) from the first endpoint, even though only one version exists today.
- Pagination on every listing (`GET /campaigns`, `GET /referrals`, etc.) from day one, not an afterthought once the table grows.

### Deployment and operability
- Multi-stage `Dockerfile` (build vs. runtime), final image with no devDependencies.
- CI (GitHub Actions) running lint + typecheck (`strict: true`) + tests on every push/PR.
- Graceful shutdown: Nest module lifecycle hooks (`OnModuleDestroy`) closing the Postgres connection pool properly, not killing the process mid-flight.

### Maintainability
- `strict: true` in TypeScript from the first commit, zero `any`.
- Strict separation of layers (controller/service/repository), no business logic in the controller.
- Every non-trivial decision on this list, once it lands in code, gets documented in the ADR Log — same as the rest of the project.

**Scope note:** not all of these points enter the MVP with the same priority — some (idempotency, transactions, validated DTOs, strict TS) are MVP-level non-negotiable; others (Swagger, health checks, CI/Docker) arrive in closing phases, as in Facility Agent (Phases 7/12). The Product Roadmap will clarify, phase by phase, which NFR is covered in each one.