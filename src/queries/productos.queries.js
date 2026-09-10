// src/queries/productos.queries.js

// ══════════════════════════════════════════════
//  CATEGORÍAS PRODUCTO
// ══════════════════════════════════════════════
export const CAT_PRODUCTO_QUERIES = {

  LIST: `
    SELECT
      cp.id_categoria,
      cp.nombre,
      cp.estado,
      COUNT(p.id_producto) AS total_productos
    FROM categorias_producto cp
    LEFT JOIN productos p
      ON p.categoria_id = cp.id_categoria
    GROUP BY cp.id_categoria
    ORDER BY cp.id_categoria
  `,

  // Para selects de formularios
  LIST_ALL: `
    SELECT
      id_categoria,
      nombre,
      estado
    FROM categorias_producto
    ORDER BY nombre
  `,

  FIND_BY_ID: `
    SELECT
      cp.id_categoria,
      cp.nombre,
      cp.estado,
      COUNT(p.id_producto) AS total_productos
    FROM categorias_producto cp
    LEFT JOIN productos p
      ON p.categoria_id = cp.id_categoria
    WHERE cp.id_categoria = $1
    GROUP BY cp.id_categoria
  `,

  CREATE: `
    INSERT INTO categorias_producto (nombre)
    VALUES ($1)
    RETURNING *
  `,

  UPDATE: `
    UPDATE categorias_producto
    SET nombre = $1
    WHERE id_categoria = $2
    RETURNING *
  `,

  TOGGLE_ESTADO: `
    UPDATE categorias_producto
    SET estado =
      CASE
        WHEN estado = 'ACTIVO'
        THEN 'INACTIVO'
        ELSE 'ACTIVO'
      END
    WHERE id_categoria = $1
    RETURNING *
  `,

  DELETE: `
    DELETE FROM categorias_producto
    WHERE id_categoria = $1
    RETURNING
      id_categoria,
      nombre,
      estado
  `,

  HAS_PRODUCTOS: `
    SELECT COUNT(*) AS total
    FROM productos
    WHERE categoria_id = $1
  `,

  NOMBRE_EXISTS: `
    SELECT id_categoria
    FROM categorias_producto
    WHERE LOWER(nombre) = LOWER($1)
      AND id_categoria != $2
  `,
};

// ══════════════════════════════════════════════
//  PRODUCTOS
// ══════════════════════════════════════════════
export const PRODUCTOS_QUERIES = {

  STOCK_MINIMO_ALERTA: 5,

  // ─────────────────────────────────────────
  // LISTAR PRODUCTOS
  // ─────────────────────────────────────────
  LIST: `
    SELECT
      p.id_producto,
      p.nombre,
      p.imagen,
      p.categoria_id,
      cp.nombre AS categoria_nombre,
      p.precio,
      p.stock_producto,
      p.es_nuevo,
      p.es_temporada,
      p.estado,

      (p.stock_producto < 5) AS stock_bajo,

      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id_detalle',         dp.id_detalle_producto,
            'insumo_id',          dp.insumo_id,
            'nombre_insumo',      i.nombre,
            'cantidad_requerida', dp.cantidad_requerida,
            'unidad',             i.unidad_medida
          )
          ORDER BY dp.id_detalle_producto
        )
        FILTER (WHERE dp.id_detalle_producto IS NOT NULL),
        '[]'
      ) AS receta

    FROM productos p

    LEFT JOIN categorias_producto cp
      ON cp.id_categoria = p.categoria_id

    LEFT JOIN detalle_producto dp
      ON dp.producto_id = p.id_producto

    LEFT JOIN insumos i
      ON i.id_insumo = dp.insumo_id

    GROUP BY
      p.id_producto,
      cp.nombre

    ORDER BY p.id_producto
  `,

  // ─────────────────────────────────────────
  // BUSCAR PRODUCTOS (legacy – sin paginar)
  // ─────────────────────────────────────────
  SEARCH: `
    SELECT
      p.id_producto,
      p.nombre,
      p.imagen,
      p.categoria_id,
      cp.nombre AS categoria_nombre,
      p.precio,
      p.stock_producto,
      p.es_nuevo,
      p.es_temporada,
      p.estado,

      (p.stock_producto < 5) AS stock_bajo,

      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id_detalle',         dp.id_detalle_producto,
            'insumo_id',          dp.insumo_id,
            'nombre_insumo',      i.nombre,
            'cantidad_requerida', dp.cantidad_requerida,
            'unidad',             i.unidad_medida
          )
          ORDER BY dp.id_detalle_producto
        )
        FILTER (WHERE dp.id_detalle_producto IS NOT NULL),
        '[]'
      ) AS receta

    FROM productos p

    LEFT JOIN categorias_producto cp
      ON cp.id_categoria = p.categoria_id

    LEFT JOIN detalle_producto dp
      ON dp.producto_id = p.id_producto

    LEFT JOIN insumos i
      ON i.id_insumo = dp.insumo_id

    WHERE (
        p.nombre ILIKE $1
        OR cp.nombre ILIKE $1
      )

    GROUP BY
      p.id_producto,
      cp.nombre

    ORDER BY p.id_producto
  `,

  // ─────────────────────────────────────────
  // BÚSQUEDA PAGINADA (catálogo público)
  // $1 = término ILIKE  $2 = categoria_id (NULL = todos)
  // $3 = LIMIT   $4 = OFFSET
  // ─────────────────────────────────────────
  SEARCH_PAGINATED: (orderClause) => `
    SELECT
      p.id_producto,
      p.nombre,
      p.imagen,
      p.categoria_id,
      cp.nombre AS categoria_nombre,
      p.precio,
      p.stock_producto,
      p.es_nuevo,
      p.es_temporada,
      (p.stock_producto < 5) AS stock_bajo
    FROM productos p
    LEFT JOIN categorias_producto cp
      ON cp.id_categoria = p.categoria_id
    WHERE p.estado = 'ACTIVO'
      AND (p.es_temporada IS FALSE OR p.es_temporada IS NULL)
      AND ($1::TEXT IS NULL OR p.nombre  ILIKE $1
                            OR cp.nombre ILIKE $1)
      AND ($2::INT  IS NULL OR p.categoria_id = $2)
    ORDER BY ${orderClause}
    LIMIT $3 OFFSET $4
  `,

  SEARCH_PAGINATED_COUNT: `
    SELECT COUNT(*) AS total
    FROM productos p
    LEFT JOIN categorias_producto cp
      ON cp.id_categoria = p.categoria_id
    WHERE p.estado = 'ACTIVO'
      AND (p.es_temporada IS FALSE OR p.es_temporada IS NULL)
      AND ($1::TEXT IS NULL OR p.nombre  ILIKE $1
                            OR cp.nombre ILIKE $1)
      AND ($2::INT  IS NULL OR p.categoria_id = $2)
  `,

  // ─────────────────────────────────────────
  // BUSCAR POR ID
  // ─────────────────────────────────────────
  FIND_BY_ID: `
    SELECT
      p.id_producto,
      p.nombre,
      p.imagen,
      p.categoria_id,
      cp.nombre AS categoria_nombre,
      p.precio,
      p.stock_producto,
      p.es_nuevo,
      p.es_temporada,
      p.estado,

      (p.stock_producto < 5) AS stock_bajo,

      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id_detalle',         dp.id_detalle_producto,
            'insumo_id',          dp.insumo_id,
            'nombre_insumo',      i.nombre,
            'cantidad_requerida', dp.cantidad_requerida,
            'unidad',             i.unidad_medida
          )
          ORDER BY dp.id_detalle_producto
        )
        FILTER (WHERE dp.id_detalle_producto IS NOT NULL),
        '[]'
      ) AS receta

    FROM productos p

    LEFT JOIN categorias_producto cp
      ON cp.id_categoria = p.categoria_id

    LEFT JOIN detalle_producto dp
      ON dp.producto_id = p.id_producto

    LEFT JOIN insumos i
      ON i.id_insumo = dp.insumo_id

    WHERE p.id_producto = $1

    GROUP BY
      p.id_producto,
      cp.nombre
  `,

  // ─────────────────────────────────────────
  // STOCK BAJO
  // ─────────────────────────────────────────
  STOCK_BAJO: `
    SELECT
      p.id_producto,
      p.nombre,
      p.imagen,
      p.stock_producto,
      cp.nombre AS categoria_nombre

    FROM productos p

    LEFT JOIN categorias_producto cp
      ON cp.id_categoria = p.categoria_id

    WHERE p.estado = 'ACTIVO'
      AND p.stock_producto < 5

    ORDER BY p.stock_producto ASC
  `,

  // ─────────────────────────────────────────
  // SELECTS
  // ─────────────────────────────────────────
  LIST_ACTIVOS_SELECT: `
    SELECT
      id_producto,
      nombre,
      imagen,
      precio,
      stock_producto,
      categoria_id
    FROM productos
    WHERE estado = 'ACTIVO'
    ORDER BY nombre
  `,

  // ─────────────────────────────────────────
  // CREAR
  // ─────────────────────────────────────────
  CREATE: `
    INSERT INTO productos (
      nombre,
      categoria_id,
      precio,
      stock_producto,
      imagen,
      es_nuevo,
      es_temporada
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `,

  // ─────────────────────────────────────────
  // ACTUALIZAR
  // ─────────────────────────────────────────
  UPDATE: `
    UPDATE productos
    SET
      nombre          = $1,
      categoria_id    = $2,
      precio          = $3,
      stock_producto  = $4,
      imagen          = $5,
      es_nuevo        = $6,
      es_temporada    = $7
    WHERE id_producto = $8
    RETURNING *
  `,

  // ─────────────────────────────────────────
  // CAMBIAR ESTADO
  // ─────────────────────────────────────────
  TOGGLE_ESTADO: `
    UPDATE productos
    SET estado =
      CASE
        WHEN estado = 'ACTIVO'
        THEN 'INACTIVO'
        ELSE 'ACTIVO'
      END
    WHERE id_producto = $1
    RETURNING *
  `,

  // ─────────────────────────────────────────
  // ELIMINAR LÓGICO
  // ─────────────────────────────────────────
  SOFT_DELETE: `
    UPDATE productos
    SET estado = 'INACTIVO'
    WHERE id_producto = $1
    RETURNING
      id_producto,
      nombre,
      estado,
      imagen
  `,

  // ─────────────────────────────────────────
  // VALIDAR NOMBRE
  // ─────────────────────────────────────────
  NOMBRE_EXISTS: `
    SELECT id_producto
    FROM productos
    WHERE LOWER(nombre) = LOWER($1)
        AND id_producto != $2
        AND estado = 'ACTIVO'
      `,

  // ══════════════════════════════════════════
  // RECETA
  // ══════════════════════════════════════════

  DELETE_RECETA: `
    DELETE FROM detalle_producto
    WHERE producto_id = $1
  `,

  INSERT_RECETA_ITEM: `
    INSERT INTO detalle_producto (
      producto_id,
      insumo_id,
      cantidad_requerida
    )
    VALUES ($1, $2, $3)
  `,

  // ══════════════════════════════════════════
  // STOCK
  // ══════════════════════════════════════════

  SUMAR_STOCK: `
    UPDATE productos
    SET stock_producto = stock_producto + $1
    WHERE id_producto = $2
    RETURNING
      id_producto,
      nombre,
      stock_producto
  `,

  RESTAR_STOCK: `
    UPDATE productos
    SET stock_producto = stock_producto - $1
    WHERE id_producto = $2
      AND stock_producto >= $1
    RETURNING
      id_producto,
      nombre,
      stock_producto
  `,

  CHECK_STOCK: `
    SELECT stock_producto
    FROM productos
    WHERE id_producto = $1
  `,

  // ─────────────────────────────────────────
  // MIGRACIÓN: columnas es_nuevo / es_temporada
  // ─────────────────────────────────────────
  MIGRATE_BADGES: `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'productos' AND column_name = 'es_nuevo'
      ) THEN
        ALTER TABLE productos ADD COLUMN es_nuevo BOOLEAN NOT NULL DEFAULT FALSE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'productos' AND column_name = 'es_temporada'
      ) THEN
        ALTER TABLE productos ADD COLUMN es_temporada BOOLEAN NOT NULL DEFAULT FALSE;
      END IF;
    END;
    $$;
  `,

  MIGRATE_NAME_UNIQUE: `
    ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_nombre_key;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_productos_nombre_activo
      ON productos (LOWER(nombre))
      WHERE estado = 'ACTIVO';

    ALTER TABLE categorias_insumo DROP CONSTRAINT IF EXISTS categorias_insumo_nombre_key;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_categorias_insumo_nombre_activo
      ON categorias_insumo (nombre) WHERE estado = 'ACTIVO';

    ALTER TABLE categorias_producto DROP CONSTRAINT IF EXISTS categorias_producto_nombre_key;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_categorias_producto_nombre_activo
      ON categorias_producto (nombre) WHERE estado = 'ACTIVO';

    ALTER TABLE insumos DROP CONSTRAINT IF EXISTS insumos_nombre_key;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_insumos_nombre_activo
      ON insumos (nombre) WHERE estado = 'ACTIVO';

    ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_nombre_key;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_roles_nombre_activo
      ON roles (nombre) WHERE estado = 'ACTIVO';

    ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_correo_key;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_correo_activo
      ON usuarios (LOWER(correo)) WHERE estado = 'ACTIVO';

    ALTER TABLE empleados DROP CONSTRAINT IF EXISTS empleados_documento_key;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_empleados_documento_activo
      ON empleados (documento) WHERE estado = 'ACTIVO';

    ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_documento_key;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_clientes_documento_activo
      ON clientes (documento) WHERE estado = 'ACTIVO';
  `,

  // ─────────────────────────────────────────
  // PRODUCTOS NUEVOS / TEMPORADA (endpoint público)
  // ─────────────────────────────────────────
  LIST_NUEVO: `
    SELECT
      p.id_producto,
      p.nombre,
      p.imagen,
      p.categoria_id,
      cp.nombre    AS categoria_nombre,
      p.precio,
      p.stock_producto,
      p.es_nuevo,
      p.es_temporada
    FROM productos p
    LEFT JOIN categorias_producto cp
      ON cp.id_categoria = p.categoria_id
    WHERE p.estado = 'ACTIVO'
      AND (p.es_nuevo = TRUE OR p.es_temporada = TRUE)
    ORDER BY p.es_temporada DESC, p.id_producto DESC
    LIMIT $1
  `,

  // ─────────────────────────────────────────
  // PRODUCTOS DE TEMPORADA EXCLUSIVAMENTE
  // ─────────────────────────────────────────
  LIST_TEMPORADA: `
    SELECT
      p.id_producto,
      p.nombre,
      p.imagen,
      p.categoria_id,
      cp.nombre    AS categoria_nombre,
      p.precio,
      p.stock_producto,
      p.es_nuevo,
      p.es_temporada
    FROM productos p
    LEFT JOIN categorias_producto cp
      ON cp.id_categoria = p.categoria_id
    WHERE p.estado = 'ACTIVO'
      AND p.es_temporada = TRUE
    ORDER BY p.id_producto DESC
  `,
};