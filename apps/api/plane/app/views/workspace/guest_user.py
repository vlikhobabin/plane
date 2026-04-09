# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.services import (
    GuestUserProvisioningError,
    generate_guest_password,
    provision_guest_user,
    send_guest_welcome_email,
)
from plane.app.views.base import BaseAPIView
from plane.db.models import Project, Workspace
from plane.utils.host import base_host


class WorkspaceGuestUserEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug):
        email = request.data.get("email", "")
        first_name = request.data.get("first_name", "")
        project_ids = [project_id for project_id in (request.data.get("project_ids", []) or []) if project_id]

        try:
            workspace = Workspace.objects.get(slug=slug)
            projects = list(Project.objects.filter(workspace=workspace, id__in=project_ids))
            if len(projects) != len(set(project_ids)):
                return Response(
                    {"error": "Some selected projects do not belong to the workspace"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

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
        except GuestUserProvisioningError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        except Workspace.DoesNotExist:
            return Response({"error": "Workspace not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = {
            "success": True,
            "email": created_user.email,
            "password": password,
            "user_id": str(created_user.id),
        }
        if smtp_error:
            payload["smtp_error"] = smtp_error

        return Response(payload, status=status.HTTP_200_OK)
