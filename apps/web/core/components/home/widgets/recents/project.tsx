/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { useRouter } from "next/navigation";
// plane types
import { Logo } from "@plane/propel/emoji-icon-picker";
import type { TActivityEntityData, TProjectEntityData } from "@plane/types";
import { calculateTimeAgo } from "@plane/utils";
// components
import { ListItem } from "@/components/core/list";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
// helpers

type BlockProps = {
  activity: TActivityEntityData;
  workspaceSlug: string;
};

export const RecentProject = forwardRef<HTMLDivElement, BlockProps>(function RecentProject(props, ref) {
  const { activity, workspaceSlug } = props;
  const itemRef = useRef<HTMLDivElement>(null);
  // router
  const router = useRouter();
  // derived values
  const projectDetails: TProjectEntityData = activity.entity_data as TProjectEntityData;

  useImperativeHandle(ref, () => itemRef.current!);

  if (!projectDetails) return <></>;

  const projectLink = `/${workspaceSlug}/projects/${projectDetails?.id}/issues`;

  return (
    <ListItem
      key={activity.id}
      itemLink={projectLink}
      title={projectDetails?.name}
      prependTitleElement={
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="grid size-8 flex-shrink-0 place-items-center rounded-sm bg-layer-2">
            <Logo logo={projectDetails?.logo_props} size={16} />
          </div>
          <div className="text-13 font-medium whitespace-nowrap text-placeholder">{projectDetails?.identifier}</div>
        </div>
      }
      appendTitleElement={
        <div className="flex-shrink-0 text-11 font-medium text-placeholder">
          {calculateTimeAgo(activity.visited_at)}
        </div>
      }
      quickActionElement={
        <div className="flex gap-4">
          {projectDetails?.project_members?.length > 0 && (
            <div className="h-5">
              <MemberDropdown
                projectId={projectDetails?.id}
                value={projectDetails?.project_members}
                onChange={() => {}}
                disabled
                multiple
                buttonVariant={
                  projectDetails?.project_members?.length > 0 ? "transparent-without-text" : "border-without-text"
                }
                buttonClassName={projectDetails?.project_members?.length > 0 ? "hover:bg-transparent px-0" : ""}
                showTooltip={projectDetails?.project_members?.length === 0}
                placeholder="Assignees"
                optionsClassName="z-10"
                tooltipContent=""
              />
            </div>
          )}
        </div>
      }
      parentRef={itemRef}
      disableLink={false}
      className="my-auto border-none !px-2 py-3"
      itemClassName="my-auto"
      onItemClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(projectLink);
      }}
    />
  );
});
