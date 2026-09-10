// src/routes/permisos.routes.js

import { Router } from 'express';
import {
  listarPermisos, obtenerPermiso, crearPermiso,
  editarPermiso, cambiarEstadoPermiso, eliminarPermiso,
} from '../controllers/roles.controller.js';
import { verificarToken, verificarRol, verificarPermiso } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verificarToken, verificarRol('Administrador'), verificarPermiso('GESTIONAR_USUARIOS'));

router.get('/',          listarPermisos);
router.get('/:id',       obtenerPermiso);
router.post('/',         crearPermiso);
router.put('/:id',       editarPermiso);
router.patch('/:id/estado', cambiarEstadoPermiso);
router.delete('/:id',    eliminarPermiso);

export default router;