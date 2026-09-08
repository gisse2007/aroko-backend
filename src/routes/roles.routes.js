// src/routes/roles.routes.js

import { Router } from 'express';
import {
  listarRoles, obtenerRol, crearRol, editarRol,
  cambiarEstadoRol, eliminarRol,
  listarPermisosRol, permisosDisponibles, agregarPermiso, quitarPermiso,
} from '../controllers/roles.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = Router();

// Todas las rutas de roles requieren estar autenticado y ser Administrador
router.use(verificarToken, verificarRol('Administrador'));

// ── Permisos de un rol ───────────────────────
router.get('/:id/permisos',              listarPermisosRol);
router.get('/:id/permisos/disponibles',  permisosDisponibles);
router.post('/:id/permisos',             agregarPermiso);
router.delete('/:id/permisos/:permisoId',quitarPermiso);

// ── CRUD Roles ───────────────────────────────
router.get('/',                          listarRoles);
router.get('/:id',                       obtenerRol);
router.post('/',                         crearRol);
router.put('/:id',                       editarRol);
router.patch('/:id/estado',              cambiarEstadoRol);
router.delete('/:id',                    eliminarRol);

export default router;