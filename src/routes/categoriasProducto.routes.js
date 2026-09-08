// src/routes/categoriasProducto.routes.js

import { Router } from 'express';
import {
  listarCategoriasProducto, obtenerCategoriaProducto, crearCategoriaProducto,
  editarCategoriaProducto, cambiarEstadoCategoriaProducto, eliminarCategoriaProducto,
} from '../controllers/productos.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = Router();

// Ruta pública: el catálogo la necesita sin login
router.get('/', listarCategoriasProducto); // ?all=true para selects

router.use(verificarToken, verificarRol('Administrador', 'Panadero'));
router.get('/:id',          obtenerCategoriaProducto);
router.post('/',            crearCategoriaProducto);
router.put('/:id',          editarCategoriaProducto);
router.patch('/:id/estado', cambiarEstadoCategoriaProducto);
router.delete('/:id',       eliminarCategoriaProducto);

export default router;