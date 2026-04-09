# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from collections import OrderedDict
from rest_framework import serializers, status
from rest_framework.response import Response
from django.utils import timezone

from plane.app.permissions import ROLE
from plane.db.models import Issue, IssueWorkLog, Project, Workspace, WorkspaceMember

from .. import BaseAPIView


class WorklogCreateSerializer(serializers.Serializer):
    hours = serializers.FloatField(min_value=0.000001)
    log_date = serializers.DateField()
    description = serializers.CharField(required=False, allow_blank=True, default="")


class WorklogUpdateSerializer(serializers.Serializer):
    hours = serializers.FloatField(min_value=0.000001, required=False)
    log_date = serializers.DateField(required=False)
    description = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("No fields provided.")
        return attrs


class WorklogAccessMixin:
    permission_error = {"error": "You don't have the required permissions."}

    def _display_name(self, user):
        full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        return full_name or getattr(user, "display_name", "") or user.email

    def _parse_planned_hours(self, issue):
        estimate = getattr(issue, "estimate_point", None)
        if not estimate:
            return None
        try:
            return float(estimate.value)
        except (TypeError, ValueError):
            return None

    def _workspace_role(self, user, workspace_id):
        return (
            WorkspaceMember.objects.filter(
                member=user,
                workspace_id=workspace_id,
                is_active=True,
                deleted_at__isnull=True,
            )
            .order_by("-role")
            .values_list("role", flat=True)
            .first()
        )

    def _is_workspace_admin(self, user, workspace_id):
        return self._workspace_role(user, workspace_id) == ROLE.ADMIN.value

    def _ensure_member_role(self, user, workspace_id):
        role = self._workspace_role(user, workspace_id)
        if role is None or role < ROLE.MEMBER.value:
            return None, Response(self.permission_error, status=status.HTTP_403_FORBIDDEN)
        return role, None

    def _ensure_admin_role(self, user, workspace_id):
        role = self._workspace_role(user, workspace_id)
        if role != ROLE.ADMIN.value:
            return None, Response(self.permission_error, status=status.HTTP_403_FORBIDDEN)
        return role, None

    def _get_issue(self, issue_id, slug=None, project_id=None):
        queryset = Issue.issue_objects.select_related("workspace", "project", "estimate_point").filter(pk=issue_id)
        if slug is not None:
            queryset = queryset.filter(workspace__slug=slug)
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        issue = queryset.first()
        if not issue:
            return None, Response({"error": "The required object does not exist."}, status=status.HTTP_404_NOT_FOUND)
        return issue, None

    def _get_project(self, project_id, slug=None):
        queryset = Project.objects.select_related("workspace").filter(pk=project_id, deleted_at__isnull=True)
        if slug is not None:
            queryset = queryset.filter(workspace__slug=slug)
        project = queryset.first()
        if not project:
            return None, Response({"error": "The required object does not exist."}, status=status.HTTP_404_NOT_FOUND)
        return project, None

    def _get_worklog(self, issue_id, worklog_id):
        worklog = (
            IssueWorkLog.objects.select_related("user", "issue", "issue__workspace", "issue__project")
            .filter(pk=worklog_id, issue_id=issue_id)
            .first()
        )
        if not worklog:
            return None, Response({"error": "The required object does not exist."}, status=status.HTTP_404_NOT_FOUND)
        return worklog, None

    def _serialize_worklog(self, worklog, include_updated=False):
        payload = {
            "id": str(worklog.id),
            "user_id": str(worklog.user_id),
            "user_name": self._display_name(worklog.user),
            "hours": worklog.hours,
            "description": worklog.description,
            "log_date": worklog.log_date.isoformat(),
            "created_at": worklog.created_at.isoformat(),
        }
        if include_updated:
            payload["updated_at"] = worklog.updated_at.isoformat()
        return payload

    def _build_issue_summary(self, issue):
        entries = IssueWorkLog.objects.select_related("user").filter(issue=issue).order_by("created_at")
        by_user = OrderedDict()
        for entry in entries:
            user_id = str(entry.user_id)
            if user_id not in by_user:
                by_user[user_id] = {
                    "user_id": user_id,
                    "user_name": self._display_name(entry.user),
                    "hours": 0.0,
                }
            by_user[user_id]["hours"] = round(by_user[user_id]["hours"] + entry.hours, 2)

        actual_hours = round(sum(item["hours"] for item in by_user.values()), 2)
        return {
            "issue_id": str(issue.id),
            "planned_hours": self._parse_planned_hours(issue),
            "actual_hours": actual_hours,
            "by_user": list(by_user.values()),
        }

    def _build_project_report(self, project, month=None):
        entries = (
            IssueWorkLog.objects.select_related("user", "issue", "issue__estimate_point")
            .filter(issue__project_id=project.id)
            .order_by("issue__sequence_id", "log_date", "created_at")
        )

        if month:
            try:
                parsed_month = datetime.strptime(month, "%Y-%m")
            except ValueError:
                return None, Response({"error": "Please provide valid detail"}, status=status.HTTP_400_BAD_REQUEST)
            entries = entries.filter(log_date__year=parsed_month.year, log_date__month=parsed_month.month)

        by_issue = OrderedDict()
        for entry in entries:
            issue_id = str(entry.issue_id)
            issue_bucket = by_issue.setdefault(
                issue_id,
                {
                    "issue_id": issue_id,
                    "issue_name": entry.issue.name,
                    "sequence_id": entry.issue.sequence_id,
                    "planned_hours": self._parse_planned_hours(entry.issue),
                    "actual_hours": 0.0,
                    "by_user": OrderedDict(),
                    "log_entries": [],
                },
            )

            issue_bucket["actual_hours"] = round(issue_bucket["actual_hours"] + entry.hours, 2)
            user_id = str(entry.user_id)
            if user_id not in issue_bucket["by_user"]:
                issue_bucket["by_user"][user_id] = {
                    "user_id": user_id,
                    "user_name": self._display_name(entry.user),
                    "hours": 0.0,
                }
            issue_bucket["by_user"][user_id]["hours"] = round(
                issue_bucket["by_user"][user_id]["hours"] + entry.hours, 2
            )
            issue_bucket["log_entries"].append(
                {
                    "user_id": user_id,
                    "user_name": self._display_name(entry.user),
                    "log_date": entry.log_date.isoformat(),
                    "hours": entry.hours,
                    "description": entry.description,
                    "worklog_id": str(entry.id),
                }
            )

        payload = []
        for bucket in by_issue.values():
            bucket["by_user"] = list(bucket["by_user"].values())
            payload.append(bucket)
        return payload, None


class IssueWorklogEndpoint(WorklogAccessMixin, BaseAPIView):
    def get(self, request, issue_id, slug=None, project_id=None):
        issue, error = self._get_issue(issue_id, slug=slug, project_id=project_id)
        if error:
            return error

        _, error = self._ensure_member_role(request.user, issue.workspace_id)
        if error:
            return error

        entries = IssueWorkLog.objects.select_related("user").filter(issue=issue).order_by("created_at")
        return Response([self._serialize_worklog(entry) for entry in entries], status=status.HTTP_200_OK)

    def post(self, request, issue_id, slug=None, project_id=None):
        issue, error = self._get_issue(issue_id, slug=slug, project_id=project_id)
        if error:
            return error

        _, error = self._ensure_member_role(request.user, issue.workspace_id)
        if error:
            return error

        serializer = WorklogCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        worklog = IssueWorkLog.objects.create(
            issue=issue,
            user=request.user,
            hours=payload["hours"],
            log_date=payload["log_date"],
            description=payload.get("description", ""),
        )
        worklog.user = request.user
        return Response(self._serialize_worklog(worklog), status=status.HTTP_201_CREATED)


class IssueWorklogDetailEndpoint(WorklogAccessMixin, BaseAPIView):
    def patch(self, request, issue_id, worklog_id, slug=None, project_id=None):
        issue, error = self._get_issue(issue_id, slug=slug, project_id=project_id)
        if error:
            return error

        _, error = self._ensure_member_role(request.user, issue.workspace_id)
        if error:
            return error

        worklog, error = self._get_worklog(issue.id, worklog_id)
        if error:
            return error

        is_admin = self._is_workspace_admin(request.user, issue.workspace_id)
        if str(worklog.user_id) != str(request.user.id) and not is_admin:
            return Response(self.permission_error, status=status.HTTP_403_FORBIDDEN)

        serializer = WorklogUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        for field, value in payload.items():
            setattr(worklog, field, value)
        worklog.save()
        return Response(self._serialize_worklog(worklog, include_updated=True), status=status.HTTP_200_OK)

    def delete(self, request, issue_id, worklog_id, slug=None, project_id=None):
        issue, error = self._get_issue(issue_id, slug=slug, project_id=project_id)
        if error:
            return error

        _, error = self._ensure_member_role(request.user, issue.workspace_id)
        if error:
            return error

        worklog, error = self._get_worklog(issue.id, worklog_id)
        if error:
            return error

        is_admin = self._is_workspace_admin(request.user, issue.workspace_id)
        if str(worklog.user_id) != str(request.user.id) and not is_admin:
            return Response(self.permission_error, status=status.HTTP_403_FORBIDDEN)

        worklog.deleted_at = timezone.now()
        worklog.save(update_fields=["deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssueTimeSummaryEndpoint(WorklogAccessMixin, BaseAPIView):
    def get(self, request, issue_id, slug=None, project_id=None):
        issue, error = self._get_issue(issue_id, slug=slug, project_id=project_id)
        if error:
            return error

        _, error = self._ensure_member_role(request.user, issue.workspace_id)
        if error:
            return error

        return Response(self._build_issue_summary(issue), status=status.HTTP_200_OK)


class ProjectTimeReportEndpoint(WorklogAccessMixin, BaseAPIView):
    def get(self, request, project_id, slug=None):
        project, error = self._get_project(project_id, slug=slug)
        if error:
            return error

        _, error = self._ensure_admin_role(request.user, project.workspace_id)
        if error:
            return error

        payload, error = self._build_project_report(project, month=request.query_params.get("month"))
        if error:
            return error
        return Response(payload, status=status.HTTP_200_OK)


class ResolveIssueIdentifierEndpoint(WorklogAccessMixin, BaseAPIView):
    def get(self, request):
        workspace_slug = request.query_params.get("workspace")
        identifier = request.query_params.get("identifier")

        if not workspace_slug or not identifier:
            return Response({"detail": "Invalid identifier"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            project_key, sequence = identifier.rsplit("-", 1)
            sequence_id = int(sequence)
        except (AttributeError, ValueError):
            return Response({"detail": "Invalid identifier"}, status=status.HTTP_400_BAD_REQUEST)

        workspace = Workspace.objects.filter(slug=workspace_slug, deleted_at__isnull=True).first()
        if not workspace:
            return Response({"detail": "Issue not found"}, status=status.HTTP_404_NOT_FOUND)

        _, error = self._ensure_member_role(request.user, workspace.id)
        if error:
            return error

        issue = (
            Issue.issue_objects.filter(
                workspace__slug=workspace_slug,
                project__identifier=project_key.upper(),
                sequence_id=sequence_id,
            )
            .values("id")
            .first()
        )
        if not issue:
            return Response({"detail": "Issue not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"issue_id": str(issue["id"])}, status=status.HTTP_200_OK)
