/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IWorkItemFilterInstance } from "@plane/shared-state";
import { ISSUE_GROUP_BY_OPTIONS, ISSUE_ORDER_BY_OPTIONS } from "@plane/constants";
import type {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  SingleOrArray,
  TAllAvailableOperatorsForDisplay,
  TFilterValue,
  TIssueLayouts,
  TIssueParams,
  TWorkItemFilterProperty,
  TWorkItemFilterExpression,
} from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
import type { ProjectExportService } from "@/services/project/project-export.service";

export const PROJECT_ISSUE_LIST_XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const ALWAYS_ON_EXPORT_COLUMNS = ["name", "key"] as const;
const CALENDAR_AND_GANTT_EXPORT_COLUMNS = ["name", "key", "start_date", "due_date"] as const;
const ORDERED_EXPORT_COLUMNS = [
  "name",
  "key",
  "state",
  "priority",
  "assignee",
  "labels",
  "start_date",
  "due_date",
  "estimate",
  "fact",
  "modules",
  "cycle",
  "issue_type",
  "created_on",
  "updated_on",
  "link",
  "attachment_count",
  "sub_issue_count",
] as const;

const EXPORT_COLUMN_LABEL_KEYS = {
  name: "name",
  key: "issue.display.properties.id",
  state: "common.state",
  priority: "common.priority",
  assignee: "common.assignee",
  labels: "common.labels",
  start_date: "common.order_by.start_date",
  due_date: "common.order_by.due_date",
  estimate: "common.estimate",
  fact: "issue.display.properties.fact",
  modules: "common.module",
  cycle: "common.cycle",
  issue_type: "issue.display.properties.issue_type",
  created_on: "issue.display.properties.created_on",
  updated_on: "common.order_by.updated_on",
  link: "common.link",
  attachment_count: "issue.display.properties.attachment_count",
  sub_issue_count: "issue.display.properties.sub_issue_count",
} as const;

const LAYOUT_LABEL_KEYS = {
  [EIssueLayoutTypes.LIST]: "issue.layouts.list",
  [EIssueLayoutTypes.KANBAN]: "issue.layouts.kanban",
  [EIssueLayoutTypes.CALENDAR]: "issue.layouts.calendar",
  [EIssueLayoutTypes.SPREADSHEET]: "issue.layouts.spreadsheet",
  [EIssueLayoutTypes.GANTT]: "issue.layouts.gantt",
} as const;

type TProjectIssueListXlsxExportColumnKey = (typeof ORDERED_EXPORT_COLUMNS)[number];
type TTranslate = (key: string, params?: Record<string, string | number>) => string;
type TIssueFilterLikeValue = SingleOrArray<TFilterValue>;

export type TProjectIssueListXlsxExportColumn = {
  key: TProjectIssueListXlsxExportColumnKey;
  label: string;
};

export type TProjectIssueListXlsxExportPayload = {
  layout: TIssueLayouts;
  rich_filters?: TWorkItemFilterExpression;
  applied_filters?: Partial<Record<TIssueParams, string | boolean>>;
  display_filters?: IIssueDisplayFilterOptions;
  display_properties?: IIssueDisplayProperties;
  columns: TProjectIssueListXlsxExportColumn[];
  filter_summary: string[];
};

type TExportProjectIssueListXlsxParams = {
  workspaceSlug: string;
  projectId: string;
  projectIdentifier?: string | null;
  displayFilters?: IIssueDisplayFilterOptions;
  displayProperties?: IIssueDisplayProperties;
  richFilters?: TWorkItemFilterExpression;
  appliedFilters?: Partial<Record<TIssueParams, string | boolean>>;
  filterInstance?: IWorkItemFilterInstance;
  projectExportService: Pick<ProjectExportService, "downloadProjectIssueListXlsx">;
  t: TTranslate;
  downloadFile?: (blob: Blob, filename: string) => void;
};

const getFallbackFilename = (projectIdentifier?: string | null): string => {
  const timestamp = new Date().toISOString().slice(0, 10);
  const prefix = (projectIdentifier || "project")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${prefix || "project"}-work-items-${timestamp}.xlsx`;
};

const formatConditionValue = (value: TIssueFilterLikeValue): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map((item) => formatConditionValue(item)).join(", ");
  if (typeof value === "string" && value.includes(",")) {
    const parts = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0]) && /^\d{4}-\d{2}-\d{2}$/.test(parts[1])) {
      return `${parts[0]} - ${parts[1]}`;
    }
  }
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const resolveFilenameFromContentDisposition = (contentDisposition?: string | null): string | undefined => {
  if (!contentDisposition) return undefined;

  const encodedFilenameMatch = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (encodedFilenameMatch?.[1]) {
    return decodeURIComponent(encodedFilenameMatch[1]);
  }

  const filenameMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"/i);
  if (filenameMatch?.[1]) {
    return filenameMatch[1];
  }

  return undefined;
};

const defaultDownloadFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};

const uniqueColumns = (keys: TProjectIssueListXlsxExportColumnKey[]): TProjectIssueListXlsxExportColumnKey[] =>
  Array.from(new Set(keys));

const resolveConditionOptions = async (
  filterInstance: IWorkItemFilterInstance | undefined,
  property: TWorkItemFilterProperty,
  operator: TAllAvailableOperatorsForDisplay
) => {
  const operatorConfig = filterInstance?.configManager.getConfigByProperty(property)?.getOperatorConfig(operator);
  if (!operatorConfig || !("getOptions" in operatorConfig)) return [];

  const { getOptions } = operatorConfig;
  return typeof getOptions === "function" ? await getOptions() : getOptions;
};

const buildConditionLine = async (
  filterInstance: IWorkItemFilterInstance | undefined,
  property: TWorkItemFilterProperty,
  operator: TAllAvailableOperatorsForDisplay,
  value: TIssueFilterLikeValue,
  t: TTranslate
) => {
  const config = filterInstance?.configManager.getConfigByProperty(property);
  const propertyLabel = config?.label ? t(config.label) : property;
  const operatorLabel = config?.getLabelForOperator(operator) ?? operator;
  const options = await resolveConditionOptions(filterInstance, property, operator);
  const optionMap = new Map(options.map((option) => [String(option.value), option.label]));
  const normalizedValues = Array.isArray(value) ? value : [value];
  const valueLabel = normalizedValues
    .map((item) => {
      const optionLabel = optionMap.get(String(item));
      return optionLabel ?? formatConditionValue(item);
    })
    .join(", ");

  return `${propertyLabel}: ${operatorLabel} ${valueLabel || "-"}`;
};

export const normalizeProjectIssueListExportColumns = (
  layout: TIssueLayouts | undefined,
  displayProperties: IIssueDisplayProperties | undefined,
  t: TTranslate
): TProjectIssueListXlsxExportColumn[] => {
  if (layout === EIssueLayoutTypes.CALENDAR || layout === EIssueLayoutTypes.GANTT) {
    return CALENDAR_AND_GANTT_EXPORT_COLUMNS.map((key) => ({
      key,
      label: t(EXPORT_COLUMN_LABEL_KEYS[key]),
    }));
  }

  const selectedKeys = ORDERED_EXPORT_COLUMNS.filter((key) => {
    if (ALWAYS_ON_EXPORT_COLUMNS.includes(key as (typeof ALWAYS_ON_EXPORT_COLUMNS)[number])) return true;
    return displayProperties?.[key as keyof IIssueDisplayProperties] === true;
  });

  return uniqueColumns(selectedKeys).map((key) => ({
    key,
    label: t(EXPORT_COLUMN_LABEL_KEYS[key]),
  }));
};

export const buildProjectIssueExportFilterSummary = async ({
  layout,
  displayFilters,
  filterInstance,
  t,
}: {
  layout: TIssueLayouts | undefined;
  displayFilters?: IIssueDisplayFilterOptions;
  filterInstance?: IWorkItemFilterInstance;
  t: TTranslate;
}): Promise<string[]> => {
  const summary: string[] = [];

  if (layout) {
    summary.push(`Layout: ${t(LAYOUT_LABEL_KEYS[layout])}`);
  }

  if (displayFilters?.group_by) {
    const groupByOption = ISSUE_GROUP_BY_OPTIONS.find((option) => option.key === displayFilters.group_by);
    summary.push(
      `${t("common.group_by")}: ${groupByOption ? t(groupByOption.titleTranslationKey) : displayFilters.group_by}`
    );
  }

  if (displayFilters?.sub_group_by) {
    const subGroupByOption = ISSUE_GROUP_BY_OPTIONS.find((option) => option.key === displayFilters.sub_group_by);
    summary.push(
      `Sub-group by: ${subGroupByOption ? t(subGroupByOption.titleTranslationKey) : displayFilters.sub_group_by}`
    );
  }

  if (displayFilters?.order_by) {
    const orderByOption = ISSUE_ORDER_BY_OPTIONS.find((option) => option.key === displayFilters.order_by);
    summary.push(
      `${t("common.order_by.label")}: ${orderByOption ? t(orderByOption.titleTranslationKey) : displayFilters.order_by}`
    );
  }

  if (typeof displayFilters?.sub_issue === "boolean") {
    summary.push(`${t("issue.display.extra.show_sub_issues")}: ${displayFilters.sub_issue ? t("yes") : t("no")}`);
  }

  const conditionLines = await Promise.all(
    (filterInstance?.allConditionsForDisplay ?? []).map((condition) =>
      buildConditionLine(filterInstance, condition.property, condition.operator, condition.value, t)
    )
  );

  const lines = [...summary, ...conditionLines.filter(Boolean)];
  return lines.length > 0 ? lines : [t("common.none")];
};

export const exportProjectIssueListXlsx = async ({
  workspaceSlug,
  projectId,
  projectIdentifier,
  displayFilters,
  displayProperties,
  richFilters,
  appliedFilters,
  filterInstance,
  projectExportService,
  t,
  downloadFile = defaultDownloadFile,
}: TExportProjectIssueListXlsxParams) => {
  const layout = displayFilters?.layout ?? EIssueLayoutTypes.LIST;
  const columns = normalizeProjectIssueListExportColumns(layout, displayProperties, t);
  const filterSummary = await buildProjectIssueExportFilterSummary({
    layout,
    displayFilters,
    filterInstance,
    t,
  });

  const response = await projectExportService.downloadProjectIssueListXlsx(workspaceSlug, projectId, {
    layout,
    rich_filters: richFilters,
    applied_filters: appliedFilters,
    display_filters: displayFilters,
    display_properties: displayProperties,
    columns,
    filter_summary: filterSummary,
  });

  const filename =
    resolveFilenameFromContentDisposition(response.headers?.["content-disposition"]) ??
    getFallbackFilename(projectIdentifier);
  const blob =
    response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: PROJECT_ISSUE_LIST_XLSX_MIME_TYPE });

  downloadFile(blob, filename);

  return {
    columns,
    filterSummary,
    filename,
  };
};
