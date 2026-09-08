// src/routes/clientes.routes.js

import { Router } from 'express';
import {
  listarClientes, obtenerCliente, crearCliente,
  editarCliente, cambiarEstadoCliente, eliminarCliente,
  clientesParaSelect, sincronizarClientes,
  obtenerPerfilCliente, editarPerfilCliente,
} from '../controllers/pedidos.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = Router();

// ── Rutas del propio cliente (solo token, sin restricción de rol) ──
router.get('/perfil', verificarToken, obtenerPerfilCliente);
router.put('/perfil', verificarToken, editarPerfilCliente);

// ── Rutas del panel admin (requieren rol Administrador o Repartidor) ──
router.use(verificarToken, verificarRol('Administrador', 'Repartidor'));

router.get('/select',       clientesParaSelect);
router.post('/sincronizar', verificarRol('Administrador'), sincronizarClientes);

router.get('/',             listarClientes);
router.get('/:id',          obtenerCliente);
router.post('/',            crearCliente);
router.put('/:id',          editarCliente);
router.patch('/:id/estado', cambiarEstadoCliente);
router.delete('/:id',       eliminarCliente);

export default router;
