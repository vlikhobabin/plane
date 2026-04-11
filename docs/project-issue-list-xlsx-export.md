# Project Issue List XLSX Export

This feature adds a direct XLSX export action to the project work item list toolbar.

## UI

On the project work item list page:

- the primary create action is shown as `+Добавить`
- the toolbar includes an overflow action `Еще`
- the overflow menu contains `Экспорт в xlsx`

The first release is scoped to the project issue list toolbar on desktop layouts.

## User Behavior

When the user selects `Еще -> Экспорт в xlsx`:

- the application exports the current project issue result set for the active layout
- the current project issue filters are applied to the export
- the browser download flow starts immediately
- no additional in-app confirmation or export-history flow is used

The browser may still show its own download prompt depending on user settings.

## Workbook Contract

The workbook structure is:

1. Project metadata rows
2. Layout row
3. Filter summary block
4. Blank separator row
5. Table header row
6. Exported issue rows

The filter summary is built from the current toolbar/list filter state and is rendered before the table header.

## Column Rules

For `list`, `kanban`, and `spreadsheet` layouts:

- `Название` and `ID/key` are always included
- additional columns are taken from the current display properties for that list

For `calendar` and `gantt_chart` layouts:

- `Название`
- `ID/key`
- `Дата начала`
- `Дата завершения`

These two layouts intentionally use a fixed minimal export contract instead of their on-screen display properties.

## Backend Contract

Endpoint:

`POST /api/workspaces/<workspace_slug>/projects/<project_id>/issues/export/xlsx/`

The request payload includes:

- active layout
- current rich filters
- current applied legacy filters
- display filters
- display properties
- normalized export columns
- filter summary lines

The endpoint reuses the project issue filtering pipeline so that the exported rows match the current page semantics.

## Implementation Notes

- Frontend toolbar wiring lives in [filters.tsx](/opt/plane/apps/web/core/components/issues/filters.tsx) and [header.tsx](/opt/plane/apps/web/ce/components/issues/header.tsx).
- Frontend export payload normalization lives in [project-issue-list-xlsx.ts](/opt/plane/apps/web/core/components/issues/export/project-issue-list-xlsx.ts).
- Direct download service call lives in [project-export.service.ts](/opt/plane/apps/web/core/services/project/project-export.service.ts).
- Backend endpoint and workbook generation live in [base.py](/opt/plane/apps/api/plane/app/views/issue/base.py).
- Lean export schema lives in [project_issue_list.py](/opt/plane/apps/api/plane/utils/exporters/schemas/project_issue_list.py).

## Verification

Coverage for this feature includes:

- frontend helper tests for payload normalization and download trigger flow
- backend contract tests for filtered export behavior and workbook structure
- manual verification from `list`, `kanban`, `spreadsheet`, `calendar`, and `gantt_chart`

Multi-value export fields such as assignees, labels, and modules are normalized to comma-separated cell values so that workbook generation remains valid for empty and populated relations.
