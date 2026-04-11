/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { EIssueLayoutTypes } from "@plane/types";
import {
  exportProjectIssueListXlsx,
  normalizeProjectIssueListExportColumns,
  PROJECT_ISSUE_LIST_XLSX_MIME_TYPE,
} from "./project-issue-list-xlsx";

const t = (key: string) => key;

describe("project issue list xlsx export helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps name and key always-on for standard layouts", () => {
    const columns = normalizeProjectIssueListExportColumns(
      EIssueLayoutTypes.LIST,
      {
        priority: true,
        state: true,
        key: false,
      },
      t
    );

    expect(columns.map((column) => column.key)).toEqual(["name", "key", "state", "priority"]);
  });

  it("forces the minimal export column set for calendar and gantt layouts", () => {
    const calendarColumns = normalizeProjectIssueListExportColumns(
      EIssueLayoutTypes.CALENDAR,
      {
        priority: true,
        issue_type: true,
      },
      t
    );
    const ganttColumns = normalizeProjectIssueListExportColumns(EIssueLayoutTypes.GANTT, undefined, t);

    expect(calendarColumns.map((column) => column.key)).toEqual(["name", "key", "start_date", "due_date"]);
    expect(ganttColumns.map((column) => column.key)).toEqual(["name", "key", "start_date", "due_date"]);
  });

  it("builds the payload, respects server filename, and triggers immediate download", async () => {
    const downloadFile = vi.fn();
    const projectExportService = {
      downloadProjectIssueListXlsx: vi.fn().mockResolvedValue({
        data: new Blob(["xlsx-data"], { type: PROJECT_ISSUE_LIST_XLSX_MIME_TYPE }),
        headers: {
          "content-disposition": 'attachment; filename="plane-export.xlsx"',
        },
      }),
    };

    const result = await exportProjectIssueListXlsx({
      workspaceSlug: "plane-custom",
      projectId: "project-id",
      projectIdentifier: "PLANE",
      displayFilters: {
        layout: EIssueLayoutTypes.LIST,
        group_by: "state",
        order_by: "sort_order",
        sub_issue: true,
      },
      displayProperties: {
        priority: true,
        state: true,
      },
      richFilters: {
        and: [{ priority__in: "high,urgent" }],
      },
      appliedFilters: {
        layout: EIssueLayoutTypes.LIST,
      },
      filterInstance: {
        allConditionsForDisplay: [
          {
            id: "condition-1",
            type: "condition",
            property: "priority",
            operator: "is",
            value: ["high", "urgent"],
          },
        ],
        configManager: {
          getConfigByProperty: () => ({
            label: "common.priority",
            getLabelForOperator: () => "is",
            getOperatorConfig: () => ({
              getOptions: [
                { id: "high", label: "High", value: "high" },
                { id: "urgent", label: "Urgent", value: "urgent" },
              ],
            }),
          }),
        },
      } as never,
      projectExportService: projectExportService as never,
      downloadFile,
      t,
    });

    expect(projectExportService.downloadProjectIssueListXlsx).toHaveBeenCalledWith(
      "plane-custom",
      "project-id",
      expect.objectContaining({
        layout: EIssueLayoutTypes.LIST,
        columns: expect.arrayContaining([
          expect.objectContaining({ key: "name" }),
          expect.objectContaining({ key: "key" }),
        ]),
        filter_summary: expect.arrayContaining([
          "Layout: issue.layouts.list",
          "common.group_by: common.states",
          "common.order_by.label: common.order_by.manual",
          "issue.display.extra.show_sub_issues: yes",
          "common.priority: is High, Urgent",
        ]),
      })
    );
    expect(downloadFile).toHaveBeenCalledWith(expect.any(Blob), "plane-export.xlsx");
    expect(result.filename).toBe("plane-export.xlsx");
  });
});
