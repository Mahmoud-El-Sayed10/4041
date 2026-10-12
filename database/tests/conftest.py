"""Real PostgreSQL only. Create and remove a uniquely named expendable database."""
from pathlib import Path
import os
import subprocess
import sys
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo
import pytest

ROOT = Path(__file__).resolve().parents[2]


def migrate(dsn, *arguments):
    env = os.environ.copy()
    # libpq accepts keyword DSNs, SQLAlchemy needs a URL; construct it safely.
    from sqlalchemy import URL
    from psycopg.conninfo import conninfo_to_dict
    params = conninfo_to_dict(dsn)
    env["DATABASE_URL"] = URL.create(
        "postgresql+psycopg", username=params.get("user"), password=params.get("password"),
        host=params.get("host"), port=int(params["port"]) if params.get("port") else None,
        database=params.get("dbname"),
        query={k: v for k, v in params.items() if k not in {"user", "password", "host", "port", "dbname"}},
    ).render_as_string(hide_password=False)
    return subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(ROOT / "database/alembic.ini"), *arguments],
        env=env, text=True, capture_output=True,
    )


@pytest.fixture(scope="session")
def database_factory():
    dsn = os.environ.get("TEST_DATABASE_URL")
    if not dsn:
        pytest.fail("Set TEST_DATABASE_URL to PostgreSQL with CREATEDB permission. Tests never use SQLite.")
    created = []
    with psycopg.connect(dsn, autocommit=True) as admin:
        def create():
            name = "yes4041_test_" + uuid4().hex
            admin.execute(sql.SQL("CREATE DATABASE {} TEMPLATE template0").format(sql.Identifier(name)))
            created.append(name)
            return make_conninfo(dsn, dbname=name)
        yield create
        for name in reversed(created):
            admin.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))


@pytest.fixture(scope="session")
def database_dsn(database_factory):
    dsn = database_factory()
    result = migrate(dsn, "upgrade", "head")
    assert result.returncode == 0, result.stderr
    return dsn


@pytest.fixture
def conn(database_dsn):
    with psycopg.connect(database_dsn) as connection:
        connection.execute("SELECT 1")  # outer transaction; nested helpers use savepoints
        yield connection
        connection.rollback()


@pytest.fixture
def base(conn):
    owner = conn.execute("INSERT INTO app_user(display_name) VALUES ('Researcher — fictional') RETURNING id").fetchone()[0]
    other = conn.execute("INSERT INTO app_user(display_name) VALUES ('Colleague — fictional') RETURNING id").fetchone()[0]
    equipment = conn.execute("INSERT INTO equipment(code,name) VALUES ('DEMO-MACHINE','Fictional machine') RETURNING id").fetchone()[0]
    template = conn.execute(
        "INSERT INTO form_template(equipment_id,created_by_user_id,name) VALUES (%s,%s,'Demo') RETURNING id",
        (equipment, owner),
    ).fetchone()[0]
    versions = [conn.execute(
        "INSERT INTO template_version(template_id,version_no,created_by_user_id,definition) "
        "VALUES (%s,%s,%s,'{\"schema_format\":1,\"title\":\"Demo\",\"nodes\":[]}'::jsonb) RETURNING id",
        (template, n, owner),
    ).fetchone()[0] for n in (1, 2)]
    submission = conn.execute(
        "INSERT INTO submission(template_version_id,created_by_user_id) VALUES (%s,%s) RETURNING id",
        (versions[0], owner),
    ).fetchone()[0]
    experiment = conn.execute("INSERT INTO experiment(created_by_user_id,title) VALUES (%s,'Demo') RETURNING id", (owner,)).fetchone()[0]
    return dict(owner=owner, other=other, equipment=equipment, template=template,
                version=versions[0], other_version=versions[1], submission=submission, experiment=experiment)


def finalize(conn, base, number=1, sample="ECHANTILLON-DEMO-001"):
    """Test fixture only; deliberately not the missing Flask business service."""
    conn.execute(
        "INSERT INTO submission_revision(submission_id,revision_no,created_by_user_id,project_reference,"
        "sample_reference,answers,equipment_snapshot,reference_snapshot) "
        "VALUES (%s,%s,%s,'PROJET-DEMO-001',%s,'{}','{}','{}')",
        (base["submission"], number, base["owner"], sample),
    )
    conn.execute(
        "UPDATE submission SET status='submitted',current_revision_no=%s,"
        "project_reference='PROJET-DEMO-001',sample_reference=%s, equipment_snapshot='{}',reference_snapshot='{}',"
        "submitted_at=coalesce(submitted_at,CURRENT_TIMESTAMP),lock_version=lock_version+1 WHERE id=%s",
        (number, sample, base["submission"]),
    )


def expect_error(conn, exception, statement, parameters=()):
    with pytest.raises(exception):
        with conn.transaction():
            conn.execute(statement, parameters)
            conn.execute("SET CONSTRAINTS ALL IMMEDIATE")
