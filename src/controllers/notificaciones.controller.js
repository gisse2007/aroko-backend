// src/controllers/notificaciones.controller.js
import pool from '../config/db.js';
import { NOTIFICACIONES_QUERIES } from '../queries/notificaciones.queries.js';

// GET /api/notificaciones/mias
export const listarMisNotificaciones = async (req, res) => {
  const usuario_id = req.usuario?.id_usuario;
  if (!usuario_id) {
    return res.status(401).json({ ok: false, message: 'Sesión inválida.' });
  }
  try {
    const [{ rows: notificaciones }, { rows: countRows }] = await Promise.all([
      pool.query(NOTIFICACIONES_QUERIES.LIST_BY_USUARIO, [usuario_id]),
      pool.query(NOTIFICACIONES_QUERIES.COUNT_NO_LEIDAS, [usuario_id]),
    ]);
    return res.status(200).json({
      ok: true,
      data: notificaciones,
      no_leidas: countRows[0]?.total ?? 0,
    });
  } catch (error) {
    console.error('Error al listar notificaciones:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar las notificaciones.' });
  }
};

// PATCH /api/notificaciones/:id/leida
export const marcarLeida = async (req, res) => {
  const usuario_id = req.usuario?.id_usuario;
  const { id } = req.params;
  try {
    const { rows } = await pool.query(NOTIFICACIONES_QUERIES.MARCAR_LEIDA, [id, usuario_id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Notificación no encontrada.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al marcar notificación como leída:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar la notificación.' });
  }
};

// PATCH /api/notificaciones/marcar-todas-leidas
export const marcarTodasLeidas = async (req, res) => {
  const usuario_id = req.usuario?.id_usuario;
  try {
    await pool.query(NOTIFICACIONES_QUERIES.MARCAR_TODAS_LEIDAS, [usuario_id]);
    return res.status(200).json({ ok: true, message: 'Notificaciones marcadas como leídas.' });
  } catch (error) {
    console.error('Error al marcar notificaciones como leídas:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar las notificaciones.' });
  }
};
