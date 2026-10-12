# YES 4041 — repository guidance

## Project and branch context

- This is the university YES 4041 laboratory forms project. The agreed application stack is React, Flask and PostgreSQL with JSONB. Use English for code, documentation and communication.
- Workstreams are `frontend`, `backend` and `database`; integration is through `development`, then a tested release to `main`. For database work, verify that the active branch is `database` before making changes. Preserve unrelated work.
- The initial database implementation already exists. Review and apply it; do not regenerate a different initial schema from the ERD.

## Read before database work

1. `database/README.md`
2. `database/docs/ERD.md` and `database/docs/DATA_DICTIONARY.md`
3. `database/docs/BACKEND_CONTRACT.md`
4. `database/docs/VALIDATION.md`
5. `database/docs/WINDOWS_SETUP.md` for the Windows/PowerShell workflow

The executable baseline is `database/migrations/versions/0001_initial_model.py` with its versioned SQL payload. It defines 20 domain tables, 141 columns and 30 foreign keys. Alembic's bookkeeping table is separate.

## Database conventions

- PostgreSQL 16 and Python 3.12 are the initial local/CI baseline. Docker Compose defines the local database. Alembic is the only migration history; coordinate it with the Flask workstream.
- Keep an applied/shared migration unchanged. Use a new revision for subsequent schema changes; keep the ERD, dictionary and backend contract aligned.
- Preserve template versioning, immutable finalized revisions, snapshots, explicit experiment pins, named sharing and retained exports. Dynamic form fields live in JSONB; do not invent a table per template or question.
- Admins administer templates/catalogs; researcher access uses ownership and explicit grants. SQL constraints do not replace Flask authorization or JSON validation. Follow the backend contract.
- Use a migration owner for setup and tests. The future Flask runtime needs a separate non-owner login with `database/ops/application_privileges.sql`; never hand migration-owner credentials to an end user.

## Local execution and verification

- Use the repository root as the working directory. On Windows, invoke `database\.venv\Scripts\python.exe` explicitly; changing PowerShell execution policy is unnecessary.
- Keep `.env` and connection credentials local and ignored. Reuse existing credentials and Docker volumes; do not print passwords or complete connection URLs into logs or reports.
- Scope Docker commands to this project's Compose file. Preserve other projects' containers, volumes and database instances.
- Run migrations through Alembic only. Do not also execute the raw initial SQL against the same database.
- Run the supplied native PostgreSQL pytest suite against the dedicated local test connection. It creates and drops only uniquely named test databases. Never aim it at a shared or production server.
- Record commands, observed results and any remaining blocker. Do not claim Windows, Docker, native PostgreSQL or CI checks passed unless they actually ran successfully in that environment.
- Proceed with ordinary reversible setup and fixes within the requested task. Preserve data; do not reset a database, remove a data volume or perform a destructive downgrade without specific authorization. Follow the user's requested scope for commits, publishing and merges.

## Documentation maintenance

`database/scripts/render_catalog.py` generates the dictionary, relationship register and column CSV from `schema_catalog.json`, `dictionary_notes.json`, the SQL migration and `dictionary_appendix.md`. Maintain these sources before regeneration. The baseline catalog helper executes only migration 0001; later revisions require inspection of the fully migrated database. Do not add a new migration just to rewrite documentation.
