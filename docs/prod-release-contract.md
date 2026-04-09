# Production Release Contract

## Purpose

This document defines the release artifact contract for the new Plane production delivery model.

It answers four concrete questions:

1. What images are produced for a production release?
2. How are they tagged?
3. Where are they published?
4. What configuration is expected at build and deploy time?

## Registry

Production release images are published to GHCR.

Registry:

- `ghcr.io`

Owner:

- expected production owner: `vlikhobabin`

## Release Unit

The production release unit is a git tag in the fork repository.

Recommended format:

- `v1.3.0-mw.1`
- `v1.3.0-mw.2`

The exact release tag is the deployment selector used by production as `IMAGE_TAG`.

## Production Images

Each production tag must publish a complete set of images.

Required image set:

- `ghcr.io/vlikhobabin/plane-backend:<tag>`
- `ghcr.io/vlikhobabin/plane-web:<tag>`
- `ghcr.io/vlikhobabin/plane-admin:<tag>`
- `ghcr.io/vlikhobabin/plane-space:<tag>`
- `ghcr.io/vlikhobabin/plane-live:<tag>`

The first production migration does not require a custom proxy image.

Proxy strategy for cutover v1:

- use stock `caddy`
- keep the proxy config versioned in the repository

## Runtime Mapping

Image-to-service mapping:

- `plane-backend`:
  - `api`
  - `worker`
  - `beat`
  - `migrator`
- `plane-web`:
  - `web`
- `plane-admin`:
  - `admin`
- `plane-space`:
  - `space`
- `plane-live`:
  - `live`

## Tagging Rules

Minimum tags published for each image:

- exact release tag, for example `v1.3.0-mw.1`
- immutable commit tag, for example `sha-<shortsha>`

Production deploys must use the exact release tag, not the commit tag.

## Build Context Rules

Expected build inputs:

- backend:
  - Dockerfile: [Dockerfile.api](/opt/plane/apps/api/Dockerfile.api)
  - context: `./apps/api`
- web:
  - Dockerfile: [Dockerfile.web](/opt/plane/apps/web/Dockerfile.web)
  - context: `.`
- admin:
  - Dockerfile: [Dockerfile.admin](/opt/plane/apps/admin/Dockerfile.admin)
  - context: `.`
- space:
  - Dockerfile: [Dockerfile.space](/opt/plane/apps/space/Dockerfile.space)
  - context: `.`
- live:
  - Dockerfile: [Dockerfile.live](/opt/plane/apps/live/Dockerfile.live)
  - context: `.`

## Build-Time Variables

The frontend images should be built with the production routing shape already expected by the deploy stack.

Baseline values:

- `VITE_API_BASE_URL=`
- `VITE_API_BASE_PATH=/api`
- `VITE_ADMIN_BASE_URL=`
- `VITE_ADMIN_BASE_PATH=/god-mode`
- `VITE_SPACE_BASE_URL=`
- `VITE_SPACE_BASE_PATH=/spaces`
- `VITE_LIVE_BASE_URL=`
- `VITE_LIVE_BASE_PATH=/live`
- `VITE_WEB_BASE_URL=`

Optional repository variables for branding and links:

- `PUBLIC_PLANE_WEBSITE_URL`
- `PUBLIC_PLANE_SUPPORT_EMAIL`

Recommended defaults for this fork:

- website URL: `https://plane.meetwise.ru`
- support email: `info@meetwise.ru`

## What Is Explicitly Out Of Scope

This contract does not include:

- Docker Hub publishing
- `makeplane/*` image names
- `latest` or `stable` tags as production inputs
- Kubernetes preview deployment rules
- AIO packaging

Those may continue to exist for upstream compatibility or preview flows, but they are not the production release authority for this fork.

## Production Deploy Input

The production deploy stack consumes only:

- `IMAGE_TAG`
- runtime `.env`
- versioned compose and proxy config

It must not require:

- source checkout of the application
- bind-mounted code overrides
- sidecar business logic

## GitHub Secrets For Manual Deploy

The manual production deploy workflow [deploy-prod-release.yml](/opt/plane/.github/workflows/deploy-prod-release.yml) expects these repository secrets:

- `PLANE_PROD_DEPLOY_SSH_KEY`
- `PLANE_PROD_DEPLOY_HOST`
- `PLANE_PROD_DEPLOY_USER`

Expected values:

- `PLANE_PROD_DEPLOY_HOST`:
  - production server hostname or IP
- `PLANE_PROD_DEPLOY_USER`:
  - SSH user used for deploys
- `PLANE_PROD_DEPLOY_SSH_KEY`:
  - private key for the dedicated production deploy identity

The deploy workflow is intentionally manual (`workflow_dispatch`) for cutover v1.

## Summary

The production release contract is:

- tag-driven
- GHCR-published
- fork-owned
- multi-image
- exact-tag deployed

In operational terms: one git tag creates one coherent Plane release set, and production deploys exactly that set.
