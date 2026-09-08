// src/routes/empleados.routes.js

import { Router } from 'express';
import {
  listarEmpleados, obtenerEmpleado, crearEmpleado,
  editarEmpleado, cambiarEstadoEmpleado, eliminarEmpleado,
  usuariosDisponibles,
} from '../controllers/usuarios.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verificarToken, verificarRol('Administrador'));

// Ruta especial ANTES del /:id para que no lo confunda con un id
router.get('/usuarios-disponibles', usuariosDisponibles);

router.get('/',             listarEmpleados);
router.get('/:id',          obtenerEmpleado);
router.post('/',            crearEmpleado);
router.put('/:id',          editarEmpleado);
router.patch('/:id/estado', cambiarEstadoEmpleado);
router.delete('/:id',       eliminarEmpleado);   // soft delete → pone INACTIVO

export default router;