# Modeling the YES 4041 database in Lucidchart

Use the existing physical schema as the source of truth. This guide does not generate or apply a migration, and Lucidchart import/layout has not been verified in the local database setup.

## Source documents

- [ERD.md](ERD.md): eight views containing every table and foreign key.
- [DATA_DICTIONARY.md](DATA_DICTIONARY.md): exact column types, nullability, keys, checks and lifecycle rules.
- [RELATIONSHIPS.md](RELATIONSHIPS.md): the complete FK01-FK30 register, including composite column pairs.
- [columns.csv](columns.csv): a reference export for reviewing the 141 columns, not a Lucidchart database-import file.
- [Initial SQL migration](../migrations/versions/0001_initial_model.sql): executable schema source, applied through Alembic only.

## Manual modeling workflow

1. Create eight pages or frames matching the views in the ERD. Views 1-6 contain all full table definitions; views 7-8 clarify author relationships using reference-only boxes.
2. Copy exact singular `snake_case` names, SQL types and nullability. Label PK, UK and FK membership, retaining the complete tuples for composite keys.
3. Draw one relationship per foreign-key constraint from the register. Composite FKs are single relationships; the same column may participate in several distinct constraints.
4. Use the documented physical cardinalities. A foreign key permits zero child rows; initial versions and nonempty export captures require additional backend transactions.
5. Mark the current-revision FK as initially deferred, step-position uniqueness as deferrable, and active resource-group position uniqueness as a partial unique index.
6. Keep JSONB fields as columns. Do not invent per-question tables or physical FKs for identifiers stored inside JSON.
7. Check 20 distinct tables, 141 columns, 20 primary keys, 12 unique constraints, one additional partial unique index and 30 distinct FKs. The four repeated author-view relationships provide context and do not increase the FK count.

`experiment_export_item.source_step_id` and `audit_event.object_id` are trace identifiers without foreign keys. Project/sample references are text context, not catalog links. Export files are represented by private storage keys, not another SQL table.

## Optional database import

If using Lucidchart's PostgreSQL import workflow, obtain the metadata query and required output format from that workflow. Run only its reviewed read-only metadata query against the migrated local database and import that result. Do not provide connection credentials in a diagram or upload the local `.env` file.

The project's [inspect_catalog.sql](../scripts/inspect_catalog.sql), schema catalog JSON and column CSV support repository documentation; they do not claim compatibility with Lucidchart's import format. Verify imported columns, composite keys, cardinalities and all 30 relationships against the source documents, then arrange the eight views manually as needed.

Later schema revisions require inspecting the fully migrated database. The PGlite baseline catalog helper executes only migration 0001. Keep [backend obligations](BACKEND_CONTRACT.md) separate from guarantees enforced by SQL, and record actual modeling/import verification in [VALIDATION.md](VALIDATION.md).
