/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const isCanceledIssueLayoutRequest = (error: unknown): boolean => {
  if (error == null) return true;
  if (typeof error !== "object") return false;

  const code = "code" in error ? error.code : undefined;
  const name = "name" in error ? error.name : undefined;

  return code === "ERR_CANCELED" || name === "CanceledError" || name === "AbortError";
};

export const logIssueLayoutFetchError = (layout: string, error: unknown) => {
  if (isCanceledIssueLayoutRequest(error)) return;

  console.error(`Failed to fetch issues for ${layout} layout`, error);
};
