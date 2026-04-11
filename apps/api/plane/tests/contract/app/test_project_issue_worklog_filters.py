# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from datetime import date

import pytest
from rest_framework import status

from plane.db.models import Issue, IssueWorkLog, Project, ProjectMember, State, WorkspaceMember, User


@pytest.mark.contract
class TestProjectIssueWorklogPeriodFilter:
    @staticmethod
    def get_project_issues_url(workspace_slug: str, project_id: str) -> str:
        return f"/api/workspaces/{workspace_slug}/projects/{project_id}/issues/"

    @pytest.fixture
    def project_with_worklogs(self, workspace, create_user):
        project = Project.objects.create(
            name="Worklog Filters Project",
            identifier="WLOG",
            workspace=workspace,
            created_by=create_user,
            updated_by=create_user,
            issue_views_view=True,
            is_time_tracking_enabled=True,
            guest_view_all_features=True,
        )
        ProjectMember.objects.create(
            project=project,
            workspace=workspace,
            member=create_user,
            role=20,
        )
        state = State.objects.create(
            project=project,
            workspace=workspace,
            name="Todo",
            color="#60646C",
            group="unstarted",
            default=True,
            created_by=create_user,
            updated_by=create_user,
        )

        issue_with_april_logs = Issue.objects.create(
            project=project,
            workspace=workspace,
            state=state,
            name="Issue with April worklogs",
            created_by=create_user,
            updated_by=create_user,
        )
        issue_with_only_march_log = Issue.objects.create(
            project=project,
            workspace=workspace,
            state=state,
            name="Issue with March worklog only",
            created_by=create_user,
            updated_by=create_user,
        )
        issue_without_worklogs = Issue.objects.create(
            project=project,
            workspace=workspace,
            state=state,
            name="Issue without worklogs",
            created_by=create_user,
            updated_by=create_user,
        )

        IssueWorkLog.objects.bulk_create(
            [
                IssueWorkLog(
                    issue=issue_with_april_logs,
                    user=create_user,
                    hours=1,
                    log_date=date(2026, 3, 31),
                ),
                IssueWorkLog(
                    issue=issue_with_april_logs,
                    user=create_user,
                    hours=1,
                    log_date=date(2026, 4, 10),
                ),
                IssueWorkLog(
                    issue=issue_with_april_logs,
                    user=create_user,
                    hours=1,
                    log_date=date(2026, 4, 20),
                ),
                IssueWorkLog(
                    issue=issue_with_only_march_log,
                    user=create_user,
                    hours=1,
                    log_date=date(2026, 3, 15),
                ),
            ]
        )

        return {
            "project": project,
            "issues": {
                "with_april_logs": issue_with_april_logs,
                "with_only_march_log": issue_with_only_march_log,
                "without_worklogs": issue_without_worklogs,
            },
        }

    @pytest.mark.django_db
    def test_filters_project_issues_by_worklog_period_and_recalculates_actual_hours(
        self,
        session_client,
        workspace,
        project_with_worklogs,
    ):
        project = project_with_worklogs["project"]
        issue_with_april_logs = project_with_worklogs["issues"]["with_april_logs"]

        response = session_client.get(
            self.get_project_issues_url(workspace.slug, project.id),
            {
                "filters": json.dumps(
                    {
                        "worklog_log_date__range": "2026-04-01,2026-04-30",
                    }
                )
            },
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_results"] == 1

        returned_issue = response.data["results"][0]
        assert str(returned_issue["id"]) == str(issue_with_april_logs.id)
        assert returned_issue["name"] == issue_with_april_logs.name
        assert returned_issue["actual_hours"] == pytest.approx(2.0)

    @pytest.mark.django_db
    def test_returns_full_actual_hours_when_worklog_period_filter_is_not_active(
        self,
        session_client,
        workspace,
        project_with_worklogs,
    ):
        project = project_with_worklogs["project"]
        issue_with_april_logs = project_with_worklogs["issues"]["with_april_logs"]

        response = session_client.get(self.get_project_issues_url(workspace.slug, project.id))

        assert response.status_code == status.HTTP_200_OK

        returned_issue = next(
            issue for issue in response.data["results"] if str(issue["id"]) == str(issue_with_april_logs.id)
        )
        assert returned_issue["actual_hours"] == pytest.approx(3.0)

    @pytest.mark.django_db
    def test_guest_requests_ignore_worklog_period_filter(
        self,
        session_client,
        workspace,
        project_with_worklogs,
    ):
        project = project_with_worklogs["project"]

        guest_user = User.objects.create_user(email="guest-worklog-filter@example.com", username="guest_worklog_filter")
        WorkspaceMember.objects.create(workspace=workspace, member=guest_user, role=5)
        ProjectMember.objects.create(project=project, workspace=workspace, member=guest_user, role=5)

        session_client.force_authenticate(user=guest_user)

        response = session_client.get(
            self.get_project_issues_url(workspace.slug, project.id),
            {
                "filters": json.dumps(
                    {
                        "worklog_log_date__range": "2026-04-01,2026-04-30",
                    }
                )
            },
        )

        assert response.status_code == status.HTTP_200_OK

        returned_issue_ids = {str(issue["id"]) for issue in response.data["results"]}
        expected_issue_ids = {str(issue.id) for issue in project_with_worklogs["issues"].values()}
        assert returned_issue_ids == expected_issue_ids
