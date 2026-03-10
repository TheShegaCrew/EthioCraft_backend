# Deployment Strategy

## Target Topology

- `API`: Node.js + Express app (containerized)
- `DB`: PostgreSQL (managed service preferred in production)
- `Cache`: Redis (optional but recommended for marketplace reads)
- `Object Storage`: S3-compatible storage for uploaded product media
- `Gateway/Web`: reverse proxy + TLS termination (Nginx, managed ingress, or cloud LB)

## Environment Segments

- `local`: Docker Compose with Postgres + Redis and local API process
- `staging`: production-like infra, sandbox payment credentials, synthetic data
- `production`: managed PostgreSQL, managed Redis, autoscaled API, hardened secrets

## CI/CD Pipeline

1. Install dependencies and run `npm run check:syntax`
2. Run Prisma checks and migrations in CI/CD
3. Build image and tag with commit SHA
4. Deploy to staging
5. Run smoke tests on `/health` and critical API flows
6. Promote to production after approval

## Migration and Rollout Safety

- Keep migrations additive first (new tables/nullable columns)
- Use backward-compatible API contracts for at least one release window
- Release order:
  1. Deploy schema migration
  2. Deploy backend image
  3. Enable new routes/features

## Payment Integration Strategy (TeleBirr + Chapa)

- Keep provider credentials in secret manager (`TELEBIRR_*`, `CHAPA_*`)
- Use webhook endpoints for final payment reconciliation:
  - `POST /api/v1/payments/webhooks/telebirr`
  - `POST /api/v1/payments/webhooks/chapa`
- Verify signatures before state transitions
- Persist raw webhook payloads for replay and auditing (`payment_webhook_events`)

## AI and Reporting Strategy

- Start with rule-based or mock provider in staging
- Add pluggable LLM orchestration behind service layer
- Persist conversations and report outputs for admin traceability
- Add rate limits and role-scoped reporting access

## Security Baseline

- JWT auth with short-lived tokens
- Role-based guards at route level and service layer checks
- TLS-only traffic in staging/production
- Rotate secrets regularly and avoid hardcoded provider keys
- Enable audit logging for high-risk admin and payment actions

## Observability

- Structured logs with request IDs
- Error monitoring and alerting
- Dashboard metrics from `report_jobs`, `payments`, `orders`, and verification queue
- Daily backup policy for Postgres and retention checks

## Example Runtime Checklist

- `NODE_ENV=production`
- `DATABASE_URL` points to managed Postgres
- `CACHE_ENABLED=true` and valid `REDIS_URL`
- TeleBirr/Chapa webhook secrets configured
- Prisma migration applied before serving traffic
