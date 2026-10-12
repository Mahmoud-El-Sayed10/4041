// Supplemental single-connection SQL checks. Does not replace native PostgreSQL/pytest.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const db = await PGlite.create();
let passed = 0;
const results = [];

async function check(name, body) {
  await body();
  passed += 1;
  results.push(name);
  console.log(`PASS ${name}`);
}
async function rejected(sql, code, args = []) {
  await db.exec('SAVEPOINT expected_failure');
  let error;
  try {
    await db.query(sql, args);
    await db.exec('SET CONSTRAINTS ALL IMMEDIATE');
  } catch (e) { error = e; }
  await db.exec('ROLLBACK TO SAVEPOINT expected_failure; RELEASE SAVEPOINT expected_failure');
  assert.equal(error?.code, code, `${sql}: expected SQLSTATE ${code}, got ${error?.code ?? 'success'}`);
}
async function id(sql, args = []) { return (await db.query(sql, args)).rows[0].id; }

try {
  const version = (await db.query('SHOW server_version')).rows[0].server_version;
  console.log(`Embedded PostgreSQL: ${version}; PGlite 0.5.8`);
  await db.exec(await readFile(new URL('migrations/versions/0001_initial_model.sql', root), 'utf8'));
  await check('All 20 domain tables created', async () => {
    const { rows } = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    assert.equal(rows.length,20);
  });
  await db.exec('BEGIN');
  const owner = await id("INSERT INTO app_user(display_name) VALUES ('Fictional researcher') RETURNING id");
  const other = await id("INSERT INTO app_user(display_name) VALUES ('Fictional colleague') RETURNING id");
  const equipment = await id("INSERT INTO equipment(code,name) VALUES ('DEMO','Fictional machine') RETURNING id");
  const template = await id("INSERT INTO form_template(equipment_id,created_by_user_id,name) VALUES ($1,$2,'Demo') RETURNING id",[equipment,owner]);
  const v1 = await id("INSERT INTO template_version(template_id,version_no,created_by_user_id,definition) VALUES ($1,1,$2,'{}') RETURNING id",[template,owner]);
  const v2 = await id("INSERT INTO template_version(template_id,version_no,created_by_user_id,definition) VALUES ($1,2,$2,'{}') RETURNING id",[template,owner]);
  const sub = await id("INSERT INTO submission(template_version_id,created_by_user_id) VALUES ($1,$2) RETURNING id",[v1,owner]);
  const exp = await id("INSERT INTO experiment(created_by_user_id,title) VALUES ($1,'Demo') RETURNING id",[owner]);

  await check('Admin and researcher roles are cumulative', async () => {
    await db.query('INSERT INTO app_user_role SELECT $1,id FROM app_role',[owner]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM app_user_role')).rows[0].n,2);
    await rejected('INSERT INTO app_user_role SELECT $1,id FROM app_role','23505',[owner]);
  });
  await check('External issuer/subject cannot be assigned twice', async () => {
    await db.query("INSERT INTO auth_identity(user_id,issuer,subject) VALUES ($1,'urn:demo','user-1')",[owner]);
    await rejected("INSERT INTO auth_identity(user_id,issuer,subject) VALUES ($1,'urn:demo','user-1')",'23505',[other]);
  });
  await check('Draft permits incomplete context', async () => {
    const row = (await db.query('SELECT status,project_reference,sample_reference FROM submission WHERE id=$1',[sub])).rows[0];
    assert.deepEqual(row,{status:'draft',project_reference:null,sample_reference:null});
  });
  await check('Empty, padded and oversized project/sample references are rejected', async () => {
    for (const value of ['', ' padded ', '\t', '\nproject', 'x'.repeat(201)])
      await rejected('UPDATE submission SET project_reference=$1 WHERE id=$2','23514',[value,sub]);
  });
  await check('Finalization requires project and sample', async () => {
    await rejected("UPDATE submission SET status='submitted',current_revision_no=1,submitted_at=now(),equipment_snapshot='{}',reference_snapshot='{}' WHERE id=$1",'23514',[sub]);
  });
  await check('JSONB payloads must be objects', () => rejected("UPDATE submission SET answers='[]' WHERE id=$1",'23514',[sub]));
  await check('Template version numbers are unique', () => rejected("INSERT INTO template_version(template_id,version_no,created_by_user_id,definition) VALUES ($1,1,$2,'{}')",'23505',[template,owner]));
  await check('Template versions and execution identity are immutable', async () => {
    await rejected("UPDATE template_version SET definition='{}' WHERE id=$1",'23514',[v1]);
    await rejected('UPDATE submission SET created_by_user_id=$1 WHERE id=$2','23514',[other,sub]);
    await rejected('UPDATE submission SET template_version_id=$1 WHERE id=$2','23514',[v2,sub]);
  });
  await check('A finalized submission must point to its own revision', async () => {
    await rejected("UPDATE submission SET status='submitted',current_revision_no=1,submitted_at=now(),project_reference='P',sample_reference='S',equipment_snapshot='{}',reference_snapshot='{}' WHERE id=$1",'23503',[sub]);
  });
  // These fixture writes do not perform the missing Flask validation of JSON rules/snapshots.
  await db.query("INSERT INTO submission_revision(submission_id,revision_no,created_by_user_id,project_reference,sample_reference,answers,equipment_snapshot,reference_snapshot) VALUES ($1,1,$2,'P','S','{}','{}','{}')",[sub,owner]);
  await db.query("UPDATE submission SET status='submitted',current_revision_no=1,submitted_at=now(),project_reference='P',sample_reference='S',equipment_snapshot='{}',reference_snapshot='{}' WHERE id=$1",[sub]);
  await check('Revision rows cannot be rewritten or deleted', async () => {
    await rejected("UPDATE submission_revision SET answers='{}' WHERE submission_id=$1",'23514',[sub]);
    await rejected('DELETE FROM submission_revision WHERE submission_id=$1','23514',[sub]);
  });
  await check('Step rejects a submission made with a different template version', () => rejected('INSERT INTO experiment_step(experiment_id,template_version_id,submission_id,position) VALUES ($1,$2,$3,1)','23503',[exp,v2,sub]));
  await check('Pinned revision requires a submission', () => rejected('INSERT INTO experiment_step(experiment_id,template_version_id,pinned_revision_no,position) VALUES ($1,$2,1,1)','23514',[exp,v1]));
  const otherSub = await id('INSERT INTO submission(template_version_id,created_by_user_id) VALUES ($1,$2) RETURNING id',[v1,owner]);
  await check('Step cannot pin another submission’s revision', () => rejected('INSERT INTO experiment_step(experiment_id,template_version_id,submission_id,pinned_revision_no,position) VALUES ($1,$2,$3,1,1)','23503',[exp,v1,otherSub]));
  const step = await id('INSERT INTO experiment_step(experiment_id,template_version_id,submission_id,pinned_revision_no,position) VALUES ($1,$2,$3,1,1) RETURNING id',[exp,v1,sub]);
  const step2 = await id('INSERT INTO experiment_step(experiment_id,template_version_id,position) VALUES ($1,$2,2) RETURNING id',[exp,v1]);
  await check('Only one current step can attach each submission', () => rejected('UPDATE experiment_step SET submission_id=$1 WHERE id=$2','23505',[sub,step2]));
  await check('Deferred position uniqueness allows an atomic swap', async () => {
    await db.exec('SET CONSTRAINTS uq_experiment_step_position DEFERRED');
    await db.query('UPDATE experiment_step SET position=2 WHERE id=$1',[step]);
    await db.query('UPDATE experiment_step SET position=1 WHERE id=$1',[step2]);
    await db.exec('SET CONSTRAINTS uq_experiment_step_position IMMEDIATE');
  });
  await check('Correction preserves original revision and does not repin the step', async () => {
    await db.query("INSERT INTO submission_revision(submission_id,revision_no,created_by_user_id,project_reference,sample_reference,answers,equipment_snapshot,reference_snapshot) VALUES ($1,2,$2,'P','S2','{}','{}','{}')",[sub,owner]);
    await db.query("UPDATE submission SET current_revision_no=2,sample_reference='S2',lock_version=lock_version+1 WHERE id=$1",[sub]);
    assert.equal((await db.query('SELECT pinned_revision_no FROM experiment_step WHERE id=$1',[step])).rows[0].pinned_revision_no,1);
    await rejected("UPDATE submission SET sample_reference='S3' WHERE id=$1",'23514',[sub]);
    await rejected('UPDATE submission SET current_revision_no=1 WHERE id=$1','23514',[sub]);
    await rejected("UPDATE submission SET submitted_at=now()+interval '1 day' WHERE id=$1",'23514',[sub]);
  });
  await check('Active catalog positions are unique; inactive memberships remain', async () => {
    const group = await id("INSERT INTO resource_group(code,label) VALUES ('DEMO','Demo') RETURNING id");
    const r1 = await id("INSERT INTO reference_resource(kind,code,label) VALUES ('material','A','A') RETURNING id");
    const r2 = await id("INSERT INTO reference_resource(kind,code,label) VALUES ('material','B','B') RETURNING id");
    await db.query('INSERT INTO resource_group_member VALUES ($1,$2,1,true)',[group,r1]);
    await rejected('INSERT INTO resource_group_member VALUES ($1,$2,1,true)','23505',[group,r2]);
    await db.query('UPDATE resource_group_member SET active=false WHERE group_id=$1',[group]);
    await db.query('INSERT INTO resource_group_member VALUES ($1,$2,1,true)',[group,r2]);
  });
  const exportId = await id("INSERT INTO experiment_export(experiment_id,created_by_user_id,request_id,source_lock_version,report_format_version,manifest) VALUES ($1,$2,gen_random_uuid(),1,'1','{}') RETURNING id",[exp,owner]);
  await check('Export request idempotency key is unique per creator', () => rejected('INSERT INTO experiment_export(experiment_id,created_by_user_id,request_id,source_lock_version,report_format_version,manifest) SELECT experiment_id,created_by_user_id,request_id,source_lock_version,report_format_version,manifest FROM experiment_export WHERE id=$1','23505',[exportId]));
  await db.query('INSERT INTO experiment_export_item VALUES ($1,1,$2,$3,1)',[exportId,step,sub]);
  await check('Retained export survives removal of its current step', async () => {
    await db.query('DELETE FROM experiment_step WHERE id=$1',[step]);
    assert.equal((await db.query('SELECT source_step_id FROM experiment_export_item WHERE export_id=$1',[exportId])).rows[0].source_step_id,step);
    await rejected('DELETE FROM experiment_export_item WHERE export_id=$1','23514',[exportId]);
  });
  await check('Ready export requires a file/hash and becomes immutable', async () => {
    await rejected("UPDATE experiment_export SET status='ready',completed_at=now() WHERE id=$1",'23514',[exportId]);
    await rejected("UPDATE experiment_export SET manifest='{\"changed\":true}' WHERE id=$1",'23514',[exportId]);
    await db.query("UPDATE experiment_export SET status='ready',completed_at=now(),pdf_storage_key='private/demo.pdf',pdf_sha256=$1 WHERE id=$2",['a'.repeat(64),exportId]);
    await rejected("UPDATE experiment_export SET pdf_storage_key='private/changed.pdf' WHERE id=$1",'23514',[exportId]);
  });
  await check('Audit is append-only; historical rows cannot be deleted', async () => {
    const event = await id("INSERT INTO audit_event(actor_user_id,action,object_type,object_id) VALUES ($1,'submission.archived','submission',$2) RETURNING id",[owner,sub]);
    await rejected("UPDATE audit_event SET details='{}' WHERE id=$1",'23514',[event]);
    await rejected('DELETE FROM submission WHERE id=$1','23514',[sub]);
  });
  await check('Optimistic compare-and-swap accepts only one use of an expected version', async () => {
    assert.equal((await db.query('UPDATE submission SET lock_version=lock_version+1 WHERE id=$1 AND lock_version=1 RETURNING id',[otherSub])).rows.length,1);
    assert.equal((await db.query('UPDATE submission SET lock_version=lock_version+1 WHERE id=$1 AND lock_version=1 RETURNING id',[otherSub])).rows.length,0);
  });
  await db.exec('COMMIT');

  await check('Runtime role has no schema ownership or history mutation permission', async () => {
    await db.exec('CREATE ROLE yes4041_test_app NOLOGIN');
    let privileges = await readFile(new URL('ops/application_privileges.sql',root),'utf8');
    privileges = privileges.split('\n').filter(line => !line.startsWith('\\')).join('\n')
      .replaceAll(':"app_role"','"yes4041_test_app"');
    await db.exec(privileges);
    await db.exec('BEGIN; SET LOCAL ROLE yes4041_test_app');
    await db.query('SELECT id FROM submission');
    await rejected("UPDATE submission_revision SET answers='{}' WHERE submission_id=$1",'42501',[sub]);
    await rejected('TRUNCATE audit_event','42501');
    await rejected('CREATE TABLE public.forbidden (id integer)','42501');
    await db.exec('ROLLBACK');
  });

  // Read-only schema snapshot used by the modeling guide; no fixture values are exported.
  if (process.argv.includes('--catalog')) {
    const catalog = (await db.query(await readFile(new URL('scripts/inspect_catalog.sql',root),'utf8'))).rows[0].catalog;
    await writeFile(new URL('docs/schema_catalog.json',root),JSON.stringify(catalog,null,2)+'\n');
  }
  console.log(`${passed} embedded-engine checks passed. Native PostgreSQL integration tests remain separate.`);
} finally { await db.close(); }
