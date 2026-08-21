# FaithHaven

FaithHaven is a React and TypeScript PWA with a PostgreSQL-backed Node API for authenticated prayer, devotionals, calendar events, licensed media, subscriptions, and AI-assisted draft content.

> **AI architecture:** the browser communicates only with the FaithHaven API. The API routes AI work through `AIService` and `GenXClient` to the configured GenX gateway. No client-side AI credentials or direct model-provider calls are used.

## Architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Web client | React, Vite, TypeScript | Responsive PWA interface; secure cookie-based session use only |
| API | Node.js, Express | Authentication, authorization, content, billing, AI gateway, audit logs |
| Persistence | PostgreSQL 16 | Normalized relational storage with SQL migrations |
| Media | Licensed provider records | Bible audio and worship music only when a valid licensed stream is configured |
| Edge | Caddy | HTTPS certificates, reverse proxy, public exposure |

## Local development

Install the two JavaScript workspaces, configure an environment file, start PostgreSQL, then apply migrations.

```bash
npm ci
cd backend && npm ci
cp ../.env.example ../.env
# Set DATABASE_URL for a local PostgreSQL database.
npm run migrate
npm run dev
```

Run the frontend in a second terminal.

```bash
npm run dev
```

## Quality checks

```bash
npm run lint
npm run build
cd backend && npm test
```

The CI workflow also runs migrations against PostgreSQL, audits production dependencies, and builds both containers.

## Production deployment to Webdock

The production stack includes PostgreSQL, the API, the static web client, and Caddy. Only Caddy publishes ports 80 and 443.

```bash
sudo mkdir -p /srv/faithhaven-ai
sudo chown "$USER":"$USER" /srv/faithhaven-ai
cd /srv/faithhaven-ai
git clone https://github.com/amarktainetwork2-collab/Amarktai-Faith-Haven.git .
cp .env.example .env.production
chmod 600 .env.production
# Populate every production value in .env.production.
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build --remove-orphans
docker compose --env-file .env.production ps
curl -fsS http://127.0.0.1/health
```

Before starting the stack, point the production domain’s A/AAAA record to the Webdock VPS and allow inbound TCP ports 80 and 443. Caddy obtains and renews TLS certificates automatically after DNS resolves correctly.

## Required production configuration

The complete list is in `.env.example`. The required values include `DATABASE_URL`, a unique 32-byte-plus `JWT_SECRET`, a specific HTTPS `CORS_ORIGIN`, `APP_URL`, SMTP delivery settings, the approved GenX gateway URL and key, PayFast merchant details, database credentials, and domain/TLS configuration.

Do not commit `.env.production`, pass keys as frontend variables, include secrets in images, or add credentials to the service worker.

## Operational notes

Migrations run before the API starts. Back up PostgreSQL before upgrades and validate restoration in a non-production environment. The deployment workflow in `.github/workflows/deploy-webdock.yml` is manual, validates the compose configuration, verifies API readiness, and reverts the checked-out release if startup fails.

Detailed procedures are available in `docs/`.
