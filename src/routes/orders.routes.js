// src/routes/orders.routes.js

import { Router } from 'express';
import { crearOrder, misOrders, todasLasOrders, cambiarEstadoOrder } from '../controllers/orders.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';
import { uploadComprobante, handleMulterError } from '../middleware/upload.middleware.js';

// ── Router cliente: montado en /api/orders ──
export const ordersRouter = Router();

ordersRouter.post(
  '/',
  verificarToken,
  uploadComprobante.single('paymentProof'),
  handleMulterError,
  crearOrder
);

ordersRouter.get('/my-orders', verificarToken, misOrders);

// ── Router admin: montado en /api/admin ──
export const adminOrdersRouter = Router();

adminOrdersRouter.get('/orders',            verificarToken, verificarRol('Administrador'), todasLasOrders);
adminOrdersRouter.patch('/orders/:id/status', verificarToken, verificarRol('Administrador'), cambiarEstadoOrder);
