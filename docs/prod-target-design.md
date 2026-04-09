# Production Target Design

## Goal

Move Plane production from the current overlay deployment model to a release-driven model based on immutable images built from `vlikhobabin/plane`.

The production server should stop being a place where custom Plane code is patched at runtime. It should become a thin deployment environment that only contains:

- release configuration
- runtime secrets
- persistent data services
- operational scripts

## Design Principles

1. Source of truth lives in the fork repository, not on the server.
2. Production runs only pinned release images, never `stable` or `latest`.
3. All business customizations ship inside the built images.
4. PostgreSQL, Redis, RabbitMQ, and external S3 remain long-lived infrastructure.
5. The first cutover should replace only the app layer, not the whole network topology.

## Current Problems To Remove

The current Plane production deployment still depends on:

- `makeplane/*:stable` images
- bind-mounted backend patches
- bind-mounted background task overrides
- bind-mounted email template overrides
- a separate `plane-extensions` FastAPI sidecar
- an overlay repository checkout in `/opt/plane`

This model is hard to reason about, hard to reproduce, and hard to roll back safely.

## Target Runtime Model

The desired Plane production model should follow the same operational direction as `meetwise`:

- a minimal deploy directory on the server
- image-tag-based releases from GHCR
- no source checkout required for runtime
- no runtime patch overlay
- external object storage only

Recommended deploy directory:

```text
/opt/plane-prod
  .env
  docker-compose.prod.yml
  caddy/
    Caddyfile
  scripts/
    backup-db.sh
    release-healthcheck.sh
    release-snapshot.sh
    restore-db.sh
  backups/
  docs/
    runbook.md
```

## Images

The fork should publish its own application images.

Recommended image set:

- `ghcr.io/vlikhobabin/plane-backend:<tag>`
- `ghcr.io/vlikhobabin/plane-web:<tag>`
- `ghcr.io/vlikhobabin/plane-admin:<tag>`
- `ghcr.io/vlikhobabin/plane-space:<tag>`
- `ghcr.io/vlikhobabin/plane-live:<tag>`

Proxy options:

- preferred for cutover v1: plain `caddy` image with a versioned `Caddyfile`
- optional later: custom `plane-proxy:<tag>` image if a packaged proxy becomes useful

`backend` should be reused for:

- `api`
- `worker`
- `beat`
- `migrator`

## Services To Keep During Cutover V1

The first production migration should keep the existing data plane intact.

Keep as-is:

- production PostgreSQL
- production Redis
- production RabbitMQ
- production Beget S3 bucket
- host nginx entrypoint
- nginx -> `127.0.0.1:8090` publication pattern

Change only:

- app containers
- release packaging
- deployment process

This minimizes risk by separating "new application build model" from "new ingress architecture".

## Target Compose Shape

The production stack should be driven by a single pinned release tag such as `v1.3.0-mw.1`.

Expected service layout:

- `proxy`
- `api`
- `worker`
- `beat`
- `web`
- `admin`
- `space`
- `live`
- `db`
- `redis`
- `mq`

Expected properties:

- app services use `ghcr.io/vlikhobabin/*` images
- no local Docker build for application services
- no bind mounts into application code paths
- all runtime configuration comes from `.env`
- image versions are controlled by `IMAGE_TAG`

## Environment Model

The production `.env` should contain only runtime configuration.

Typical categories:

- release selector:
  - `IMAGE_TAG`
- public URLs:
  - `WEB_URL`
  - any app-specific public origins
- infrastructure:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `AMQP_URL`
- storage:
  - `USE_MINIO=0`
  - `AWS_S3_ENDPOINT_URL=https://s3.ru1.storage.beget.cloud`
  - `AWS_S3_BUCKET_NAME=3683984e7e3b-plane-prod`
- mail:
  - SMTP host, port, credentials
- app secrets:
  - Django secret key and related encrypted-config values

The file must not include any overlay-era settings that only existed to support the sidecar or bind-mounted patches.

## Ingress Model

For the first release after migration:

- keep host nginx on `plane.meetwise.ru`
- keep host nginx proxying to `127.0.0.1:8090`
- keep an internal proxy layer that routes:
  - `/` -> `web`
  - `/god-mode/` -> `admin`
  - `/spaces/` -> `space`
  - `/live/` -> `live`
  - `/api/` and `/auth/` -> `api`

This avoids mixing app-layer migration with ingress simplification in the same release.

After the stack is stable, ingress can be simplified in a later phase if desired.

## Release Model

Recommended release flow:

1. Create a git tag in `vlikhobabin/plane`.
2. GitHub Actions builds and pushes all application images for that tag.
3. Production deploy updates `IMAGE_TAG` to the release tag.
4. Production performs:
   - pre-release snapshot
   - image pull
   - migrations
   - app restart
   - health checks
5. Release is accepted only after smoke checks pass.

## Backup And Rollback Requirements

Before the first cutover, production must have:

- a dedicated Plane PostgreSQL backup script
- a tested restore procedure
- a release snapshot procedure that stores:
  - current `.env`
  - current compose file
  - current proxy config
  - current image IDs

Rollback must be planned in two modes:

- app-layer rollback if schema remains backward-compatible
- full database restore plus old stack restore if schema is not backward-compatible

## What This Design Intentionally Avoids

The target design explicitly avoids:

- `makeplane/*:stable`
- source-code patching on the production host
- FastAPI sidecars for business logic
- production-only code drift outside the fork
- release behavior that depends on undocumented manual file edits

## Summary

The target production design for Plane is:

- release-driven
- image-tag-based
- fork-owned
- externally stored
- operationally similar to `meetwise`
- still Plane-specific in service topology

In short: use the `meetwise` deployment model, but keep Plane's multi-service runtime layout until after the first stable cutover.
