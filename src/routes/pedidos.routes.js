// src/routes/pedidos.routes.js

import { Router } from 'express';
import {
  listarPedidos, listarPedidosAceptados, obtenerPedido, crearPedido,
  editarPedido, cambiarEstadoPedido, cancelarPedido,
} from '../controllers/pedidos.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verificarToken, verificarRol('Administrador', 'Repartidor'));

router.get('/',                   listarPedidos);          // ?search=&estado=&desde=&hasta= (sin params → solo ACTIVO)
router.get('/aceptados',          listarPedidosAceptados); // para dropdown de Ventas
router.get('/:id',                obtenerPedido);
router.post('/',                  crearPedido);
router.put('/:id',                editarPedido);
router.patch('/:id/estado',       cambiarEstadoPedido);
router.patch('/:id/cancelar',     cancelarPedido);

export default router;