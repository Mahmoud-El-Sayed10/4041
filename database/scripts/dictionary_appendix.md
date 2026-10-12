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
