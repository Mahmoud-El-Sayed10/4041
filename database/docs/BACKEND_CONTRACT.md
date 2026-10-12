# Backend integration contract

The schema implements relational integrity and targeted history protections. Flask must implement the following transactions and authorization rules before real use. This document separates completed database mechanisms from application behavior that **does not yet exist** in the repository.

## Database boundary

| Already enforced by SQL | Still enforced by the Flask service transaction |
| --- | --- |
| Foreign keys, composite links, uniqueness and allowed status values | Active user, roles, ownership, read/edit grants, revocations and last-active-admin protection |
| Required/bounded project/sample text in finalized rows | Normalize input, reject unknown fields, protect server-supplied ownership/authors/dates/status |
| JSONB is an object | Validate definition/answers structure, typed values, resource admissibility, conditions, cycles and limits |
| Immutable template versions, answer revisions, export items and audit rows | Sequential version/revision allocation under locks; at least one initial version/revision when required |
| Fixed equipment/template/creator identities; finalized answer changes require a changed revision number | Verify the complete current submission is identical to its newest revision; increment by exactly one; forbid unsupported transitions |
| Original finalization date and forward-only current revision number | Validate first finalization, active projection, consistent catalog snapshots and correction base |
| Valid export statuses, required ready file/hash, frozen manifest and terminal attempt | Nonempty complete capture, exact item/manifest agreement, no later item additions, accessible sources and private file handling |
| Positive `lock_version`, positive positions and index uniqueness | Compare expected versions, increment every mutable object affected, maximum/contiguous positions and stable lock order |
| No hard-delete of retained rows through the application grants/triggers | Archive freezes ordinary edits; restore and sharing actions follow owner-only policy |

SQL triggers are not complete business services. In particular, a raw SQL client with write privileges can still create an empty template, insert an unvalidated JSON object, or write a mismatched current snapshot together with a new revision. End users must never connect with the application database credentials.

## Initial service slices

1. **Create template / save changed version.** Active admin; lock machine/template as needed; check expected `lock_version`; validate whole definition; insert full immutable version with next number; synchronize current template name with the version title; create the template and version 1 atomically. Existing responses keep their original version.
2. **Create / save draft.** Active researcher with ownership/edit access; set owner and selected version on the server; normalize project/sample context; merge explicit changes without erasing omitted hidden values; validate all retained structures and limits, including inactive repeat instances. Compare-and-swap `lock_version`; increment it and update `updated_at` on success.
3. **Finalize.** Re-check rights inside the transaction; lock submission and any affected experiment in a stable order; require expected lock version; compute/validate the active projection; require project/sample text; capture authoritative reference/equipment metadata; insert revision 1 and atomically synchronize the current row. Initialize an attached step pin only if its experiment is active, and increment the experiment version if changed.
4. **Correct.** Require expected current revision and edit access; lock submission; validate a new complete active result; retain old equipment context and old per-ID reference context, capture new IDs; add exactly one new immutable revision and synchronize current values. Keep owner, template version and first `submitted_at`. Do not change existing experiment pins automatically.
5. **Compose experiment.** Require edit on the experiment and edit on a nonarchived source when attaching; match the planned template version; enforce at most 100 steps and contiguous positions. Attaching a finalized source pins its current revision. Explicit selection of another/current revision requires experiment edit and source read. Archive freezes composition, not the linked submissions.
6. **Capture export.** Lock and verify experiment version; require nonempty composition and readable finalized revision for every step; create immutable manifest plus all items together. Capture title, order, author display names and report version; keep original project/sample references from each pinned revision. Idempotent same request/content returns the same attempt; changed content with the same key is a conflict. Rendering transitions pending → ready/failed. Later downloads re-check current rights on the experiment and every historical source.

## Reference and access rules to preserve

- Admins manage templates and catalogs. Admin alone is not research-data access; the same user can also hold researcher.
- One submission/experiment owner, fixed at creation. Sharing is named read/edit and revocable. Only owner shares, archives or restores. An experiment grant does not confer a submission grant.
- Read on a submission exposes finalized revisions; edit also exposes its draft. Check lists, histories and file downloads as well as write routes.
- New choices must be active/admissible. A saved inactive choice may be retained only when proved in the same saved submission, field, instance and identifier. Arbitrary client IDs or old unrelated revisions do not prove eligibility.
- Serialize catalog changes with snapshot capture. Historical rendering uses the stored snapshot, never a fallback to current catalog labels.
- Decimal values are validated strings in JSON, processed with Decimal; count fields are JSON integers. No conversion or silent rounding.
- No dynamic SQL tables per template. Repeating groups and hidden values live in the JSON document with stable field/instance IDs.
- Coordinate role/grant revocations with request authorization and writes; database FK presence does not prove permission.

## Limits and system context

Keep the approved baseline: 200 definition nodes, depth 4; rule depth 3; one repeat level; 100 instances per group and 500 retained total; 100 experiment steps; 200 manual select options; text 10,000; correction reason 1,000; request JSON 2 MiB; decimals 50 significant digits and absolute exponent at most 100. The service checks retained inactive draft data too.

`project_reference` and `sample_reference` are system columns, outside the template/answers JSON. Trim leading/trailing whitespace; blank drafts become NULL; finalization requires both strings of 1–200 characters. Preserve case and interior content. They are not condition variables, catalog FKs, globally unique identifiers or sources of permissions.

## Transaction patterns

For a mutable object, use the expected version as a condition, not just a field copied into an UPDATE:

```sql
UPDATE submission
SET answers = :validated_answers,
    lock_version = lock_version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = :submission_id
  AND status = 'draft'
  AND archived_at IS NULL
  AND lock_version = :expected_lock_version
RETURNING id, lock_version;
```

This illustrates concurrency only; authorization and JSON validation must already be established in the same operation. Zero returned rows must not be treated as a successful save. Lock affected objects in a consistent order; retry bounded technical transaction conflicts, report stale user edits explicitly.

For step reorder, defer the named constraint within the transaction, then check the final contiguous positions before commit:

```sql
SET CONSTRAINTS uq_experiment_step_position DEFERRED;
-- Authorized position updates with expected experiment.lock_version.
SET CONSTRAINTS uq_experiment_step_position IMMEDIATE;
```

The partial index on active resource-group positions cannot be deferred; use a transaction with temporary positive positions or temporarily deactivate the affected memberships, restoring the intended active state before commit. Retain the membership identities.

## Deferred integration

OIDC provider details, hosting settings, real laboratory templates and institution-specific backup configuration were not provided. Use the explicitly fictional example for development; do not fabricate those settings. A genuine authenticated backend, PDF renderer and deployment/restore verification remain future work. No frontend or backend API implementation is included in this database foundation.
