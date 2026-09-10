// src/routes/ventas.routes.js

import { Router } from 'express';
import {
  listarVentas, obtenerVenta,
  registrarVenta, anularVenta,
} from '../controllers/ventas.controller.js';
import { verificarToken, verificarRol, verificarPermiso } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verificarToken, verificarRol('Administrador', 'Repartidor'), verificarPermiso('GESTIONAR_VENTAS'));

router.get('/',             listarVentas);    // ?search=&estado=&desde=&hasta=
router.get('/:id',          obtenerVenta);
router.post('/',            registrarVenta);  // descuenta stock al registrar
router.patch('/:id/anular', anularVenta);    // revierte stock — body: { motivo_anulacion }

export default router;