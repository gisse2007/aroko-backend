// src/routes/notificaciones.routes.js
import { Router } from 'express';
import {
  listarMisNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
} from '../controllers/notificaciones.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = Router();

// Cualquier usuario autenticado (cliente, empleado o administrador) ve
// únicamente sus propias notificaciones.
router.use(verificarToken);

router.get('/mias',                   listarMisNotificaciones);
router.patch('/marcar-todas-leidas',  marcarTodasLeidas);
router.patch('/:id/leida',            marcarLeida);

export default router;
