// src/services/productos.service.js
import pool from '../config/db.js';
import { PRODUCTOS_QUERIES } from '../queries/productos.queries.js';

const ORDER_MAP = {
  recientes:    'p.id_producto DESC',
  precio_asc:   'p.precio ASC',
  precio_desc:  'p.precio DESC',
  mas_vendidos: 'p.precio DESC',
};

/**
 * Construye la URL pública de una imagen de producto.
 * Soporta múltiples rutas separadas por '|'.
 * Devuelve un array de URLs absolutas (o null si no hay imagen).
 */
export function buildImageUrl(imagen) {
  if (!imagen) return null;
  const base = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const rutas = imagen.split('|').map((r) => r.trim()).filter(Boolean);
  const urls = rutas.map((r) => {
    if (/^https?:\/\//i.test(r)) return r;
    return `${base}${r.startsWith('/') ? r : `/${r}`}`;
  });
  // compatibilidad: si solo hay 1 imagen devuelve string, si hay más devuelve array
  return urls.length === 1 ? urls[0] : urls.length > 1 ? urls : null;
}

/**
 * Normaliza el campo imagen: siempre lo convierte a array de URLs.
 */
export function buildImageArray(imagen) {
  if (!imagen) return [];
  const base = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const rutas = imagen.split('|').map((r) => r.trim()).filter(Boolean);
  return rutas.map((r) => {
    if (/^https?:\/\//i.test(r)) return r;
    return `${base}${r.startsWith('/') ? r : `/${r}`}`;
  });
}

/**
 * Normaliza los campos de imagen en un array de productos.
 * Agrega 'imagenes' como array de URLs además de mantener 'imagen' (primera URL).
 */
export function normalizarImagenes(productos) {
  return productos.map((p) => {
    const imgs = buildImageArray(p.imagen);
    return {
      ...p,
      imagen:   imgs[0] || null,
      imagenes: imgs,
    };
  });
}

/**
 * Búsqueda paginada de productos activos para el catálogo público.
 */
export async function buscarProductosPaginados({ q, categoriaId, orderBy, page, limit }) {
  const orderClause = ORDER_MAP[orderBy] ?? ORDER_MAP.recientes;
  const offset      = (page - 1) * limit;
  const termino     = q ? `%${q}%` : null;
  const categoriaQ  = categoriaId ?? null;

  const [{ rows: rawProducts }, { rows: countRows }] = await Promise.all([
    pool.query(PRODUCTOS_QUERIES.SEARCH_PAGINATED(orderClause), [termino, categoriaQ, limit, offset]),
    pool.query(PRODUCTOS_QUERIES.SEARCH_PAGINATED_COUNT,        [termino, categoriaQ]),
  ]);

  const products      = normalizarImagenes(rawProducts);
  const totalProducts = parseInt(countRows[0].total, 10);
  const totalPages    = Math.ceil(totalProducts / limit) || 1;

  return {
    products,
    pagination: {
      totalProducts,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
