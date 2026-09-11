// src/controllers/orders.controller.js

import pool from '../config/db.js';
import { ORDERS_QUERIES } from '../queries/orders.queries.js';
import { PEDIDOS_QUERIES } from '../queries/pedidos.queries.js';
import { VENTAS_QUERIES, ABONOS_QUERIES } from '../queries/ventas.queries.js';
import { enviarCorreoFechaEntrega, enviarCorreoPedidoExitoso } from '../services/email.service.js';

const ESTADOS_VALIDOS = ['Pendiente', 'Confirmado', 'En preparación', 'Enviado', 'Entregado', 'Cancelado'];

// POST /api/orders
export const crearOrder = async (req, res) => {
  const user_id = req.usuario?.id_usuario;

  // Log de diagnóstico — visible en consola del servidor
  console.log('[POST /api/orders] body:', JSON.stringify(req.body));
  console.log('[POST /api/orders] file:', req.file?.path ?? 'ninguno');
  console.log('[POST /api/orders] user_id:', user_id);

  if (!user_id) return res.status(401).json({ ok: false, message: 'No autenticado.' });

  let items;
  try {
    items = typeof req.body.items === 'string' ? JSON.parse(req.body.items) : req.body.items;
  } catch {
    return res.status(400).json({ ok: false, message: 'El campo items tiene formato inválido.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, message: 'El carrito está vacío.' });
  }

  for (const item of items) {
    const qty = parseInt(item.quantity, 10);
    if (!item.productId || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ ok: false, message: 'Cada ítem requiere productId y quantity válidos.' });
    }
  }

  // payment_type es opcional — si el frontend no lo envía se asume COMPLETO
  const payment_type = req.body.payment_type ?? 'COMPLETO';
  if (!['COMPLETO', 'ABONO'].includes(payment_type)) {
    return res.status(400).json({ ok: false, message: 'payment_type debe ser COMPLETO o ABONO.' });
  }

  // fecha_entrega opcional — el cliente minorista puede definirla al confirmar
  const fecha_entrega = req.body.fecha_entrega || null;

  const paymentProof = req.file ? (req.file.path || req.file.secure_url) : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener precios reales desde la BD
    const productIds = items.map(i => i.productId);
    const { rows: productos } = await client.query(
      `SELECT id_producto, nombre, precio FROM productos
       WHERE id_producto = ANY($1) AND estado = 'ACTIVO'`,
      [productIds]
    );

    if (productos.length !== productIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, message: 'Uno o más productos no existen o están inactivos.' });
    }

    const precioMap = Object.fromEntries(productos.map(p => [p.id_producto, p]));

    // Calcular total en backend
    let total = 0;
    const itemsCalculados = items.map(item => {
      const producto = precioMap[item.productId];
      const qty = parseInt(item.quantity, 10);
      const price = parseFloat(producto.precio);
      const subtotal = parseFloat((price * qty).toFixed(2));
      total += subtotal;
      return { ...item, qty, price, subtotal, name: producto.nombre };
    });
    total = parseFloat(total.toFixed(2));

    // Calcular montos de pago en backend — nunca confiar en el frontend
    let paid_amount, pending_amount;
    if (payment_type === 'COMPLETO') {
      paid_amount    = total;
      pending_amount = 0;
    } else {
      paid_amount = parseFloat(parseFloat(req.body.paid_amount ?? 0).toFixed(2));
      if (isNaN(paid_amount) || paid_amount <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'paid_amount debe ser mayor a 0 para un abono.' });
      }
      if (paid_amount > total) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'El abono no puede superar el total del pedido.' });
      }
      pending_amount = parseFloat((total - paid_amount).toFixed(2));
    }

    // Crear orden
    const { rows: orderRows } = await client.query(ORDERS_QUERIES.CREATE_ORDER, [
      user_id, total, paymentProof, payment_type, paid_amount, pending_amount,
    ]);
    const order = orderRows[0];

    // Insertar ítems
    for (const item of itemsCalculados) {
      await client.query(ORDERS_QUERIES.INSERT_ITEM, [
        order.id, item.productId, item.name,
        item.price, item.qty, item.subtotal,
      ]);
    }

    // ── Espejo en tabla pedidos (fuente única de datos para el panel admin) ──
    const { rows: cliRows } = await client.query(
      `SELECT id_cliente FROM clientes WHERE usuario_id = $1 LIMIT 1`,
      [user_id]
    );

    if (cliRows.length > 0) {
      const cliente_id = cliRows[0].id_cliente;

      const { rows: numRows }  = await client.query(ORDERS_QUERIES.NEXT_NUMERO_ORD);
      const { rows: empRows }  = await client.query(ORDERS_QUERIES.PRIMER_EMPLEADO_ADMIN);

      if (empRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(500).json({ ok: false, message: 'No hay empleados activos en el sistema para asignar el pedido.' });
      }

      const numeroPedido = numRows[0].numero_pedido;
      const empleado_id  = empRows[0].id_empleado;

      const { rows: pedRows } = await client.query(PEDIDOS_QUERIES.CREATE, [
        cliente_id,
        empleado_id,
        numeroPedido,
        fecha_entrega,               // fecha_entrega del cliente
        `Orden catálogo #${order.id}`,
        'Catálogo online',           // created_by
        total,
      ]);

      const pedido_id = pedRows[0].id_pedido;

      // Enviar correo si el cliente definió fecha de entrega
      if (fecha_entrega) {
        const { rows: cliInfo } = await client.query(
          `SELECT nombre, email FROM clientes WHERE id_cliente = $1`, [cliente_id]
        );
        if (cliInfo[0]?.email) {
          enviarCorreoFechaEntrega({
            correo: cliInfo[0].email,
            nombre: cliInfo[0].nombre,
            fechaEntrega: fecha_entrega,
            numeroPedido,
          }).catch(err => console.error('[email] Error al enviar correo fecha entrega:', err.message));
        }
      }

      for (const item of itemsCalculados) {
        await client.query(PEDIDOS_QUERIES.INSERT_DETALLE, [
          pedido_id, item.productId, item.qty, item.price, item.subtotal,
        ]);
      }

      await client.query(
        `UPDATE orders SET pedido_id = $1 WHERE id = $2`,
        [pedido_id, order.id]
      );

      // ── Crear venta automáticamente según tipo de pago ──
      const { rows: numVRows } = await client.query(VENTAS_QUERIES.NEXT_NUMERO);
      const { rows: ventaRows } = await client.query(VENTAS_QUERIES.CREATE, [
        numVRows[0].numero_venta,
        pedido_id,
        cliente_id,
        empleado_id,
        new Date(),
        total,
      ]);
      const venta_id = ventaRows[0].id_venta;

      if (req.body.direccion?.trim()) {
        await client.query(
          `INSERT INTO domicilios
             (venta_id, cliente_id, empleado_id, barrio, direccion, referencias)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [venta_id, cliente_id, empleado_id, null, req.body.direccion.trim(), null]
        );
      }

      for (const item of itemsCalculados) {
        await client.query(VENTAS_QUERIES.INSERT_DETALLE, [
          venta_id, item.productId, item.qty, item.price, item.subtotal,
        ]);
      }

      if (payment_type === 'COMPLETO') {
        // Pago completo: marcar la venta como totalmente abonada
        await client.query(VENTAS_QUERIES.SUMAR_ABONADO, [total, venta_id]);
      } else {
        // Abono parcial: registrar la primera cuota
        const { rows: cuotaRows } = await client.query(ABONOS_QUERIES.NEXT_CUOTA, [venta_id]);
        await client.query(ABONOS_QUERIES.CREATE, [
          venta_id, empleado_id, cuotaRows[0].siguiente, paid_amount, 'Transferencia',
        ]);
        await client.query(VENTAS_QUERIES.SUMAR_ABONADO, [paid_amount, venta_id]);
      }
    } else {
      // El usuario no tiene perfil de cliente aún — la order se guarda igual
      // pero no se crea el espejo en pedidos hasta que se vincule un cliente
      console.warn(`[orders] user_id ${user_id} no tiene cliente asociado. Espejo en pedidos omitido.`);
    }

    // Vaciar carrito si la tabla existe
    const { rows: cartCheck } = await client.query(ORDERS_QUERIES.CART_EXISTS);
    if (cartCheck.length > 0) {
      await client.query(ORDERS_QUERIES.CLEAR_CART, [user_id]);
    }

    await client.query('COMMIT');

    // Correo de pedido exitoso
    try {
      const { rows: cliCorreo } = await pool.query(
        `SELECT c.nombre, c.email FROM clientes c WHERE c.usuario_id = $1 LIMIT 1`, [user_id]
      );
      if (cliCorreo[0]?.email) {
        enviarCorreoPedidoExitoso({
          correo:       cliCorreo[0].email,
          nombre:       cliCorreo[0].nombre,
          numeroPedido: order.id,
          items:        itemsCalculados,
          total,
          tipoPago:     payment_type,
          abonado:      paid_amount,
        }).catch(err => console.error('[email] Pedido exitoso:', err.message));
      }
    } catch (_) {}

    return res.status(201).json({
      ok: true,
      message: 'Orden creada exitosamente.',
      data: { ...order, items: itemsCalculados },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[orders] Error al crear orden:', error.message);
    console.error('[orders] Stack:', error.stack);
    return res.status(500).json({
      ok: false,
      message: 'Error al crear la orden.',
      // Solo en desarrollo — quitar en producción
      ...(process.env.NODE_ENV !== 'production' && { error: error.message }),
    });
  } finally {
    client.release();
  }
};

// GET /api/orders/my-orders
export const misOrders = async (req, res) => {
  const user_id = req.usuario?.id_usuario;
  if (!user_id) return res.status(401).json({ ok: false, message: 'No autenticado.' });

  try {
    const { rows } = await pool.query(ORDERS_QUERIES.MY_ORDERS, [user_id]);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('[orders] Error al listar mis órdenes:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al obtener las órdenes.' });
  }
};

// GET /api/admin/orders  ← ruta real (ver orders.routes.js)
export const todasLasOrders = async (_req, res) => {
  try {
    const { rows } = await pool.query(ORDERS_QUERIES.ALL_ORDERS);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('[orders] Error al listar todas las órdenes:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al obtener las órdenes.' });
  }
};

// PATCH /api/admin/orders/:id/status
export const cambiarEstadoOrder = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !ESTADOS_VALIDOS.includes(status)) {
    return res.status(400).json({
      ok: false,
      message: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`,
    });
  }

  // Mapa de estado orders → estado pedidos
  const ESTADO_MAP = {
    'Pendiente':      'ACTIVO',
    'Confirmado':     'ACEPTADO',
    'En preparación': 'CON_FECHA_ASIGNADA',
    'Enviado':        'EN_ESPERA_FECHA',
    'Entregado':      'ENTREGADO',
    'Cancelado':      'INACTIVO',
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(ORDERS_QUERIES.UPDATE_STATUS, [status, id]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Orden no encontrada.' });
    }

    // Sincronizar estado en pedidos si hay espejo
    const pedido_id = rows[0].pedido_id;
    if (pedido_id && ESTADO_MAP[status]) {
      await client.query(PEDIDOS_QUERIES.CAMBIAR_ESTADO, [ESTADO_MAP[status], pedido_id]);
    }

    await client.query('COMMIT');
    return res.status(200).json({ ok: true, message: 'Estado actualizado.', data: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[orders] Error al cambiar estado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar el estado.' });
  } finally {
    client.release();
  }
};
