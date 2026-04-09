/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { PageWrapper } from "@/components/common/page-wrapper";
import type { Route } from "./+types/page";
import { GuestUserProvisioningForm } from "./form";

const GuestUsersPage = function GuestUsersPage(_props: Route.ComponentProps) {
  return (
    <PageWrapper
      header={{
        title: "Provision guest users",
        description:
          "Create users with guest access in a specific workspace and only the projects you select below.",
      }}
    >
      <GuestUserProvisioningForm />
    </PageWrapper>
  );
};

export const meta: Route.MetaFunction = () => [{ title: "Guest Users - God Mode" }];

export default GuestUsersPage;
