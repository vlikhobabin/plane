# Local Development

This repository now supports a host-run development workflow for Plane application code while keeping infrastructure services separate.

Current intended layout during migration:

- repository: `/opt/plane`
- application code: runs directly from source on the host
- infrastructure services: PostgreSQL, Redis, and RabbitMQ via Docker, with uploads stored in an external S3-compatible service

## What This Replaces

For local development, this workflow replaces the old pattern of running the Plane application itself from `makeplane/*` containers.

The goal is:

- one readable monorepo checkout
- Python in `.venv`
- `pnpm` at the repo root
- local `.env` files inside the repo
- Docker used only for infrastructure dependencies

## Prerequisites

- Node.js `>=22.18.0`
- `corepack`
- Python `3.8+`
- `python3-venv`
- Docker with Compose

## Files Added For Host-Run Dev

- [Makefile](/opt/plane/Makefile)
- [docker-compose.infra.yml](/opt/plane/docker-compose.infra.yml)
- [.env.host-run.example](/opt/plane/.env.host-run.example)
- [apps/api/.env.host-run.example](/opt/plane/apps/api/.env.host-run.example)

## First-Time Setup

1. Prepare env files and install dependencies:

```bash
make dev-bootstrap
```

This does the following:

- copies host-run env templates into `.env` files if they do not already exist
- creates `.venv`
- installs backend dependencies from `apps/api/requirements/local.txt`
- installs workspace node dependencies via `pnpm`
- generates `SECRET_KEY` in `apps/api/.env` if it is missing

2. Start infrastructure services:

```bash
make infra-up
```

This starts:

- PostgreSQL on `127.0.0.1:5432`
- Redis on `127.0.0.1:6379`
- RabbitMQ on `127.0.0.1:5672`
- RabbitMQ management UI on `127.0.0.1:15672`

3. Run database migrations:

```bash
make dev-migrate
```

4. Register and configure the local instance:

```bash
make dev-instance-bootstrap
```

This mirrors the old local API container bootstrap:

- `wait_for_db`
- `wait_for_migrations`
- `register_instance`
- `configure_instance`
- `create_bucket`
- `clear_cache`

`register_instance`, `configure_instance`, and `create_bucket` are safe to re-run in normal local development when your S3 credentials allow bucket management.

## Running Services

Run each long-lived process in its own terminal.

Backend:

```bash
make dev-api
make dev-worker
make dev-beat
```

Frontend options:

```bash
make dev-frontends
```

Or run individual apps:

```bash
make dev-web
make dev-admin
make dev-space
make dev-live
```

For the individual frontend targets, the `Makefile` first builds the required workspace packages and then starts the selected app directly. This is the recommended path for day-to-day work because it avoids the flaky behavior we saw from running multiple separate `turbo dev` sessions that share `packages/*/dist`.

You can override ports when the host already uses Plane's defaults:

```bash
make dev-api API_PORT=8010
make dev-web WEB_PORT=3005
make dev-admin ADMIN_PORT=3101
make dev-space SPACE_PORT=3002
make dev-live LIVE_PORT=3110
```

Default local URLs:

- API: `http://127.0.0.1:8000`
- Web: `http://127.0.0.1:3000`
- Admin: `http://127.0.0.1:3001`
- Space: `http://127.0.0.1:3002`
- Live: `http://127.0.0.1:3100`

## Notes

- Existing `.env` files are not overwritten by `make dev-env`.
- Frontend `.env.example` files already point to localhost and are reused as-is.
- `make dev-frontends` still runs the full turbo dev graph and expects the default frontend ports to be free. Use the per-app targets above when the host already has services on `3000` or when you only need one frontend.
- Celery must run with `DJANGO_SETTINGS_MODULE=plane.settings.local`; the `Makefile` targets already handle that.
- Plane expects external S3-compatible object storage credentials in `apps/api/.env` for uploads and file assets. The local infra profile does not start MinIO.
- Upstream `setup.sh` and `docker-compose-local.yml` are left intact for traceability. The fork-specific host-run workflow should use the files documented here instead.

## Quick Start Summary

```bash
make dev-bootstrap
make infra-up
make dev-migrate
make dev-instance-bootstrap
```

Then start the processes you need.
