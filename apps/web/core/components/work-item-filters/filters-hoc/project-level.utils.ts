/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isEqual } from "lodash-es";
import type { IIssueFilters, TWorkItemFilterConditionData, TWorkItemFilterExpression } from "@plane/types";

export const WORKLOG_LOG_DATE_FILTER_PROPERTY = "worklog_log_date";

const omitFilterPropertyFromConditionData = (
  conditionData: TWorkItemFilterConditionData,
  property: string
): TWorkItemFilterConditionData => {
  const filteredEntries = Object.entries(conditionData).filter(([key]) => !key.startsWith(`${property}__`));

  return filteredEntries.length > 0 ? Object.fromEntries(filteredEntries) : {};
};

export const omitFilterPropertyFromExpression = (
  expression: TWorkItemFilterExpression,
  property: string
): TWorkItemFilterExpression => {
  if (!expression || isEqual(expression, {})) return {};

  if ("and" in expression && Array.isArray(expression.and)) {
    const children = expression.and
      .map((condition) => omitFilterPropertyFromConditionData(condition, property))
      .filter((child) => !isEqual(child, {}));

    return children.length > 0 ? { and: children } : {};
  }

  return omitFilterPropertyFromConditionData(expression as TWorkItemFilterConditionData, property);
};

export const canUseProjectWorklogDateFilter = (
  hasProjectMemberLevelPermissions: boolean,
  isTimeTrackingEnabled?: boolean
): boolean =>
  isTimeTrackingEnabled === undefined
    ? hasProjectMemberLevelPermissions
    : hasProjectMemberLevelPermissions && isTimeTrackingEnabled === true;

export const sanitizeProjectLevelInitialWorkItemFilters = (
  initialWorkItemFilters: IIssueFilters | undefined,
  canUseWorklogDateFilter: boolean
): IIssueFilters | undefined => {
  if (!initialWorkItemFilters || canUseWorklogDateFilter) return initialWorkItemFilters;

  return {
    ...initialWorkItemFilters,
    richFilters: omitFilterPropertyFromExpression(
      initialWorkItemFilters.richFilters,
      WORKLOG_LOG_DATE_FILTER_PROPERTY
    ),
  };
};
