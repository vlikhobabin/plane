# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from datetime import date
from typing import Any

from django.utils.dateparse import parse_date

from plane.app.permissions import ROLE
from plane.db.models import Project, ProjectMember

WORKLOG_LOG_DATE_FILTER_PROPERTY = "worklog_log_date"
_SUPPORTED_PROJECT_ISSUE_ENDPOINT_SUFFIXES = ("/issues", "/issues-detail", "/issues/list")


def parse_worklog_log_date_exact(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return parse_date(value)
    return None


def parse_worklog_log_date_range(value: Any) -> tuple[date, date] | None:
    if isinstance(value, str):
        parts = [part.strip() for part in value.split(",") if part.strip()]
    elif isinstance(value, (list, tuple)):
        parts = [str(part).strip() for part in value if str(part).strip()]
    else:
        return None

    if len(parts) != 2:
        return None

    start_date = parse_date(parts[0])
    end_date = parse_date(parts[1])
    if not start_date or not end_date:
        return None

    return (start_date, end_date) if start_date <= end_date else (end_date, start_date)


def can_use_project_issue_worklog_date_filter(request) -> bool:
    if request is None or not getattr(request, "user", None) or not request.user.is_authenticated:
        return False

    path = request.path.rstrip("/")
    if not any(path.endswith(suffix) for suffix in _SUPPORTED_PROJECT_ISSUE_ENDPOINT_SUFFIXES):
        return False

    parser_context = getattr(request, "parser_context", {}) or {}
    kwargs = parser_context.get("kwargs", {}) or {}
    slug = kwargs.get("slug")
    project_id = kwargs.get("project_id")
    if not slug or not project_id:
        return False

    return (
        Project.objects.filter(
            pk=project_id,
            workspace__slug=slug,
            archived_at__isnull=True,
            is_time_tracking_enabled=True,
        ).exists()
        and ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            member=request.user,
            role__gte=ROLE.MEMBER.value,
            is_active=True,
        ).exists()
    )


def get_active_worklog_log_date_range(filter_data: Any) -> tuple[date, date] | None:
    if not filter_data:
        return None

    if isinstance(filter_data, str):
        try:
            filter_data = json.loads(filter_data)
        except json.JSONDecodeError:
            return None

    if not isinstance(filter_data, dict):
        return None

    return _extract_worklog_log_date_range(filter_data)


def _extract_worklog_log_date_range(node: dict[str, Any]) -> tuple[date, date] | None:
    if not node:
        return None

    if "or" in node or "not" in node:
        return None

    if "and" in node:
        ranges = []
        for child in node["and"]:
            if not isinstance(child, dict):
                continue
            child_range = _extract_worklog_log_date_range(child)
            if child_range:
                ranges.append(child_range)

        if not ranges:
            return None

        first_range = ranges[0]
        return first_range if all(candidate == first_range for candidate in ranges[1:]) else None

    exact_key = f"{WORKLOG_LOG_DATE_FILTER_PROPERTY}__exact"
    if exact_key in node:
        exact_date = parse_worklog_log_date_exact(node[exact_key])
        return (exact_date, exact_date) if exact_date else None

    if WORKLOG_LOG_DATE_FILTER_PROPERTY in node:
        exact_date = parse_worklog_log_date_exact(node[WORKLOG_LOG_DATE_FILTER_PROPERTY])
        return (exact_date, exact_date) if exact_date else None

    range_key = f"{WORKLOG_LOG_DATE_FILTER_PROPERTY}__range"
    if range_key in node:
        return parse_worklog_log_date_range(node[range_key])

    return None
