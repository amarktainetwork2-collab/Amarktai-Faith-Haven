# Production Audit

## Scope

The audit covered the React client, Express API, environment configuration, persistence, authentication, payments, media, PWA assets, Docker, reverse proxy, CI, and Webdock deployment workflow.

| Finding | Resolution | Status |
|---|---|---|
| Embedded SQLite key/value JSON store | Replaced with normalized PostgreSQL schema and SQL migration runner | Implemented |
| Direct model-provider call and browser fallback | Replaced with `AIService` and `GenXClient`; UI fails closed | Implemented |
| Browser-stored bearer token | Replaced with rotating `HttpOnly` refresh cookies, short access cookies, CSRF defense | Implemented |
| Verification/reset values returned by API | Tokens are hashed and delivered only through configured email flow | Implemented |
| Placeholder Bible/worship content | Replaced with licensed media records and unavailable state when no rights source exists | Implemented |
| Empty service worker and minimal manifest | Added cache-versioned public asset strategy, offline page, manifest, icons | Implemented |
| No database service or TLS proxy | Added PostgreSQL, Caddy, private Docker network, health checks | Implemented |
| Thin CI and unguarded deployment | Added frontend/backend/security/container CI and manual rollback-aware deploy workflow | Implemented |
| Full external provider activation | Requires organization-owned GenX, SMTP, PayFast, domain, and media credentials | Blocked externally |

## Key evidence

The former storage model used SQLite and JSON arrays. The former AI path contained a direct external model call and a generated local fallback. The current backend does not initialize SQLite and centralizes all AI generation in the GenX gateway client. The current PWA service worker never intercepts API or payment routes for caching.

## Remaining validation required outside this sandbox

The sandbox does not provide Docker or PostgreSQL, so compose startup, container health checks, production migration, backup/restore, Lighthouse, browser install, provider ITN callbacks, SMTP delivery, and live GenX requests require the Webdock/staging environment and valid organization credentials. These are deployment gates, not UI placeholders.
