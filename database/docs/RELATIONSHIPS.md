# Foreign-key relationship register

Generated from the checked schema. Each row is one SQL foreign key, including composite keys. FK01–FK30 are the same IDs used in [ERD.md](ERD.md) and [DATA_DICTIONARY.md](DATA_DICTIONARY.md). All FK update/delete actions are NO ACTION, with MATCH SIMPLE; no historical cascade deletes.

Child → parent describes how many parent rows one child can reference. Parent → children describes how many child rows may reference one parent. A composite FK is ONE relationship, not independent links per column.

This is the physical schema. Initial versions, nonempty exports and finalized submissions have stronger service transaction requirements. SQL alone permits zero child versions/items and does not prohibit revision rows on a draft.

| ID | Child columns | Parent key | Child → parent | Parent → children |
| --- | --- | --- | --- | --- |
| FK01 | `app_user_role.(role_id)` | `app_role.(id)` | 1 | 0..N |
| FK02 | `app_user_role.(user_id)` | `app_user.(id)` | 1 | 0..N |
| FK03 | `audit_event.(actor_user_id)` | `app_user.(id)` | 1 | 0..N |
| FK04 | `auth_identity.(user_id)` | `app_user.(id)` | 1 | 0..N |
| FK05 | `experiment.(created_by_user_id)` | `app_user.(id)` | 1 | 0..N |
| FK06 | `experiment_export.(created_by_user_id)` | `app_user.(id)` | 1 | 0..N |
| FK07 | `experiment_export.(experiment_id)` | `experiment.(id)` | 1 | 0..N |
| FK08 | `experiment_export_item.(export_id)` | `experiment_export.(id)` | 1 | 0..N |
| FK09 | `experiment_export_item.(submission_id, revision_no)` | `submission_revision.(submission_id, revision_no)` | 1 | 0..N |
| FK10 | `experiment_grant.(experiment_id)` | `experiment.(id)` | 1 | 0..N |
| FK11 | `experiment_grant.(granted_by_user_id)` | `app_user.(id)` | 1 | 0..N |
| FK12 | `experiment_grant.(user_id)` | `app_user.(id)` | 1 | 0..N |
| FK13 | `experiment_step.(experiment_id)` | `experiment.(id)` | 1 | 0..N |
| FK14 | `experiment_step.(template_version_id)` | `template_version.(id)` | 1 | 0..N |
| FK15 | `experiment_step.(submission_id, pinned_revision_no)` | `submission_revision.(submission_id, revision_no)` | 0..1 | 0..1 |
| FK16 | `experiment_step.(submission_id, template_version_id)` | `submission.(id, template_version_id)` | 0..1 | 0..1 |
| FK17 | `form_template.(created_by_user_id)` | `app_user.(id)` | 1 | 0..N |
| FK18 | `form_template.(equipment_id)` | `equipment.(id)` | 1 | 0..N |
| FK19 | `resource_group_member.(group_id)` | `resource_group.(id)` | 1 | 0..N |
| FK20 | `resource_group_member.(resource_id)` | `reference_resource.(id)` | 1 | 0..N |
| FK21 | `submission.(id, current_revision_no)` | `submission_revision.(submission_id, revision_no)` | 0..1 | 0..1 |
| FK22 | `submission.(created_by_user_id)` | `app_user.(id)` | 1 | 0..N |
| FK23 | `submission.(template_version_id)` | `template_version.(id)` | 1 | 0..N |
| FK24 | `submission_grant.(granted_by_user_id)` | `app_user.(id)` | 1 | 0..N |
| FK25 | `submission_grant.(submission_id)` | `submission.(id)` | 1 | 0..N |
| FK26 | `submission_grant.(user_id)` | `app_user.(id)` | 1 | 0..N |
| FK27 | `submission_revision.(created_by_user_id)` | `app_user.(id)` | 1 | 0..N |
| FK28 | `submission_revision.(submission_id)` | `submission.(id)` | 1 | 0..N |
| FK29 | `template_version.(created_by_user_id)` | `app_user.(id)` | 1 | 0..N |
| FK30 | `template_version.(template_id)` | `form_template.(id)` | 1 | 0..N |

Only FK21, the current-revision FK, is DEFERRABLE INITIALLY DEFERRED. All other FKs are NOT DEFERRABLE. Separately, step position uniqueness is DEFERRABLE INITIALLY IMMEDIATE.

`submission_revision.revision_no` and `template_version.version_no` are not global identifiers. Never draw an FK to either number alone.

There is deliberately no FK for `experiment_export_item.source_step_id`, `audit_event.object_id`, `project_reference`, `sample_reference`, `source_lock_version`, or IDs embedded inside JSONB.
