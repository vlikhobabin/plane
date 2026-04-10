/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { useParams } from "next/navigation";
import { EUserPermissions } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { TimelineLayoutIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
import type { IIssueDisplayProperties, TIssue } from "@plane/types";
import { useUserPermissions } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { IssueWorklogService, getIssueTimeSummaryKey } from "@/services/issue";
import { WithDisplayPropertiesHOC } from "@/components/issues/issue-layouts/properties/with-display-properties-HOC";

export type TWorkItemLayoutAdditionalProperties = {
  displayProperties: IIssueDisplayProperties;
  issue: TIssue;
};

const issueWorklogService = new IssueWorklogService();

const formatHours = (hours: number) => `${Number(hours.toFixed(2)).toString()}h`;

export function WorkItemLayoutAdditionalProperties(props: TWorkItemLayoutAdditionalProperties) {
  const { displayProperties, issue } = props;
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();
  const params = useParams();
  const workspaceSlug = params.workspaceSlug?.toString();
  const projectId = issue.project_id;
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const currentUserProjectRole =
    workspaceSlug && projectId ? getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId) : undefined;
  const canReadWorklogs =
    currentUserProjectRole !== undefined && currentUserProjectRole >= EUserPermissions.MEMBER;
  const needsFallback = displayProperties.fact && canReadWorklogs && projectId && workspaceSlug && issue.actual_hours == null;

  const { data } = useSWR(
    needsFallback ? getIssueTimeSummaryKey(workspaceSlug, projectId, issue.id) : null,
    () => issueWorklogService.getIssueTimeSummary(workspaceSlug!, projectId!, issue.id),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  const actualHours = issue.actual_hours ?? data?.actual_hours;
  return (
    <WithDisplayPropertiesHOC
      displayProperties={displayProperties}
      displayPropertyKey="fact"
      shouldRenderProperty={() => canReadWorklogs && actualHours != null}
    >
      <Tooltip
        tooltipHeading={t("issue.display.properties.fact")}
        tooltipContent={formatHours(actualHours ?? 0)}
        isMobile={isMobile}
        renderByDefault={false}
      >
        <div
          className={cn(
            "flex h-5 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-sm border-[0.5px] border-strong px-2.5 py-1"
          )}
        >
          <TimelineLayoutIcon className="h-3 w-3 flex-shrink-0" />
          <div className="text-caption-sm-regular">{formatHours(actualHours ?? 0)}</div>
        </div>
      </Tooltip>
    </WithDisplayPropertiesHOC>
  );
}
