// src/routes/proveedores.routes.js

import { Router } from 'express';
import {
  listarProveedores, obtenerProveedor, crearProveedor,
  editarProveedor, cambiarEstadoProveedor, eliminarProveedor,
} from '../controllers/stock.controller.js';
import { verificarToken, verificarRol, verificarPermiso } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verificarToken, verificarRol('Administrador', 'Panadero'), verificarPermiso('GESTIONAR_COMPRAS'));

router.get('/',             listarProveedores);
router.get('/:id',          obtenerProveedor);
router.post('/',            crearProveedor);
router.put('/:id',          editarProveedor);
router.patch('/:id/estado', cambiarEstadoProveedor);
router.delete('/:id',       eliminarProveedor);

export default router;