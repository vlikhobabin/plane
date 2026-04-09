/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { InstanceService } from "@plane/services";
import type {
  IInstanceGuestUserOptions,
  IInstanceGuestUserPayload,
  IInstanceGuestUserProjectOption,
  IInstanceGuestUserResult,
} from "@plane/types";
import { Input, Loader } from "@plane/ui";
import { cn } from "@plane/utils";

const instanceService = new InstanceService();

export function GuestUserProvisioningForm() {
  const { data, isLoading } = useSWR<IInstanceGuestUserOptions>("INSTANCE_GUEST_USER_OPTIONS", () =>
    instanceService.guestUserOptions()
  );

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<IInstanceGuestUserResult | undefined>(undefined);

  const workspaces = data?.workspaces ?? [];
  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId) ?? workspaces[0],
    [workspaceId, workspaces]
  );

  useEffect(() => {
    if (!selectedWorkspace && workspaces.length === 0) return;

    if (!workspaceId || !workspaces.some((workspace) => workspace.id === workspaceId)) {
      setWorkspaceId(workspaces[0]?.id ?? "");
    }
  }, [workspaceId, workspaces, selectedWorkspace]);

  useEffect(() => {
    if (!selectedWorkspace) {
      setProjectIds([]);
      return;
    }

    setProjectIds(selectedWorkspace.projects.map((project) => project.id));
  }, [selectedWorkspace?.id]);

  const isSubmitDisabled =
    isSubmitting || !email.trim() || !firstName.trim() || !selectedWorkspace || projectIds.length === 0;

  const handleProjectToggle = (projectId: string) => {
    setProjectIds((current) =>
      current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId]
    );
  };

  const handleProjectSelection = (projects: IInstanceGuestUserProjectOption[]) => {
    setProjectIds(projects.map((project) => project.id));
  };

  const handleSubmit = async () => {
    if (!selectedWorkspace) return;

    const payload: IInstanceGuestUserPayload = {
      email: email.trim(),
      first_name: firstName.trim(),
      workspace_id: selectedWorkspace.id,
      project_ids: projectIds,
    };

    setIsSubmitting(true);
    setResult(undefined);

    try {
      const response = await instanceService.createGuestUser(payload);
      setResult(response);
      setEmail("");
      setFirstName("");
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Guest user created",
        message: response.smtp_error
          ? "SMTP is unavailable, so credentials are shown below."
          : "Credentials were sent by email.",
      });
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Failed to create guest user",
        message: error?.error ?? "Please verify the form data and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Loader className="space-y-4">
        <Loader.Item height="44px" width="100%" />
        <Loader.Item height="44px" width="100%" />
        <Loader.Item height="180px" width="100%" />
      </Loader>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="rounded-md border border-subtle bg-surface-secondary p-5 text-body-sm-regular text-secondary">
        This admin account is not a workspace admin anywhere yet. Add it to at least one workspace with Admin access,
        then return here to provision guest users.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="guest-email" className="text-13 font-medium text-tertiary">
            Email
          </label>
          <Input
            id="guest-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="guest@example.com"
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="guest-first-name" className="text-13 font-medium text-tertiary">
            First name
          </label>
          <Input
            id="guest-first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Иван"
            className="w-full"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="guest-workspace" className="text-13 font-medium text-tertiary">
          Workspace
        </label>
        <select
          id="guest-workspace"
          value={selectedWorkspace?.id ?? ""}
          onChange={(e) => setWorkspaceId(e.target.value)}
          className="h-10 w-full rounded-md border border-strong bg-surface-1 px-3 text-13 text-primary outline-none"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name} ({workspace.slug})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-13 font-medium text-primary">Projects</div>
            <div className="text-11 text-tertiary">The guest user will be created only in the selected projects.</div>
          </div>
          {selectedWorkspace && (
            <div className="flex items-center gap-2 text-11">
              <button
                type="button"
                className="font-medium text-accent-primary hover:underline"
                onClick={() => handleProjectSelection(selectedWorkspace.projects)}
              >
                Select all
              </button>
              <button
                type="button"
                className="font-medium text-tertiary hover:underline"
                onClick={() => setProjectIds([])}
              >
                Clear
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {selectedWorkspace?.projects.map((project) => {
            const checked = projectIds.includes(project.id);

            return (
              <label
                key={project.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                  checked ? "border-accent-primary bg-accent-primary/5" : "border-subtle bg-surface-secondary"
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  onChange={() => handleProjectToggle(project.id)}
                />
                <div className="min-w-0">
                  <div className="text-13 font-medium text-primary">{project.name}</div>
                  <div className="text-11 text-tertiary">{project.identifier}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" size="lg" onClick={handleSubmit} disabled={isSubmitDisabled} loading={isSubmitting}>
          Create guest user
        </Button>
        <span className="text-11 text-tertiary">A strong password will be generated automatically.</span>
      </div>

      {result?.smtp_error && (
        <div className="space-y-2 rounded-md border border-warning-primary/40 bg-warning-primary/5 p-4">
          <div className="text-13 font-medium text-primary">SMTP fallback</div>
          <div className="text-12 text-secondary">
            Welcome email was not sent: {result.smtp_error}. Use these credentials manually.
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md bg-surface-secondary p-3">
              <div className="text-11 text-tertiary">Email</div>
              <div className="text-13 font-medium text-primary">{result.email}</div>
            </div>
            <div className="rounded-md bg-surface-secondary p-3">
              <div className="text-11 text-tertiary">Password</div>
              <div className="text-13 font-medium text-primary">{result.password}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
