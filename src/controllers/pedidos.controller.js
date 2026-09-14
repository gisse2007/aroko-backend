// src/controllers/pedidos.controller.js

import pool from '../config/db.js';
import { CLIENTES_QUERIES, PEDIDOS_QUERIES } from '../queries/pedidos.queries.js';
import { ORDERS_QUERIES } from '../queries/orders.queries.js';
import { enviarCorreoFechaEntrega } from '../services/email.service.js';

// Estados válidos del frontend mapeados a la BD
const ESTADOS_VALIDOS = [
  'ACTIVO', 'EN_ESPERA_FECHA', 'CON_FECHA_ASIGNADA',
  'ACEPTADO', 'RECHAZADO', 'ENTREGADO', 'INACTIVO',
];

// ══════════════════════════════════════════════
//  CLIENTES
// ══════════════════════════════════════════════

// GET /api/clientes?search=&estado=
export const listarClientes = async (req, res) => {
  const { search } = req.query;
  try {
    const { rows } = search
      ? await pool.query(CLIENTES_QUERIES.SEARCH, [`%${search.trim()}%`])
      : await pool.query(CLIENTES_QUERIES.LIST);

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay clientes registrados.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar clientes:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar clientes.' });
  }
};

// GET /api/clientes/select — para dropdowns de pedidos
export const clientesParaSelect = async (req, res) => {
  try {
    const { rows } = await pool.query(CLIENTES_QUERIES.LIST_SELECT);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al obtener clientes.' });
  }
};

// GET /api/clientes/:id
export const obtenerCliente = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(CLIENTES_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Cliente no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al cargar el cliente.' });
  }
};

// POST /api/clientes
// Body: { nombre, tipo_documento, numero_documento, telefono, email, direccion, usuario_id? }
// Este flujo crea un cliente nuevo y valida que no exista duplicado.
// Se hace una doble revisión: documento y correo. Además, si el cliente
// viene asociado a un usuario con rol Cliente, también se valida esa relación.
export const crearCliente = async (req, res) => {
  const { nombre, tipo_documento = 'CC', numero_documento, telefono, email, direccion, usuario_id } = req.body;

  if (!nombre || !tipo_documento || !numero_documento || !telefono || !email || !direccion) {
    return res.status(400).json({ ok: false, message: 'Todos los campos obligatorios deben completarse.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: dupDoc } = await client.query(CLIENTES_QUERIES.DOCUMENTO_EXISTS, [numero_documento.trim(), 0]);
    if (dupDoc.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'El cliente ya se encuentra registrado.' });
    }

    if (email) {
      const { rows: dupEmail } = await client.query(CLIENTES_QUERIES.EMAIL_EXISTS, [email.trim(), 0]);
      if (dupEmail.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ ok: false, message: 'Ya existe un cliente con ese correo.' });
      }
    }

    // Validar que usuario_id pertenezca a rol Cliente
    let usuarioIdFinal = usuario_id || null;
    if (usuarioIdFinal) {
      const { rows: rolCheck } = await client.query(
        `SELECT u.id_usuario FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id
         WHERE u.id_usuario = $1 AND r.nombre = 'Cliente'`,
        [usuarioIdFinal]
      );
      if (rolCheck.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'El usuario indicado no tiene rol Cliente.' });
      }
      // Verificar que ese usuario no tenga ya un cliente
      const { rows: dupUsr } = await client.query(CLIENTES_QUERIES.FIND_BY_USUARIO_ID, [usuarioIdFinal]);
      if (dupUsr.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ ok: false, message: 'Ese usuario ya tiene un cliente asociado.' });
      }
    }

    // Si hay email y no hay usuario_id, buscar usuario por correo con rol Cliente
    if (!usuarioIdFinal && email) {
      const { rows: uRows } = await client.query(
        `SELECT u.id_usuario FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id
         WHERE LOWER(u.correo) = LOWER($1) AND r.nombre = 'Cliente'`,
        [email.trim()]
      );
      if (uRows.length > 0) usuarioIdFinal = uRows[0].id_usuario;
    }

    const { rows } = await client.query(CLIENTES_QUERIES.CREATE, [
      nombre.trim(),
      tipo_documento,
      numero_documento.trim(),
      (telefono  || '').trim(),
      (email     || '').trim().toLowerCase() || null,
      (direccion || '').trim(),
      usuarioIdFinal,
    ]);

    await client.query('COMMIT');
    return res.status(201).json({ ok: true, message: 'Cliente registrado exitosamente.', data: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear cliente:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar el cliente.' });
  } finally {
    client.release();
  }
};

// PUT /api/clientes/:id
export const editarCliente = async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo_documento = 'CC', numero_documento, telefono, email, direccion } = req.body;

  if (!nombre || !tipo_documento || !numero_documento || !telefono || !email || !direccion) {
    return res.status(400).json({ ok: false, message: 'Todos los campos obligatorios deben completarse.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: dupDoc } = await client.query(CLIENTES_QUERIES.DOCUMENTO_EXISTS, [numero_documento.trim(), id]);
    if (dupDoc.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'Ese documento ya pertenece a otro cliente.' });
    }

    if (email) {
      const { rows: dupEmail } = await client.query(CLIENTES_QUERIES.EMAIL_EXISTS, [email.trim(), id]);
      if (dupEmail.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ ok: false, message: 'Ya existe otro cliente con ese correo.' });
      }
    }

    const emailFinal = (email || '').trim().toLowerCase() || null;

    const { rows } = await client.query(CLIENTES_QUERIES.UPDATE, [
      nombre.trim(),
      tipo_documento,
      numero_documento.trim(),
      (telefono  || '').trim(),
      emailFinal,
      (direccion || '').trim(),
      id,
    ]);

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Cliente no encontrado.' });
    }

    // Si el email cambió, re-sincronizar usuario_id por correo
    if (emailFinal && !rows[0].usuario_id) {
      await client.query(
        `UPDATE clientes c
         SET usuario_id = u.id_usuario
         FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id
         WHERE c.id_cliente = $1
           AND LOWER(u.correo) = LOWER($2)
           AND r.nombre = 'Cliente'`,
        [id, emailFinal]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({ ok: true, message: 'Cliente actualizado correctamente.', data: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al editar cliente:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar el cliente.' });
  } finally {
    client.release();
  }
};

// PATCH /api/clientes/:id/estado
export const cambiarEstadoCliente = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(CLIENTES_QUERIES.TOGGLE_ESTADO, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Cliente no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Estado actualizado correctamente.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al cambiar el estado.' });
  }
};

// DELETE /api/clientes/:id — soft delete
export const eliminarCliente = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(CLIENTES_QUERIES.SOFT_DELETE, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Cliente no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Cliente eliminado correctamente.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al eliminar el cliente.' });
  }
};

// GET /api/clientes/perfil — el propio cliente obtiene su perfil por usuario_id del token
export const obtenerPerfilCliente = async (req, res) => {
  const id_usuario = req.usuario?.id_usuario;
  if (!id_usuario) {
    return res.status(401).json({ ok: false, message: 'Sesión inválida.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id_cliente, usuario_id, nombre, tipo_documento,
              documento, telefono, email, direccion, estado
       FROM clientes WHERE usuario_id = $1`,
      [id_usuario]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Perfil no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al obtener perfil cliente:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar el perfil.' });
  }
};

// PUT /api/clientes/perfil — el propio cliente edita su perfil por usuario_id del token
export const editarPerfilCliente = async (req, res) => {
  const id_usuario = req.usuario?.id_usuario;
  if (!id_usuario) {
    return res.status(401).json({ ok: false, message: 'Sesión inválida.' });
  }

  const { nombre, telefono, direccion, email } = req.body;
  if (!nombre) {
    return res.status(400).json({ ok: false, message: 'El nombre es obligatorio.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: cliRows } = await client.query(
      `SELECT id_cliente FROM clientes WHERE usuario_id = $1`, [id_usuario]
    );
    if (cliRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Perfil no encontrado.' });
    }
    const id_cliente = cliRows[0].id_cliente;

    if (email) {
      const { rows: dupEmail } = await client.query(
        CLIENTES_QUERIES.EMAIL_EXISTS, [email.trim(), id_cliente]
      );
      if (dupEmail.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ ok: false, message: 'Ese correo ya está en uso.' });
      }
    }

    const { rows } = await client.query(
      `UPDATE clientes
       SET nombre = $1, telefono = $2, direccion = $3, email = $4
       WHERE id_cliente = $5
       RETURNING *`,
      [
        nombre.trim(),
        (telefono  || '').trim() || null,
        (direccion || '').trim() || null,
        (email     || '').trim().toLowerCase() || null,
        id_cliente,
      ]
    );

    await client.query('COMMIT');
    return res.status(200).json({ ok: true, message: 'Perfil actualizado correctamente.', data: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al editar perfil cliente:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar el perfil.' });
  } finally {
    client.release();
  }
};

// POST /api/clientes/sincronizar — corrige integridad de datos existentes (solo Administrador)
export const sincronizarClientes = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Desvincular clientes cuyo usuario_id apunta a un rol distinto de Cliente
    const { rowCount: desvinculados } = await client.query(CLIENTES_QUERIES.REMOVE_NON_CLIENTE_ROLE);

    // 2. Vincular clientes huérfanos con usuarios por correo coincidente (solo rol Cliente)
    const { rowCount: vinculados } = await client.query(CLIENTES_QUERIES.SYNC_USUARIO_ID);

    // 3. Eliminar clientes que siguen sin usuario_id y no tienen pedidos
    const { rowCount: eliminados } = await client.query(
      `DELETE FROM clientes
       WHERE usuario_id IS NULL
         AND id_cliente NOT IN (SELECT DISTINCT cliente_id FROM pedidos)`
    );

    // 4. Crear registros de cliente para usuarios con rol Cliente que no tienen cliente
    const { rows: sinCliente } = await client.query(CLIENTES_QUERIES.USUARIOS_CLIENTE_SIN_REGISTRO);
    for (const u of sinCliente) {
      await client.query(
        `INSERT INTO clientes (nombre, documento, email, usuario_id, estado)
         VALUES ($1, $2, $3, $4, 'ACTIVO')
         ON CONFLICT DO NOTHING`,
        [u.nombre_usuario || u.correo, `USR-${u.id_usuario}`, u.correo, u.id_usuario]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({
      ok: true,
      message: 'Sincronización completada.',
      data: { desvinculados, vinculados, eliminados, creados: sinCliente.length },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al sincronizar clientes:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al sincronizar clientes.' });
  } finally {
    client.release();
  }
};

// ══════════════════════════════════════════════
//  PEDIDOS
// ══════════════════════════════════════════════

// GET /api/pedidos?search=&estado=&desde=&hasta=
// Sin parámetros devuelve solo pedidos ACTIVO (Pendientes) para la sección Pedidos del dashboard
export const listarPedidos = async (req, res) => {
  const { search, estado, desde, hasta } = req.query;
  try {
    let rows;

    if (desde && hasta) {
      ({ rows } = await pool.query(PEDIDOS_QUERIES.FILTER_FECHAS, [desde, hasta]));
    } else if (estado) {
      ({ rows } = await pool.query(PEDIDOS_QUERIES.FILTER_ESTADO, [estado.toUpperCase()]));
    } else if (search) {
      ({ rows } = await pool.query(PEDIDOS_QUERIES.SEARCH, [`%${search.trim()}%`]));
    } else {
      ({ rows } = await pool.query(PEDIDOS_QUERIES.LIST_PENDIENTES));
    }

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay pedidos registrados.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar pedidos:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar pedidos.' });
  }
};

// GET /api/pedidos/aceptados — pedidos en estado ACEPTADO para el dropdown de Ventas
export const listarPedidosAceptados = async (req, res) => {
  try {
    const { rows } = await pool.query(PEDIDOS_QUERIES.LIST_ACEPTADOS);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar pedidos aceptados:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar pedidos aceptados.' });
  }
};

// GET /api/pedidos/:id
export const obtenerPedido = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(PEDIDOS_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al cargar el pedido.' });
  }
};

// POST /api/pedidos
// Body: { cliente_id, empleado_id, fecha_entrega, observaciones, origen?, valor_pagado?, detalle[] }
// Cuando origen === 'DASHBOARD': crea el pedido en ACEPTADO y genera la venta automáticamente.
export const crearPedido = async (req, res) => {
  const {
    cliente_id, empleado_id, fecha_entrega,
    observaciones = '', detalle,
    origen = '',
    valor_pagado,
  } = req.body;

  if (!cliente_id || !empleado_id || !detalle) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  const detalleArr = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;
  if (!Array.isArray(detalleArr) || detalleArr.length === 0) {
    return res.status(400).json({ ok: false, message: 'El pedido debe tener al menos un producto.' });
  }

  const esDashboard = origen === 'DASHBOARD';
  const estadoInicial = esDashboard ? 'ACEPTADO' : 'ACTIVO';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Número de pedido
    const { rows: numRows } = await client.query(PEDIDOS_QUERIES.NEXT_NUMERO);
    const numeroPedido = numRows[0].numero_pedido;

    // Total
    const total = detalleArr.reduce((acc, d) => acc + parseFloat(d.precio) * parseFloat(d.cantidad), 0);

    // Nombre del empleado
    const { rows: empRows } = await client.query(
      'SELECT nombre FROM empleados WHERE id_empleado = $1', [empleado_id]
    );
    const createdBy = empRows[0]?.nombre || 'Sistema';

    // Crear pedido con el estado correcto
    const { rows } = await client.query(
      `INSERT INTO pedidos
         (cliente_id, empleado_id, numero_pedido, fecha_entrega, observaciones, created_by, estado, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [cliente_id, empleado_id, numeroPedido, fecha_entrega || null,
       observaciones.trim(), createdBy, estadoInicial, total]
    );
    const pedidoId = rows[0].id_pedido;

    // Insertar detalle del pedido
    for (const item of detalleArr) {
      if (!item.producto_id || !item.cantidad || !item.precio) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'Cada producto debe tener producto_id, cantidad y precio.' });
      }
      const subtotal = parseFloat(item.cantidad) * parseFloat(item.precio);
      await client.query(PEDIDOS_QUERIES.INSERT_DETALLE, [
        pedidoId, item.producto_id,
        parseFloat(item.cantidad), parseFloat(item.precio), subtotal,
      ]);
    }

    // Si viene del Dashboard → crear venta automáticamente
    if (esDashboard) {
      const { VENTAS_QUERIES } = await import('../queries/ventas.queries.js');
      const { PRODUCTOS_QUERIES } = await import('../queries/productos.queries.js');

      // Número de venta
      const { rows: numVtaRows } = await client.query(VENTAS_QUERIES.NEXT_NUMERO);
      const numeroVenta = numVtaRows[0].numero_venta;

      // Abonado inicial (lo que ya pagó)
      const abonadoInicial = valor_pagado ? Math.min(parseFloat(valor_pagado), total) : 0;

      // Crear venta
      const { rows: vtaRows } = await client.query(
        `INSERT INTO ventas (numero_venta, pedido_id, cliente_id, empleado_id, fecha_venta, total, abonado, estado)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6, 'REGISTRADA')
         RETURNING *`,
        [numeroVenta, pedidoId, cliente_id, empleado_id, total, abonadoInicial]
      );
      const ventaId = vtaRows[0].id_venta;

      // Insertar detalle de venta y descontar stock
      for (const item of detalleArr) {
        const subtotal = parseFloat(item.cantidad) * parseFloat(item.precio);
        await client.query(VENTAS_QUERIES.INSERT_DETALLE, [
          ventaId, item.producto_id,
          parseFloat(item.cantidad), parseFloat(item.precio), subtotal,
        ]);
        await client.query(PRODUCTOS_QUERIES.RESTAR_STOCK, [
          parseFloat(item.cantidad), item.producto_id,
        ]);
      }
    }

    await client.query('COMMIT');

    // Enviar correo de fecha de entrega si aplica (pedido mayorista/dashboard con fecha)
    if (fecha_entrega) {
      const { rows: cliInfo } = await pool.query(
        `SELECT c.nombre, c.email FROM clientes c WHERE c.id_cliente = $1`, [cliente_id]
      );
      if (cliInfo[0]?.email) {
        enviarCorreoFechaEntrega({
          correo: cliInfo[0].email,
          nombre: cliInfo[0].nombre,
          fechaEntrega: fecha_entrega,
          numeroPedido: rows[0].numero_pedido,
        }).catch(err => console.error('[email] Error al enviar correo fecha entrega:', err.message));
      }
    }

    const { rows: completo } = await pool.query(PEDIDOS_QUERIES.FIND_BY_ID, [pedidoId]);
    return res.status(201).json({
      ok: true,
      message: esDashboard
        ? 'Pedido registrado y venta generada exitosamente.'
        : 'Pedido registrado exitosamente.',
      data: completo[0],
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear pedido:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar el pedido.' });
  } finally {
    client.release();
  }
};

// PUT /api/pedidos/:id
// Solo editable si no está ENTREGADO ni INACTIVO
export const editarPedido = async (req, res) => {
  const { id } = req.params;
  const { cliente_id, empleado_id, fecha_entrega, observaciones = '', detalle } = req.body;

  if (!cliente_id || !empleado_id || !detalle) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  const detalleArr = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const total = detalleArr.reduce((acc, d) => acc + parseFloat(d.precio) * parseFloat(d.cantidad), 0);

    const { rows } = await client.query(PEDIDOS_QUERIES.UPDATE, [
      cliente_id, empleado_id, fecha_entrega || null,
      observaciones.trim(), total, id,
    ]);

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, message: 'Pedido no encontrado o no editable en su estado actual.' });
    }

    // Reemplazar detalle
    await client.query(PEDIDOS_QUERIES.DELETE_DETALLE, [id]);
    for (const item of detalleArr) {
      const subtotal = parseFloat(item.cantidad) * parseFloat(item.precio);
      await client.query(PEDIDOS_QUERIES.INSERT_DETALLE, [
        id, item.producto_id,
        parseFloat(item.cantidad), parseFloat(item.precio), subtotal,
      ]);
    }

    await client.query('COMMIT');

    // Enviar correo si se asignó o cambió la fecha de entrega
    if (fecha_entrega) {
      const { rows: cliInfo } = await pool.query(
        `SELECT c.nombre, c.email, p.numero_pedido
         FROM clientes c JOIN pedidos p ON p.cliente_id = c.id_cliente
         WHERE p.id_pedido = $1`, [id]
      );
      if (cliInfo[0]?.email) {
        enviarCorreoFechaEntrega({
          correo: cliInfo[0].email,
          nombre: cliInfo[0].nombre,
          fechaEntrega: fecha_entrega,
          numeroPedido: cliInfo[0].numero_pedido,
        }).catch(err => console.error('[email] Error al enviar correo fecha entrega:', err.message));
      }
    }

    const { rows: completo } = await pool.query(PEDIDOS_QUERIES.FIND_BY_ID, [id]);
    return res.status(200).json({ ok: true, message: 'Pedido actualizado correctamente.', data: completo[0] });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al editar pedido:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar el pedido.' });
  } finally {
    client.release();
  }
};

// PATCH /api/pedidos/:id/estado
// Body: { estado } — uno de los 7 estados válidos
export const cambiarEstadoPedido = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!estado || !ESTADOS_VALIDOS.includes(estado.toUpperCase())) {
    return res.status(400).json({
      ok: false,
      message: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`,
    });
  }

  // Mapa inverso: estado pedidos → estado orders
  const ESTADO_MAP_INV = {
    ACTIVO:             'Pendiente',
    ACEPTADO:           'Confirmado',
    CON_FECHA_ASIGNADA: 'En preparación',
    EN_ESPERA_FECHA:    'Enviado',
    ENTREGADO:          'Entregado',
    INACTIVO:           'Cancelado',
    RECHAZADO:          'Cancelado',
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(PEDIDOS_QUERIES.CAMBIAR_ESTADO, [estado.toUpperCase(), id]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
    }

    // Sincronizar en orders si este pedido tiene espejo (numero_pedido LIKE 'ORD-%')
    if (rows[0].numero_pedido?.startsWith('ORD-')) {
      const orderStatus = ESTADO_MAP_INV[estado.toUpperCase()];
      if (orderStatus) {
        await client.query(
          `UPDATE orders SET status = $1 WHERE pedido_id = $2`,
          [orderStatus, id]
        );
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({ ok: true, message: 'Estado del pedido actualizado.', data: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cambiar estado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cambiar el estado del pedido.' });
  } finally {
    client.release();
  }
};

// PATCH /api/pedidos/:id/cancelar → estado INACTIVO
export const cancelarPedido = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(PEDIDOS_QUERIES.CANCELAR, [id]);
    if (rows.length === 0) {
      return res.status(400).json({ ok: false, message: 'Pedido no encontrado o ya finalizado.' });
    }
    return res.status(200).json({ ok: true, message: 'Pedido cancelado correctamente.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al cancelar el pedido.' });
  }
};