// src/queries/compras.queries.js

export const COMPRAS_QUERIES = {

  // Migración: agregar columnas que faltan en la BD original
  MIGRATE: `
    ALTER TABLE compras
      ADD COLUMN IF NOT EXISTS estado_compra VARCHAR(15) DEFAULT 'ACTIVA'
          CHECK (estado_compra IN ('ACTIVA','ANULADA')),
      ADD COLUMN IF NOT EXISTS iva           DECIMAL(5,2) DEFAULT 19,
      ADD COLUMN IF NOT EXISTS iva_valor     DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS subtotal_base DECIMAL(10,2) DEFAULT 0;
    ALTER TABLE detalle_compra
      ADD COLUMN IF NOT EXISTS contenido       DECIMAL(10,2) NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS stock_ingresado DECIMAL(10,2) NOT NULL DEFAULT 0;
    UPDATE detalle_compra
      SET stock_ingresado = cantidad
      WHERE stock_ingresado = 0;
  `,

  // ── Listado ──────────────────────────────────────────────────────────

  LIST: `
    SELECT
      c.id_compra,
      c.numero_factura,
      c.proveedor_id,
      p.nombre            AS proveedor_nombre,
      c.empleado_id,
      e.nombre            AS empleado_nombre,
      c.fecha_compra,
      c.estado_compra     AS estado,
      c.foto_comprobante  AS foto_factura,
      c.iva,
      c.iva_valor,
      c.subtotal_base,
      c.total_compra
    FROM compras c
    JOIN proveedores p ON p.id_proveedor = c.proveedor_id
    JOIN empleados   e ON e.id_empleado  = c.empleado_id
    ORDER BY c.fecha_compra DESC, c.id_compra DESC
  `,

  SEARCH: `
    SELECT
      c.id_compra,
      c.numero_factura,
      c.proveedor_id,
      p.nombre            AS proveedor_nombre,
      c.empleado_id,
      e.nombre            AS empleado_nombre,
      c.fecha_compra,
      c.estado_compra     AS estado,
      c.foto_comprobante  AS foto_factura,
      c.iva,
      c.iva_valor,
      c.subtotal_base,
      c.total_compra
    FROM compras c
    JOIN proveedores p ON p.id_proveedor = c.proveedor_id
    JOIN empleados   e ON e.id_empleado  = c.empleado_id
    WHERE c.numero_factura ILIKE $1
       OR p.nombre         ILIKE $1
    ORDER BY c.fecha_compra DESC
  `,

  // Filtrado por proveedor_id (evita filtrado en JS)
  FILTER_PROVEEDOR: `
    SELECT
      c.id_compra,
      c.numero_factura,
      c.proveedor_id,
      p.nombre            AS proveedor_nombre,
      c.empleado_id,
      e.nombre            AS empleado_nombre,
      c.fecha_compra,
      c.estado_compra     AS estado,
      c.foto_comprobante  AS foto_factura,
      c.iva,
      c.iva_valor,
      c.subtotal_base,
      c.total_compra
    FROM compras c
    JOIN proveedores p ON p.id_proveedor = c.proveedor_id
    JOIN empleados   e ON e.id_empleado  = c.empleado_id
    WHERE c.proveedor_id = $1
    ORDER BY c.fecha_compra DESC, c.id_compra DESC
  `,

  // Filtro por rango de fechas
  FILTER_FECHAS: `
    SELECT
      c.id_compra,
      c.numero_factura,
      c.proveedor_id,
      p.nombre            AS proveedor_nombre,
      c.empleado_id,
      e.nombre            AS empleado_nombre,
      c.fecha_compra,
      c.estado_compra     AS estado,
      c.foto_comprobante  AS foto_factura,
      c.iva,
      c.iva_valor,
      c.subtotal_base,
      c.total_compra
    FROM compras c
    JOIN proveedores p ON p.id_proveedor = c.proveedor_id
    JOIN empleados   e ON e.id_empleado  = c.empleado_id
    WHERE c.fecha_compra BETWEEN $1 AND $2
    ORDER BY c.fecha_compra DESC
  `,

  // Detalle de una compra con su detalle de insumos
  FIND_BY_ID: `
    SELECT
      c.id_compra,
      c.numero_factura,
      c.proveedor_id,
      p.nombre            AS proveedor_nombre,
      c.empleado_id,
      e.nombre            AS empleado_nombre,
      c.fecha_compra,
      c.estado_compra     AS estado,
      c.foto_comprobante  AS foto_factura,
      c.iva,
      c.iva_valor,
      c.subtotal_base,
      c.total_compra,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'insumo_id',          dc.insumo_id,
            'nombre_insumo',      i.nombre,
            'unidad_medida',      i.unidad_medida,
            'cantidad',           dc.cantidad,
            'contenido',          dc.contenido,
            'Cantidad x unidad',  dc.contenido,
            'Cant. x unidad',     dc.contenido,
            'cantidad_x_unidad',  dc.contenido,
            'Ingresado',          dc.stock_ingresado,
            'ingresado',          dc.stock_ingresado,
            'stock_ingresado',    dc.stock_ingresado,
            'precio',             dc.precio_unitario,
            'subtotal',           dc.subtotal
          ) ORDER BY dc.id_detalle
        ) FILTER (WHERE dc.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM compras c
    JOIN proveedores   p  ON p.id_proveedor = c.proveedor_id
    JOIN empleados     e  ON e.id_empleado  = c.empleado_id
    LEFT JOIN detalle_compra dc ON dc.compra_id = c.id_compra
    LEFT JOIN insumos        i  ON i.id_insumo  = dc.insumo_id
    WHERE c.id_compra = $1
    GROUP BY c.id_compra, p.nombre, e.nombre
  `,

  // ── CRUD ──────────────────────────────────────────────────────────────

  // Al crear → queda ACTIVA y suma stock inmediatamente
  CREATE: `
    INSERT INTO compras
      (proveedor_id, empleado_id, numero_factura, foto_comprobante,
       estado_compra, iva, iva_valor, subtotal_base, total_compra)
    VALUES ($1, $2, $3, $4, 'ACTIVA', $5, $6, $7, $8)
    RETURNING *
  `,

  INSERT_DETALLE: `
    INSERT INTO detalle_compra
      (compra_id, insumo_id, cantidad, contenido, stock_ingresado, precio_unitario, subtotal)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `,

  // Anular: solo si está ACTIVA, revierte stock
  ANULAR: `
    UPDATE compras
    SET estado_compra = 'ANULADA'
    WHERE id_compra = $1 AND estado_compra = 'ACTIVA'
    RETURNING *
  `,

  // Obtener detalle para poder revertir el stock al anular
  // stock_ingresado es el valor real que se sumó: cantidad × contenido
  GET_DETALLE: `
    SELECT insumo_id, cantidad, contenido,
           COALESCE(stock_ingresado, cantidad) AS stock_ingresado
    FROM detalle_compra
    WHERE compra_id = $1
  `,

  // Verificar número de factura duplicado
  FACTURA_EXISTS: `
    SELECT id_compra FROM compras
    WHERE numero_factura = $1 AND id_compra != $2
  `,
};