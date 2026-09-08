// src/services/inventario.service.js
import { INSUMOS_QUERIES, MOVIMIENTOS_QUERIES } from '../queries/stock.queries.js';

/**
 * Normaliza un nombre de insumo: trim + colapsa espacios + lowercase para comparar.
 */
function normalizarNombre(nombre) {
  return nombre.trim().replace(/\s+/g, ' ');
}

/**
 * Resuelve un insumo dentro de una transacción:
 *   - Si existe (búsqueda tolerante) → devuelve el existente.
 *   - Si no existe → lo crea con stock_actual = 0.
 *
 * @param {object} client      - Cliente pg de la transacción activa.
 * @param {object} item        - { nombre_insumo, categoria_id, unidad_medida, precio_unitario? }
 * @returns {object}           - Fila del insumo con id_insumo y stock_actual.
 */
export async function resolverInsumo(client, item) {
  const nombre = normalizarNombre(item.nombre_insumo || item.nombre || '');
  if (!nombre) throw new Error('El nombre del insumo es obligatorio.');

  // Buscar por nombre normalizado (tolerante a mayúsculas/espacios)
  const { rows: encontrados } = await client.query(
    INSUMOS_QUERIES.FIND_BY_NOMBRE,
    [nombre]
  );

  if (encontrados.length > 0) {
    return encontrados[0];
  }

  // No existe → crear
  if (!item.categoria_id) {
    throw new Error(`El insumo "${nombre}" no existe y no se proporcionó categoria_id para crearlo.`);
  }

  const { rows: creados } = await client.query(INSUMOS_QUERIES.CREATE, [
    nombre,
    item.categoria_id,
    (item.unidad_medida || 'Und').trim(),
    0,                                          // stock_actual inicial = 0
    parseFloat(item.stock_minimo)    || 0,
    parseFloat(item.precio_unitario) || 0,
  ]);

  return creados[0];
}

/**
 * Suma stock a un insumo y registra el movimiento de auditoría.
 * Debe ejecutarse dentro de una transacción activa.
 *
 * @param {object} client        - Cliente pg de la transacción.
 * @param {number} insumoId
 * @param {number} cantidad      - Debe ser > 0.
 * @param {string} referencia    - Ej: "COMPRA-123"
 * @param {number|null} usuarioId
 * @returns {{ stockAnterior, stockNuevo }}
 */
export async function sumarStockConAuditoria(client, insumoId, cantidad, referencia = null, usuarioId = null) {
  if (cantidad <= 0) throw new Error('La cantidad a sumar debe ser mayor que cero.');

  // Capturar stock anterior
  const { rows: actual } = await client.query(INSUMOS_QUERIES.GET_STOCK_ACTUAL, [insumoId]);
  if (!actual.length) throw new Error(`Insumo ${insumoId} no encontrado al actualizar stock.`);
  const stockAnterior = parseFloat(actual[0].stock_actual);

  // Sumar stock
  const { rows: actualizado } = await client.query(INSUMOS_QUERIES.SUMAR_STOCK, [cantidad, insumoId]);
  const stockNuevo = parseFloat(actualizado[0].stock_actual);

  // Registrar movimiento
  await client.query(MOVIMIENTOS_QUERIES.REGISTRAR, [
    insumoId,
    'ENTRADA',
    cantidad,
    stockAnterior,
    stockNuevo,
    referencia,
    usuarioId,
  ]);

  return { stockAnterior, stockNuevo };
}

/**
 * Resta stock a un insumo y registra el movimiento de auditoría.
 * Devuelve null si no hay stock suficiente (no lanza error — el caller decide).
 */
export async function restarStockConAuditoria(client, insumoId, cantidad, referencia = null, usuarioId = null) {
  if (cantidad <= 0) throw new Error('La cantidad a restar debe ser mayor que cero.');

  const { rows: actual } = await client.query(INSUMOS_QUERIES.GET_STOCK_ACTUAL, [insumoId]);
  if (!actual.length) throw new Error(`Insumo ${insumoId} no encontrado al actualizar stock.`);
  const stockAnterior = parseFloat(actual[0].stock_actual);

  const { rows: actualizado } = await client.query(INSUMOS_QUERIES.RESTAR_STOCK, [cantidad, insumoId]);
  if (!actualizado.length) return null; // stock insuficiente

  const stockNuevo = parseFloat(actualizado[0].stock_actual);

  await client.query(MOVIMIENTOS_QUERIES.REGISTRAR, [
    insumoId,
    'SALIDA',
    cantidad,
    stockAnterior,
    stockNuevo,
    referencia,
    usuarioId,
  ]);

  return { stockAnterior, stockNuevo };
}
