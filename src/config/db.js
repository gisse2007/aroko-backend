import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // requerido por Neon
});

pool.on('connect', () => {
  console.log('Conexión a PostgreSQL establecida');
});

pool.on('error', (err) => {
  console.error('Error en el pool de PostgreSQL:', err.message);
});

export default pool;