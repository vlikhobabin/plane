# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from .base import DateField, DateTimeField, ExportSchema, ListField, NumberField, StringField


class ProjectIssueListExportSchema(ExportSchema):
    key = StringField(label="ID")
    name = StringField(source="name", label="Name")
    state = StringField(label="State")
    priority = StringField(source="priority", label="Priority")
    assignee = ListField(label="Assignee")
    labels = ListField(label="Labels")
    start_date = DateField(source="start_date", label="Start Date")
    due_date = DateField(source="target_date", label="Due Date")
    estimate = StringField(label="Estimate")
    fact = NumberField(source="actual_hours", label="Actual")
    modules = ListField(label="Module")
    cycle = StringField(label="Cycle")
    issue_type = StringField(label="Work item Type")
    created_on = DateTimeField(source="created_at", label="Created on")
    updated_on = DateTimeField(source="updated_at", label="Updated on")
    link = NumberField(source="link_count", label="Link")
    attachment_count = NumberField(source="attachment_count", label="Attachment count")
    sub_issue_count = NumberField(source="sub_issues_count", label="Sub-work item count")

    def prepare_key(self, issue):
        return f"{issue.project.identifier}-{issue.sequence_id}"

    def prepare_state(self, issue):
        return issue.state.name if issue.state else ""

    def prepare_assignee(self, issue):
        return [
            f"{relation.assignee.first_name} {relation.assignee.last_name}".strip() or relation.assignee.email
            for relation in issue.issue_assignee.all()
            if relation.assignee
        ]

    def prepare_labels(self, issue):
        return [relation.label.name for relation in issue.label_issue.all() if relation.label]

    def prepare_estimate(self, issue):
        return issue.estimate_point.value if issue.estimate_point and issue.estimate_point.value else ""

    def prepare_modules(self, issue):
        return [relation.module.name for relation in issue.issue_module.all() if relation.module]

    def prepare_cycle(self, issue):
        cycle_relation = next((relation for relation in issue.issue_cycle.all() if relation.cycle), None)
        return cycle_relation.cycle.name if cycle_relation else ""

    def prepare_issue_type(self, issue):
        return issue.type.name if issue.type else ""
