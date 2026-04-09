# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.http import HttpResponseForbidden
from django.shortcuts import render
from django.views import View
from rest_framework import status
from rest_framework.response import Response

from plane.app.services import (
    GuestUserProvisioningError,
    generate_guest_password,
    provision_guest_user,
    send_guest_welcome_email,
)
from plane.app.views.base import BaseAPIView
from plane.db.models import Project, Workspace, WorkspaceMember
from plane.utils.host import base_host


def _admin_memberships(user):
    return (
        WorkspaceMember.objects.filter(member=user, role=20, is_active=True)
        .select_related("workspace")
        .order_by("workspace__name")
    )


def _workspace_options(user):
    memberships = list(_admin_memberships(user))
    workspaces = [membership.workspace for membership in memberships]
    projects = list(Project.objects.filter(workspace__in=workspaces).order_by("workspace__name", "name"))
    return workspaces, projects


def _resolve_workspace_for_admin(*, user, workspace_id: str | None = None, workspace_slug: str | None = None):
    memberships = _admin_memberships(user)

    if workspace_id:
        membership = memberships.filter(workspace_id=workspace_id).first()
    elif workspace_slug:
        membership = memberships.filter(workspace__slug=workspace_slug).first()
    else:
        membership = None

    if membership is None:
        raise GuestUserProvisioningError("Workspace not found or access denied")

    return membership.workspace


def _resolve_projects_for_workspace(*, workspace: Workspace, project_ids=None, project_identifiers=None):
    project_ids = [project_id for project_id in (project_ids or []) if project_id]
    project_identifiers = [identifier for identifier in (project_identifiers or []) if identifier]

    queryset = Project.objects.filter(workspace=workspace)
    selected_projects = []

    if project_ids:
        selected_projects = list(queryset.filter(id__in=project_ids))
        if len(selected_projects) != len(set(project_ids)):
            raise GuestUserProvisioningError("Some selected projects do not belong to the workspace")
        return selected_projects

    if project_identifiers:
        selected_projects = list(
            queryset.filter(identifier__in=[identifier.upper() for identifier in project_identifiers])
        )
        if len(selected_projects) != len(set(identifier.upper() for identifier in project_identifiers)):
            raise GuestUserProvisioningError("Some selected projects were not found in the workspace")

    return selected_projects


def _provision_guest_from_request(*, email: str, first_name: str, workspace: Workspace, projects: list[Project], request):
    password = generate_guest_password()
    created_user = provision_guest_user(
        email=email,
        first_name=first_name,
        workspace=workspace,
        projects=projects,
        password=password,
    )

    smtp_error = None
    try:
        send_guest_welcome_email(
            to_email=created_user.email,
            first_name=created_user.first_name,
            password=password,
            login_url=f"{base_host(request=request, is_app=True).rstrip('/')}/",
        )
    except Exception as exc:
        smtp_error = str(exc)

    return created_user, password, smtp_error


class WorkspaceGuestAdminView(View):
    template_name = "ext/admin.html"

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return HttpResponseForbidden("Войдите в Plane перед использованием этой страницы")

        if not _admin_memberships(request.user).exists():
            return HttpResponseForbidden("Требуются права администратора workspace")

        return super().dispatch(request, *args, **kwargs)

    def get_context(self, request, **extra):
        workspaces, projects = _workspace_options(request.user)
        context = {
            "workspaces": workspaces,
            "projects": projects,
            "selected_workspace": None,
            "selected_projects": [],
            "form_email": "",
            "form_first_name": "",
        }
        context.update(extra)
        return context

    def get(self, request):
        return render(request, self.template_name, self.get_context(request))

    def post(self, request):
        email = request.POST.get("email", "")
        first_name = request.POST.get("first_name", "")
        workspace_id = request.POST.get("workspace_id")
        project_ids = request.POST.getlist("project_ids")

        context = self.get_context(
            request,
            selected_workspace=workspace_id,
            selected_projects=project_ids,
            form_email=email,
            form_first_name=first_name,
        )

        try:
            workspace = _resolve_workspace_for_admin(user=request.user, workspace_id=workspace_id)
            projects = _resolve_projects_for_workspace(workspace=workspace, project_ids=project_ids)
            created_user, password, smtp_error = _provision_guest_from_request(
                email=email,
                first_name=first_name,
                workspace=workspace,
                projects=projects,
                request=request,
            )
        except Exception as exc:
            context["error"] = str(exc)
            return render(request, self.template_name, context, status=status.HTTP_400_BAD_REQUEST)

        if smtp_error:
            context["email_error"] = True
            context["fallback_password"] = password
        else:
            context["success"] = True
            context["result_email"] = created_user.email

        return render(request, self.template_name, context)


class WorkspaceGuestCompatCreateEndpoint(BaseAPIView):
    def post(self, request):
        if not _admin_memberships(request.user).exists():
            return Response(
                {"success": False, "error": "Workspace admin access is required"},
                status=status.HTTP_403_FORBIDDEN,
            )

        email = request.data.get("email", "")
        first_name = request.data.get("first_name", "")
        workspace_slug = request.data.get("workspace_slug")
        project_identifiers = request.data.get("project_slugs", []) or []

        try:
            workspace = _resolve_workspace_for_admin(user=request.user, workspace_slug=workspace_slug)
            projects = _resolve_projects_for_workspace(workspace=workspace, project_identifiers=project_identifiers)
            created_user, password, smtp_error = _provision_guest_from_request(
                email=email,
                first_name=first_name,
                workspace=workspace,
                projects=projects,
                request=request,
            )
        except GuestUserProvisioningError as exc:
            return Response({"success": False, "error": str(exc)}, status=status.HTTP_409_CONFLICT)
        except Exception as exc:
            return Response({"success": False, "error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = {
            "success": True,
            "email": created_user.email,
            "password": password,
            "user_id": str(created_user.id),
        }
        if smtp_error:
            payload["smtp_error"] = smtp_error

        return Response(payload, status=status.HTTP_200_OK)
