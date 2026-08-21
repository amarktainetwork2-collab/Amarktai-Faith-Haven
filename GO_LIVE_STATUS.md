# FaithHaven — Go-Live Status

_Last updated: 2026-08-21_

## Current status

The repository is a **PostgreSQL-backed FaithHaven PWA** with a server-side, GenX-only AI gateway, cookie sessions, CSRF controls, PayFast server-side processing, licensed-media gating, and a Webdock deployment stack. It is **code-complete and locally database-validated**, but it is **not production-ready** until the external services and VPS deployment are configured and tested.

## Verified implementation

| Area | Current implementation | Validation status |
|---|---|---|
| Database | PostgreSQL migrations and normalized persistence | Verified against fresh local PostgreSQL databases |
| AI | Browser → API → AIService → GenXClient → approved GenX gateway | Source scan and gateway fail-closed test completed; live gateway requires organization credentials |
| Auth | Secure cookies, refresh rotation/replay containment, CSRF, verification/reset, export/deletion | PostgreSQL integration tests completed |
| PayFast | Signed checkout, signature/merchant/amount/currency checks, transaction lock, duplicate ITN protection | Deterministic local callback integration test completed; sandbox/live callback still required |
| Prayer wall | Persistent create/read/edit/delete, anonymous identity protection, reports, reactions, pagination metadata | PostgreSQL integration tests completed |
| Devotionals | Published reads, admin/moderator drafting, scheduling, publishing, archiving, deletion, favorites | Role-protected API integration tests completed |
| PWA | Manifest, icons, cache versioning, offline fallback, API/payment cache exclusion | Static validation completed; installed-device validation remains external |
| CI | Lint, build, PWA validation, unit tests, PostgreSQL migration, integration tests, dependency audit, Docker builds | Enforced in the repository workflow |

## External go-live gates

The following are deliberately not fabricated and must be added at VPS installation time: a production GenX endpoint/key, SMTP sender and credentials, PayFast merchant credentials plus ITN registration, production domain/DNS, Webdock host/secrets, encrypted backup destination, and licensed media catalog/provider credentials. After those values are configured, staging must verify DNS, TLS, Caddy, migration startup, authentication email delivery, GenX responses, PayFast sandbox ITNs, licensed media playback, installed PWA behavior, monitoring, backup/restore, and rollback.

## Release recommendation

**Do not accept public production traffic until the external gates above have been configured and verified.** The source repository is prepared for the controlled VPS installation process documented in `docs/DEPLOYMENT.md` and `docs/FINAL_GO_LIVE_REPORT.md`.
