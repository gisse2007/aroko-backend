// src/queries/roles.queries.js

export const ROLES_QUERIES = {

  // Roles activos para selectores del frontend
  ACTIVE_LIST: `
    SELECT id_rol, nombre, descripcion, estado
    FROM roles
    WHERE estado = 'ACTIVO'
    ORDER BY nombre
  `,

  ACTIVE_SEARCH: `
    SELECT id_rol, nombre, descripcion, estado
    FROM roles
    WHERE estado = 'ACTIVO' AND nombre ILIKE $1
    ORDER BY nombre
  `,

  // ── Roles ──────────────────────────────────────────────────────────────

  // Listar todos los roles con cuántos permisos tienen
  LIST: `
    SELECT
      r.id_rol,
      r.nombre,
      r.descripcion,
      r.estado,
      COUNT(rp.permiso_id) AS total_permisos
    FROM roles r
    LEFT JOIN rol_permiso rp ON rp.rol_id = r.id_rol
    GROUP BY r.id_rol
    ORDER BY r.id_rol
  `,

  // Buscar roles por nombre o descripción
  SEARCH: `
    SELECT
      r.id_rol,
      r.nombre,
      r.descripcion,
      r.estado,
      COUNT(rp.permiso_id) AS total_permisos
    FROM roles r
    LEFT JOIN rol_permiso rp ON rp.rol_id = r.id_rol
    WHERE r.nombre ILIKE $1 OR r.descripcion ILIKE $1
    GROUP BY r.id_rol
    ORDER BY r.id_rol
  `,

  // Detalle de un rol con sus permisos completos
  FIND_BY_ID: `
    SELECT
      r.id_rol,
      r.nombre,
      r.descripcion,
      r.estado,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id_permiso',  p.id_permiso,
            'nombre',      p.nombre,
            'descripcion', p.descripcion,
            'estado',      p.estado
          ) ORDER BY p.id_permiso
        ) FILTER (WHERE p.id_permiso IS NOT NULL),
        '[]'
      ) AS permisos
    FROM roles r
    LEFT JOIN rol_permiso rp ON rp.rol_id = r.id_rol
    LEFT JOIN permisos    p  ON p.id_permiso = rp.permiso_id
    WHERE r.id_rol = $1
    GROUP BY r.id_rol
  `,

  // Crear rol
  CREATE: `
    INSERT INTO roles (nombre, descripcion)
    VALUES ($1, $2)
    RETURNING *
  `,

  // Editar rol
  UPDATE: `
    UPDATE roles
    SET nombre = $1, descripcion = $2
    WHERE id_rol = $3
    RETURNING *
  `,

  // Cambiar estado ACTIVO/INACTIVO
  TOGGLE_ESTADO: `
    UPDATE roles
    SET estado = CASE WHEN estado = 'ACTIVO' THEN 'INACTIVO' ELSE 'ACTIVO' END
    WHERE id_rol = $1
    RETURNING *
  `,

  // Eliminar rol (solo si no tiene usuarios asignados)
  DELETE: `
    DELETE FROM roles WHERE id_rol = $1
  `,

  // Verificar si el rol tiene usuarios
  HAS_USUARIOS: `
    SELECT COUNT(*) AS total FROM usuarios WHERE rol_id = $1
  `,

  // Verificar nombre duplicado
  NOMBRE_EXISTS: `
    SELECT id_rol FROM roles
    WHERE LOWER(nombre) = LOWER($1) AND id_rol != $2
  `,
};

export const PERMISOS_QUERIES = {

  // ── Permisos ──────────────────────────────────────────────────────────

  // Listar todos los permisos
  LIST: `
    SELECT id_permiso, nombre, descripcion, estado
    FROM permisos
    ORDER BY id_permiso
  `,

  // Buscar permisos por nombre
  SEARCH: `
    SELECT id_permiso, nombre, descripcion, estado
    FROM permisos
    WHERE nombre ILIKE $1 OR descripcion ILIKE $1
    ORDER BY id_permiso
  `,

  // Detalle de un permiso
  FIND_BY_ID: `
    SELECT id_permiso, nombre, descripcion, estado
    FROM permisos
    WHERE id_permiso = $1
  `,

  // Crear permiso
  CREATE: `
    INSERT INTO permisos (nombre, descripcion)
    VALUES ($1, $2)
    RETURNING *
  `,

  // Editar permiso
  UPDATE: `
    UPDATE permisos
    SET nombre = $1, descripcion = $2
    WHERE id_permiso = $3
    RETURNING *
  `,

  // Cambiar estado
  TOGGLE_ESTADO: `
    UPDATE permisos
    SET estado = CASE WHEN estado = 'ACTIVO' THEN 'INACTIVO' ELSE 'ACTIVO' END
    WHERE id_permiso = $1
    RETURNING *
  `,

  // Eliminar permiso
  DELETE: `
    DELETE FROM permisos WHERE id_permiso = $1
  `,

  // ── Relación rol ↔ permiso ─────────────────────────────────────────────

  // Permisos ya asignados a un rol
  GET_BY_ROL: `
    SELECT p.id_permiso, p.nombre, p.descripcion, p.estado
    FROM permisos p
    JOIN rol_permiso rp ON rp.permiso_id = p.id_permiso
    WHERE rp.rol_id = $1
    ORDER BY p.id_permiso
  `,

  // Permisos disponibles (no asignados aún a ese rol)
  GET_DISPONIBLES: `
    SELECT p.id_permiso, p.nombre, p.descripcion, p.estado
    FROM permisos p
    WHERE p.estado = 'ACTIVO'
      AND p.id_permiso NOT IN (
        SELECT permiso_id FROM rol_permiso WHERE rol_id = $1
      )
    ORDER BY p.id_permiso
  `,

  // Agregar permiso a un rol
  AGREGAR_A_ROL: `
    INSERT INTO rol_permiso (rol_id, permiso_id)
    VALUES ($1, $2)
    ON CONFLICT (rol_id, permiso_id) DO NOTHING
    RETURNING *
  `,

  // Quitar permiso de un rol
  QUITAR_DE_ROL: `
    DELETE FROM rol_permiso
    WHERE rol_id = $1 AND permiso_id = $2
  `,

  // Verificar si ya está asignado
  YA_ASIGNADO: `
    SELECT 1 FROM rol_permiso
    WHERE rol_id = $1 AND permiso_id = $2
  `,
};