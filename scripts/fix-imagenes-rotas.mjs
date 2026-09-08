// fix-imagenes-rotas.mjs — limpia rutas de imagen cuyo archivo no existe en disco
import pool from './src/config/db.js';
import fs from 'fs';
import path from 'path';

const { rows } = await pool.query(
  `SELECT id_producto, nombre, imagen FROM productos WHERE imagen IS NOT NULL`
);

for (const row of rows) {
  const rutas = row.imagen.split('|').map((r) => r.trim()).filter(Boolean);
  const existentes = rutas.filter((ruta) => {
    const abs = path.join(process.cwd(), ruta.replace(/^\//, ''));
    return fs.existsSync(abs);
  });

  if (existentes.length !== rutas.length) {
    const nuevaImagen = existentes.length > 0 ? existentes.join('|') : null;
    await pool.query(
      `UPDATE productos SET imagen = $1 WHERE id_producto = $2`,
      [nuevaImagen, row.id_producto]
    );
    console.log(`[${row.id_producto}] ${row.nombre}:`);
    console.log(`  Antes:  ${row.imagen}`);
    console.log(`  Después: ${nuevaImagen ?? 'null (sin imagen)'}`);
  }
}

console.log('\nListo.');
await pool.end();
