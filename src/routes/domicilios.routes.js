// src/routes/domicilios.routes.js

import { Router } from "express";

import {
  listarDomicilios,
  obtenerDomicilio,
  crearDomicilio,
  editarDomicilio,
  cambiarEstadoDomicilio,
  cancelarDomicilio,
  obtenerMisDomicilios,
} from '../controllers/domicilios.controller.js';

import {
  verificarToken,
  verificarRol
} from "../middleware/auth.middleware.js";


const router = Router();

// CLIENTE

router.get(
  "/mis-domicilios",
  verificarToken,
  obtenerMisDomicilios
);


// ADMIN / REPARTIDOR

router.use(
  verificarToken,
  verificarRol(
    "Administrador",
    "Repartidor"
  )
);


router.get(
  "/",
  listarDomicilios
);


router.get(
  "/:id",
  obtenerDomicilio
);


router.post(
  "/",
  crearDomicilio
);


router.put(
  "/:id",
  editarDomicilio
);


router.patch(
  "/:id/estado",
  cambiarEstadoDomicilio
);


router.patch(
  "/:id/cancelar",
  cancelarDomicilio
);


export default router;