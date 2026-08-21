# FaithHaven Final Engineering and Go-Live Report

## Final production gate

| Gate | Status | Evidence and limitation |
|---|---|---|
| **A. Code complete** | **PASS** | The final remediation branch implements the production data, security, payment, AI, privacy, PWA, and deployment controls documented below. |
| **B. Staging verified** | **FAIL** | No Webdock or other external staging host, domain, or provider configuration was supplied. Local production-style API and PostgreSQL checks passed, but they are not a staging deployment. |
| **C. External activation complete** | **FAIL** | GenX, SMTP, PayFast sandbox/live, DNS/TLS, Webdock, encrypted backup, monitoring, and licensed-media activation credentials remain intentionally external. |
| **D. Production ready** | **FAIL** | Public production traffic must not be accepted until gates B and C are completed and recorded. |

> **Verdict:** FaithHaven is **code-complete and deployable**, but not yet **production-ready**. The remaining work is controlled external installation and verification, not unimplemented substitute behavior.

## Completed and fixed

The application now uses PostgreSQL migrations and relational entities rather than embedded client data. Authentication uses cookie sessions, CSRF protection, refresh-token rotation, replay containment, verification/reset token hashing, session revocation, role checks, account export, and account deletion. The final pass added resend-verification handling, data export/deletion UI, a truthful privacy policy, and an explicit rejected-origin CORS response.

All AI requests remain on the sole approved path: **browser → FaithHaven API → AIService → GenXClient → GenX gateway**. Repository-wide scans found no prohibited provider references or credentials. The final pass also made AI quota reservation transaction-safe by locking the user row and counting pending requests, then proved that two simultaneous requests cannot consume the last monthly allowance twice.

PayFast checkout now persists the plan code, and ITN handling has safe signature-length validation, merchant/amount/currency checks, transaction-scoped row locking, duplicate-notification protection, plan-appropriate subscription activation, and audit events. A real local callback test exposed and corrected a PostgreSQL SQL parameter-type defect before final validation.

Prayer-wall requests are PostgreSQL-backed with anonymous-author identity suppression, cursor metadata, persistent reactions/reports, and owner edit/delete controls. Devotionals now support editorial listing, drafts, scheduled publication metadata, publishing, archiving, soft deletion, favorites, and role-protected API operations. Admin metrics map to actual database queries, and the subscribers list has a protected server endpoint rather than a client placeholder.

The PWA has manifest/icon validation, cache versioning, offline fallback, stale-cache removal, and explicit API/payment cache bypass. The static web CSP now permits only the external typography actually loaded by the document while keeping scripts, frames, API connections, and workers restricted. Public pages no longer present fabricated testimonials, user counts, ratings, prayer counts, trial terms, prices, entitlement claims, or simulated AI responses.

## Tests actually run

| Command or check | Result |
|---|---|
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** |
| `npm run validate:pwa` | **PASS** |
| `npm audit --omit=dev --audit-level=high` | **PASS — 0 vulnerabilities** |
| `cd backend && npm test` | **PASS — 2/2 unit tests** |
| `cd backend && npm run test:integration` against real PostgreSQL | **PASS — 6/6 integration tests** |
| Fresh PostgreSQL migration chain | **PASS — `001_initial_schema.sql`, `002_payment_plan_code.sql` applied to an empty database** |
| Local API `/health` and `/ready` | **PASS** |
| Local CORS behavior | **PASS — configured origin 200 with allow-origin header; untrusted origin 403 without allow-origin header** |
| Local API security headers | **PASS — CSP, referrer policy, no-sniff, and frame protections present** |
| Repository provider/marker scan | **PASS — no prohibited provider references or unresolved engineering markers** |
| Docker compose/image runtime | **NOT RUN — Docker is unavailable in this sandbox; CI builds images** |
| Installed PWA/offline/mobile acceptance | **NOT RUN — requires HTTPS device/staging environment** |
| Browser accessibility engine | **NOT RUN to completion — both browser audit tools encountered sandbox browser-driver connectivity/version incompatibilities; this is not a passing WCAG result** |

## External activation checklist

| External service | Configuration required | Exact post-activation test |
|---|---|---|
| GenX | `GENX_API_URL`, `GENX_API_KEY`, model/contract confirmation | Verified account sends a chat and draft request; confirm safe response, usage record, quota behavior, and no client secret exposure. |
| SMTP | `SMTP_URL`, `EMAIL_FROM`, domain authentication | Register, resend verification, reset password, and confirm reset; inspect provider delivery and bounce logs. |
| PayFast | Merchant ID/key/passphrase, sandbox/live endpoint, ITN URL, source controls | Run a PayFast sandbox checkout, valid ITN, duplicate ITN, invalid signature, cancellation, and reconciliation review. |
| Domain/TLS/Webdock | DNS A/AAAA, `DOMAIN`, `ACME_EMAIL`, VPS SSH/deploy secrets | Validate Caddy certificate issuance, HTTPS headers, deep links, API readiness, and rollback from a verified release. |
| PostgreSQL backup | Encrypted off-host destination and retention policy | Create backup, restore to isolated database, run migration/health/authentication smoke test, and record restore evidence. |
| Licensed media | Provider credentials, license references, approved catalog records | Verify catalog visibility, playback, provider failure state, rights reference, and no unauthorised stream is exposed. |
| PWA/mobile/a11y | HTTPS staging origin and supported devices | Install on Android/iOS/desktop; test login/logout, offline navigation, reconnect, service-worker update, keyboard traversal, screen-reader labels, contrast, and touch targets. |

## Deployment and rollback

Merge the validated release only after CI succeeds, create a protected `.env.production` on the Webdock VPS, and use the manual deployment workflow. It validates compose configuration, starts migrations before the API, waits for readiness, and restores the previously checked-out release if startup fails. Do not declare success without HTTPS health checks, live provider validation, a backup/restore exercise, and a documented rollback drill.
