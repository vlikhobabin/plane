# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from plane.db.mixins import SoftDeletionManager


class IssueWorkLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.CASCADE,
        related_name="worklogs",
        db_constraint=False,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="issue_worklogs",
        db_constraint=False,
    )
    hours = models.FloatField(validators=[MinValueValidator(0.000001)])
    description = models.TextField(blank=True, default="")
    log_date = models.DateField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeletionManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "ext_worklogs"
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=["issue"], name="ext_worklogs_issue_id"),
            models.Index(fields=["user"], name="ext_worklogs_user_id"),
            models.Index(fields=["issue", "log_date"], name="ext_worklogs_issue_log_date"),
        ]

    def __str__(self):
        return f"{self.issue_id} {self.user_id} {self.hours}"
