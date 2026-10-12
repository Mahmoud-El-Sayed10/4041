# Complete data dictionary — YES 4041

**Version: 12 October 2026 · English · physical schema `0001_initial_model`.**

This dictionary defines all **20 domain tables and 141 columns**, with **30 foreign keys, 20 primary keys, 12 UNIQUE constraints, 59 CHECK constraints and 50 indexes**. The indexes comprise 20 PK indexes, 12 UNIQUE-constraint indexes, one partial unique index and 17 additional lookup indexes. Alembic's bookkeeping table is outside the domain model.

Companions: [complete ER diagrams](ERD.md), [FK register](RELATIONSHIPS.md), [Lucidchart guide](LUCIDCHART_GUIDE.md), [backend contract](BACKEND_CONTRACT.md). The [SQL migration](../migrations/versions/0001_initial_model.sql) is executable; this document does not imply that backend endpoints or permissions have been implemented.

## Reading this dictionary

- Names are exact SQL identifiers in the `public` schema. Types use PostgreSQL names: `uuid`, `text`, `boolean`, `integer`, `jsonb`, `timestamptz`.
- **NULL = No** means NOT NULL. **NULL = Yes** means nullable at the column level; a CHECK may still require a value in a particular state.
- **PK/UK/FK membership** may identify one component of a composite key. Read the named tuples below each table; a composite UK does not make each column unique by itself.
- **Default = —** means no explicit database default. Missing required values fail; nullable columns may be NULL. Defaults run on INSERT only. `CURRENT_TIMESTAMP` is the transaction timestamp, not an automatic update mechanism.
- **SQL guarantees** are implemented by constraints/triggers. **Backend rules** are required service behavior, including authorization and validation; SQL does not enforce them all.
- All FKs use MATCH SIMPLE and ON UPDATE/DELETE NO ACTION. A NULL component can leave an optional composite FK unmatched. No historical cascade deletion is configured.
- SQL checks JSONB object shape only. `{}` is an object; JSON `null`, arrays and scalars are not. Nullable snapshot columns may contain SQL NULL, which differs from JSON `null`.
- `timestamptz` represents an instant. APIs should exchange timestamps with an explicit offset; this column does not preserve a separate original time-zone name.

## Table index

| No. | Table | Columns | Purpose |
| --- | --- | --- | --- |
| 01 | [app_user](#01-app_user) | 5 | Stable local identity; disabling a user preserves historical authorship. |
| 02 | [auth_identity](#02-auth_identity) | 5 | Verified external identity attached to a local user; issuer + subject identifies one account. |
| 03 | [app_role](#03-app_role) | 3 | Closed initial role vocabulary: admin and researcher. These are application roles, not PostgreSQL login roles. |
| 04 | [app_user_role](#04-app_user_role) | 2 | Many-to-many assignment. One person may hold both roles. |
| 05 | [equipment](#05-equipment) | 8 | Machine catalog. Deactivate instead of deleting; its code and identity are stable. |
| 06 | [form_template](#06-form_template) | 7 | Reusable template identity attached permanently to one machine. Current name follows the latest version title. |
| 07 | [template_version](#07-template_version) | 6 | Immutable definition including title, instructions, fields, options and rules. Version numbers are local to a template. |
| 08 | [submission](#08-submission) | 15 | One research execution; mutable draft or synchronized current finalized revision. Creator is the owner. |
| 09 | [submission_revision](#09-submission_revision) | 11 | Immutable finalized answers and context. Revision numbers are local to a submission. |
| 10 | [experiment](#10-experiment) | 8 | An ordered composition owned by its creator. Empty or incomplete compositions can be saved. |
| 11 | [experiment_step](#11-experiment_step) | 6 | Planned template version, optionally attached to a submission and a selected finalized revision. |
| 12 | [reference_resource](#12-reference_resource) | 9 | Administered reference values, initially materials. Stable kind/code; labels are snapshotted on finalization. |
| 13 | [resource_group](#13-resource_group) | 7 | Reusable group restricting available reference values. |
| 14 | [resource_group_member](#14-resource_group_member) | 4 | Membership and display order. A removed member becomes inactive; the link is retained. |
| 15 | [unit](#15-unit) | 9 | Unit vocabulary. Code and dimension are stable; no conversion table is assumed. |
| 16 | [submission_grant](#16-submission_grant) | 6 | Explicit read/edit grant to one named user; revocation retains the current grant row. |
| 17 | [experiment_grant](#17-experiment_grant) | 6 | Explicit read/edit grant for an experiment; it grants no implicit access to underlying submissions. |
| 18 | [experiment_export](#18-experiment_export) | 12 | One immutable capture and PDF attempt, with per-creator request idempotency. |
| 19 | [experiment_export_item](#19-experiment_export_item) | 5 | Ordered reference to an exact revision. Source step ID is historical trace, not a foreign key. |
| 20 | [audit_event](#20-audit_event) | 7 | Append-only action metadata. Object ID is a polymorphic trace; no scientific answers or secrets belong here. |

The state, JSON-content and enforcement appendices after table 20 are part of this dictionary.

## 01. app_user

Stable local identity; disabling a user preserves historical authorship.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `display_name` | `text` | No | — | — | Current displayed name of the person; not unique and not an authentication identifier. Exports capture the displayed name at export time. |
| `active` | `boolean` | No | — | `true` | Whether the local account may use the application. The backend checks this on every request; deactivation preserves authorship. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |
| `updated_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Timestamp of the latest successful mutation. The backend must set it on updates; there is no automatic update trigger. |

### Keys and foreign keys

- `app_user_pkey`: `PRIMARY KEY (id)`.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `app_user_display_name_check` | `CHECK ((length(btrim(display_name)) > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `app_user_pkey` | Primary-key enforcement | `btree (id)` |

### Lifecycle and write rules

**SQL:** changes to `id`, `created_at` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.

**Backend rules:**

- Enforce active-account checks on every request; preserve at least one active administrator during role/account changes.

## 02. auth_identity

Verified external identity attached to a local user; issuer + subject identifies one account.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `user_id` | `uuid` | No | FK | — | Local account associated with this verified external identity. This association cannot be reassigned by an UPDATE. |
| `issuer` | `text` | No | UK | — | Identity-provider issuer identifier. It is paired with subject for uniqueness; no particular OIDC provider is configured by this schema. |
| `subject` | `text` | No | UK | — | Stable subject identifier issued by that provider. Never use display name or email alone to match a local account. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |

### Keys and foreign keys

- `auth_identity_pkey`: `PRIMARY KEY (id)`.
- `uq_auth_identity_issuer_subject`: `UNIQUE (issuer, subject)`.
- **FK04** `auth_identity_user_id_fkey`: `auth_identity.(user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `auth_identity_issuer_check` | `CHECK ((length(btrim(issuer)) > 0))` |
| `auth_identity_subject_check` | `CHECK ((length(btrim(subject)) > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `auth_identity_pkey` | Primary-key enforcement | `btree (id)` |
| `ix_auth_identity_user` | Lookup/order support | `btree (user_id)` |
| `uq_auth_identity_issuer_subject` | Unique-constraint enforcement | `btree (issuer, subject)` |

### Lifecycle and write rules

**SQL:** changes to `id`, `user_id`, `issuer`, `subject`, `created_at` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.

**Backend rules:**

- Attach only identities verified by the configured provider. Provider configuration and authentication are outside this schema; do not link accounts by email alone.

## 03. app_role

Closed initial role vocabulary: admin and researcher. These are application roles, not PostgreSQL login roles.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `code` | `text` | No | UK | — | Application role code: admin or researcher. This is not a PostgreSQL login role; the same person may have both. |
| `label` | `text` | No | — | — | Display label for the application role; authorization uses code, not this label. |

### Keys and foreign keys

- `app_role_code_key`: `UNIQUE (code)`.
- `app_role_pkey`: `PRIMARY KEY (id)`.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `app_role_code_check` | `CHECK ((code = ANY (ARRAY['admin'::text, 'researcher'::text])))` |
| `app_role_label_check` | `CHECK ((length(btrim(label)) > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `app_role_code_key` | Unique-constraint enforcement | `btree (code)` |
| `app_role_pkey` | Primary-key enforcement | `btree (id)` |

### Lifecycle and write rules

**SQL:** changes to `id`, `code` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.

**Backend rules:**

- Only the seeded admin/researcher codes are allowed. Adding a new application role requires a reviewed migration. Labels do not define permissions.

## 04. app_user_role

Many-to-many assignment. One person may hold both roles.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `user_id` | `uuid` | No | PK, FK | — | User receiving the application role; first component of the composite primary key. |
| `role_id` | `uuid` | No | PK, FK | — | Assigned application role; second component of the composite primary key. |

### Keys and foreign keys

- `app_user_role_pkey`: `PRIMARY KEY (user_id, role_id)`.
- **FK01** `app_user_role_role_id_fkey`: `app_user_role.(role_id)` → `app_role.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK02** `app_user_role_user_id_fkey`: `app_user_role.(user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

### SQL CHECK constraints

No additional CHECK constraints; types, required values, keys and FKs still apply.

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `app_user_role_pkey` | Primary-key enforcement | `btree (user_id, role_id)` |
| `ix_app_user_role_role` | Lookup/order support | `btree (role_id)` |

### Lifecycle and write rules

**Deletion:** row DELETE is permitted by this schema; the backend must authorize and coordinate it. No linked historical row is cascade-deleted.

**Backend rules:**

- Authorize every grant/revocation as an administrative action and record it in audit_event in the same transaction. A user may have no roles, one role or both roles.

## 05. equipment

Machine catalog. Deactivate instead of deleting; its code and identity are stable.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `code` | `text` | No | UK | — | Stable catalog code. The key definition below specifies its uniqueness scope; updates to this code are forbidden by a trigger. |
| `name` | `text` | No | — | — | Current machine name. The finalized equipment snapshot preserves its historical displayed name. |
| `description` | `text` | Yes | — | — | Optional descriptive text. SQL imposes no length limit on this column. |
| `active` | `boolean` | No | — | `true` | Whether this catalog entry is available for new selections. Deactivation retains the row and existing historical references; eligibility is checked by the backend. |
| `lock_version` | `integer` | No | — | `1` | Positive optimistic-concurrency counter. The backend compares the expected value and increments it on successful mutations; SQL only checks positivity. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |
| `updated_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Timestamp of the latest successful mutation. The backend must set it on updates; there is no automatic update trigger. |

### Keys and foreign keys

- `equipment_code_key`: `UNIQUE (code)`.
- `equipment_pkey`: `PRIMARY KEY (id)`.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `equipment_code_check` | `CHECK ((length(btrim(code)) > 0))` |
| `equipment_lock_version_check` | `CHECK ((lock_version > 0))` |
| `equipment_name_check` | `CHECK ((length(btrim(name)) > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `equipment_code_key` | Unique-constraint enforcement | `btree (code)` |
| `equipment_pkey` | Primary-key enforcement | `btree (id)` |

### Lifecycle and write rules

**SQL:** changes to `id`, `code`, `created_at` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.

**Backend rules:**

- Require an active machine for a new response; existing saved drafts may continue with a deactivation warning. Serialize metadata changes with snapshot capture.

## 06. form_template

Reusable template identity attached permanently to one machine. Current name follows the latest version title.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `equipment_id` | `uuid` | No | FK | — | The single machine to which this reusable template belongs. The association is fixed after creation. |
| `created_by_user_id` | `uuid` | No | FK | — | User who originally created the template. Template-management authorization requires the admin role in the backend. |
| `name` | `text` | No | — | — | Current template catalog name, synchronized by the backend with the newest definition title. Historical rendering uses the versioned title. |
| `lock_version` | `integer` | No | — | `1` | Positive optimistic-concurrency counter. The backend compares the expected value and increments it on successful mutations; SQL only checks positivity. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |
| `archived_at` | `timestamptz` | Yes | — | — | Template archive timestamp. NULL means available, subject to the machine being active. Existing submissions retain their original version. |

### Keys and foreign keys

- `form_template_pkey`: `PRIMARY KEY (id)`.
- **FK17** `form_template_created_by_user_id_fkey`: `form_template.(created_by_user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK18** `form_template_equipment_id_fkey`: `form_template.(equipment_id)` → `equipment.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `form_template_lock_version_check` | `CHECK ((lock_version > 0))` |
| `form_template_name_check` | `CHECK ((length(btrim(name)) > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `form_template_pkey` | Primary-key enforcement | `btree (id)` |
| `ix_form_template_creator` | Lookup/order support | `btree (created_by_user_id)` |
| `ix_form_template_equipment` | Lookup/order support | `btree (equipment_id)` |

### Lifecycle and write rules

**SQL:** changes to `id`, `equipment_id`, `created_by_user_id`, `created_at` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.

**Backend rules:**

- Create the template and its first version in one transaction. SQL permits zero child versions; the service must enforce the initial version.
- Create/save versions only for authorized admins. Synchronize name with the newest definition title and check the expected lock_version.

## 07. template_version

Immutable definition including title, instructions, fields, options and rules. Version numbers are local to a template.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `template_id` | `uuid` | No | UK, FK | — | Reusable template whose definition is frozen by this row. |
| `version_no` | `integer` | No | UK | — | Positive version number within one template; not globally unique. The backend allocates consecutive numbers under the template lock. |
| `created_by_user_id` | `uuid` | No | FK | — | Author of this version. May differ from the original template creator. |
| `definition` | `jsonb` | No | — | — | Complete immutable JSON object containing schema format, title, instructions, ordered field nodes, options and rules. SQL checks object shape only. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |

### Keys and foreign keys

- `template_version_pkey`: `PRIMARY KEY (id)`.
- `uq_template_version_number`: `UNIQUE (template_id, version_no)`.
- **FK29** `template_version_created_by_user_id_fkey`: `template_version.(created_by_user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK30** `template_version_template_id_fkey`: `template_version.(template_id)` → `form_template.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `template_version_definition_check` | `CHECK ((jsonb_typeof(definition) = 'object'::text))` |
| `template_version_version_no_check` | `CHECK ((version_no > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `ix_template_version_creator` | Lookup/order support | `btree (created_by_user_id)` |
| `template_version_pkey` | Primary-key enforcement | `btree (id)` |
| `uq_template_version_number` | Unique-constraint enforcement | `btree (template_id, version_no)` |

### Lifecycle and write rules

**SQL:** immutable after INSERT. Every UPDATE and DELETE is rejected, including a no-op UPDATE.

**Backend rules:**

- Validate all nodes, field IDs, types, options, rule dependencies and reference choices. Allocate version numbers consecutively under the template lock; SQL guarantees positivity and uniqueness, not sequence.

## 08. submission

One research execution; mutable draft or synchronized current finalized revision. Creator is the owner.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK, UK, FK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `template_version_id` | `uuid` | No | UK, FK | — | Exact template version used for this execution; fixed for drafts, finalization and every later correction. |
| `created_by_user_id` | `uuid` | No | FK | — | Original researcher who created this execution and owns it. Ownership is immutable. |
| `status` | `text` | No | — | `'draft'::text` | draft or submitted. Finalization requires a current revision, project/sample context, snapshots and first-submission timestamp. |
| `lock_version` | `integer` | No | — | `1` | Positive optimistic-concurrency counter. The backend compares the expected value and increments it on successful mutations; SQL only checks positivity. |
| `current_revision_no` | `integer` | Yes | FK | — | NULL for a draft; positive current finalized revision number for submitted. Together with this row id, references a revision of this same submission. |
| `project_reference` | `text` | Yes | — | — | System project context: optional in draft, required when submitted; 1–200 characters when present, without leading/trailing whitespace. Not a catalog FK or unique key. |
| `sample_reference` | `text` | Yes | — | — | System sample context: optional in draft, required when submitted; 1–200 characters when present, without leading/trailing whitespace. Does not define ownership or inventory membership. |
| `answers` | `jsonb` | No | — | `'{}'::jsonb` | Current JSON answer object. Drafts retain saved hidden fields/inactive repeat instances; submitted content is the active projection synchronized with the current revision by the backend. |
| `equipment_snapshot` | `jsonb` | Yes | — | — | Historical equipment context JSON object. SQL permits NULL or an object in draft, but requires an object when submitted. Snapshot completeness is a backend rule. |
| `reference_snapshot` | `jsonb` | Yes | — | — | Historical resource/unit context JSON object. Optional in draft, required when submitted; an empty object is valid when no references are used. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |
| `updated_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Timestamp of the latest successful mutation. The backend must set it on updates; there is no automatic update trigger. |
| `submitted_at` | `timestamptz` | Yes | — | — | NULL for a draft; time of first finalization for a submitted execution. A trigger preserves it through all later corrections. |
| `archived_at` | `timestamptz` | Yes | — | — | Archive timestamp; NULL means unarchived. The backend controls archive/restore and blocks ordinary edits while archived. |

### Keys and foreign keys

- `submission_pkey`: `PRIMARY KEY (id)`.
- `uq_submission_id_template_version`: `UNIQUE (id, template_version_id)`.
- **FK21** `fk_submission_current_revision`: `submission.(id, current_revision_no)` → `submission_revision.(submission_id, revision_no)`. Child → parent: **0..1**; parent → children: **0..1**. DEFERRABLE INITIALLY DEFERRED.
- **FK22** `submission_created_by_user_id_fkey`: `submission.(created_by_user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK23** `submission_template_version_id_fkey`: `submission.(template_version_id)` → `template_version.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `ck_submission_project_reference` | `CHECK (((project_reference IS NULL) OR (((char_length(project_reference) >= 1) AND (char_length(project_reference) <= 200)) AND (project_reference !~ '^[[:space:]]\|[[:space:]]$'::text))))` |
| `ck_submission_sample_reference` | `CHECK (((sample_reference IS NULL) OR (((char_length(sample_reference) >= 1) AND (char_length(sample_reference) <= 200)) AND (sample_reference !~ '^[[:space:]]\|[[:space:]]$'::text))))` |
| `ck_submission_state` | `CHECK ((((status = 'draft'::text) AND (current_revision_no IS NULL) AND (submitted_at IS NULL)) OR ((status = 'submitted'::text) AND (current_revision_no IS NOT NULL) AND (submitted_at IS NOT NULL) AND (project_reference IS NOT NULL) AND (sample_reference IS NOT NULL) AND (equipment_snapshot IS NOT NULL) AND (reference_snapshot IS NOT NULL))))` |
| `submission_answers_check` | `CHECK ((jsonb_typeof(answers) = 'object'::text))` |
| `submission_current_revision_no_check` | `CHECK ((current_revision_no > 0))` |
| `submission_equipment_snapshot_check` | `CHECK ((jsonb_typeof(equipment_snapshot) = 'object'::text))` |
| `submission_lock_version_check` | `CHECK ((lock_version > 0))` |
| `submission_reference_snapshot_check` | `CHECK ((jsonb_typeof(reference_snapshot) = 'object'::text))` |
| `submission_status_check` | `CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text])))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `ix_submission_creator_created` | Lookup/order support | `btree (created_by_user_id, created_at DESC)` |
| `ix_submission_template_version` | Lookup/order support | `btree (template_version_id)` |
| `submission_pkey` | Primary-key enforcement | `btree (id)` |
| `uq_submission_id_template_version` | Unique-constraint enforcement | `btree (id, template_version_id)` |

### Lifecycle and write rules

**SQL:** changes to `id`, `template_version_id`, `created_by_user_id`, `created_at` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.
**SQL transition protection:** once submitted, status cannot return to draft, original `submitted_at` cannot change and `current_revision_no` cannot decrease. Changing answers, snapshots or project/sample context requires a different revision number. SQL does not ensure a +1 step or equality with the referenced revision.

**Backend rules:**

- Merge explicit draft changes without erasing omitted hidden values. Finalization computes the active projection and validates all system context.
- Insert each new revision and synchronize current answers, snapshots and project/sample context atomically. Require exactly the next revision number; SQL does not prove current-copy equality or +1 progression.
- A draft has zero finalized revisions by service policy; SQL does not prohibit a raw INSERT into submission_revision while its parent is still draft.
- Check active researcher, ownership/edit access, archive state and expected lock_version with the mutation. Archives do not revoke otherwise authorized history reads.

## 09. submission_revision

Immutable finalized answers and context. Revision numbers are local to a submission.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `submission_id` | `uuid` | No | UK, FK | — | Execution whose finalized state is captured. The pair with revision_no is the natural revision key. |
| `revision_no` | `integer` | No | UK | — | Positive revision number within that submission. Revision 1 is the first finalization; later consecutive numbers are allocated by the backend. |
| `created_by_user_id` | `uuid` | No | FK | — | Researcher who finalized this revision, including an authorized editor; may differ from the execution owner. |
| `correction_reason` | `text` | Yes | — | — | Optional explanation of a correction, at most 1,000 characters. SQL does not require it or restrict it to revisions after the first. |
| `project_reference` | `text` | No | — | — | Immutable project context for this revision; required, 1–200 characters, no leading/trailing whitespace. |
| `sample_reference` | `text` | No | — | — | Immutable sample context for this revision; required, 1–200 characters, no leading/trailing whitespace. |
| `answers` | `jsonb` | No | — | — | Complete immutable active answer projection at this finalization. Old revisions are not modified by later corrections. |
| `equipment_snapshot` | `jsonb` | No | — | — | Immutable equipment identity/code/name context; required JSON object. Corrections retain the base equipment context by backend policy. |
| `reference_snapshot` | `jsonb` | No | — | — | Immutable resource/unit contexts used by active answers. Required JSON object; may be empty when no resource/unit is used. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |

### Keys and foreign keys

- `submission_revision_pkey`: `PRIMARY KEY (id)`.
- `uq_submission_revision_number`: `UNIQUE (submission_id, revision_no)`.
- **FK27** `submission_revision_created_by_user_id_fkey`: `submission_revision.(created_by_user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK28** `submission_revision_submission_id_fkey`: `submission_revision.(submission_id)` → `submission.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `ck_revision_project_reference` | `CHECK ((((char_length(project_reference) >= 1) AND (char_length(project_reference) <= 200)) AND (project_reference !~ '^[[:space:]]\|[[:space:]]$'::text)))` |
| `ck_revision_sample_reference` | `CHECK ((((char_length(sample_reference) >= 1) AND (char_length(sample_reference) <= 200)) AND (sample_reference !~ '^[[:space:]]\|[[:space:]]$'::text)))` |
| `submission_revision_answers_check` | `CHECK ((jsonb_typeof(answers) = 'object'::text))` |
| `submission_revision_correction_reason_check` | `CHECK ((char_length(correction_reason) <= 1000))` |
| `submission_revision_equipment_snapshot_check` | `CHECK ((jsonb_typeof(equipment_snapshot) = 'object'::text))` |
| `submission_revision_reference_snapshot_check` | `CHECK ((jsonb_typeof(reference_snapshot) = 'object'::text))` |
| `submission_revision_revision_no_check` | `CHECK ((revision_no > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `ix_submission_revision_creator` | Lookup/order support | `btree (created_by_user_id)` |
| `submission_revision_pkey` | Primary-key enforcement | `btree (id)` |
| `uq_submission_revision_number` | Unique-constraint enforcement | `btree (submission_id, revision_no)` |

### Lifecycle and write rules

**SQL:** immutable after INSERT. Every UPDATE and DELETE is rejected, including a no-op UPDATE.

**Backend rules:**

- Create revision 1 at first finalization, then append one full revision per accepted correction. Validate full active content and authoritative snapshots before insertion.
- Retain the equipment context on correction; retain known per-ID reference contexts from the expected current base and capture newly used IDs. Never replace old snapshots with live catalog labels.

## 10. experiment

An ordered composition owned by its creator. Empty or incomplete compositions can be saved.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `created_by_user_id` | `uuid` | No | FK | — | Original researcher who created and owns the experiment; ownership is immutable. |
| `title` | `text` | No | — | — | Current experiment title. Each export captures the title that existed when that export was requested. |
| `description` | `text` | Yes | — | — | Optional descriptive text. SQL imposes no length limit on this column. |
| `lock_version` | `integer` | No | — | `1` | Positive optimistic-concurrency counter. The backend compares the expected value and increments it on successful mutations; SQL only checks positivity. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |
| `updated_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Timestamp of the latest successful mutation. The backend must set it on updates; there is no automatic update trigger. |
| `archived_at` | `timestamptz` | Yes | — | — | Archive timestamp; NULL means unarchived. The backend controls archive/restore and blocks ordinary edits while archived. |

### Keys and foreign keys

- `experiment_pkey`: `PRIMARY KEY (id)`.
- **FK05** `experiment_created_by_user_id_fkey`: `experiment.(created_by_user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `experiment_lock_version_check` | `CHECK ((lock_version > 0))` |
| `experiment_title_check` | `CHECK ((length(btrim(title)) > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `experiment_pkey` | Primary-key enforcement | `btree (id)` |
| `ix_experiment_creator_created` | Lookup/order support | `btree (created_by_user_id, created_at DESC)` |

### Lifecycle and write rules

**SQL:** changes to `id`, `created_by_user_id`, `created_at` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.

**Backend rules:**

- The owner controls sharing/archive/restore. Sharing an experiment does not grant access to its source submissions.
- Allow empty/incomplete experiments; completeness for export is derived from their steps. Archive freezes ordinary metadata, composition, ordering and pins, not linked submissions.

## 11. experiment_step

Planned template version, optionally attached to a submission and a selected finalized revision.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `experiment_id` | `uuid` | No | UK, FK | — | Experiment containing this current step. The step cannot be moved to another experiment by UPDATE. |
| `template_version_id` | `uuid` | No | FK | — | Required planned template version even before a submission exists. An attached submission must use this same version. |
| `submission_id` | `uuid` | Yes | UK, FK | — | Optional attached execution. A non-NULL submission can appear in at most one current step across all experiments. |
| `pinned_revision_no` | `integer` | Yes | FK | — | Optional selected revision number belonging to the attached submission. A non-NULL value requires submission_id; later corrections do not automatically change this pin. |
| `position` | `integer` | No | UK | — | Positive order within the experiment. Uniqueness is deferrable to allow reordering; the backend checks final contiguous positions and the 100-step limit. |

### Keys and foreign keys

- `experiment_step_pkey`: `PRIMARY KEY (id)`.
- `uq_experiment_step_position`: `UNIQUE (experiment_id, "position") DEFERRABLE`.
- `uq_experiment_step_submission`: `UNIQUE (submission_id)`.
- **FK13** `experiment_step_experiment_id_fkey`: `experiment_step.(experiment_id)` → `experiment.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK14** `experiment_step_template_version_id_fkey`: `experiment_step.(template_version_id)` → `template_version.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK15** `fk_experiment_step_revision`: `experiment_step.(submission_id, pinned_revision_no)` → `submission_revision.(submission_id, revision_no)`. Child → parent: **0..1**; parent → children: **0..1**. NOT DEFERRABLE.
- **FK16** `fk_experiment_step_submission_version`: `experiment_step.(submission_id, template_version_id)` → `submission.(id, template_version_id)`. Child → parent: **0..1**; parent → children: **0..1**. NOT DEFERRABLE.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `ck_experiment_step_revision_has_submission` | `CHECK (((pinned_revision_no IS NULL) OR (submission_id IS NOT NULL)))` |
| `experiment_step_pinned_revision_no_check` | `CHECK ((pinned_revision_no > 0))` |
| `experiment_step_position_check` | `CHECK (("position" > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `experiment_step_pkey` | Primary-key enforcement | `btree (id)` |
| `ix_experiment_step_template_version` | Lookup/order support | `btree (template_version_id)` |
| `uq_experiment_step_position` | Unique-constraint enforcement | `btree (experiment_id, "position")` |
| `uq_experiment_step_submission` | Unique-constraint enforcement | `btree (submission_id)` |

### Lifecycle and write rules

**SQL:** changes to `id`, `experiment_id` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is permitted by this schema; the backend must authorize and coordinate it. No linked historical row is cascade-deleted.

**Backend rules:**

- Permit changing the planned version only while no submission is attached. SQL fixes id/experiment_id, not this higher-level transition rule.
- Attaching an existing source requires edit on experiment and source, a nonarchived source, matching template version and no other current assignment.
- Attach a finalized source with its current revision pinned. First finalization of an attached draft pins revision 1 only if the experiment is active. SQL allows a NULL pin on an attached finalized source.
- Later corrections require an explicit pin update with experiment edit and source read. Deleting/detaching a step leaves its submission and all old export items intact.

## 12. reference_resource

Administered reference values, initially materials. Stable kind/code; labels are snapshotted on finalization.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `kind` | `text` | No | UK | — | Open text resource category, initially material. This is not a closed SQL enum. The category is fixed after creation. |
| `code` | `text` | No | UK | — | Stable resource code, unique only together with kind. A new identity is required when the resource meaning changes. |
| `label` | `text` | No | — | — | Human-readable current catalog label. Changing it does not rewrite labels already preserved in historical snapshots. |
| `description` | `text` | Yes | — | — | Optional descriptive text. SQL imposes no length limit on this column. |
| `active` | `boolean` | No | — | `true` | Whether this catalog entry is available for new selections. Deactivation retains the row and existing historical references; eligibility is checked by the backend. |
| `lock_version` | `integer` | No | — | `1` | Positive optimistic-concurrency counter. The backend compares the expected value and increments it on successful mutations; SQL only checks positivity. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |
| `updated_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Timestamp of the latest successful mutation. The backend must set it on updates; there is no automatic update trigger. |

### Keys and foreign keys

- `reference_resource_pkey`: `PRIMARY KEY (id)`.
- `uq_reference_resource_kind_code`: `UNIQUE (kind, code)`.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `reference_resource_code_check` | `CHECK ((length(btrim(code)) > 0))` |
| `reference_resource_kind_check` | `CHECK ((length(btrim(kind)) > 0))` |
| `reference_resource_label_check` | `CHECK ((length(btrim(label)) > 0))` |
| `reference_resource_lock_version_check` | `CHECK ((lock_version > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `reference_resource_pkey` | Primary-key enforcement | `btree (id)` |
| `uq_reference_resource_kind_code` | Unique-constraint enforcement | `btree (kind, code)` |

### Lifecycle and write rules

**SQL:** changes to `id`, `kind`, `code`, `created_at` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.

**Backend rules:**

- Authorize catalog administration and serialize changes with snapshot capture. New selections must be active and allowed; retain an inactive saved choice only with proof at the same submission/field/instance/ID.

## 13. resource_group

Reusable group restricting available reference values.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `code` | `text` | No | UK | — | Stable catalog code. The key definition below specifies its uniqueness scope; updates to this code are forbidden by a trigger. |
| `label` | `text` | No | — | — | Human-readable current catalog label. Changing it does not rewrite labels already preserved in historical snapshots. |
| `active` | `boolean` | No | — | `true` | Whether this group is eligible for new reference selections. Saved inactive choices require backend proof of prior use in the same field/instance. |
| `lock_version` | `integer` | No | — | `1` | Positive optimistic-concurrency counter. The backend compares the expected value and increments it on successful mutations; SQL only checks positivity. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |
| `updated_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Timestamp of the latest successful mutation. The backend must set it on updates; there is no automatic update trigger. |

### Keys and foreign keys

- `resource_group_code_key`: `UNIQUE (code)`.
- `resource_group_pkey`: `PRIMARY KEY (id)`.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `resource_group_code_check` | `CHECK ((length(btrim(code)) > 0))` |
| `resource_group_label_check` | `CHECK ((length(btrim(label)) > 0))` |
| `resource_group_lock_version_check` | `CHECK ((lock_version > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `resource_group_code_key` | Unique-constraint enforcement | `btree (code)` |
| `resource_group_pkey` | Primary-key enforcement | `btree (id)` |

### Lifecycle and write rules

**SQL:** changes to `id`, `code`, `created_at` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.

**Backend rules:**

- Validate group eligibility when saving definitions or new choices; check member and resource eligibility as well. Deactivation does not delete memberships.

## 14. resource_group_member

Membership and display order. A removed member becomes inactive; the link is retained.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `group_id` | `uuid` | No | PK, FK | — | Group containing the resource; first component of the retained membership primary key. |
| `resource_id` | `uuid` | No | PK, FK | — | Resource included in the group; second component of the retained membership primary key. |
| `position` | `integer` | No | — | — | Positive display position, unique within the group only for active memberships. Inactive rows may reuse a position. |
| `active` | `boolean` | No | — | `true` | Whether this membership currently permits new selections. Remove a membership by setting false, rather than deleting its row. |

### Keys and foreign keys

- `resource_group_member_pkey`: `PRIMARY KEY (group_id, resource_id)`.
- **FK19** `resource_group_member_group_id_fkey`: `resource_group_member.(group_id)` → `resource_group.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK20** `resource_group_member_resource_id_fkey`: `resource_group_member.(resource_id)` → `reference_resource.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

Additional partial UK: `(group_id, position)` only where `active = true`. This unique index is not a table UNIQUE constraint and is not deferrable. `position` is not individually unique.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `resource_group_member_position_check` | `CHECK (("position" > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `ix_resource_group_member_resource` | Lookup/order support | `btree (resource_id)` |
| `resource_group_member_pkey` | Primary-key enforcement | `btree (group_id, resource_id)` |
| `uq_resource_group_member_active_position` | Partial unique enforcement | `btree (group_id, "position") WHERE active` |

### Lifecycle and write rules

**SQL:** changes to `group_id`, `resource_id` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.

**Backend rules:**

- Require a valid active group, member and resource for new selections. A saved inactive membership may be retained only with occurrence-level proof.
- Reorder active members transactionally using temporary positive positions or temporary deactivation. This partial unique index is not deferrable.

## 15. unit

Unit vocabulary. Code and dimension are stable; no conversion table is assumed.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `code` | `text` | No | UK | — | Stable catalog code. The key definition below specifies its uniqueness scope; updates to this code are forbidden by a trigger. |
| `symbol` | `text` | No | — | — | Current unit symbol used for display. Historical revisions retain the captured symbol. |
| `label` | `text` | No | — | — | Human-readable current catalog label. Changing it does not rewrite labels already preserved in historical snapshots. |
| `dimension` | `text` | No | — | — | Stable open text dimension, such as mass. This is not a SQL enum; the backend validates dimension compatibility and allowed units. |
| `active` | `boolean` | No | — | `true` | Whether this catalog entry is available for new selections. Deactivation retains the row and existing historical references; eligibility is checked by the backend. |
| `lock_version` | `integer` | No | — | `1` | Positive optimistic-concurrency counter. The backend compares the expected value and increments it on successful mutations; SQL only checks positivity. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |
| `updated_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Timestamp of the latest successful mutation. The backend must set it on updates; there is no automatic update trigger. |

### Keys and foreign keys

- `unit_code_key`: `UNIQUE (code)`.
- `unit_pkey`: `PRIMARY KEY (id)`.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `unit_code_check` | `CHECK ((length(btrim(code)) > 0))` |
| `unit_dimension_check` | `CHECK ((length(btrim(dimension)) > 0))` |
| `unit_label_check` | `CHECK ((length(btrim(label)) > 0))` |
| `unit_lock_version_check` | `CHECK ((lock_version > 0))` |
| `unit_symbol_check` | `CHECK ((length(btrim(symbol)) > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `unit_code_key` | Unique-constraint enforcement | `btree (code)` |
| `unit_pkey` | Primary-key enforcement | `btree (id)` |

### Lifecycle and write rules

**SQL:** changes to `id`, `code`, `dimension`, `created_at` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.

**Backend rules:**

- Validate numeric value separately from unit identity and dimension. No unit conversion or silent rounding is included.

## 16. submission_grant

Explicit read/edit grant to one named user; revocation retains the current grant row.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `submission_id` | `uuid` | No | PK, FK | — | Submission shared by this current grant; part of the composite primary key. |
| `user_id` | `uuid` | No | PK, FK | — | Named recipient of the submission grant. Read permits finalized history; edit also permits drafts and corrections, subject to current authorization. |
| `access_level` | `text` | No | — | — | Explicit grant level: read or edit. Edit includes read but does not confer sharing, archive or ownership rights. |
| `granted_by_user_id` | `uuid` | No | FK | — | User who most recently issued or changed the grant. The backend must verify that this actor owns the target object. |
| `granted_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Timestamp of the current grant issuance; the backend refreshes it when regranting or changing the grant. |
| `revoked_at` | `timestamptz` | Yes | — | — | NULL means the grant is unrevoked; otherwise this is its revocation time. An unrevoked row alone does not establish authorization. |

### Keys and foreign keys

- `submission_grant_pkey`: `PRIMARY KEY (submission_id, user_id)`.
- **FK24** `submission_grant_granted_by_user_id_fkey`: `submission_grant.(granted_by_user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK25** `submission_grant_submission_id_fkey`: `submission_grant.(submission_id)` → `submission.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK26** `submission_grant_user_id_fkey`: `submission_grant.(user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `submission_grant_access_level_check` | `CHECK ((access_level = ANY (ARRAY['read'::text, 'edit'::text])))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `ix_submission_grant_user` | Lookup/order support | `btree (user_id)` |
| `submission_grant_pkey` | Primary-key enforcement | `btree (submission_id, user_id)` |

### Lifecycle and write rules

**SQL:** changes to `submission_id`, `user_id` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.

**Backend rules:**

- Only the submission owner may issue, change or revoke this grant. Require an active researcher recipient for research access.
- Reuse the same target/recipient row for regrant; refresh grant metadata, clear revoked_at when authorized and append audit events. The row is not the complete grant history.

## 17. experiment_grant

Explicit read/edit grant for an experiment; it grants no implicit access to underlying submissions.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `experiment_id` | `uuid` | No | PK, FK | — | Experiment shared by this current grant; part of the composite primary key. |
| `user_id` | `uuid` | No | PK, FK | — | Named recipient of the experiment grant. This grant never implicitly shares the experiment’s source submissions. |
| `access_level` | `text` | No | — | — | Explicit grant level: read or edit. Edit includes read but does not confer sharing, archive or ownership rights. |
| `granted_by_user_id` | `uuid` | No | FK | — | User who most recently issued or changed the grant. The backend must verify that this actor owns the target object. |
| `granted_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Timestamp of the current grant issuance; the backend refreshes it when regranting or changing the grant. |
| `revoked_at` | `timestamptz` | Yes | — | — | NULL means the grant is unrevoked; otherwise this is its revocation time. An unrevoked row alone does not establish authorization. |

### Keys and foreign keys

- `experiment_grant_pkey`: `PRIMARY KEY (experiment_id, user_id)`.
- **FK10** `experiment_grant_experiment_id_fkey`: `experiment_grant.(experiment_id)` → `experiment.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK11** `experiment_grant_granted_by_user_id_fkey`: `experiment_grant.(granted_by_user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK12** `experiment_grant_user_id_fkey`: `experiment_grant.(user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `experiment_grant_access_level_check` | `CHECK ((access_level = ANY (ARRAY['read'::text, 'edit'::text])))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `experiment_grant_pkey` | Primary-key enforcement | `btree (experiment_id, user_id)` |
| `ix_experiment_grant_user` | Lookup/order support | `btree (user_id)` |

### Lifecycle and write rules

**SQL:** changes to `experiment_id`, `user_id` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.

**Backend rules:**

- Only the experiment owner may issue, change or revoke this grant. Independently authorize every referenced submission for read/edit/export.
- Reuse the same target/recipient row for regrant; refresh grant metadata, clear revoked_at when authorized and append audit events.

## 18. experiment_export

One immutable capture and PDF attempt, with per-creator request idempotency.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `experiment_id` | `uuid` | No | FK | — | Experiment whose composition was captured; retained even if its current steps later change. |
| `created_by_user_id` | `uuid` | No | UK, FK | — | Researcher who requested this export; part of the request-idempotency uniqueness key. |
| `request_id` | `uuid` | No | UK | — | UUID for an idempotent export request, unique per requester. The backend also compares request content before treating a repeated key as a replay. |
| `source_lock_version` | `integer` | No | — | — | Positive experiment lock_version captured for this request. Historical version evidence, not an FK or an automatic comparison with the current experiment. |
| `report_format_version` | `text` | No | — | — | Identifier of the renderer/report format used for this captured report. Frozen with the export; no separate format catalog is assumed. |
| `status` | `text` | No | — | `'pending'::text` | Rendering attempt state: pending, ready or failed. SQL validates output metadata for each state and freezes terminal attempts. |
| `manifest` | `jsonb` | No | — | — | Immutable complete JSON capture of the report context, order and displayed names. SQL checks only that it is an object; the backend ensures agreement with export items. |
| `pdf_storage_key` | `text` | Yes | — | — | Opaque private storage key. NULL while pending/failed; required and nonblank when ready. It is not a public URL or an authorization credential. |
| `pdf_sha256` | `text` | Yes | — | — | SHA-256 file digest encoded as exactly 64 lowercase hexadecimal characters. NULL while pending/failed; required when ready. The backend verifies it against file bytes. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |
| `completed_at` | `timestamptz` | Yes | — | — | NULL while pending; required completion/failure timestamp for ready/failed. SQL does not enforce chronological ordering against created_at. |

### Keys and foreign keys

- `experiment_export_pkey`: `PRIMARY KEY (id)`.
- `uq_experiment_export_request`: `UNIQUE (created_by_user_id, request_id)`.
- **FK06** `experiment_export_created_by_user_id_fkey`: `experiment_export.(created_by_user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK07** `experiment_export_experiment_id_fkey`: `experiment_export.(experiment_id)` → `experiment.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `ck_experiment_export_state` | `CHECK ((((status = 'pending'::text) AND (completed_at IS NULL) AND (pdf_storage_key IS NULL) AND (pdf_sha256 IS NULL)) OR ((status = 'failed'::text) AND (completed_at IS NOT NULL) AND (pdf_storage_key IS NULL) AND (pdf_sha256 IS NULL)) OR ((status = 'ready'::text) AND (completed_at IS NOT NULL) AND (pdf_storage_key IS NOT NULL) AND (length(btrim(pdf_storage_key)) > 0) AND (pdf_sha256 IS NOT NULL))))` |
| `experiment_export_manifest_check` | `CHECK ((jsonb_typeof(manifest) = 'object'::text))` |
| `experiment_export_pdf_sha256_check` | `CHECK ((pdf_sha256 ~ '^[0-9a-f]{64}$'::text))` |
| `experiment_export_report_format_version_check` | `CHECK ((length(btrim(report_format_version)) > 0))` |
| `experiment_export_source_lock_version_check` | `CHECK ((source_lock_version > 0))` |
| `experiment_export_status_check` | `CHECK ((status = ANY (ARRAY['pending'::text, 'ready'::text, 'failed'::text])))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `experiment_export_pkey` | Primary-key enforcement | `btree (id)` |
| `ix_experiment_export_experiment_created` | Lookup/order support | `btree (experiment_id, created_at DESC)` |
| `uq_experiment_export_request` | Unique-constraint enforcement | `btree (created_by_user_id, request_id)` |

### Lifecycle and write rules

**SQL:** changes to `id`, `experiment_id`, `created_by_user_id`, `request_id`, `source_lock_version`, `report_format_version`, `manifest`, `created_at` are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.
**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.
**SQL transition protection:** pending attempts may change rendering/output fields while respecting the state CHECK. Once ready or failed, every UPDATE is rejected, even a no-op. Fixed fields, including the manifest, are protected from insertion onward.

**Backend rules:**

- Capture a nonempty complete experiment with all sources readable, its immutable manifest and all ordered items in one transaction.
- Validate request-id replay content, freeze the item set immediately after capture, render only captured content and verify the file hash before ready.
- Re-check current rights to the experiment and every historical source on each download, even when current steps were removed.

## 19. experiment_export_item

Ordered reference to an exact revision. Source step ID is historical trace, not a foreign key.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `export_id` | `uuid` | No | PK, FK | — | Parent saved export capture; part of the composite primary key. |
| `position` | `integer` | No | PK | — | Positive frozen display order inside this export. Together with export_id identifies one item. |
| `source_step_id` | `uuid` | No | — | — | Required UUID tracing the original current step. Deliberately not an FK so deleting the current step preserves this export. |
| `submission_id` | `uuid` | No | FK | — | Source submission identifier, paired with revision_no to reference one exact immutable revision. |
| `revision_no` | `integer` | No | FK | — | Revision of that same submission captured by this export. Not globally unique and not automatically advanced after correction. |

### Keys and foreign keys

- `experiment_export_item_pkey`: `PRIMARY KEY (export_id, "position")`.
- **FK08** `experiment_export_item_export_id_fkey`: `experiment_export_item.(export_id)` → `experiment_export.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.
- **FK09** `fk_export_item_revision`: `experiment_export_item.(submission_id, revision_no)` → `submission_revision.(submission_id, revision_no)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `experiment_export_item_position_check` | `CHECK (("position" > 0))` |
| `experiment_export_item_revision_no_check` | `CHECK ((revision_no > 0))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `experiment_export_item_pkey` | Primary-key enforcement | `btree (export_id, "position")` |
| `ix_export_item_revision` | Lookup/order support | `btree (submission_id, revision_no)` |

### Lifecycle and write rules

**SQL:** immutable after INSERT. Every UPDATE and DELETE is rejected, including a no-op UPDATE.

**Backend rules:**

- Create all items with the manifest in the capture transaction. No later additions are allowed by service policy; SQL blocks UPDATE/DELETE but does not block INSERT after capture or completion.
- Require contiguous positions and exact agreement with the captured manifest and chosen revisions. The trace UUID does not require a current step to exist.

## 20. audit_event

Append-only action metadata. Object ID is a polymorphic trace; no scientific answers or secrets belong here.

| Column | SQL type | NULL | Key membership | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | No | PK | `gen_random_uuid()` | Stable UUID identifying this row. Generated on insertion unless supplied by trusted server code. |
| `actor_user_id` | `uuid` | No | FK | — | Existing local user who performed or initiated the recorded action. SQL does not check that the account is currently active. |
| `action` | `text` | No | — | — | Controlled event code. Accepted values are listed below; the backend chooses the code, not the client. |
| `object_type` | `text` | No | — | — | Controlled type of the affected object. Its compatibility with action is a backend rule, not a cross-field SQL CHECK. |
| `object_id` | `uuid` | No | — | — | Required UUID identifying the affected object for audit trace. Polymorphic and deliberately not an FK. |
| `details` | `jsonb` | No | — | `'{}'::jsonb` | Metadata-only JSON object. SQL checks object shape but cannot prevent scientific answers, credentials or secrets; the backend must exclude them. |
| `created_at` | `timestamptz` | No | — | `CURRENT_TIMESTAMP` | Server-controlled creation timestamp; the SQL default is the start time of the inserting transaction. |

### Keys and foreign keys

- `audit_event_pkey`: `PRIMARY KEY (id)`.
- **FK03** `audit_event_actor_user_id_fkey`: `audit_event.(actor_user_id)` → `app_user.(id)`. Child → parent: **1**; parent → children: **0..N**. NOT DEFERRABLE.

### SQL CHECK constraints

| Constraint | Exact catalog expression |
| --- | --- |
| `audit_event_action_check` | `CHECK ((action = ANY (ARRAY['role.granted'::text, 'role.revoked'::text, 'user.activated'::text, 'user.deactivated'::text, 'catalog.created'::text, 'catalog.updated'::text, 'catalog.activated'::text, 'catalog.deactivated'::text, 'template.created'::text, 'template.version_created'::text, 'template.archived'::text, 'template.restored'::text, 'grant.created'::text, 'grant.updated'::text, 'grant.revoked'::text, 'submission.archived'::text, 'submission.restored'::text, 'experiment.archived'::text, 'experiment.restored'::text, 'export.requested'::text, 'export.ready'::text, 'export.failed'::text])))` |
| `audit_event_details_check` | `CHECK ((jsonb_typeof(details) = 'object'::text))` |
| `audit_event_object_type_check` | `CHECK ((object_type = ANY (ARRAY['app_user'::text, 'equipment'::text, 'form_template'::text, 'submission'::text, 'experiment'::text, 'reference_resource'::text, 'resource_group'::text, 'unit'::text, 'experiment_export'::text])))` |

### Indexes

| Index | Purpose | Indexed expression |
| --- | --- | --- |
| `audit_event_pkey` | Primary-key enforcement | `btree (id)` |
| `ix_audit_event_actor_date` | Lookup/order support | `btree (actor_user_id, created_at DESC)` |
| `ix_audit_event_object_date` | Lookup/order support | `btree (object_type, object_id, created_at DESC)` |

### Lifecycle and write rules

**SQL:** immutable after INSERT. Every UPDATE and DELETE is rejected, including a no-op UPDATE.

**Backend rules:**

- Record allowed administrative/share/archive/export actions in the same transaction as the mutation. Choose compatible action/object_type values and supply an existing actor.
- Restrict details to necessary metadata; do not store scientific answer payloads, passwords, access tokens or other secrets.

## A. State and conditional-nullability rules

These tables summarize cross-column SQL checks. They do not replace the exact expressions above.

### Submission state

| Column | `draft` | `submitted` |
| --- | --- | --- |
| `current_revision_no` | Must be NULL | Required, positive, references a revision of this same submission |
| `submitted_at` | Must be NULL | Required; first finalization time is preserved on correction |
| `project_reference` | NULL or valid 1–200-character text | Required valid text |
| `sample_reference` | NULL or valid 1–200-character text | Required valid text |
| `answers` | Required JSON object, initially `{}` | Required JSON object |
| `equipment_snapshot` | NULL or a JSON object | Required JSON object |
| `reference_snapshot` | NULL or a JSON object | Required JSON object; `{}` is allowed |

The backend normalizes blank draft context to NULL, trims leading/trailing whitespace and preserves interior content and case. SQL rejects empty, overlong and leading/trailing POSIX-whitespace project/sample strings; it does not normalize them. Neither reference is globally unique, a catalog FK, a source of access rights or proof of existence in a laboratory system. Every revision requires both references, and an export uses each pinned revision's references rather than current submission values.

Names, codes, labels, issuer and subject generally use `length(btrim(value)) > 0`. Those checks reject empty and ordinary-space-only values but neither trim stored text nor reject every possible whitespace-only string. Do not infer a maximum length where SQL has none.

### Step attachment and selection

| State | Planned `template_version_id` | `submission_id` | `pinned_revision_no` |
| --- | --- | --- | --- |
| Planned empty step | Required | NULL | NULL |
| Attached draft or unselected source | Required and matches attached submission | Present | NULL |
| Selected finalized source | Required and matches attached submission | Present | Present; belongs to that same submission |

A pin without a submission is invalid. SQL allows a submitted source to remain unpinned; the backend decides when to initialize the pin. An archived experiment may therefore keep a NULL pin when its attached draft is finalized. Later corrections never implicitly repin an experiment. The attachment and selected-revision relationships each have a physical maximum of one in either direction because a submission can be attached to only one current step.

### Export attempt state

| State | `completed_at` | `pdf_storage_key` | `pdf_sha256` | Later row update |
| --- | --- | --- | --- | --- |
| `pending` | NULL | NULL | NULL | Rendering fields may change; capture fields stay fixed |
| `ready` | Required | Required, nonblank | Required, 64 lowercase hexadecimal characters | Rejected, including no-op |
| `failed` | Required | NULL | NULL | Rejected, including no-op |

SQL checks digest syntax, not correspondence to file bytes, storage privacy or time ordering. The service creates accepted attempts as pending, captures at least one item, validates manifest/item consistency and prevents later item additions. A CHECK validates a stored state; it does not force insertion to start in pending. For request replay, the unique `(created_by_user_id, request_id)` key rejects duplicate pairs; the service must also compare the request content and return the existing attempt appropriately.

### Role, grant and audit vocabularies

| Field | Accepted SQL values |
| --- | --- |
| `app_role.code` | `admin`, `researcher` |
| Both grant `access_level` fields | `read`, `edit` |
| `audit_event.object_type` | `app_user`, `equipment`, `form_template`, `submission`, `experiment`, `reference_resource`, `resource_group`, `unit`, `experiment_export` |

Accepted audit action codes:

- Roles/accounts: `role.granted`, `role.revoked`, `user.activated`, `user.deactivated`.
- Catalog: `catalog.created`, `catalog.updated`, `catalog.activated`, `catalog.deactivated`.
- Templates: `template.created`, `template.version_created`, `template.archived`, `template.restored`.
- Sharing: `grant.created`, `grant.updated`, `grant.revoked`.
- Retention: `submission.archived`, `submission.restored`, `experiment.archived`, `experiment.restored`.
- Exports: `export.requested`, `export.ready`, `export.failed`.

Action and object-type memberships are checked independently. SQL does not prove that a selected action matches a selected object type. `reference_resource.kind`, `unit.dimension`, and `report_format_version` are open text values, not closed enums.

## B. JSONB content dictionary

Dynamic form content belongs in JSONB rather than a separate SQL table per template, question or repeat instance. Each JSONB column has a relational owner and a distinct purpose.

| JSONB column(s) | Content and intended structure | History rule |
| --- | --- | --- |
| `template_version.definition` | `schema_format`, versioned `title`, ordered `nodes`; node IDs/types, labels, instructions, options and rules; groups/repeats contain ordered children | Entire version is immutable |
| `submission.answers` | Field-ID keys mapping to typed answers; repeated groups are ordered arrays of `{instance_id, answers}` objects | Draft retains hidden/inactive saved values; submitted state must match current revision |
| `submission_revision.answers` | Complete validated active projection for one finalization/correction | Immutable |
| Both `equipment_snapshot` columns | Equipment UUID, stable code and captured name, as authoritative server-generated context | Revision is immutable; corrections retain base equipment context |
| Both `reference_snapshot` columns | Resource/unit metadata dictionaries keyed by their IDs; resource code/label and unit code/symbol/label/dimension | Retain context of reused IDs from the expected current base; capture new IDs; omit unused IDs from the new active revision |
| `experiment_export.manifest` | Frozen report context: experiment/title, ordered source identities, version/revision context, displayed author names and report data required for deterministic rendering | Fixed from capture; never substitute current catalog or experiment values |
| `audit_event.details` | Event metadata describing the administrative/share/archive/export change | Append-only; no answer bodies or secrets |

This is the approved logical content contract. The migration validates only object shape and column nullability; it does not implement a complete JSON Schema or parser. Do not infer a nested manifest/snapshot property as a SQL column or draw a foreign key to a JSON field.

### Answer value forms

| Component | Answer representation | Backend validation |
| --- | --- | --- |
| Text | JSON string | Length and requiredness from the template, within application limits |
| Integer/count | JSON integer | Type, bounds and repeat count; zero remains present |
| Decimal | Validated numeric string, such as `"1.20"` | Parse with Decimal; never silently round or coerce through a binary float |
| Boolean | JSON boolean | `false` remains present |
| Single choice | Stable option ID from the versioned definition | Membership in allowed options |
| Resource choice | Object containing `resource_id` | Existence, group membership, active eligibility or proved saved use |
| Quantity | Object containing decimal-string `value` and `unit_id` | Numeric rules, allowed unit and dimension; no automatic conversion |
| Repeated group | Ordered array of objects with stable `instance_id` and nested `answers` | Unique IDs, active count and full retained-array limits |
| Instruction/section | No independent answer value | Render from the versioned definition |

Fictional answer fragment illustrating representations, not a client protocol:

```json
{
  "f_count": 1,
  "r_layers": [
    {
      "instance_id": "00000000-0000-4000-8000-000000000401",
      "answers": {
        "f_material": {
          "resource_id": "00000000-0000-4000-8000-000000000201"
        },
        "f_mass": {
          "value": "1.20",
          "unit_id": "00000000-0000-4000-8000-000000000301"
        }
      }
    }
  ]
}
```

Project/sample columns sit outside this object. The template cannot hide or remove those system fields. Field IDs remain stable within a versioned definition and are not reused for a different meaning. These reference/instance IDs are fictional; a matching UUID string does not itself establish an SQL relation or permission.

### Conditions, repetition and initial limits

Rules use typed `eq`, `ne`, `in`, `exists`, `gt`, `gte`, `lt`, `lte`, combined with `all`/`any`. Rules can read a root field or a field in the same repeat instance. The backend rejects cycles, cross-instance dependencies and nested repetition. Missing, NULL or hidden sources fail ordinary comparisons, including `ne`; zero and false remain present.

Reducing a draft repeat count retains the inactive tail; increasing it restores retained instances before creating new IDs. Explicit deletion is separate. Finalization stores only the active projection, so excluded values are not automatically restored afterward. All retained draft values, including inactive values, remain subject to structure, ID and size validation.

| Application validation limit | Initial value | SQL enforcement in this revision |
| --- | --- | --- |
| Definition nodes / total depth | 200 / 4 | Backend only |
| Repeat nesting | One level | Backend only |
| Retained repeat instances | 100 per group; 500 total | Backend only |
| Rule combination depth | 3 | Backend only |
| Experiment steps | 100 | Backend only; SQL checks positive unique positions |
| Manual choice options | 200 per selection | Backend only |
| Answer text | 10,000 characters | Backend only inside JSONB |
| Correction reason | 1,000 characters | Relational CHECK |
| Project/sample reference | 1–200 characters when present; required at finalization | CHECKs, submitted-state rule and revision NOT NULL |
| Definition/request JSON | 2 MiB UTF-8 | Backend only |
| Decimal precision / exponent | 50 significant digits; absolute exponent at most 100; no NaN/infinity | Backend only for decimal strings |

These are initial technical limits, not client-supplied scientific limits. Templates may impose stricter bounds. Catalog browsing uses a default page size of 50 and maximum of 200 in the service; pagination is not a table constraint.

## C. Cross-table integrity, access and retention

| Rule | Database mechanism | Additional backend obligation |
| --- | --- | --- |
| Original template version is preserved | FK plus fixed-column trigger | Check machine/template eligibility for a new execution |
| Current revision belongs to its submission | Composite FK `(id, current_revision_no)` | Expected revision, +1 allocation and exact current-copy equality |
| Attached source uses planned version | Composite FK `(submission_id, template_version_id)` | Authorize both objects; restrict planned-version changes to unattached steps |
| Pin belongs to its source | Composite FK `(submission_id, pinned_revision_no)` | Initial/explicit pin policy; archived-experiment behavior |
| One current step per submission | Nullable UNIQUE on `submission_id` | Transactional attachment/detachment |
| Historical content survives changes | Immutable rows, retained identities and no cascade deletes | Complete snapshots, frozen export item set and private file handling |
| Edits do not silently overwrite each other | Positive `lock_version` column | Compare-and-swap/locks, counter increments, conflict handling and atomic number allocation |
| Separate named access grants | Two concrete FK-backed grant tables | Active account/role checks, owner-only sharing, current grants, last-active-admin protection and revocation coordination |

Policies apply to lists, reads, histories, writes and downloads. Admin alone permits catalog/template/account administration, not access to another user's research data. Research access requires an active researcher and ownership or a current object grant. A user may hold both roles. An unrevoked grant, matching project reference or access to an experiment does not automatically grant access to an underlying submission.

Only `app_user_role` and current `experiment_step` rows may be deleted through their allowed application operations. The other 18 domain tables reject row DELETE; immutable history also rejects UPDATE. This describes ordinary row operations and intended runtime privileges, not an inability of a database owner to drop tables or disable protections. The application role must not own the schema or hold administrative privileges.

No per-user row-level security policy is installed. [Application SQL grants](../ops/application_privileges.sql) restrict the shared runtime account; Flask must enforce each end user's permissions. No global JSONB GIN index exists. The 50 indexes above are the actual baseline; future query-specific indexes require measured need and a migration. Do not assume PostgreSQL automatically adds an index for every referencing FK column.

## D. Scope, maintenance and technical sources

This is a single-laboratory model. Project/sample master catalogs, sample inventory, reservations, stock, maintenance, uploaded files, tenant tables, legal signatures and pre-execution protocol PDFs are outside this initial schema. There are no separate admin/researcher person tables or question tables per template. Authentication provider details, real laboratory content and deployment settings remain integration work; this dictionary invents none of them.

The documentation is complete for the existing initial schema. It does not mark the application complete or production-tested. [VALIDATION.md](VALIDATION.md) distinguishes passed embedded-engine checks, prepared native PostgreSQL tests and future application acceptance testing.

Column/key/check/index facts come from [schema_catalog.json](schema_catalog.json), English field definitions from [dictionary_notes.json](dictionary_notes.json), and trigger facts from the versioned SQL. Maintain the notes and verified catalog together, then run `python database/scripts/render_catalog.py` from the repository root. Edit the approved schema through new migrations rather than silently changing an applied baseline. Regeneration must preserve field meanings and service rules.

Technical interpretation follows the official [PostgreSQL 16 constraint documentation](https://www.postgresql.org/docs/16/ddl-constraints.html) and [partial-index documentation](https://www.postgresql.org/docs/16/indexes-partial.html), checked 12 October 2026. Business rules come from the existing project model and backend contract, not from those manuals.
