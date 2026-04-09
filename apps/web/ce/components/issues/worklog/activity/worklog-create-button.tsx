/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Clock3, Plus } from "lucide-react";
import { Button } from "@plane/propel/button";

type TIssueActivityWorklogCreateButton = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  onClick: () => void;
};

export function IssueActivityWorklogCreateButton(props: TIssueActivityWorklogCreateButton) {
  const { disabled, onClick } = props;

  return (
    <Button variant="secondary" size="md" onClick={onClick} disabled={disabled}>
      <Clock3 className="h-3.5 w-3.5" />
      <Plus className="-ml-1 h-3 w-3" />
      Учёт времени
    </Button>
  );
}
