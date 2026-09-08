// src/middleware/searchParams.middleware.js

const VALID_ORDER = ['recientes', 'precio_asc', 'precio_desc', 'mas_vendidos'];
const DEFAULT_LIMIT = 8;
const MAX_LIMIT     = 50;

/**
 * Valida y normaliza los query params del endpoint de búsqueda.
 * Adjunta `req.searchParams` con los valores ya parseados.
 */
export const validateSearchParams = (req, res, next) => {
  const { q, categoria_id, order_by, page, limit } = req.query;

  // page
  const parsedPage = parseInt(page, 10);
  if (page !== undefined && (isNaN(parsedPage) || parsedPage < 1)) {
    return res.status(400).json({ success: false, message: 'El parámetro page debe ser un entero >= 1.' });
  }

  // limit
  const parsedLimit = parseInt(limit, 10);
  if (limit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_LIMIT)) {
    return res.status(400).json({ success: false, message: `El parámetro limit debe estar entre 1 y ${MAX_LIMIT}.` });
  }

  // categoria_id
  const parsedCat = categoria_id ? parseInt(categoria_id, 10) : null;
  if (categoria_id && isNaN(parsedCat)) {
    return res.status(400).json({ success: false, message: 'El parámetro categoria_id debe ser un entero.' });
  }

  // order_by
  if (order_by && !VALID_ORDER.includes(order_by)) {
    return res.status(400).json({
      success: false,
      message: `order_by inválido. Valores permitidos: ${VALID_ORDER.join(', ')}.`,
    });
  }

  req.searchParams = {
    q:           q?.trim() || null,
    categoriaId: parsedCat,
    orderBy:     order_by || 'recientes',
    page:        parsedPage || 1,
    limit:       parsedLimit || DEFAULT_LIMIT,
  };

  next();
};
