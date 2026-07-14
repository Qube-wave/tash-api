# Tash API

Tash API is the backend for a consumer and merchant payments platform. It provides passwordless authentication, NGN wallets, payment tags, saved payment methods, transfers, merchant checkout sessions, refunds, and provider webhook processing.

The service is built with NestJS and TypeScript. PostgreSQL stores application and ledger data, while Redis-backed BullMQ queues handle notifications, provider verification, and merchant webhook delivery. A deterministic mock payment provider is included for local development; Nomba is supported for sandbox and production integrations.

> This is a private repository. The package is marked `UNLICENSED`.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API conventions](#api-conventions)
- [Endpoint reference](#endpoint-reference)
- [Integration examples](#integration-examples)
- [Providers and webhooks](#providers-and-webhooks)
- [Database and queues](#database-and-queues)
- [Development and testing](#development-and-testing)
- [Production checklist](#production-checklist)
- [Troubleshooting](#troubleshooting)

## Features

- Passwordless email and phone signup and login with one-time codes
- Multi-step onboarding for profile, payment tag, and four-digit transaction PIN
- JWT access tokens plus rotating and revocable refresh tokens
- Wallet balances and immutable-style ledger entries using integer minor units
- Tash-to-Tash transfers by payment tag and Nigerian bank transfers
- Wallet funding from saved cards and direct debit mandates
- Card registration, OTP challenges, default-card management, and disabling
- BVN verification with encrypted sensitive data
- Dedicated virtual accounts and funding callbacks
- Bank listing and account-name resolution
- Merchant profiles, API keys, settings, checkout sessions, and transaction history
- Consumer, merchant, and administrator refund workflows
- Request idempotency for resource creation and money movement
- Provider event verification and deduplication
- Queued email and SMS through Resend and Africa's Talking
- Consistent response envelopes, request IDs, DTO validation, rate limits, and Swagger docs

## Technology

| Area           | Implementation                            |
| -------------- | ----------------------------------------- |
| Runtime        | Node.js and TypeScript                    |
| HTTP           | NestJS 11 on Express                      |
| Persistence    | PostgreSQL 16 and TypeORM                 |
| Queues         | Redis 7, BullMQ, and `@nestjs/bullmq`     |
| Authentication | Passport JWT, `@nestjs/jwt`, and Argon2   |
| Validation     | `class-validator` and `class-transformer` |
| API docs       | OpenAPI with Swagger UI                   |
| Providers      | Built-in mock provider and Nomba          |
| Notifications  | Africa's Talking SMS and Resend email     |
| Tests          | Jest, ts-jest, and Supertest              |

## Architecture

The codebase uses NestJS feature modules. Controllers own HTTP concerns, services coordinate business operations, TypeORM entities model persistence, and policy/state-machine files keep financial rules independently testable.

```text
src/
|-- auth/                 OTP auth, onboarding, refresh, unlock, and logout
|-- users/                Consumer profiles and payment-tag resolution
|-- settings/             Payment preferences and transaction PINs
|-- wallets/              Wallets, balances, and ledger entries
|-- transactions/         History, filters, and transaction state changes
|-- transfers/            Internal and bank transfers
|-- cards/                Card registration, management, and wallet funding
|-- direct-debit/         Mandates and direct-debit wallet funding
|-- virtual-accounts/     Dedicated account creation and management
|-- banks/                Bank list and account resolution
|-- bvn/                  BVN verification and encrypted profiles
|-- merchants/            Merchant accounts, API keys, and webhook delivery
|-- pay-with-tash/        Merchant checkout sessions
|-- refunds/              Consumer, merchant, and admin refund access
|-- payment-providers/    Provider contract, mock adapter, and Nomba adapter
|-- webhooks/             Provider callbacks and event deduplication
|-- notifications/        Queued SMS and email delivery
|-- jobs/                 BullMQ processors
|-- idempotency/          Request replay and conflict protection
|-- audit-logs/           Operational audit records
|-- common/               Auth, crypto, errors, filters, guards, and middleware
|-- config/               Validated environment configuration
|-- database/             TypeORM options, data source, and migrations
|-- health/               Liveness and dependency readiness
|-- app.module.ts         Module composition
|-- app.setup.ts          HTTP security, CORS, validation, and Swagger
`-- main.ts               Application bootstrap
```

Most HTTP requests pass through these shared layers:

```text
request
  -> x-request-id middleware
  -> in-process rate-limit guard
  -> JWT or merchant-key guard (when required)
  -> DTO validation
  -> controller and service
  -> PostgreSQL / provider / BullMQ
  -> success envelope or normalized error filter
```

## Getting started

### Prerequisites

- Node.js 20 or newer
- pnpm
- Docker with Docker Compose, or local PostgreSQL and Redis instances

### Local setup

1. Install dependencies.

   ```bash
   pnpm install
   ```

2. Create local configuration.

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL and Redis.

   ```bash
   docker compose up -d
   docker compose ps
   ```

4. Run the API in watch mode.

   ```bash
   pnpm start:dev
   ```

5. Check the process and its dependencies.

   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3000/health/readiness
   ```

Default local URLs:

| Resource      | URL                                      |
| ------------- | ---------------------------------------- |
| API base      | `http://localhost:3000/api/v1`           |
| Swagger UI    | `http://localhost:3000/docs`             |
| Liveness      | `http://localhost:3000/health`           |
| Readiness     | `http://localhost:3000/health/readiness` |
| Static assets | `http://localhost:3000/public`           |

Health routes intentionally sit outside the configured API prefix.

Stop the infrastructure with:

```bash
docker compose down
```

Use `docker compose down -v` only when you also want to permanently remove local PostgreSQL and Redis data.

## Configuration

Nest loads `.env` through `@nestjs/config` and validates supported values during startup. `DATABASE_URL`, when set, takes precedence over the individual database fields.

### Application and infrastructure

| Variable                    | Default                  | Description                                                                 |
| --------------------------- | ------------------------ | --------------------------------------------------------------------------- |
| `NODE_ENV`                  | `development`            | `development`, `test`, or `production`.                                     |
| `PORT`                      | `3000`                   | HTTP listen port.                                                           |
| `APP_NAME`                  | `tash-api`               | Service name shown by health endpoints.                                     |
| `BASE_URL`                  | `http://localhost:3000`  | Public service URL and email asset base URL.                                |
| `API_PREFIX`                | `api/v1`                 | Prefix applied to application routes.                                       |
| `CORS_ORIGINS`              | empty                    | Comma-separated exact origins. Empty allows all origins outside production. |
| `SKIP_EXTERNAL_CONNECTIONS` | `false` outside tests    | Skip database, queues, and feature modules for isolated tests/diagnostics.  |
| `DATABASE_URL`              | unset                    | Complete PostgreSQL connection URL.                                         |
| `DATABASE_HOST`             | `localhost`              | PostgreSQL host without `DATABASE_URL`.                                     |
| `DATABASE_PORT`             | `5432`                   | PostgreSQL port.                                                            |
| `DATABASE_USERNAME`         | `tash`                   | PostgreSQL user.                                                            |
| `DATABASE_PASSWORD`         | `tash`                   | PostgreSQL password.                                                        |
| `DATABASE_NAME`             | `tash`                   | PostgreSQL database.                                                        |
| `DATABASE_SSL`              | `false`                  | Enable TLS with `rejectUnauthorized: false`.                                |
| `REDIS_URL`                 | `redis://localhost:6379` | BullMQ and readiness-check connection URL. `rediss://` is supported.        |

### Authentication and security

| Variable                           | Default                 | Description                                          |
| ---------------------------------- | ----------------------- | ---------------------------------------------------- |
| `JWT_ACCESS_TOKEN_SECRET`          | development placeholder | Access-token signing secret; replace in production.  |
| `JWT_REFRESH_TOKEN_SECRET`         | development placeholder | Refresh-token signing secret; replace in production. |
| `JWT_ACCESS_TOKEN_TTL_SECONDS`     | `900`                   | Access-token lifetime (15 minutes).                  |
| `JWT_REFRESH_TOKEN_TTL_SECONDS`    | `2592000`               | Refresh-token lifetime (30 days).                    |
| `VERIFICATION_TOKEN_TTL_SECONDS`   | `86400`                 | Verification session lifetime.                       |
| `PASSWORD_RESET_TOKEN_TTL_SECONDS` | `1800`                  | Reserved reset-token lifetime.                       |
| `MAX_OTP_ATTEMPTS`                 | `5`                     | Maximum OTP attempts in app configuration.           |
| `BVN_ENCRYPTION_KEY`               | development placeholder | BVN encryption key material; replace in production.  |
| `TRANSACTION_PIN_MAX_ATTEMPTS`     | `5`                     | Failed PIN attempts before lockout.                  |
| `TRANSACTION_PIN_LOCK_MINUTES`     | `15`                    | PIN lockout duration.                                |

### Notifications

| Variable                    | Default                          | Description                                   |
| --------------------------- | -------------------------------- | --------------------------------------------- |
| `AFRICAS_TALKING_BASE_URL`  | `https://api.africastalking.com` | SMS API URL.                                  |
| `AFRICAS_TALKING_API_KEY`   | empty                            | SMS provider key; required in production.     |
| `AFRICAS_TALKING_USERNAME`  | empty                            | SMS account username; required in production. |
| `AFRICAS_TALKING_SENDER_ID` | empty                            | Optional SMS sender ID.                       |
| `RESEND_API_KEY`            | empty                            | Email provider key; required in production.   |
| `RESEND_FROM_EMAIL`         | empty                            | Verified email sender address.                |

OTP delivery is queued. Healthy PostgreSQL and Redis checks do not prove that an external notification provider is correctly configured.

### Payment provider

| Variable                         | Default                    | Description                           |
| -------------------------------- | -------------------------- | ------------------------------------- |
| `PAYMENT_PROVIDER`               | `mock`                     | Active adapter: `mock` or `nomba`.    |
| `NOMBA_BASE_URL`                 | sandbox outside production | Nomba API base URL.                   |
| `NOMBA_PARENT_ACCOUNT_ID`        | empty                      | Nomba parent account ID.              |
| `NOMBA_SUB_ACCOUNT_ID`           | empty                      | Nomba sub-account ID.                 |
| `NOMBA_CLIENT_ID`                | empty                      | Nomba OAuth client ID.                |
| `NOMBA_PRIVATE_KEY`              | empty                      | Nomba private API key.                |
| `NOMBA_ENCRYPTION_KEY`           | empty                      | Nomba payload encryption key.         |
| `NOMBA_WEBHOOK_SIGNATURE_KEY`    | empty                      | Nomba callback verification key.      |
| `NOMBA_CARD_TOKENIZATION_AMOUNT` | `50.00`                    | Positive decimal tokenization amount. |

Production startup rejects placeholder JWT/BVN secrets, missing notification credentials, and incomplete Nomba configuration. Inject secrets from the deployment platform; never commit them.

## API conventions

### Responses and validation

Successful results are wrapped automatically:

```json
{
  "success": true,
  "data": {}
}
```

Errors contain a stable code and request ID:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed.",
    "details": ["amount must not be less than 1"]
  },
  "requestId": "req_00000000-0000-0000-0000-000000000000"
}
```

The global validation pipe transforms declared types, removes no unknown data silently, and rejects undeclared properties. Every response includes `x-request-id`. A client may send an `x-request-id` of up to 128 characters; otherwise the server generates one.

### Authentication

Consumer endpoints use a JWT access token:

```http
Authorization: Bearer <access-token>
```

Merchant server-to-server endpoints accept either:

```http
Authorization: Bearer <merchant-api-key>
```

or:

```http
x-tash-merchant-key: <merchant-api-key>
```

The complete merchant key is returned only at creation time. Store it in a secret manager.

### Idempotency

Protected creation and money-moving routes require:

```http
Idempotency-Key: <unique-client-generated-value>
```

Keys are scoped to the user or merchant and route and expire after 24 hours. Retrying an identical request with the same key replays a completed response. Reusing the key with a different body returns `409 IDEMPOTENCY_CONFLICT`.

Idempotency is required for virtual-account creation, card/direct-debit wallet funding, both transfer types, Pay with Tash session creation and authorization, and merchant/admin refund creation. Generate a UUID once per logical operation and retain it for retries.

### Money

Amounts are integer minor units. For NGN, `5000` represents NGN 50.00. Do not send floating-point major units.

### Rate limits

Current one-minute, in-process buckets are:

| Bucket                    | Limit |
| ------------------------- | ----: |
| Login-related POST routes |     8 |
| Payment writes            |    30 |
| Merchant routes           |   120 |
| General traffic           |   300 |

The Nomba callback skips this limiter. Because counters are process-local, replace or centralize this implementation before depending on it across multiple replicas.

## Endpoint reference

Paths are relative to `/api/v1` unless noted. Swagger at `/docs` is the interactive source for exact DTO fields and schemas.

### Health

| Method | Path                | Auth   | Purpose                                     |
| ------ | ------------------- | ------ | ------------------------------------------- |
| `GET`  | `/health`           | Public | Liveness and uptime; no API prefix.         |
| `GET`  | `/health/readiness` | Public | PostgreSQL and Redis checks; no API prefix. |

### Authentication and users

| Method  | Path                                      | Auth                | Purpose                            |
| ------- | ----------------------------------------- | ------------------- | ---------------------------------- |
| `POST`  | `/auth/send-phone-verification`           | Public              | Send signup SMS OTP.               |
| `POST`  | `/auth/complete-phone-verification`       | Public              | Verify phone and start onboarding. |
| `POST`  | `/auth/send-email-verification`           | Public              | Send signup email OTP.             |
| `POST`  | `/auth/complete-email-verification`       | Public              | Verify email and start onboarding. |
| `POST`  | `/auth/onboarding/profile`                | Onboarding token    | Save profile data.                 |
| `POST`  | `/auth/onboarding/tag`                    | Onboarding token    | Choose payment tag.                |
| `POST`  | `/auth/onboarding/pin`                    | Onboarding token    | Set PIN and issue auth tokens.     |
| `POST`  | `/auth/login/phone/send-verification`     | Public              | Send phone login OTP.              |
| `POST`  | `/auth/login/phone/complete-verification` | Public              | Verify OTP and issue tokens.       |
| `POST`  | `/auth/login/email/send-verification`     | Public              | Send email login OTP.              |
| `POST`  | `/auth/login/email/complete-verification` | Public              | Verify OTP and issue tokens.       |
| `POST`  | `/auth/me/email/send-verification`        | JWT                 | Start email update.                |
| `POST`  | `/auth/me/email/complete-verification`    | JWT                 | Complete email update.             |
| `POST`  | `/auth/me/phone/send-verification`        | JWT                 | Start phone update.                |
| `POST`  | `/auth/me/phone/complete-verification`    | JWT                 | Complete phone update.             |
| `POST`  | `/auth/refresh`                           | Refresh token       | Rotate and issue a new token pair. |
| `POST`  | `/auth/unlock`                            | Refresh token + PIN | Unlock a returning client session. |
| `POST`  | `/auth/logout`                            | JWT                 | Revoke one refresh token.          |
| `POST`  | `/auth/logout-all`                        | JWT                 | Revoke all user refresh tokens.    |
| `GET`   | `/users/me`                               | JWT                 | Get authenticated profile.         |
| `PATCH` | `/users/me/tag`                           | JWT                 | Change payment tag.                |
| `GET`   | `/users/resolve/:recipient`               | JWT                 | Resolve a recipient tag.           |

### Consumer payments

| Method       | Path                                     | Auth              | Purpose                               |
| ------------ | ---------------------------------------- | ----------------- | ------------------------------------- |
| `GET/PATCH`  | `/settings/payment`                      | JWT               | Read or update payment preferences.   |
| `POST/PATCH` | `/settings/transaction-pin`              | JWT               | Create or change transaction PIN.     |
| `POST/GET`   | `/bvn/verify`, `/bvn/status`             | JWT               | Verify BVN or get its status.         |
| `POST`       | `/bvn/retry`                             | JWT               | Retry failed BVN verification.        |
| `GET`        | `/banks`                                 | JWT               | List supported banks.                 |
| `POST`       | `/banks/resolve-account`                 | JWT               | Resolve bank account name.            |
| `GET`        | `/wallets`                               | JWT               | List wallets.                         |
| `GET`        | `/wallets/:uuid`                         | JWT               | Get a wallet.                         |
| `GET`        | `/wallets/:uuid/balance`                 | JWT               | Get wallet balances.                  |
| `GET`        | `/wallets/:uuid/transactions`            | JWT               | Get wallet transactions.              |
| `POST`       | `/wallets/:walletUuid/fund/card`         | JWT + idempotency | Fund from a saved card.               |
| `POST`       | `/wallets/:walletUuid/fund/direct-debit` | JWT + idempotency | Fund through a mandate.               |
| `POST`       | `/transfers/tash`                        | JWT + idempotency | Transfer by payment tag.              |
| `POST`       | `/transfers/bank`                        | JWT + idempotency | Transfer to a bank account.           |
| `POST`       | `/transfers/:reference/requery`          | JWT               | Refresh provider state.               |
| `GET`        | `/transfers/:reference`                  | JWT               | Get transfer by reference.            |
| `GET`        | `/transactions`                          | JWT               | Filter/cursor-paginate history.       |
| `GET`        | `/transactions/:uuid`                    | JWT               | Get transaction by UUID.              |
| `GET`        | `/transactions/reference/:reference`     | JWT               | Get transaction by reference.         |
| `GET`        | `/refunds`, `/refunds/:uuid`             | JWT               | List or get consumer-visible refunds. |

`GET /transactions` accepts type, status, direction, currency, date range, amount range, cursor, and a limit up to 100.

### Cards and bank-debit instruments

| Method     | Path                                                 | Auth                        | Purpose                          |
| ---------- | ---------------------------------------------------- | --------------------------- | -------------------------------- |
| `POST`     | `/cards/registration-sessions`                       | JWT                         | Start card registration.         |
| `POST`     | `/cards/registration-sessions/:reference/card`       | JWT                         | Submit card details.             |
| `POST`     | `/cards/registration-sessions/:reference/otp`        | JWT                         | Submit provider OTP.             |
| `POST`     | `/cards/registration-sessions/:reference/resend-otp` | JWT                         | Resend provider OTP.             |
| `POST`     | `/cards/registration-sessions/:reference/complete`   | JWT                         | Complete redirect registration.  |
| `GET`      | `/cards`, `/cards/:uuid`                             | JWT                         | List or get saved cards.         |
| `PATCH`    | `/cards/:uuid/default`                               | JWT                         | Set default card.                |
| `POST`     | `/cards/:uuid/disable`                               | JWT                         | Disable card.                    |
| `DELETE`   | `/cards/:uuid`                                       | JWT                         | Delete card.                     |
| `POST/GET` | `/direct-debit/mandates`                             | JWT                         | Create or list mandates.         |
| `GET`      | `/direct-debit/mandates/:uuid`                       | JWT                         | Get mandate.                     |
| `POST`     | `/direct-debit/mandates/:uuid/authorize`             | JWT                         | Authorize mandate.               |
| `POST`     | `/direct-debit/mandates/:uuid/revoke`                | JWT                         | Revoke mandate.                  |
| `POST/GET` | `/virtual-accounts`                                  | JWT (+ idempotency on POST) | Create or list virtual accounts. |
| `GET`      | `/virtual-accounts/:uuid`                            | JWT                         | Get virtual account.             |
| `POST`     | `/virtual-accounts/:uuid/disable`                    | JWT                         | Disable virtual account.         |

### Merchants and Pay with Tash

| Method      | Path                                                   | Auth                       | Purpose                           |
| ----------- | ------------------------------------------------------ | -------------------------- | --------------------------------- |
| `POST`      | `/merchants`                                           | JWT                        | Create a merchant.                |
| `GET/PATCH` | `/merchants/me`                                        | JWT                        | Read or update owned merchant.    |
| `GET/PATCH` | `/merchants/me/settings`                               | JWT                        | Read or update merchant settings. |
| `POST`      | `/merchants/me/webhook-secret/rotate`                  | JWT                        | Rotate webhook secret.            |
| `POST/GET`  | `/merchants/me/api-keys`                               | JWT                        | Create or list API keys.          |
| `DELETE`    | `/merchants/me/api-keys/:uuid`                         | JWT                        | Revoke API key.                   |
| `GET`       | `/merchants/:merchantCode`                             | Public                     | Get public merchant profile.      |
| `POST`      | `/pay-with-tash/sessions`                              | Merchant key + idempotency | Create checkout.                  |
| `GET`       | `/pay-with-tash/sessions/:reference`                   | Public                     | Get public checkout.              |
| `GET`       | `/pay-with-tash/sessions/:reference/status`            | Public                     | Poll checkout status.             |
| `POST`      | `/pay-with-tash/sessions/:reference/authorize`         | JWT + idempotency          | Authorize payment.                |
| `POST`      | `/pay-with-tash/sessions/:reference/cancel`            | JWT                        | Cancel payment.                   |
| `GET`       | `/merchants/me/pay-with-tash/sessions/:reference`      | Merchant key               | Get owned session.                |
| `GET`       | `/merchants/me/transactions`                           | Merchant key               | List merchant transactions.       |
| `POST`      | `/merchants/me/transactions/:transactionUuid/refunds`  | Merchant key + idempotency | Create merchant refund.           |
| `GET`       | `/merchants/me/refunds`, `/merchants/me/refunds/:uuid` | Merchant key               | List or get refunds.              |
| `POST`      | `/admin/transactions/:transactionUuid/refunds`         | Admin JWT + idempotency    | Create admin refund.              |

### Provider callbacks

| Method | Path                                                       | Auth                | Purpose                            |
| ------ | ---------------------------------------------------------- | ------------------- | ---------------------------------- |
| `POST` | `/payment-providers/nomba/callback`                        | Provider signature  | Verify/process raw Nomba callback. |
| `POST` | `/webhooks/payment-providers/mock/virtual-account-funding` | Public local helper | Simulate virtual-account funding.  |

Do not expose the mock callback route on a public production deployment.

## Integration examples

### Passwordless signup

1. Send an email or phone verification code.
2. Complete verification with the six-character token.
3. Pass the returned `onboardingSessionToken` to the profile step.
4. Continue with the tag step.
5. Finish with the PIN step to receive the user and access/refresh tokens.

See [MOBILE_USER_APP_FLOW.md](./MOBILE_USER_APP_FLOW.md) for the full consumer integration sequence, secure token-storage guidance, and request/response samples.

### Authenticated request

```bash
curl http://localhost:3000/api/v1/users/me \
  -H 'Authorization: Bearer <access-token>'
```

### Internal transfer

```bash
curl -X POST http://localhost:3000/api/v1/transfers/tash \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 83d86ee9-cc05-4182-aad7-3cd07b23b81e' \
  -d '{
    "recipient": "$recipient",
    "walletUuid": "2b096814-1258-473a-9d88-9ef26694465f",
    "amount": 5000,
    "currency": "NGN",
    "description": "Lunch",
    "transactionPin": "1234"
  }'
```

The default funding source is `wallet`. A transfer can instead use `card` or `direct_debit` with the matching `cardUuid` or `mandateUuid`.

### Merchant checkout

```bash
curl -X POST http://localhost:3000/api/v1/pay-with-tash/sessions \
  -H 'Authorization: Bearer <merchant-api-key>' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: b233693d-e5ec-469b-95ab-3af118ddf424' \
  -d '{
    "amount": 12500,
    "currency": "NGN",
    "merchantReference": "order_12345",
    "description": "Order #12345",
    "callbackUrl": "https://merchant.example/webhooks/tash",
    "redirectUrl": "https://merchant.example/orders/12345"
  }'
```

The consumer authorizes the returned reference with their JWT, transaction PIN, and a wallet, card, or mandate UUID.

## Providers and webhooks

### Mock provider

Use `PAYMENT_PROVIDER=mock` locally. It returns deterministic bank, BVN, card, virtual-account, debit, transfer, and refund results without real payment calls.

Useful mock cases:

- a BVN ending in `000` fails verification
- card OTP `000000` fails; another valid six-character value succeeds
- card registration produces a mock Visa ending in `1111`
- all mock account data is synthetic

The payment mock does not mock Resend or Africa's Talking. OTP endpoints still enqueue real notification jobs when exercised end to end.

### Nomba

Set `PAYMENT_PROVIDER=nomba` and configure all `NOMBA_*` values. The application retains the callback's raw bytes for signature verification, persists/deduplicates provider events, and then applies state changes.

### Merchant webhooks

Merchant callbacks run asynchronously. Receivers should verify the Tash signature with their webhook secret, respond quickly, deduplicate events, tolerate retries/out-of-order delivery, and process business work asynchronously.

## Database and queues

### Schema management

Migrations live in `src/database/migrations` and compile to `dist/database/migrations`.

- Development enables TypeORM synchronization and also configures compiled pending migrations to run at startup.
- Test and production disable synchronization.
- With external connections enabled, application startup runs pending compiled migrations automatically.

Never enable synchronization in production. Build before production startup so migration JavaScript exists in `dist`, and back up the database before migration-bearing releases.

### Financial consistency

Wallet operations are backed by ledger entries. Services use database transactions, policies, and a transaction state machine to prevent invalid balances and state changes. New money flows should consider the ledger, transaction record, provider reference, idempotency record, and audit trail together.

### Queues

BullMQ processors run in the Nest application process and use Redis for:

- SMS and email notifications
- provider verification/requery jobs
- merchant webhook delivery

A standard API instance requires Redis at startup, and enqueueing endpoints require healthy queue connectivity.

## Development and testing

### Commands

| Command            | Purpose                             |
| ------------------ | ----------------------------------- |
| `pnpm start`       | Start once from TypeScript.         |
| `pnpm start:dev`   | Start in watch mode.                |
| `pnpm start:debug` | Watch with Node inspector.          |
| `pnpm build`       | Compile to `dist`.                  |
| `pnpm start:prod`  | Run `dist/main.js`; build first.    |
| `pnpm lint`        | Run ESLint with configured fixes.   |
| `pnpm format`      | Format source and test TypeScript.  |
| `pnpm test`        | Run unit tests.                     |
| `pnpm test:watch`  | Run unit tests in watch mode.       |
| `pnpm test:cov`    | Generate coverage in `coverage`.    |
| `pnpm test:e2e`    | Run the Supertest end-to-end suite. |

Unit tests sit beside implementations as `*.spec.ts`; e2e configuration is under `test/`.

```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```

Tests normally set `SKIP_EXTERNAL_CONNECTIONS=true`, allowing application-shell tests to run without PostgreSQL or Redis. Persistence/queue tests must provide and clean up their own dependencies.

For financial changes, test happy paths, ownership, insufficient balances, currency mismatches, PIN lockout, duplicate/idempotent requests, provider pending/failure states, and webhook verification/deduplication.

## Production checklist

1. Set `NODE_ENV=production`.
2. Generate independent, high-entropy JWT secrets and BVN encryption key material.
3. Configure managed PostgreSQL and Redis, using TLS where appropriate.
4. Configure Nomba, Resend, and Africa's Talking production credentials.
5. Set the public `BASE_URL`, explicit `CORS_ORIGINS`, and intended `API_PREFIX`.
6. Run `pnpm install --frozen-lockfile` and `pnpm build`.
7. Back up PostgreSQL before startup applies new migrations.
8. Terminate HTTPS at the ingress/load balancer and protect every provider secret.
9. Centralize rate limiting before running multiple replicas.
10. Monitor health, queue failures, callback failures, and request IDs.

Readiness reports dependency state in a JSON body. Verify its HTTP-status behavior against your orchestration probe policy before using it to eject instances.

## Troubleshooting

### PostgreSQL connection fails

- Wait for `tash-postgres` to become healthy in `docker compose ps`.
- Check `DATABASE_URL` first; it overrides all individual database variables.
- From another container, use the Compose service name `postgres`, not `localhost`.

### Redis or queued work fails

- Run `docker compose exec redis redis-cli ping` and expect `PONG`.
- Check `REDIS_URL`, credentials, database suffix, and `redis://` versus `rediss://`.
- Inspect application logs for failed BullMQ jobs and provider errors.

### CORS only fails in production

Development permits any origin when `CORS_ORIGINS` is empty; production does not. Configure exact comma-separated origins, including scheme and port.

### A write returns an idempotency error

Send a non-empty `Idempotency-Key`. Retry the same logical request with the same body/key, and use a new key when the operation or body changes.

### Readiness says dependencies are skipped

`SKIP_EXTERNAL_CONNECTIONS=true` removes database/queue feature imports and reports both checks as `skipped`. Set it to `false` for a functional API.

### Swagger input is rejected

DTO validation rejects extra properties. Check the current Swagger schema and use valid UUIDs, ISO currency/date/email/phone formats, and integer minor-unit amounts.

## Additional documentation

- [Mobile user app flow](./MOBILE_USER_APP_FLOW.md) - full consumer integration and payload examples
- [Swagger UI](http://localhost:3000/docs) - live local OpenAPI documentation
