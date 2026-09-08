-- Convierte automáticamente columnas json heredadas del esquema public.
-- El esquema actual no define columnas de tipo json, por lo que esta migración
-- no realiza cambios en una instalación nueva.
DO $$
DECLARE
  columna RECORD;
BEGIN
  FOR columna IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND udt_name = 'json'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE jsonb USING %I::jsonb',
      'public', columna.table_name, columna.column_name, columna.column_name
    );
  END LOOP;
END $$;