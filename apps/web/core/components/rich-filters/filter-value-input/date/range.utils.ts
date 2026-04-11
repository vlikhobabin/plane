/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { getDate, isValidDate, toFilterArray } from "@plane/utils";

type TStoredDateRangeValue = string | string[] | null | undefined;

const normalizeStoredDateRangeValue = (value: TStoredDateRangeValue) =>
  typeof value === "string" ? value.split(",").map((part) => part.trim()) : value;

export const parseStoredDateRangeValue = (value: TStoredDateRangeValue) => {
  const [fromRaw, toRaw] = toFilterArray(normalizeStoredDateRangeValue(value));

  return {
    from: isValidDate(fromRaw) ? getDate(fromRaw) : undefined,
    to: isValidDate(toRaw) ? getDate(toRaw) : undefined,
  };
};
