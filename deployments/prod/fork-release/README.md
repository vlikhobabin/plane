# Plane Production Release Template

This directory is a template for the future Plane production deployment after the overlay model is retired.

It is intentionally separate from the current live production layout.

What this template is for:

- release-driven production deploys
- GHCR image tags owned by `vlikhobabin/plane`
- external S3 storage
- pre-release safety operations
- first-cutover replacement of application containers only

What this template is not:

- the current live production stack
- a drop-in replacement without environment review

Main files:

- `.env.example`
- `docker-compose.prod.yml`
- `docker-compose.infra.yml`
- `caddy/Caddyfile`
- `scripts/backup-db.sh`
- `scripts/capture-db-baseline.sh`
- `scripts/set-image-tag.sh`
- `scripts/release-healthcheck.sh`
- `scripts/deploy-release.sh`
- `scripts/release-snapshot.sh`
- `scripts/restore-db.sh`
- `docs/runbook.md`

Recommended adoption flow:

1. Review and customize `.env`.
2. Validate `docker-compose.prod.yml` against the real prod environment.
3. Put the scripts on the production server.
4. Complete `Phase 0` from `docs/prod-migration-plan.md`.
5. Point the runtime at the existing external Docker network and infra containers.
6. Keep infra definitions in `docker-compose.infra.yml` so `/opt/plane-prod` is the operational source of truth.
7. Only then use this template for staging or cutover work.
