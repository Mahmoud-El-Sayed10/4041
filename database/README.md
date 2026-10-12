# YES 4041 — database workstream

First physical implementation of the 12 October 2026 data-model baseline: **20 domain tables, 141 columns, 30 foreign keys**, PostgreSQL with JSONB and Alembic migrations. The repository initially contained README files only; there was no application source or existing migration to reconcile.

Start modeling with [LUCIDCHART_GUIDE.md](docs/LUCIDCHART_GUIDE.md). The [eight ER views](docs/ERD.md), [full column dictionary](docs/DATA_DICTIONARY.md) and [FK register](docs/RELATIONSHIPS.md) describe the same schema, entirely in English. Together they cover all 20 tables, 141 columns and 30 foreign keys, including author and sharing links.

## What is implemented

- Versioned machine templates; mutable drafts and immutable finalized revisions.
- Required project/sample context on finalized submissions, preserved in each revision.
- Experiments with planned steps, optional attached responses and explicit revision pins.
- Users with cumulative admin/researcher roles, external identity mappings and separate read/edit grants.
- Administered resources, groups and units; historical snapshots stored as JSONB.
- Immutable export capture metadata/items, PDF attempt status and append-only audit metadata.
- Relational/check constraints, targeted indexes, history/identity protection triggers and role vocabulary seeds.

The migration is [0001_initial_model.py](migrations/versions/0001_initial_model.py), with its versioned [SQL payload](migrations/versions/0001_initial_model.sql). This is the schema source of truth. Once applied/shared, change it through a **new** revision. Do not run both the raw SQL and Alembic against the same database.

The repository has no Flask routes or ORM models yet. JSON validation, user authorization and the multi-row service transactions are still to implement; their exact handoff is [BACKEND_CONTRACT.md](docs/BACKEND_CONTRACT.md).

## Branch workflow

Develop database changes on `database`, frontend changes on `frontend`, and backend changes on `backend`. Bring each workstream into `development` through a reviewed PR and test the combined application there. Release the validated integration into `main`.

This change adds `database/` and a database CI workflow. It does not merge any branch. Before merging, coordinate one Alembic migration chain with the backend team; do not start a second independent migration history.

## Local setup

For a Windows checkout, follow [WINDOWS_SETUP.md](docs/WINDOWS_SETUP.md). It covers prerequisites, PowerShell commands, local credentials, migration execution and native tests.

Python 3.12, Docker Compose and PostgreSQL 16 are the initial development baseline. The Docker major tag receives patch updates; a deployment image digest must be selected for the eventual hosting environment. Python dependency versions are pinned in the requirements files. No hosting or authentication provider is assumed.

From the repository root:

```bash
python -m venv database/.venv
source database/.venv/bin/activate
python -m pip install -r database/requirements-test.txt
cp database/.env.example database/.env
```

Set your local password in `database/.env`, then:

```bash
docker compose --project-directory database --env-file database/.env -f database/compose.yaml up -d --wait
```

Set `DATABASE_URL` to your **migration owner** connection, for example the following shape (replace the password, URL-encoding special characters):

```bash
export DATABASE_URL='postgresql://yes4041_migrator:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5433/yes4041'
python -m alembic -c database/alembic.ini upgrade head
python -m alembic -c database/alembic.ini current
```

On Windows, invoke `database\.venv\Scripts\python.exe` from the repository root and use PowerShell environment-variable syntax as shown in [WINDOWS_SETUP.md](docs/WINDOWS_SETUP.md); activation is unnecessary. The Alembic config resolves paths relative to itself.

The migration creates only the `admin` and `researcher` role vocabulary, **no accounts or credentials**. For fictional development data, optionally run once against an empty migrated development database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/examples/demo.sql
```

The example includes one machine, one versioned template, three retained repeat instances in a draft, and an experiment step. It is not a client protocol. It creates no login/authentication bypass.

## Database runtime permissions

Use a separate migration-owner account and application account. The local Docker owner is intentionally privileged for migrations/tests and **must not be the Flask runtime account**.

Provision a dedicated non-owner, non-superuser login through your local administration method; give it no membership in the migration-owner role. Then, as the schema owner:

```bash
psql "$DATABASE_URL" -v app_role=yes4041_app -f database/ops/application_privileges.sql
```

That script grants the existing role named by `app_role` only the required table operations. No DDL, TRUNCATE, history mutation or Alembic table access is granted. This is a shared server account, **not end-user row-level security**: every Flask operation still checks the actual user's identity, active state, roles, ownership and current grants.

## Validation

The [validation report](docs/VALIDATION.md) distinguishes completed local checks from native integration tests.

Run the native PostgreSQL suite using a disposable server and a test login with CREATEDB permission. The tests create uniquely named test databases and remove only those databases; they do not reuse or clear your application schema.

```bash
export TEST_DATABASE_URL='postgresql://yes4041_migrator:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5433/postgres'
python -m pytest -c database/pytest.ini -q
```

The [GitHub Actions workflow](../.github/workflows/database.yml) provisions PostgreSQL 16 and runs this suite for changes to the database workstream. A workflow file is not evidence that CI has already run.

A supplementary single-connection SQL check is available without a native server:

```bash
cd database
npm ci
npm test
```

PGlite is a **test-only** embedded PostgreSQL build; it is not a change to the Flask/PostgreSQL application stack and cannot establish real multi-client behavior. Node is not required to run migrations or the native pytest suite.

## Migration and modeling maintenance

For reviewable SQL without connecting to a database:

```bash
DATABASE_URL='postgresql://localhost/unused' python -m alembic -c database/alembic.ini upgrade head --sql
```

The first migration's downgrade drops all project tables and data. It refuses by default. Only in an expendable development/test database, use the explicit Alembic option `-x allow_destructive_downgrade=true` before `downgrade base`. For retained data, use a reviewed forward migration and backup/restore plan.

The dictionary combines checked SQL facts with the English definitions in [dictionary_notes.json](docs/dictionary_notes.json) and the state/JSON guidance in [dictionary_appendix.md](scripts/dictionary_appendix.md). The renderer rejects missing or extra field definitions. Edit these source files before regenerating the dictionary; edits made only to generated output will be overwritten.

To regenerate the initial schema catalog and derived dictionary/CSV after editing an **unapplied** baseline:

```bash
cd database
npm test -- --catalog
python scripts/render_catalog.py
```

The initial PGlite check loads the initial SQL payload only. For later revisions, derive documentation from a fully migrated native database using [inspect_catalog.sql](scripts/inspect_catalog.sql); do not silently regenerate a future diagram from the old baseline. `columns.csv` is a reference export; use Lucidchart's own metadata query results for SQL import.

## Physical implementation choices in this change

These make the existing design concrete; they do not replace the approved business rules.

| Choice | Reason |
| --- | --- |
| Singular `snake_case` SQL names, in the `public` schema of a dedicated project database | One consistent naming contract for Lucidchart, SQL and Flask. |
| PostgreSQL 16 development baseline; Python 3.12 | Reproducible starting environment, independent of the still-undecided deployment host. |
| UUID defaults through built-in `gen_random_uuid()` | No extension or sequential client-managed identifiers required. |
| `text` plus named CHECKs for workflow values | Explicit accepted states, readily changed by migrations. |
| Current-revision FK deferred until commit | Create a revision and update the current submission atomically. |
| Step position uniqueness deferrable; active group position uniqueness partial | Permit atomic step reordering and retained inactive catalog links. |
| Schema-owned triggers plus limited runtime grants | Protect immutable historical rows and fixed identity links. |
| Versioned raw SQL within Alembic | Readable PostgreSQL constraints without inventing backend ORM classes before that workstream exists. |
| Audit action/type vocabulary in CHECK constraints | Define the initial names the backend must use; adding new event types requires a migration. |

Technical references: [PostgreSQL constraints](https://www.postgresql.org/docs/16/ddl-constraints.html), [Alembic migration environment](https://alembic.sqlalchemy.org/en/latest/tutorial.html), [Psycopg installation](https://www.psycopg.org/psycopg3/docs/basic/install.html), [PGlite API](https://pglite.dev/docs/api), consulted 12 October 2026.
