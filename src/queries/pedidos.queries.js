// src/queries/pedidos.queries.js

// ══════════════════════════════════════════════
//  CLIENTES
// ══════════════════════════════════════════════
export const CLIENTES_QUERIES = {

  // Migraciones individuales de clientes (una por columna, evita fallo en Neon/PostgreSQL)
  MIGRATE: `
    ALTER TABLE clientes
      ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20) DEFAULT 'CC';
  `,
  MIGRATE_EMAIL: `
    ALTER TABLE clientes
      ADD COLUMN IF NOT EXISTS email VARCHAR(100);
  `,
  MIGRATE_USUARIO_ID: `
    ALTER TABLE clientes
      ADD COLUMN IF NOT EXISTS usuario_id INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL;
  `,

  // Migrar datos de id_usuario → usuario_id si la columna antigua existe
  MIGRATE_ID_USUARIO: `
    UPDATE clientes
    SET usuario_id = id_usuario
    WHERE usuario_id IS NULL
      AND id_usuario IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clientes' AND column_name = 'id_usuario'
      );
  `,

  // Eliminar constraint FK de id_usuario si existe
  DROP_ID_USUARIO_FK: `
    ALTER TABLE clientes
      DROP CONSTRAINT IF EXISTS clientes_id_usuario_fkey;
  `,

  // Eliminar constraint UNIQUE de id_usuario si existe
  DROP_ID_USUARIO_UNIQUE: `
    ALTER TABLE clientes
      DROP CONSTRAINT IF EXISTS clientes_id_usuario_key;
  `,

  // Eliminar columna id_usuario si existe
  DROP_ID_USUARIO_COL: `
    ALTER TABLE clientes
      DROP COLUMN IF EXISTS id_usuario;
  `,

  // Desvincular clientes cuyo usuario_id apunta a un rol distinto de Cliente
  REMOVE_NON_CLIENTE_ROLE: `
    UPDATE clientes c
    SET usuario_id = NULL
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.rol_id
    WHERE c.usuario_id = u.id_usuario
      AND r.nombre != 'Cliente'
  `,

  // Vincular clientes huérfanos con usuarios por correo coincidente (solo rol Cliente)
  SYNC_USUARIO_ID: `
    UPDATE clientes c
    SET usuario_id = u.id_usuario
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.rol_id
    WHERE LOWER(c.email) = LOWER(u.correo)
      AND r.nombre = 'Cliente'
      AND c.usuario_id IS NULL
  `,

  // SOLO clientes con usuario activo de rol Cliente (INNER JOIN estricto)
  LIST: `
    SELECT
      c.id_cliente,
      c.usuario_id,
      u.correo          AS usuario_correo,
      c.nombre,
      c.tipo_documento,
      c.documento       AS numero_documento,
      c.telefono,
      c.email,
      c.direccion,
      c.estado,
      COUNT(p.id_pedido) AS pedidos
    FROM clientes c
    INNER JOIN usuarios u ON u.id_usuario = c.usuario_id
    INNER JOIN roles   r ON r.id_rol = u.rol_id AND r.nombre = 'Cliente'
    LEFT  JOIN pedidos p ON p.cliente_id = c.id_cliente
    GROUP BY c.id_cliente, u.correo
    ORDER BY c.id_cliente
  `,

  SEARCH: `
    SELECT
      c.id_cliente,
      c.usuario_id,
      u.correo          AS usuario_correo,
      c.nombre,
      c.tipo_documento,
      c.documento       AS numero_documento,
      c.telefono,
      c.email,
      c.direccion,
      c.estado,
      COUNT(p.id_pedido) AS pedidos
    FROM clientes c
    INNER JOIN usuarios u ON u.id_usuario = c.usuario_id
    INNER JOIN roles   r ON r.id_rol = u.rol_id AND r.nombre = 'Cliente'
    LEFT  JOIN pedidos p ON p.cliente_id = c.id_cliente
    WHERE (c.nombre    ILIKE $1
        OR c.documento ILIKE $1
        OR c.email     ILIKE $1
        OR u.correo    ILIKE $1)
    GROUP BY c.id_cliente, u.correo
    ORDER BY c.id_cliente
  `,

  FIND_BY_ID: `
    SELECT
      c.id_cliente,
      c.usuario_id,
      u.correo          AS usuario_correo,
      c.nombre,
      c.tipo_documento,
      c.documento       AS numero_documento,
      c.telefono,
      c.email,
      c.direccion,
      c.estado,
      COUNT(p.id_pedido) AS pedidos
    FROM clientes c
    INNER JOIN usuarios u ON u.id_usuario = c.usuario_id
    INNER JOIN roles   r ON r.id_rol = u.rol_id AND r.nombre = 'Cliente'
    LEFT  JOIN pedidos p ON p.cliente_id = c.id_cliente
    WHERE c.id_cliente = $1
    GROUP BY c.id_cliente, u.correo
  `,

  // Para select en formularios de pedidos
  LIST_SELECT: `
    SELECT id_cliente, nombre, documento AS numero_documento, telefono
    FROM clientes
    WHERE estado = 'ACTIVO'
    ORDER BY nombre
  `,

  // $7 = usuario_id (puede ser NULL)
  CREATE: `
    INSERT INTO clientes (nombre, tipo_documento, documento, telefono, email, direccion, usuario_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `,

  UPDATE: `
    UPDATE clientes
    SET nombre = $1, tipo_documento = $2, documento = $3,
        telefono = $4, email = $5, direccion = $6
    WHERE id_cliente = $7
    RETURNING *
  `,

  // Vincular usuario a cliente existente
  SET_USUARIO_ID: `
    UPDATE clientes SET usuario_id = $1 WHERE id_cliente = $2
  `,

  // Buscar cliente por usuario_id
  FIND_BY_USUARIO_ID: `
    SELECT id_cliente FROM clientes WHERE usuario_id = $1
  `,

  // Usuarios con rol Cliente sin cliente asociado
  USUARIOS_CLIENTE_SIN_REGISTRO: `
    SELECT u.id_usuario, u.correo, u.nombre_usuario
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.rol_id
    WHERE r.nombre = 'Cliente'
      AND u.id_usuario NOT IN (
        SELECT usuario_id FROM clientes WHERE usuario_id IS NOT NULL
      )
  `,

  TOGGLE_ESTADO: `
    UPDATE clientes
    SET estado = CASE WHEN estado = 'ACTIVO' THEN 'INACTIVO' ELSE 'ACTIVO' END
    WHERE id_cliente = $1
    RETURNING *
  `,

  SOFT_DELETE: `
    UPDATE clientes SET estado = 'INACTIVO'
    WHERE id_cliente = $1
    RETURNING id_cliente, nombre, estado
  `,

  DOCUMENTO_EXISTS: `
    SELECT id_cliente FROM clientes
    WHERE documento = $1 AND id_cliente != $2
  `,

  EMAIL_EXISTS: `
    SELECT id_cliente FROM clientes
    WHERE LOWER(email) = LOWER($1) AND id_cliente != $2 AND email IS NOT NULL
  `,
};

// ══════════════════════════════════════════════
//  PEDIDOS
// ══════════════════════════════════════════════
export const PEDIDOS_QUERIES = {

  // Migración: columnas adicionales que usa el frontend
  MIGRATE: `
    ALTER TABLE pedidos
      ADD COLUMN IF NOT EXISTS numero_pedido  VARCHAR(20) UNIQUE,
      ADD COLUMN IF NOT EXISTS fecha_entrega  TIMESTAMP,
      ADD COLUMN IF NOT EXISTS observaciones  VARCHAR(255),
      ADD COLUMN IF NOT EXISTS created_by     VARCHAR(100);

    -- Ampliar el CHECK de estado para los 7 estados del frontend
    ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
    ALTER TABLE pedidos
      ADD CONSTRAINT pedidos_estado_check
      CHECK (estado IN (
        'ACTIVO',
        'EN_ESPERA_FECHA',
        'CON_FECHA_ASIGNADA',
        'ACEPTADO',
        'RECHAZADO',
        'ENTREGADO',
        'INACTIVO'
      ));
  `,

  // Secuencia para numero_pedido
  NEXT_NUMERO: `
    SELECT COALESCE(
      'PED-' || LPAD(
        (CAST(SUBSTRING(MAX(numero_pedido) FROM 5) AS INT) + 1)::TEXT,
        3, '0'
      ),
      'PED-001'
    ) AS numero_pedido
    FROM pedidos
    WHERE numero_pedido IS NOT NULL
  `,

  LIST: `
    SELECT
      p.id_pedido,
      p.numero_pedido,
      p.cliente_id,
      c.nombre            AS cliente_nombre,
      c.telefono          AS cliente_telefono,
      p.empleado_id,
      e.nombre            AS empleado_nombre,
      p.fecha             AS fecha_pedido,
      p.fecha_entrega,
      p.estado,
      p.observaciones,
      p.created_by,
      p.total,
      o.payment_proof,
      o.payment_type,
      o.paid_amount,
      o.pending_amount,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id', dp.producto_id,
            'nombre',      pr.nombre,
            'cantidad',    dp.cantidad,
            'precio',      dp.precio,
            'subtotal',    dp.subtotal
          ) ORDER BY dp.id_detalle
        ) FILTER (WHERE dp.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM pedidos p
    JOIN clientes  c ON c.id_cliente  = p.cliente_id
    JOIN empleados e ON e.id_empleado = p.empleado_id
    LEFT JOIN orders           o  ON o.pedido_id   = p.id_pedido
    LEFT JOIN detalle_pedido dp ON dp.pedido_id   = p.id_pedido
    LEFT JOIN productos      pr ON pr.id_producto = dp.producto_id
    GROUP BY p.id_pedido, c.nombre, c.telefono, e.nombre,
             o.payment_proof, o.payment_type, o.paid_amount, o.pending_amount
    ORDER BY p.fecha DESC, p.id_pedido DESC
  `,

  // Solo pedidos pendientes (estado ACTIVO) — para la sección Pedidos del dashboard
  LIST_PENDIENTES: `
    SELECT
      p.id_pedido,
      p.numero_pedido,
      p.cliente_id,
      c.nombre            AS cliente_nombre,
      c.telefono          AS cliente_telefono,
      p.empleado_id,
      e.nombre            AS empleado_nombre,
      p.fecha             AS fecha_pedido,
      p.fecha_entrega,
      p.estado,
      p.observaciones,
      p.created_by,
      p.total,
      o.payment_proof,
      o.payment_type,
      o.paid_amount,
      o.pending_amount,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id', dp.producto_id,
            'nombre',      pr.nombre,
            'cantidad',    dp.cantidad,
            'precio',      dp.precio,
            'subtotal',    dp.subtotal
          ) ORDER BY dp.id_detalle
        ) FILTER (WHERE dp.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM pedidos p
    JOIN clientes  c ON c.id_cliente  = p.cliente_id
    JOIN empleados e ON e.id_empleado = p.empleado_id
    LEFT JOIN orders           o  ON o.pedido_id   = p.id_pedido
    LEFT JOIN detalle_pedido dp ON dp.pedido_id   = p.id_pedido
    LEFT JOIN productos      pr ON pr.id_producto = dp.producto_id
    WHERE p.estado = 'ACTIVO'
    GROUP BY p.id_pedido, c.nombre, c.telefono, e.nombre,
             o.payment_proof, o.payment_type, o.paid_amount, o.pending_amount
    ORDER BY p.fecha DESC, p.id_pedido DESC
  `,

  // Pedidos aceptados — para el dropdown del formulario de Ventas
  LIST_ACEPTADOS: `
    SELECT
      p.id_pedido,
      p.numero_pedido,
      p.cliente_id,
      c.nombre  AS cliente_nombre,
      p.total
    FROM pedidos p
    JOIN clientes c ON c.id_cliente = p.cliente_id
    WHERE p.estado = 'ACEPTADO'
    ORDER BY p.fecha DESC
  `,

  SEARCH: `
    SELECT
      p.id_pedido,
      p.numero_pedido,
      p.cliente_id,
      c.nombre            AS cliente_nombre,
      c.telefono          AS cliente_telefono,
      p.empleado_id,
      e.nombre            AS empleado_nombre,
      p.fecha             AS fecha_pedido,
      p.fecha_entrega,
      p.estado,
      p.observaciones,
      p.created_by,
      p.total,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id', dp.producto_id,
            'nombre',      pr.nombre,
            'cantidad',    dp.cantidad,
            'precio',      dp.precio,
            'subtotal',    dp.subtotal
          ) ORDER BY dp.id_detalle
        ) FILTER (WHERE dp.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM pedidos p
    JOIN clientes  c ON c.id_cliente  = p.cliente_id
    JOIN empleados e ON e.id_empleado = p.empleado_id
    LEFT JOIN detalle_pedido dp ON dp.pedido_id   = p.id_pedido
    LEFT JOIN productos      pr ON pr.id_producto = dp.producto_id
    WHERE p.numero_pedido ILIKE $1 OR c.nombre ILIKE $1
    GROUP BY p.id_pedido, c.nombre, c.telefono, e.nombre
    ORDER BY p.fecha DESC
  `,

  FILTER_ESTADO: `
    SELECT
      p.id_pedido,
      p.numero_pedido,
      p.cliente_id,
      c.nombre            AS cliente_nombre,
      c.telefono          AS cliente_telefono,
      p.empleado_id,
      e.nombre            AS empleado_nombre,
      p.fecha             AS fecha_pedido,
      p.fecha_entrega,
      p.estado,
      p.observaciones,
      p.created_by,
      p.total,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id', dp.producto_id,
            'nombre',      pr.nombre,
            'cantidad',    dp.cantidad,
            'precio',      dp.precio,
            'subtotal',    dp.subtotal
          ) ORDER BY dp.id_detalle
        ) FILTER (WHERE dp.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM pedidos p
    JOIN clientes  c ON c.id_cliente  = p.cliente_id
    JOIN empleados e ON e.id_empleado = p.empleado_id
    LEFT JOIN detalle_pedido dp ON dp.pedido_id   = p.id_pedido
    LEFT JOIN productos      pr ON pr.id_producto = dp.producto_id
    WHERE p.estado = $1
    GROUP BY p.id_pedido, c.nombre, c.telefono, e.nombre
    ORDER BY p.fecha DESC
  `,

  FILTER_FECHAS: `
    SELECT
      p.id_pedido,
      p.numero_pedido,
      p.cliente_id,
      c.nombre            AS cliente_nombre,
      c.telefono          AS cliente_telefono,
      p.empleado_id,
      e.nombre            AS empleado_nombre,
      p.fecha             AS fecha_pedido,
      p.fecha_entrega,
      p.estado,
      p.observaciones,
      p.created_by,
      p.total,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id', dp.producto_id,
            'nombre',      pr.nombre,
            'cantidad',    dp.cantidad,
            'precio',      dp.precio,
            'subtotal',    dp.subtotal
          ) ORDER BY dp.id_detalle
        ) FILTER (WHERE dp.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM pedidos p
    JOIN clientes  c ON c.id_cliente  = p.cliente_id
    JOIN empleados e ON e.id_empleado = p.empleado_id
    LEFT JOIN detalle_pedido dp ON dp.pedido_id   = p.id_pedido
    LEFT JOIN productos      pr ON pr.id_producto = dp.producto_id
    WHERE p.fecha BETWEEN $1 AND $2
    GROUP BY p.id_pedido, c.nombre, c.telefono, e.nombre
    ORDER BY p.fecha DESC
  `,

  FIND_BY_ID: `
    SELECT
      p.id_pedido,
      p.numero_pedido,
      p.cliente_id,
      c.nombre            AS cliente_nombre,
      c.telefono          AS cliente_telefono,
      p.empleado_id,
      e.nombre            AS empleado_nombre,
      p.fecha             AS fecha_pedido,
      p.fecha_entrega,
      p.estado,
      p.observaciones,
      p.created_by,
      p.total,
      o.payment_proof,
      o.payment_type,
      o.paid_amount,
      o.pending_amount,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id', dp.producto_id,
            'nombre',      pr.nombre,
            'cantidad',    dp.cantidad,
            'precio',      dp.precio,
            'subtotal',    dp.subtotal
          ) ORDER BY dp.id_detalle
        ) FILTER (WHERE dp.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM pedidos p
    JOIN clientes  c ON c.id_cliente  = p.cliente_id
    JOIN empleados e ON e.id_empleado = p.empleado_id
    LEFT JOIN orders           o  ON o.pedido_id   = p.id_pedido
    LEFT JOIN detalle_pedido dp ON dp.pedido_id   = p.id_pedido
    LEFT JOIN productos      pr ON pr.id_producto = dp.producto_id
    WHERE p.id_pedido = $1
    GROUP BY p.id_pedido, c.nombre, c.telefono, e.nombre,
             o.payment_proof, o.payment_type, o.paid_amount, o.pending_amount
  `,

  CREATE: `
    INSERT INTO pedidos
      (cliente_id, empleado_id, numero_pedido, fecha_entrega, observaciones, created_by, estado, total)
    VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO', $7)
    RETURNING *
  `,

  INSERT_DETALLE: `
    INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio, subtotal)
    VALUES ($1, $2, $3, $4, $5)
  `,

  UPDATE: `
    UPDATE pedidos
    SET cliente_id = $1, empleado_id = $2, fecha_entrega = $3,
        observaciones = $4, total = $5
    WHERE id_pedido = $6 AND estado NOT IN ('ENTREGADO','INACTIVO')
    RETURNING *
  `,

  DELETE_DETALLE: `
    DELETE FROM detalle_pedido WHERE pedido_id = $1
  `,

  // Cambiar a cualquier estado válido
  CAMBIAR_ESTADO: `
    UPDATE pedidos
    SET estado = $1
    WHERE id_pedido = $2
    RETURNING *
  `,

  // Cancelar → INACTIVO
  CANCELAR: `
    UPDATE pedidos
    SET estado = 'INACTIVO'
    WHERE id_pedido = $1 AND estado NOT IN ('ENTREGADO','INACTIVO')
    RETURNING *
  `,

  NUMERO_EXISTS: `
    SELECT id_pedido FROM pedidos
    WHERE numero_pedido = $1 AND id_pedido != $2
  `,
};