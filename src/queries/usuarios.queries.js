// src/queries/usuarios.queries.js

export const USUARIOS_QUERIES = {

  // Migraciones: agregar columnas extras a usuarios
  MIGRATE: `
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre_usuario VARCHAR(100);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono       VARCHAR(20);
  `,

  LIST: `
    SELECT
      u.id_usuario,
      u.correo,
      u.nombre_usuario,
      u.telefono,
      u.rol_id,
      r.nombre  AS rol_nombre,
      u.estado,
      u.created_at,
      e.id_empleado,
      e.nombre  AS empleado_nombre
    FROM usuarios u
    JOIN roles    r ON r.id_rol     = u.rol_id
    LEFT JOIN empleados e ON e.usuario_id = u.id_usuario
    ORDER BY u.id_usuario
  `,

  SEARCH: `
    SELECT
      u.id_usuario,
      u.correo,
      u.nombre_usuario,
      u.telefono,
      u.rol_id,
      r.nombre  AS rol_nombre,
      u.estado,
      u.created_at,
      e.id_empleado,
      e.nombre  AS empleado_nombre
    FROM usuarios u
    JOIN roles    r ON r.id_rol     = u.rol_id
    LEFT JOIN empleados e ON e.usuario_id = u.id_usuario
    WHERE (u.correo ILIKE $1 OR r.nombre ILIKE $1 OR u.nombre_usuario ILIKE $1)
    ORDER BY u.id_usuario
  `,

  // Filtrado por estado (evita filtrado en JS)
  FILTER_ESTADO: `
    SELECT
      u.id_usuario,
      u.correo,
      u.nombre_usuario,
      u.telefono,
      u.rol_id,
      r.nombre  AS rol_nombre,
      u.estado,
      u.created_at,
      e.id_empleado,
      e.nombre  AS empleado_nombre
    FROM usuarios u
    JOIN roles    r ON r.id_rol     = u.rol_id
    LEFT JOIN empleados e ON e.usuario_id = u.id_usuario
    WHERE u.estado = $1
    ORDER BY u.id_usuario
  `,

  // Filtrado por rol_id (evita filtrado en JS)
  FILTER_ROL: `
    SELECT
      u.id_usuario,
      u.correo,
      u.nombre_usuario,
      u.telefono,
      u.rol_id,
      r.nombre  AS rol_nombre,
      u.estado,
      u.created_at,
      e.id_empleado,
      e.nombre  AS empleado_nombre
    FROM usuarios u
    JOIN roles    r ON r.id_rol     = u.rol_id
    LEFT JOIN empleados e ON e.usuario_id = u.id_usuario
    WHERE u.rol_id = $1
    ORDER BY u.id_usuario
  `,

  // Filtrado combinado estado + rol
  FILTER_ESTADO_ROL: `
    SELECT
      u.id_usuario,
      u.correo,
      u.nombre_usuario,
      u.telefono,
      u.rol_id,
      r.nombre  AS rol_nombre,
      u.estado,
      u.created_at,
      e.id_empleado,
      e.nombre  AS empleado_nombre
    FROM usuarios u
    JOIN roles    r ON r.id_rol     = u.rol_id
    LEFT JOIN empleados e ON e.usuario_id = u.id_usuario
    WHERE u.estado = $1 AND u.rol_id = $2
    ORDER BY u.id_usuario
  `,

  FIND_BY_ID: `
    SELECT
      u.id_usuario,
      u.correo,
      u.nombre_usuario,
      u.telefono,
      u.rol_id,
      r.nombre  AS rol_nombre,
      u.estado,
      u.created_at,
      e.id_empleado,
      e.nombre  AS empleado_nombre
    FROM usuarios u
    JOIN roles    r ON r.id_rol     = u.rol_id
    LEFT JOIN empleados e ON e.usuario_id = u.id_usuario
    WHERE u.id_usuario = $1
  `,

  CORREO_EXISTS: `
    SELECT id_usuario FROM usuarios
    WHERE LOWER(correo) = LOWER($1) AND id_usuario != $2 AND estado = 'ACTIVO'
  `,

  // $1 correo $2 hash $3 rol_id $4 nombre_usuario $5 telefono
  CREATE: `
    INSERT INTO usuarios (correo, contrasena, rol_id, nombre_usuario, telefono)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id_usuario, correo, nombre_usuario, telefono, rol_id, estado, created_at
  `,

  // $1 correo $2 rol_id $3 nombre_usuario $4 telefono $5 estado $6 id
  UPDATE: `
    UPDATE usuarios
    SET correo = $1, rol_id = $2, nombre_usuario = $3, telefono = $4, estado = $5
    WHERE id_usuario = $6
    RETURNING id_usuario, correo, nombre_usuario, telefono, rol_id, estado, created_at
  `,

  // $1 correo $2 rol_id $3 nombre_usuario $4 telefono $5 estado $6 hash $7 id
  UPDATE_WITH_PASSWORD: `
    UPDATE usuarios
    SET correo = $1, rol_id = $2, nombre_usuario = $3, telefono = $4, estado = $5, contrasena = $6
    WHERE id_usuario = $7
    RETURNING id_usuario, correo, nombre_usuario, telefono, rol_id, estado, created_at
  `,

  TOGGLE_ESTADO: `
    UPDATE usuarios
    SET estado = CASE WHEN estado = 'ACTIVO' THEN 'INACTIVO' ELSE 'ACTIVO' END
    WHERE id_usuario = $1
    RETURNING id_usuario, correo, rol_id, estado
  `,

  SOFT_DELETE: `
    UPDATE usuarios SET estado = 'INACTIVO'
    WHERE id_usuario = $1
    RETURNING id_usuario, correo, estado
  `,
};

export const EMPLEADOS_QUERIES = {

  ADD_CREADO_POR_ID: `
    ALTER TABLE empleados
      ADD COLUMN IF NOT EXISTS creado_por_id INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

    INSERT INTO empleados (usuario_id, creado_por_id, nombre, documento, telefono, email, estado)
    SELECT u.id_usuario, u.id_usuario,
           COALESCE(u.nombre_usuario, u.correo),
           'USR-' || u.id_usuario,
           u.telefono, u.correo, u.estado
    FROM usuarios u
    LEFT JOIN roles r ON r.id_rol = u.rol_id
    LEFT JOIN empleados e ON e.usuario_id = u.id_usuario
    WHERE r.id_rol = 1 AND e.id_empleado IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM empleados existente
        WHERE existente.documento = 'USR-' || u.id_usuario
      );
  `,

  ADD_TIPO_DOCUMENTO: `
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20) DEFAULT 'CC';
  `,

  // Migraciones: campos extras del empleado
  MIGRATE: `
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS cargo        VARCHAR(100);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS area         VARCHAR(100);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS direccion    VARCHAR(150);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS email        VARCHAR(100);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS salario      NUMERIC(12,2);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;
  `,

  LIST: `
    SELECT
      e.id_empleado,
      e.usuario_id,
      e.creado_por_id,
      u.correo      AS usuario_correo,
      e.nombre,
      e.tipo_documento,
      e.documento,
      e.telefono,
      e.cargo,
      e.area,
      e.direccion,
      e.email,
      e.salario,
      e.fecha_ingreso,
      e.estado,
      u.rol_id,
      r.nombre AS rol_nombre,
      r.descripcion AS rol_descripcion
    FROM empleados e
    LEFT JOIN usuarios u ON e.usuario_id = u.id_usuario
    LEFT JOIN roles r ON r.id_rol = u.rol_id
    ORDER BY e.id_empleado
  `,

  SEARCH: `
    SELECT
      e.id_empleado,
      e.usuario_id,
      e.creado_por_id,
      u.correo      AS usuario_correo,
      e.nombre,
      e.tipo_documento,
      e.documento,
      e.telefono,
      e.cargo,
      e.area,
      e.direccion,
      e.email,
      e.salario,
      e.fecha_ingreso,
      e.estado,
      u.rol_id,
      r.nombre AS rol_nombre,
      r.descripcion AS rol_descripcion
    FROM empleados e
    LEFT JOIN usuarios u ON e.usuario_id = u.id_usuario
    LEFT JOIN roles r ON r.id_rol = u.rol_id
    WHERE (e.nombre ILIKE $1 OR e.documento ILIKE $1 OR u.correo ILIKE $1
          OR u.nombre_usuario ILIKE $1 OR e.cargo ILIKE $1 OR r.nombre ILIKE $1)
    ORDER BY e.id_empleado
  `,

  FILTER_ESTADO: `
    SELECT
      e.id_empleado,
      e.usuario_id,
      e.creado_por_id,
      u.correo      AS usuario_correo,
      e.nombre,
      e.tipo_documento,
      e.documento,
      e.telefono,
      e.cargo,
      e.area,
      e.direccion,
      e.email,
      e.salario,
      e.fecha_ingreso,
      e.estado,
      u.rol_id,
      r.nombre AS rol_nombre,
      r.descripcion AS rol_descripcion
    FROM empleados e
    LEFT JOIN usuarios u ON e.usuario_id = u.id_usuario
    LEFT JOIN roles r ON r.id_rol = u.rol_id
    WHERE e.estado = $1
    ORDER BY e.id_empleado
  `,

  FIND_BY_ID: `
    SELECT
      e.id_empleado,
      e.usuario_id,
      e.creado_por_id,
      e.nombre,
      e.tipo_documento,
      e.documento,
      e.telefono,
      e.cargo,
      e.area,
      e.direccion,
      e.email,
      e.salario,
      e.fecha_ingreso,
      e.estado,
      CASE
        WHEN u.id_usuario IS NOT NULL THEN
          JSONB_BUILD_OBJECT(
            'id_usuario', u.id_usuario,
            'correo', u.correo,
            'nombre_usuario', u.nombre_usuario,
            'telefono', u.telefono,
            'rol_id', u.rol_id,
            'rol_nombre', r.nombre,
            'rol_descripcion', r.descripcion
          )
        ELSE NULL
      END AS usuario,
      COALESCE(
        JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(
          'id_permiso', p.id_permiso,
          'nombre', p.nombre,
          'descripcion', p.descripcion,
          'estado', p.estado
        )) FILTER (WHERE p.id_permiso IS NOT NULL),
        '[]'::jsonb
      ) AS permisos
    FROM empleados e
    LEFT JOIN usuarios u ON u.id_usuario = e.usuario_id
    LEFT JOIN roles r ON r.id_rol = u.rol_id
    LEFT JOIN rol_permiso rp ON rp.rol_id = u.rol_id
    LEFT JOIN permisos p ON p.id_permiso = rp.permiso_id
    WHERE e.id_empleado = $1
    GROUP BY
      e.id_empleado,
      u.id_usuario,
      u.correo,
      u.nombre_usuario,
      u.telefono,
      u.rol_id,
      r.nombre,
      r.descripcion
  `,

  DOCUMENTO_EXISTS: `
    SELECT id_empleado FROM empleados
    WHERE documento = $1 AND id_empleado != $2
  `,

  USUARIO_ASIGNADO: `
    SELECT id_empleado FROM empleados
    WHERE usuario_id = $1 AND id_empleado != $2
  `,

  // Para el select: todos los usuarios activos (incluye el ya asignado al editar)
  USUARIOS_DISPONIBLES: `
    SELECT u.id_usuario, u.correo, u.nombre_usuario, r.nombre AS rol_nombre
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.rol_id
    WHERE u.estado = 'ACTIVO'
      AND r.nombre <> 'Cliente'
      AND u.id_usuario NOT IN (
        SELECT usuario_id FROM empleados WHERE usuario_id IS NOT NULL
      )
    ORDER BY u.correo
  `,

  // $1 usuario_id $2 creado_por_id $3 nombre $4 tipo_doc $5 doc $6 tel $7 cargo $8 area $9 dir $10 email $11 salario $12 fecha_ingreso
  CREATE: `
    INSERT INTO empleados
      (usuario_id, creado_por_id, nombre, tipo_documento, documento, telefono,
       cargo, area, direccion, email, salario, fecha_ingreso)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *
  `,

  CREATE_ADMIN_EMPLOYEE: `
    INSERT INTO empleados
      (usuario_id, creado_por_id, nombre, documento, telefono, email, estado)
    VALUES ($1, $1, $2, $3, $4, $5, $6)
    RETURNING *
  `,

  UPDATE: `
    UPDATE empleados
    SET usuario_id=$1, nombre=$2, tipo_documento=$3, documento=$4, telefono=$5,
        cargo=$6, area=$7, direccion=$8, email=$9, salario=$10, fecha_ingreso=$11
    WHERE id_empleado=$12
    RETURNING *
  `,

  TOGGLE_ESTADO: `
    UPDATE empleados
    SET estado = CASE WHEN estado = 'ACTIVO' THEN 'INACTIVO' ELSE 'ACTIVO' END
    WHERE id_empleado = $1
    RETURNING *
  `,

  SOFT_DELETE: `
    UPDATE empleados SET estado = 'INACTIVO'
    WHERE id_empleado = $1
    RETURNING id_empleado, nombre, estado
  `,
};