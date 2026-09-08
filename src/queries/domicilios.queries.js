export const DOMICILIOS_QUERIES = {

  LIST: `
    SELECT
      d.id_domicilio,
      d.venta_id,
      v.id_venta,
      d.cliente_id,
      c.nombre AS cliente_nombre,
      d.empleado_id,
      e.nombre AS empleado_nombre,
      d.barrio,
      d.direccion,
      d.referencias,
      d.estado,
      d.created_at,
      d.updated_at
    FROM domicilios d
    LEFT JOIN ventas v
      ON v.id_venta = d.venta_id
    LEFT JOIN clientes c
      ON c.id_cliente = d.cliente_id
    LEFT JOIN empleados e
      ON e.id_empleado = d.empleado_id
    ORDER BY d.id_domicilio DESC
  `,


  SEARCH: `
    SELECT
      d.id_domicilio,
      d.venta_id,
      d.cliente_id,
      c.nombre AS cliente_nombre,
      d.empleado_id,
      e.nombre AS empleado_nombre,
      d.barrio,
      d.direccion,
      d.referencias,
      d.estado,
      d.created_at,
      d.updated_at
    FROM domicilios d
    LEFT JOIN clientes c
      ON c.id_cliente=d.cliente_id
    LEFT JOIN empleados e
      ON e.id_empleado=d.empleado_id
    WHERE
      c.nombre ILIKE $1
      OR d.direccion ILIKE $1
      OR d.barrio ILIKE $1
      OR CAST(d.id_domicilio AS TEXT)=$2
    ORDER BY d.id_domicilio DESC
  `,


  FILTER_ESTADO: `
    SELECT
      d.id_domicilio,
      d.venta_id,
      d.cliente_id,
      c.nombre AS cliente_nombre,
      d.empleado_id,
      e.nombre AS empleado_nombre,
      d.barrio,
      d.direccion,
      d.referencias,
      d.estado,
      d.created_at,
      d.updated_at
    FROM domicilios d
    LEFT JOIN clientes c
      ON c.id_cliente=d.cliente_id
    LEFT JOIN empleados e
      ON e.id_empleado=d.empleado_id
    WHERE d.estado=$1
    ORDER BY d.id_domicilio DESC
  `,


  FIND_BY_ID: `
    SELECT
      d.id_domicilio,
      d.venta_id,
      d.cliente_id,
      c.nombre AS cliente_nombre,
      d.empleado_id,
      e.nombre AS empleado_nombre,
      d.barrio,
      d.direccion,
      d.referencias,
      d.estado,
      d.created_at,
      d.updated_at
    FROM domicilios d
    LEFT JOIN clientes c
      ON c.id_cliente=d.cliente_id
    LEFT JOIN empleados e
      ON e.id_empleado=d.empleado_id
    WHERE d.id_domicilio=$1
  `,


  CREATE: `
    INSERT INTO domicilios(
      venta_id,
      cliente_id,
      empleado_id,
      barrio,
      direccion,
      referencias
    )
    VALUES($1,$2,$3,$4,$5,$6)
    RETURNING *
  `,


  UPDATE: `
    UPDATE domicilios
    SET
      venta_id=$1,
      cliente_id=$2,
      empleado_id=$3,
      barrio=$4,
      direccion=$5,
      referencias=$6,
      updated_at=NOW()
    WHERE id_domicilio=$7
    RETURNING *
  `,


  CAMBIAR_ESTADO: `
    UPDATE domicilios
    SET
      estado=$1,
      updated_at=NOW()
    WHERE id_domicilio=$2
    RETURNING
      id_domicilio,
      venta_id,
      cliente_id,
      empleado_id,
      barrio,
      direccion,
      referencias,
      estado,
      created_at,
      updated_at
  `,


  CANCELAR: `
    UPDATE domicilios
    SET 
      estado='CANCELADO',
      updated_at=NOW()
    WHERE id_domicilio=$1
    RETURNING *
  `,
  
  OBTENER_CORREO: `
    SELECT
      c.nombre,
      c.email,
      d.direccion,
      d.barrio,
      d.referencias,
      d.estado
    FROM domicilios d
    INNER JOIN clientes c
      ON c.id_cliente = d.cliente_id
    WHERE d.id_domicilio = $1
  `
};

