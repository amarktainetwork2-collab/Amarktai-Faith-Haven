# Webdock Deployment

## Preconditions

Create a Webdock VPS with Docker Engine and the Docker Compose plugin installed. Point the public domain’s DNS A/AAAA record to the VPS before deployment. Open inbound ports 80 and 443, retain SSH access on its approved port, and do not expose PostgreSQL or the API container directly.

## Install

```bash
sudo mkdir -p /srv/faithhaven-ai
sudo chown "$USER":"$USER" /srv/faithhaven-ai
cd /srv/faithhaven-ai
git clone https://github.com/amarktainetwork2-collab/Amarktai-Faith-Haven.git .
cp .env.example .env.production
chmod 600 .env.production
nano .env.production
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build --remove-orphans
docker compose --env-file .env.production ps
curl -fsS http://127.0.0.1/health
```

The API container runs migrations before starting. The stack should not be considered live until the Caddy certificate has been issued, `https://<domain>/health` succeeds, browser registration/login is tested, and the service-worker update path is verified.

## GitHub deployment workflow

Configure repository environment secrets named `WEBDOCK_HOST`, `WEBDOCK_USER`, and `WEBDOCK_SSH_KEY`. The workflow is intentionally manual. Run it only for a commit that has passed CI, provide the target ref, then review the workflow log and the HTTPS health endpoint.

## Rollback

The workflow records the active commit before changing code. If compose validation, container start, or API readiness fails, it checks out that earlier commit and brings the earlier stack back up. For an operator-initiated rollback, check out a verified release SHA and run:

```bash
git checkout --detach <verified-release-sha>
docker compose --env-file .env.production up -d --build --remove-orphans
```

Never roll back a database migration by deleting data. Review the migration’s down/forward procedure and restore a tested backup where a destructive reversal would be required.
