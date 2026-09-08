// src/controllers/compras.controller.js
import pool                from '../config/db.js';
import { COMPRAS_QUERIES } from '../queries/compras.queries.js';
import {
  resolverInsumo,
  sumarStockConAuditoria,
  restarStockConAuditoria,
} from '../services/inventario.service.js';

// ─────────────────────────────────────────────
// Utilidad interna
// ─────────────────────────────────────────────
function calcularTotales(detalle, iva = 19) {
  const subtotalBase = detalle.reduce((acc, d) => acc + parseFloat(d.subtotal), 0);
  const ivaValor     = subtotalBase * (parseFloat(iva) / 100);
  const total        = subtotalBase + ivaValor;
  return { subtotalBase, ivaValor, total };
}

// ─────────────────────────────────────────────
// GET /api/compras?search=&proveedor_id=&desde=&hasta=
// ─────────────────────────────────────────────
export const listarCompras = async (req, res) => {
  const { search, proveedor_id, desde, hasta } = req.query;
  try {
    let rows;
    if (desde && hasta) {
      ({ rows } = await pool.query(COMPRAS_QUERIES.FILTER_FECHAS, [desde, hasta]));
    } else if (search) {
      ({ rows } = await pool.query(COMPRAS_QUERIES.SEARCH, [`%${search.trim()}%`]));
    } else if (proveedor_id) {
      ({ rows } = await pool.query(COMPRAS_QUERIES.FILTER_PROVEEDOR, [parseInt(proveedor_id)]));
    } else {
      ({ rows } = await pool.query(COMPRAS_QUERIES.LIST));
    }

    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar compras:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar compras.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/compras/:id
// ─────────────────────────────────────────────
export const obtenerCompra = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(COMPRAS_QUERIES.FIND_BY_ID, [id]);
    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'Compra no encontrada.' });
    }

    const compra = rows[0];
    const detalleInsumos = Array.isArray(compra.detalle) ? compra.detalle : [];

    return res.status(200).json({
      ok: true,
      data: {
        ...compra,
        detalleInsumos,
        insumos: detalleInsumos,
      },
    });
  } catch (error) {
    console.error('Error al obtener compra:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar el detalle de la compra.' });
  }
};

// ─────────────────────────────────────────────
// POST /api/compras
// Body: { proveedor_id, empleado_id, numero_factura, iva, detalle: [
//   { insumo_id?, nombre_insumo, cantidad, precio, categoria_id?, unidad_medida? }
// ]}
// File: foto_comprobante (opcional)
// ─────────────────────────────────────────────
export const crearCompra = async (req, res) => {
  const { proveedor_id, empleado_id, numero_factura, iva = 19, detalle } = req.body;
  const foto = req.file ? `uploads/comprobantes/${req.file.filename}` : null;

  if (!proveedor_id || !empleado_id || !numero_factura || !detalle) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  let detalleArr;
  try {
    detalleArr = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;
  } catch {
    return res.status(400).json({ ok: false, message: 'El detalle de la compra no es válido.' });
  }

  if (!Array.isArray(detalleArr) || detalleArr.length === 0) {
    return res.status(400).json({ ok: false, message: 'La compra debe tener al menos un insumo.' });
  }

  // Validaciones previas sobre cada ítem
  for (const item of detalleArr) {
    const cantidad = parseFloat(item.cantidad);
    const precio   = parseFloat(item.precio);

    if (!item.nombre_insumo && !item.insumo_id) {
      return res.status(400).json({ ok: false, message: 'Cada ítem debe tener nombre_insumo o insumo_id.' });
    }
    if (isNaN(cantidad) || cantidad <= 0) {
      return res.status(400).json({ ok: false, message: `Cantidad inválida para el insumo "${item.nombre_insumo ?? item.insumo_id}".` });
    }
    if (isNaN(precio) || precio < 0) {
      return res.status(400).json({ ok: false, message: `Precio inválido para el insumo "${item.nombre_insumo ?? item.insumo_id}".` });
    }
  }

  const usuarioId = req.usuario?.id_usuario ?? null;
  const client    = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar factura duplicada
    const { rows: dup } = await client.query(COMPRAS_QUERIES.FACTURA_EXISTS, [numero_factura.trim(), 0]);
    if (dup.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'El número de factura ya se encuentra registrado.' });
    }

    // Calcular totales
    const detalleConSubtotal = detalleArr.map((item) => ({
      ...item,
      subtotal: parseFloat(item.cantidad) * parseFloat(item.precio),
    }));
    const { subtotalBase, ivaValor, total } = calcularTotales(detalleConSubtotal, iva);

    // Crear cabecera de compra
    const { rows: compraRows } = await client.query(COMPRAS_QUERIES.CREATE, [
      proveedor_id,
      empleado_id,
      numero_factura.trim(),
      foto,
      parseFloat(iva),
      ivaValor,
      subtotalBase,
      total,
    ]);
    const compraId   = compraRows[0].id_compra;
    const referencia = `COMPRA-${compraId}`;

    // Procesar cada ítem: resolver insumo + insertar detalle + sumar stock + auditoría
    for (const item of detalleConSubtotal) {
      const cantidad       = parseFloat(item.cantidad);
      const contenido      = parseFloat(item.contenido ?? 1);
      const precio         = parseFloat(item.precio);

      // stock_ingresado = cantidad comprada × contenido por presentación
      const stockIngresado = parseFloat(item.stock_ingresado) || (cantidad * contenido);

      if (stockIngresado <= 0) {
        throw new Error(`stock_ingresado inválido para el insumo "${item.nombre_insumo ?? item.insumo_id}".`);
      }

      // Resolver insumo (buscar existente o crear nuevo)
      let insumo;
      if (item.insumo_id) {
        const { rows: found } = await client.query(
          'SELECT id_insumo, nombre, stock_actual FROM insumos WHERE id_insumo = $1',
          [item.insumo_id]
        );
        if (!found.length) throw new Error(`Insumo con id ${item.insumo_id} no encontrado.`);
        insumo = found[0];
      } else {
        insumo = await resolverInsumo(client, item);
      }

      // Insertar detalle de compra (guarda cantidad, contenido y stock_ingresado real)
      await client.query(COMPRAS_QUERIES.INSERT_DETALLE, [
        compraId,
        insumo.id_insumo,
        cantidad,
        contenido,
        stockIngresado,
        precio,
        item.subtotal,
      ]);

      // Sumar al inventario usando stock_ingresado (cantidad × contenido), NO solo cantidad
      await sumarStockConAuditoria(client, insumo.id_insumo, stockIngresado, referencia, usuarioId);
    }

    await client.query('COMMIT');

    const { rows: completa } = await pool.query(COMPRAS_QUERIES.FIND_BY_ID, [compraId]);
    return res.status(201).json({
      ok: true,
      message: 'Compra registrada exitosamente.',
      data: completa[0],
    });

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error al crear compra:', error.message);
    return res.status(500).json({ ok: false, message: error.message || 'Error al registrar la compra.' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// PATCH /api/compras/:id/anular
// ─────────────────────────────────────────────
export const anularCompra = async (req, res) => {
  const { id }      = req.params;
  const usuarioId   = req.usuario?.id_usuario ?? null;
  const client      = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(COMPRAS_QUERIES.ANULAR, [id]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, message: 'La compra no existe o ya está anulada.' });
    }

    const { rows: detalle } = await client.query(COMPRAS_QUERIES.GET_DETALLE, [id]);
    const referencia = `ANULACION-COMPRA-${id}`;

    for (const item of detalle) {
      // Revertir exactamente lo que se sumó: stock_ingresado (cantidad × contenido)
      const stockARevertir = parseFloat(item.stock_ingresado);
      const resultado = await restarStockConAuditoria(
        client,
        item.insumo_id,
        stockARevertir,
        referencia,
        usuarioId
      );
      if (!resultado) {
        console.warn(`⚠ Stock insuficiente para revertir insumo ${item.insumo_id} al anular compra ${id}`);
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({
      ok: true,
      message: 'Compra anulada. Stock de insumos revertido.',
      data: rows[0],
    });

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error al anular compra:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al anular la compra.' });
  } finally {
    client.release();
  }
};
