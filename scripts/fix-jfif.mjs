// fix-jfif.mjs — actualiza en la BD las rutas .jfif → .jpg
import pool from './src/config/db.js';

const { rows } = await pool.query(
  `UPDATE productos
   SET imagen = REPLACE(imagen, '.jfif', '.jpg')
   WHERE imagen LIKE '%.jfif%'
   RETURNING id_producto, nombre, imagen`
);

if (rows.length === 0) {
  console.log('No se encontraron productos con imagen .jfif');
} else {
  console.log(`Actualizados ${rows.length} producto(s):`);
  rows.forEach((r) => console.log(`  [${r.id_producto}] ${r.nombre} → ${r.imagen}`));
}

await pool.end();
