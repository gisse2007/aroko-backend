// src/controllers/produccion.controller.js

import pool from '../config/db.js';
import { PRODUCCION_QUERIES, SALIDAS_QUERIES } from '../queries/produccion.queries.js';
import { INSUMOS_QUERIES }  from '../queries/stock.queries.js';
import { PRODUCTOS_QUERIES } from '../queries/productos.queries.js';

// ══════════════════════════════════════════════
//  PRODUCCIÓN
// ══════════════════════════════════════════════

// GET /api/produccion?estado=&empleado=&desde=&hasta=
export const listarProduccion = async (req, res) => {
  const { estado, empleado, desde, hasta } = req.query;
  try {
    let rows;

    if (desde && hasta) {
      ({ rows } = await pool.query(PRODUCCION_QUERIES.FILTER_FECHAS, [desde, hasta]));
    } else if (estado) {
      ({ rows } = await pool.query(PRODUCCION_QUERIES.FILTER_ESTADO, [estado.toUpperCase()]));
    } else if (empleado) {
      ({ rows } = await pool.query(PRODUCCION_QUERIES.FILTER_EMPLEADO, [`%${empleado.trim()}%`]));
    } else {
      ({ rows } = await pool.query(PRODUCCION_QUERIES.LIST));
    }

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay registros de producción.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar producción:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar producción.' });
  }
};

// GET /api/produccion/:id
export const obtenerProduccion = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(PRODUCCION_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Registro de producción no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al cargar el detalle de producción.' });
  }
};

// POST /api/produccion
// Body: { empleado_id, fecha, observaciones, detalle: [{producto_id, cantidad}] }
export const registrarProduccion = async (req, res) => {
  const { empleado_id, fecha, observaciones = '', detalle } = req.body;

  if (!empleado_id || !detalle) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  const detalleArr = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;

  if (!Array.isArray(detalleArr) || detalleArr.length === 0) {
    return res.status(400).json({ ok: false, message: 'Debes agregar al menos un producto al detalle.' });
  }

  // Validar producto duplicado en el detalle
  const ids = detalleArr.map((d) => d.producto_id);
  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({ ok: false, message: 'No puedes agregar el mismo producto dos veces en la misma producción.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Paso 1: Cargar todas las recetas UNA SOLA VEZ y calcular insumos totales ──
    const recetasCache = new Map(); // { producto_id: [{insumo_id, cantidad_requerida}] }
    const insumosRequeridos = {}; // { insumo_id: totalRequerido }

    for (const item of detalleArr) {
      const cantidad = parseFloat(item.cantidad);
      if (!cantidad || cantidad <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: `La cantidad para el producto ${item.producto_id} debe ser mayor a cero.` });
      }

      // Traer la receta del producto (cacheada para evitar N+1)
      let receta = recetasCache.get(item.producto_id);
      if (!receta) {
        const { rows: recetaRows } = await client.query(PRODUCCION_QUERIES.GET_RECETA, [item.producto_id]);
        if (recetaRows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ ok: false, message: `El producto ${item.producto_id} no tiene receta definida.` });
        }
        receta = recetaRows;
        recetasCache.set(item.producto_id, receta);
      }

      for (const r of receta) {
        const requerido = parseFloat(r.cantidad_requerida) * cantidad;
        insumosRequeridos[r.insumo_id] = (insumosRequeridos[r.insumo_id] || 0) + requerido;
      }
    }

    // ── Paso 2: Cargar todos los insumos necesarios UNA SOLA VEZ ──
    const insumosCache = new Map(); // { insumo_id: {nombre, stock_actual, unidad_medida, stock_minimo} }
    const insumoIds = Object.keys(insumosRequeridos).map(Number);

    if (insumoIds.length > 0) {
      const { rows: insumosRows } = await client.query(
        'SELECT id_insumo, nombre, stock_actual, unidad_medida, stock_minimo FROM insumos WHERE id_insumo = ANY($1)',
        [insumoIds]
      );
      for (const ins of insumosRows) {
        insumosCache.set(ins.id_insumo, ins);
      }
    }

    // Validar stock suficiente para todos los insumos
    for (const [insumoId, totalRequerido] of Object.entries(insumosRequeridos)) {
      const insumo = insumosCache.get(Number(insumoId));
      if (!insumo) continue;

      if (parseFloat(insumo.stock_actual) < totalRequerido) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          message: `Stock insuficiente para "${insumo.nombre}". Disponible: ${insumo.stock_actual} ${insumo.unidad_medida}, Requerido: ${totalRequerido.toFixed(2)} ${insumo.unidad_medida}.`,
        });
      }
    }

    // ── Paso 3: Crear cabecera ───────────────────────────────────────────
    const { rows: produccionRows } = await client.query(PRODUCCION_QUERIES.CREATE, [
      empleado_id,
      fecha || new Date(),
      observaciones.trim(),
    ]);
    const produccionId = produccionRows[0].id_produccion;

    // ── Paso 4: Insertar detalle + descontar insumos + sumar stock producto ──
    const alertas = [];
    const insumosAlertados = new Set(); // Evitar alertas duplicadas

    for (const item of detalleArr) {
      const cantidad = parseFloat(item.cantidad);

      // Insertar detalle de producción
      await client.query(PRODUCCION_QUERIES.INSERT_DETALLE, [produccionId, item.producto_id, cantidad]);

      // Descontar insumos según receta (usando cache)
      const receta = recetasCache.get(item.producto_id);
      for (const r of receta) {
        const cantidadInsumo = parseFloat(r.cantidad_requerida) * cantidad;
        await client.query(INSUMOS_QUERIES.RESTAR_STOCK, [cantidadInsumo, r.insumo_id]);

        // Verificar alerta de stock mínimo usando cache (sin query adicional)
        if (!insumosAlertados.has(r.insumo_id)) {
          const insumo = insumosCache.get(r.insumo_id);
          if (insumo) {
            const nuevoStock = parseFloat(insumo.stock_actual) - cantidadInsumo;
            if (nuevoStock < parseFloat(insumo.stock_minimo)) {
              alertas.push(`El insumo "${insumo.nombre}" quedó por debajo del stock mínimo.`);
              insumosAlertados.add(r.insumo_id);
            }
          }
        }
      }

      // Sumar stock al producto producido
      await client.query(PRODUCTOS_QUERIES.SUMAR_STOCK, [cantidad, item.producto_id]);
    }

    await client.query('COMMIT');

    const { rows: completo } = await pool.query(PRODUCCION_QUERIES.FIND_BY_ID, [produccionId]);
    return res.status(201).json({
      ok: true,
      message: 'Producción registrada exitosamente.',
      alertas,
      data: completo[0],
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar producción:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar la producción.' });
  } finally {
    client.release();
  }
};

// PATCH /api/produccion/:id/anular
// Body: { motivo_anulacion }
// Revierte stock de insumos y resta stock de productos
export const anularProduccion = async (req, res) => {
  const { id } = req.params;
  const { motivo_anulacion } = req.body;

  if (!motivo_anulacion) {
    return res.status(400).json({ ok: false, message: 'El motivo de anulación es requerido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Anular cabecera
    const { rows } = await client.query(PRODUCCION_QUERIES.ANULAR, [motivo_anulacion.trim(), id]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, message: 'La producción no existe o ya está anulada.' });
    }

    // Traer detalle completo con receta para revertir
    const { rows: detalle } = await client.query(PRODUCCION_QUERIES.GET_DETALLE_COMPLETO, [id]);

    // Agrupar por producto para restar stock de producto
    const porProducto = {};
    for (const row of detalle) {
      if (!porProducto[row.producto_id]) porProducto[row.producto_id] = row.cantidad;
    }

    // Restar stock de cada producto
    for (const [productoId, cantidad] of Object.entries(porProducto)) {
      await client.query(PRODUCTOS_QUERIES.RESTAR_STOCK, [cantidad, productoId]);
    }

    // Devolver insumos: cantidad_requerida × cantidad_producida por cada fila
    for (const row of detalle) {
      const cantidadInsumo = parseFloat(row.cantidad_requerida) * parseFloat(row.cantidad);
      await client.query(INSUMOS_QUERIES.SUMAR_STOCK, [cantidadInsumo, row.insumo_id]);
    }

    await client.query('COMMIT');
    return res.status(200).json({
      ok: true,
      message: 'Producción anulada. Stock de insumos revertido y stock de productos descontado.',
      data: rows[0],
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al anular producción:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al anular la producción.' });
  } finally {
    client.release();
  }
};

// ══════════════════════════════════════════════
//  SALIDAS DE INSUMOS
// ══════════════════════════════════════════════

// GET /api/salidas?search=&desde=&hasta=
export const listarSalidas = async (req, res) => {
  const { search, desde, hasta } = req.query;
  try {
    let rows;
    if (search) {
      ({ rows } = await pool.query(SALIDAS_QUERIES.SEARCH, [`%${search.trim()}%`]));
    } else if (desde && hasta) {
      ({ rows } = await pool.query(SALIDAS_QUERIES.FILTER_FECHAS, [desde, hasta]));
    } else {
      ({ rows } = await pool.query(SALIDAS_QUERIES.LIST));
    }

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay salidas registradas.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar salidas:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar salidas.' });
  }
};

// GET /api/salidas/:id
export const obtenerSalida = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(SALIDAS_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Salida no encontrada.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al cargar el detalle de la salida.' });
  }
};

// POST /api/salidas
// Body: { empleado_id, motivo, detalle: [{insumo_id, cantidad}] }
export const crearSalida = async (req, res) => {
  const { empleado_id, motivo, detalle } = req.body;

  if (!empleado_id || !motivo || !detalle) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  const detalleArr = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;
  if (!Array.isArray(detalleArr) || detalleArr.length === 0) {
    return res.status(400).json({ ok: false, message: 'La salida debe tener al menos un insumo.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validar stock de cada insumo antes de descontar
    for (const item of detalleArr) {
      const { rows: ins } = await client.query(
        'SELECT nombre, stock_actual, unidad_medida FROM insumos WHERE id_insumo = $1', [item.insumo_id]
      );
      if (ins.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: `Insumo ${item.insumo_id} no encontrado.` });
      }
      if (parseFloat(ins[0].stock_actual) < parseFloat(item.cantidad)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          message: `Stock insuficiente para "${ins[0].nombre}". Disponible: ${ins[0].stock_actual} ${ins[0].unidad_medida}.`,
        });
      }
    }

    // Crear cabecera
    const { rows } = await client.query(SALIDAS_QUERIES.CREATE, [empleado_id, motivo.trim()]);
    const salidaId = rows[0].id_salida;

    // Insertar detalle y descontar stock
    for (const item of detalleArr) {
      await client.query(SALIDAS_QUERIES.INSERT_DETALLE, [salidaId, item.insumo_id, parseFloat(item.cantidad)]);
      await client.query(INSUMOS_QUERIES.RESTAR_STOCK, [parseFloat(item.cantidad), item.insumo_id]);
    }

    await client.query('COMMIT');

    const { rows: completo } = await pool.query(SALIDAS_QUERIES.FIND_BY_ID, [salidaId]);
    return res.status(201).json({
      ok: true,
      message: 'Salida de insumos registrada exitosamente.',
      data: completo[0],
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear salida:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar la salida.' });
  } finally {
    client.release();
  }
};

// PATCH /api/salidas/:id/anular  (equivalente al remove del frontend — restaura stock)
export const anularSalida = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Anular
    const { rows } = await client.query(SALIDAS_QUERIES.ANULAR, [id]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, message: 'La salida no existe o ya está anulada.' });
    }

    // Restaurar stock de cada insumo
    const { rows: detalle } = await client.query(SALIDAS_QUERIES.GET_DETALLE, [id]);
    for (const item of detalle) {
      await client.query(INSUMOS_QUERIES.SUMAR_STOCK, [item.cantidad, item.insumo_id]);
    }

    await client.query('COMMIT');
    return res.status(200).json({
      ok: true,
      message: 'Salida anulada. Stock de insumos restaurado.',
      data: rows[0],
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al anular salida:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al anular la salida.' });
  } finally {
    client.release();
  }
};