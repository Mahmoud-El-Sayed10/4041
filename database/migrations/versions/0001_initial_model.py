"""Initial 20-table relational model, including immutable history.

Keep this revision and its SQL payload unchanged once shared/applied.
Subsequent changes belong in a new Alembic revision.
"""
from pathlib import Path

from alembic import context, op
import sqlalchemy as sa

revision = "0001_initial_model"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).with_name("0001_initial_model.sql").read_text(encoding="utf-8")
    op.execute(sa.text(sql))


def downgrade():
    # This initial migration cannot be reversed while preserving project data.
    if context.get_x_argument(as_dictionary=True).get("allow_destructive_downgrade") != "true":
        raise RuntimeError(
            "Initial downgrade deletes all project data. For an expendable database only, "
            "pass -x allow_destructive_downgrade=true; otherwise restore a backup."
        )
    op.execute("ALTER TABLE public.submission DROP CONSTRAINT fk_submission_current_revision")
    for table in (
        "audit_event", "experiment_export_item", "experiment_export",
        "experiment_grant", "submission_grant", "resource_group_member",
        "unit", "resource_group", "reference_resource", "experiment_step",
        "experiment", "submission_revision", "submission", "template_version",
        "form_template", "equipment", "app_user_role", "app_role", "auth_identity", "app_user",
    ):
        op.execute(f"DROP TABLE public.{table}")
    for function in ("reject_history_change", "protect_fixed_columns", "protect_submission_transition", "protect_export_transition"):
        op.execute(f"DROP FUNCTION public.{function}()")
