// src/queries/stock.queries.js

// ══════════════════════════════════════════════
//  PROVEEDORES
// ══════════════════════════════════════════════
export const PROVEEDORES_QUERIES = {

  // Solo ACTIVOS (soft delete)
  LIST: `
    SELECT
      p.id_proveedor,
      p.nombre        AS nombre_proveedor,
      p.direccion,
      p.telefono,
      p.email,
      p.estado,
      p.empleado_id,
      e.nombre        AS empleado_nombre,
      COUNT(c.id_compra) AS compras
    FROM proveedores p
    LEFT JOIN empleados e ON e.id_empleado = p.empleado_id
    LEFT JOIN compras   c ON c.proveedor_id = p.id_proveedor
    GROUP BY p.id_proveedor, e.nombre
    ORDER BY p.id_proveedor
  `,

  SEARCH: `
    SELECT
      p.id_proveedor,
      p.nombre        AS nombre_proveedor,
      p.direccion,
      p.telefono,
      p.email,
      p.estado,
      p.empleado_id,
      e.nombre        AS empleado_nombre,
      COUNT(c.id_compra) AS compras
    FROM proveedores p
    LEFT JOIN empleados e ON e.id_empleado = p.empleado_id
    LEFT JOIN compras   c ON c.proveedor_id = p.id_proveedor
    WHERE p.nombre ILIKE $1 OR p.email ILIKE $1 OR p.telefono ILIKE $1
    GROUP BY p.id_proveedor, e.nombre
    ORDER BY p.id_proveedor
  `,

  FIND_BY_ID: `
    SELECT
      p.id_proveedor,
      p.nombre        AS nombre_proveedor,
      p.direccion,
      p.telefono,
      p.email,
      p.estado,
      p.empleado_id,
      e.nombre        AS empleado_nombre,
      COUNT(c.id_compra) AS compras
    FROM proveedores p
    LEFT JOIN empleados e ON e.id_empleado = p.empleado_id
    LEFT JOIN compras   c ON c.proveedor_id = p.id_proveedor
    WHERE p.id_proveedor = $1
    GROUP BY p.id_proveedor, e.nombre
  `,

  CREATE: `
    INSERT INTO proveedores (empleado_id, nombre, direccion, telefono, email)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `,

  UPDATE: `
    UPDATE proveedores
    SET empleado_id = $1, nombre = $2, direccion = $3, telefono = $4, email = $5
    WHERE id_proveedor = $6
    RETURNING *
  `,

  TOGGLE_ESTADO: `
    UPDATE proveedores
    SET estado = CASE WHEN estado = 'ACTIVO' THEN 'INACTIVO' ELSE 'ACTIVO' END
    WHERE id_proveedor = $1
    RETURNING *
  `,

  SOFT_DELETE: `
    UPDATE proveedores
    SET estado = 'INACTIVO'
    WHERE id_proveedor = $1
    RETURNING id_proveedor, nombre, estado
  `,

  // Verificar si tiene compras antes de eliminar
  HAS_COMPRAS: `
    SELECT COUNT(*) AS total FROM compras
    WHERE proveedor_id = $1
  `,

  NOMBRE_EXISTS: `
    SELECT id_proveedor FROM proveedores
    WHERE LOWER(nombre) = LOWER($1) AND id_proveedor != $2 AND estado = 'ACTIVO'
  `,
};

// ══════════════════════════════════════════════
//  CATEGORÍAS INSUMO
// ══════════════════════════════════════════════
export const CAT_INSUMO_QUERIES = {

  LIST: `
    SELECT
      ci.id_categoria,
      ci.nombre,
      ci.estado,
      COUNT(i.id_insumo) AS total_insumos
    FROM categorias_insumo ci
    LEFT JOIN insumos i ON i.categoria_id = ci.id_categoria
    GROUP BY ci.id_categoria
    ORDER BY ci.id_categoria
  `,

  LIST_ALL: `
    SELECT id_categoria, nombre, estado
    FROM categorias_insumo
    ORDER BY nombre
  `,

  FIND_BY_ID: `
    SELECT
      ci.id_categoria,
      ci.nombre,
      ci.estado,
      COUNT(i.id_insumo) AS total_insumos
    FROM categorias_insumo ci
    LEFT JOIN insumos i ON i.categoria_id = ci.id_categoria
    WHERE ci.id_categoria = $1
    GROUP BY ci.id_categoria
  `,

  CREATE: `
    INSERT INTO categorias_insumo (nombre)
    VALUES ($1)
    RETURNING *
  `,

  UPDATE: `
    UPDATE categorias_insumo
    SET nombre = $1
    WHERE id_categoria = $2
    RETURNING *
  `,

  TOGGLE_ESTADO: `
    UPDATE categorias_insumo
    SET estado = CASE WHEN estado = 'ACTIVO' THEN 'INACTIVO' ELSE 'ACTIVO' END
    WHERE id_categoria = $1
    RETURNING *
  `,

  DELETE: `
    DELETE FROM categorias_insumo
    WHERE id_categoria = $1
    RETURNING id_categoria, nombre, estado
  `,

  HAS_INSUMOS: `
    SELECT COUNT(*) AS total FROM insumos
    WHERE categoria_id = $1
  `,

  NOMBRE_EXISTS: `
    SELECT id_categoria FROM categorias_insumo
    WHERE LOWER(nombre) = LOWER($1) AND id_categoria != $2 AND estado = 'ACTIVO'
  `,
};

// ══════════════════════════════════════════════
//  INSUMOS
// ══════════════════════════════════════════════
export const INSUMOS_QUERIES = {

  MIGRATE: `
    ALTER TABLE insumos
      ADD COLUMN IF NOT EXISTS presentacion_nombre VARCHAR(50),
      ADD COLUMN IF NOT EXISTS presentacion_contenido NUMERIC(10,2)
  `,

  // Solo ACTIVOS — alias nombre AS nombre_insumo para que coincida con el frontend
  LIST: `
    SELECT
      i.id_insumo,
      i.nombre        AS nombre_insumo,
      i.categoria_id,
      ci.nombre       AS categoria_nombre,
      i.unidad_medida,
      i.presentacion_nombre,
      i.presentacion_contenido,
      i.stock_actual,
      i.stock_minimo,
      i.precio_unitario,
      i.estado,
      (i.stock_actual < i.stock_minimo) AS stock_bajo,
      COUNT(DISTINCT dc.compra_id)      AS compras
    FROM insumos i
    LEFT JOIN categorias_insumo ci ON ci.id_categoria = i.categoria_id
    LEFT JOIN detalle_compra    dc ON dc.insumo_id    = i.id_insumo
    GROUP BY i.id_insumo, ci.nombre
    ORDER BY i.id_insumo
  `,

  SEARCH: `
    SELECT
      i.id_insumo,
      i.nombre        AS nombre_insumo,
      i.categoria_id,
      ci.nombre       AS categoria_nombre,
      i.unidad_medida,
      i.presentacion_nombre,
      i.presentacion_contenido,
      i.stock_actual,
      i.stock_minimo,
      i.precio_unitario,
      i.estado,
      (i.stock_actual < i.stock_minimo) AS stock_bajo,
      COUNT(DISTINCT dc.compra_id)      AS compras
    FROM insumos i
    LEFT JOIN categorias_insumo ci ON ci.id_categoria = i.categoria_id
    LEFT JOIN detalle_compra    dc ON dc.insumo_id    = i.id_insumo
    WHERE i.nombre ILIKE $1 OR ci.nombre ILIKE $1 OR i.unidad_medida ILIKE $1
    GROUP BY i.id_insumo, ci.nombre
    ORDER BY i.id_insumo
  `,

  // Filtrado por unidad de medida (evita filtrado en JS)
  FILTER_UNIDAD: `
    SELECT
      i.id_insumo,
      i.nombre        AS nombre_insumo,
      i.categoria_id,
      ci.nombre       AS categoria_nombre,
      i.unidad_medida,
      i.presentacion_nombre,
      i.presentacion_contenido,
      i.stock_actual,
      i.stock_minimo,
      i.precio_unitario,
      i.estado,
      (i.stock_actual < i.stock_minimo) AS stock_bajo,
      COUNT(DISTINCT dc.compra_id)      AS compras
    FROM insumos i
    LEFT JOIN categorias_insumo ci ON ci.id_categoria = i.categoria_id
    LEFT JOIN detalle_compra    dc ON dc.insumo_id    = i.id_insumo
    WHERE i.unidad_medida = $1
    GROUP BY i.id_insumo, ci.nombre
    ORDER BY i.id_insumo
  `,

  FIND_BY_ID: `
    SELECT
      i.id_insumo,
      i.nombre        AS nombre_insumo,
      i.categoria_id,
      ci.nombre       AS categoria_nombre,
      i.unidad_medida,
      i.presentacion_nombre,
      i.presentacion_contenido,
      i.stock_actual,
      i.stock_minimo,
      i.precio_unitario,
      i.estado,
      (i.stock_actual < i.stock_minimo) AS stock_bajo
    FROM insumos i
    LEFT JOIN categorias_insumo ci ON ci.id_categoria = i.categoria_id
    WHERE i.id_insumo = $1
  `,

  // Insumos con stock por debajo del mínimo (para alertas del dashboard)
  STOCK_BAJO: `
    SELECT
      i.id_insumo,
      i.nombre        AS nombre_insumo,
      i.unidad_medida,
      i.presentacion_nombre,
      i.presentacion_contenido,
      i.stock_actual,
      i.stock_minimo,
      ci.nombre       AS categoria_nombre
    FROM insumos i
    LEFT JOIN categorias_insumo ci ON ci.id_categoria = i.categoria_id
    WHERE i.estado = 'ACTIVO'
      AND i.stock_actual < i.stock_minimo
    ORDER BY (i.stock_actual - i.stock_minimo) ASC
  `,

  CREATE: `
    INSERT INTO insumos (
      nombre, categoria_id, unidad_medida,
      presentacion_nombre, presentacion_contenido,
      stock_actual, stock_minimo, precio_unitario
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `,

  UPDATE: `
    UPDATE insumos
    SET nombre = $1, categoria_id = $2, unidad_medida = $3,
      presentacion_nombre = $4, presentacion_contenido = $5,
      stock_actual = $6, stock_minimo = $7, precio_unitario = $8
    WHERE id_insumo = $9
    RETURNING *
  `,

  // Regla: no desactivar si stock_actual > 0
  TOGGLE_ESTADO: `
    UPDATE insumos
    SET estado = CASE WHEN estado = 'ACTIVO' THEN 'INACTIVO' ELSE 'ACTIVO' END
    WHERE id_insumo = $1
    RETURNING *
  `,

  HARD_DELETE: `
    DELETE FROM insumos
    WHERE id_insumo = $1
    RETURNING id_insumo, nombre
  `,

  // Para validar canToggle y canDelete
  CHECK_STOCK: `
    SELECT stock_actual FROM insumos WHERE id_insumo = $1
  `,

  HAS_COMPRAS: `
    SELECT COUNT(*) AS total FROM detalle_compra WHERE insumo_id = $1
  `,

  NOMBRE_EXISTS: `
    SELECT id_insumo FROM insumos
    WHERE LOWER(nombre) = LOWER($1) AND id_insumo != $2 AND estado = 'ACTIVO'
  `,

  // Suma al stock (usada por Compras al registrar)
  SUMAR_STOCK: `
    UPDATE insumos
    SET stock_actual = stock_actual + $1
    WHERE id_insumo = $2
    RETURNING id_insumo, nombre, stock_actual
  `,

  // Resta al stock (usada por Salidas y Producción)
  RESTAR_STOCK: `
    UPDATE insumos
    SET stock_actual = stock_actual - $1
    WHERE id_insumo = $2
      AND stock_actual >= $1
    RETURNING id_insumo, nombre, stock_actual
  `,

  // Búsqueda tolerante por nombre (normaliza espacios y mayusculas)
  FIND_BY_NOMBRE: `
        SELECT id_insumo, nombre, stock_actual, categoria_id, unidad_medida,
          presentacion_nombre, presentacion_contenido, precio_unitario, estado
    FROM insumos
    WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))
    LIMIT 1
  `,

  // Stock anterior antes de sumar (necesario para auditoria)
  GET_STOCK_ACTUAL: `
    SELECT stock_actual FROM insumos WHERE id_insumo = $1
  `,
};

// ══════════════════════════════════════════════
//  MOVIMIENTOS DE INVENTARIO (AUDITÍA)
// ══════════════════════════════════════════════
export const MOVIMIENTOS_QUERIES = {

  MIGRATE: `
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id_movimiento   SERIAL PRIMARY KEY,
      insumo_id       INT          NOT NULL REFERENCES insumos(id_insumo),
      tipo_movimiento VARCHAR(20)  NOT NULL
                      CHECK (tipo_movimiento IN ('ENTRADA','SALIDA','AJUSTE')),
      cantidad        DECIMAL(10,2) NOT NULL,
      stock_anterior  DECIMAL(10,2) NOT NULL,
      stock_nuevo     DECIMAL(10,2) NOT NULL,
      referencia      VARCHAR(50),
      usuario_id      INT          REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
      fecha           TIMESTAMP    DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_mov_insumo ON movimientos_inventario(insumo_id);
    CREATE INDEX IF NOT EXISTS idx_mov_fecha  ON movimientos_inventario(fecha DESC);
  `,

  REGISTRAR: `
    INSERT INTO movimientos_inventario
      (insumo_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia, usuario_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `,

  LIST_BY_INSUMO: `
    SELECT
      m.id_movimiento,
      m.tipo_movimiento,
      m.cantidad,
      m.stock_anterior,
      m.stock_nuevo,
      m.referencia,
      m.fecha,
      u.correo AS usuario
    FROM movimientos_inventario m
    LEFT JOIN usuarios u ON u.id_usuario = m.usuario_id
    WHERE m.insumo_id = $1
    ORDER BY m.fecha DESC
    LIMIT 100
  `,
};