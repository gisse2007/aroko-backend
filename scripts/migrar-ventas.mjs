// migrar-ventas.mjs
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    // Orders que ya tienen pedido_id pero NO tienen venta creada
    const { rows: orders } = await client.query(`
      SELECT o.id, o.pedido_id, o.payment_type, o.paid_amount,
             p.cliente_id, p.empleado_id, p.total
      FROM orders o
      JOIN pedidos p ON p.id_pedido = o.pedido_id
      WHERE NOT EXISTS (SELECT 1 FROM ventas v WHERE v.pedido_id = o.pedido_id)
    `);

    console.log(`Orders sin venta: ${orders.length}`);
    if (orders.length === 0) { console.log('Nada que migrar.'); return; }

    for (const o of orders) {
      await client.query('BEGIN');

      // Siguiente numero_venta
      const { rows: nv } = await client.query(`
        SELECT COALESCE(
          'VTA-' || LPAD((CAST(SUBSTRING(MAX(numero_venta) FROM 5) AS INT) + 1)::TEXT, 3, '0'),
          'VTA-001'
        ) AS numero_venta
        FROM ventas WHERE numero_venta IS NOT NULL
      `);
      const numero_venta = nv[0].numero_venta;
      const total        = parseFloat(o.total);
      const paid_amount  = parseFloat(o.paid_amount ?? total);
      const payment_type = o.payment_type ?? 'COMPLETO';

      // Crear venta
      const { rows: vr } = await client.query(
        `INSERT INTO ventas (numero_venta, pedido_id, cliente_id, empleado_id, fecha, total, abonado, estado)
         VALUES ($1, $2, $3, $4, NOW(), $5, 0, 'REGISTRADA') RETURNING id_venta`,
        [numero_venta, o.pedido_id, o.cliente_id, o.empleado_id, total]
      );
      const venta_id = vr[0].id_venta;

      // Detalle desde detalle_pedido
      const { rows: det } = await client.query(
        `SELECT producto_id, cantidad, precio, subtotal FROM detalle_pedido WHERE pedido_id = $1`,
        [o.pedido_id]
      );
      for (const d of det) {
        await client.query(
          `INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio, subtotal) VALUES ($1,$2,$3,$4,$5)`,
          [venta_id, d.producto_id, d.cantidad, d.precio, d.subtotal]
        );
      }

      if (payment_type === 'COMPLETO') {
        // Marcar pagada al 100%
        await client.query(`UPDATE ventas SET abonado = $1 WHERE id_venta = $2`, [total, venta_id]);
        console.log(`  ✔ order #${o.id} → ${numero_venta} (COMPLETO, saldo=0)`);
      } else {
        // Registrar primera cuota
        await client.query(
          `INSERT INTO abonos (venta_id, empleado_id, numero_cuota, valor, metodo_pago, estado)
           VALUES ($1, $2, 1, $3, 'Transferencia', 'REGISTRADO')`,
          [venta_id, o.empleado_id, paid_amount]
        );
        await client.query(`UPDATE ventas SET abonado = $1 WHERE id_venta = $2`, [paid_amount, venta_id]);
        console.log(`  ✔ order #${o.id} → ${numero_venta} (ABONO, cuota 1 = $${paid_amount})`);
      }

      await client.query('COMMIT');
    }

    // Verificar resultado
    const { rows: result } = await client.query(
      `SELECT v.id_venta, v.numero_venta, v.total, v.abonado, v.saldo,
              (SELECT COUNT(*) FROM abonos a WHERE a.venta_id = v.id_venta) AS cuotas
       FROM ventas v ORDER BY v.id_venta`
    );
    console.log('\nVentas creadas:');
    console.table(result);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
