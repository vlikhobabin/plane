# Fork Migration Plan

## Goal

Move the current `/opt/plane` overlay customizations into the Plane fork at `/opt/plane-fork` without keeping the external FastAPI sidecar and nginx HTML injection strategy as long-term architecture.

Base upstream for all migration work:

- Upstream repo: `makeplane/plane`
- Base tag: `v1.3.0`
- Base commit: `cf696d200d`
- Clean base branch: `fork/v1.3.0-base`

Working migration branch for planning:

- `migration/overlay-port-plan`

## Current Customization Inventory

### Backend overlay patches

These already map almost 1:1 into the fork:

- `/opt/plane/patches/plane/app/views/asset/v2.py`
  -> `apps/api/plane/app/views/asset/v2.py`
- `/opt/plane/patches/plane/app/views/issue/attachment.py`
  -> `apps/api/plane/app/views/issue/attachment.py`
- `/opt/plane/patches/plane/db/models/issue.py`
  -> `apps/api/plane/db/models/issue.py`

### Email templates

These move into `apps/api/templates/emails/**`:

- `/opt/plane/templates/emails/auth/forgot_password.html`
- `/opt/plane/templates/emails/auth/magic_signin.html`
- `/opt/plane/templates/emails/invitations/project_invitation.html`
- `/opt/plane/templates/emails/invitations/workspace_invitation.html`
- `/opt/plane/templates/emails/notifications/project_addition.html`
- `/opt/plane/templates/emails/notifications/webhook-deactivate.html`
- `/opt/plane/templates/emails/user/email_updated.html`
- `/opt/plane/templates/emails/user/user_activation.html`
- `/opt/plane/templates/emails/user/user_deactivation.html`

### Background tasks

These map into `apps/api/plane/bgtasks/**`:

- `/opt/plane/bgtasks/forgot_password_task.py`
- `/opt/plane/bgtasks/magic_link_code_task.py`
- `/opt/plane/bgtasks/project_add_user_email_task.py`
- `/opt/plane/bgtasks/project_invitation_task.py`
- `/opt/plane/bgtasks/user_activation_email_task.py`
- `/opt/plane/bgtasks/user_deactivation_email_task.py`
- `/opt/plane/bgtasks/user_email_update_task.py`
- `/opt/plane/bgtasks/webhook_task.py`
- `/opt/plane/bgtasks/workspace_invitation_task.py`

### FastAPI sidecar

This should not be ported as-is.

Current source:

- `/opt/plane/extensions/fastapi/main.py`
- `/opt/plane/extensions/fastapi/core/*.py`
- `/opt/plane/extensions/fastapi/routers/admin.py`
- `/opt/plane/extensions/fastapi/routers/worklog.py`
- `/opt/plane/extensions/fastapi/templates/*.html`

Target strategy:

- move backend business logic into Django app code under `apps/api/plane/**`
- move data model and APIs into native Plane API surface
- remove the separate `/ext` service from the long-term architecture

### Frontend injections

These should also not be ported as-is:

- `/opt/plane/extensions/fastapi/static/worklog-helper.js`
- `/opt/plane/extensions/fastapi/static/auth-patch.js`
- `/opt/plane/patches/plane-web/nginx.conf`

Target strategy:

- implement native frontend changes inside `apps/web/**`, `apps/space/**`, and shared packages
- remove `sub_filter` HTML injection from runtime architecture

## Migration Principles

1. Keep `fork/v1.3.0-base` clean and rebase-friendly.
2. Do all custom work on top of feature branches from that base.
3. Prefer native Plane modules over sidecars, monkey-patches, and nginx injection.
4. Preserve current behavior first, then improve architecture.
5. Migrate backend before frontend when possible.

## Recommended Migration Order

### Phase 1: Establish API/backend parity inside the fork

Scope:

- port `patches/plane/**` into native files
- port email templates into `apps/api/templates/emails/**`
- port `bgtasks/**` into `apps/api/plane/bgtasks/**`

Why first:

- these changes are the least ambiguous
- they replace volume mounts with first-class repo changes
- they reduce operational coupling immediately

Acceptance criteria:

- no runtime dependency on mounted `patches/plane/**`
- no runtime dependency on mounted `templates/emails/**`
- no runtime dependency on mounted `bgtasks/**`

### Phase 2: Port worklog backend from FastAPI into Django

Scope:

- `ext_worklogs` table creation
- worklog CRUD
- issue time summary
- project time report
- resolve readable issue identifier if still needed

Recommended target shape:

- new Django app or clearly isolated module under `apps/api/plane/app` or `apps/api/plane/api`
- native auth and permissions using Plane session/backend conventions
- migrations instead of startup-time `CREATE TABLE IF NOT EXISTS`

Important design correction:

- replace ad-hoc table bootstrap in FastAPI startup with proper Django migration(s)

Acceptance criteria:

- `/ext/api/...` endpoints are either replaced with native API routes or temporary compatibility routes hosted in Django
- no dependency on `extensions/fastapi`

### Phase 3: Port guest provisioning/admin flow into Django

Scope:

- guest user creation logic from `core/provisioning.py`
- SMTP/config logic from `core/email.py`
- admin page and JSON creation endpoint from `routers/admin.py`

Recommended target shape:

- native authenticated admin endpoint(s) in Plane backend
- templates under `apps/api/templates/**` only if SSR page is still the right UX
- otherwise convert the flow into a native admin/settings UI in frontend apps

Open design choice:

- keep server-rendered admin form temporarily, or move directly to React UI

Recommendation:

- keep SSR/admin endpoint first for speed
- move to native frontend later only if product value justifies it

### Phase 4: Port frontend customizations into native Plane UI

Scope:

- login page patches from `auth-patch.js`
- worklog block from `worklog-helper.js`
- "Факт" row in issue properties

Recommended target shape:

- locate issue detail implementation in `apps/web/**` and `apps/space/**`
- add proper components, stores, and service calls instead of DOM mutation
- use shared UI packages where appropriate

Important design correction:

- do not carry over DOM polling, MutationObserver-driven injection, or history monkey-patching unless used only as a short-lived bridge

Acceptance criteria:

- no dependency on nginx `sub_filter`
- no dependency on injected browser scripts

## Temporary Compatibility Option

If fast delivery is more important than architectural purity, use a bridge stage:

1. Move current FastAPI functionality into Django first.
2. Keep route compatibility for `/ext/api/...` for one release cycle.
3. Switch frontend to native consumers.
4. Delete compatibility routes after migration.

This is the safest path for worklog features.

## First Concrete Workstreams

Create these branches from `fork/v1.3.0-base`:

1. `migration/backend-overlay-port`
2. `migration/worklog-django-port`
3. `migration/guest-provisioning-port`
4. `migration/frontend-native-port`

Recommended execution order:

1. `migration/backend-overlay-port`
2. `migration/worklog-django-port`
3. `migration/guest-provisioning-port`
4. `migration/frontend-native-port`

## What Should Not Be Preserved

- separate FastAPI deployment as the primary customization layer
- nginx HTML injection via `sub_filter`
- startup-time schema creation for business tables
- browser-only workarounds that exist only because the UI was outside the upstream repo

## Operational End State

Target deployment after migration:

- one Plane fork repo as the source of truth
- custom backend and frontend code committed directly in the fork
- minimal or zero runtime bind-mount patching
- compose/deployment files building from the fork instead of patching stock images

## Immediate Next Implementation Step

Start with `migration/backend-overlay-port` and port these files first:

- `apps/api/plane/app/views/asset/v2.py`
- `apps/api/plane/app/views/issue/attachment.py`
- `apps/api/plane/db/models/issue.py`
- `apps/api/templates/emails/**`
- `apps/api/plane/bgtasks/**`

This gives the fastest reduction in overlay complexity with the lowest design risk.
