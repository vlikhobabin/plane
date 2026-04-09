# Production Implementation Backlog

## Purpose

This document breaks down `Phase 0` and `Phase 1` from [prod-migration-plan.md](/opt/plane/docs/prod-migration-plan.md) into concrete implementation tasks.

The focus here is execution planning, not runtime design. Tasks are split into:

- repository work
- production-server work
- validation gates

## Current Constraints To Keep In Mind

The repository already contains GitHub workflows, but they are not yet aligned with the target production model.

Current workflow realities:

- image builds are oriented around Docker Hub and `makeplane/*`
- some workflows still reference `master`
- there is preview/Kubernetes-specific automation that is not relevant to the first production migration
- current Plane production is not yet driven by GHCR release tags from this fork

Because of that, `Phase 1` is primarily a refactor of existing build/release automation rather than a greenfield CI implementation.

## Phase 0 Backlog: Safety Net

### 0.1 Capture Production Baseline

Type:

- production-server work

Tasks:

- create a snapshot directory on prod for migration baselines
- store copies of:
  - current Plane `.env`
  - current compose file
  - current Caddyfile
  - current host nginx vhost
- store the current output of:
  - `docker ps --format`
  - image IDs for all Plane containers
  - docker volume list for Plane
- store row counts for key tables:
  - `instances`
  - `users`
  - `workspaces`
  - `projects`
  - `file_assets`
  - `ext_worklogs`

Deliverable:

- a versioned rollback baseline bundle saved on prod outside the live overlay tree

### 0.2 Add Plane Backup Script

Type:

- production-server work
- documentation work

Tasks:

- create a `backup-db.sh` script for Plane PostgreSQL following the `meetwise` pattern
- choose the final production location for the script and backups
- add retention policy
- log successful backups to a dedicated logfile
- add cron entry

Deliverable:

- automated Plane production backups with daily retention

### 0.3 Create Restore Procedure

Type:

- production-server work
- documentation work

Tasks:

- write a restore script or a documented restore command sequence
- test restore into a separate scratch database or isolated PostgreSQL container
- record restore timing and validation steps

Deliverable:

- documented restore procedure that has been tested at least once

### 0.4 Add Release Snapshot Script

Type:

- production-server work
- repository work

Tasks:

- create a `release-snapshot.sh` script for production
- script should save:
  - env snapshot
  - compose snapshot
  - proxy snapshot
  - running image IDs
  - timestamp metadata
- design output layout so snapshots are easy to diff and restore from

Deliverable:

- repeatable pre-release snapshot command

### 0.5 Write Phase 0 Runbook

Type:

- documentation work

Tasks:

- document where backups live
- document how to trigger backup manually
- document how to restore
- document how to take a pre-release snapshot
- document who verifies the result before release work starts

Deliverable:

- a concise ops runbook that makes `Phase 0` repeatable

### Phase 0 Exit Gate

Required before any production release pipeline work is considered deployable:

- backup job runs successfully
- restore has been tested
- rollback baseline bundle exists
- release snapshot procedure exists

## Phase 1 Backlog: Release Pipeline

### 1.1 Decide Release Artifact Strategy

Type:

- repository work

Tasks:

- confirm final image list:
  - backend
  - web
  - admin
  - space
  - live
- decide proxy strategy for cutover v1:
  - stock `caddy` plus committed config
  - or custom fork-owned proxy image
- define release tag naming convention
- define whether tags alone trigger release builds or whether there is also a manual promotion step

Deliverable:

- one written release artifact contract for CI and prod deploy

### 1.2 Audit Existing Dockerfiles

Type:

- repository work

Tasks:

- confirm which Dockerfiles are currently production-usable:
  - `apps/api/Dockerfile.api`
  - `apps/web/Dockerfile.web`
  - `apps/admin/Dockerfile.admin`
  - `apps/space/Dockerfile.space`
  - `apps/live/Dockerfile.live`
- verify they build correctly under the fork's current state
- note any places where images still assume upstream-only behavior

Deliverable:

- a gap list for image build readiness

### 1.3 Refactor Build Workflows Away From Docker Hub

Type:

- repository work

Tasks:

- inspect and refactor the existing workflows, especially:
  - [build-branch.yml](/opt/plane/.github/workflows/build-branch.yml)
  - [feature-deployment.yml](/opt/plane/.github/workflows/feature-deployment.yml)
- remove Docker Hub and `makeplane/*` assumptions from the production path
- switch production image publishing to GHCR
- remove production coupling to `makeplane/actions/build-push`
- ensure tags are published under `ghcr.io/vlikhobabin/*`

Deliverable:

- a fork-owned production publishing workflow using GHCR

### 1.4 Introduce Release Workflow

Type:

- repository work

Tasks:

- add a release workflow triggered by git tags
- build and push all release images for the tag
- publish consistent tags across all services
- optionally publish immutable digests as workflow outputs or release metadata

Deliverable:

- one release tag produces one coherent application release set

Initial implementation status:

- first fork-owned GHCR tag workflow added in [release-ghcr.yml](/opt/plane/.github/workflows/release-ghcr.yml)
- current scope covers:
  - backend
  - web
  - admin
  - space
  - live
- proxy remains intentionally outside the first release workflow because cutover v1 uses stock `caddy`

### 1.5 Clean Up Legacy Workflow Assumptions

Type:

- repository work

Tasks:

- remove or isolate workflows that still assume `master`
- update version-check logic to current branch policy
- isolate preview/Kubernetes workflows so they do not define the production path
- document which workflow is authoritative for production releases

Deliverable:

- CI naming and branch assumptions aligned with the fork's current `main`-based workflow

Initial implementation status:

- [check-version.yml](/opt/plane/.github/workflows/check-version.yml) now targets `main`
- [codeql.yml](/opt/plane/.github/workflows/codeql.yml) now targets `main`

### 1.6 Create Production Deploy Compose

Type:

- repository work
- production-server work

Tasks:

- create a new production compose file aligned with the target design
- ensure it references only:
  - GHCR release images
  - current data services
  - current ingress assumptions for cutover v1
- ensure there are no code bind mounts
- ensure there is no `plane-extensions`
- decide final on-server path:
  - `/opt/plane-prod`
  - or another explicit deploy directory

Deliverable:

- first clean production compose file for the new release stack

### 1.7 Define Production Env Contract

Type:

- repository work
- documentation work

Tasks:

- define the required production env variables
- remove overlay-era variables from the new deploy contract
- add an example or template prod env file without secrets
- document expected values for:
  - URLs
  - DB
  - Redis
  - RabbitMQ
  - S3
  - SMTP
  - image tag

Deliverable:

- documented env contract for the new production stack

### 1.8 Create Deployment Runbook

Type:

- documentation work

Tasks:

- document release steps:
  - pre-release snapshot
  - image pull
  - migration
  - app restart
  - smoke checks
- document rollback for:
  - backward-compatible schema
  - non-backward-compatible schema
- document required maintenance window behavior

Deliverable:

- production release runbook ready before staging rehearsal

### 1.9 Decide Promotion Mechanism

Type:

- repository work
- operations decision

Tasks:

- choose between:
  - fully automated prod deployment on tag
  - manual promotion after image build
- if manual:
  - define exact command or script that updates `IMAGE_TAG`
  - define who performs it
- if automated:
  - define SSH or deployment secret handling
  - define health-check gate and rollback expectations

Deliverable:

- one explicit promotion model, not a mix of implied manual steps

Initial implementation status:

- manual promotion path added in the deploy template:
  - [set-image-tag.sh](/opt/plane/deployments/prod/fork-release/scripts/set-image-tag.sh)
  - [release-healthcheck.sh](/opt/plane/deployments/prod/fork-release/scripts/release-healthcheck.sh)
  - [deploy-release.sh](/opt/plane/deployments/prod/fork-release/scripts/deploy-release.sh)
- manual GitHub Actions production deploy workflow added:
  - [deploy-prod-release.yml](/opt/plane/.github/workflows/deploy-prod-release.yml)
- this path is intentionally `workflow_dispatch` only
- it does not run automatically on tag push

### Phase 1 Exit Gate

Required before staging rehearsal:

- release workflow builds all required images
- release images land in GHCR
- new production compose exists
- env contract exists
- deployment runbook exists
- production release path no longer depends on `makeplane/*`

## Suggested Execution Order

Recommended order for implementation:

1. `0.1` capture production baseline
2. `0.2` add backup script
3. `0.3` test restore
4. `0.4` add release snapshot script
5. `0.5` write Phase 0 runbook
6. `1.1` decide artifact and tagging strategy
7. `1.2` audit Dockerfiles
8. `1.3` refactor build workflows to GHCR
9. `1.4` add release workflow
10. `1.5` clean legacy CI assumptions
11. `1.6` create new production compose
12. `1.7` define env contract
13. `1.8` write deployment runbook
14. `1.9` finalize promotion mechanism

## Immediate Next Slice

The highest-value next slice is:

- implement `Phase 0`
- then start `1.1`, `1.2`, and `1.3`

That sequence reduces production risk before any release engineering work gets close to a real cutover.

Initial repository templates for `Phase 0` live under [deployments/prod/fork-release](/opt/plane/deployments/prod/fork-release):

- [backup-db.sh](/opt/plane/deployments/prod/fork-release/scripts/backup-db.sh)
- [capture-db-baseline.sh](/opt/plane/deployments/prod/fork-release/scripts/capture-db-baseline.sh)
- [release-snapshot.sh](/opt/plane/deployments/prod/fork-release/scripts/release-snapshot.sh)
- [restore-db.sh](/opt/plane/deployments/prod/fork-release/scripts/restore-db.sh)
- [runbook.md](/opt/plane/deployments/prod/fork-release/docs/runbook.md)
