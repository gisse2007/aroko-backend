// src/routes/orders.routes.js

import { Router } from 'express';
import { crearOrder, misOrders, todasLasOrders, cambiarEstadoOrder } from '../controllers/orders.controller.js';
import { verificarToken, verificarRol, verificarPermiso } from '../middleware/auth.middleware.js';
import { uploadComprobante, handleMulterError } from '../middleware/upload.middleware.js';

// ── Router cliente: montado en /api/orders ──
export const ordersRouter = Router();

ordersRouter.post(
  '/',
  verificarToken,
  verificarRol('Cliente'),
  uploadComprobante.single('paymentProof'),
  handleMulterError,
  crearOrder
);

ordersRouter.get('/my-orders', verificarToken, verificarRol('Cliente'), misOrders);

// ── Router admin: montado en /api/admin ──
export const adminOrdersRouter = Router();

adminOrdersRouter.get('/orders',            verificarToken, verificarRol('Administrador'), verificarPermiso('GESTIONAR_VENTAS'), todasLasOrders);
adminOrdersRouter.patch('/orders/:id/status', verificarToken, verificarRol('Administrador'), verificarPermiso('GESTIONAR_VENTAS'), cambiarEstadoOrder);
