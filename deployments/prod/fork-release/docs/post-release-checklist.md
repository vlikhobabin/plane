# Plane Production Post-Release Checklist

Use this checklist immediately after a production release completes.

## Release Record

- Record the deployed `IMAGE_TAG`.
- Record the GitHub Actions deploy run URL.
- Record the pre-release snapshot directory used for the cutover.
- Record the pre-release backup file used for rollback.
- Record the previous release tag that would be used for an app rollback.

## Deployment State

- Confirm `/opt/plane-prod/.env` contains the expected `IMAGE_TAG`.
- Confirm `docker compose --env-file .env -f docker-compose.prod.yml ps` shows `proxy`, `api`, `worker`, `beat`, `web`, `admin`, `space`, and `live` as running.
- Confirm no legacy overlay app containers are still serving traffic.

## Public Smoke Checks

- `https://plane.meetwise.ru/` returns `200`.
- `https://plane.meetwise.ru/api/instances/` returns `200`.
- `https://plane.meetwise.ru/god-mode/` returns `200`.
- `https://plane.meetwise.ru/spaces/` returns `200`.

## Application Smoke Checks

- Login succeeds for an administrator account.
- Main workspace loads.
- Project and issue pages open.
- Existing attachments open.
- A representative upload flow works.
- A representative email-sending path works if mail functionality changed in the release.

## Safety Verification

- A recent `plane_*.sql.gz` backup exists under `/opt/plane-prod/backups/`.
- A recent snapshot directory exists under `/opt/plane-prod/snapshots/`.
- Container logs show no obvious startup loops or repeated 5xx errors.

## Outcome

- If all checks pass, mark the release as accepted.
- If checks fail but schema is backward-compatible, roll back to the previous image tag.
- If checks fail and data correctness is in doubt, use the pre-release backup and the full rollback path from `runbook.md`.
