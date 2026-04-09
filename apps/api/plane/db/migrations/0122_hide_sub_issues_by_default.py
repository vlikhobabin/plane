from django.db import migrations


UPDATE_SUB_ISSUE_FALSE_SQL = """
UPDATE project_user_properties
SET display_filters = jsonb_set(
    COALESCE(display_filters::jsonb, '{}'::jsonb),
    '{sub_issue}',
    'false'::jsonb,
    true
)
WHERE deleted_at IS NULL
  AND COALESCE(display_filters->>'sub_issue', 'true') <> 'false';

UPDATE workspace_user_properties
SET display_filters = jsonb_set(
    COALESCE(display_filters::jsonb, '{}'::jsonb),
    '{display_filters,sub_issue}',
    'false'::jsonb,
    true
)
WHERE deleted_at IS NULL
  AND COALESCE(display_filters->'display_filters'->>'sub_issue', 'true') <> 'false';

UPDATE module_user_properties
SET display_filters = jsonb_set(
    COALESCE(display_filters::jsonb, '{}'::jsonb),
    '{sub_issue}',
    'false'::jsonb,
    true
)
WHERE deleted_at IS NULL
  AND COALESCE(display_filters->>'sub_issue', 'true') <> 'false';

UPDATE cycle_user_properties
SET display_filters = jsonb_set(
    COALESCE(display_filters::jsonb, '{}'::jsonb),
    '{sub_issue}',
    'false'::jsonb,
    true
)
WHERE deleted_at IS NULL
  AND COALESCE(display_filters->>'sub_issue', 'true') <> 'false';

UPDATE issue_views
SET display_filters = jsonb_set(
    COALESCE(display_filters::jsonb, '{}'::jsonb),
    '{sub_issue}',
    'false'::jsonb,
    true
)
WHERE deleted_at IS NULL
  AND COALESCE(display_filters->>'sub_issue', 'true') <> 'false';

UPDATE project_members
SET view_props = jsonb_set(
        COALESCE(view_props::jsonb, '{}'::jsonb),
        '{display_filters,sub_issue}',
        'false'::jsonb,
        true
    ),
    default_props = jsonb_set(
        COALESCE(default_props::jsonb, '{}'::jsonb),
        '{display_filters,sub_issue}',
        'false'::jsonb,
        true
    )
WHERE deleted_at IS NULL
  AND (
      COALESCE(view_props->'display_filters'->>'sub_issue', 'true') <> 'false'
      OR COALESCE(default_props->'display_filters'->>'sub_issue', 'true') <> 'false'
  );

UPDATE workspace_members
SET view_props = jsonb_set(
        COALESCE(view_props::jsonb, '{}'::jsonb),
        '{display_filters,sub_issue}',
        'false'::jsonb,
        true
    ),
    default_props = jsonb_set(
        COALESCE(default_props::jsonb, '{}'::jsonb),
        '{display_filters,sub_issue}',
        'false'::jsonb,
        true
    )
WHERE deleted_at IS NULL
  AND (
      COALESCE(view_props->'display_filters'->>'sub_issue', 'true') <> 'false'
      OR COALESCE(default_props->'display_filters'->>'sub_issue', 'true') <> 'false'
  );
"""


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0121_alter_estimate_type"),
    ]

    operations = [
        migrations.RunSQL(
            sql=UPDATE_SUB_ISSUE_FALSE_SQL,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
