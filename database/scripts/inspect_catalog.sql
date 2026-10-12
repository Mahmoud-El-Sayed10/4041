-- Read-only catalog export, for documentation. Not Lucidchart's vendor import query.
SELECT jsonb_build_object(
  'tables', (
    SELECT jsonb_agg(t.tablename ORDER BY t.tablename)
    FROM pg_tables t WHERE t.schemaname = 'public' AND t.tablename <> 'alembic_version'
  ),
  'columns', (
    SELECT jsonb_agg(to_jsonb(c) ORDER BY c.table_name, c.ordinal_position)
    FROM (
      SELECT table_name, column_name, ordinal_position, udt_name AS data_type,
             is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> 'alembic_version'
    ) c
  ),
  'constraints', (
    SELECT jsonb_agg(to_jsonb(c) ORDER BY c.table_name, c.name)
    FROM (
      SELECT r.relname AS table_name, c.conname AS name, c.contype AS type,
             pg_get_constraintdef(c.oid) AS definition,
             ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY k(num,pos)
                   JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY pos) AS columns,
             CASE WHEN c.contype='f' THEN ref.relname ELSE NULL END AS referenced_table,
             ARRAY(SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY k(num,pos)
                   JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY pos) AS referenced_columns,
             c.condeferrable AS deferrable, c.condeferred AS initially_deferred
      FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
      JOIN pg_namespace n ON n.oid=r.relnamespace
      LEFT JOIN pg_class ref ON ref.oid=c.confrelid
      WHERE n.nspname='public' AND r.relname <> 'alembic_version'
    ) c
  ),
  'indexes', (
    SELECT jsonb_agg(to_jsonb(i) ORDER BY i.tablename, i.indexname)
    FROM pg_indexes i WHERE i.schemaname='public' AND i.tablename <> 'alembic_version'
  )
) AS catalog;
