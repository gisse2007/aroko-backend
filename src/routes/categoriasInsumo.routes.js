// src/routes/categoriasInsumo.routes.js

import { Router } from 'express';
import {
  listarCategoriasInsumo, obtenerCategoriaInsumo, crearCategoriaInsumo,
  editarCategoriaInsumo, cambiarEstadoCategoriaInsumo, eliminarCategoriaInsumo,
} from '../controllers/stock.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verificarToken, verificarRol('Administrador', 'Panadero'));

router.get('/',             listarCategoriasInsumo);   // ?all=true para selects
router.get('/:id',          obtenerCategoriaInsumo);
router.post('/',            crearCategoriaInsumo);
router.put('/:id',          editarCategoriaInsumo);
router.patch('/:id/estado', cambiarEstadoCategoriaInsumo);
router.delete('/:id',       eliminarCategoriaInsumo);

export default router;