/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type TIssueWorklogEntry = {
  id: string;
  user_id: string;
  user_name: string;
  hours: number;
  description: string;
  log_date: string;
  created_at: string;
  updated_at?: string;
};

export type TIssueWorklogPayload = {
  hours: number;
  log_date: string;
  description?: string;
};

export type TIssueTimeSummaryUser = {
  user_id: string;
  user_name: string;
  hours: number;
};

export type TIssueTimeSummary = {
  issue_id: string;
  planned_hours: number | null;
  actual_hours: number;
  by_user: TIssueTimeSummaryUser[];
};

export const getIssueWorklogsKey = (workspaceSlug: string, projectId: string, issueId: string) =>
  `ISSUE_WORKLOGS_${workspaceSlug}_${projectId}_${issueId}`;

export const getIssueTimeSummaryKey = (workspaceSlug: string, projectId: string, issueId: string) =>
  `ISSUE_TIME_SUMMARY_${workspaceSlug}_${projectId}_${issueId}`;

export class IssueWorklogService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getIssueWorklogs(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueWorklogEntry[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklogs/`)
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createIssueWorklog(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: TIssueWorklogPayload
  ): Promise<TIssueWorklogEntry> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklogs/`, data)
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateIssueWorklog(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    worklogId: string,
    data: Partial<TIssueWorklogPayload>
  ): Promise<TIssueWorklogEntry> {
    return this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklogs/${worklogId}/`,
      data
    )
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteIssueWorklog(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    worklogId: string
  ): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklogs/${worklogId}/`)
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getIssueTimeSummary(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueTimeSummary> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/time-summary/`)
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
