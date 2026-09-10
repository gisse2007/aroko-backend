// src/queries/ventas.queries.js

// ══════════════════════════════════════════════
//  VENTAS
// ══════════════════════════════════════════════
export const VENTAS_QUERIES = {

  MIGRATE: `
    ALTER TABLE ventas
      ADD COLUMN IF NOT EXISTS numero_venta     VARCHAR(20) UNIQUE,
      ADD COLUMN IF NOT EXISTS cliente_id       INT REFERENCES clientes(id_cliente),
      ADD COLUMN IF NOT EXISTS fecha_venta      TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS motivo_anulacion VARCHAR(255);
  `,

  // Secuencia auto para numero_venta
  NEXT_NUMERO: `
    SELECT COALESCE(
      'VTA-' || LPAD(
        (CAST(SUBSTRING(MAX(numero_venta) FROM 5) AS INT) + 1)::TEXT,
        3, '0'
      ),
      'VTA-001'
    ) AS numero_venta
    FROM ventas
    WHERE numero_venta IS NOT NULL
  `,

  LIST: `
    SELECT
      v.id_venta,
      v.numero_venta,
      v.pedido_id,
      v.cliente_id,
      c.nombre          AS cliente_nombre,
      v.empleado_id,
      e.nombre          AS empleado_nombre,
      v.fecha_venta,
      v.total,
      v.abonado,
      v.saldo,
      v.estado,
      v.motivo_anulacion,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id', dv.producto_id,
            'nombre',      p.nombre,
            'cantidad',    dv.cantidad,
            'precio',      dv.precio,
            'subtotal',    dv.subtotal
          ) ORDER BY dv.id_detalle
        ) FILTER (WHERE dv.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM ventas v
    LEFT JOIN clientes  c ON c.id_cliente  = v.cliente_id
    LEFT JOIN empleados e ON e.id_empleado = v.empleado_id
    LEFT JOIN detalle_venta dv ON dv.venta_id    = v.id_venta
    LEFT JOIN productos      p ON p.id_producto  = dv.producto_id
    GROUP BY v.id_venta, c.nombre, e.nombre
    ORDER BY v.fecha_venta DESC, v.id_venta DESC
  `,

  SEARCH: `
    SELECT
      v.id_venta,
      v.numero_venta,
      v.pedido_id,
      v.cliente_id,
      c.nombre          AS cliente_nombre,
      v.empleado_id,
      e.nombre          AS empleado_nombre,
      v.fecha_venta,
      v.total,
      v.abonado,
      v.saldo,
      v.estado,
      v.motivo_anulacion,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id', dv.producto_id,
            'nombre',      p.nombre,
            'cantidad',    dv.cantidad,
            'precio',      dv.precio,
            'subtotal',    dv.subtotal
          ) ORDER BY dv.id_detalle
        ) FILTER (WHERE dv.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM ventas v
    LEFT JOIN clientes  c ON c.id_cliente  = v.cliente_id
    LEFT JOIN empleados e ON e.id_empleado = v.empleado_id
    LEFT JOIN detalle_venta dv ON dv.venta_id    = v.id_venta
    LEFT JOIN productos      p ON p.id_producto  = dv.producto_id
    WHERE v.numero_venta ILIKE $1 OR c.nombre ILIKE $1
    GROUP BY v.id_venta, c.nombre, e.nombre
    ORDER BY v.fecha_venta DESC
  `,

  FILTER_ESTADO: `
    SELECT
      v.id_venta,
      v.numero_venta,
      v.pedido_id,
      v.cliente_id,
      c.nombre          AS cliente_nombre,
      v.empleado_id,
      e.nombre          AS empleado_nombre,
      v.fecha_venta,
      v.total,
      v.abonado,
      v.saldo,
      v.estado,
      v.motivo_anulacion,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id', dv.producto_id,
            'nombre',      p.nombre,
            'cantidad',    dv.cantidad,
            'precio',      dv.precio,
            'subtotal',    dv.subtotal
          ) ORDER BY dv.id_detalle
        ) FILTER (WHERE dv.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM ventas v
    LEFT JOIN clientes  c ON c.id_cliente  = v.cliente_id
    LEFT JOIN empleados e ON e.id_empleado = v.empleado_id
    LEFT JOIN detalle_venta dv ON dv.venta_id    = v.id_venta
    LEFT JOIN productos      p ON p.id_producto  = dv.producto_id
    WHERE v.estado = $1
    GROUP BY v.id_venta, c.nombre, e.nombre
    ORDER BY v.fecha_venta DESC
  `,

  FILTER_FECHAS: `
    SELECT
      v.id_venta,
      v.numero_venta,
      v.pedido_id,
      v.cliente_id,
      c.nombre          AS cliente_nombre,
      v.empleado_id,
      e.nombre          AS empleado_nombre,
      v.fecha_venta,
      v.total,
      v.abonado,
      v.saldo,
      v.estado,
      v.motivo_anulacion,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id', dv.producto_id,
            'nombre',      p.nombre,
            'cantidad',    dv.cantidad,
            'precio',      dv.precio,
            'subtotal',    dv.subtotal
          ) ORDER BY dv.id_detalle
        ) FILTER (WHERE dv.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM ventas v
    LEFT JOIN clientes  c ON c.id_cliente  = v.cliente_id
    LEFT JOIN empleados e ON e.id_empleado = v.empleado_id
    LEFT JOIN detalle_venta dv ON dv.venta_id    = v.id_venta
    LEFT JOIN productos      p ON p.id_producto  = dv.producto_id
    WHERE v.fecha_venta BETWEEN $1 AND $2
    GROUP BY v.id_venta, c.nombre, e.nombre
    ORDER BY v.fecha_venta DESC
  `,

  FIND_BY_ID: `
    SELECT
      v.id_venta,
      v.numero_venta,
      v.pedido_id,
      v.cliente_id,
      c.nombre          AS cliente_nombre,
      v.empleado_id,
      e.nombre          AS empleado_nombre,
      v.fecha_venta,
      v.total,
      v.abonado,
      v.saldo,
      v.estado,
      v.motivo_anulacion,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'producto_id', dv.producto_id,
            'nombre',      p.nombre,
            'cantidad',    dv.cantidad,
            'precio',      dv.precio,
            'subtotal',    dv.subtotal
          ) ORDER BY dv.id_detalle
        ) FILTER (WHERE dv.id_detalle IS NOT NULL),
        '[]'::jsonb
      ) AS detalle
    FROM ventas v
    LEFT JOIN clientes  c ON c.id_cliente  = v.cliente_id
    LEFT JOIN empleados e ON e.id_empleado = v.empleado_id
    LEFT JOIN detalle_venta dv ON dv.venta_id    = v.id_venta
    LEFT JOIN productos      p ON p.id_producto  = dv.producto_id
    WHERE v.id_venta = $1
    GROUP BY v.id_venta, c.nombre, e.nombre
  `,

  CREATE: `
    INSERT INTO ventas (numero_venta, pedido_id, cliente_id, empleado_id, fecha_venta, total, abonado, estado)
    VALUES ($1, $2, $3, $4, $5, $6, 0, 'REGISTRADA')
    RETURNING *
  `,

  INSERT_DETALLE: `
    INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio, subtotal)
    VALUES ($1, $2, $3, $4, $5)
  `,

  GET_DETALLE: `
    SELECT producto_id, cantidad FROM detalle_venta WHERE venta_id = $1
  `,

  ANULAR: `
    UPDATE ventas
    SET estado = 'ANULADA', motivo_anulacion = $1
    WHERE id_venta = $2 AND estado = 'REGISTRADA'
    RETURNING *
  `,

  // Sumar al campo abonado cuando se registra un abono
  SUMAR_ABONADO: `
    UPDATE ventas
    SET abonado = abonado + $1
    WHERE id_venta = $2
    RETURNING id_venta, total, abonado, saldo
  `,

  // Restar del campo abonado cuando se anula un abono
  RESTAR_ABONADO: `
    UPDATE ventas
    SET abonado = abonado - $1
    WHERE id_venta = $2
    RETURNING id_venta, total, abonado, saldo
  `,
};

// ══════════════════════════════════════════════
//  ABONOS
// ══════════════════════════════════════════════
export const ABONOS_QUERIES = {

  MY_CLIENTE: `
    SELECT
      a.id_abono,
      a.venta_id,
      v.numero_venta,
      v.pedido_id,
      v.total AS venta_total,
      v.abonado AS venta_abonado,
      v.saldo AS venta_saldo,
      a.numero_cuota,
      a.fecha,
      a.valor,
      a.metodo_pago,
      a.estado
    FROM abonos a
    JOIN ventas v ON v.id_venta = a.venta_id
    JOIN clientes c ON c.id_cliente = v.cliente_id
    WHERE c.usuario_id = $1
    ORDER BY a.fecha DESC, a.id_abono DESC
  `,

  LIST: `
    SELECT
      a.id_abono,
      a.venta_id,
      v.numero_venta,
      v.pedido_id,
      a.empleado_id,
      e.nombre          AS empleado_nombre,
      a.numero_cuota,
      a.fecha,
      a.valor,
      a.metodo_pago,
      a.estado,
      c.nombre          AS cliente_nombre
    FROM abonos a
    JOIN ventas    v ON v.id_venta    = a.venta_id
    JOIN empleados e ON e.id_empleado = a.empleado_id
    LEFT JOIN clientes c ON c.id_cliente = v.cliente_id
    ORDER BY a.fecha DESC, a.id_abono DESC
  `,

  FILTER_FECHAS: `
    SELECT
      a.id_abono,
      a.venta_id,
      v.numero_venta,
      v.pedido_id,
      a.empleado_id,
      e.nombre          AS empleado_nombre,
      a.numero_cuota,
      a.fecha,
      a.valor,
      a.metodo_pago,
      a.estado,
      c.nombre          AS cliente_nombre
    FROM abonos a
    JOIN ventas    v ON v.id_venta    = a.venta_id
    JOIN empleados e ON e.id_empleado = a.empleado_id
    LEFT JOIN clientes c ON c.id_cliente = v.cliente_id
    WHERE a.fecha BETWEEN $1 AND $2
    ORDER BY a.fecha DESC, a.id_abono DESC
  `,

  BY_VENTA: `
    SELECT
      a.id_abono,
      a.venta_id,
      v.numero_venta,
      a.empleado_id,
      e.nombre          AS empleado_nombre,
      a.numero_cuota,
      a.fecha,
      a.valor,
      a.metodo_pago,
      a.estado
    FROM abonos a
    JOIN ventas    v ON v.id_venta    = a.venta_id
    JOIN empleados e ON e.id_empleado = a.empleado_id
    WHERE a.venta_id = $1
    ORDER BY a.numero_cuota
  `,

  FIND_BY_ID: `
    SELECT
      a.id_abono,
      a.venta_id,
      v.numero_venta,
      v.pedido_id,
      v.total           AS venta_total,
      v.abonado         AS venta_abonado,
      v.saldo           AS venta_saldo,
      a.empleado_id,
      e.nombre          AS empleado_nombre,
      a.numero_cuota,
      a.fecha,
      a.valor,
      a.metodo_pago,
      a.estado
    FROM abonos a
    JOIN ventas    v ON v.id_venta    = a.venta_id
    JOIN empleados e ON e.id_empleado = a.empleado_id
    WHERE a.id_abono = $1
  `,

  // Cuántas cuotas lleva la venta (máx 3)
  COUNT_CUOTAS: `
    SELECT COUNT(*) AS total
    FROM abonos
    WHERE venta_id = $1 AND estado = 'REGISTRADO'
  `,

  // Siguiente número de cuota
  NEXT_CUOTA: `
    SELECT COALESCE(MAX(numero_cuota), 0) + 1 AS siguiente
    FROM abonos
    WHERE venta_id = $1
  `,

  CREATE: `
    INSERT INTO abonos (venta_id, empleado_id, numero_cuota, valor, metodo_pago, estado)
    VALUES ($1, $2, $3, $4, $5, 'REGISTRADO')
    RETURNING *
  `,

  ANULAR: `
    UPDATE abonos
    SET estado = 'ANULADO'
    WHERE id_abono = $1 AND estado = 'REGISTRADO'
    RETURNING *
  `,
};