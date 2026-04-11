/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useState } from "react";
import { observer } from "mobx-react";
import { ChartNoAxesColumn, ChevronDown, SlidersHorizontal } from "lucide-react";
// plane imports
import { EIssueFilterType, ISSUE_STORE_TO_FILTERS_MAP } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button, getButtonStyling } from "@plane/propel/button";
import type { IIssueDisplayFilterOptions, IIssueDisplayProperties } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { CustomMenu } from "@plane/ui";
// hooks
import { useWorkItemFilterInstance } from "@/hooks/store/work-item-filters/use-work-item-filter-instance";
import { useIssues } from "@/hooks/store/use-issues";
// plane web imports
import type { TProject } from "@/plane-web/types";
import { ProjectExportService } from "@/services/project/project-export.service";
// local imports
import { WorkItemsModal } from "../analytics/work-items/modal";
import { WorkItemFiltersToggle } from "../work-item-filters/filters-toggle";
import { exportProjectIssueListXlsx } from "./export/project-issue-list-xlsx";
import {
  DisplayFiltersSelection,
  FiltersDropdown,
  LayoutSelection,
  MobileLayoutSelection,
} from "./issue-layouts/filters";

type Props = {
  currentProjectDetails: TProject | undefined;
  projectId: string;
  workspaceSlug: string;
  canUserCreateIssue: boolean | undefined;
  storeType?: EIssuesStoreType.PROJECT | EIssuesStoreType.EPIC;
};
const LAYOUTS = [
  EIssueLayoutTypes.LIST,
  EIssueLayoutTypes.KANBAN,
  EIssueLayoutTypes.CALENDAR,
  EIssueLayoutTypes.SPREADSHEET,
  EIssueLayoutTypes.GANTT,
];
const projectExportService = new ProjectExportService();

export const HeaderFilters = observer(function HeaderFilters(props: Props) {
  const {
    currentProjectDetails,
    projectId,
    workspaceSlug,
    canUserCreateIssue,
    storeType = EIssuesStoreType.PROJECT,
  } = props;
  // i18n
  const { t } = useTranslation();
  // states
  const [analyticsModal, setAnalyticsModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // store hooks
  const { issuesFilter } = useIssues(storeType);
  const { issueFilters, updateFilters } = issuesFilter;
  const filterInstance = useWorkItemFilterInstance(storeType, projectId);
  const scopedIssueFilters = projectId ? issuesFilter.getIssueFilters(projectId) : issueFilters;
  const appliedFilters = projectId ? issuesFilter.appliedFilters : undefined;
  // derived values
  const activeLayout = scopedIssueFilters?.displayFilters?.layout;
  const layoutDisplayFiltersOptions = ISSUE_STORE_TO_FILTERS_MAP[storeType]?.layoutOptions[activeLayout];
  const canExportProjectIssueList = storeType === EIssuesStoreType.PROJECT && Boolean(workspaceSlug && projectId);

  const handleLayoutChange = useCallback(
    (layout: EIssueLayoutTypes) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, { layout: layout });
    },
    [workspaceSlug, projectId, updateFilters]
  );

  const handleDisplayFilters = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, updatedDisplayFilter);
    },
    [workspaceSlug, projectId, updateFilters]
  );

  const handleDisplayProperties = useCallback(
    (property: Partial<IIssueDisplayProperties>) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_PROPERTIES, property);
    },
    [workspaceSlug, projectId, updateFilters]
  );

  const handleExport = useCallback(async () => {
    if (!workspaceSlug || !projectId || !canExportProjectIssueList || isExporting) return;

    setIsExporting(true);
    try {
      await exportProjectIssueListXlsx({
        workspaceSlug,
        projectId,
        projectIdentifier: currentProjectDetails?.identifier,
        displayFilters: scopedIssueFilters?.displayFilters,
        displayProperties: scopedIssueFilters?.displayProperties,
        richFilters: scopedIssueFilters?.richFilters,
        appliedFilters,
        filterInstance,
        projectExportService,
        t,
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    workspaceSlug,
    projectId,
    canExportProjectIssueList,
    isExporting,
    currentProjectDetails?.identifier,
    scopedIssueFilters?.displayFilters,
    scopedIssueFilters?.displayProperties,
    scopedIssueFilters?.richFilters,
    appliedFilters,
    filterInstance,
    t,
  ]);

  return (
    <>
      <WorkItemsModal
        isOpen={analyticsModal}
        onClose={() => setAnalyticsModal(false)}
        projectDetails={currentProjectDetails ?? undefined}
        isEpic={storeType === EIssuesStoreType.EPIC}
      />
      <div className="hidden @4xl:flex">
        <LayoutSelection
          layouts={LAYOUTS}
          onChange={(layout) => handleLayoutChange(layout)}
          selectedLayout={activeLayout}
        />
      </div>
      <div className="flex @4xl:hidden">
        <MobileLayoutSelection
          layouts={LAYOUTS}
          onChange={(layout) => handleLayoutChange(layout)}
          activeLayout={activeLayout}
        />
      </div>
      <WorkItemFiltersToggle entityType={storeType} entityId={projectId} />
      <FiltersDropdown
        miniIcon={<SlidersHorizontal className="size-3.5" />}
        title={t("common.display")}
        placement="bottom-end"
      >
        <DisplayFiltersSelection
          layoutDisplayFiltersOptions={layoutDisplayFiltersOptions}
          displayFilters={scopedIssueFilters?.displayFilters ?? {}}
          handleDisplayFiltersUpdate={handleDisplayFilters}
          displayProperties={scopedIssueFilters?.displayProperties ?? {}}
          handleDisplayPropertiesUpdate={handleDisplayProperties}
          cycleViewDisabled={!currentProjectDetails?.cycle_view}
          moduleViewDisabled={!currentProjectDetails?.module_view}
          isEpic={storeType === EIssuesStoreType.EPIC}
        />
      </FiltersDropdown>
      {canUserCreateIssue ? (
        <Button className="hidden px-2 md:block" onClick={() => setAnalyticsModal(true)} variant="secondary" size="lg">
          <div className="hidden @4xl:flex">{t("common.analytics")}</div>
          <div className="flex @4xl:hidden">
            <ChartNoAxesColumn className="size-3.5" />
          </div>
        </Button>
      ) : (
        <></>
      )}
      {canExportProjectIssueList ? (
        <CustomMenu
          closeOnSelect
          disabled={isExporting}
          placement="bottom-end"
          customButtonClassName={`${getButtonStyling("secondary", "lg")} gap-1.5`}
          customButton={
            <>
              <span>{t("more")}</span>
              <ChevronDown className="size-3" />
            </>
          }
        >
          <CustomMenu.MenuItem onClick={handleExport}>
            {isExporting ? `${t("export_to_xlsx")}...` : t("export_to_xlsx")}
          </CustomMenu.MenuItem>
        </CustomMenu>
      ) : null}
    </>
  );
});
