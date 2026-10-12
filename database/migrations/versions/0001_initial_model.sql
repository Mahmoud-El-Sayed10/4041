-- YES 4041: physical baseline of MODELE_DONNEES v1.2 (2026-10-12).
-- Applied transactionally by Alembic. PostgreSQL 16+. No extension required.
-- JSON semantics, authorization and multi-row transitions belong to Flask services.

CREATE TABLE public.app_user (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.auth_identity (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.app_user(id),
    issuer text NOT NULL CHECK (length(btrim(issuer)) > 0),
    subject text NOT NULL CHECK (length(btrim(subject)) > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_auth_identity_issuer_subject UNIQUE (issuer, subject)
);
CREATE INDEX ix_auth_identity_user ON public.auth_identity(user_id);

CREATE TABLE public.app_role (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE CHECK (code IN ('admin', 'researcher')),
    label text NOT NULL CHECK (length(btrim(label)) > 0)
);
CREATE TABLE public.app_user_role (
    user_id uuid NOT NULL REFERENCES public.app_user(id),
    role_id uuid NOT NULL REFERENCES public.app_role(id),
    PRIMARY KEY (user_id, role_id)
);
CREATE INDEX ix_app_user_role_role ON public.app_user_role(role_id);

CREATE TABLE public.equipment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE CHECK (length(btrim(code)) > 0),
    name text NOT NULL CHECK (length(btrim(name)) > 0),
    description text,
    active boolean NOT NULL DEFAULT true,
    lock_version integer NOT NULL DEFAULT 1 CHECK (lock_version > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.form_template (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id uuid NOT NULL REFERENCES public.equipment(id),
    created_by_user_id uuid NOT NULL REFERENCES public.app_user(id),
    name text NOT NULL CHECK (length(btrim(name)) > 0),
    lock_version integer NOT NULL DEFAULT 1 CHECK (lock_version > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at timestamptz
);
CREATE INDEX ix_form_template_equipment ON public.form_template(equipment_id);
CREATE INDEX ix_form_template_creator ON public.form_template(created_by_user_id);

CREATE TABLE public.template_version (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.form_template(id),
    version_no integer NOT NULL CHECK (version_no > 0),
    created_by_user_id uuid NOT NULL REFERENCES public.app_user(id),
    definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_template_version_number UNIQUE (template_id, version_no)
);
CREATE INDEX ix_template_version_creator ON public.template_version(created_by_user_id);

CREATE TABLE public.submission (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_version_id uuid NOT NULL REFERENCES public.template_version(id),
    created_by_user_id uuid NOT NULL REFERENCES public.app_user(id),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
    lock_version integer NOT NULL DEFAULT 1 CHECK (lock_version > 0),
    current_revision_no integer CHECK (current_revision_no > 0),
    project_reference text,
    sample_reference text,
    answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers) = 'object'),
    equipment_snapshot jsonb CHECK (jsonb_typeof(equipment_snapshot) = 'object'),
    reference_snapshot jsonb CHECK (jsonb_typeof(reference_snapshot) = 'object'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at timestamptz,
    archived_at timestamptz,
    CONSTRAINT uq_submission_id_template_version UNIQUE (id, template_version_id),
    CONSTRAINT ck_submission_project_reference CHECK (
        project_reference IS NULL OR
        (char_length(project_reference) BETWEEN 1 AND 200 AND project_reference !~ '^[[:space:]]|[[:space:]]$')
    ),
    CONSTRAINT ck_submission_sample_reference CHECK (
        sample_reference IS NULL OR
        (char_length(sample_reference) BETWEEN 1 AND 200 AND sample_reference !~ '^[[:space:]]|[[:space:]]$')
    ),
    CONSTRAINT ck_submission_state CHECK (
        (status = 'draft' AND current_revision_no IS NULL AND submitted_at IS NULL)
        OR
        (status = 'submitted' AND current_revision_no IS NOT NULL AND submitted_at IS NOT NULL
         AND project_reference IS NOT NULL AND sample_reference IS NOT NULL
         AND equipment_snapshot IS NOT NULL AND reference_snapshot IS NOT NULL)
    )
);
CREATE INDEX ix_submission_template_version ON public.submission(template_version_id);
CREATE INDEX ix_submission_creator_created ON public.submission(created_by_user_id, created_at DESC);

CREATE TABLE public.submission_revision (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id uuid NOT NULL REFERENCES public.submission(id),
    revision_no integer NOT NULL CHECK (revision_no > 0),
    created_by_user_id uuid NOT NULL REFERENCES public.app_user(id),
    correction_reason text CHECK (char_length(correction_reason) <= 1000),
    project_reference text NOT NULL,
    sample_reference text NOT NULL,
    answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
    equipment_snapshot jsonb NOT NULL CHECK (jsonb_typeof(equipment_snapshot) = 'object'),
    reference_snapshot jsonb NOT NULL CHECK (jsonb_typeof(reference_snapshot) = 'object'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_submission_revision_number UNIQUE (submission_id, revision_no),
    CONSTRAINT ck_revision_project_reference CHECK (
        char_length(project_reference) BETWEEN 1 AND 200 AND project_reference !~ '^[[:space:]]|[[:space:]]$'
    ),
    CONSTRAINT ck_revision_sample_reference CHECK (
        char_length(sample_reference) BETWEEN 1 AND 200 AND sample_reference !~ '^[[:space:]]|[[:space:]]$'
    )
);
CREATE INDEX ix_submission_revision_creator ON public.submission_revision(created_by_user_id);
ALTER TABLE public.submission ADD CONSTRAINT fk_submission_current_revision
    FOREIGN KEY (id, current_revision_no)
    REFERENCES public.submission_revision(submission_id, revision_no)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.experiment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_user_id uuid NOT NULL REFERENCES public.app_user(id),
    title text NOT NULL CHECK (length(btrim(title)) > 0),
    description text,
    lock_version integer NOT NULL DEFAULT 1 CHECK (lock_version > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at timestamptz
);
CREATE INDEX ix_experiment_creator_created ON public.experiment(created_by_user_id, created_at DESC);

CREATE TABLE public.experiment_step (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id uuid NOT NULL REFERENCES public.experiment(id),
    template_version_id uuid NOT NULL REFERENCES public.template_version(id),
    submission_id uuid,
    pinned_revision_no integer CHECK (pinned_revision_no > 0),
    position integer NOT NULL CHECK (position > 0),
    CONSTRAINT uq_experiment_step_submission UNIQUE (submission_id),
    CONSTRAINT uq_experiment_step_position UNIQUE (experiment_id, position) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_experiment_step_revision_has_submission CHECK (pinned_revision_no IS NULL OR submission_id IS NOT NULL),
    CONSTRAINT fk_experiment_step_submission_version FOREIGN KEY (submission_id, template_version_id)
        REFERENCES public.submission(id, template_version_id),
    CONSTRAINT fk_experiment_step_revision FOREIGN KEY (submission_id, pinned_revision_no)
        REFERENCES public.submission_revision(submission_id, revision_no)
);
CREATE INDEX ix_experiment_step_template_version ON public.experiment_step(template_version_id);

CREATE TABLE public.reference_resource (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (length(btrim(kind)) > 0),
    code text NOT NULL CHECK (length(btrim(code)) > 0),
    label text NOT NULL CHECK (length(btrim(label)) > 0),
    description text,
    active boolean NOT NULL DEFAULT true,
    lock_version integer NOT NULL DEFAULT 1 CHECK (lock_version > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reference_resource_kind_code UNIQUE (kind, code)
);
CREATE TABLE public.resource_group (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE CHECK (length(btrim(code)) > 0),
    label text NOT NULL CHECK (length(btrim(label)) > 0),
    active boolean NOT NULL DEFAULT true,
    lock_version integer NOT NULL DEFAULT 1 CHECK (lock_version > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.resource_group_member (
    group_id uuid NOT NULL REFERENCES public.resource_group(id),
    resource_id uuid NOT NULL REFERENCES public.reference_resource(id),
    position integer NOT NULL CHECK (position > 0),
    active boolean NOT NULL DEFAULT true,
    PRIMARY KEY (group_id, resource_id)
);
CREATE UNIQUE INDEX uq_resource_group_member_active_position
    ON public.resource_group_member(group_id, position) WHERE active;
CREATE INDEX ix_resource_group_member_resource ON public.resource_group_member(resource_id);
CREATE TABLE public.unit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE CHECK (length(btrim(code)) > 0),
    symbol text NOT NULL CHECK (length(btrim(symbol)) > 0),
    label text NOT NULL CHECK (length(btrim(label)) > 0),
    dimension text NOT NULL CHECK (length(btrim(dimension)) > 0),
    active boolean NOT NULL DEFAULT true,
    lock_version integer NOT NULL DEFAULT 1 CHECK (lock_version > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.submission_grant (
    submission_id uuid NOT NULL REFERENCES public.submission(id),
    user_id uuid NOT NULL REFERENCES public.app_user(id),
    access_level text NOT NULL CHECK (access_level IN ('read', 'edit')),
    granted_by_user_id uuid NOT NULL REFERENCES public.app_user(id),
    granted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at timestamptz,
    PRIMARY KEY (submission_id, user_id)
);
CREATE INDEX ix_submission_grant_user ON public.submission_grant(user_id);
CREATE TABLE public.experiment_grant (
    experiment_id uuid NOT NULL REFERENCES public.experiment(id),
    user_id uuid NOT NULL REFERENCES public.app_user(id),
    access_level text NOT NULL CHECK (access_level IN ('read', 'edit')),
    granted_by_user_id uuid NOT NULL REFERENCES public.app_user(id),
    granted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at timestamptz,
    PRIMARY KEY (experiment_id, user_id)
);
CREATE INDEX ix_experiment_grant_user ON public.experiment_grant(user_id);

CREATE TABLE public.experiment_export (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id uuid NOT NULL REFERENCES public.experiment(id),
    created_by_user_id uuid NOT NULL REFERENCES public.app_user(id),
    request_id uuid NOT NULL,
    source_lock_version integer NOT NULL CHECK (source_lock_version > 0),
    report_format_version text NOT NULL CHECK (length(btrim(report_format_version)) > 0),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
    manifest jsonb NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
    pdf_storage_key text,
    pdf_sha256 text CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamptz,
    CONSTRAINT uq_experiment_export_request UNIQUE (created_by_user_id, request_id),
    CONSTRAINT ck_experiment_export_state CHECK (
        (status = 'pending' AND completed_at IS NULL AND pdf_storage_key IS NULL AND pdf_sha256 IS NULL)
        OR (status = 'failed' AND completed_at IS NOT NULL AND pdf_storage_key IS NULL AND pdf_sha256 IS NULL)
        OR (status = 'ready' AND completed_at IS NOT NULL AND pdf_storage_key IS NOT NULL
            AND length(btrim(pdf_storage_key)) > 0 AND pdf_sha256 IS NOT NULL)
    )
);
CREATE INDEX ix_experiment_export_experiment_created ON public.experiment_export(experiment_id, created_at DESC);
CREATE TABLE public.experiment_export_item (
    export_id uuid NOT NULL REFERENCES public.experiment_export(id),
    position integer NOT NULL CHECK (position > 0),
    source_step_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    revision_no integer NOT NULL CHECK (revision_no > 0),
    PRIMARY KEY (export_id, position),
    CONSTRAINT fk_export_item_revision FOREIGN KEY (submission_id, revision_no)
        REFERENCES public.submission_revision(submission_id, revision_no)
);
CREATE INDEX ix_export_item_revision ON public.experiment_export_item(submission_id, revision_no);

CREATE TABLE public.audit_event (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid NOT NULL REFERENCES public.app_user(id),
    action text NOT NULL CHECK (action IN (
        'role.granted', 'role.revoked', 'user.activated', 'user.deactivated',
        'catalog.created', 'catalog.updated', 'catalog.activated', 'catalog.deactivated',
        'template.created', 'template.version_created', 'template.archived', 'template.restored',
        'grant.created', 'grant.updated', 'grant.revoked',
        'submission.archived', 'submission.restored', 'experiment.archived', 'experiment.restored',
        'export.requested', 'export.ready', 'export.failed'
    )),
    object_type text NOT NULL CHECK (object_type IN (
        'app_user', 'equipment', 'form_template', 'submission', 'experiment',
        'reference_resource', 'resource_group', 'unit', 'experiment_export'
    )),
    object_id uuid NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_audit_event_object_date ON public.audit_event(object_type, object_id, created_at DESC);
CREATE INDEX ix_audit_event_actor_date ON public.audit_event(actor_user_id, created_at DESC);

-- Schema-owned trigger functions; the runtime role must never own the schema/tables.
CREATE FUNCTION public.reject_history_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% on % is forbidden; preserve history', TG_OP, TG_TABLE_NAME
        USING ERRCODE = '23514';
END;
$$;

CREATE FUNCTION public.protect_fixed_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE column_name text;
BEGIN
    FOREACH column_name IN ARRAY TG_ARGV LOOP
        IF (to_jsonb(NEW) -> column_name) IS DISTINCT FROM (to_jsonb(OLD) -> column_name) THEN
            RAISE EXCEPTION '%.% is immutable', TG_TABLE_NAME, column_name USING ERRCODE = '23514';
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.protect_submission_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'submitted' THEN
        IF NEW.status <> 'submitted' OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
           OR NEW.current_revision_no < OLD.current_revision_no THEN
            RAISE EXCEPTION 'A finalized submission cannot revert or lose its original finalization date'
                USING ERRCODE = '23514';
        END IF;
        IF NEW.current_revision_no = OLD.current_revision_no
           AND (NEW.answers, NEW.equipment_snapshot, NEW.reference_snapshot,
                NEW.project_reference, NEW.sample_reference)
               IS DISTINCT FROM
               (OLD.answers, OLD.equipment_snapshot, OLD.reference_snapshot,
                OLD.project_reference, OLD.sample_reference) THEN
            RAISE EXCEPTION 'A correction requires a new revision' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.protect_export_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status <> 'pending' THEN
        RAISE EXCEPTION 'A completed export attempt is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER immutable_template_version BEFORE UPDATE OR DELETE ON public.template_version
    FOR EACH ROW EXECUTE FUNCTION public.reject_history_change();
CREATE TRIGGER immutable_submission_revision BEFORE UPDATE OR DELETE ON public.submission_revision
    FOR EACH ROW EXECUTE FUNCTION public.reject_history_change();
CREATE TRIGGER immutable_export_item BEFORE UPDATE OR DELETE ON public.experiment_export_item
    FOR EACH ROW EXECUTE FUNCTION public.reject_history_change();
CREATE TRIGGER immutable_audit_event BEFORE UPDATE OR DELETE ON public.audit_event
    FOR EACH ROW EXECUTE FUNCTION public.reject_history_change();

CREATE TRIGGER fixed_app_user BEFORE UPDATE ON public.app_user
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('id', 'created_at');
CREATE TRIGGER fixed_auth_identity BEFORE UPDATE ON public.auth_identity
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('id', 'user_id', 'issuer', 'subject', 'created_at');
CREATE TRIGGER fixed_app_role BEFORE UPDATE ON public.app_role
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('id', 'code');
CREATE TRIGGER fixed_equipment BEFORE UPDATE ON public.equipment
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('id', 'code', 'created_at');
CREATE TRIGGER fixed_form_template BEFORE UPDATE ON public.form_template
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('id', 'equipment_id', 'created_by_user_id', 'created_at');
CREATE TRIGGER fixed_submission BEFORE UPDATE ON public.submission
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('id', 'template_version_id', 'created_by_user_id', 'created_at');
CREATE TRIGGER transition_submission BEFORE UPDATE ON public.submission
    FOR EACH ROW EXECUTE FUNCTION public.protect_submission_transition();
CREATE TRIGGER fixed_experiment BEFORE UPDATE ON public.experiment
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('id', 'created_by_user_id', 'created_at');
CREATE TRIGGER fixed_experiment_step BEFORE UPDATE ON public.experiment_step
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('id', 'experiment_id');
CREATE TRIGGER fixed_reference_resource BEFORE UPDATE ON public.reference_resource
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('id', 'kind', 'code', 'created_at');
CREATE TRIGGER fixed_resource_group BEFORE UPDATE ON public.resource_group
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('id', 'code', 'created_at');
CREATE TRIGGER fixed_resource_group_member BEFORE UPDATE ON public.resource_group_member
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('group_id', 'resource_id');
CREATE TRIGGER fixed_unit BEFORE UPDATE ON public.unit
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('id', 'code', 'dimension', 'created_at');
CREATE TRIGGER fixed_submission_grant BEFORE UPDATE ON public.submission_grant
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('submission_id', 'user_id');
CREATE TRIGGER fixed_experiment_grant BEFORE UPDATE ON public.experiment_grant
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns('experiment_id', 'user_id');
CREATE TRIGGER fixed_experiment_export BEFORE UPDATE ON public.experiment_export
    FOR EACH ROW EXECUTE FUNCTION public.protect_fixed_columns(
        'id', 'experiment_id', 'created_by_user_id', 'request_id', 'source_lock_version',
        'report_format_version', 'manifest', 'created_at'
    );
CREATE TRIGGER transition_experiment_export BEFORE UPDATE ON public.experiment_export
    FOR EACH ROW EXECUTE FUNCTION public.protect_export_transition();

-- No application hard-delete for identities, catalogs, executions, grants or exports.
-- app_user_role can be removed; experiment_step can be detached/deleted.
DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'app_user', 'auth_identity', 'app_role', 'equipment', 'form_template', 'submission',
        'experiment', 'reference_resource', 'resource_group', 'resource_group_member', 'unit',
        'submission_grant', 'experiment_grant', 'experiment_export'
    ] LOOP
        EXECUTE format('CREATE TRIGGER preserve_row BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_history_change()', table_name);
    END LOOP;
END;
$$;

-- Required role vocabulary only. No accounts, credentials or scientific examples in a migration.
INSERT INTO public.app_role (id, code, label) VALUES
    ('00000000-0000-4000-8000-000000000011', 'admin', 'Administrateur'),
    ('00000000-0000-4000-8000-000000000012', 'researcher', 'Chercheur');

COMMENT ON COLUMN public.submission.answers IS 'Dynamic answers; validated by the backend against the pinned template version.';
COMMENT ON COLUMN public.submission.project_reference IS 'System context: nullable in draft, required in a finalized revision; no project catalog is assumed.';
COMMENT ON COLUMN public.submission.sample_reference IS 'System context: nullable in draft, required in a finalized revision; no sample inventory is assumed.';
COMMENT ON COLUMN public.experiment_export_item.source_step_id IS 'Historical trace only, deliberately not an FK to the current experiment_step.';
COMMENT ON COLUMN public.audit_event.object_id IS 'Polymorphic audit trace; not a relational foreign key.';
