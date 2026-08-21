# FaithHaven AI — Green-Light Launch Checklist

This checklist is **release-blocking**.  
If any gate fails, status is **NO GO**.

## Gates (all required)

1. Security/Auth gate
2. Payments gate
3. Data durability gate
4. Feature completeness gate
5. Quality/test gate
6. Ops/SRE gate
7. Deployment/rollback gate

## Exact acceptance tests

### 1) Security/Auth gate
- `NODE_ENV=production` + weak/missing `JWT_SECRET` must fail startup.
- Register/login/me/verify/reset/change-password/logout-all must pass integration checks.
- Non-admin user must get `403` on `/api/admin/*`; admin user must get `200`.

### 2) Payments gate
- Invalid ITN signature must return `400`.
- Non-whitelisted source must return `403` (when whitelist configured).
- Amount mismatch must return `400`.
- Duplicate `COMPLETE` ITN must be idempotent (`200` with no duplicate mutation).
- Reconciliation endpoint must expire stale pending transactions.
- Audit logs must contain checkout/ITN/reconcile events.

### 3) Data durability gate
- Fresh DB migration succeeds.
- Restart preserves data.
- Concurrent writes maintain consistency.
- Backup/restore drill meets target RTO/RPO.

### 4) Feature completeness gate
- Calendar, devotional, and prayer resources must remain server-authorized and PostgreSQL-persisted rather than temporary client-only data.
- Email verification and password reset emails must be provider-delivered and domain-correct.

### 5) Quality/test gate
- Frontend lint/build must pass in CI and on release candidate commit.
- Backend tests must pass (unit + integration + e2e where applicable).

### 6) Ops/SRE gate
- Hardened host baseline validated (firewall, patching, SSH hardening, fail2ban).
- TLS auto-renew tested and verified.
- Metrics/logs/traces dashboards live.
- Alerting tested with synthetic failure.

### 7) Deployment/rollback gate
- Staging release succeeds using production-like environment.
- Rollback drill succeeds within defined target minutes.

## Execution

Use:

```bash
npm run launch:check
```

This runs the repo gate script and prints pass/fail per gate.  
Infrastructure-only checks remain manual until cloud automation is added.
