/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { ISSUE_DISPLAY_FILTERS_BY_PAGE, PROJECT_LEVEL_ISSUE_FILTERS } from "@plane/constants";
import type { IIssueFilters } from "@plane/types";
import {
  canUseProjectWorklogDateFilter,
  omitFilterPropertyFromExpression,
  sanitizeProjectLevelInitialWorkItemFilters,
} from "./project-level.utils";

describe("project-level work item filter helpers", () => {
  it("shows worklog date only in project-level filter configuration", () => {
    expect(PROJECT_LEVEL_ISSUE_FILTERS).toContain("worklog_log_date");
    expect(ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.filters).not.toContain("worklog_log_date");
  });

  it("sanitizes worklog date conditions from rich filter expressions", () => {
    const expression = {
      and: [
        { worklog_log_date__range: "2026-04-01,2026-04-30" },
        { priority__in: "high,urgent" },
      ],
    };

    expect(omitFilterPropertyFromExpression(expression, "worklog_log_date")).toEqual({
      and: [{ priority__in: "high,urgent" }],
    });
  });

  it("removes hidden worklog filters from initial project filters", () => {
    const filters: IIssueFilters = {
      richFilters: {
        and: [
          { worklog_log_date__range: "2026-04-01,2026-04-30" },
          { assignee_id__in: "user-1,user-2" },
        ],
      },
      displayFilters: undefined,
      displayProperties: undefined,
      kanbanFilters: undefined,
    };

    expect(sanitizeProjectLevelInitialWorkItemFilters(filters, false)).toEqual({
      ...filters,
      richFilters: {
        and: [{ assignee_id__in: "user-1,user-2" }],
      },
    });
    expect(sanitizeProjectLevelInitialWorkItemFilters(filters, true)).toBe(filters);
  });

  it("gates worklog date filter usage by project membership and time tracking", () => {
    expect(canUseProjectWorklogDateFilter(true, true)).toBe(true);
    expect(canUseProjectWorklogDateFilter(true, false)).toBe(false);
    expect(canUseProjectWorklogDateFilter(false, true)).toBe(false);
    expect(canUseProjectWorklogDateFilter(true)).toBe(true);
  });
});
