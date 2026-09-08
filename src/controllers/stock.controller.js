// src/controllers/inventario.controller.js

import pool from '../config/db.js';
import {
  PROVEEDORES_QUERIES,
  CAT_INSUMO_QUERIES,
  INSUMOS_QUERIES,
} from '../queries/stock.queries.js';

// ══════════════════════════════════════════════
//  PROVEEDORES
// ══════════════════════════════════════════════

// GET /api/proveedores?search=&estado=
export const listarProveedores = async (req, res) => {
  const { search } = req.query;
  try {
    const { rows } = search
      ? await pool.query(PROVEEDORES_QUERIES.SEARCH, [`%${search.trim()}%`])
      : await pool.query(PROVEEDORES_QUERIES.LIST);

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay proveedores registrados.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar proveedores:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar proveedores.' });
  }
};

// GET /api/proveedores/:id
export const obtenerProveedor = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(PROVEEDORES_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Proveedor no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al obtener proveedor:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar el proveedor.' });
  }
};

// POST /api/proveedores
// Body: { empleado_id, nombre_proveedor, direccion, telefono, email }
export const crearProveedor = async (req, res) => {
  const { empleado_id, nombre_proveedor, direccion, telefono, email } = req.body;

  if (!empleado_id || !nombre_proveedor) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  try {
    const { rows: dup } = await pool.query(PROVEEDORES_QUERIES.NOMBRE_EXISTS, [nombre_proveedor.trim(), 0]);
    if (dup.length > 0) {
      return res.status(409).json({ ok: false, message: 'El proveedor ya se encuentra registrado.' });
    }

    const { rows } = await pool.query(PROVEEDORES_QUERIES.CREATE, [
      empleado_id,
      nombre_proveedor.trim(),
      (direccion  || '').trim(),
      (telefono   || '').trim(),
      (email      || '').trim().toLowerCase(),
    ]);

    return res.status(201).json({ ok: true, message: 'Proveedor registrado exitosamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al crear proveedor:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar el proveedor.' });
  }
};

// PUT /api/proveedores/:id
export const editarProveedor = async (req, res) => {
  const { id } = req.params;
  const { empleado_id, nombre_proveedor, direccion, telefono, email } = req.body;

  if (!empleado_id || !nombre_proveedor) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  try {
    const { rows: dup } = await pool.query(PROVEEDORES_QUERIES.NOMBRE_EXISTS, [nombre_proveedor.trim(), id]);
    if (dup.length > 0) {
      return res.status(409).json({ ok: false, message: 'Ya existe otro proveedor con ese nombre.' });
    }

    const { rows } = await pool.query(PROVEEDORES_QUERIES.UPDATE, [
      empleado_id,
      nombre_proveedor.trim(),
      (direccion || '').trim(),
      (telefono  || '').trim(),
      (email     || '').trim().toLowerCase(),
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Proveedor no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Proveedor actualizado correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al editar proveedor:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar el proveedor.' });
  }
};

// PATCH /api/proveedores/:id/estado
export const cambiarEstadoProveedor = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(PROVEEDORES_QUERIES.TOGGLE_ESTADO, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Proveedor no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Estado actualizado correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al cambiar estado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cambiar el estado.' });
  }
};

// DELETE /api/proveedores/:id — soft delete, bloquea si tiene compras
export const eliminarProveedor = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: check } = await pool.query(PROVEEDORES_QUERIES.HAS_COMPRAS, [id]);
    if (parseInt(check[0].total) > 0) {
      return res.status(409).json({
        ok: false,
        message: 'No se puede eliminar: el proveedor tiene compras registradas.',
      });
    }

    const { rows } = await pool.query(PROVEEDORES_QUERIES.SOFT_DELETE, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Proveedor no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Proveedor eliminado correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al eliminar proveedor:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al eliminar el proveedor.' });
  }
};

// ══════════════════════════════════════════════
//  CATEGORÍAS DE INSUMO
// ══════════════════════════════════════════════

// GET /api/categorias-insumos?all=true  (all=true trae ACTIVAS e INACTIVAS para selects)
export const listarCategoriasInsumo = async (req, res) => {
  const { all } = req.query;
  try {
    const { rows } = all === 'true'
      ? await pool.query(CAT_INSUMO_QUERIES.LIST_ALL)
      : await pool.query(CAT_INSUMO_QUERIES.LIST);

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay categorías registradas.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar categorías:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar categorías de insumos.' });
  }
};

// GET /api/categorias-insumos/:id
export const obtenerCategoriaInsumo = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(CAT_INSUMO_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Categoría no encontrada.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al obtener categoría:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar la categoría.' });
  }
};

// POST /api/categorias-insumos
// Body: { nombre }
export const crearCategoriaInsumo = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) {
    return res.status(400).json({ ok: false, message: 'El nombre de la categoría es obligatorio.' });
  }
  try {
    const { rows: dup } = await pool.query(CAT_INSUMO_QUERIES.NOMBRE_EXISTS, [nombre.trim(), 0]);
    if (dup.length > 0) {
      return res.status(409).json({ ok: false, message: 'La categoría ya se encuentra registrada.' });
    }

    const { rows } = await pool.query(CAT_INSUMO_QUERIES.CREATE, [nombre.trim()]);
    return res.status(201).json({ ok: true, message: 'Categoría registrada exitosamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al crear categoría:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar la categoría.' });
  }
};

// PUT /api/categorias-insumos/:id
export const editarCategoriaInsumo = async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre) {
    return res.status(400).json({ ok: false, message: 'El nombre de la categoría es obligatorio.' });
  }
  try {
    const { rows: dup } = await pool.query(CAT_INSUMO_QUERIES.NOMBRE_EXISTS, [nombre.trim(), id]);
    if (dup.length > 0) {
      return res.status(409).json({ ok: false, message: 'Ya existe otra categoría con ese nombre.' });
    }

    const { rows } = await pool.query(CAT_INSUMO_QUERIES.UPDATE, [nombre.trim(), id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Categoría no encontrada.' });
    }
    return res.status(200).json({ ok: true, message: 'Categoría actualizada correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al editar categoría:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar la categoría.' });
  }
};

// PATCH /api/categorias-insumos/:id/estado
export const cambiarEstadoCategoriaInsumo = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(CAT_INSUMO_QUERIES.TOGGLE_ESTADO, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Categoría no encontrada.' });
    }
    return res.status(200).json({ ok: true, message: 'Estado actualizado correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al cambiar estado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cambiar el estado.' });
  }
};

// DELETE /api/categorias-insumos/:id — bloquea si tiene insumos activos
export const eliminarCategoriaInsumo = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: check } = await pool.query(CAT_INSUMO_QUERIES.HAS_INSUMOS, [id]);
    if (parseInt(check[0].total) > 0) {
      return res.status(409).json({
        ok: false,
        message: 'No se puede eliminar: la categoría tiene insumos activos asociados.',
      });
    }

    const { rows } = await pool.query(CAT_INSUMO_QUERIES.DELETE, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Categoría no encontrada.' });
    }
    return res.status(200).json({ ok: true, message: 'Categoría eliminada correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al eliminar categoría:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al eliminar la categoría.' });
  }
};

// ══════════════════════════════════════════════
//  INSUMOS
// ══════════════════════════════════════════════

// GET /api/insumos?search=&unidad=&stock_bajo=true
export const listarInsumos = async (req, res) => {
  const { search, unidad, stock_bajo } = req.query;
  try {
    let rows;
    if (search) {
      ({ rows } = await pool.query(INSUMOS_QUERIES.SEARCH, [`%${search.trim()}%`]));
    } else if (unidad) {
      ({ rows } = await pool.query(INSUMOS_QUERIES.FILTER_UNIDAD, [unidad]));
    } else if (stock_bajo === 'true') {
      ({ rows } = await pool.query(INSUMOS_QUERIES.STOCK_BAJO));
    } else {
      ({ rows } = await pool.query(INSUMOS_QUERIES.LIST));
    }

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay insumos registrados.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar insumos:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar insumos.' });
  }
};

// GET /api/insumos/stock-bajo — para alertas del dashboard
export const insumosStockBajo = async (req, res) => {
  try {
    const { rows } = await pool.query(INSUMOS_QUERIES.STOCK_BAJO);
    return res.status(200).json({ ok: true, total: rows.length, data: rows });
  } catch (error) {
    console.error('Error al obtener stock bajo:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al obtener alertas de stock.' });
  }
};

// GET /api/insumos/:id
export const obtenerInsumo = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(INSUMOS_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Insumo no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al obtener insumo:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar el insumo.' });
  }
};

// POST /api/insumos
// Body: { nombre_insumo, categoria_id, unidad_medida, stock_actual, stock_minimo, precio_unitario }
export const crearInsumo = async (req, res) => {
  const { nombre_insumo, categoria_id, unidad_medida, stock_actual, stock_minimo, precio_unitario } = req.body;

  if (!nombre_insumo || !categoria_id || !unidad_medida) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  try {
    const { rows: dup } = await pool.query(INSUMOS_QUERIES.NOMBRE_EXISTS, [nombre_insumo.trim(), 0]);
    if (dup.length > 0) {
      return res.status(409).json({ ok: false, message: 'El insumo ya se encuentra registrado.' });
    }

    const { rows } = await pool.query(INSUMOS_QUERIES.CREATE, [
      nombre_insumo.trim(),
      categoria_id,
      unidad_medida.trim(),
      parseFloat(stock_actual)    || 0,
      parseFloat(stock_minimo)    || 0,
      parseFloat(precio_unitario) || 0,
    ]);

    return res.status(201).json({ ok: true, message: 'Insumo registrado exitosamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al crear insumo:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar el insumo.' });
  }
};

// PUT /api/insumos/:id
export const editarInsumo = async (req, res) => {
  const { id } = req.params;
  const { nombre_insumo, categoria_id, unidad_medida, stock_actual, stock_minimo, precio_unitario } = req.body;

  if (!nombre_insumo || !categoria_id || !unidad_medida) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  try {
    const { rows: dup } = await pool.query(INSUMOS_QUERIES.NOMBRE_EXISTS, [nombre_insumo.trim(), id]);
    if (dup.length > 0) {
      return res.status(409).json({ ok: false, message: 'Ya existe otro insumo con ese nombre.' });
    }

    const { rows } = await pool.query(INSUMOS_QUERIES.UPDATE, [
      nombre_insumo.trim(),
      categoria_id,
      unidad_medida.trim(),
      parseFloat(stock_actual)    || 0,
      parseFloat(stock_minimo)    || 0,
      parseFloat(precio_unitario) || 0,
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Insumo no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Insumo actualizado correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al editar insumo:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar el insumo.' });
  }
};

// PATCH /api/insumos/:id/estado — bloquea desactivar si stock_actual > 0
export const cambiarEstadoInsumo = async (req, res) => {
  const { id } = req.params;
  try {
    // Regla del frontend: no desactivar si tiene stock
    const { rows: check } = await pool.query(INSUMOS_QUERIES.CHECK_STOCK, [id]);
    if (check.length === 0) {
      return res.status(404).json({ ok: false, message: 'Insumo no encontrado.' });
    }

    if (parseFloat(check[0].stock_actual) > 0) {
      return res.status(409).json({
        ok: false,
        message: 'No se puede desactivar: el insumo aún tiene stock disponible.',
      });
    }

    const { rows } = await pool.query(INSUMOS_QUERIES.TOGGLE_ESTADO, [id]);
    return res.status(200).json({ ok: true, message: 'Estado actualizado correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al cambiar estado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cambiar el estado del insumo.' });
  }
};

// DELETE /api/insumos/:id — hard delete, bloquea si tiene compras o stock
export const eliminarInsumo = async (req, res) => {
  const { id } = req.params;
  try {
    // Regla: no eliminar si tiene compras
    const { rows: checkCompras } = await pool.query(INSUMOS_QUERIES.HAS_COMPRAS, [id]);
    if (parseInt(checkCompras[0].total) > 0) {
      return res.status(409).json({
        ok: false,
        message: 'No se puede eliminar: el insumo tiene compras registradas.',
      });
    }

    // Regla: no eliminar si tiene stock
    const { rows: checkStock } = await pool.query(INSUMOS_QUERIES.CHECK_STOCK, [id]);
    if (checkStock.length === 0) {
      return res.status(404).json({ ok: false, message: 'Insumo no encontrado.' });
    }
    if (parseFloat(checkStock[0].stock_actual) > 0) {
      return res.status(409).json({
        ok: false,
        message: 'No se puede eliminar: el insumo aún tiene stock disponible.',
      });
    }

    const { rows } = await pool.query(INSUMOS_QUERIES.HARD_DELETE, [id]);
    return res.status(200).json({ ok: true, message: 'Insumo eliminado correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al eliminar insumo:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al eliminar el insumo.' });
  }
};