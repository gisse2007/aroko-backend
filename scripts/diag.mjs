import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 1. Pedidos en tabla pedidos
const r1 = await pool.query(`SELECT id_pedido, numero_pedido, cliente_id, estado, total, created_by FROM pedidos ORDER BY id_pedido DESC LIMIT 10`);
console.log('=== TABLA pedidos ===', r1.rows.length, 'registros');
console.log(JSON.stringify(r1.rows, null, 2));

// 2. Orders en tabla orders
const r2 = await pool.query(`SELECT id, user_id, total, status, pedido_id, created_at FROM orders ORDER BY id DESC LIMIT 10`);
console.log('\n=== TABLA orders ===', r2.rows.length, 'registros');
console.log(JSON.stringify(r2.rows, null, 2));

// 3. Ver si columna pedido_id existe en orders
const r3 = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'orders' AND column_name = 'pedido_id'
`);
console.log('\n=== columna pedido_id en orders ===', r3.rows.length > 0 ? 'EXISTE' : 'NO EXISTE');

// 4. Ver cliente del user_id 6
const r4 = await pool.query(`SELECT id_cliente, nombre, usuario_id FROM clientes WHERE usuario_id = 6`);
console.log('\n=== cliente del user_id 6 ===');
console.log(JSON.stringify(r4.rows, null, 2));

// 5. Ver empleados administradores
const r5 = await pool.query(`
  SELECT e.id_empleado, e.nombre FROM empleados e
  JOIN usuarios u ON u.id_usuario = e.usuario_id
  JOIN roles r ON r.id_rol = u.rol_id
  WHERE r.nombre = 'Administrador' AND u.estado = 'ACTIVO'
  LIMIT 3
`);
console.log('\n=== empleados administradores ===');
console.log(JSON.stringify(r5.rows, null, 2));

await pool.end();
