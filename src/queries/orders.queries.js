// src/queries/orders.queries.js

export const ORDERS_QUERIES = {

  MIGRATE: `
    CREATE TABLE IF NOT EXISTS orders (
      id              SERIAL PRIMARY KEY,
      user_id         INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
      total           NUMERIC(10,2) NOT NULL,
      status          VARCHAR(30)   NOT NULL DEFAULT 'Pendiente'
                      CHECK (status IN ('Pendiente','Confirmado','En preparación','Enviado','Entregado','Cancelado')),
      payment_proof   TEXT,
      payment_type    VARCHAR(20)   CHECK (payment_type IN ('COMPLETO','ABONO')),
      paid_amount     NUMERIC(10,2) DEFAULT 0,
      pending_amount  NUMERIC(10,2) DEFAULT 0,
      created_at      TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id          SERIAL PRIMARY KEY,
      order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id  INT NOT NULL REFERENCES productos(id_producto),
      name        VARCHAR(100) NOT NULL,
      price       NUMERIC(10,2) NOT NULL,
      quantity    INT NOT NULL CHECK (quantity > 0),
      subtotal    NUMERIC(10,2) NOT NULL
    );

    -- Agregar columnas de pago a orders si ya existía la tabla sin ellas
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_type   VARCHAR(20)   CHECK (payment_type IN ('COMPLETO','ABONO'));
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount    NUMERIC(10,2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(10,2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS pedido_id      INT REFERENCES pedidos(id_pedido) ON DELETE SET NULL;
  `,

  CREATE_ORDER: `
    INSERT INTO orders (user_id, total, payment_proof, payment_type, paid_amount, pending_amount)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `,

  INSERT_ITEM: `
    INSERT INTO order_items (order_id, product_id, name, price, quantity, subtotal)
    VALUES ($1, $2, $3, $4, $5, $6)
  `,

  CLEAR_CART: `
    DELETE FROM cart WHERE user_id = $1
  `,

  MY_ORDERS: `
    SELECT
      o.id, o.total, o.status, o.payment_proof,
      o.payment_type, o.paid_amount, o.pending_amount, o.created_at,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id',         oi.id,
            'product_id', oi.product_id,
            'name',       oi.name,
            'price',      oi.price,
            'quantity',   oi.quantity,
            'subtotal',   oi.subtotal
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::jsonb
      ) AS items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.user_id = $1
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `,

  ALL_ORDERS: `
    SELECT
      o.id,
      o.total,
      o.status,
      o.payment_proof,
      o.payment_type,
      o.paid_amount,
      o.pending_amount,
      o.created_at,
      u.id_usuario                          AS user_id,
      COALESCE(u.nombre_usuario, u.correo)  AS user_name,
      u.correo                              AS user_email,
      c.telefono                            AS user_phone,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id',         oi.id,
            'product_id', oi.product_id,
            'name',       oi.name,
            'price',      oi.price,
            'quantity',   oi.quantity,
            'subtotal',   oi.subtotal
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::jsonb
      ) AS items
    FROM orders o
    JOIN usuarios u ON u.id_usuario = o.user_id
    LEFT JOIN clientes c ON c.usuario_id = o.user_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id, u.id_usuario, u.nombre_usuario, u.correo, c.telefono
    ORDER BY o.created_at DESC
  `,

  UPDATE_STATUS: `
    UPDATE orders SET status = $1
    WHERE id = $2
    RETURNING *
  `,

  // Siguiente número ORD-XXX para pedidos creados desde catálogo
  NEXT_NUMERO_ORD: `
    SELECT COALESCE(
      'ORD-' || LPAD(
        (CAST(SUBSTRING(MAX(numero_pedido) FROM 5) AS INT) + 1)::TEXT,
        3, '0'
      ),
      'ORD-001'
    ) AS numero_pedido
    FROM pedidos
    WHERE numero_pedido LIKE 'ORD-%'
  `,

  // Primer empleado administrador activo (fallback para pedidos del catálogo)
  PRIMER_EMPLEADO_ADMIN: `
    SELECT e.id_empleado FROM empleados e
    JOIN usuarios u ON u.id_usuario = e.usuario_id
    JOIN roles r    ON r.id_rol     = u.rol_id
    WHERE u.estado = 'ACTIVO'
    ORDER BY
      CASE WHEN r.nombre = 'Administrador' THEN 0 ELSE 1 END,
      e.id_empleado
    LIMIT 1
  `,

  CART_EXISTS: `
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'cart'
  `,
};
