// src/controllers/roles.controller.js

import pool from '../config/db.js';
import { ROLES_QUERIES, PERMISOS_QUERIES } from '../queries/roles.queries.js';

// ══════════════════════════════════════════════
//  ROLES
// ══════════════════════════════════════════════

// GET /api/roles?search=texto&estado=ACTIVO
export const listarRoles = async (req, res) => {
  const { search, estado } = req.query;
  try {
    let rows;
    if (!search && !estado) {
      ({ rows } = await pool.query(ROLES_QUERIES.ACTIVE_LIST));
    } else if (search && !estado) {
      const q = `%${search.trim()}%`;
      ({ rows } = await pool.query(ROLES_QUERIES.ACTIVE_SEARCH, [q]));
    } else if (search) {
      const q = `%${search.trim()}%`;
      ({ rows } = await pool.query(ROLES_QUERIES.SEARCH, [q]));
    } else {
      ({ rows } = await pool.query(ROLES_QUERIES.LIST));
    }

    // Filtrar por estado si viene el parámetro
    if (estado) {
      rows = rows.filter((r) => r.estado === estado.toUpperCase());
    }

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay roles registrados.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar roles:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar roles.' });
  }
};

// GET /api/roles/:id
export const obtenerRol = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(ROLES_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Rol no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al obtener rol:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar el detalle del rol.' });
  }
};

// POST /api/roles
// Body: { nombre, descripcion }
export const crearRol = async (req, res) => {
  const { nombre, descripcion } = req.body;

  if (!nombre || !descripcion) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  try {
    // Verificar nombre duplicado
    const { rows: dup } = await pool.query(ROLES_QUERIES.NOMBRE_EXISTS, [nombre.trim(), 0]);
    if (dup.length > 0) {
      return res.status(409).json({ ok: false, message: 'El rol ya se encuentra registrado.' });
    }

    const { rows } = await pool.query(ROLES_QUERIES.CREATE, [nombre.trim(), descripcion.trim()]);
    return res.status(201).json({ ok: true, message: 'Rol registrado exitosamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al crear rol:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar el rol.' });
  }
};

// PUT /api/roles/:id
// Body: { nombre, descripcion }
export const editarRol = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;

  if (!nombre || !descripcion) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  try {
    // Verificar nombre duplicado excluyendo el propio
    const { rows: dup } = await pool.query(ROLES_QUERIES.NOMBRE_EXISTS, [nombre.trim(), id]);
    if (dup.length > 0) {
      return res.status(409).json({ ok: false, message: 'Ya existe otro rol con ese nombre.' });
    }

    const { rows } = await pool.query(ROLES_QUERIES.UPDATE, [nombre.trim(), descripcion.trim(), id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Rol no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Rol actualizado correctamente.', data: rows[0] });
  } catch (error) {
    console.error('Error al editar rol:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar el rol.' });
  }
};

// PATCH /api/roles/:id/estado
export const cambiarEstadoRol = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(ROLES_QUERIES.TOGGLE_ESTADO, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Rol no encontrado.' });
    }
    return res.status(200).json({
      ok: true,
      message: 'Estado del rol actualizado correctamente.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Error al cambiar estado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cambiar el estado del rol.' });
  }
};

// DELETE /api/roles/:id
export const eliminarRol = async (req, res) => {
  const { id } = req.params;
  try {
    // No eliminar si tiene usuarios asignados
    const { rows: check } = await pool.query(ROLES_QUERIES.HAS_USUARIOS, [id]);
    if (parseInt(check[0].total) > 0) {
      return res.status(409).json({
        ok: false,
        message: 'No se puede eliminar: el rol tiene usuarios asignados.',
      });
    }

    const { rowCount } = await pool.query(ROLES_QUERIES.DELETE, [id]);
    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: 'Rol no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Rol eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar rol:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al eliminar el rol.' });
  }
};

// ── Permisos de un rol ────────────────────────────────────────────────────

// GET /api/roles/:id/permisos?search=texto
export const listarPermisosRol = async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;
  try {
    let { rows } = await pool.query(PERMISOS_QUERIES.GET_BY_ROL, [id]);

    if (search) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (p) => p.nombre.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q)
      );
    }

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay permisos asociados.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar permisos del rol:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar los permisos.' });
  }
};

// GET /api/roles/:id/permisos/disponibles
export const permisosDisponibles = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(PERMISOS_QUERIES.GET_DISPONIBLES, [id]);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al obtener permisos disponibles:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al obtener permisos disponibles.' });
  }
};

// POST /api/roles/:id/permisos
// Body: { permiso_id }
export const agregarPermiso = async (req, res) => {
  const { id }         = req.params;
  const { permiso_id } = req.body;

  if (!permiso_id) {
    return res.status(400).json({ ok: false, message: 'El permiso_id es requerido.' });
  }

  try {
    // Verificar si ya está asignado
    const { rows: ya } = await pool.query(PERMISOS_QUERIES.YA_ASIGNADO, [id, permiso_id]);
    if (ya.length > 0) {
      return res.status(409).json({ ok: false, message: 'El permiso ya está asociado al rol.' });
    }

    await pool.query(PERMISOS_QUERIES.AGREGAR_A_ROL, [id, permiso_id]);
    return res.status(201).json({ ok: true, message: 'Permiso agregado exitosamente.' });
  } catch (error) {
    console.error('Error al agregar permiso:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al agregar el permiso.' });
  }
};

// DELETE /api/roles/:id/permisos/:permisoId
export const quitarPermiso = async (req, res) => {
  const { id, permisoId } = req.params;
  try {
    const { rowCount } = await pool.query(PERMISOS_QUERIES.QUITAR_DE_ROL, [id, permisoId]);
    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: 'Permiso no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Permiso eliminado correctamente.' });
  } catch (error) {
    console.error('Error al quitar permiso:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al eliminar el permiso.' });
  }
};

// ══════════════════════════════════════════════
//  PERMISOS (CRUD propio)
// ══════════════════════════════════════════════

// GET /api/permisos?search=texto
export const listarPermisos = async (req, res) => {
  const { search } = req.query;
  try {
    let rows;
    if (search) {
      ({ rows } = await pool.query(PERMISOS_QUERIES.SEARCH, [`%${search.trim()}%`]));
    } else {
      ({ rows } = await pool.query(PERMISOS_QUERIES.LIST));
    }

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay permisos registrados.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar permisos:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar los permisos.' });
  }
};

// GET /api/permisos/:id
export const obtenerPermiso = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(PERMISOS_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Permiso no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al cargar el permiso.' });
  }
};

// POST /api/permisos
export const crearPermiso = async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre || !descripcion) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }
  try {
    const { rows } = await pool.query(PERMISOS_QUERIES.CREATE, [nombre.trim(), descripcion.trim()]);
    return res.status(201).json({ ok: true, message: 'Permiso registrado exitosamente.', data: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, message: 'El permiso ya se encuentra registrado.' });
    }
    return res.status(500).json({ ok: false, message: 'Error al registrar el permiso.' });
  }
};

// PUT /api/permisos/:id
export const editarPermiso = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;
  if (!nombre || !descripcion) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }
  try {
    const { rows } = await pool.query(PERMISOS_QUERIES.UPDATE, [nombre.trim(), descripcion.trim(), id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Permiso no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Permiso actualizado correctamente.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al actualizar el permiso.' });
  }
};

// PATCH /api/permisos/:id/estado
export const cambiarEstadoPermiso = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(PERMISOS_QUERIES.TOGGLE_ESTADO, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Permiso no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Estado actualizado correctamente.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al cambiar el estado.' });
  }
};

// DELETE /api/permisos/:id
export const eliminarPermiso = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(PERMISOS_QUERIES.DELETE, [id]);
    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: 'Permiso no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Permiso eliminado correctamente.' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al eliminar el permiso.' });
  }
};