# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import (
    IssueTimeSummaryEndpoint,
    IssueWorklogDetailEndpoint,
    IssueWorklogEndpoint,
    ProjectTimeReportEndpoint,
    ResolveIssueIdentifierEndpoint,
)


urlpatterns = [
    path("resolve-issue/", ResolveIssueIdentifierEndpoint.as_view(), name="ext-resolve-issue"),
    path("issues/<uuid:issue_id>/worklogs/", IssueWorklogEndpoint.as_view(), name="ext-issue-worklogs"),
    path(
        "issues/<uuid:issue_id>/worklogs/<uuid:worklog_id>/",
        IssueWorklogDetailEndpoint.as_view(),
        name="ext-issue-worklog-detail",
    ),
    path(
        "issues/<uuid:issue_id>/time-summary/",
        IssueTimeSummaryEndpoint.as_view(),
        name="ext-issue-time-summary",
    ),
    path("projects/<uuid:project_id>/time-report/", ProjectTimeReportEndpoint.as_view(), name="ext-project-time-report"),
]
