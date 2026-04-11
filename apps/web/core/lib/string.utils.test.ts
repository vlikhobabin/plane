/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { isEmptyHtmlString, sanitizeHTML } from "@plane/utils";

describe("string utils", () => {
  it("strips tags without relying on server-only sanitize-html", () => {
    expect(sanitizeHTML("<p>Hello <strong>world</strong>&nbsp;!</p>")).toBe("Hello world !");
  });

  it("treats empty markup as empty content", () => {
    expect(isEmptyHtmlString("<p></p>")).toBe(true);
  });

  it("preserves allowed self-closing tags when checking emptiness", () => {
    expect(isEmptyHtmlString('<p><img src=\"/logo.png\" /></p>', ["img"])).toBe(false);
  });

  it("preserves allowed custom tags when checking emptiness", () => {
    expect(isEmptyHtmlString("<p><mention-component></mention-component></p>", ["mention-component"])).toBe(false);
  });
});
