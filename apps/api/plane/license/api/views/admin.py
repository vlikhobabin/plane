# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from urllib.parse import urlencode, urljoin
import uuid
from zxcvbn import zxcvbn

# Django imports
from django.http import HttpResponseRedirect
from django.views import View
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from django.contrib.auth import logout

# Third party imports
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

# Module imports
from .base import BaseAPIView
from plane.license.api.permissions import InstanceAdminPermission
from plane.license.api.serializers import (
    InstanceAdminMeSerializer,
    InstanceAdminSerializer,
)
from plane.license.models import Instance, InstanceAdmin
from plane.db.models import User, Profile
from plane.utils.cache import cache_response, invalidate_cache
from plane.authentication.utils.login import user_login
from plane.authentication.utils.host import base_host, user_ip
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.utils.ip_address import get_client_ip
from plane.utils.path_validator import get_safe_redirect_url
from plane.app.services.guest_users import (
    GuestUserProvisioningError,
    generate_guest_password,
    provision_guest_user,
    send_guest_welcome_email,
)
from plane.db.models import Project, Workspace, WorkspaceMember


class InstanceAdminEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    @invalidate_cache(path="/api/instances/", user=False)
    # Create an instance admin
    def post(self, request):
        email = request.data.get("email", False)
        role = request.data.get("role", 20)

        if not email:
            return Response({"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        instance = Instance.objects.first()
        if instance is None:
            return Response(
                {"error": "Instance is not registered yet"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Fetch the user
        user = User.objects.get(email=email)

        instance_admin = InstanceAdmin.objects.create(instance=instance, user=user, role=role)
        serializer = InstanceAdminSerializer(instance_admin)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @cache_response(60 * 60 * 2, user=False)
    def get(self, request):
        instance = Instance.objects.first()
        if instance is None:
            return Response(
                {"error": "Instance is not registered yet"},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance_admins = InstanceAdmin.objects.filter(instance=instance)
        serializer = InstanceAdminSerializer(instance_admins, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @invalidate_cache(path="/api/instances/", user=False)
    def delete(self, request, pk):
        instance = Instance.objects.first()
        InstanceAdmin.objects.filter(instance=instance, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InstanceAdminGuestUserEndpoint(BaseAPIView):
    def _admin_workspace_memberships(self, user):
        return (
            WorkspaceMember.objects.filter(
                member=user,
                is_active=True,
                role__gte=20,
                deleted_at__isnull=True,
                workspace__deleted_at__isnull=True,
            )
            .select_related("workspace")
            .order_by("workspace__name")
        )

    def get(self, request):
        memberships = list(self._admin_workspace_memberships(request.user))
        workspace_ids = [membership.workspace_id for membership in memberships]

        projects = (
            Project.objects.filter(workspace_id__in=workspace_ids, deleted_at__isnull=True)
            .order_by("name")
            .values("id", "name", "identifier", "workspace_id")
        )

        projects_by_workspace = {}
        for project in projects:
            workspace_id = str(project["workspace_id"])
            projects_by_workspace.setdefault(workspace_id, []).append(
                {
                    "id": str(project["id"]),
                    "name": project["name"],
                    "identifier": project["identifier"],
                }
            )

        workspaces = [
            {
                "id": str(membership.workspace_id),
                "name": membership.workspace.name,
                "slug": membership.workspace.slug,
                "projects": projects_by_workspace.get(str(membership.workspace_id), []),
            }
            for membership in memberships
        ]

        return Response({"workspaces": workspaces}, status=status.HTTP_200_OK)

    def post(self, request):
        email = request.data.get("email", "")
        first_name = request.data.get("first_name", "")
        workspace_id = request.data.get("workspace_id")
        project_ids = request.data.get("project_ids") or []

        if not workspace_id:
            return Response({"error": "Workspace is required"}, status=status.HTTP_400_BAD_REQUEST)

        if not isinstance(project_ids, list) or len(project_ids) == 0:
            return Response({"error": "Select at least one project"}, status=status.HTTP_400_BAD_REQUEST)

        workspace = (
            Workspace.objects.filter(
                pk=workspace_id,
                deleted_at__isnull=True,
                workspace_member__member=request.user,
                workspace_member__role__gte=20,
                workspace_member__is_active=True,
                workspace_member__deleted_at__isnull=True,
            )
            .distinct()
            .first()
        )

        if workspace is None:
            return Response({"error": "Workspace was not found"}, status=status.HTTP_404_NOT_FOUND)

        unique_project_ids = list(dict.fromkeys(project_ids))
        projects = list(
            Project.objects.filter(
                workspace=workspace,
                pk__in=unique_project_ids,
                deleted_at__isnull=True,
            ).order_by("name")
        )

        if len(projects) != len(unique_project_ids):
            return Response({"error": "One or more projects are invalid"}, status=status.HTTP_400_BAD_REQUEST)

        password = generate_guest_password()

        try:
            user = provision_guest_user(
                email=email,
                first_name=first_name,
                workspace=workspace,
                projects=projects,
                password=password,
            )
        except GuestUserProvisioningError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        response_payload = {
            "success": True,
            "email": user.email,
            "password": password,
            "user_id": str(user.id),
        }

        try:
            login_url = urljoin(f"{base_host(request=request, is_app=True).rstrip('/')}/", "sign-in/")
            send_guest_welcome_email(
                to_email=user.email,
                first_name=user.first_name,
                password=password,
                login_url=login_url,
            )
        except GuestUserProvisioningError as exc:
            response_payload["smtp_error"] = str(exc)

        return Response(response_payload, status=status.HTTP_201_CREATED)


class InstanceAdminSignUpEndpoint(View):
    permission_classes = [AllowAny]

    @invalidate_cache(path="/api/instances/", user=False)
    def post(self, request):
        # Check instance first
        instance = Instance.objects.first()
        if instance is None:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INSTANCE_NOT_CONFIGURED"],
                error_message="INSTANCE_NOT_CONFIGURED",
            )
            url = urljoin(
                base_host(request=request, is_admin=True),
                "?" + urlencode(exc.get_error_dict()),
            )
            return HttpResponseRedirect(url)

        # check if the instance has already an admin registered
        if InstanceAdmin.objects.first():
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["ADMIN_ALREADY_EXIST"],
                error_message="ADMIN_ALREADY_EXIST",
            )
            url = urljoin(
                base_host(request=request, is_admin=True),
                "?" + urlencode(exc.get_error_dict()),
            )
            return HttpResponseRedirect(url)

        # Get the email and password from all the user
        email = request.POST.get("email", False)
        password = request.POST.get("password", False)
        first_name = request.POST.get("first_name", False)
        last_name = request.POST.get("last_name", "")
        company_name = request.POST.get("company_name", "")
        is_telemetry_enabled = request.POST.get("is_telemetry_enabled", True)

        # return error if the email and password is not present
        if not email or not password or not first_name:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME"],
                error_message="REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME",
                payload={
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "company_name": company_name,
                    "is_telemetry_enabled": is_telemetry_enabled,
                },
            )
            url = urljoin(
                base_host(
                    request=request,
                    is_admin=True,
                ),
                "?" + urlencode(exc.get_error_dict()),
            )
            return HttpResponseRedirect(url)

        # Validate the email
        email = email.strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INVALID_ADMIN_EMAIL"],
                error_message="INVALID_ADMIN_EMAIL",
                payload={
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "company_name": company_name,
                    "is_telemetry_enabled": is_telemetry_enabled,
                },
            )
            url = urljoin(
                base_host(request=request, is_admin=True),
                "?" + urlencode(exc.get_error_dict()),
            )
            return HttpResponseRedirect(url)

        # Check if already a user exists or not
        # Existing user
        if User.objects.filter(email=email).exists():
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["ADMIN_USER_ALREADY_EXIST"],
                error_message="ADMIN_USER_ALREADY_EXIST",
                payload={
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "company_name": company_name,
                    "is_telemetry_enabled": is_telemetry_enabled,
                },
            )
            url = urljoin(
                base_host(request=request, is_admin=True),
                "?" + urlencode(exc.get_error_dict()),
            )
            return HttpResponseRedirect(url)
        else:
            results = zxcvbn(password)
            if results["score"] < 3:
                exc = AuthenticationException(
                    error_code=AUTHENTICATION_ERROR_CODES["PASSWORD_TOO_WEAK"],
                    error_message="PASSWORD_TOO_WEAK",
                    payload={
                        "email": email,
                        "first_name": first_name,
                        "last_name": last_name,
                        "company_name": company_name,
                        "is_telemetry_enabled": is_telemetry_enabled,
                    },
                )
                url = urljoin(
                    base_host(request=request, is_admin=True),
                    "?" + urlencode(exc.get_error_dict()),
                )
                return HttpResponseRedirect(url)

            user = User.objects.create(
                first_name=first_name,
                last_name=last_name,
                email=email,
                username=uuid.uuid4().hex,
                password=make_password(password),
                is_password_autoset=False,
            )
            _ = Profile.objects.create(user=user, company_name=company_name)
            # settings last active for the user
            user.is_active = True
            user.last_active = timezone.now()
            user.last_login_time = timezone.now()
            user.last_login_ip = get_client_ip(request=request)
            user.last_login_uagent = request.META.get("HTTP_USER_AGENT")
            user.token_updated_at = timezone.now()
            user.save()

            # Register the user as an instance admin
            _ = InstanceAdmin.objects.create(user=user, instance=instance)
            # Make the setup flag True
            instance.is_setup_done = True
            instance.instance_name = company_name
            instance.is_telemetry_enabled = is_telemetry_enabled
            instance.save()

            # get tokens for user
            user_login(request=request, user=user, is_admin=True)
            url = urljoin(base_host(request=request, is_admin=True), "general/")
            return HttpResponseRedirect(url)


class InstanceAdminSignInEndpoint(View):
    permission_classes = [AllowAny]

    @invalidate_cache(path="/api/instances/", user=False)
    def post(self, request):
        # Check instance first
        instance = Instance.objects.first()
        if instance is None:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INSTANCE_NOT_CONFIGURED"],
                error_message="INSTANCE_NOT_CONFIGURED",
            )
            url = urljoin(
                base_host(request=request, is_admin=True),
                "?" + urlencode(exc.get_error_dict()),
            )
            return HttpResponseRedirect(url)

        # Get email and password
        email = request.POST.get("email", False)
        password = request.POST.get("password", False)

        # return error if the email and password is not present
        if not email or not password:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["REQUIRED_ADMIN_EMAIL_PASSWORD"],
                error_message="REQUIRED_ADMIN_EMAIL_PASSWORD",
                payload={"email": email},
            )
            url = urljoin(
                base_host(request=request, is_admin=True),
                "?" + urlencode(exc.get_error_dict()),
            )
            return HttpResponseRedirect(url)

        # Validate the email
        email = email.strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INVALID_ADMIN_EMAIL"],
                error_message="INVALID_ADMIN_EMAIL",
                payload={"email": email},
            )
            url = urljoin(
                base_host(request=request, is_admin=True),
                "?" + urlencode(exc.get_error_dict()),
            )
            return HttpResponseRedirect(url)

        # Fetch the user
        user = User.objects.filter(email=email).first()

        # Error out if the user is not present
        if not user:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["ADMIN_USER_DOES_NOT_EXIST"],
                error_message="ADMIN_USER_DOES_NOT_EXIST",
                payload={"email": email},
            )
            url = urljoin(
                base_host(request=request, is_admin=True),
                "?" + urlencode(exc.get_error_dict()),
            )
            return HttpResponseRedirect(url)

        # is_active
        if not user.is_active:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["ADMIN_USER_DEACTIVATED"],
                error_message="ADMIN_USER_DEACTIVATED",
            )
            url = urljoin(
                base_host(request=request, is_admin=True),
                "?" + urlencode(exc.get_error_dict()),
            )
            return HttpResponseRedirect(url)

        # Check password of the user
        if not user.check_password(password):
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["ADMIN_AUTHENTICATION_FAILED"],
                error_message="ADMIN_AUTHENTICATION_FAILED",
                payload={"email": email},
            )
            url = urljoin(
                base_host(request=request, is_admin=True),
                "?" + urlencode(exc.get_error_dict()),
            )
            return HttpResponseRedirect(url)

        # Check if the user is an instance admin
        if not InstanceAdmin.objects.filter(instance=instance, user=user):
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["ADMIN_AUTHENTICATION_FAILED"],
                error_message="ADMIN_AUTHENTICATION_FAILED",
                payload={"email": email},
            )
            url = urljoin(
                base_host(request=request, is_admin=True),
                "?" + urlencode(exc.get_error_dict()),
            )
            return HttpResponseRedirect(url)
        # settings last active for the user
        user.is_active = True
        user.last_active = timezone.now()
        user.last_login_time = timezone.now()
        user.last_login_ip = get_client_ip(request=request)
        user.last_login_uagent = request.META.get("HTTP_USER_AGENT")
        user.token_updated_at = timezone.now()
        user.save()

        # get tokens for user
        user_login(request=request, user=user, is_admin=True)
        url = urljoin(base_host(request=request, is_admin=True), "general/")
        return HttpResponseRedirect(url)


class InstanceAdminUserMeEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def get(self, request):
        serializer = InstanceAdminMeSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class InstanceAdminUserSessionEndpoint(BaseAPIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if request.user.is_authenticated and InstanceAdmin.objects.filter(user=request.user).exists():
            serializer = InstanceAdminMeSerializer(request.user)
            data = {"is_authenticated": True}
            data["user"] = serializer.data
            return Response(data, status=status.HTTP_200_OK)
        else:
            return Response({"is_authenticated": False}, status=status.HTTP_200_OK)


class InstanceAdminSignOutEndpoint(View):
    permission_classes = [InstanceAdminPermission]

    def post(self, request):
        # Get user
        try:
            user = User.objects.get(pk=request.user.id)
            user.last_logout_ip = user_ip(request=request)
            user.last_logout_time = timezone.now()
            user.save()
            # Log the user out
            logout(request)
            url = get_safe_redirect_url(base_url=base_host(request=request, is_admin=True), next_path="")
            return HttpResponseRedirect(url)
        except Exception:
            url = get_safe_redirect_url(base_url=base_host(request=request, is_admin=True), next_path="")
            return HttpResponseRedirect(url)
