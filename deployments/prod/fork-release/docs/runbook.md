# Plane Production Runbook

## Purpose

This runbook is the operational companion for the release-driven Plane production deployment template in `deployments/prod/fork-release/`.

It is intentionally focused on `Phase 0` safety work and the first release cutover prerequisites.

## Directory Assumptions

This template assumes a future production deploy directory shaped roughly like:

```text
/opt/plane-prod
  .env
  docker-compose.prod.yml
  caddy/Caddyfile
  scripts/
  backups/
  snapshots/
```

## Phase 0 Checklist

Before any release cutover work begins:

- `.env` is created from `.env.example`
- `docker-compose.prod.yml` is reviewed against the live production host
- `backup-db.sh` has run successfully at least once
- `restore-db.sh` has been tested against a scratch database
- `release-snapshot.sh` has been tested
- `capture-db-baseline.sh` produces expected row counts

## Manual Backup

Run:

```bash
./scripts/backup-db.sh
```

Expected result:

- a new `plane_*.sql.gz` file appears under `BACKUP_DIR`
- the file is non-empty
- old backups beyond retention are rotated

## Manual Baseline Capture

Run:

```bash
./scripts/capture-db-baseline.sh
```

Expected result:

- row counts for the key business tables print to stdout

To save into a file:

```bash
./scripts/capture-db-baseline.sh ./snapshots/manual-db-baseline.tsv
```

## Pre-Release Snapshot

Run:

```bash
./scripts/release-snapshot.sh
```

Expected result:

- a timestamped directory is created under `SNAPSHOT_DIR`
- it contains:
  - env snapshot
  - compose snapshot
  - Caddy snapshot
  - nginx vhost copy if configured
  - container inspect outputs
  - docker inventory
  - database baseline row counts

## Restore Drill

Example scratch restore:

```bash
./scripts/restore-db.sh ./backups/plane_YYYYMMDDTHHMMSSZ.sql.gz plane_restore_test
```

Live restore is intentionally blocked by default.

To restore into the live database, an explicit destructive override is required:

```bash
ALLOW_DESTRUCTIVE_RESTORE=1 ./scripts/restore-db.sh ./backups/plane_YYYYMMDDTHHMMSSZ.sql.gz
```

Use that only during a planned rollback.

## Pre-Cutover Release Sequence

For the first production release cutover, the intended sequence is:

1. Confirm backups are healthy.
2. Take a pre-release snapshot.
3. Record the current release image IDs.
4. Update `IMAGE_TAG`.
5. Pull the new tagged images.
6. Run database migrations.
7. Start the new application stack.
8. Run smoke checks.
9. If the release fails, execute the appropriate rollback path.

Template helper:

```bash
./scripts/deploy-release.sh v1.3.0-mw.1
```

## Smoke Checks

Minimum smoke checks after startup:

- main UI loads
- admin loads
- space loads
- API responds
- authentication works
- existing attachments open
- worklogs render
- mail sending path is functional

## Rollback Modes

### App Rollback

Use when schema remains backward-compatible.

Action:

- restore the previous image tag
- restart the previous stack

Template helper:

```bash
./scripts/set-image-tag.sh <previous-tag>
docker compose --env-file .env -f docker-compose.prod.yml pull api worker beat web admin space live
docker compose --env-file .env -f docker-compose.prod.yml up -d proxy api worker beat web admin space live
```

### Full Rollback

Use when schema is not backward-compatible or data correctness is in doubt.

Action:

1. stop the failed release
2. restore the database from the pre-cutover backup
3. restore the old runtime stack

## Notes

- These files are templates, not proof that production is already migrated.
- Any final production script paths can still be adjusted when the real deploy directory is created.
- The first cutover should preserve the current ingress shape and data plane.
- The manual GitHub deploy workflow expects:
  - `PLANE_PROD_DEPLOY_SSH_KEY`
  - `PLANE_PROD_DEPLOY_HOST`
  - `PLANE_PROD_DEPLOY_USER`
