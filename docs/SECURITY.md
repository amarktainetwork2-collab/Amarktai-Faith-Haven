# Security Controls

FaithHaven applies security headers at Caddy and Nginx, enables restrictive CORS with explicit origins, disables Express fingerprinting, limits JSON request size, attaches request IDs, and exposes no database or API ports outside the internal compose network.

## Identity and sessions

Access tokens are short-lived signed `HttpOnly` cookies. Refresh tokens are random, hashed before storage, rotated on use, and revocable. State-changing requests use a CSRF cookie/header pair. Password reset and email-verification values are random one-time tokens stored only as hashes; normal API responses do not reveal them. Authentication routes have tighter rate limits, and API/AI routes have separate limits.

## Authorization and data protection

Every protected API route verifies the server-side session. Admin and moderation routes verify server-side roles. Ownership conditions are part of database queries for private prayer, calendar, saved document, and conversation records. Audit events record action, actor, request ID, and a hashed IP address without credentials or private content.

## Secrets

Production secrets belong exclusively in the protected `.env.production` file or repository/deployment secret store. They must never be committed, written to logs, sent to the client, or passed as Vite variables. Use separate credentials for production, staging, backups, GenX, email, and payment services.

## Pre-release verification

Run dependency scanning, a secret scan, HTTPS header validation, authenticated/unauthenticated route tests, rate-limit tests, invalid CSRF tests, PayFast callback replay tests, and a third-party penetration test before accepting public traffic. Security controls in code do not replace operational monitoring or incident response.
