import django.core.validators
import django.db.models.deletion
import django.utils.timezone
import plane.db.mixins
import uuid
from django.conf import settings
from django.db import migrations, models


CREATE_EXT_WORKLOGS_SQL = """
CREATE TABLE IF NOT EXISTS ext_worklogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL,
    user_id UUID NOT NULL,
    hours DOUBLE PRECISION NOT NULL CHECK (hours > 0),
    description TEXT NOT NULL DEFAULT '',
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS ext_worklogs_issue_id ON ext_worklogs (issue_id);
CREATE INDEX IF NOT EXISTS ext_worklogs_user_id ON ext_worklogs (user_id);
"""


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0122_hide_sub_issues_by_default"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=CREATE_EXT_WORKLOGS_SQL,
                    reverse_sql=migrations.RunSQL.noop,
                )
            ],
            state_operations=[
                migrations.CreateModel(
                    name="IssueWorkLog",
                    fields=[
                        ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                        ("hours", models.FloatField(validators=[django.core.validators.MinValueValidator(1e-06)])),
                        ("description", models.TextField(blank=True, default="")),
                        ("log_date", models.DateField(default=django.utils.timezone.now)),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        ("updated_at", models.DateTimeField(auto_now=True)),
                        ("deleted_at", models.DateTimeField(blank=True, null=True)),
                        (
                            "issue",
                            models.ForeignKey(
                                db_constraint=False,
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="worklogs",
                                to="db.issue",
                            ),
                        ),
                        (
                            "user",
                            models.ForeignKey(
                                db_constraint=False,
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="issue_worklogs",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "db_table": "ext_worklogs",
                        "ordering": ("created_at",),
                        "indexes": [
                            models.Index(fields=["issue"], name="ext_worklogs_issue_id"),
                            models.Index(fields=["user"], name="ext_worklogs_user_id"),
                        ],
                    },
                    managers=[
                        ("objects", plane.db.mixins.SoftDeletionManager()),
                        ("all_objects", models.Manager()),
                    ],
                ),
            ],
        ),
    ]
