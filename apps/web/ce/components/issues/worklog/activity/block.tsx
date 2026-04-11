/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Clock3, Pencil, Plus, Trash2, X } from "lucide-react";
import { EUserPermissions } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input, Spinner } from "@plane/ui";
import { renderFormattedPayloadDate } from "@plane/utils";
import { useUserPermissions } from "@/hooks/store/user";
import { useUser } from "@/hooks/store/user";
import {
  IssueWorklogService,
  getIssueTimeSummaryKey,
  getIssueWorklogsKey,
  type TIssueWorklogEntry,
  type TIssueWorklogPayload,
} from "@/services/issue";

type TIssueActivityWorklogBlock = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  openComposerSignal?: number;
};

type TWorklogFormState = {
  hours: string;
  log_date: string;
  description: string;
};

const issueWorklogService = new IssueWorklogService();

const getDefaultFormState = (): TWorklogFormState => ({
  hours: "",
  log_date: renderFormattedPayloadDate(new Date()) ?? "",
  description: "",
});

const formatHours = (hours: number) => `${Number(hours.toFixed(2)).toString()}ч`;

const formatWorklogDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  })
    .format(new Date(`${value}T00:00:00`))
    .replace(".", "");

const buildPayload = (formState: TWorklogFormState): TIssueWorklogPayload | null => {
  const parsedHours = Number.parseFloat(formState.hours);
  if (!Number.isFinite(parsedHours) || parsedHours <= 0 || !formState.log_date) return null;

  return {
    hours: parsedHours,
    log_date: formState.log_date,
    description: formState.description.trim(),
  };
};

export function IssueActivityWorklogBlock(props: TIssueActivityWorklogBlock) {
  const { workspaceSlug, projectId, issueId, disabled, openComposerSignal = 0 } = props;
  const { mutate } = useSWRConfig();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { data: currentUser } = useUser();
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const currentUserProjectRole = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId);

  const canReadWorklogs =
    currentUserProjectRole !== undefined && currentUserProjectRole >= EUserPermissions.MEMBER;
  const canManageWorklogs = canReadWorklogs && !disabled;
  const isAdmin = currentUserProjectRole === EUserPermissions.ADMIN;

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [createFormState, setCreateFormState] = useState<TWorklogFormState>(getDefaultFormState);
  const [editingWorklogId, setEditingWorklogId] = useState<string | null>(null);
  const [editFormState, setEditFormState] = useState<TWorklogFormState>(getDefaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyWorklogId, setBusyWorklogId] = useState<string | null>(null);

  const worklogsKey = getIssueWorklogsKey(workspaceSlug, projectId, issueId);
  const timeSummaryKey = getIssueTimeSummaryKey(workspaceSlug, projectId, issueId);

  const { data, isLoading } = useSWR(
    canReadWorklogs ? worklogsKey : null,
    () => issueWorklogService.getIssueWorklogs(workspaceSlug, projectId, issueId),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  const entries = data ?? [];
  const totalHours = useMemo(() => entries.reduce((sum, entry) => sum + entry.hours, 0), [entries]);

  useEffect(() => {
    if (!openComposerSignal || !canManageWorklogs) return;

    setEditingWorklogId(null);
    setIsComposerOpen(true);
    setCreateFormState(getDefaultFormState());
    requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [openComposerSignal, canManageWorklogs]);

  const refreshWorklogData = async () => {
    await Promise.all([mutate(worklogsKey), mutate(timeSummaryKey)]);
  };

  const startEdit = (entry: TIssueWorklogEntry) => {
    setIsComposerOpen(false);
    setEditingWorklogId(entry.id);
    setEditFormState({
      hours: entry.hours.toString(),
      log_date: entry.log_date,
      description: entry.description ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingWorklogId(null);
    setEditFormState(getDefaultFormState());
  };

  const handleCreate = async () => {
    const payload = buildPayload(createFormState);
    if (!payload) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Некорректные данные",
        message: "Укажите дату и положительное количество часов.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await issueWorklogService.createIssueWorklog(workspaceSlug, projectId, issueId, payload);
      setCreateFormState(getDefaultFormState());
      setIsComposerOpen(false);
      await refreshWorklogData();
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Запись добавлена",
        message: "Учёт времени обновлён.",
      });
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Не удалось добавить запись",
        message: error?.error ?? "Попробуйте ещё раз.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (worklogId: string) => {
    const payload = buildPayload(editFormState);
    if (!payload) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Некорректные данные",
        message: "Укажите дату и положительное количество часов.",
      });
      return;
    }

    setBusyWorklogId(worklogId);
    try {
      await issueWorklogService.updateIssueWorklog(workspaceSlug, projectId, issueId, worklogId, payload);
      cancelEdit();
      await refreshWorklogData();
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Запись обновлена",
        message: "Учёт времени обновлён.",
      });
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Не удалось обновить запись",
        message: error?.error ?? "Попробуйте ещё раз.",
      });
    } finally {
      setBusyWorklogId(null);
    }
  };

  const handleDelete = async (worklogId: string) => {
    setBusyWorklogId(worklogId);
    try {
      await issueWorklogService.deleteIssueWorklog(workspaceSlug, projectId, issueId, worklogId);
      if (editingWorklogId === worklogId) cancelEdit();
      await refreshWorklogData();
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Запись удалена",
        message: "Учёт времени обновлён.",
      });
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Не удалось удалить запись",
        message: error?.error ?? "Попробуйте ещё раз.",
      });
    } finally {
      setBusyWorklogId(null);
    }
  };

  if (!canReadWorklogs) return null;

  return (
    <div ref={containerRef} className="rounded-md border border-subtle bg-surface-secondary p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-tertiary" />
          <div>
            <div className="text-13 font-medium text-primary">Учёт времени</div>
            <div className="text-11 text-tertiary">
              {entries.length > 0 ? `Итого: ${formatHours(totalHours)}` : "Нет записей"}
            </div>
          </div>
        </div>
        {canManageWorklogs && (
          <Button
            variant="secondary"
            size="base"
            onClick={() => {
              setEditingWorklogId(null);
              setCreateFormState(getDefaultFormState());
              setIsComposerOpen((state) => !state);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-3 text-13 text-tertiary">
          <Spinner className="h-4 w-4" />
          <span>Загрузка...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.length === 0 && (
            <div className="rounded-md border border-dashed border-subtle p-3 text-12 text-tertiary">Нет записей</div>
          )}

          {entries.map((entry) => {
            const canEditEntry = canManageWorklogs && (isAdmin || currentUser?.id === entry.user_id);
            const isEditing = editingWorklogId === entry.id;
            const isBusy = busyWorklogId === entry.id;

            if (isEditing) {
              return (
                <div key={entry.id} className="space-y-3 rounded-md border border-accent-primary/30 bg-surface-1 p-3">
                  <div className="text-12 font-medium text-secondary">{entry.user_name}</div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_160px_minmax(0,1fr)]">
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={editFormState.hours}
                      onChange={(e) => setEditFormState((state) => ({ ...state, hours: e.target.value }))}
                      placeholder="Часы"
                    />
                    <Input
                      type="date"
                      value={editFormState.log_date}
                      onChange={(e) => setEditFormState((state) => ({ ...state, log_date: e.target.value }))}
                    />
                    <Input
                      type="text"
                      value={editFormState.description}
                      onChange={(e) => setEditFormState((state) => ({ ...state, description: e.target.value }))}
                      placeholder="Описание"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="secondary" size="base" onClick={cancelEdit} disabled={isBusy}>
                      Отмена
                    </Button>
                    <Button variant="primary" size="base" onClick={() => handleUpdate(entry.id)} disabled={isBusy}>
                      {isBusy ? "Сохранение..." : "Сохранить"}
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={entry.id} className="rounded-md border border-subtle bg-surface-1 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-13 font-medium text-primary">{entry.user_name}</div>
                    <div className="mt-1 text-12 text-secondary">
                      {entry.description?.trim() ? entry.description : "Без описания"}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-11 text-tertiary">
                      <span>{formatHours(entry.hours)}</span>
                      <span>{formatWorklogDate(entry.log_date)}</span>
                    </div>
                  </div>
                  {canEditEntry && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded p-1 text-tertiary transition-colors hover:bg-layer-1 hover:text-primary"
                        onClick={() => startEdit(entry)}
                        disabled={isBusy}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-tertiary transition-colors hover:bg-danger-subtle hover:text-danger-primary"
                        onClick={() => handleDelete(entry.id)}
                        disabled={isBusy}
                      >
                        {isBusy ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {canManageWorklogs && isComposerOpen && (
            <div className="space-y-3 rounded-md border border-accent-primary/30 bg-surface-1 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-13 font-medium text-primary">Новая запись</div>
                <button
                  type="button"
                  className="rounded p-1 text-tertiary transition-colors hover:bg-layer-1 hover:text-primary"
                  onClick={() => setIsComposerOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_160px_minmax(0,1fr)]">
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={createFormState.hours}
                  onChange={(e) => setCreateFormState((state) => ({ ...state, hours: e.target.value }))}
                  placeholder="Часы"
                />
                <Input
                  type="date"
                  value={createFormState.log_date}
                  onChange={(e) => setCreateFormState((state) => ({ ...state, log_date: e.target.value }))}
                />
                <Input
                  type="text"
                  value={createFormState.description}
                  onChange={(e) => setCreateFormState((state) => ({ ...state, description: e.target.value }))}
                  placeholder="Описание"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="base"
                  onClick={() => setIsComposerOpen(false)}
                  disabled={isSubmitting}
                >
                  Отмена
                </Button>
                <Button variant="primary" size="base" onClick={handleCreate} disabled={isSubmitting}>
                  {isSubmitting ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
