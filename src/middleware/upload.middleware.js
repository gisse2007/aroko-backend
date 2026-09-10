// src/middleware/upload.middleware.js

import multer from 'multer';
import fs from 'fs';
import path from 'path';

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

const storageProductos = multer.diskStorage({

  destination: (_req, _file, cb) => {
    cb(null, path.join(UPLOADS_DIR, 'productos'));
  },

  filename: (_req, file, cb) => {
    const extensiones = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/webp': '.webp',
      'image/jfif': '.jpg',
      'image/pjpeg': '.jpg',
    };
    const ext = extensiones[file.mimetype] || '.jpg';
    const base = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '-');
    const nombre = `${Date.now()}-${base}${ext}`;
    cb(null, nombre);
  }
});

// ======================================
// CONFIG COMPRAS
// ======================================

const storageCompras = multer.diskStorage({

  destination: (_req, _file, cb) => {

    cb(null, path.join(UPLOADS_DIR, 'compras'));
  },

  filename: (_req, file, cb) => {

    const nombre = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;

    cb(
      null,
      nombre
    );
  }
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

  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// ======================================
// CONFIG COMPROBANTES DE PAGO (checkout)
// ======================================

const storageComprobantes = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/comprobantes-pago'),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
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