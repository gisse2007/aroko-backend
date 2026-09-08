// src/routes/usuarios.routes.js

import { Router } from 'express';
import {
  listarUsuarios, obtenerUsuario, crearUsuario,
  editarUsuario, cambiarEstadoUsuario, eliminarUsuario,
} from '../controllers/usuarios.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = Router();

// Solo el Administrador gestiona usuarios
router.use(verificarToken, verificarRol('Administrador'));

router.get('/',              listarUsuarios);
router.get('/:id',           obtenerUsuario);
router.post('/',             crearUsuario);
router.put('/:id',           editarUsuario);
router.patch('/:id/estado',  cambiarEstadoUsuario);
router.delete('/:id',        eliminarUsuario);   // soft delete → pone INACTIVO

export default router;