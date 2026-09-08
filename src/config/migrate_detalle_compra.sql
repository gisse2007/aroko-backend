-- =========================================================
-- MIGRACIÓN: agregar columnas contenido y stock_ingresado
--            a la tabla detalle_compra existente.
--
-- Ejecutar UNA SOLA VEZ sobre la base de datos activa:
--   psql -U <usuario> -d arokoDB -f migrate_detalle_compra.sql
-- =========================================================

ALTER TABLE detalle_compra
  ADD COLUMN IF NOT EXISTS contenido       DECIMAL(10,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stock_ingresado DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Retroalimentar registros históricos:
-- Para compras anteriores a esta migración, stock_ingresado
-- se inicializa igual a cantidad (comportamiento previo = 1:1).
UPDATE detalle_compra
SET stock_ingresado = cantidad
WHERE stock_ingresado = 0;

-- Verificar resultado
SELECT id_detalle, compra_id, insumo_id, cantidad, contenido, stock_ingresado
FROM detalle_compra
ORDER BY id_detalle;
