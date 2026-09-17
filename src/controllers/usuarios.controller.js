// src/controllers/usuarios.controller.js

import bcrypt from 'bcryptjs';
import pool   from '../config/db.js';
import { USUARIOS_QUERIES, EMPLEADOS_QUERIES } from '../queries/usuarios.queries.js';
import { CLIENTES_QUERIES } from '../queries/pedidos.queries.js';
import { enviarCorreoCredenciales, generarContrasena } from '../services/email.service.js';
import { crearNotificacion } from '../services/notificaciones.service.js';

const ROL_CLIENTE_NOMBRE = 'Cliente';

// ══════════════════════════════════════════════
//  USUARIOS
// ══════════════════════════════════════════════

// GET /api/usuarios?search=&estado=&rol_id=
export const listarUsuarios = async (req, res) => {
  const { search, estado, rol_id } = req.query;
  try {
    let rows;

    if (search) {
      ({ rows } = await pool.query(USUARIOS_QUERIES.SEARCH, [`%${search.trim()}%`]));
    } else if (estado && rol_id) {
      ({ rows } = await pool.query(USUARIOS_QUERIES.FILTER_ESTADO_ROL, [estado.toUpperCase(), parseInt(rol_id)]));
    } else if (estado) {
      ({ rows } = await pool.query(USUARIOS_QUERIES.FILTER_ESTADO, [estado.toUpperCase()]));
    } else if (rol_id) {
      ({ rows } = await pool.query(USUARIOS_QUERIES.FILTER_ROL, [parseInt(rol_id)]));
    } else {
      ({ rows } = await pool.query(USUARIOS_QUERIES.LIST));
    }

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay usuarios registrados.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar usuarios:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al buscar usuario.' });
  }
};

// GET /api/usuarios/:id
export const obtenerUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(USUARIOS_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al obtener usuario:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar el detalle.' });
  }
};

// POST /api/usuarios
export const crearUsuario = async (req, res) => {
  const { correo, contrasena: contrasenaBody, rol_id, nombre_usuario, telefono } = req.body;

  if (!correo || !rol_id) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ ok: false, message: 'El correo no es válido.' });
  }

  const contrasenaGenerada = contrasenaBody || generarContrasena(10);
  if (contrasenaGenerada.length < 6) {
    return res.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: dup } = await client.query(USUARIOS_QUERIES.CORREO_EXISTS, [correo.trim(), 0]);
    if (dup.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'El usuario ya se encuentra registrado.' });
    }
    const hash = await bcrypt.hash(contrasenaGenerada, 10);
    const { rows } = await client.query(USUARIOS_QUERIES.CREATE, [
      correo.trim().toLowerCase(), hash, rol_id,
      (nombre_usuario || '').trim() || null,
      (telefono      || '').trim() || null,
    ]);
    const usuario = rows[0];

    if (parseInt(rol_id, 10) === 1) {
      await client.query(EMPLEADOS_QUERIES.CREATE_ADMIN_EMPLOYEE, [
        usuario.id_usuario,
        usuario.nombre_usuario || usuario.correo,
        `USR-${usuario.id_usuario}`,
        usuario.telefono,
        usuario.correo,
        usuario.estado,
      ]);
    }

    const { rows: rolRows } = await client.query(`SELECT nombre FROM roles WHERE id_rol = $1`, [rol_id]);
    if (rolRows[0]?.nombre === ROL_CLIENTE_NOMBRE) {
      const { rows: cliExist } = await client.query(
        `SELECT id_cliente FROM clientes WHERE LOWER(email) = LOWER($1) AND usuario_id IS NULL`, [correo.trim()]
      );
      if (cliExist.length > 0) {
        await client.query(CLIENTES_QUERIES.SET_USUARIO_ID, [usuario.id_usuario, cliExist[0].id_cliente]);
      } else {
        const { rows: cliDup } = await client.query(CLIENTES_QUERIES.FIND_BY_USUARIO_ID, [usuario.id_usuario]);
        if (cliDup.length === 0) {
          await client.query(
            `INSERT INTO clientes (nombre, documento, email, usuario_id, estado) VALUES ($1,$2,$3,$4,'ACTIVO')`,
            [nombre_usuario || correo.trim().toLowerCase(), `USR-${usuario.id_usuario}`, correo.trim().toLowerCase(), usuario.id_usuario]
          );
        }
      }
    }
    await client.query('COMMIT');

    enviarCorreoCredenciales({
      correo: correo.trim().toLowerCase(),
      nombre: nombre_usuario || correo.trim().toLowerCase(),
      contrasena: contrasenaGenerada,
      esEmpleado: false,
    }).catch(err => console.error('[email] Credenciales:', err.message));

    return res.status(201).json({ ok: true, message: 'Usuario registrado exitosamente.', data: usuario });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear usuario:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar el usuario.' });
  } finally {
    client.release();
  }
};

// PUT /api/usuarios/:id
export const editarUsuario = async (req, res) => {
  const { id } = req.params;
  const { correo, rol_id, contrasena, nombre_usuario, telefono, estado } = req.body;

  if (!correo || !rol_id) {
    return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ ok: false, message: 'El correo no es válido (Sin @).' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: dup } = await client.query(USUARIOS_QUERIES.CORREO_EXISTS, [correo.trim(), id]);
    if (dup.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'Ese correo ya está en uso por otro usuario.' });
    }

    const { rows: anterior } = await client.query(
      `SELECT u.rol_id, r.nombre AS rol_nombre FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = $1`, [id]
    );
    const rolAnteriorNombre = anterior[0]?.rol_nombre;
    const { rows: nuevoRolRows } = await client.query(`SELECT nombre FROM roles WHERE id_rol = $1`, [rol_id]);
    const nuevoRolNombre = nuevoRolRows[0]?.nombre;

    const estadoFinal = estado || 'ACTIVO';
    const nombreFinal = (nombre_usuario || '').trim() || null;
    const telefonoFinal = (telefono || '').trim() || null;

    let rows;
    if (contrasena) {
      if (contrasena.length < 6) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
      }
      const hash = await bcrypt.hash(contrasena, 10);
      ({ rows } = await client.query(USUARIOS_QUERIES.UPDATE_WITH_PASSWORD, [
        correo.trim().toLowerCase(), rol_id, nombreFinal, telefonoFinal, estadoFinal, hash, id,
      ]));
      crearNotificacion({
        usuario_id: Number(id),
        tipo: 'SEGURIDAD',
        titulo: 'Contraseña actualizada',
        mensaje: 'Tu contraseña fue cambiada. Se cerraron todas las demás sesiones activas por seguridad.',
      });
    } else {
      ({ rows } = await client.query(USUARIOS_QUERIES.UPDATE, [
        correo.trim().toLowerCase(), rol_id, nombreFinal, telefonoFinal, estadoFinal, id,
      ]));
    }

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    if (rolAnteriorNombre === ROL_CLIENTE_NOMBRE && nuevoRolNombre !== ROL_CLIENTE_NOMBRE) {
      await client.query(`UPDATE clientes SET usuario_id = NULL WHERE usuario_id = $1`, [id]);
    }
    if (nuevoRolNombre === ROL_CLIENTE_NOMBRE && rolAnteriorNombre !== ROL_CLIENTE_NOMBRE) {
      const { rows: cliExist } = await client.query(
        `SELECT id_cliente FROM clientes WHERE LOWER(email) = LOWER($1) AND usuario_id IS NULL`, [correo.trim()]
      );
      if (cliExist.length > 0) {
        await client.query(CLIENTES_QUERIES.SET_USUARIO_ID, [id, cliExist[0].id_cliente]);
      } else {
        const { rows: cliDup } = await client.query(CLIENTES_QUERIES.FIND_BY_USUARIO_ID, [id]);
        if (cliDup.length === 0) {
          await client.query(
            `INSERT INTO clientes (nombre, documento, email, usuario_id, estado) VALUES ($1,$2,$3,$4,'ACTIVO')`,
            [nombreFinal || correo.trim().toLowerCase(), `USR-${id}`, correo.trim().toLowerCase(), id]
          );
        }
      }
    }

    if (parseInt(rol_id, 10) === 1) {
      const { rows: empleadoAdmin } = await client.query(
        `SELECT id_empleado FROM empleados WHERE usuario_id = $1`, [id]
      );
      if (empleadoAdmin.length === 0) {
        await client.query(EMPLEADOS_QUERIES.CREATE_ADMIN_EMPLOYEE, [
          id,
          nombreFinal || correo.trim().toLowerCase(),
          `USR-${id}`,
          telefonoFinal,
          correo.trim().toLowerCase(),
          estadoFinal,
        ]);
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({ ok: true, message: 'Usuario actualizado correctamente.', data: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al editar usuario:', error.message);
    return res.status(500).json({ ok: false, message: 'Usuario no ha podido ser actualizado.' });
  } finally {
    client.release();
  }
};

// PATCH /api/usuarios/:id/estado
export const cambiarEstadoUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(USUARIOS_QUERIES.TOGGLE_ESTADO, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    return res.status(200).json({
      ok: true,
      message: 'Estado actualizado correctamente.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Error al cambiar estado:', error.message);
    return res.status(500).json({ ok: false, message: 'No se pudo cambiar estado.' });
  }
};

// DELETE /api/usuarios/:id  → soft delete (inactiva)
export const eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(USUARIOS_QUERIES.SOFT_DELETE, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Usuario eliminado correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al eliminar usuario:', error.message);
    return res.status(500).json({ ok: false, message: 'Usuario no pudo ser eliminado.' });
  }
};

// ══════════════════════════════════════════════
//  EMPLEADOS
// ══════════════════════════════════════════════

// GET /api/empleados?search=&estado=
export const listarEmpleados = async (req, res) => {
  const { search, estado } = req.query;
  try {
    let rows;
    if (search) {
      ({ rows } = await pool.query(EMPLEADOS_QUERIES.SEARCH, [`%${search.trim()}%`]));
    } else if (estado) {
      ({ rows } = await pool.query(EMPLEADOS_QUERIES.FILTER_ESTADO, [estado.toUpperCase()]));
    } else {
      ({ rows } = await pool.query(EMPLEADOS_QUERIES.LIST));
    }

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay empleados registrados.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar empleados:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar empleados.' });
  }
};

// GET /api/empleados/usuarios-disponibles
// Retorna usuarios ACTIVOS que aún no tienen empleado asignado
export const usuariosDisponibles = async (req, res) => {
  try {
    const { rows } = await pool.query(EMPLEADOS_QUERIES.USUARIOS_DISPONIBLES);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al obtener usuarios disponibles:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al obtener usuarios disponibles.' });
  }
};

// GET /api/empleados/:id
export const obtenerEmpleado = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(EMPLEADOS_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });
    }
    const empleado = rows[0];

    let usuarioData = null;
    if (empleado.usuario && typeof empleado.usuario === 'object') {
      usuarioData = {
        id_usuario: empleado.usuario.id_usuario,
        correo: empleado.usuario.correo ?? null,
        nombre_usuario: empleado.usuario.nombre_usuario ?? null,
        telefono: empleado.usuario.telefono ?? null,
        rol_id: empleado.usuario.rol_id ?? null,
        rol_nombre: empleado.usuario.rol_nombre ?? null,
        rol_descripcion: empleado.usuario.rol_descripcion ?? null,
      };
    }

    return res.status(200).json({
      ok: true,
      data: {
        id_empleado: empleado.id_empleado,
        usuario_id: empleado.usuario_id,
        creado_por_id: empleado.creado_por_id,
        nombre: empleado.nombre,
        tipo_documento: empleado.tipo_documento,
        documento: empleado.documento,
        telefono: empleado.telefono,
        cargo: empleado.cargo,
        area: empleado.area,
        direccion: empleado.direccion,
        email: empleado.email,
        salario: empleado.salario,
        fecha_ingreso: empleado.fecha_ingreso,
        estado: empleado.estado,
        permisos: empleado.permisos || [],
        usuario: usuarioData,
      },
    });
  } catch (error) {
    console.error('Error al obtener empleado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar el detalle del empleado.' });
  }
};

// POST /api/empleados
export const crearEmpleado = async (req, res) => {
  const { nombre, tipo_documento, documento, telefono,
          cargo, area, direccion, email, correo_personal, salario, fecha_ingreso,
          correo_acceso, contrasena: contrasenaBody, rol_id } = req.body;
  const tieneCredenciales = [correo_acceso, contrasenaBody, rol_id].some(
    (valor) => valor !== undefined && valor !== null && valor !== ''
  );

  if (!nombre || !documento) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }
  if (tieneCredenciales && (!correo_acceso || !rol_id)) {
    return res.status(400).json({ ok: false, message: 'Las credenciales requieren correo_acceso y rol_id.' });
  }
  if (correo_acceso && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo_acceso)) {
    return res.status(400).json({ ok: false, message: 'El correo de acceso no es válido.' });
  }

  const contrasenaGenerada = (tieneCredenciales && !contrasenaBody) ? generarContrasena(10) : contrasenaBody;
  if (contrasenaGenerada && contrasenaGenerada.length < 6) {
    return res.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: dupDoc } = await client.query(EMPLEADOS_QUERIES.DOCUMENTO_EXISTS, [documento.trim(), 0]);
    if (dupDoc.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'El empleado ya se encuentra registrado.' });
    }

    let usuarioId = null;
    if (tieneCredenciales) {
      const { rows: dupCorreo } = await client.query(USUARIOS_QUERIES.CORREO_EXISTS, [correo_acceso.trim(), 0]);
      if (dupCorreo.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ ok: false, message: 'El correo de acceso ya se encuentra registrado.' });
      }

      const { rows: rolRows } = await client.query(
        'SELECT id_rol FROM roles WHERE id_rol = $1 AND estado = \'ACTIVO\'', [rol_id]
      );
      if (rolRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'El rol no existe o está inactivo.' });
      }

      const hash = await bcrypt.hash(contrasenaGenerada, 10);
      const { rows: usuarioRows } = await client.query(USUARIOS_QUERIES.CREATE, [
        correo_acceso.trim().toLowerCase(), hash, rol_id, nombre.trim(),
        (telefono || '').trim() || null,
      ]);
      usuarioId = usuarioRows[0].id_usuario;
    }

    const { rows } = await client.query(EMPLEADOS_QUERIES.CREATE, [
      usuarioId || null,
      req.usuario.id_usuario,
      nombre.trim(),
      tipo_documento || 'CC',
      documento.trim(),
      (telefono  || '').trim() || null,
      (cargo     || '').trim() || null,
      (area      || '').trim() || null,
      (direccion || '').trim() || null,
      ((correo_personal ?? email) || '').trim().toLowerCase() || null,
      salario    ? parseFloat(salario)   : null,
      fecha_ingreso || null,
    ]);
    await client.query('COMMIT');

    if (tieneCredenciales && contrasenaGenerada) {
      enviarCorreoCredenciales({
        correo: correo_acceso.trim().toLowerCase(),
        nombre: nombre.trim(),
        contrasena: contrasenaGenerada,
        esEmpleado: true,
      }).catch(err => console.error('[email] Credenciales empleado:', err.message));
    }

    return res.status(201).json({ ok: true, message: 'Empleado registrado exitosamente.', data: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear empleado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar el empleado.' });
  } finally {
    client.release();
  }
};

// PUT /api/empleados/:id
export const editarEmpleado = async (req, res) => {
  const { id } = req.params;
  const { usuario_id, nombre, tipo_documento, documento, telefono,
          cargo, area, direccion, email, salario, fecha_ingreso,
          rol_id, role_id } = req.body;

  const rolSeleccionado = rol_id ?? role_id ?? null;

  if (!nombre || !documento) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }
  try {
    const { rows: dupDoc } = await pool.query(EMPLEADOS_QUERIES.DOCUMENTO_EXISTS, [documento.trim(), id]);
    if (dupDoc.length > 0) return res.status(409).json({ ok: false, message: 'Ese documento ya pertenece a otro empleado.' });

    const usuarioAsignado = usuario_id ?? null;
    if (usuarioAsignado) {
      const { rows: dupUsr } = await pool.query(EMPLEADOS_QUERIES.USUARIO_ASIGNADO, [usuarioAsignado, id]);
      if (dupUsr.length > 0) return res.status(409).json({ ok: false, message: 'Ese usuario ya tiene un empleado asignado.' });
    }

    const { rows } = await pool.query(EMPLEADOS_QUERIES.UPDATE, [
      usuarioAsignado,
      nombre.trim(),
      tipo_documento || 'CC',
      documento.trim(),
      (telefono  || '').trim() || null,
      (cargo     || '').trim() || null,
      (area      || '').trim() || null,
      (direccion || '').trim() || null,
      (email     || '').trim().toLowerCase() || null,
      salario    ? parseFloat(salario)   : null,
      fecha_ingreso || null,
      id,
    ]);
    if (rows.length === 0) return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });

    if (usuarioAsignado && rolSeleccionado) {
      const { rows: usuarioRows } = await pool.query(
        'SELECT id_usuario FROM usuarios WHERE id_usuario = $1',
        [usuarioAsignado]
      );

      if (usuarioRows.length === 0) {
        return res.status(404).json({ ok: false, message: 'El usuario asignado no existe.' });
      }

      const { rows: roleRows } = await pool.query(
        'SELECT id_rol FROM roles WHERE id_rol = $1 AND estado = \'ACTIVO\'',
        [rolSeleccionado]
      );

      if (roleRows.length === 0) {
        return res.status(400).json({ ok: false, message: 'El rol indicado no existe o está inactivo.' });
      }

      await pool.query(
        'UPDATE usuarios SET rol_id = $1 WHERE id_usuario = $2',
        [rolSeleccionado, usuarioAsignado]
      );
    }

    return res.status(200).json({ ok: true, message: 'Empleado actualizado correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al editar empleado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar el empleado.' });
  }
};

// PATCH /api/empleados/:id/estado
export const cambiarEstadoEmpleado = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(EMPLEADOS_QUERIES.TOGGLE_ESTADO, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Estado actualizado correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al cambiar estado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cambiar el estado del empleado.' });
  }
};

// DELETE /api/empleados/:id → soft delete
export const eliminarEmpleado = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(EMPLEADOS_QUERIES.SOFT_DELETE, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Empleado eliminado correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al eliminar empleado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al eliminar el empleado.' });
  }
};