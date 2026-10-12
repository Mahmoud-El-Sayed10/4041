"""Generate complete English references from checked catalog facts and field notes."""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / "docs/schema_catalog.json").read_text(encoding="utf-8"))
notes = json.loads((ROOT / "docs/dictionary_notes.json").read_text(encoding="utf-8"))["tables"]
ddl = (ROOT / "migrations/versions/0001_initial_model.sql").read_text(encoding="utf-8")
TABLES = [
    "app_user", "auth_identity", "app_role", "app_user_role", "equipment", "form_template",
    "template_version", "submission", "submission_revision", "experiment", "experiment_step",
    "reference_resource", "resource_group", "resource_group_member", "unit", "submission_grant",
    "experiment_grant", "experiment_export", "experiment_export_item", "audit_event",
]
assert sorted(TABLES) == catalog["tables"] == sorted(notes)
TYPES = {"int4": "integer", "bool": "boolean"}
foreign_keys = [c for c in catalog["constraints"] if c["type"] == "f"]
fk_ids = {c["name"]: f"FK{i:02d}" for i, c in enumerate(foreign_keys, 1)}
fixed_columns = {}
for table, arguments in re.findall(
    r"CREATE TRIGGER fixed_\w+ BEFORE UPDATE ON public\.(\w+)\s+"
    r"FOR EACH ROW EXECUTE FUNCTION public\.protect_fixed_columns\((.*?)\);", ddl, re.S,
):
    fixed_columns[table] = re.findall(r"'([^']+)'", arguments)
immutable_rows = set(re.findall(r"CREATE TRIGGER immutable_\w+ BEFORE UPDATE OR DELETE ON public\.(\w+)", ddl))
deletable_rows = {"app_user_role", "experiment_step"}


def code(value):
    return "`" + str(value).replace("|", "\\|") + "`"


def reference(table, columns):
    return code(table + ".(" + ", ".join(columns) + ")")


def cardinalities(fk):
    cols = [c for c in catalog["columns"] if c["table_name"] == fk["table_name"] and c["column_name"] in fk["columns"]]
    optional = any(c["is_nullable"] == "YES" for c in cols)
    unique = any(c["type"] in {"u", "p"} and c["table_name"] == fk["table_name"]
                 and set(c["columns"]) <= set(fk["columns"]) for c in catalog["constraints"])
    return ("0..1" if optional else "1", "0..1" if unique else "0..N")


lines = [
    "# Complete data dictionary — YES 4041", "",
    "**Version: 12 October 2026 · English · physical schema `0001_initial_model`.**", "",
    "This dictionary defines all **20 domain tables and 141 columns**, with **30 foreign keys, 20 primary keys, 12 UNIQUE constraints, 59 CHECK constraints and 50 indexes**. The indexes comprise 20 PK indexes, 12 UNIQUE-constraint indexes, one partial unique index and 17 additional lookup indexes. Alembic's bookkeeping table is outside the domain model.", "",
    "Companions: [complete ER diagrams](ERD.md), [FK register](RELATIONSHIPS.md), [Lucidchart guide](LUCIDCHART_GUIDE.md), [backend contract](BACKEND_CONTRACT.md). The [SQL migration](../migrations/versions/0001_initial_model.sql) is executable; this document does not imply that backend endpoints or permissions have been implemented.", "",
    "## Reading this dictionary", "",
    "- Names are exact SQL identifiers in the `public` schema. Types use PostgreSQL names: `uuid`, `text`, `boolean`, `integer`, `jsonb`, `timestamptz`.",
    "- **NULL = No** means NOT NULL. **NULL = Yes** means nullable at the column level; a CHECK may still require a value in a particular state.",
    "- **PK/UK/FK membership** may identify one component of a composite key. Read the named tuples below each table; a composite UK does not make each column unique by itself.",
    "- **Default = —** means no explicit database default. Missing required values fail; nullable columns may be NULL. Defaults run on INSERT only. `CURRENT_TIMESTAMP` is the transaction timestamp, not an automatic update mechanism.",
    "- **SQL guarantees** are implemented by constraints/triggers. **Backend rules** are required service behavior, including authorization and validation; SQL does not enforce them all.",
    "- All FKs use MATCH SIMPLE and ON UPDATE/DELETE NO ACTION. A NULL component can leave an optional composite FK unmatched. No historical cascade deletion is configured.",
    "- SQL checks JSONB object shape only. `{}` is an object; JSON `null`, arrays and scalars are not. Nullable snapshot columns may contain SQL NULL, which differs from JSON `null`.",
    "- `timestamptz` represents an instant. APIs should exchange timestamps with an explicit offset; this column does not preserve a separate original time-zone name.", "",
    "## Table index", "", "| No. | Table | Columns | Purpose |", "| --- | --- | --- | --- |",
]
for number, table in enumerate(TABLES, 1):
    cols = [c for c in catalog["columns"] if c["table_name"] == table]
    lines.append(f"| {number:02d} | [{table}](#{number:02d}-{table}) | {len(cols)} | {notes[table]['purpose']} |")
lines += ["", "The state, JSON-content and enforcement appendices after table 20 are part of this dictionary.", ""]

csv_rows = []
for number, table in enumerate(TABLES, 1):
    columns = [c for c in catalog["columns"] if c["table_name"] == table]
    constraints = [c for c in catalog["constraints"] if c["table_name"] == table]
    definitions = notes[table]["columns"]
    assert set(definitions) == {c["column_name"] for c in columns}, f"Column-note drift: {table}"
    assert all(definitions.values()), f"Empty definition: {table}"
    lines += [f"## {number:02d}. {table}", "", notes[table]["purpose"], "",
              "| Column | SQL type | NULL | Key membership | Default | Meaning |",
              "| --- | --- | --- | --- | --- | --- |"]
    for c in columns:
        markers = [label for typ, label in [("p", "PK"), ("u", "UK"), ("f", "FK")]
                   if any(k["type"] == typ and c["column_name"] in k["columns"] for k in constraints)]
        typ = TYPES.get(c["data_type"], c["data_type"])
        default = c["column_default"]
        meaning = definitions[c["column_name"]].replace("|", "\\|")
        lines.append(f"| {code(c['column_name'])} | {code(typ)} | {'Yes' if c['is_nullable'] == 'YES' else 'No'} | {', '.join(markers) or '—'} | {code(default) if default else '—'} | {meaning} |")
        csv_rows.append([table, c["column_name"], typ, c["is_nullable"], ";".join(markers), default or "", definitions[c["column_name"]]])
    lines += ["", "### Keys and foreign keys", ""]
    keys = [c for c in constraints if c["type"] in {"p", "u"}]
    for key in keys:
        lines.append(f"- {code(key['name'])}: {code(key['definition'])}.")
    for fk in [c for c in constraints if c["type"] == "f"]:
        cp, pc = cardinalities(fk)
        timing = "DEFERRABLE INITIALLY DEFERRED" if fk["initially_deferred"] else "NOT DEFERRABLE"
        lines.append(f"- **{fk_ids[fk['name']]}** {code(fk['name'])}: {reference(table, fk['columns'])} → {reference(fk['referenced_table'], fk['referenced_columns'])}. Child → parent: **{cp}**; parent → children: **{pc}**. {timing}.")
    if table == "resource_group_member":
        lines += ["", "Additional partial UK: `(group_id, position)` only where `active = true`. This unique index is not a table UNIQUE constraint and is not deferrable. `position` is not individually unique."]
    checks = [c for c in constraints if c["type"] == "c"]
    lines += ["", "### SQL CHECK constraints", ""]
    if checks:
        lines += ["| Constraint | Exact catalog expression |", "| --- | --- |"]
        for check in checks:
            lines.append(f"| {code(check['name'])} | {code(check['definition'])} |")
    else:
        lines.append("No additional CHECK constraints; types, required values, keys and FKs still apply.")
    lines += ["", "### Indexes", "", "| Index | Purpose | Indexed expression |", "| --- | --- | --- |"]
    for index in [i for i in catalog["indexes"] if i["tablename"] == table]:
        support = next((k for k in keys if k["name"] == index["indexname"]), None)
        if support:
            purpose = "Primary-key enforcement" if support["type"] == "p" else "Unique-constraint enforcement"
        else:
            purpose = "Partial unique enforcement" if "CREATE UNIQUE INDEX" in index["indexdef"] else "Lookup/order support"
        expression = index["indexdef"].split(" USING ", 1)[1]
        lines.append(f"| {code(index['indexname'])} | {purpose} | {code(expression)} |")
    lines += ["", "### Lifecycle and write rules", ""]
    if table in immutable_rows:
        lines.append("**SQL:** immutable after INSERT. Every UPDATE and DELETE is rejected, including a no-op UPDATE.")
    else:
        if table in fixed_columns:
            lines.append("**SQL:** changes to " + ", ".join(code(c) for c in fixed_columns[table]) + " are rejected by fixed-column triggers. A no-op UPDATE of these fixed values is not rejected by that trigger alone.")
        lines.append("**Deletion:** row DELETE is permitted by this schema; the backend must authorize and coordinate it. No linked historical row is cascade-deleted." if table in deletable_rows else "**Deletion:** row DELETE is rejected. Preserve identity/history and use the applicable inactive, archived or revoked state.")
    if table == "submission":
        lines.append("**SQL transition protection:** once submitted, status cannot return to draft, original `submitted_at` cannot change and `current_revision_no` cannot decrease. Changing answers, snapshots or project/sample context requires a different revision number. SQL does not ensure a +1 step or equality with the referenced revision.")
    if table == "experiment_export":
        lines.append("**SQL transition protection:** pending attempts may change rendering/output fields while respecting the state CHECK. Once ready or failed, every UPDATE is rejected, even a no-op. Fixed fields, including the manifest, are protected from insertion onward.")
    lines += ["", "**Backend rules:**", ""]
    lines.extend("- " + rule for rule in notes[table]["service_rules"])
    lines += [""]

lines += [(ROOT / "scripts/dictionary_appendix.md").read_text(encoding="utf-8").rstrip(), ""]
(ROOT / "docs/DATA_DICTIONARY.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
with (ROOT / "docs/columns.csv").open("w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f, lineterminator="\n")
    writer.writerow(["table", "column", "sql_type", "nullable", "key_membership", "default", "meaning"])
    writer.writerows(csv_rows)

relations = [
    "# Foreign-key relationship register", "",
    "Generated from the checked schema. Each row is one SQL foreign key, including composite keys. FK01–FK30 are the same IDs used in [ERD.md](ERD.md) and [DATA_DICTIONARY.md](DATA_DICTIONARY.md). All FK update/delete actions are NO ACTION, with MATCH SIMPLE; no historical cascade deletes.", "",
    "Child → parent describes how many parent rows one child can reference. Parent → children describes how many child rows may reference one parent. A composite FK is ONE relationship, not independent links per column.", "",
    "This is the physical schema. Initial versions, nonempty exports and finalized submissions have stronger service transaction requirements. SQL alone permits zero child versions/items and does not prohibit revision rows on a draft.", "",
    "| ID | Child columns | Parent key | Child → parent | Parent → children |", "| --- | --- | --- | --- | --- |",
]
for fk in foreign_keys:
    cp, pc = cardinalities(fk)
    relations.append(f"| {fk_ids[fk['name']]} | {reference(fk['table_name'], fk['columns'])} | {reference(fk['referenced_table'], fk['referenced_columns'])} | {cp} | {pc} |")
relations += ["", "Only FK21, the current-revision FK, is DEFERRABLE INITIALLY DEFERRED. All other FKs are NOT DEFERRABLE. Separately, step position uniqueness is DEFERRABLE INITIALLY IMMEDIATE.", "",
              "`submission_revision.revision_no` and `template_version.version_no` are not global identifiers. Never draw an FK to either number alone.", "",
              "There is deliberately no FK for `experiment_export_item.source_step_id`, `audit_event.object_id`, `project_reference`, `sample_reference`, `source_lock_version`, or IDs embedded inside JSONB.", ""]
(ROOT / "docs/RELATIONSHIPS.md").write_text("\n".join(relations), encoding="utf-8")
print(f"Rendered {len(TABLES)} tables, {len(csv_rows)} defined columns, {len(foreign_keys)} FKs, "
      f"{sum(c['type'] == 'c' for c in catalog['constraints'])} CHECKs and {len(catalog['indexes'])} indexes.")
