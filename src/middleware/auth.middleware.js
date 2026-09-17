import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const verificarToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.warn('[Auth] Authorization faltante');
    return res.status(401).json({ ok: false, message: 'Token no proporcionado' });
  }

  const [scheme, token] = authHeader.split(' ');

  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    console.warn('[Auth] Authorization inválido');
    return res.status(401).json({ ok: false, message: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const rolObj = decoded.rol_obj ?? null;
    const rolNombre = decoded.rol_nombre ?? decoded.rol ?? rolObj?.nombre ?? '';

    const { rows } = await pool.query(`
      SELECT
        u.id_usuario,
        u.nombre_usuario,
        u.correo,
        u.estado AS usuario_estado,
        COALESCE(u.token_version, 0) AS token_version,
        r.id_rol AS rol_id,
        r.nombre AS rol_nombre,
        r.estado AS rol_estado,
        COALESCE(
          JSONB_AGG(p.nombre) FILTER (WHERE p.id_permiso IS NOT NULL AND p.estado = 'ACTIVO'),
          '[]'::jsonb
        ) AS permisos
      FROM usuarios u
      JOIN roles r ON r.id_rol = u.rol_id
      LEFT JOIN rol_permiso rp ON rp.rol_id = r.id_rol
      LEFT JOIN permisos p ON p.id_permiso = rp.permiso_id
      WHERE u.id_usuario = $1
      GROUP BY u.id_usuario, u.nombre_usuario, u.correo, u.estado, u.token_version,
               r.id_rol, r.nombre, r.estado
    `, [decoded.id_usuario ?? decoded.id]);

    const actual = rows[0];
    if (!actual || actual.usuario_estado !== 'ACTIVO' || actual.rol_estado !== 'ACTIVO') {
      return res.status(401).json({ ok: false, message: 'La sesión ya no está activa.' });
    }

    // Si la contraseña cambió después de emitir este token, su token_version
    // quedó desactualizada frente a la de la BD: se invalida la sesión.
    const tokenVersion = Number(decoded.token_version ?? 0);
    const dbTokenVersion = Number(actual.token_version ?? 0);
    if (tokenVersion !== dbTokenVersion) {
      return res.status(401).json({
        ok: false,
        message: 'Tu contraseña fue cambiada. Vuelve a iniciar sesión.',
      });
    }

    // Normalizar siempre a id_usuario y permisos vigentes de la BD.
    req.usuario = {
      id_usuario:     actual.id_usuario,
      nombre_usuario: actual.nombre_usuario ?? decoded.nombre_usuario ?? decoded.nombre ?? decoded.correo ?? decoded.email,
      correo:         actual.correo ?? decoded.correo ?? decoded.email,
      rol:            actual.rol_nombre,
      rol_nombre:     actual.rol_nombre,
      rol_id:         actual.rol_id,
      permisos:       actual.permisos,
      empleado_id:    decoded.empleado_id ?? decoded.empleado?.id_empleado ?? null,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      console.warn('[Auth] Token expirado');
      return res.status(401).json({ ok: false, message: 'Sesión expirada. Inicia sesión nuevamente.' });
    }
    if (err.name === 'JsonWebTokenError') {
      console.warn('[Auth] Token inválido');
      return res.status(401).json({ ok: false, message: 'Token inválido.' });
    }
    console.error('[Auth] Error verificando token:', err.message);
    return res.status(401).json({ ok: false, message: 'No autenticado.' });
  }
};

export const verificarRol = (...rolesPermitidos) => (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ ok: false, message: 'No autenticado' });
  }
  const rolBase = req.usuario.rol ?? req.usuario.rol_nombre ?? req.usuario.rol?.nombre ?? '';
  const rol = typeof rolBase === 'string' ? rolBase.trim() : (rolBase?.nombre ?? '').trim();
  // Comparación case-insensitive para cubrir 'ADMINISTRADOR' vs 'Administrador'
  const permitido = rolesPermitidos.some(
    (r) => r.toLowerCase() === rol.toLowerCase()
  );
  if (!permitido) {
    return res.status(403).json({
      ok: false,
      message: 'No tienes permiso para esta acción.',
      rol_recibido: rol,
    });
  }
  next();
};

export const verificarPermiso = (...permisosPermitidos) => (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ ok: false, message: 'No autenticado' });
  }

  const permisos = new Set((req.usuario.permisos ?? []).map((permiso) =>
    String(permiso).trim().toUpperCase()
  ));
  const permitido = permisosPermitidos.some((permiso) =>
    permisos.has(String(permiso).trim().toUpperCase())
  );

  if (!permitido) {
    return res.status(403).json({
      ok: false,
      message: 'No tienes el permiso necesario para esta acción.',
      permisos_requeridos: permisosPermitidos,
    });
  }
  next();
};

// Middleware exclusivo para rutas del panel administrativo
export const soloPanel = (req, res, next) => {
  const ROLES_PANEL = ['Administrador', 'Panadero', 'Repartidor'];
  const rol = String(req.usuario?.rol ?? req.usuario?.rol_nombre ?? '').trim();
  if (!ROLES_PANEL.some((permitido) => permitido.toLowerCase() === rol.toLowerCase())) {
    return res.status(403).json({
      ok: false,
      message: 'No tienes acceso al panel administrativo.',
      rol_recibido: rol,
    });
  }
  next();
};