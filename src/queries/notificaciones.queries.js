// src/queries/notificaciones.queries.js

export const NOTIFICACIONES_QUERIES = {

  MIGRATE: `
    CREATE TABLE IF NOT EXISTS notificaciones (
      id_notificacion SERIAL PRIMARY KEY,
      usuario_id      INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
      tipo            VARCHAR(30)  NOT NULL DEFAULT 'INFO',
      titulo          VARCHAR(150) NOT NULL,
      mensaje         VARCHAR(300),
      leida           BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMP    DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id, created_at DESC);
  `,

  CREATE: `
    INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `,

  LIST_BY_USUARIO: `
    SELECT id_notificacion, tipo, titulo, mensaje, leida, created_at
    FROM notificaciones
    WHERE usuario_id = $1
    ORDER BY created_at DESC
    LIMIT 30
  `,

  COUNT_NO_LEIDAS: `
    SELECT COUNT(*)::int AS total
    FROM notificaciones
    WHERE usuario_id = $1 AND leida = FALSE
  `,

  MARCAR_LEIDA: `
    UPDATE notificaciones
    SET leida = TRUE
    WHERE id_notificacion = $1 AND usuario_id = $2
    RETURNING *
  `,

  MARCAR_TODAS_LEIDAS: `
    UPDATE notificaciones
    SET leida = TRUE
    WHERE usuario_id = $1 AND leida = FALSE
  `,
};
