from uuid import uuid4

import psycopg
from psycopg import errors
import pytest

from conftest import expect_error, finalize, migrate


def test_twenty_domain_tables_and_two_seed_roles(conn):
    tables = conn.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'alembic_version'").fetchall()
    assert len(tables) == 20
    assert conn.execute("SELECT code FROM app_role ORDER BY code").fetchall() == [('admin',), ('researcher',)]


def test_one_user_can_have_both_roles(conn, base):
    conn.execute("INSERT INTO app_user_role SELECT %s,id FROM app_role", (base['owner'],))
    assert conn.execute("SELECT count(*) FROM app_user_role WHERE user_id=%s", (base['owner'],)).fetchone()[0] == 2
    expect_error(conn, errors.UniqueViolation, "INSERT INTO app_user_role SELECT %s,id FROM app_role", (base['owner'],))


def test_external_identity_is_unique(conn, base):
    statement = "INSERT INTO auth_identity(user_id,issuer,subject) VALUES (%s,'urn:fictional:test','subject-1')"
    conn.execute(statement, (base['owner'],))
    expect_error(conn, errors.UniqueViolation, statement, (base['other'],))


def test_draft_allows_incomplete_system_context(conn, base):
    row = conn.execute("SELECT status,current_revision_no,project_reference,sample_reference FROM submission WHERE id=%s", (base['submission'],)).fetchone()
    assert row == ('draft', None, None, None)


@pytest.mark.parametrize('column,value', [('project_reference',''), ('sample_reference','x'*201), ('project_reference',' padded '), ('sample_reference','\t')])
def test_invalid_system_context_is_rejected(conn, base, column, value):
    # Column names are test constants, never request input.
    expect_error(conn, errors.CheckViolation, f"UPDATE submission SET {column}=%s WHERE id=%s", (value,base['submission']))


def test_finalization_requires_both_context_fields(conn, base):
    expect_error(conn, errors.CheckViolation,
        "UPDATE submission SET status='submitted',current_revision_no=1,submitted_at=now(),"
        "equipment_snapshot='{}',reference_snapshot='{}' WHERE id=%s", (base['submission'],))


def test_current_revision_cannot_point_to_another_submission(conn, base):
    finalize(conn,base)
    other = conn.execute("INSERT INTO submission(template_version_id,created_by_user_id) VALUES (%s,%s) RETURNING id", (base['version'],base['owner'])).fetchone()[0]
    expect_error(conn, errors.ForeignKeyViolation,
        "UPDATE submission SET status='submitted',current_revision_no=1,submitted_at=now(),project_reference='P',"
        "sample_reference='S',equipment_snapshot='{}',reference_snapshot='{}' WHERE id=%s", (other,))


def test_jsonb_objects_required(conn, base):
    expect_error(conn, errors.CheckViolation, "UPDATE submission SET answers='[]' WHERE id=%s", (base['submission'],))


def test_template_version_number_unique(conn, base):
    expect_error(conn, errors.UniqueViolation,
        "INSERT INTO template_version(template_id,version_no,created_by_user_id,definition) VALUES (%s,1,%s,'{}')",
        (base['template'],base['owner']))


def test_revision_and_definition_immutable(conn, base):
    finalize(conn,base)
    expect_error(conn, errors.CheckViolation, "UPDATE template_version SET definition='{}' WHERE id=%s", (base['version'],))
    expect_error(conn, errors.CheckViolation, "UPDATE submission_revision SET answers='{\"changed\":true}' WHERE submission_id=%s", (base['submission'],))
    expect_error(conn, errors.CheckViolation, "DELETE FROM submission_revision WHERE submission_id=%s", (base['submission'],))


def test_identity_owner_and_equipment_fixed(conn, base):
    expect_error(conn, errors.CheckViolation, "UPDATE submission SET created_by_user_id=%s WHERE id=%s", (base['other'],base['submission']))
    expect_error(conn, errors.CheckViolation, "UPDATE submission SET template_version_id=%s WHERE id=%s", (base['other_version'],base['submission']))
    expect_error(conn, errors.CheckViolation, "UPDATE equipment SET code='ANOTHER' WHERE id=%s", (base['equipment'],))


def test_correction_keeps_original_date_and_does_not_repin(conn, base):
    finalize(conn,base)
    first_date = conn.execute("SELECT submitted_at FROM submission WHERE id=%s", (base['submission'],)).fetchone()[0]
    conn.execute("INSERT INTO experiment_step(experiment_id,template_version_id,submission_id,pinned_revision_no,position) VALUES (%s,%s,%s,1,1)", (base['experiment'],base['version'],base['submission']))
    finalize(conn,base,2,'ECHANTILLON-DEMO-002')
    assert conn.execute("SELECT submitted_at,current_revision_no FROM submission WHERE id=%s", (base['submission'],)).fetchone() == (first_date,2)
    assert conn.execute("SELECT pinned_revision_no FROM experiment_step WHERE experiment_id=%s", (base['experiment'],)).fetchone()[0] == 1
    assert conn.execute("SELECT sample_reference FROM submission_revision WHERE submission_id=%s ORDER BY revision_no", (base['submission'],)).fetchall() == [('ECHANTILLON-DEMO-001',),('ECHANTILLON-DEMO-002',)]
    expect_error(conn, errors.CheckViolation, "UPDATE submission SET answers='{\"changed\":true}' WHERE id=%s", (base['submission'],))
    expect_error(conn, errors.CheckViolation, "UPDATE submission SET submitted_at=now()+interval '1 day' WHERE id=%s", (base['submission'],))
    expect_error(conn, errors.CheckViolation, "UPDATE submission SET current_revision_no=1 WHERE id=%s", (base['submission'],))


def test_step_rejects_wrong_template_version(conn, base):
    expect_error(conn, errors.ForeignKeyViolation,
        "INSERT INTO experiment_step(experiment_id,template_version_id,submission_id,position) VALUES (%s,%s,%s,1)",
        (base['experiment'],base['other_version'],base['submission']))


def test_step_rejects_revision_from_other_submission(conn, base):
    finalize(conn,base)
    other = conn.execute("INSERT INTO submission(template_version_id,created_by_user_id) VALUES (%s,%s) RETURNING id", (base['version'],base['owner'])).fetchone()[0]
    expect_error(conn, errors.ForeignKeyViolation,
        "INSERT INTO experiment_step(experiment_id,template_version_id,submission_id,pinned_revision_no,position) VALUES (%s,%s,%s,1,1)",
        (base['experiment'],base['version'],other))


def test_no_pin_without_submission(conn, base):
    expect_error(conn, errors.CheckViolation,
        "INSERT INTO experiment_step(experiment_id,template_version_id,pinned_revision_no,position) VALUES (%s,%s,1,1)", (base['experiment'],base['version']))


def test_multiple_planned_steps_but_only_one_attachment(conn, base):
    for position in (1,2,3):
        conn.execute("INSERT INTO experiment_step(experiment_id,template_version_id,position) VALUES (%s,%s,%s)", (base['experiment'],base['version'],position))
    conn.execute("UPDATE experiment_step SET submission_id=%s WHERE experiment_id=%s AND position=1", (base['submission'],base['experiment']))
    expect_error(conn, errors.UniqueViolation,
        "UPDATE experiment_step SET submission_id=%s WHERE experiment_id=%s AND position=2", (base['submission'],base['experiment']))


def test_reorder_can_defer_position_uniqueness(conn, base):
    for position in (1,2):
        conn.execute("INSERT INTO experiment_step(experiment_id,template_version_id,position) VALUES (%s,%s,%s)", (base['experiment'],base['version'],position))
    conn.execute("SET CONSTRAINTS uq_experiment_step_position DEFERRED")
    first,second = conn.execute("SELECT id FROM experiment_step ORDER BY position").fetchall()
    conn.execute("UPDATE experiment_step SET position=2 WHERE id=%s", first)
    conn.execute("UPDATE experiment_step SET position=1 WHERE id=%s", second)
    conn.execute("SET CONSTRAINTS uq_experiment_step_position IMMEDIATE")
    assert conn.execute("SELECT id FROM experiment_step ORDER BY position").fetchall() == [second,first]


def test_active_group_positions_unique_inactive_members_retained(conn):
    group = conn.execute("INSERT INTO resource_group(code,label) VALUES ('DEMO','Demo') RETURNING id").fetchone()[0]
    resources = [conn.execute("INSERT INTO reference_resource(kind,code,label) VALUES ('material',%s,'Demo') RETURNING id",(code,)).fetchone()[0] for code in ('A','B')]
    conn.execute("INSERT INTO resource_group_member VALUES (%s,%s,1,true)", (group,resources[0]))
    expect_error(conn,errors.UniqueViolation,"INSERT INTO resource_group_member VALUES (%s,%s,1,true)",(group,resources[1]))
    conn.execute("UPDATE resource_group_member SET active=false WHERE group_id=%s",(group,))
    conn.execute("INSERT INTO resource_group_member VALUES (%s,%s,1,true)",(group,resources[1]))


def make_export(conn, base):
    return conn.execute(
        "INSERT INTO experiment_export(experiment_id,created_by_user_id,request_id,source_lock_version,report_format_version,manifest) "
        "VALUES (%s,%s,%s,1,'1','{\"title\":\"Demo\"}') RETURNING id",
        (base['experiment'],base['owner'],uuid4()),
    ).fetchone()[0]


def test_export_requires_file_hash_and_terminal_attempt_is_immutable(conn, base):
    export = make_export(conn,base)
    expect_error(conn,errors.CheckViolation,"UPDATE experiment_export SET status='ready',completed_at=now() WHERE id=%s",(export,))
    expect_error(conn,errors.CheckViolation,"UPDATE experiment_export SET manifest='{}' WHERE id=%s",(export,))
    conn.execute("UPDATE experiment_export SET status='ready',completed_at=now(),pdf_storage_key='private/demo.pdf',pdf_sha256=%s WHERE id=%s", ('a'*64,export))
    expect_error(conn,errors.CheckViolation,"UPDATE experiment_export SET pdf_storage_key='private/replaced.pdf' WHERE id=%s",(export,))


def test_export_request_key_unique_per_creator(conn, base):
    export = make_export(conn,base)
    expect_error(conn,errors.UniqueViolation,
        "INSERT INTO experiment_export(experiment_id,created_by_user_id,request_id,source_lock_version,report_format_version,manifest) "
        "SELECT experiment_id,created_by_user_id,request_id,source_lock_version,report_format_version,manifest FROM experiment_export WHERE id=%s", (export,))


def test_export_survives_step_removal(conn, base):
    finalize(conn,base)
    step = conn.execute("INSERT INTO experiment_step(experiment_id,template_version_id,submission_id,pinned_revision_no,position) VALUES (%s,%s,%s,1,1) RETURNING id",(base['experiment'],base['version'],base['submission'])).fetchone()[0]
    export = make_export(conn,base)
    conn.execute("INSERT INTO experiment_export_item VALUES (%s,1,%s,%s,1)",(export,step,base['submission']))
    conn.execute("DELETE FROM experiment_step WHERE id=%s",(step,))
    assert conn.execute("SELECT source_step_id,submission_id FROM experiment_export_item WHERE export_id=%s",(export,)).fetchone() == (step,base['submission'])
    expect_error(conn,errors.CheckViolation,"DELETE FROM experiment_export_item WHERE export_id=%s",(export,))


def test_archival_preserves_grants_and_history(conn, base):
    conn.execute("INSERT INTO submission_grant(submission_id,user_id,access_level,granted_by_user_id) VALUES (%s,%s,'edit',%s)",(base['submission'],base['other'],base['owner']))
    conn.execute("UPDATE submission SET archived_at=now() WHERE id=%s",(base['submission'],))
    conn.execute("UPDATE submission_grant SET revoked_at=now() WHERE submission_id=%s",(base['submission'],))
    expect_error(conn,errors.CheckViolation,"DELETE FROM submission WHERE id=%s",(base['submission'],))


def test_audit_is_append_only(conn, base):
    event = conn.execute("INSERT INTO audit_event(actor_user_id,action,object_type,object_id) VALUES (%s,'submission.archived','submission',%s) RETURNING id",(base['owner'],base['submission'])).fetchone()[0]
    expect_error(conn,errors.CheckViolation,"UPDATE audit_event SET details='{\"changed\":true}' WHERE id=%s",(event,))


def test_optimistic_compare_and_swap_has_one_winner(conn, base):
    statement = "UPDATE submission SET lock_version=lock_version+1 WHERE id=%s AND lock_version=1 RETURNING id"
    assert conn.execute(statement,(base['submission'],)).fetchone() is not None
    assert conn.execute(statement,(base['submission'],)).fetchone() is None


def test_migration_repeat_and_explicit_disposable_downgrade(database_factory):
    dsn = database_factory()
    for _ in range(2):
        result = migrate(dsn,"upgrade","head")
        assert result.returncode == 0, result.stderr
    result = migrate(dsn,"downgrade","base")
    assert result.returncode != 0 and 'allow_destructive_downgrade' in result.stderr
    result = migrate(dsn,"-x","allow_destructive_downgrade=true","downgrade","base")
    assert result.returncode == 0, result.stderr
    result = migrate(dsn,"upgrade","head")
    assert result.returncode == 0, result.stderr
    with psycopg.connect(dsn) as conn:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == '0001_initial_model'
