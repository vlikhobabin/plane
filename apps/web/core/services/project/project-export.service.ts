/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  TIssueLayouts,
  TIssueParams,
  TWorkItemFilterExpression,
} from "@plane/types";
import { APIService } from "@/services/api.service";
// helpers

type TProjectIssueListXlsxExportColumn = {
  key: string;
  label: string;
};

export class ProjectExportService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async csvExport(
    workspaceSlug: string,
    data: {
      provider: string;
      project: string[];
      multiple?: boolean;
      rich_filters?: TWorkItemFilterExpression;
    }
  ): Promise<any> {
    return this.post(`/api/workspaces/${workspaceSlug}/export-issues/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async downloadProjectIssueListXlsx(
    workspaceSlug: string,
    projectId: string,
    data: {
      layout: TIssueLayouts;
      rich_filters?: TWorkItemFilterExpression;
      applied_filters?: Partial<Record<TIssueParams, string | boolean>>;
      display_filters?: IIssueDisplayFilterOptions;
      display_properties?: IIssueDisplayProperties;
      columns: TProjectIssueListXlsxExportColumn[];
      filter_summary: string[];
    }
  ) {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/export/xlsx/`, data, {
      responseType: "blob",
    });
  }
}
