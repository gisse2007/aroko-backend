// src/routes/dashboard.routes.js

import { Router } from 'express';
import {
  getDashboard,
  getResumen,
  getStockAlertas,
} from '../controllers/dashboard.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = Router();

// Solo requiere estar autenticado (cualquier rol ve el dashboard)
router.use(verificarToken);

router.get('/',              getDashboard);     // todo en una sola llamada
router.get('/resumen',       getResumen);       // contadores rápidos
router.get('/stock-alertas', getStockAlertas);  // alertas productos + insumos

export default router;