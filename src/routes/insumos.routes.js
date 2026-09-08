// src/routes/insumos.routes.js

import { Router } from 'express';
import {
  listarInsumos, obtenerInsumo, crearInsumo,
  editarInsumo, cambiarEstadoInsumo, eliminarInsumo,
  insumosStockBajo,
} from '../controllers/stock.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verificarToken, verificarRol('Administrador', 'Panadero'));

// Ruta especial ANTES de /:id
router.get('/stock-bajo',   insumosStockBajo);

router.get('/',             listarInsumos);    // ?search=&unidad=&stock_bajo=true
router.get('/:id',          obtenerInsumo);
router.post('/',            crearInsumo);
router.put('/:id',          editarInsumo);
router.patch('/:id/estado', cambiarEstadoInsumo);
router.delete('/:id',       eliminarInsumo);

export default router;