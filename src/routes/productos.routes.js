import { Router } from 'express';

import {
  listarProductos,
  obtenerProducto,
  crearProducto,
  editarProducto,
  cambiarEstadoProducto,
  eliminarProducto,
  productosStockBajo,
  productosParaSelect,
  buscarProductos,
} from '../controllers/productos.controller.js';

import {
  verificarToken,
  verificarRol
} from '../middleware/auth.middleware.js';

import { validateSearchParams } from '../middleware/searchParams.middleware.js';

import {
  uploadProducto,
  uploadProductoMultiple,
  handleMulterError
} from '../middleware/upload.middleware.js';

const router = Router();

// ── Rutas públicas (catálogo sin login) ──────────────────────────────────────
router.get('/search', validateSearchParams, buscarProductos);

// ── Rutas protegidas ─────────────────────────────────────────────────────────
router.use(verificarToken, verificarRol('Administrador', 'Panadero'));

router.get('/stock-bajo',  productosStockBajo);
router.get('/select',      productosParaSelect);
router.get('/',            listarProductos);
router.get('/:id',         obtenerProducto);

router.post(
  '/',
  uploadProductoMultiple.array('imagenes', 5),
  handleMulterError,
  crearProducto
);

router.put(
  '/:id',
  uploadProductoMultiple.array('imagenes', 5),
  handleMulterError,
  editarProducto
);

router.patch('/:id/estado', cambiarEstadoProducto);
router.delete('/:id',       eliminarProducto);

export default router;
