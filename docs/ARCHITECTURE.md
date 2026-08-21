# FaithHaven Architecture

FaithHaven is deployed as four containers on an isolated Docker network: Caddy, the React static client, the Express API, and PostgreSQL. Caddy is the sole public entry point and forwards API, health, and readiness requests to the API service while serving the static client for all other paths.

## AI boundary

```text
Browser → FaithHaven API → AIService → GenXClient → approved GenX gateway
```

The browser has no AI credential, no provider SDK, and no direct provider URL. `AIService` applies feature prompts, verifies monthly user quota, creates usage records, persists conversation messages, and returns controlled failures. `GenXClient` owns the only gateway HTTP call, request identifiers, abort timeout, retries with backoff, and a circuit breaker. If the gateway is unavailable, the application returns an unavailable state; it does not substitute another model service.

## Authentication

The API uses a short-lived signed access cookie and a rotating refresh cookie. Both are `HttpOnly`, `Secure` in production, and `SameSite=Strict`. Mutating requests require a double-submit CSRF token. Refresh-token hashes, email-verification token hashes, and password-reset token hashes are stored in PostgreSQL. Passwords are salted and hashed with Node’s `scrypt` function.

## Data model

The SQL migration defines users, sessions, verification/reset tokens, subscriptions, payments, AI conversations/messages/usage, private prayer entries, prayer-wall posts/reactions/reports, calendar events, devotionals/favorites, saved generated documents, licensed-media records, newsletters, contact messages, notifications, and audit logs. UUID primary keys, foreign keys, indexes, status checks, and timestamp triggers protect relational integrity.

## Media and external providers

Bible audio and worship music are exposed only from active `media_items` records that include a provider identifier, stream URL, and license reference. The UI shows a safe unavailable state until licensed provider content is configured. SMTP, PayFast, GenX, and media-provider credentials are server-only environment values.
