/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { EUserPermissions } from "@plane/constants";
import { TimelineLayoutIcon } from "@plane/propel/icons";
import { cn } from "@plane/utils";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { useUserPermissions } from "@/hooks/store/user";
import { IssueWorklogService, getIssueTimeSummaryKey } from "@/services/issue";

type TIssueWorklogProperty = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
};

const issueWorklogService = new IssueWorklogService();

const formatHours = (hours: number) => `${Number(hours.toFixed(2)).toString()}ч`;

export function IssueWorklogProperty(props: TIssueWorklogProperty) {
  const { workspaceSlug, projectId, issueId } = props;
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const currentUserProjectRole = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId);

  const canReadWorklogs =
    currentUserProjectRole !== undefined && currentUserProjectRole >= EUserPermissions.MEMBER;

  const { data } = useSWR(
    canReadWorklogs ? getIssueTimeSummaryKey(workspaceSlug, projectId, issueId) : null,
    () => issueWorklogService.getIssueTimeSummary(workspaceSlug, projectId, issueId),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  if (!canReadWorklogs || !data || !data.actual_hours) return null;

  const plannedHours = data.planned_hours ?? 0;
  const hasPlan = plannedHours > 0;
  const percent = hasPlan ? Math.round((data.actual_hours / plannedHours) * 100) : null;

  return (
    <SidebarPropertyListItem icon={TimelineLayoutIcon} label="Факт">
      <div
        className={cn("px-2 text-body-xs-regular", {
          "text-danger-primary": hasPlan && data.actual_hours > plannedHours,
          "text-warning-primary": hasPlan && data.actual_hours <= plannedHours && (percent ?? 0) > 80,
        })}
      >
        {formatHours(data.actual_hours)}
        {hasPlan && percent !== null ? ` (${percent}% от плана)` : ""}
      </div>
    </SidebarPropertyListItem>
  );
}
