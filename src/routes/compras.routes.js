// src/routes/compras.routes.js

import { Router } from 'express';

import {
  listarCompras,
  obtenerCompra,
  crearCompra,
  anularCompra
} from '../controllers/compras.controller.js';

import {
  verificarToken,
  verificarRol,
  verificarPermiso
} from '../middleware/auth.middleware.js';

import {
  uploadCompra
} from '../middleware/upload.middleware.js';

const router = Router();

router.use(
  verificarToken,
  verificarRol(
    'Administrador',
    'Panadero'
  ),
  verificarPermiso('GESTIONAR_COMPRAS')
);

// ======================================
// LISTAR
// ======================================

router.get(
  '/',
  listarCompras
);

// ======================================
// OBTENER DETALLE
// ======================================

router.get(
  '/:id',
  obtenerCompra
);

// ======================================
// CREAR
// ======================================

router.post(
  '/',
  uploadCompra.single('foto_comprobante'),
  crearCompra
);

// ======================================
// ANULAR
// ======================================

router.patch(
  '/:id/anular',
  anularCompra
);

export default router;