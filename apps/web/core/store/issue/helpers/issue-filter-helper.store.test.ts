/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { EIssueLayoutTypes } from "@plane/types";
import { handleIssueQueryParamsByLayout } from "@plane/utils";
import { IssueFilterHelperStore } from "./issue-filter-helper.store";

describe("IssueFilterHelperStore.computedFilteredParams", () => {
  it("serializes worklog date rich filters into the filters query param", () => {
    const store = new IssueFilterHelperStore();
    const richFilters = {
      and: [
        { worklog_log_date__range: "2026-04-01,2026-04-30" },
        { priority__in: "high,urgent" },
      ],
    };
    const acceptableParams = handleIssueQueryParamsByLayout(EIssueLayoutTypes.LIST, "issues");

    const params = store.computedFilteredParams(
      richFilters,
      { layout: EIssueLayoutTypes.LIST },
      acceptableParams ?? []
    );

    expect(params.layout).toBe(EIssueLayoutTypes.LIST);
    expect(params.filters).toBe(JSON.stringify(richFilters));
    expect(JSON.parse(params.filters as string)).toEqual(richFilters);
  });
});
