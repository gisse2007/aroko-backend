// src/queries/dashboard.queries.js

export const DASHBOARD_QUERIES = {

  // ── KPI Ventas ──────────────────────────────────────────────────────────

  VENTAS_SEMANA: `
    SELECT COALESCE(SUM(total), 0) AS valor, COUNT(*) AS cantidad
    FROM ventas
    WHERE estado = 'REGISTRADA'
      AND fecha >= NOW() - INTERVAL '7 days'
  `,

  VENTAS_MES: `
    SELECT COALESCE(SUM(total), 0) AS valor, COUNT(*) AS cantidad
    FROM ventas
    WHERE estado = 'REGISTRADA'
      AND DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())
  `,

  VENTAS_ANO: `
    SELECT COALESCE(SUM(total), 0) AS valor, COUNT(*) AS cantidad
    FROM ventas
    WHERE estado = 'REGISTRADA'
      AND DATE_TRUNC('year', fecha) = DATE_TRUNC('year', NOW())
  `,

  VENTAS_SEMANA_ANTERIOR: `
    SELECT COALESCE(SUM(total), 0) AS valor
    FROM ventas
    WHERE estado = 'REGISTRADA'
      AND fecha >= NOW() - INTERVAL '14 days'
      AND fecha <  NOW() - INTERVAL '7 days'
  `,

  VENTAS_MES_ANTERIOR: `
    SELECT COALESCE(SUM(total), 0) AS valor
    FROM ventas
    WHERE estado = 'REGISTRADA'
      AND DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')
  `,

  VENTAS_ANO_ANTERIOR: `
    SELECT COALESCE(SUM(total), 0) AS valor
    FROM ventas
    WHERE estado = 'REGISTRADA'
      AND DATE_TRUNC('year', fecha) = DATE_TRUNC('year', NOW() - INTERVAL '1 year')
  `,

  // ── KPI Compras ─────────────────────────────────────────────────────────

  COMPRAS_SEMANA: `
    SELECT COALESCE(SUM(total_compra), 0) AS valor, COUNT(*) AS cantidad
    FROM compras
    WHERE estado = 'ACTIVO'
      AND fecha_compra >= NOW() - INTERVAL '7 days'
  `,

  COMPRAS_MES: `
    SELECT COALESCE(SUM(total_compra), 0) AS valor, COUNT(*) AS cantidad
    FROM compras
    WHERE estado = 'ACTIVO'
      AND DATE_TRUNC('month', fecha_compra) = DATE_TRUNC('month', NOW())
  `,

  COMPRAS_ANO: `
    SELECT COALESCE(SUM(total_compra), 0) AS valor, COUNT(*) AS cantidad
    FROM compras
    WHERE estado = 'ACTIVO'
      AND DATE_TRUNC('year', fecha_compra) = DATE_TRUNC('year', NOW())
  `,

  COMPRAS_SEMANA_ANTERIOR: `
    SELECT COALESCE(SUM(total_compra), 0) AS valor FROM compras
    WHERE estado = 'ACTIVO'
      AND fecha_compra >= NOW() - INTERVAL '14 days'
      AND fecha_compra <  NOW() - INTERVAL '7 days'
  `,

  COMPRAS_MES_ANTERIOR: `
    SELECT COALESCE(SUM(total_compra), 0) AS valor FROM compras
    WHERE estado = 'ACTIVO'
      AND DATE_TRUNC('month', fecha_compra) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')
  `,

  COMPRAS_ANO_ANTERIOR: `
    SELECT COALESCE(SUM(total_compra), 0) AS valor FROM compras
    WHERE estado = 'ACTIVO'
      AND DATE_TRUNC('year', fecha_compra) = DATE_TRUNC('year', NOW() - INTERVAL '1 year')
  `,

  // ── KPI Pedidos ─────────────────────────────────────────────────────────

  PEDIDOS_SEMANA: `
    SELECT COUNT(*) AS cantidad FROM pedidos
    WHERE estado NOT IN ('INACTIVO')
      AND fecha >= NOW() - INTERVAL '7 days'
  `,

  PEDIDOS_MES: `
    SELECT COUNT(*) AS cantidad FROM pedidos
    WHERE estado NOT IN ('INACTIVO')
      AND DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())
  `,

  PEDIDOS_ANO: `
    SELECT COUNT(*) AS cantidad FROM pedidos
    WHERE estado NOT IN ('INACTIVO')
      AND DATE_TRUNC('year', fecha) = DATE_TRUNC('year', NOW())
  `,

  PEDIDOS_SEMANA_ANTERIOR: `
    SELECT COUNT(*) AS cantidad FROM pedidos
    WHERE estado NOT IN ('INACTIVO')
      AND fecha >= NOW() - INTERVAL '14 days'
      AND fecha <  NOW() - INTERVAL '7 days'
  `,

  PEDIDOS_MES_ANTERIOR: `
    SELECT COUNT(*) AS cantidad FROM pedidos
    WHERE estado NOT IN ('INACTIVO')
      AND DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')
  `,

  PEDIDOS_ANO_ANTERIOR: `
    SELECT COUNT(*) AS cantidad FROM pedidos
    WHERE estado NOT IN ('INACTIVO')
      AND DATE_TRUNC('year', fecha) = DATE_TRUNC('year', NOW() - INTERVAL '1 year')
  `,

  // ── Top 5 productos más vendidos (mes actual) ───────────────────────────
  // Incluye pedidos (detalle_pedido) cuando no hay ventas aún
  TOP_PRODUCTOS: `
    SELECT
      p.id_producto,
      p.nombre        AS name,
      COALESCE(SUM(dp.cantidad), 0) AS sold,
      p.stock_producto AS stock,
      cp.nombre        AS categoria
    FROM productos p
    LEFT JOIN categorias_producto cp ON cp.id_categoria = p.categoria_id
    LEFT JOIN detalle_pedido dp ON dp.producto_id = p.id_producto
    LEFT JOIN pedidos ped ON ped.id_pedido = dp.pedido_id
      AND ped.estado NOT IN ('INACTIVO','RECHAZADO')
      AND DATE_TRUNC('month', ped.fecha) = DATE_TRUNC('month', NOW())
    WHERE p.estado = 'ACTIVO'
    GROUP BY p.id_producto, p.nombre, p.stock_producto, cp.nombre
    ORDER BY sold DESC, p.nombre
    LIMIT 5
  `,

  // ── Alertas de stock ────────────────────────────────────────────────────

  STOCK_BAJO_PRODUCTOS: `
    SELECT
      p.id_producto   AS id,
      p.nombre        AS name,
      p.stock_producto AS stock,
      5               AS min,
      cp.nombre        AS category
    FROM productos p
    LEFT JOIN categorias_producto cp ON cp.id_categoria = p.categoria_id
    WHERE p.estado = 'ACTIVO' AND p.stock_producto < 5
    ORDER BY p.stock_producto ASC
    LIMIT 10
  `,

  STOCK_BAJO_INSUMOS: `
    SELECT
      i.id_insumo    AS id,
      i.nombre       AS name,
      i.stock_actual AS stock,
      i.stock_minimo AS min,
      ci.nombre      AS category
    FROM insumos i
    LEFT JOIN categorias_insumo ci ON ci.id_categoria = i.categoria_id
    WHERE i.estado = 'ACTIVO' AND i.stock_actual < i.stock_minimo
    ORDER BY (i.stock_actual - i.stock_minimo) ASC
    LIMIT 10
  `,

  // ── Pedidos recientes (últimos 6, todos los orígenes) ───────────────────

  PEDIDOS_RECIENTES: `
    SELECT
      p.id_pedido,
      p.numero_pedido AS id,
      c.nombre        AS client,
      p.fecha         AS date,
      p.estado        AS status,
      p.total
    FROM pedidos p
    JOIN clientes c ON c.id_cliente = p.cliente_id
    WHERE p.estado NOT IN ('INACTIVO')
    ORDER BY p.fecha DESC
    LIMIT 6
  `,

  // ── Resumen general ─────────────────────────────────────────────────────

  RESUMEN: `
    SELECT
      (SELECT COUNT(*) FROM clientes   WHERE estado = 'ACTIVO')  AS clientes_activos,
      (SELECT COUNT(*) FROM productos  WHERE estado = 'ACTIVO')  AS productos_activos,
      (SELECT COUNT(*) FROM empleados  WHERE estado = 'ACTIVO')  AS empleados_activos,
      (SELECT COUNT(*) FROM proveedores WHERE estado = 'ACTIVO') AS proveedores_activos,
      (SELECT COUNT(*) FROM pedidos
         WHERE estado NOT IN ('INACTIVO','RECHAZADO','ENTREGADO')) AS pedidos_en_curso,
      (SELECT COUNT(*) FROM ventas WHERE estado = 'REGISTRADA'
         AND fecha >= NOW() - INTERVAL '24 hours')               AS ventas_hoy,
      (SELECT COUNT(*) FROM produccion WHERE estado = 'REGISTRADA'
         AND fecha >= NOW() - INTERVAL '24 hours')               AS producciones_hoy,
      (SELECT COALESCE(SUM(total),0) FROM ventas WHERE estado = 'REGISTRADA'
         AND DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())) AS ingresos_mes
  `,
};
