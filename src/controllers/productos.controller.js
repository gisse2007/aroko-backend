// src/controllers/productos.controller.js

import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';

import {
  CAT_PRODUCTO_QUERIES,
  PRODUCTOS_QUERIES
} from '../queries/productos.queries.js';

import { buscarProductosPaginados, buildImageArray, buildImageUrl, normalizarImagenes } from '../services/productos.service.js';

// ══════════════════════════════════════════════
//  CATEGORÍAS DE PRODUCTO
// ══════════════════════════════════════════════

// GET /api/categorias-productos?all=true
export const listarCategoriasProducto = async (req, res) => {

  const { all } = req.query;

  try {

    const { rows } = all === 'true'
      ? await pool.query(CAT_PRODUCTO_QUERIES.LIST_ALL)
      : await pool.query(CAT_PRODUCTO_QUERIES.LIST);

    return res.status(200).json({
      ok: true,
      data: rows
    });

  } catch (error) {

    console.error(
      'Error al listar categorías:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      message: 'Error al listar categorías.'
    });
  }
};

// GET /api/categorias-productos/:id
export const obtenerCategoriaProducto = async (req, res) => {

  const { id } = req.params;

  try {

    const { rows } = await pool.query(
      CAT_PRODUCTO_QUERIES.FIND_BY_ID,
      [id]
    );

    if (rows.length === 0) {

      return res.status(404).json({
        ok: false,
        message: 'Categoría no encontrada.'
      });
    }

    return res.status(200).json({
      ok: true,
      data: rows[0]
    });

  } catch (error) {

    console.error(
      'Error al obtener categoría:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      message: 'Error al cargar categoría.'
    });
  }
};

// POST /api/categorias-productos
export const crearCategoriaProducto = async (req, res) => {

  const { nombre } = req.body;

  if (!nombre) {

    return res.status(400).json({
      ok: false,
      message: 'El nombre es obligatorio.'
    });
  }

  try {

    const { rows: dup } = await pool.query(
      CAT_PRODUCTO_QUERIES.NOMBRE_EXISTS,
      [nombre.trim(), 0]
    );

    if (dup.length > 0) {

      return res.status(409).json({
        ok: false,
        message: 'La categoría ya existe.'
      });
    }

    const { rows } = await pool.query(
      CAT_PRODUCTO_QUERIES.CREATE,
      [nombre.trim()]
    );

    return res.status(201).json({
      ok: true,
      message: 'Categoría creada correctamente.',
      data: rows[0]
    });

  } catch (error) {

    console.error(
      'Error al crear categoría:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      message: 'Error al crear categoría.'
    });
  }
};

// PUT /api/categorias-productos/:id
export const editarCategoriaProducto = async (req, res) => {

  const { id } = req.params;

  const { nombre } = req.body;

  if (!nombre) {

    return res.status(400).json({
      ok: false,
      message: 'El nombre es obligatorio.'
    });
  }

  try {

    const { rows: dup } = await pool.query(
      CAT_PRODUCTO_QUERIES.NOMBRE_EXISTS,
      [nombre.trim(), id]
    );

    if (dup.length > 0) {

      return res.status(409).json({
        ok: false,
        message: 'Ya existe otra categoría con ese nombre.'
      });
    }

    const { rows } = await pool.query(
      CAT_PRODUCTO_QUERIES.UPDATE,
      [
        nombre.trim(),
        id
      ]
    );

    if (rows.length === 0) {

      return res.status(404).json({
        ok: false,
        message: 'Categoría no encontrada.'
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Categoría actualizada correctamente.',
      data: rows[0]
    });

  } catch (error) {

    console.error(
      'Error al editar categoría:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar categoría.'
    });
  }
};

// PATCH /api/categorias-productos/:id/estado
export const cambiarEstadoCategoriaProducto = async (req, res) => {

  const { id } = req.params;

  try {

    const { rows } = await pool.query(
      CAT_PRODUCTO_QUERIES.TOGGLE_ESTADO,
      [id]
    );

    if (rows.length === 0) {

      return res.status(404).json({
        ok: false,
        message: 'Categoría no encontrada.'
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Estado actualizado correctamente.',
      data: rows[0]
    });

  } catch (error) {

    console.error(
      'Error al cambiar estado categoría:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      message: 'Error al cambiar estado.'
    });
  }
};

// DELETE /api/categorias-productos/:id
export const eliminarCategoriaProducto = async (req, res) => {

  const { id } = req.params;

  try {

    const { rows: check } = await pool.query(
      CAT_PRODUCTO_QUERIES.HAS_PRODUCTOS,
      [id]
    );

    if (parseInt(check[0].total) > 0) {

      return res.status(409).json({
        ok: false,
        message: 'No se puede eliminar: tiene productos asociados.'
      });
    }

    const { rows } = await pool.query(
      CAT_PRODUCTO_QUERIES.DELETE,
      [id]
    );

    if (rows.length === 0) {

      return res.status(404).json({
        ok: false,
        message: 'Categoría no encontrada.'
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Categoría eliminada correctamente.',
      data: rows[0]
    });

  } catch (error) {

    console.error(
      'Error al eliminar categoría:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      message: 'Error al eliminar categoría.'
    });
  }
};

// ══════════════════════════════════════════════
//  PRODUCTOS
// ══════════════════════════════════════════════

// GET /api/productos
export const listarProductos = async (req, res) => {

  const {
    search,
    categoria_id,
    stock_bajo
  } = req.query;

  try {

    let { rows } = search
      ? await pool.query(
          PRODUCTOS_QUERIES.SEARCH,
          [`%${search.trim()}%`]
        )
      : await pool.query(
          PRODUCTOS_QUERIES.LIST
        );

    if (categoria_id) {
      rows = rows.filter((p) => p.categoria_id === parseInt(categoria_id));
    }

    if (stock_bajo === 'true') {
      rows = rows.filter((p) => p.stock_bajo);
    }

    return res.status(200).json({
      ok: true,
      data: normalizarImagenes(rows),
    });

  } catch (error) {
    console.error('Error al listar productos:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar productos.' });
  }
};

// GET /api/productos/stock-bajo
export const productosStockBajo = async (_req, res) => {

  try {

    const { rows } = await pool.query(
      PRODUCTOS_QUERIES.STOCK_BAJO
    );

    return res.status(200).json({
      ok: true,
      total: rows.length,
      data: rows
    });

  } catch (error) {

    console.error(
      'Error stock bajo:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      message: 'Error al obtener alertas.'
    });
  }
};

// GET /api/productos/select
export const productosParaSelect = async (_req, res) => {

  try {

    const { rows } = await pool.query(
      PRODUCTOS_QUERIES.LIST_ACTIVOS_SELECT
    );

    return res.status(200).json({
      ok: true,
      data: rows
    });

  } catch (error) {

    console.error(
      'Error select productos:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      message: 'Error al obtener productos.'
    });
  }
};

// GET /api/productos/:id
export const obtenerProducto = async (req, res) => {

  const { id } = req.params;

  try {

    const { rows } = await pool.query(PRODUCTOS_QUERIES.FIND_BY_ID, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Producto no encontrado.' });
    }

    return res.status(200).json({
      ok: true,
      data: { ...rows[0], imagen: buildImageUrl(rows[0].imagen) },
    });

  } catch (error) {
    console.error('Error al obtener producto:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar producto.' });
  }
};

// POST /api/productos
export const crearProducto = async (req, res) => {
  const {
    nombre,
    categoria_id,
    precio,
    stock_producto = 0,
    receta = [],
    es_nuevo = false,
    es_temporada = false,
  } = req.body;

  const categoriaId = Number(categoria_id);
  const precioVal   = Number(precio);
  const stockVal    = Number(stock_producto ?? 0);
  const esNuevo     = (es_nuevo === true || es_nuevo === 'true' || es_nuevo === '1' || es_nuevo === 1);
  const esTemporada = (es_temporada === true || es_temporada === 'true' || es_temporada === '1' || es_temporada === 1);

  if (!nombre || !categoria_id || precio === undefined ||
      Number.isNaN(precioVal) || Number.isNaN(categoriaId) || Number.isNaN(stockVal)) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos o inválidos.' });
  }

  if (precioVal < 0) {
    return res.status(400).json({ ok: false, message: 'El precio no puede ser negativo.' });
  }
  if (stockVal < 0) {
    return res.status(400).json({ ok: false, message: 'El stock no puede ser negativo.' });
  }

  let recetaArr = receta;
  if (typeof receta === 'string') {
    try { recetaArr = JSON.parse(receta); }
    catch { return res.status(400).json({ ok: false, message: 'Formato de receta inválido.' }); }
  }
  if (!Array.isArray(recetaArr)) recetaArr = [];

  const archivos = req.files?.length ? req.files : (req.file ? [req.file] : []);
  const imagen = archivos.length
    ? archivos.map((f) => `/uploads/productos/${f.filename}`).join('|')
    : null;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: dup } = await client.query(
      PRODUCTOS_QUERIES.NOMBRE_EXISTS,
      [nombre.trim(), 0]
    );

    if (dup.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        ok: false,
        message: 'El producto ya existe.'
      });
    }

    const resultado = await client.query(
      PRODUCTOS_QUERIES.CREATE,
      [
        nombre.trim(),
        categoriaId,
        precioVal,
        stockVal,
        imagen,
        esNuevo,
        esTemporada
      ]
    );

    if (!resultado.rows || resultado.rows.length === 0) {
      await client.query('ROLLBACK');
      console.error('❌ INSERT no retornó filas');
      return res.status(500).json({
        ok: false,
        message: 'Error al crear producto: INSERT vacío.'
      });
    }

    const productoId = resultado.rows[0].id_producto;

    if (!productoId) {
      await client.query('ROLLBACK');
      return res.status(500).json({ ok: false, message: 'Error al crear producto: ID vacío.' });
    }

    for (const item of recetaArr) {
      if (
        !item.insumo_id ||
        item.cantidad_requerida === undefined ||
        Number.isNaN(Number(item.cantidad_requerida))
      ) continue;

      await client.query(
        PRODUCTOS_QUERIES.INSERT_RECETA_ITEM,
        [
          productoId,
          Number(item.insumo_id),
          Number(item.cantidad_requerida)
        ]
      );
    }

    await client.query('COMMIT');

    const { rows: completo } = await pool.query(
      PRODUCTOS_QUERIES.FIND_BY_ID,
      [productoId]
    );

    console.log('✔ Producto creado');

    const imgs = buildImageArray(completo[0]?.imagen);
    return res.status(201).json({
      ok: true,
      message: 'Producto creado correctamente.',
      data: { ...(completo[0] || {}), imagen: imgs[0] || null, imagenes: imgs },
    });

  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* ignorar */ }
    console.error('Error al crear producto:', error.message);
    return res.status(500).json({ ok: false, message: error.message || 'Error al crear producto.', code: error.code });
  } finally {
    client.release();
  }
};

// PUT /api/productos/:id
export const editarProducto = async (req, res) => {

  const { id } = req.params;

  const {
    nombre,
    categoria_id,
    precio,
    stock_producto,
    receta = [],
    es_nuevo = false,
    es_temporada = false,
  } = req.body;

  const esNuevo     = (es_nuevo === true || es_nuevo === 'true' || es_nuevo === '1' || es_nuevo === 1);
  const esTemporada = (es_temporada === true || es_temporada === 'true' || es_temporada === '1' || es_temporada === 1);

  if (!nombre || !categoria_id || precio === undefined) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  if (parseFloat(precio) < 0) {
    return res.status(400).json({ ok: false, message: 'El precio no puede ser negativo.' });
  }
  if (parseFloat(stock_producto ?? 0) < 0) {
    return res.status(400).json({ ok: false, message: 'El stock no puede ser negativo.' });
  }

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const actual = await client.query(
      PRODUCTOS_QUERIES.FIND_BY_ID,
      [id]
    );

    if (actual.rows.length === 0) {

      await client.query('ROLLBACK');

      return res.status(404).json({
        ok: false,
        message: 'Producto no encontrado.'
      });
    }

    let imagen = actual.rows[0].imagen;

    const archivos = req.files?.length ? req.files : (req.file ? [req.file] : []);
    if (archivos.length) {
      // Eliminar archivos viejos del disco
      if (imagen) {
        imagen.split('|').forEach((ruta) => {
          const rutaVieja = path.join(process.cwd(), ruta.replace(/^\/+/, ''));
          if (fs.existsSync(rutaVieja)) fs.unlinkSync(rutaVieja);
        });
      }
      imagen = archivos.map((f) => `/uploads/productos/${f.filename}`).join('|');
    }

    const { rows: dup } = await client.query(
      PRODUCTOS_QUERIES.NOMBRE_EXISTS,
      [nombre.trim(), id]
    );

    if (dup.length > 0) {

      await client.query('ROLLBACK');

      return res.status(409).json({
        ok: false,
        message: 'Ya existe otro producto con ese nombre.'
      });
    }

    const { rows } = await client.query(
      PRODUCTOS_QUERIES.UPDATE,
      [
        nombre.trim(),
        categoria_id,
        parseFloat(precio),
        parseFloat(stock_producto ?? 0),
        imagen,
        esNuevo,
        esTemporada,
        id
      ]
    );

    await client.query(
      PRODUCTOS_QUERIES.DELETE_RECETA,
      [id]
    );

    const recetaArr =
      typeof receta === 'string'
        ? JSON.parse(receta)
        : receta;

    for (const item of recetaArr) {

      if (
        !item.insumo_id ||
        !item.cantidad_requerida
      ) continue;

      await client.query(
        PRODUCTOS_QUERIES.INSERT_RECETA_ITEM,
        [
          id,
          item.insumo_id,
          parseFloat(item.cantidad_requerida)
        ]
      );
    }

    await client.query('COMMIT');

    const { rows: completo } = await pool.query(
      PRODUCTOS_QUERIES.FIND_BY_ID,
      [id]
    );

    const imgs2 = buildImageArray(completo[0]?.imagen);
    return res.status(200).json({
      ok: true,
      message: 'Producto actualizado correctamente.',
      data: { ...completo[0], imagen: imgs2[0] || null, imagenes: imgs2 },
    });

  } catch (error) {

    await client.query('ROLLBACK');

    console.error(
      'Error al editar producto:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar producto.'
    });

  } finally {

    client.release();
  }
};

// PATCH /api/productos/:id/estado
export const cambiarEstadoProducto = async (req, res) => {

  const { id } = req.params;

  try {

    const { rows } = await pool.query(
      PRODUCTOS_QUERIES.TOGGLE_ESTADO,
      [id]
    );

    if (rows.length === 0) {

      return res.status(404).json({
        ok: false,
        message: 'Producto no encontrado.'
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Estado actualizado correctamente.',
      data: rows[0]
    });

  } catch (error) {

    console.error(
      'Error al cambiar estado:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      message: 'Error al cambiar estado.'
    });
  }
};

// GET /api/productos/search
export const buscarProductos = async (req, res) => {
  try {
    const { products, pagination } = await buscarProductosPaginados(req.searchParams);

    return res.status(200).json({
      success: true,
      products,
      pagination,
    });
  } catch (error) {
    console.error('Error en búsqueda paginada:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al buscar productos.',
    });
  }
};

// DELETE /api/productos/:id
export const eliminarProducto = async (req, res) => {

  const { id } = req.params;

  try {

    const { rows } = await pool.query(
      PRODUCTOS_QUERIES.SOFT_DELETE,
      [id]
    );

    if (rows.length === 0) {

      return res.status(404).json({
        ok: false,
        message: 'Producto no encontrado.'
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Producto eliminado correctamente.',
      data: rows[0]
    });

  } catch (error) {

    console.error(
      'Error al eliminar producto:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      message: 'Error al eliminar producto.'
    });
  }
};

// GET /api/productos/nuevo
export const listarProductosNuevo = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? '6', 10), 20);
  try {
    const { rows } = await pool.query(PRODUCTOS_QUERIES.LIST_NUEVO, [limit]);
    return res.status(200).json({
      success: true,
      products: normalizarImagenes(rows),
    });
  } catch (error) {
    console.error('Error al obtener productos nuevos:', error.message);
    return res.status(500).json({ success: false, message: 'Error al obtener productos nuevos.' });
  }
};

// GET /api/productos/temporada
export const listarProductosTemporada = async (_req, res) => {
  try {
    const { rows } = await pool.query(PRODUCTOS_QUERIES.LIST_TEMPORADA);
    return res.status(200).json({
      success: true,
      products: normalizarImagenes(rows),
    });
  } catch (error) {
    console.error('Error al obtener productos de temporada:', error.message);
    return res.status(500).json({ success: false, message: 'Error al obtener productos de temporada.' });
  }
};

