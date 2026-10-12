# Validation status — 12 October 2026

## Windows local setup verified on 12 October 2026

Executed from `C:\Users\USER\Desktop\4041-1` on the `database` branch using Windows PowerShell 5.1.26100.9444. The starting working tree contained untracked `AGENTS.md`, `database/` and `.github/`; these supplied files were preserved without staging, committing, pushing or merging.

| Check | Observed result |
| --- | --- |
| Prerequisites | Git 2.51.0.windows.1; Python 3.12.10; Docker Desktop 4.40.0, client/server 28.0.4 with the Linux engine; Docker Compose v5.0.1. |
| Isolated Python environment | Created `database/.venv` with Python 3.12 and installed `database/requirements-test.txt` successfully. `pip check`: `No broken requirements found.` |
| Installed database/test tools | Alembic 1.20.0, SQLAlchemy 2.1.4, psycopg/psycopg-binary 3.3.6 and pytest 9.1.1. Pip also resolved Windows dependencies colorama 0.4.6 and tzdata 2026.5, which are not explicitly pinned in the supplied requirements. No requirement versions were changed. |
| Local credentials | `database/.env` was absent and was created once with a generated password and port 5433. Git ignore checks passed for `.env`, `.venv/` and `.pytest_cache/`. No credentials or complete connection URLs were printed. |
| Dedicated Docker service | No existing YES 4041 container/volume or listener on port 5433 was found. The supplied Compose service created `yes4041-postgres-1` and `yes4041_yes4041_data`; the container is healthy and bound to `127.0.0.1:5433`. Existing volumes and other projects were left intact. |
| Native server | PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2), Linux x86-64, from `postgres:16`. |
| Online migration | Existing Alembic upgrade succeeded; `current` returned `0001_initial_model (head)`. The SQL payload was not executed separately and no revision was stamped. |
| Live schema inventory | **20 domain tables, 141 domain columns and 30 foreign keys** in `public`, excluding Alembic bookkeeping. |
| Role vocabulary | Exactly `admin` and `researcher`; the application database still has zero user accounts. |
| Native PostgreSQL tests | **28 passed in 17.19s**, using the dedicated local server and the supplied pytest fixtures. |
| Test cleanup and preservation | Zero `yes4041_test_%` databases before and after the suite. The application database remains at revision `0001_initial_model`; the service remains healthy. The suite's downgrade/re-upgrade check ran only in its uniquely named disposable database. |
| Migration preservation | SHA-256 hashes of both initial migration files matched before and after execution. Neither the Python revision nor its SQL payload was changed. |

### Commands and verification scope

The following commands ran from the repository root. Connection environment variables were loaded privately from the ignored `.env` using the PowerShell block in [WINDOWS_SETUP.md](WINDOWS_SETUP.md), with `DATABASE_URL` targeting local `yes4041` and `TEST_DATABASE_URL` targeting local `postgres` on the same dedicated server. Password generation also followed that guide and ran only because `.env` was absent.

```powershell
git branch --show-current
git status --short
git --version
py -3.12 --version
docker version
docker compose version
py -3.12 -m venv database/.venv
& .\database\.venv\Scripts\python.exe -m pip install -r database/requirements-test.txt
& .\database\.venv\Scripts\python.exe -m pip check
git check-ignore database/.env database/.venv/ database/.pytest_cache/
docker compose --project-directory database --env-file database/.env -f database/compose.yaml up -d --wait
docker compose --project-directory database --env-file database/.env -f database/compose.yaml ps
& .\database\.venv\Scripts\python.exe -m alembic -c database/alembic.ini upgrade head
& .\database\.venv\Scripts\python.exe -m alembic -c database/alembic.ini current
& .\database\.venv\Scripts\python.exe -m pytest -c database/pytest.ini -q
git diff --check
```

Live catalog queries were passed with `-c` to `docker compose --project-directory database --env-file database/.env -f database/compose.yaml exec -T postgres psql -X -v ON_ERROR_STOP=1 -U yes4041_migrator -d yes4041`:

```sql
SELECT version();
SELECT version_num FROM public.alembic_version;
SELECT count(*) AS domain_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  AND table_name <> 'alembic_version';
SELECT count(*) AS domain_columns
FROM information_schema.columns c
JOIN information_schema.tables t
  USING (table_catalog, table_schema, table_name)
WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  AND c.table_name <> 'alembic_version';
SELECT count(*) AS foreign_keys FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
SELECT code FROM public.app_role ORDER BY code;
SELECT count(*) FROM pg_database WHERE datname LIKE 'yes4041_test_%';
SELECT count(*) FROM public.app_user;
```

The automation sandbox initially failed before launching PowerShell (`helper_unknown_error: setup refresh had errors`); approved host execution allowed the requested commands to run. No database setup or test failures required source changes. **No local database setup blockers remain.** Only this validation report was edited; local ignored credentials, the virtual environment and test/Python caches were created. `git diff --check` passed, but does not cover the pre-existing untracked foundation files. The existing migration and schema documentation were not regenerated.

## Local commit review on 12 October 2026

The branch was `database`; the configured fetch/push remote was `https://github.com/Mahmoud-El-Sayed10/4041.git`. The index and tracked working tree were initially unchanged, with the foundation files untracked. The existing Git identity was available. Review and staging were limited to `AGENTS.md`, `database/` respecting ignore rules, and `.github/workflows/database.yml`.

- Repaired missing `WINDOWS_SETUP.md` and `LUCIDCHART_GUIDE.md` references by supplying the two English guides; aligned the README's Windows-guide description. These were documentation changes only. The new guides were reviewed against the recorded setup and existing model; Lucidchart import was not executed.
- Reviewed the migration, test isolation, runtime grants, Compose configuration, dependency files, generators, schema references and CI configuration. No issue requiring a schema change was identified. Existing seed/fixture display text was retained as supplied, including French labels; changing applied seed labels would require a later data migration, not an edit to revision 0001.
- Confirmed both GitHub Actions commit pins resolve in their official repositories. The workflow uses Python 3.12 and a dedicated PostgreSQL 16 service with test-only credentials. No workflow was triggered.
- Reviewed all 36 staged files, including previously untracked content. Python/JSON parsing, local documentation links (with appendix links resolved from their generated destination), and catalog/field-note/CSV agreement passed. The staged catalog contains 20 tables, 141 columns and 30 foreign keys.
- Confirmed `.env`, `.venv/`, pytest/Python caches and their contents are ignored and absent from the index. No runtime files or credential files were staged; `.env.example` contains a placeholder. Targeted checks found no actual local password, recognized private-key blocks or common token patterns in staged content. Credential-like references were reviewed as placeholders, variable handling or isolated CI settings; this is not a comprehensive secret-scanner audit.
- `git diff --cached --check`, `git diff --cached --stat` and `git diff --cached --name-only` were reviewed. There were no whitespace errors. The applied migration and SQL payload match the setup-run hashes below in both the working tree and index.
- Reused the recorded **28 passed in 17.19s** native result. Executable source and CI configuration were unchanged during review, so the suite was not rerun. No database operations, volume changes, pushes or merges were performed during this review.

| Preserved migration file | SHA-256 |
| --- | --- |
| `0001_initial_model.py` | `726da28837ebc0b784ad10162f28c6857914adfcc4e9b70203a3f88abe671549` |
| `0001_initial_model.sql` | `3eda62117b4c27e8b45664c73000d8498ea2009b7fa6815f87b43b0a54dd978d` |

## Earlier foundation validation (retained evidence)

The checks below predate this Windows setup run and were not rerun as part of it.

| Check | Result | Scope |
| --- | --- | --- |
| Repository review | Passed | All five remote branches inspected; only README files existed. Work prepared on local `database`. |
| Initial SQL migration execution | Passed | PGlite 0.5.8, reporting PostgreSQL 18.3; 20 domain tables, 141 columns, 30 FKs. |
| Embedded SQL checks | 24 passed | Composite FKs, required context including whitespace/length checks, JSON object shape, unique role/identity/version/attachment keys, immutable history, fixed identities, pin preservation, reorder, partial catalog uniqueness, export retention/state/idempotency, audit and runtime-role restrictions. |
| Alembic offline SQL generation/execution | Passed | Upgrade and explicit destructive downgrade SQL executed in the embedded engine; all 20 domain tables removed on downgrade. Alembic's empty bookkeeping table remains. |
| Fictional demo data | Passed | One draft with project/sample context, three retained repeat instances and an attached experiment step loaded into the migrated schema. |
| Python syntax and test discovery | Passed | Migration, helper and test modules compile; 28 native PostgreSQL test cases are collected. Collection is not test execution. |
| Complete English ERD/dictionary agreement | Passed | Independently checked all 20 full entity definitions and 141 column types, key memberships and nullability against the schema catalog. Eight ER views cover all 30 distinct FKs; four author-view edges deliberately repeat existing relationships. |
| Dictionary constraint/index coverage | Passed | All 20 PKs, 12 UNIQUE constraints, 59 CHECK expressions and 50 indexes documented, including the additional partial unique index. Trigger and lifecycle descriptions reviewed against the SQL, with backend obligations stated separately. |
| Mermaid rendering | Passed | All eight ER diagrams rendered successfully with Mermaid 11 and were visually inspected. This verifies the supplied diagram syntax/layout, not Lucidchart import. |
| Documentation regeneration | Passed | Every column has a nonempty English definition. Regenerating the dictionary, relationship register and 141-row column CSV produced identical output; local documentation file links resolve. |

The embedded engine is a PostgreSQL WebAssembly build, not a running multi-client PostgreSQL service. The optimistic-update check uses sequential requests with the same expected version; it does **not** establish concurrent service correctness.

The documentation completion pass changed no database migration or schema. The SQL and integration-test results above are retained from the foundation validation; this pass added documentation coverage, independent review and rendering checks.

## Not yet verified

- **Multi-client races:** simultaneous saves/finalizations, version allocation, grant revocation during writes, catalog changes during snapshot capture and experiment/export coordination. These need actual service implementations and native PostgreSQL integration tests.
- **Flask/API authorization and JSON engine behavior.** There are no application routes, ORM mappings, rule evaluator, authentication provider integration or PDF renderer in this initial repository.
- **GitHub Actions execution.** The workflow is supplied but was not triggered in this local setup task. Docker startup and native PostgreSQL execution are now verified above; they are not evidence of a CI run.
- **Lucidchart import/layout.** The guide and relationship register are prepared; the user will model in Lucidchart. Its import procedure requires the output of its own metadata query.

The earlier foundation delivery reported successful GitHub read access and unavailable write credentials. This Windows setup did not check GitHub access or attempt publication. No changes were pushed or merged; integration review and CI remain separate from the successful local database setup.
