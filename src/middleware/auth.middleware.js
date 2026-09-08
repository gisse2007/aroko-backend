import jwt from 'jsonwebtoken';

export const verificarToken = (req, res, next) => {
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

    // Normalizar siempre a id_usuario sin importar cómo fue generado el token
    req.usuario = {
      id_usuario:     decoded.id_usuario ?? decoded.id,
      nombre_usuario: decoded.nombre_usuario ?? decoded.nombre ?? decoded.correo ?? decoded.email,
      correo:         decoded.correo  ?? decoded.email,
      rol:            typeof decoded.rol === 'string' ? decoded.rol : rolNombre,
      rol_nombre:     rolNombre,
      rol_id:         decoded.rol_id ?? rolObj?.id_rol ?? null,
      permisos:       Array.isArray(decoded.permisos) ? decoded.permisos : [],
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

// Middleware exclusivo para rutas del panel administrativo
export const soloPanel = (req, res, next) => {
  const ROLES_PANEL = ['Administrador', 'Panadero', 'Repartidor'];
  const rol = req.usuario?.rol ?? req.usuario?.rol_nombre;
  if (!ROLES_PANEL.includes(rol)) {
    return res.status(403).json({
      ok: false,
      message: 'No tienes acceso al panel administrativo.',
      rol_recibido: rol,
    });
  }
  next();
};