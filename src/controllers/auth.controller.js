// src/controllers/auth.controller.js

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import pool from '../config/db.js';
import { AUTH_QUERIES } from '../queries/auth.queries.js';
import { enviarCorreoBienvenida, enviarCorreoRecuperacion } from '../services/email.service.js';


function normalizarPermisos(permisos) {
  if (!permisos) return [];

  const parsed = Array.isArray(permisos) ? permisos : (() => {
    try {
      return JSON.parse(permisos);
    } catch {
      return [];
    }
  })();

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((permiso) => {
      if (typeof permiso === 'string') return permiso;
      if (permiso && typeof permiso === 'object') return permiso.nombre || permiso.key || permiso.id_permiso;
      return null;
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// Utilidad: genera el JWT con los datos del usuario
// ─────────────────────────────────────────────
function generarToken(usuario) {
  const permisos = normalizarPermisos(usuario.permisos);
  const payload = {
    id:         usuario.id_usuario,
    id_usuario: usuario.id_usuario,
    nombre:     usuario.nombre_usuario ?? usuario.correo,
    email:      usuario.correo,
    correo:     usuario.correo,
    rol:        usuario.rol_nombre,
    rol_nombre: usuario.rol_nombre,
    rol_id:     usuario.rol_id,
    permisos,
    empleado_id: usuario.empleado_id ?? null,
    rol_obj: {
      id_rol: usuario.rol_id,
      nombre: usuario.rol_nombre,
      descripcion: usuario.rol_descripcion ?? null,
      permisos,
    },
  };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

// Construye el objeto usuario normalizado para respuestas JSON
function formatearUsuario(u) {
  const permisos = normalizarPermisos(u.permisos);
  const rolNombre = u.rol_nombre ?? u.rol?.nombre ?? null;
  const rolDescripcion = u.rol_descripcion ?? u.rol?.descripcion ?? null;

  let empleadoData = null;
  if (u.empleado && typeof u.empleado === 'object') {
    empleadoData = {
      id_empleado: u.empleado.id_empleado,
      nombre: u.empleado.nombre ?? null,
      tipo_documento: u.empleado.tipo_documento ?? null,
      documento: u.empleado.documento ?? null,
      telefono: u.empleado.telefono ?? null,
      cargo: u.empleado.cargo ?? null,
      area: u.empleado.area ?? null,
      direccion: u.empleado.direccion ?? null,
      email: u.empleado.email ?? null,
      salario: u.empleado.salario ?? null,
      fecha_ingreso: u.empleado.fecha_ingreso ?? null,
      estado: u.empleado.estado ?? null,
    };
  } else if (u.empleado_id) {
    empleadoData = {
      id_empleado: u.empleado_id,
      nombre: u.empleado_nombre ?? null,
    };
  }

  return {
    id_usuario:       u.id_usuario,
    nombre_usuario:   u.nombre_usuario ?? u.correo,
    correo:           u.correo,
    rol: {
      id_rol:       u.rol_id ?? u.rol?.id_rol ?? null,
      nombre:       rolNombre,
      descripcion:  rolDescripcion,
      permisos,
    },
    rol_nombre:       rolNombre,
    rol_id:           u.rol_id ?? null,
    permisos,
    empleado_id:      u.empleado_id ?? (empleadoData?.id_empleado ?? null),
    empleado:         empleadoData,
    telefono:         u.telefono         ?? null,
    direccion:        u.direccion        ?? null,
    numero_documento: u.numero_documento ?? null,
    tipo_documento:   u.tipo_documento   ?? null,
  };
}

// POST /api/auth/register
// Body: { nombre, email, telefono, tipo_documento, documento, password }
export const register = async (req, res) => {
  const { nombre, email, telefono, tipo_documento, documento, password } = req.body;

  const TIPOS_DOCUMENTO_VALIDOS = ['CC', 'TI', 'CE', 'Pasaporte'];
  const correoNorm = (email || '').trim().toLowerCase();

  // ── Validaciones de campos obligatorios ──
  if (!nombre || !email || !documento || !tipo_documento || !password) {
    return res.status(400).json({
      ok: false,
      message: 'Nombre, correo, documento, tipo de documento y contraseña son obligatorios.',
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNorm)) {
    return res.status(400).json({ ok: false, message: 'El correo no tiene un formato válido.' });
  }

  if (!TIPOS_DOCUMENTO_VALIDOS.includes(tipo_documento)) {
    return res.status(400).json({
      ok: false,
      message: `Tipo de documento inválido. Valores permitidos: ${TIPOS_DOCUMENTO_VALIDOS.join(', ')}.`,
    });
  }

  if (password.length < 8) {
    return res.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ ok: false, message: 'La contraseña debe contener al menos una mayúscula y un número.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Validar correo duplicado en usuarios ──
    const { rows: dupCorreo } = await client.query(
      AUTH_QUERIES.CHECK_CORREO_EXISTE, [correoNorm]
    );
    if (dupCorreo.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'El correo ya está registrado.' });
    }

    // ── Validar documento duplicado en clientes ──
    const { rows: dupDoc } = await client.query(
      AUTH_QUERIES.CHECK_DOCUMENTO_EXISTE, [documento.trim()]
    );
    if (dupDoc.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'El documento ya está registrado.' });
    }

    // ── Crear usuario con rol Cliente (asignado por BD) ──
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query(AUTH_QUERIES.REGISTER, [
      nombre.trim(),
      correoNorm,
      hash,
    ]);
    const usuario = rows[0];

    // ── Crear cliente vinculado ──
    await client.query(
      `INSERT INTO clientes
         (nombre, tipo_documento, documento, telefono, email, usuario_id, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO')`,
      [
        nombre.trim(),
        tipo_documento,
        documento.trim(),
        (telefono || '').trim() || null,
        correoNorm,
        usuario.id_usuario,
      ]
    );

    await client.query('COMMIT');

    // Correo de bienvenida — no bloquea la respuesta
    enviarCorreoBienvenida({ correo: correoNorm, nombre: nombre.trim() })
      .catch(err => console.error('[email] Bienvenida:', err.message));

    return res.status(201).json({
      ok: true,
      message: 'Usuario registrado correctamente.',
      usuario: {
        id_usuario:     usuario.id_usuario,
        nombre_usuario: usuario.nombre_usuario,
        correo:         usuario.correo,
        rol_id:         usuario.rol_id,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en register:', error.message, '| code:', error.code, '| detail:', error.detail, '| constraint:', error.constraint, '| column:', error.column, '| table:', error.table);
    // Traducir errores de constraint conocidos a mensajes claros
    if (error.code === '23505') {
      if (error.constraint?.includes('correo') || error.constraint?.includes('email')) {
        return res.status(409).json({ ok: false, message: 'El correo ya está registrado.' });
      }
      if (error.constraint?.includes('documento')) {
        return res.status(409).json({ ok: false, message: 'El documento ya está registrado.' });
      }
      return res.status(409).json({ ok: false, message: 'Ya existe un registro con esos datos.' });
    }
    if (error.code === '23502') {
      return res.status(400).json({ ok: false, message: `El campo '${error.column}' es obligatorio y no puede estar vacío.` });
    }
    return res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/login
// Body: { correo, contrasena }
// ─────────────────────────────────────────────
export const login = async (req, res) => {

  const {
    correo,
    contrasena
  } = req.body;

  // Validación básica
  if (!correo || !contrasena) {

    return res.status(400).json({
      ok: false,
      message:
        'Campos obligatorios incompletos.',
    });
  }

  try {

    // Buscar usuario por correo
    const { rows } = await pool.query(
      AUTH_QUERIES.FIND_BY_CORREO,
      [correo.trim().toLowerCase()]
    );

    if (rows.length === 0) {

      return res.status(401).json({
        ok: false,
        message:
          'Correo o contraseña incorrectos.',
      });
    }

    const usuario = rows[0];

    // Verificar estado
    if (usuario.estado !== 'ACTIVO') {
      return res.status(403).json({
        ok: false,
        message: 'Tu cuenta está inactiva. Contacta al administrador.',
      });
    }

    // Comparar contraseña
    const passwordValida = await bcrypt.compare(contrasena, usuario.contrasena);

    if (!passwordValida) {
      return res.status(401).json({
        ok: false,
        message: 'Correo o contraseña incorrectos.',
      });
    }

    // Generar JWT
    const token = generarToken(usuario);

    return res.status(200).json({
      ok:      true,
      message: 'Inicio de sesión exitoso.',
      token,
      usuario: formatearUsuario(usuario),
    });

  } catch (error) {
    console.error('Error en login:', error.message, '| code:', error.code, '| detail:', error.detail);
    return res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
export const logout = (_req, res) => {

  return res.status(200).json({
    ok: true,
    message:
      'Sesión cerrada correctamente.',
  });
};

// ─────────────────────────────────────────────
// POST /api/auth/recuperar
// Body: { correo }
// ─────────────────────────────────────────────
export const solicitarRecuperacion =
  async (req, res) => {

    const { correo } = req.body;

    if (!correo) {

      return res.status(400).json({
        ok: false,
        message:
          'El correo es requerido.',
      });
    }

    try {

      // Código recuperación
      const codigo =
        crypto.randomInt(
          100000,
          999999
        ).toString();

      const { rows } =
        await pool.query(
          AUTH_QUERIES.SAVE_RESET_TOKEN,
          [
            codigo,
            correo
              .trim()
              .toLowerCase(),
          ]
        );

      if (rows.length > 0) {
        await enviarCorreoRecuperacion({ correo: correo.trim().toLowerCase(), codigo });
        console.log(`Correo de recuperación enviado a ${correo}`);
      }

      return res.status(200).json({
        ok: true,
        message:
          'Si el correo está registrado, recibirás un código de recuperación.',
      });

    } catch (error) {
      console.error('Error en recuperación:', error.message, '| code:', error.code, '| detail:', error.detail);
      return res.status(503).json({ ok: false, message: 'No se pudo enviar el correo. Revisa la configuración SMTP del servidor.' });
    }
  };

// ─────────────────────────────────────────────
// POST /api/auth/reset-password
// Body:
// {
//   codigo,
//   nuevaContrasena
// }
// ─────────────────────────────────────────────
export const resetPassword =
  async (req, res) => {

    const {
      codigo,
      nuevaContrasena
    } = req.body;

    if (
      !codigo ||
      !nuevaContrasena
    ) {

      return res.status(400).json({
        ok: false,
        message:
          'Campos obligatorios incompletos.',
      });
    }

    if (nuevaContrasena.length < 8 || !/[A-Z]/.test(nuevaContrasena) || !/[0-9]/.test(nuevaContrasena)) {
      return res.status(400).json({
        ok: false,
        message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.',
      });
    }

    try {

      // Buscar token válido
      const { rows } =
        await pool.query(
          AUTH_QUERIES.FIND_BY_RESET_TOKEN,
          [codigo]
        );

      if (rows.length === 0) {

        return res.status(400).json({
          ok: false,
          message:
            'El código es inválido o ya expiró. Solicita uno nuevo.',
        });
      }

      // Hashear nueva contraseña
      const hash =
        await bcrypt.hash(
          nuevaContrasena,
          10
        );

      // Actualizar password
      await pool.query(
        AUTH_QUERIES.UPDATE_PASSWORD,
        [
          hash,
          rows[0].id_usuario
        ]
      );

      return res.status(200).json({
        ok: true,
        message:
          'Contraseña actualizada correctamente.',
      });

    } catch (error) {
      console.error('Error en reset password:', error.message, '| code:', error.code, '| detail:', error.detail);
      return res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
    }
  };

// GET /api/auth/me
export const me = async (req, res) => {
  const id_usuario = req.usuario?.id_usuario;

  if (!id_usuario || isNaN(id_usuario)) {
    console.warn('[me] id_usuario inválido en token:', req.usuario);
    return res.status(401).json({ ok: false, message: 'Sesión inválida. Vuelve a iniciar sesión.' });
  }

  try {
    const { rows } = await pool.query(AUTH_QUERIES.FIND_BY_ID, [id_usuario]);

    if (rows.length === 0 || rows[0].estado !== 'ACTIVO') {
      return res.status(401).json({ ok: false, message: 'Usuario no encontrado o inactivo.' });
    }

    return res.status(200).json({ ok: true, usuario: formatearUsuario(rows[0]) });
  } catch (error) {
    console.error('Error en /me:', error.message);
    return res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
  }
};

// PUT /api/auth/user/:id
// Body: { nombre_usuario, correo, contrasena? }
export const actualizarPerfil = async (req, res) => {
  const id_usuario = parseInt(req.params.id, 10);

  // Solo el propio usuario puede editarse
  if (req.usuario.id_usuario !== id_usuario) {
    return res.status(403).json({ ok: false, message: 'No puedes modificar otro usuario.' });
  }

  const { nombre_usuario, correo, contrasena } = req.body;

  if (!nombre_usuario || !correo) {
    return res.status(400).json({ ok: false, message: 'Nombre y correo son obligatorios.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
    return res.status(400).json({ ok: false, message: 'El correo no tiene un formato válido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que el usuario existe por id_usuario
    const { rows: existe } = await client.query(
      AUTH_QUERIES.FIND_BY_ID, [id_usuario]
    );
    if (existe.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Cuenta no encontrada.' });
    }

    // Verificar correo duplicado en otro usuario
    const { rows: dupCorreo } = await client.query(
      `SELECT id_usuario FROM usuarios WHERE LOWER(correo) = LOWER($1) AND id_usuario != $2`,
      [correo.trim(), id_usuario]
    );
    if (dupCorreo.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'Ese correo ya está en uso.' });
    }

    let updatedRows;
    if (contrasena) {
      if (contrasena.length < 8 || !/[A-Z]/.test(contrasena) || !/[0-9]/.test(contrasena)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.' });
      }
      const hash = await bcrypt.hash(contrasena, 10);
      ({ rows: updatedRows } = await client.query(
        AUTH_QUERIES.UPDATE_PERFIL_CON_PASSWORD,
        [nombre_usuario.trim(), correo.trim().toLowerCase(), hash, id_usuario]
      ));
    } else {
      ({ rows: updatedRows } = await client.query(
        AUTH_QUERIES.UPDATE_PERFIL,
        [nombre_usuario.trim(), correo.trim().toLowerCase(), id_usuario]
      ));
    }

    await client.query('COMMIT');

    const { rows: refreshedRows } = await pool.query(
      AUTH_QUERIES.FIND_BY_ID, [id_usuario]
    );
    return res.status(200).json({
      ok: true,
      message: 'Perfil actualizado correctamente.',
      usuario: formatearUsuario(refreshedRows[0] ?? updatedRows[0]),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en actualizarPerfil:', error.message, '| code:', error.code);
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, message: 'El correo ya está registrado.' });
    }
    return res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};