// src/controllers/ventas.controller.js

import pool from '../config/db.js';
import { VENTAS_QUERIES, ABONOS_QUERIES } from '../queries/ventas.queries.js';
import { PRODUCTOS_QUERIES } from '../queries/productos.queries.js';

// ══════════════════════════════════════════════
//  VENTAS
// ══════════════════════════════════════════════

// GET /api/ventas?search=&estado=&desde=&hasta=
export const listarVentas = async (req, res) => {
  const { search, estado, desde, hasta } = req.query;
  try {
    let rows;
    if (desde && hasta) {
      ({ rows } = await pool.query(VENTAS_QUERIES.FILTER_FECHAS, [desde, hasta]));
    } else if (estado) {
      ({ rows } = await pool.query(VENTAS_QUERIES.FILTER_ESTADO, [estado.toUpperCase()]));
    } else if (search) {
      ({ rows } = await pool.query(VENTAS_QUERIES.SEARCH, [`%${search.trim()}%`]));
    } else {
      ({ rows } = await pool.query(VENTAS_QUERIES.LIST));
    }

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay ventas registradas.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar ventas:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar ventas.' });
  }
};

// GET /api/ventas/:id
export const obtenerVenta = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(VENTAS_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Venta no encontrada.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al cargar la venta.' });
  }
};

// POST /api/ventas
// Body: { pedido_id?, cliente_id, empleado_id, fecha_venta?, detalle: [{producto_id, cantidad, precio}] }
export const registrarVenta = async (req, res) => {
  const { pedido_id, cliente_id, empleado_id, fecha_venta, detalle } = req.body;

  if (!cliente_id || !empleado_id || !detalle) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  const detalleArr = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;
  if (!Array.isArray(detalleArr) || detalleArr.length === 0) {
    return res.status(400).json({ ok: false, message: 'La venta debe tener al menos un producto.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Validar stock de cada producto ───────────────────────────────────
    for (const item of detalleArr) {
      const { rows: prod } = await client.query(
        'SELECT nombre, stock_producto FROM productos WHERE id_producto = $1 AND estado = $2',
        [item.producto_id, 'ACTIVO']
      );
      if (prod.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: `Producto ${item.producto_id} no encontrado o inactivo.` });
      }
      if (parseFloat(prod[0].stock_producto) < parseFloat(item.cantidad)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          message: `Stock insuficiente para "${prod[0].nombre}". Disponible: ${prod[0].stock_producto}.`,
        });
      }
    }

    // ── Generar numero_venta ─────────────────────────────────────────────
    const { rows: numRows } = await client.query(VENTAS_QUERIES.NEXT_NUMERO);
    const numeroVenta = numRows[0].numero_venta;

    // ── Calcular total ───────────────────────────────────────────────────
    const total = detalleArr.reduce(
      (acc, d) => acc + parseFloat(d.precio) * parseFloat(d.cantidad), 0
    );

    // ── Crear venta ──────────────────────────────────────────────────────
    const { rows } = await client.query(VENTAS_QUERIES.CREATE, [
      numeroVenta,
      pedido_id || null,
      cliente_id,
      empleado_id,
      fecha_venta || new Date(),
      total,
    ]);
    const ventaId = rows[0].id_venta;

    // ── Insertar detalle y descontar stock ───────────────────────────────
    for (const item of detalleArr) {
      const subtotal = parseFloat(item.cantidad) * parseFloat(item.precio);
      await client.query(VENTAS_QUERIES.INSERT_DETALLE, [
        ventaId, item.producto_id,
        parseFloat(item.cantidad), parseFloat(item.precio), subtotal,
      ]);
      // Descontar stock del producto
      await client.query(PRODUCTOS_QUERIES.RESTAR_STOCK, [parseFloat(item.cantidad), item.producto_id]);
    }

    await client.query('COMMIT');

    const { rows: completo } = await pool.query(VENTAS_QUERIES.FIND_BY_ID, [ventaId]);
    return res.status(201).json({
      ok: true,
      message: 'Venta registrada exitosamente.',
      data: completo[0],
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar venta:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar la venta.' });
  } finally {
    client.release();
  }
};

// PATCH /api/ventas/:id/anular
// Body: { motivo_anulacion }
// Revierte stock de productos
export const anularVenta = async (req, res) => {
  const { id } = req.params;
  const { motivo_anulacion } = req.body;

  if (!motivo_anulacion) {
    return res.status(400).json({ ok: false, message: 'El motivo de anulación es requerido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Anular (solo si está REGISTRADA)
    const { rows } = await client.query(VENTAS_QUERIES.ANULAR, [motivo_anulacion.trim(), id]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, message: 'La venta no existe o ya está anulada.' });
    }

    // Revertir stock de cada producto
    const { rows: detalle } = await client.query(VENTAS_QUERIES.GET_DETALLE, [id]);
    for (const item of detalle) {
      await client.query(PRODUCTOS_QUERIES.SUMAR_STOCK, [item.cantidad, item.producto_id]);
    }

    await client.query('COMMIT');
    return res.status(200).json({
      ok: true,
      message: 'Venta anulada. Stock de productos revertido.',
      data: rows[0],
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al anular venta:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al anular la venta.' });
  } finally {
    client.release();
  }
};

// ══════════════════════════════════════════════
//  ABONOS
// ══════════════════════════════════════════════

// GET /api/abonos?venta_id=&desde=&hasta=
export const listarAbonos = async (req, res) => {
  const { venta_id, desde, hasta } = req.query;
  try {
    let rows;
    if (venta_id) {
      ({ rows } = await pool.query(ABONOS_QUERIES.BY_VENTA, [venta_id]));
    } else if (desde && hasta) {
      ({ rows } = await pool.query(ABONOS_QUERIES.FILTER_FECHAS, [desde, hasta]));
    } else {
      ({ rows } = await pool.query(ABONOS_QUERIES.LIST));
    }

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay abonos registrados.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar abonos:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar abonos.' });
  }
};

// GET /api/abonos/:id
export const obtenerAbono = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(ABONOS_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Abono no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al cargar el abono.' });
  }
};

// POST /api/abonos
// Body: { venta_id, empleado_id, valor, metodo_pago }
export const registrarAbono = async (req, res) => {
  const { venta_id, empleado_id, valor, metodo_pago = 'Efectivo' } = req.body;

  if (!venta_id || !empleado_id || !valor) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  const valorNum = parseFloat(valor);
  if (valorNum <= 0) {
    return res.status(400).json({ ok: false, message: 'El valor del abono debe ser mayor a cero.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que la venta existe y está activa
    const { rows: ventaRows } = await client.query(
      'SELECT id_venta, total, abonado, saldo, estado FROM ventas WHERE id_venta = $1', [venta_id]
    );
    if (ventaRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Venta no encontrada.' });
    }
    const venta = ventaRows[0];
    if (venta.estado !== 'REGISTRADA') {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, message: 'No se pueden registrar abonos a una venta anulada.' });
    }

    // Verificar máximo 3 cuotas activas
    const { rows: cuentaRows } = await client.query(ABONOS_QUERIES.COUNT_CUOTAS, [venta_id]);
    if (parseInt(cuentaRows[0].total) >= 3) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, message: 'La venta ya tiene el máximo de 3 cuotas registradas.' });
    }

    // Verificar que el valor no supere el saldo
    const saldoActual = parseFloat(venta.saldo);
    if (valorNum > saldoActual) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        message: `El valor ($${valorNum.toLocaleString()}) supera el saldo pendiente ($${saldoActual.toLocaleString()}).`,
      });
    }

    // Obtener el número de cuota siguiente
    const { rows: cuotaRows } = await client.query(ABONOS_QUERIES.NEXT_CUOTA, [venta_id]);
    const numeroCuota = parseInt(cuotaRows[0].siguiente);

    // Crear el abono
    const { rows: abonoRows } = await client.query(ABONOS_QUERIES.CREATE, [
      venta_id, empleado_id, numeroCuota, valorNum, metodo_pago,
    ]);

    // Actualizar el campo abonado de la venta
    await client.query(VENTAS_QUERIES.SUMAR_ABONADO, [valorNum, venta_id]);

    await client.query('COMMIT');

    const { rows: completo } = await pool.query(ABONOS_QUERIES.FIND_BY_ID, [abonoRows[0].id_abono]);
    return res.status(201).json({
      ok: true,
      message: `Abono registrado (cuota ${numeroCuota} de 3).`,
      data: completo[0],
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar abono:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar el abono.' });
  } finally {
    client.release();
  }
};

// PATCH /api/abonos/:id/anular
// Descuenta el valor del campo abonado en la venta
export const anularAbono = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener abono antes de anular
    const { rows: abonoRows } = await client.query(
      'SELECT id_abono, venta_id, valor, estado FROM abonos WHERE id_abono = $1', [id]
    );
    if (abonoRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Abono no encontrado.' });
    }
    const abono = abonoRows[0];
    if (abono.estado !== 'REGISTRADO') {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, message: 'El abono ya se encuentra anulado.' });
    }

    // Anular el abono
    const { rows } = await client.query(ABONOS_QUERIES.ANULAR, [id]);

    // Descontar del campo abonado de la venta
    await client.query(VENTAS_QUERIES.RESTAR_ABONADO, [parseFloat(abono.valor), abono.venta_id]);

    await client.query('COMMIT');
    return res.status(200).json({
      ok: true,
      message: 'Abono anulado. Saldo de la venta actualizado.',
      data: rows[0],
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al anular abono:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al anular el abono.' });
  } finally {
    client.release();
  }
};