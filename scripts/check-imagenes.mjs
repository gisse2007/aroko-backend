// check-imagenes.mjs
import pool from './src/config/db.js';

const { rows } = await pool.query(
  `SELECT id_producto, nombre, imagen, estado FROM productos ORDER BY id_producto`
);

console.table(rows.map(r => ({ id: r.id_producto, nombre: r.nombre, imagen: r.imagen, estado: r.estado })));
await pool.end();
