import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import {
  login,
  logout,
  register,
  solicitarRecuperacion,
  resetPassword,
  me,
  actualizarPerfil,
} from '../controllers/auth.controller.js';

import { verificarToken } from '../middleware/auth.middleware.js';

const router = Router();

// Máximo 10 intentos por IP cada 15 minutos en endpoints sensibles
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' },
});

// ── Rutas públicas ──────────────────────────
router.post('/register',       authLimiter, register);
router.post('/login',          authLimiter, login);
router.post('/logout',         logout);
router.post('/recuperar',      authLimiter, solicitarRecuperacion);
router.post('/reset-password', authLimiter, resetPassword);

// ── Rutas protegidas ────────────────────────
router.get('/me',         verificarToken, me);
router.put('/user/:id',   verificarToken, actualizarPerfil);

export default router;
