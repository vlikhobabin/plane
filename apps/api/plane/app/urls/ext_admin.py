# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views.ext_admin import WorkspaceGuestAdminView, WorkspaceGuestCompatCreateEndpoint


urlpatterns = [
    path("", WorkspaceGuestAdminView.as_view(), name="ext-admin"),
    path("create-user", WorkspaceGuestAdminView.as_view(), name="ext-admin-create-user"),
    path("create-user/", WorkspaceGuestAdminView.as_view(), name="ext-admin-create-user-slash"),
    path("api/create-user", WorkspaceGuestCompatCreateEndpoint.as_view(), name="ext-admin-api-create-user"),
    path("api/create-user/", WorkspaceGuestCompatCreateEndpoint.as_view(), name="ext-admin-api-create-user-slash"),
]
