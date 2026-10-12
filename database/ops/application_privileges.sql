-- Run with psql as the schema owner AFTER migrations.
-- Usage: psql "$DATABASE_URL" -v app_role=yes4041_app -f database/ops/application_privileges.sql
-- app_role is an EXISTING dedicated non-owner, non-superuser role, without membership
-- in the migration-owner role. Provision its login/secret outside this repository.
-- Use a dedicated application database; these are project-wide privilege choices.
\set ON_ERROR_STOP on
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"app_role";
GRANT SELECT ON
    public.app_user, public.auth_identity, public.app_role, public.app_user_role,
    public.equipment, public.form_template, public.template_version,
    public.submission, public.submission_revision, public.experiment, public.experiment_step,
    public.reference_resource, public.resource_group, public.resource_group_member, public.unit,
    public.submission_grant, public.experiment_grant, public.experiment_export,
    public.experiment_export_item, public.audit_event
TO :"app_role";
GRANT INSERT ON
    public.app_user, public.auth_identity, public.app_user_role, public.equipment,
    public.form_template, public.template_version, public.submission, public.submission_revision,
    public.experiment, public.experiment_step, public.reference_resource, public.resource_group,
    public.resource_group_member, public.unit, public.submission_grant, public.experiment_grant,
    public.experiment_export, public.experiment_export_item, public.audit_event
TO :"app_role";
GRANT UPDATE ON
    public.app_user, public.equipment, public.form_template, public.submission,
    public.experiment, public.experiment_step, public.reference_resource, public.resource_group,
    public.resource_group_member, public.unit, public.submission_grant, public.experiment_grant,
    public.experiment_export
TO :"app_role";
GRANT DELETE ON public.app_user_role, public.experiment_step TO :"app_role";
-- No TRUNCATE, DDL, history UPDATE/DELETE or access to alembic_version is granted.
-- All end-user authorization remains mandatory in Flask; this is NOT row-level security.
COMMIT;
