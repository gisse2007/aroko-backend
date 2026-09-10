import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import pool from './config/db.js';

import { AUTH_QUERIES } from './queries/auth.queries.js';
import { EMPLEADOS_QUERIES } from './queries/usuarios.queries.js';
import { USUARIOS_QUERIES } from './queries/usuarios.queries.js';
import { COMPRAS_QUERIES } from './queries/compras.queries.js';
import { PRODUCCION_QUERIES } from './queries/produccion.queries.js';
import {
  CLIENTES_QUERIES,
  PEDIDOS_QUERIES
} from './queries/pedidos.queries.js';

import { VENTAS_QUERIES } from './queries/ventas.queries.js';
import { DOMICILIOS_QUERIES } from './queries/domicilios.queries.js';
import { MOVIMIENTOS_QUERIES } from './queries/stock.queries.js';
import { ORDERS_QUERIES } from './queries/orders.queries.js';
import { INDEXES_QUERIES } from './queries/indexes.queries.js';
import { PRODUCTOS_QUERIES } from './queries/productos.queries.js';

// ─────────────────────────────────────────────
// Migraciones automáticas
// ─────────────────────────────────────────────

const migraciones = [
  { query: AUTH_QUERIES.ADD_RESET_TOKEN,        nombre: 'reset_token' },
  { query: AUTH_QUERIES.ADD_RESET_TOKEN_EXPIRY, nombre: 'reset_token_expiry' },
  { query: AUTH_QUERIES.ADD_NOMBRE_USUARIO,     nombre: 'nombre_usuario' },
  {
    query: `INSERT INTO roles (nombre, descripcion)
            VALUES ('Cliente', 'Acceso a la tienda en línea')
            ON CONFLICT (nombre) DO NOTHING`,
    nombre: 'rol Cliente'
  },
  { query: EMPLEADOS_QUERIES.ADD_TIPO_DOCUMENTO, nombre: 'tipo_documento' },
  { query: EMPLEADOS_QUERIES.MIGRATE,            nombre: 'empleados: campos extras' },
  { query: EMPLEADOS_QUERIES.ADD_CREADO_POR_ID,  nombre: 'empleados: creado_por_id y admins' },
  { query: USUARIOS_QUERIES.MIGRATE,             nombre: 'usuarios: nombre_usuario, telefono' },
  { query: COMPRAS_QUERIES.MIGRATE,              nombre: 'compras columns' },
  { query: PRODUCCION_QUERIES.MIGRATE,           nombre: 'produccion columns' },
  { query: CLIENTES_QUERIES.MIGRATE,             nombre: 'clientes: tipo_documento' },
  { query: CLIENTES_QUERIES.MIGRATE_EMAIL,        nombre: 'clientes: email' },
  { query: CLIENTES_QUERIES.MIGRATE_USUARIO_ID,   nombre: 'clientes: usuario_id' },
  // Eliminar columna id_usuario duplicada de clientes (orden estricto)
  { query: CLIENTES_QUERIES.MIGRATE_ID_USUARIO,   nombre: 'clientes: migrar id_usuario → usuario_id' },
  { query: CLIENTES_QUERIES.DROP_ID_USUARIO_FK,   nombre: 'clientes: drop FK id_usuario' },
  { query: CLIENTES_QUERIES.DROP_ID_USUARIO_UNIQUE, nombre: 'clientes: drop UNIQUE id_usuario' },
  { query: CLIENTES_QUERIES.DROP_ID_USUARIO_COL,  nombre: 'clientes: drop column id_usuario' },
  { query: PEDIDOS_QUERIES.MIGRATE,              nombre: 'pedidos columns' },
  { query: VENTAS_QUERIES.MIGRATE,               nombre: 'ventas columns' },
  { query: DOMICILIOS_QUERIES.MIGRATE,           nombre: 'domicilios columns' },
  { query: MOVIMIENTOS_QUERIES.MIGRATE,           nombre: 'movimientos_inventario table' },
  { query: ORDERS_QUERIES.MIGRATE,                nombre: 'orders / order_items tables' },
  // Integridad: primero desvincular no-clientes, luego vincular huérfanos por correo
  { query: CLIENTES_QUERIES.REMOVE_NON_CLIENTE_ROLE, nombre: 'clientes: desvincular no-clientes' },
  { query: CLIENTES_QUERIES.SYNC_USUARIO_ID,         nombre: 'clientes: vincular por correo' },
  // Eliminar registros huérfanos (sin usuario_id) que no tienen pedidos asociados
  {
    query: `DELETE FROM clientes
            WHERE usuario_id IS NULL
              AND id_cliente NOT IN (SELECT DISTINCT cliente_id FROM pedidos)`,
    nombre: 'clientes: eliminar huérfanos sin pedidos'
  },
  { query: INDEXES_QUERIES.MIGRATE, nombre: 'indexes: fk, filtered columns, composite' },
  { query: PRODUCTOS_QUERIES.MIGRATE_BADGES, nombre: 'productos: es_nuevo, es_temporada' },
];

async function ejecutarMigraciones() {
  for (const { query, nombre } of migraciones) {
    try {
      await pool.query(query);
      console.log(`✔ Migración [${nombre}] OK`);
    } catch (err) {
      console.warn(`⚠ Migración [${nombre}] falló: ${err.message}`);
    }
  }
}

// ─────────────────────────────────────────────
// Rutas
// ─────────────────────────────────────────────

import authRoutes from './routes/auth.routes.js';
import rolesRoutes from './routes/roles.routes.js';
import permisosRoutes from './routes/permisos.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import empleadosRoutes from './routes/empleados.routes.js';
import proveedoresRoutes from './routes/proveedores.routes.js';
import catInsumoRoutes from './routes/categoriasInsumo.routes.js';
import insumosRoutes from './routes/insumos.routes.js';
import comprasRoutes from './routes/compras.routes.js';
import catProductoRoutes from './routes/categoriasProducto.routes.js';
import productosRoutes from './routes/productos.routes.js';
import produccionRoutes from './routes/produccion.routes.js';
import salidasRoutes from './routes/salidas.routes.js';
import clientesRoutes from './routes/clientes.routes.js';
import pedidosRoutes from './routes/pedidos.routes.js';
import ventasRoutes from './routes/ventas.routes.js';
import abonosRoutes from './routes/abonos.routes.js';
import domiciliosRoutes from './routes/domicilios.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { ordersRouter, adminOrdersRouter } from './routes/orders.routes.js';

const app = express();

// ─────────────────────────────────────────────
// Middleware globales
// ─────────────────────────────────────────────

app.use(cors({
  origin: (origin, callback) => {
    const allowed = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : [];
    // Sin origin (Postman, curl) o localhost en desarrollo siempre permitido
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || allowed.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS bloqueado: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// ─────────────────────────────────────────────
// Middleware de logs global
// ─────────────────────────────────────────────

app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/api/productos') {
    console.log('[POST /api/productos]');
    console.log('  Headers:', {
      'content-type': req.headers['content-type'],
      'authorization': req.headers['authorization'] ? 'Bearer ***' : 'ausente'
    });
    console.log('  Body keys:', Object.keys(req.body || {}));
    console.log('  File:', req.file ? { name: req.file.filename, size: req.file.size } : 'ausente');
  }
  next();
});

// ─────────────────────────────────────────────
// Archivos públicos
// ─────────────────────────────────────────────

// Archivos subidos (imágenes de productos, comprobantes)
app.use('/uploads', express.static('uploads'));

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────

const API = '/api';

app.use(`${API}/auth`, authRoutes);

app.use(`${API}/roles`, rolesRoutes);

app.use(`${API}/permisos`, permisosRoutes);

app.use(`${API}/usuarios`, usuariosRoutes);

app.use(`${API}/empleados`, empleadosRoutes);

app.use(`${API}/proveedores`, proveedoresRoutes);

app.use(`${API}/categorias-insumos`, catInsumoRoutes);
app.use(`${API}/insumos`, insumosRoutes);
app.use(`${API}/compras`, comprasRoutes);

app.use(`${API}/categorias-productos`, catProductoRoutes);
app.use(`${API}/productos`, productosRoutes);
app.use(`${API}/produccion`, produccionRoutes);

app.use(`${API}/salidas`, salidasRoutes);
app.use(`${API}/clientes`, clientesRoutes);
app.use(`${API}/pedidos`, pedidosRoutes);
app.use(`${API}/ventas`, ventasRoutes);
app.use(`${API}/abonos`, abonosRoutes);
app.use(`${API}/domicilios`, domiciliosRoutes);
app.use(`${API}/dashboard`, dashboardRoutes);
app.use(`${API}/orders`, ordersRouter);
app.use(`${API}/admin`, adminOrdersRouter);

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────

app.get('/api/health', (_req, res) => {

  res.json({
    ok: true,
    message: 'Aroko API corriendo'
  });
});

// ─────────────────────────────────────────────
// 404
// ─────────────────────────────────────────────

app.use((_req, res) => {

  res.status(404).json({
    ok: false,
    message: 'Ruta no encontrada'
  });
});

// ─────────────────────────────────────────────
// Arranque
// ─────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

ejecutarMigraciones().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Aroko API corriendo en http://localhost:${PORT}`);
  });
});