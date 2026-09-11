// src/middleware/upload.middleware.js

import multer from 'multer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ======================================
// CREAR CARPETAS SI NO EXISTEN
// ======================================

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const crearCarpeta = (ruta) => {

  if (!fs.existsSync(ruta)) {

    fs.mkdirSync(ruta, {
      recursive: true
    });
  }
};

crearCarpeta(path.join(UPLOADS_DIR, 'productos'));
crearCarpeta(path.join(UPLOADS_DIR, 'compras'));
crearCarpeta(path.join(UPLOADS_DIR, 'comprobantes'));
crearCarpeta(path.join(UPLOADS_DIR, 'comprobantes-pago'));

// ======================================
// CONFIG PRODUCTOS
// ======================================

const storageProductos = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'aroko/productos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    resource_type: 'image',
    public_id: (_req, file) => {
      const base = path.basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9_-]/g, '-');
      return `${Date.now()}-${base}`;
    },
  },
});

// ======================================
// CONFIG COMPRAS
// ======================================

const storageCompras = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'aroko/compras',
    resource_type: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    public_id: (_req, file) => {
      const base = path.basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9_-]/g, '-');
      return `${Date.now()}-${base}`;
    },
  },
});

// ======================================
// FILTRO
// ======================================

// MIME types aceptados — incluye jfif/pjpeg que Chrome envía para archivos .jfif
const MIME_PERMITIDOS = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/jfif',
  'image/pjpeg',
];

const MIME_PERMITIDOS_COMPRA = [
  ...MIME_PERMITIDOS,
  'application/pdf',
];

const fileFilter = (_req, file, cb) => {
  if (MIME_PERMITIDOS.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Formato no permitido: ${file.mimetype}`), false);
  }
};

// ======================================
// WRAPPER PARA ERRORES DE MULTER
// ======================================

export const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error('❌ Error multer:', err.message);
    return res.status(400).json({
      ok: false,
      message: 'Error procesando archivo: ' + err.message
    });
  }
  next();
};

// ======================================
// EXPORTS
// ======================================

export const uploadProducto = multer({
  storage: storageProductos,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Soporta hasta 5 imágenes por producto (campo "imagenes")
export const uploadProductoMultiple = multer({
  storage: storageProductos,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadCompra = multer({

  storage: storageCompras,

  fileFilter: (_req, file, cb) => {
    if (MIME_PERMITIDOS_COMPRA.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato no permitido: ${file.mimetype}`), false);
    }
  },

  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// ======================================
// CONFIG COMPROBANTES DE PAGO (checkout)
// ======================================

const storageComprobantes = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'aroko/comprobantes-pago',
    resource_type: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    public_id: (_req, file) => {
      const base = path.basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9_-]/g, '-');
      return `${Date.now()}-${base}`;
    },
  },
});

const fileFilterComprobante = (_req, file, cb) => {
  const permitidos = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
  if (permitidos.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Formato no permitido: ${file.mimetype}`), false);
  }
};

export const uploadComprobante = multer({
  storage: storageComprobantes,
  fileFilter: fileFilterComprobante,
  limits: { fileSize: 10 * 1024 * 1024 },
});