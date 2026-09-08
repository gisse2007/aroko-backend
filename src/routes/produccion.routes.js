// src/routes/produccion.routes.js

import { Router } from 'express';
import {
  listarProduccion, obtenerProduccion,
  registrarProduccion, anularProduccion,
} from '../controllers/produccion.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verificarToken, verificarRol('Administrador', 'Panadero'));

router.get('/',               listarProduccion);   // ?estado=&empleado=&desde=&hasta=
router.get('/:id',            obtenerProduccion);
router.post('/',              registrarProduccion); // valida stock, descuenta insumos, suma producto
router.patch('/:id/anular',   anularProduccion);   // body: { motivo_anulacion }

export default router;