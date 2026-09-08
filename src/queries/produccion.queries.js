// src/queries/produccion.queries.js

// ══════════════════════════════════════════════
//  PRODUCCIÓN
// ══════════════════════════════════════════════
export const PRODUCCION_QUERIES = {

  // Migración: agregar columna observaciones
  MIGRATE: `
    ALTER TABLE produccion
      ADD COLUMN IF NOT EXISTS observaciones VARCHAR(255);
  `,

  LIST: `
    SELECT
      pr.id_produccion,
      pr.empleado_id,
      e.nombre          AS empleado_nombre,
      pr.fecha,
      pr.estado,
      pr.motivo_anulacion,
      pr.observaciones,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id',      dp.producto_id,
            'producto_nombre',  p.nombre,
            'cantidad',         dp.cantidad
          ) ORDER BY dp.id_detalle
        ) FILTER (WHERE dp.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM produccion pr
    JOIN empleados e ON e.id_empleado = pr.empleado_id
    LEFT JOIN detalle_produccion dp ON dp.produccion_id = pr.id_produccion
    LEFT JOIN productos          p  ON p.id_producto    = dp.producto_id
    GROUP BY pr.id_produccion, e.nombre
    ORDER BY pr.fecha DESC, pr.id_produccion DESC
  `,

  FILTER_ESTADO: `
    SELECT
      pr.id_produccion,
      pr.empleado_id,
      e.nombre          AS empleado_nombre,
      pr.fecha,
      pr.estado,
      pr.motivo_anulacion,
      pr.observaciones,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id',      dp.producto_id,
            'producto_nombre',  p.nombre,
            'cantidad',         dp.cantidad
          ) ORDER BY dp.id_detalle
        ) FILTER (WHERE dp.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM produccion pr
    JOIN empleados e ON e.id_empleado = pr.empleado_id
    LEFT JOIN detalle_produccion dp ON dp.produccion_id = pr.id_produccion
    LEFT JOIN productos          p  ON p.id_producto    = dp.producto_id
    WHERE pr.estado = $1
    GROUP BY pr.id_produccion, e.nombre
    ORDER BY pr.fecha DESC
  `,

  FILTER_FECHAS: `
    SELECT
      pr.id_produccion,
      pr.empleado_id,
      e.nombre          AS empleado_nombre,
      pr.fecha,
      pr.estado,
      pr.motivo_anulacion,
      pr.observaciones,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id',      dp.producto_id,
            'producto_nombre',  p.nombre,
            'cantidad',         dp.cantidad
          ) ORDER BY dp.id_detalle
        ) FILTER (WHERE dp.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM produccion pr
    JOIN empleados e ON e.id_empleado = pr.empleado_id
    LEFT JOIN detalle_produccion dp ON dp.produccion_id = pr.id_produccion
    LEFT JOIN productos          p  ON p.id_producto    = dp.producto_id
    WHERE pr.fecha BETWEEN $1 AND $2
    GROUP BY pr.id_produccion, e.nombre
    ORDER BY pr.fecha DESC
  `,

  // Filtrado por nombre de empleado (evita filtrado en JS)
  FILTER_EMPLEADO: `
    SELECT
      pr.id_produccion,
      pr.empleado_id,
      e.nombre          AS empleado_nombre,
      pr.fecha,
      pr.estado,
      pr.motivo_anulacion,
      pr.observaciones,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id',      dp.producto_id,
            'producto_nombre',  p.nombre,
            'cantidad',         dp.cantidad
          ) ORDER BY dp.id_detalle
        ) FILTER (WHERE dp.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM produccion pr
    JOIN empleados e ON e.id_empleado = pr.empleado_id
    LEFT JOIN detalle_produccion dp ON dp.produccion_id = pr.id_produccion
    LEFT JOIN productos          p  ON p.id_producto    = dp.producto_id
    WHERE e.nombre ILIKE $1
    GROUP BY pr.id_produccion, e.nombre
    ORDER BY pr.fecha DESC
  `,

  FIND_BY_ID: `
    SELECT
      pr.id_produccion,
      pr.empleado_id,
      e.nombre          AS empleado_nombre,
      pr.fecha,
      pr.estado,
      pr.motivo_anulacion,
      pr.observaciones,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id',      dp.producto_id,
            'producto_nombre',  p.nombre,
            'cantidad',         dp.cantidad
          ) ORDER BY dp.id_detalle
        ) FILTER (WHERE dp.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM produccion pr
    JOIN empleados e ON e.id_empleado = pr.empleado_id
    LEFT JOIN detalle_produccion dp ON dp.produccion_id = pr.id_produccion
    LEFT JOIN productos          p  ON p.id_producto    = dp.producto_id
    WHERE pr.id_produccion = $1
    GROUP BY pr.id_produccion, e.nombre
  `,

  CREATE: `
    INSERT INTO produccion (empleado_id, fecha, observaciones, estado)
    VALUES ($1, $2, $3, 'REGISTRADA')
    RETURNING *
  `,

  INSERT_DETALLE: `
    INSERT INTO detalle_produccion (produccion_id, producto_id, cantidad)
    VALUES ($1, $2, $3)
  `,

  // Trae la receta de un producto para calcular insumos a descontar
  GET_RECETA: `
    SELECT insumo_id, cantidad_requerida
    FROM detalle_producto
    WHERE producto_id = $1
  `,

  // Para revertir al anular: trae detalle con su receta
  GET_DETALLE_COMPLETO: `
    SELECT
      dp.producto_id,
      dp.cantidad,
      r.insumo_id,
      r.cantidad_requerida
    FROM detalle_produccion dp
    JOIN detalle_producto    r ON r.producto_id = dp.producto_id
    WHERE dp.produccion_id = $1
  `,

  ANULAR: `
    UPDATE produccion
    SET estado = 'ANULADA', motivo_anulacion = $1
    WHERE id_produccion = $2 AND estado = 'REGISTRADA'
    RETURNING *
  `,
};

// ══════════════════════════════════════════════
//  SALIDAS DE INSUMOS
// ══════════════════════════════════════════════
export const SALIDAS_QUERIES = {

  LIST: `
    SELECT
      s.id_salida,
      s.empleado_id,
      e.nombre        AS empleado_nombre,
      s.fecha,
      s.motivo,
      s.estado,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id_detalle',    ds.id_detalle,
            'insumo_id',     ds.insumo_id,
            'nombre_insumo', i.nombre,
            'unidad_medida', i.unidad_medida,
            'cantidad',      ds.cantidad
          ) ORDER BY ds.id_detalle
        ) FILTER (WHERE ds.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM salida_insumos s
    JOIN empleados e ON e.id_empleado = s.empleado_id
    LEFT JOIN detalle_salida_insumos ds ON ds.salida_id  = s.id_salida
    LEFT JOIN insumos                i  ON i.id_insumo   = ds.insumo_id
    GROUP BY s.id_salida, e.nombre
    ORDER BY s.fecha DESC, s.id_salida DESC
  `,

  SEARCH: `
    SELECT
      s.id_salida,
      s.empleado_id,
      e.nombre        AS empleado_nombre,
      s.fecha,
      s.motivo,
      s.estado,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id_detalle',    ds.id_detalle,
            'insumo_id',     ds.insumo_id,
            'nombre_insumo', i.nombre,
            'unidad_medida', i.unidad_medida,
            'cantidad',      ds.cantidad
          ) ORDER BY ds.id_detalle
        ) FILTER (WHERE ds.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM salida_insumos s
    JOIN empleados e ON e.id_empleado = s.empleado_id
    LEFT JOIN detalle_salida_insumos ds ON ds.salida_id  = s.id_salida
    LEFT JOIN insumos                i  ON i.id_insumo   = ds.insumo_id
    WHERE e.nombre ILIKE $1 OR s.motivo ILIKE $1
    GROUP BY s.id_salida, e.nombre
    ORDER BY s.fecha DESC
  `,

  FILTER_FECHAS: `
    SELECT
      s.id_salida,
      s.empleado_id,
      e.nombre        AS empleado_nombre,
      s.fecha,
      s.motivo,
      s.estado,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id_detalle',    ds.id_detalle,
            'insumo_id',     ds.insumo_id,
            'nombre_insumo', i.nombre,
            'unidad_medida', i.unidad_medida,
            'cantidad',      ds.cantidad
          ) ORDER BY ds.id_detalle
        ) FILTER (WHERE ds.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM salida_insumos s
    JOIN empleados e ON e.id_empleado = s.empleado_id
    LEFT JOIN detalle_salida_insumos ds ON ds.salida_id  = s.id_salida
    LEFT JOIN insumos                i  ON i.id_insumo   = ds.insumo_id
    WHERE s.fecha BETWEEN $1 AND $2
    GROUP BY s.id_salida, e.nombre
    ORDER BY s.fecha DESC
  `,

  FIND_BY_ID: `
    SELECT
      s.id_salida,
      s.empleado_id,
      e.nombre        AS empleado_nombre,
      s.fecha,
      s.motivo,
      s.estado,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id_detalle',    ds.id_detalle,
            'insumo_id',     ds.insumo_id,
            'nombre_insumo', i.nombre,
            'unidad_medida', i.unidad_medida,
            'cantidad',      ds.cantidad
          ) ORDER BY ds.id_detalle
        ) FILTER (WHERE ds.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM salida_insumos s
    JOIN empleados e ON e.id_empleado = s.empleado_id
    LEFT JOIN detalle_salida_insumos ds ON ds.salida_id  = s.id_salida
    LEFT JOIN insumos                i  ON i.id_insumo   = ds.insumo_id
    WHERE s.id_salida = $1
    GROUP BY s.id_salida, e.nombre
  `,

  CREATE: `
    INSERT INTO salida_insumos (empleado_id, motivo, estado)
    VALUES ($1, $2, 'REGISTRADA')
    RETURNING *
  `,

  INSERT_DETALLE: `
    INSERT INTO detalle_salida_insumos (salida_id, insumo_id, cantidad)
    VALUES ($1, $2, $3)
  `,

  GET_DETALLE: `
    SELECT insumo_id, cantidad FROM detalle_salida_insumos WHERE salida_id = $1
  `,

  // Anular = restaura stock
  ANULAR: `
    UPDATE salida_insumos
    SET estado = 'ANULADA'
    WHERE id_salida = $1 AND estado = 'REGISTRADA'
    RETURNING *
  `,
};