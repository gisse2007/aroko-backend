// src/services/notificaciones.service.js
import pool from '../config/db.js';
import { NOTIFICACIONES_QUERIES } from '../queries/notificaciones.queries.js';

/**
 * Crea una notificación para un usuario. Pensada para usarse "fire and
 * forget" desde otros controladores (cambio de contraseña, cambio de
 * estado de pedido, etc.) sin que un fallo aquí interrumpa la operación
 * principal que la origina.
 */
export async function crearNotificacion({ usuario_id, tipo = 'INFO', titulo, mensaje = null }, client = pool) {
  if (!usuario_id || !titulo) return null;
  try {
    const { rows } = await client.query(NOTIFICACIONES_QUERIES.CREATE, [usuario_id, tipo, titulo, mensaje]);
    return rows[0] ?? null;
  } catch (error) {
    console.error('[notificaciones] Error al crear notificación:', error.message);
    return null;
  }
}
