# Fork Migration Plan

## Goal

Replace the current `/opt/plane` overlay repository with a standalone Plane fork that becomes the only local source of truth for development.

Target end state:

- `/opt/plane` contains the full forked monorepo from `git@github.com:vlikhobabin/plane.git`
- local development runs from source on the host, not from stock `makeplane/*` application containers
- PostgreSQL, Redis, and RabbitMQ remain separate infrastructure services
- there is no FastAPI sidecar, no nginx `sub_filter`, and no bind-mounted code patches
- the project is allowed to diverge from upstream Plane without trying to stay rebase-friendly long-term

## Decisions Already Taken

- Base upstream snapshot: `makeplane/plane@v1.3.0`
- Clean import branch: `fork/v1.3.0-base`
- Long-term source of truth: `origin = vlikhobabin/plane`
- Upstream sync is optional and not part of the steady-state workflow
- Local Docker overlay architecture is transitional and will be retired

## Current State

### Old overlay repository

Current live local repository:

- `/opt/plane`

Current architecture:

- stock Plane runs from Docker images `makeplane/*`
- custom backend behavior is mounted through `patches/plane/**`
- custom frontend behavior is injected through nginx `sub_filter`
- custom business logic lives in `extensions/fastapi`

### Fork repository

Current fork workspace:

- `/opt/plane`

Implemented already:

- backend overlay patches ported into native Django code
- Russian email templates and background tasks moved into `apps/api`
- worklog backend ported from FastAPI into Django
- compatibility `/ext/api/...` routes hosted inside Django
- guest provisioning and welcome-email flow ported into Django
- native instance-admin guest-user API and `apps/admin` guest-user page added
- native auth-page customization replaces `auth-patch.js`
- native worklog block and "Факт" property row replace `worklog-helper.js`
- host-run local-dev scaffolding added:
  - `docker-compose.infra.yml`
  - `Makefile`
  - host-run `.env` templates
  - `docs/local-dev.md`

Not ported yet:

- retirement of the old overlay repository and its application containers

## Principles

1. Preserve behavior before redesigning UX.
2. Eliminate architecture layers, not just move them around.
3. Prefer native Plane backend and frontend extension points over sidecars and DOM mutation.
4. Use temporary compatibility routes only when they reduce migration risk.
5. Do not delete the old overlay until the fork can replace it for daily development.

## Scope Breakdown

### Backend parity work

Already done:

- `patches/plane/**` -> `apps/api/plane/**`
- `templates/emails/**` -> `apps/api/templates/emails/**`
- `bgtasks/**` -> `apps/api/plane/bgtasks/**`
- worklog data model and Django endpoints

Still pending:

- full removal of temporary `/ext/admin` compatibility flow after native admin rollout is accepted

### Frontend parity work

Still pending:

- removal of `patches/plane-web/nginx.conf` injection dependency

Likely target areas already present in the fork:

- auth UI: `apps/web/core/components/account/**`
- admin sign-in: `apps/admin/app/(all)/(home)/**`
- issue details: `apps/web/ce/components/issues/issue-details/**`
- worklog placeholder already exists: `apps/web/ce/components/issues/worklog/property/root.tsx`

### Local development workflow

Implemented in the fork:

- Python venv bootstrap via `Makefile`
- local `.env` strategy inside the monorepo
- infrastructure-only Docker Compose file
- host-run commands for Django, Celery, and frontend apps
- per-app frontend prebuild workflow and port overrides for occupied local ports
- local workflow documentation in `docs/local-dev.md`

Still pending:

- retirement of old local Plane application containers

Validated already:

- backend host-run bootstrap, migrations, instance bootstrap, and Celery worker/beat
- API smoke checks on an alternate local port because `:8000` is occupied on this host
- `web` and `admin` frontend dev servers through the documented `make` targets on alternate local ports because `:3000` is occupied on this host
- `live` server startup was previously confirmed against local Redis during the host-run smoke pass

## Phase Plan

## Phase 0: Freeze Architecture Direction

Purpose:

- stop treating the project as an overlay over stock images
- define the standalone fork as the only future dev path

Actions:

- keep `fork/v1.3.0-base` as historical import branch
- keep current migration branches for traceability
- create a future long-term branch policy:
  - `main` becomes the primary development branch after cutover
  - feature branches are created from `main`
  - release tags are created from `main`
- after cutover, `upstream` remote can be kept only as a reference or removed entirely

Exit criteria:

- roadmap committed in the fork
- all upcoming migration work references the fork, not the overlay
- status: completed

## Phase 1: Finish Backend Functional Parity

Purpose:

- remove the remaining business dependency on `extensions/fastapi`

Workstreams:

### 1. Guest provisioning

Source:

- `/opt/plane/extensions/fastapi/core/provisioning.py`

Target:

- native service/module inside `apps/api/plane/**`

Required behavior:

- create managed guest user with password
- create profile with onboarding-complete defaults
- attach workspace membership
- attach selected project memberships
- keep current role semantics compatible with the existing business process

Implementation notes:

- use Django ORM or transaction-safe service layer, not raw startup SQL
- preserve current generated username/token behavior only where still needed
- re-check field names against `v1.3.0` models instead of copying raw SQL blindly

### 2. Welcome email and SMTP config

Source:

- `/opt/plane/extensions/fastapi/core/email.py`
- `/opt/plane/extensions/fastapi/templates/welcome_credentials.html`

Target:

- `apps/api/plane/**` for the service
- `apps/api/templates/**` for the template

Required behavior:

- read instance SMTP settings from Plane configuration
- decrypt encrypted values through the same secret-key derivation path
- send Russian welcome email with login URL and generated password

Implementation notes:

- align with existing Django mail stack where practical
- keep fallback behavior explicit if SMTP is misconfigured

### 3. Admin create-user flow

Source:

- `/opt/plane/extensions/fastapi/routers/admin.py`
- `/opt/plane/extensions/fastapi/templates/admin.html`
- `/opt/plane/extensions/fastapi/templates/layout.html`

Target, release 1:

- native Django-authenticated admin endpoints and temporary server-rendered page

Target, later:

- React admin UI inside `apps/admin`

Required behavior:

- admin-only access
- list workspaces and available projects
- create guest user from form or JSON API
- show success/error state
- send welcome email or expose generated password fallback

Recommended sequence:

1. Port the backend and the current HTML/admin flow for speed.
2. Move the UX into `apps/admin` only after parity is stable.

Exit criteria for Phase 1:

- no production-critical business logic remains only in `extensions/fastapi`
- guest/user provisioning works entirely from Django
- the welcome email template is served from the fork
- admin user-creation flow works without the FastAPI sidecar
- status: completed, with temporary `/ext/admin` compatibility still present until final cleanup

## Phase 2: Replace Frontend Injections With Native UI

Purpose:

- remove runtime DOM patching and nginx HTML injection

Workstreams:

### 1. Auth page customization

Source:

- `/opt/plane/extensions/fastapi/static/auth-patch.js`

Current behavior to preserve:

- remove marketing-style auth headings
- replace button labels where required
- hide terms block
- simplify auth landing appearance

Likely target files:

- `apps/web/core/components/account/auth-forms/auth-header.tsx`
- `apps/web/core/components/account/terms-and-conditions.tsx`
- related auth layout and banner components under `apps/web/core/components/account/**`

Design note:

- implement this as explicit product copy and layout decisions, not post-render text rewriting

### 2. Worklog UI and "Факт" property

Source:

- `/opt/plane/extensions/fastapi/static/worklog-helper.js`

Current behavior to preserve:

- show a worklog block above the comment area in issue details
- create, edit, and delete worklog entries
- show total actual time
- show "Факт" row near estimate
- continue using current business rules for edit/delete

Likely target files:

- `apps/web/ce/components/issues/worklog/property/root.tsx`
- `apps/web/ce/components/issues/issue-details/**`
- comment/activity layout around issue details
- issue property rendering path where estimate is already shown

Required backend alignment:

- replace `/ext/api/...` consumers with native or intentionally-supported fork API routes
- keep `/ext/api/...` only as a temporary compatibility layer during migration

Design note:

- build this as a proper component with store/service integration
- do not use `MutationObserver`, history monkey-patching, or DOM scanning in the fork

Exit criteria for Phase 2:

- no dependency on `auth-patch.js`
- no dependency on `worklog-helper.js`
- no dependency on nginx `sub_filter`
- issue detail worklog UI works in native frontend code
- status: functionally completed in the fork, with final overlay/nginx cleanup deferred to repository cutover

## Phase 3: Establish Host-Run Local Development

Purpose:

- make the fork the normal local development environment

Target developer workflow:

- one repo: `/opt/plane`
- Python backend in a local venv
- frontend and package tooling through `pnpm`
- infra services separate from app code

Actions:

### 1. Python environment

- create `/opt/plane/.venv`
- document Python version expected by the backend
- install API dependencies from `apps/api/requirements/**`

### 2. Node environment

- use the repo root `package.json`
- install dependencies once with `pnpm install`
- run frontend apps from the monorepo directly

### 3. Local env files

- keep local `.env` files in the fork, derived from safe examples
- do not copy secrets into git
- define one documented local env strategy for:
  - backend
  - web/admin/space/live
  - infrastructure URLs

### 4. Simple entrypoints

Add one lightweight developer entry layer:

- `Makefile`, or
- `Procfile.dev`, or
- both if they remain small and obvious

Recommended minimum commands:

- `make dev-api`
- `make dev-worker`
- `make dev-beat`
- `make dev-web`
- `make dev-admin`
- `make dev-space`
- `make dev-live`
- `make dev-migrate`
- `make dev-bootstrap`

Recommended backend commands:

- `python apps/api/manage.py runserver --settings=plane.settings.local`
- `celery -A plane worker -l info`
- `celery -A plane beat -l info`

Recommended frontend commands:

- `pnpm dev`
- or focused app commands where needed

Exit criteria for Phase 3:

- a new developer can run the fork locally without touching stock Plane application containers
- daily backend and frontend work happens from source
- documented bootstrap is shorter and clearer than the old overlay workflow
- status: functionally validated in the fork, pending final cutover and retirement of the old overlay workspace

## Phase 4: Separate Infrastructure From Plane Code

Purpose:

- keep the application repo clean while preserving practical local setup

Local infrastructure strategy:

- PostgreSQL: existing local service is acceptable
- Redis: host service
- RabbitMQ: host service
- MinIO: optional local S3-compatible storage for upload and asset parity

Allowed local Docker usage:

- infrastructure-only containers, if desired

Disallowed target-state usage:

- Docker containers as the primary source of Plane application code

Recommended documentation:

- list required ports and health checks
- state whether each service is host-native or infra-only Docker
- make it explicit that app code no longer comes from containers

Exit criteria for Phase 4:

- local development depends only on infra services, not on stock Plane app containers

## Phase 5: Controlled Local Cutover

Purpose:

- replace the old overlay workspace without losing recovery options

Preconditions:

- Phases 1 through 4 meet their exit criteria
- the fork passes a basic smoke test against the existing dev database
- all critical local flows used by the team are validated in the fork

Cutover sequence:

1. Stop using `/opt/plane` as the active development workspace.
2. Remove the old overlay repository from the active working path after the fork is verified.
3. Move the fork workspace into `/opt/plane`.
4. Reconfigure the local git remote so `/opt/plane` tracks only `git@github.com:vlikhobabin/plane.git`.
5. Set the primary branch to `main` or the chosen long-term default branch.
6. Recreate local venv and env files in the final path if absolute paths changed.
7. Verify all developer entrypoints from `/opt/plane`.

Validation checklist:

- backend starts from source
- Celery worker and beat start from source
- `pnpm dev` serves the expected apps
- sign-in works
- issue detail opens
- worklog UI works
- guest provisioning flow works
- no request goes to the old FastAPI sidecar

Exit criteria for Phase 5:

- `/opt/plane` is the only active Plane code workspace on the server
- the old fork staging path no longer exists as a separate active repo
- old overlay is removed from the active local development path

## Phase 6: Retire Overlay Architecture

Purpose:

- eliminate local ambiguity and prevent accidental fallback to the old model

Actions:

- remove old Plane application Docker compose workflow from daily use
- remove obsolete docs that tell developers to patch stock images
- remove `extensions/fastapi` and related deployment glue from the active repository lineage
- remove nginx injection configuration that existed only for the overlay

Exit criteria:

- no local development path depends on overlay-only files
- the remaining system architecture is understandable from the fork alone

## Testing Gates

Every migration phase should pass these minimum checks before the next one:

- backend code compiles and migrations load
- changed endpoints have at least smoke coverage
- changed UI paths are manually verified
- developer bootstrap instructions still work from a clean shell session

Minimum manual smoke matrix before cutover:

- admin sign-in
- guest creation with workspace/project assignment
- welcome email happy path or explicit fallback path
- issue detail rendering
- worklog create/edit/delete
- issue estimate plus "Факт" display
- comment area still works

## Branching Recommendation From This Point

Near-term branch sequence:

1. `migration/guest-provisioning-port`
2. `migration/admin-auth-native-port`
3. `migration/worklog-frontend-native-port`
4. `migration/local-dev-host-run`
5. `migration/local-cutover`

After cutover:

- create `main` from the fully integrated migration line
- make `main` the default branch in `vlikhobabin/plane`
- keep migration branches only as historical references

## Immediate Next Step

Local cutover is complete.

Next operational slice:

- create `main` from the integrated migration line if it is not already the primary branch
- remove or ignore the remaining overlay-only deployment lineage
- keep production deployment work separate from local host-run development
