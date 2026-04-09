# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import secrets
import string

from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core.validators import validate_email
from django.db import transaction
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from zxcvbn import zxcvbn

from plane.db.models import Profile, Project, ProjectMember, Workspace, WorkspaceMember
from plane.license.utils.instance_value import get_email_configuration

User = get_user_model()

PASSWORD_ALPHABET = string.ascii_uppercase + string.ascii_lowercase + string.digits
GUEST_ROLE = 5
GUEST_ONBOARDING_STEP = {
    "workspace_join": True,
    "profile_complete": True,
    "workspace_create": True,
    "workspace_invite": True,
}


class GuestUserProvisioningError(Exception):
    pass


def generate_guest_password(length: int = 12) -> str:
    while True:
        password = "".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(length))
        if (
            any(ch.isupper() for ch in password)
            and any(ch.islower() for ch in password)
            and any(ch.isdigit() for ch in password)
            and zxcvbn(password)["score"] >= 3
        ):
            return password


def _build_email_connection():
    (
        email_host,
        email_host_user,
        email_host_password,
        email_port,
        email_use_tls,
        email_use_ssl,
        email_from,
    ) = get_email_configuration()

    if not email_host:
        raise GuestUserProvisioningError("SMTP is not configured")

    use_ssl = email_use_ssl == "1"
    use_tls = False if use_ssl else email_use_tls == "1"

    connection = get_connection(
        host=email_host,
        port=int(email_port or 587),
        username=email_host_user,
        password=email_host_password,
        use_tls=use_tls,
        use_ssl=use_ssl,
    )

    return connection, email_from or email_host_user or ""


def send_guest_welcome_email(*, to_email: str, first_name: str, password: str, login_url: str) -> None:
    connection, from_email = _build_email_connection()

    html_content = render_to_string(
        "emails/user/welcome_credentials.html",
        {
            "first_name": first_name,
            "email": to_email,
            "password": password,
            "login_url": login_url,
        },
    )
    text_content = strip_tags(html_content)

    message = EmailMultiAlternatives(
        subject="Ваши данные для входа в Plane",
        body=text_content,
        from_email=from_email,
        to=[to_email],
        connection=connection,
    )
    message.attach_alternative(html_content, "text/html")
    message.send()


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    validate_email(normalized)
    return normalized


def _normalize_name(first_name: str) -> str:
    normalized = first_name.strip()
    if not normalized:
        raise GuestUserProvisioningError("First name is required")
    return normalized


@transaction.atomic
def provision_guest_user(
    *,
    email: str,
    first_name: str,
    workspace: Workspace,
    projects: list[Project],
    password: str,
):
    normalized_email = _normalize_email(email)
    normalized_name = _normalize_name(first_name)

    if User.objects.filter(email=normalized_email).exists():
        raise GuestUserProvisioningError(f"User with email {normalized_email} already exists")

    user = User(
        email=normalized_email,
        username=secrets.token_hex(16),
        first_name=normalized_name,
        last_name="",
        display_name=normalized_name,
        token=secrets.token_hex(32),
        avatar="",
        last_location="",
        created_location="",
        last_login_ip="",
        last_logout_ip="",
        last_login_medium="",
        last_login_uagent="",
        is_password_autoset=True,
        is_email_verified=False,
        is_active=True,
        is_staff=False,
        is_superuser=False,
        is_password_expired=False,
        is_managed=False,
        is_bot=False,
        is_email_valid=False,
        user_timezone="UTC",
    )
    user.set_password(password)
    user.save()

    Profile.objects.create(
        user=user,
        language="ru",
        is_onboarded=True,
        last_workspace_id=workspace.id,
        onboarding_step=GUEST_ONBOARDING_STEP,
        is_tour_completed=True,
        theme={},
        billing_address={},
        goals={},
        mobile_onboarding_step={},
        is_mobile_onboarded=False,
        mobile_timezone_auto_set=False,
        billing_address_country="",
        company_name="",
        has_billing_address=False,
        is_smooth_cursor_enabled=False,
        is_app_rail_docked=False,
        has_marketing_email_consent=False,
    )

    WorkspaceMember.objects.create(
        workspace=workspace,
        member=user,
        role=GUEST_ROLE,
        is_active=True,
        view_props={},
        default_props={},
        issue_props={},
    )

    for project in projects:
        ProjectMember.objects.create(
            workspace=workspace,
            project=project,
            member=user,
            role=GUEST_ROLE,
            is_active=True,
            view_props={},
            default_props={},
            preferences={},
            sort_order=65535,
        )

    return user
