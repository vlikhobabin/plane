/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { renderFormattedPayloadDate } from "@plane/utils";
import { parseStoredDateRangeValue } from "./range.utils";

describe("parseStoredDateRangeValue", () => {
  it("preserves calendar dates for serialized rich-filter ranges", () => {
    const { from, to } = parseStoredDateRangeValue("2026-04-01,2026-04-30");

    expect(renderFormattedPayloadDate(from)).toBe("2026-04-01");
    expect(renderFormattedPayloadDate(to)).toBe("2026-04-30");
  });

  it("supports array values without shifting their day boundaries", () => {
    const { from, to } = parseStoredDateRangeValue(["2026-04-01", "2026-04-30"]);

    expect(renderFormattedPayloadDate(from)).toBe("2026-04-01");
    expect(renderFormattedPayloadDate(to)).toBe("2026-04-30");
  });
});
