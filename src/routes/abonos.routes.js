// src/routes/abonos.routes.js

import { Router } from 'express';
import {
  listarAbonos, obtenerAbono,
  registrarAbono, anularAbono,
} from '../controllers/ventas.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verificarToken, verificarRol('Administrador', 'Repartidor'));

router.get('/',             listarAbonos);    // ?venta_id=&desde=&hasta=
router.get('/:id',          obtenerAbono);
router.post('/',            registrarAbono);  // valida máx 3 cuotas y saldo disponible
router.patch('/:id/anular', anularAbono);    // descuenta del abonado de la venta

export default router;