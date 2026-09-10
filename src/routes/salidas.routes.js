// src/routes/salidas.routes.js

import { Router } from 'express';
import {
  listarSalidas, obtenerSalida,
  crearSalida, anularSalida,
} from '../controllers/produccion.controller.js';
import { verificarToken, verificarRol, verificarPermiso } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verificarToken, verificarRol('Administrador', 'Panadero'), verificarPermiso('GESTIONAR_COMPRAS'));

router.get('/',             listarSalidas);   // ?search=&desde=&hasta=
router.get('/:id',          obtenerSalida);
router.post('/',            crearSalida);     // valida stock y descuenta al crear
router.patch('/:id/anular', anularSalida);   // restaura stock (equivale al remove del frontend)

export default router;