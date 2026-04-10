# Production Migration Plan

## Goal

Migrate Plane production from the current overlay deployment model to the new release-driven model described in [prod-target-design.md](/opt/plane/docs/prod-target-design.md).

This plan assumes:

- production data must be preserved in place
- the first cutover changes only the application layer
- current production PostgreSQL, Redis, RabbitMQ, and Beget S3 remain in use

Detailed execution backlog for the first two phases is tracked in [prod-implementation-backlog.md](/opt/plane/docs/prod-implementation-backlog.md).

## Current Baseline

Current Plane production still runs as an overlay deployment with:

- `makeplane/*:stable`
- bind-mounted backend patches
- bind-mounted task and email template overrides
- `plane-extensions` FastAPI sidecar
- host nginx -> `127.0.0.1:8090` -> internal proxy

What is already favorable:

- production storage already uses external Beget S3
- production data footprint is moderate
- service topology is known
- `meetwise` on the same host already demonstrates a cleaner release-oriented deployment model

## Migration Principles

1. Backup first, deploy second.
2. Replace the app layer before redesigning ingress.
3. Rehearse on staging before touching production.
4. Keep rollback concrete and tested.
5. Delete overlay artifacts only after the new stack is proven stable.

## Phase 0: Safety Net

Purpose:

- create the operational baseline required for a safe release migration

Tasks:

- add a dedicated backup script for Plane PostgreSQL, following the `meetwise` pattern
- test database restore from backup on a separate database instance
- save the current production runtime artifacts:
  - `deploy/prod/.env`
  - `deploy/prod/docker-compose.yml`
  - `deploy/prod/Caddyfile`
  - host nginx vhost
  - list of current running container image IDs
- capture a rollback snapshot of the current overlay deployment
- record current database row counts for key tables such as:
  - `instances`
  - `users`
  - `workspaces`
  - `projects`
  - `file_assets`
  - `ext_worklogs`

Exit criteria:

- backup exists
- restore procedure is documented and tested
- current production state can be reconstructed if needed

## Phase 1: Release Pipeline

Purpose:

- make the fork capable of producing immutable production releases

Tasks:

- add GitHub Actions workflows in `vlikhobabin/plane`
- build and push release images on tag creation
- publish these images:
  - `plane-backend`
  - `plane-web`
  - `plane-admin`
  - `plane-space`
  - `plane-live`
- decide proxy packaging strategy:
  - either use stock `caddy` with a committed Caddyfile
  - or build a small fork-owned proxy image
- stop depending on `makeplane/plane-proxy`
- define and document the release-tag naming scheme:
  - `v<plane-upstream>-mw.<major>.<minor>.<patch>`
  - for example `v1.3.1-mw.1.0.0`
  - for example `v1.3.1-mw.1.3.45`

Exit criteria:

- a production tag produces all required images
- image versions are pinned and reproducible
- no release depends on `makeplane/*:stable`

## Phase 2: Staging Rehearsal

Purpose:

- prove that the new release images fully replace the overlay behavior

Tasks:

- create a staging deployment based on the new image tags
- use a copy of the production database
- use either:
  - a dedicated staging bucket
  - or a carefully controlled copy of the production bucket
- run migrations against the staging database
- smoke-test the major functional areas:
  - login
  - workspace access
  - project access
  - file assets
  - worklogs
  - email delivery
  - guest provisioning
  - admin flow
- verify that all behavior previously provided by:
  - bind-mounted patches
  - task overrides
  - email template overrides
  - `plane-extensions`
    is now covered by the release images themselves

Exit criteria:

- staging works without overlay artifacts
- no production-critical functionality still depends on the old sidecar or bind mounts

## Phase 3: Production Cutover V1

Purpose:

- switch production to the new release stack while preserving the current data plane and ingress topology

Tasks:

- keep the existing:
  - `plane-db`
  - `plane-mq`
  - `plane-redis`
  - Beget production bucket
- stop only the old application containers
- pull the new tagged images
- run database migrations on the existing production database
- bring up the new application stack
- keep the first-release ingress unchanged:
  - host nginx still proxies to `127.0.0.1:8090`
  - internal proxy still routes requests to app services
- run release smoke checks immediately after startup

Required smoke checks:

- main app loads
- admin loads
- space loads
- API health checks pass
- authentication works
- existing attachments open correctly
- worklogs are visible
- email send path is functional

Exit criteria:

- production serves traffic from fork-owned release images
- no production request path depends on overlay patching

## Phase 4: Cleanup After Stable Release

Purpose:

- remove the migration-era scaffolding only after the new runtime is proven stable

Tasks:

- remove `plane-extensions`
- remove bind-mounted patch directories and override files
- archive the old overlay repository on production
- replace `/opt/plane` with a minimal deploy directory if desired
- document the final production operating procedure
- later, evaluate whether internal Caddy is still needed or whether host nginx should route directly to services

Exit criteria:

- no overlay artifacts remain active
- production runtime is understandable from the deploy directory alone

## Rollback Strategy

Rollback must be planned in two modes.

### Mode 1: App Rollback

Use when:

- schema changes remain backward-compatible

Action:

- redeploy the previous image tag
- restore the previous compose and env snapshot if needed

### Mode 2: Full Rollback

Use when:

- schema migration is not backward-compatible
- or data correctness is in doubt

Action:

- stop the new stack
- restore the database from the pre-cutover backup
- restore the old overlay runtime

## Mandatory Pre-Cutover Checklist

- Plane DB backup script exists
- restore procedure is tested
- release images are built from the fork
- staging rehearsal is complete
- production snapshot is stored
- rollback commands are written down
- smoke-check list is prepared
- maintenance window is agreed

## Recommended Order Of Execution

1. Implement Phase 0 before any production image work.
2. Implement Phase 1 and produce the first release candidate images.
3. Complete Phase 2 on staging.
4. Perform Phase 3 as the first production cutover.
5. Delay Phase 4 cleanup until the new stack has been stable long enough to trust it.

## Summary

This migration should not be treated as a full replatforming.

The safe first move is:

- keep the current production data services
- keep the current public ingress shape
- replace only the application delivery model

That gives the production system the cleaner `meetwise`-style release process without taking unnecessary risks with live data.
