// diagnostico.mjs — ejecutar con: node diagnostico.mjs
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n===== 1. ORDERS EN BD =====');
    const { rows: orders } = await client.query(
      `SELECT id, user_id, total, status, pedido_id, created_at FROM orders ORDER BY id`
    );
    console.table(orders);

    console.log('\n===== 2. PEDIDOS ORD- EN BD =====');
    const { rows: pedidos } = await client.query(
      `SELECT id_pedido, numero_pedido, cliente_id, empleado_id, estado, total FROM pedidos WHERE numero_pedido LIKE 'ORD-%' ORDER BY id_pedido`
    );
    console.table(pedidos);

    console.log('\n===== 3. CLIENTES CON USUARIO_ID =====');
    const { rows: clientes } = await client.query(
      `SELECT id_cliente, usuario_id, nombre FROM clientes WHERE usuario_id IS NOT NULL ORDER BY id_cliente`
    );
    console.table(clientes);

    console.log('\n===== 4. PRIMER EMPLEADO ACTIVO =====');
    const { rows: emp } = await client.query(`
      SELECT e.id_empleado, e.nombre, r.nombre AS rol FROM empleados e
      JOIN usuarios u ON u.id_usuario = e.usuario_id
      JOIN roles r    ON r.id_rol     = u.rol_id
      WHERE u.estado = 'ACTIVO'
      ORDER BY CASE WHEN r.nombre = 'Administrador' THEN 0 ELSE 1 END, e.id_empleado
      LIMIT 1
    `);
    console.table(emp);

    console.log('\n===== 5. ORDERS SIN ESPEJO EN PEDIDOS (pedido_id IS NULL) =====');
    const { rows: sinEspejo } = await client.query(
      `SELECT id, user_id, total, status, created_at FROM orders WHERE pedido_id IS NULL ORDER BY id`
    );
    console.table(sinEspejo);

    if (sinEspejo.length === 0) {
      console.log('✔ Todas las orders ya tienen espejo en pedidos.');
      return;
    }

    console.log(`\n→ Hay ${sinEspejo.length} order(s) sin espejo. ¿Deseas migrarlas ahora? (ejecuta con --migrar para hacerlo)`);

    if (!process.argv.includes('--migrar')) return;

    console.log('\n===== MIGRANDO =====');

    if (emp.length === 0) {
      console.error('✖ No hay empleados activos. Agrega un empleado primero.');
      return;
    }
    const empleado_id = emp[0].id_empleado;

    for (const order of sinEspejo) {
      // Buscar cliente asociado al user_id
      const { rows: cliRows } = await client.query(
        `SELECT id_cliente FROM clientes WHERE usuario_id = $1 LIMIT 1`, [order.user_id]
      );
      if (cliRows.length === 0) {
        console.warn(`  ⚠ order #${order.id}: user_id ${order.user_id} sin cliente asociado — omitida.`);
        continue;
      }
      const cliente_id = cliRows[0].id_cliente;

      // Siguiente número ORD-
      const { rows: numRows } = await client.query(`
        SELECT COALESCE(
          'ORD-' || LPAD((CAST(SUBSTRING(MAX(numero_pedido) FROM 5) AS INT) + 1)::TEXT, 3, '0'),
          'ORD-001'
        ) AS numero_pedido
        FROM pedidos WHERE numero_pedido LIKE 'ORD-%'
      `);
      const numeroPedido = numRows[0].numero_pedido;

      await client.query('BEGIN');
      try {
        // Insertar pedido espejo
        const { rows: pedRows } = await client.query(`
          INSERT INTO pedidos (cliente_id, empleado_id, numero_pedido, fecha_entrega, observaciones, created_by, estado, total)
          VALUES ($1, $2, $3, NULL, $4, 'Catálogo online', 'ACTIVO', $5)
          RETURNING id_pedido
        `, [cliente_id, empleado_id, numeroPedido, `Orden catálogo #${order.id}`, order.total]);

        const pedido_id = pedRows[0].id_pedido;

        // Insertar detalle desde order_items
        const { rows: items } = await client.query(
          `SELECT product_id, quantity, price, subtotal FROM order_items WHERE order_id = $1`, [order.id]
        );
        for (const item of items) {
          await client.query(
            `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio, subtotal) VALUES ($1,$2,$3,$4,$5)`,
            [pedido_id, item.product_id, item.quantity, item.price, item.subtotal]
          );
        }

        // Vincular order con pedido
        await client.query(`UPDATE orders SET pedido_id = $1 WHERE id = $2`, [pedido_id, order.id]);

        await client.query('COMMIT');
        console.log(`  ✔ order #${order.id} → pedido ${numeroPedido} (id_pedido=${pedido_id})`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✖ order #${order.id} falló: ${err.message}`);
      }
    }

    console.log('\n===== RESULTADO FINAL =====');
    const { rows: final } = await client.query(
      `SELECT id, pedido_id FROM orders ORDER BY id`
    );
    console.table(final);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
