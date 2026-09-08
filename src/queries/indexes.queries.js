// src/queries/indexes.queries.js

export const INDEXES_QUERIES = {
  MIGRATE: `
    -- =========================================
    -- ÍNDICES PARA FORÁNEAS (FK)
    -- =========================================

    -- empleados
    CREATE INDEX IF NOT EXISTS idx_empleados_usuario_id ON empleados(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_empleados_creado_por_id ON empleados(creado_por_id);

    -- clientes
    CREATE INDEX IF NOT EXISTS idx_clientes_usuario_id ON clientes(usuario_id);

    -- proveedores
    CREATE INDEX IF NOT EXISTS idx_proveedores_empleado_id ON proveedores(empleado_id);

    -- insumos
    CREATE INDEX IF NOT EXISTS idx_insumos_categoria_id ON insumos(categoria_id);

    -- productos
    CREATE INDEX IF NOT EXISTS idx_productos_categoria_id ON productos(categoria_id);

    -- detalle_producto (receta)
    CREATE INDEX IF NOT EXISTS idx_detalle_producto_producto_id ON detalle_producto(producto_id);
    CREATE INDEX IF NOT EXISTS idx_detalle_producto_insumo_id ON detalle_producto(insumo_id);

    -- compras
    CREATE INDEX IF NOT EXISTS idx_compras_proveedor_id ON compras(proveedor_id);
    CREATE INDEX IF NOT EXISTS idx_compras_empleado_id ON compras(empleado_id);

    -- detalle_compra
    CREATE INDEX IF NOT EXISTS idx_detalle_compra_compra_id ON detalle_compra(compra_id);
    CREATE INDEX IF NOT EXISTS idx_detalle_compra_insumo_id ON detalle_compra(insumo_id);

    -- produccion
    CREATE INDEX IF NOT EXISTS idx_produccion_empleado_id ON produccion(empleado_id);

    -- detalle_produccion
    CREATE INDEX IF NOT EXISTS idx_detalle_produccion_produccion_id ON detalle_produccion(produccion_id);
    CREATE INDEX IF NOT EXISTS idx_detalle_produccion_producto_id ON detalle_produccion(producto_id);

    -- salida_insumos
    CREATE INDEX IF NOT EXISTS idx_salida_insumos_empleado_id ON salida_insumos(empleado_id);

    -- detalle_salida_insumos
    CREATE INDEX IF NOT EXISTS idx_detalle_salida_salida_id ON detalle_salida_insumos(salida_id);
    CREATE INDEX IF NOT EXISTS idx_detalle_salida_insumo_id ON detalle_salida_insumos(insumo_id);

    -- pedidos
    CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON pedidos(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_pedidos_empleado_id ON pedidos(empleado_id);

    -- detalle_pedido
    CREATE INDEX IF NOT EXISTS idx_detalle_pedido_pedido_id ON detalle_pedido(pedido_id);
    CREATE INDEX IF NOT EXISTS idx_detalle_pedido_producto_id ON detalle_pedido(producto_id);

    -- ventas
    CREATE INDEX IF NOT EXISTS idx_ventas_pedido_id ON ventas(pedido_id);
    CREATE INDEX IF NOT EXISTS idx_ventas_empleado_id ON ventas(empleado_id);
    CREATE INDEX IF NOT EXISTS idx_ventas_cliente_id ON ventas(cliente_id);

    -- detalle_venta
    CREATE INDEX IF NOT EXISTS idx_detalle_venta_venta_id ON detalle_venta(venta_id);
    CREATE INDEX IF NOT EXISTS idx_detalle_venta_producto_id ON detalle_venta(producto_id);

    -- abonos
    CREATE INDEX IF NOT EXISTS idx_abonos_venta_id ON abonos(venta_id);
    CREATE INDEX IF NOT EXISTS idx_abonos_empleado_id ON abonos(empleado_id);

    -- domicilios
    CREATE INDEX IF NOT EXISTS idx_domicilios_pedido_id ON domicilios(pedido_id);
    CREATE INDEX IF NOT EXISTS idx_domicilios_empleado_id ON domicilios(empleado_id);

    -- orders
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_pedido_id ON orders(pedido_id);

    -- order_items
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

    -- movimientos_inventario
    CREATE INDEX IF NOT EXISTS idx_movimientos_usuario_id ON movimientos_inventario(usuario_id);

    -- =========================================
    -- ÍNDICES PARA COLUMNAS FILTRADAS FRECUENTEMENTE
    -- =========================================

    -- Estado (usado en todas las tablas para filtros WHERE estado = ...)
    CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON usuarios(estado);
    CREATE INDEX IF NOT EXISTS idx_empleados_estado ON empleados(estado);
    CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);
    CREATE INDEX IF NOT EXISTS idx_proveedores_estado ON proveedores(estado);
    CREATE INDEX IF NOT EXISTS idx_insumos_estado ON insumos(estado);
    CREATE INDEX IF NOT EXISTS idx_productos_estado ON productos(estado);
    CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
    CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado);
    CREATE INDEX IF NOT EXISTS idx_abonos_estado ON abonos(estado);
    CREATE INDEX IF NOT EXISTS idx_domicilios_estado ON domicilios(estado);
    CREATE INDEX IF NOT EXISTS idx_roles_estado ON roles(estado);
    CREATE INDEX IF NOT EXISTS idx_permisos_estado ON permisos(estado);
    CREATE INDEX IF NOT EXISTS idx_categorias_insumo_estado ON categorias_insumo(estado);
    CREATE INDEX IF NOT EXISTS idx_categorias_producto_estado ON categorias_producto(estado);
    CREATE INDEX IF NOT EXISTS idx_produccion_estado ON produccion(estado);
    CREATE INDEX IF NOT EXISTS idx_salida_insumos_estado ON salida_insumos(estado);
    CREATE INDEX IF NOT EXISTS idx_compras_estado ON compras(estado_compra);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

    -- Fechas (usados en BETWEEN, ORDER BY, DATE_TRUNC)
    CREATE INDEX IF NOT EXISTS idx_ventas_fecha_venta ON ventas(fecha_venta DESC);
    CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha DESC);
    CREATE INDEX IF NOT EXISTS idx_produccion_fecha ON produccion(fecha DESC);
    CREATE INDEX IF NOT EXISTS idx_salida_insumos_fecha ON salida_insumos(fecha DESC);
    CREATE INDEX IF NOT EXISTS idx_compras_fecha_compra ON compras(fecha_compra DESC);
    CREATE INDEX IF NOT EXISTS idx_abonos_fecha ON abonos(fecha DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_usuarios_created_at ON usuarios(created_at DESC);

    -- Búsquedas por correo/login (LOWER(correo))
    CREATE INDEX IF NOT EXISTS idx_usuarios_correo_lower ON usuarios(LOWER(correo));
    CREATE INDEX IF NOT EXISTS idx_clientes_email_lower ON clientes(LOWER(email));

    -- Búsquedas por documento
    CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes(documento);
    CREATE INDEX IF NOT EXISTS idx_empleados_documento ON empleados(documento);

    -- Números de documento para búsqueda ILIKE
    CREATE INDEX IF NOT EXISTS idx_ventas_numero_venta ON ventas(numero_venta);
    CREATE INDEX IF NOT EXISTS idx_pedidos_numero_pedido ON pedidos(numero_pedido);
    CREATE INDEX IF NOT EXISTS idx_compras_numero_factura ON compras(numero_factura);

    -- =========================================
    -- ÍNDICES COMPUESTOS PARA CONSULTAS FRECUENTES
    -- =========================================

    -- Ventas filtradas por estado y fecha (dashboard)
    CREATE INDEX IF NOT EXISTS idx_ventas_estado_fecha ON ventas(estado, fecha_venta DESC);

    -- Pedidos filtrados por estado y fecha
    CREATE INDEX IF NOT EXISTS idx_pedidos_estado_fecha ON pedidos(estado, fecha DESC);

    -- Insumos activos con stock bajo (alertas)
    CREATE INDEX IF NOT EXISTS idx_insumos_activos_stock ON insumos(estado, stock_actual, stock_minimo);

    -- Producción por empleado y fecha
    CREATE INDEX IF NOT EXISTS idx_produccion_empleado_fecha ON produccion(empleado_id, fecha DESC);

    -- Compras por proveedor y fecha
    CREATE INDEX IF NOT EXISTS idx_compras_proveedor_fecha ON compras(proveedor_id, fecha_compra DESC);

    -- Abonos por venta (consulta frecuente)
    CREATE INDEX IF NOT EXISTS idx_abonos_venta_numero ON abonos(venta_id, numero_cuota);

    -- Movimientos por insumo y fecha (auditoría)
    CREATE INDEX IF NOT EXISTS idx_mov_insumo_fecha ON movimientos_inventario(insumo_id, fecha DESC);
  `,
};
