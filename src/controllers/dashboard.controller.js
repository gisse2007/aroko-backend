// src/controllers/dashboard.controller.js

import pool from '../config/db.js';
import { DASHBOARD_QUERIES } from '../queries/dashboard.queries.js';

// ─────────────────────────────────────────────
// Utilidad: calcular variación porcentual
// ─────────────────────────────────────────────
function calcularCambio(actual, anterior) {
  const a = parseFloat(actual)   || 0;
  const b = parseFloat(anterior) || 0;
  if (b === 0) return actual > 0 ? '+100%' : '0%';
  const pct = ((a - b) / b) * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}

// ─────────────────────────────────────────────
// Utilidad: formatear pesos colombianos
// ─────────────────────────────────────────────
function formatCOP(valor) {
  return '$' + Math.round(parseFloat(valor) || 0).toLocaleString('es-CO');
}

// ─────────────────────────────────────────────
// GET /api/dashboard
// Devuelve TODOS los datos del dashboard en una sola llamada
// ─────────────────────────────────────────────
export const getDashboard = async (req, res) => {
  try {
    // Ejecutar todas las queries en paralelo para máxima velocidad
    const [
      // Ventas
      ventasSemana, ventasMes, ventasAno,
      ventasSemanaAnt, ventasMesAnt, ventasAnoAnt,
      // Compras
      comprasSemana, comprasMes, comprasAno,
      comprasSemanaAnt, comprasMesAnt, comprasAnoAnt,
      // Pedidos
      pedidosSemana, pedidosMes, pedidosAno,
      pedidosSemanaAnt, pedidosMesAnt, pedidosAnoAnt,
      // Resto
      topProductos,
      stockBajoProductos, stockBajoInsumos,
      pedidosRecientes,
      resumen,
    ] = await Promise.all([
      pool.query(DASHBOARD_QUERIES.VENTAS_SEMANA),
      pool.query(DASHBOARD_QUERIES.VENTAS_MES),
      pool.query(DASHBOARD_QUERIES.VENTAS_ANO),
      pool.query(DASHBOARD_QUERIES.VENTAS_SEMANA_ANTERIOR),
      pool.query(DASHBOARD_QUERIES.VENTAS_MES_ANTERIOR),
      pool.query(DASHBOARD_QUERIES.VENTAS_ANO_ANTERIOR),

      pool.query(DASHBOARD_QUERIES.COMPRAS_SEMANA),
      pool.query(DASHBOARD_QUERIES.COMPRAS_MES),
      pool.query(DASHBOARD_QUERIES.COMPRAS_ANO),
      pool.query(DASHBOARD_QUERIES.COMPRAS_SEMANA_ANTERIOR),
      pool.query(DASHBOARD_QUERIES.COMPRAS_MES_ANTERIOR),
      pool.query(DASHBOARD_QUERIES.COMPRAS_ANO_ANTERIOR),

      pool.query(DASHBOARD_QUERIES.PEDIDOS_SEMANA),
      pool.query(DASHBOARD_QUERIES.PEDIDOS_MES),
      pool.query(DASHBOARD_QUERIES.PEDIDOS_ANO),
      pool.query(DASHBOARD_QUERIES.PEDIDOS_SEMANA_ANTERIOR),
      pool.query(DASHBOARD_QUERIES.PEDIDOS_MES_ANTERIOR),
      pool.query(DASHBOARD_QUERIES.PEDIDOS_ANO_ANTERIOR),

      pool.query(DASHBOARD_QUERIES.TOP_PRODUCTOS),
      pool.query(DASHBOARD_QUERIES.STOCK_BAJO_PRODUCTOS),
      pool.query(DASHBOARD_QUERIES.STOCK_BAJO_INSUMOS),
      pool.query(DASHBOARD_QUERIES.PEDIDOS_RECIENTES),
      pool.query(DASHBOARD_QUERIES.RESUMEN),
    ]);

    // ── Armar KPI Ventas ─────────────────────────────────────────────────
    const salesData = {
      semana: {
        value:    formatCOP(ventasSemana.rows[0].valor),
        cantidad: parseInt(ventasSemana.rows[0].cantidad),
        change:   calcularCambio(ventasSemana.rows[0].valor, ventasSemanaAnt.rows[0].valor),
      },
      mes: {
        value:    formatCOP(ventasMes.rows[0].valor),
        cantidad: parseInt(ventasMes.rows[0].cantidad),
        change:   calcularCambio(ventasMes.rows[0].valor, ventasMesAnt.rows[0].valor),
      },
      año: {
        value:    formatCOP(ventasAno.rows[0].valor),
        cantidad: parseInt(ventasAno.rows[0].cantidad),
        change:   calcularCambio(ventasAno.rows[0].valor, ventasAnoAnt.rows[0].valor),
      },
    };

    // ── Armar KPI Compras ────────────────────────────────────────────────
    const purchasesData = {
      semana: {
        value:    formatCOP(comprasSemana.rows[0].valor),
        cantidad: parseInt(comprasSemana.rows[0].cantidad),
        change:   calcularCambio(comprasSemana.rows[0].valor, comprasSemanaAnt.rows[0].valor),
      },
      mes: {
        value:    formatCOP(comprasMes.rows[0].valor),
        cantidad: parseInt(comprasMes.rows[0].cantidad),
        change:   calcularCambio(comprasMes.rows[0].valor, comprasMesAnt.rows[0].valor),
      },
      año: {
        value:    formatCOP(comprasAno.rows[0].valor),
        cantidad: parseInt(comprasAno.rows[0].cantidad),
        change:   calcularCambio(comprasAno.rows[0].valor, comprasAnoAnt.rows[0].valor),
      },
    };

    // ── Armar KPI Pedidos ────────────────────────────────────────────────
    const ordersData = {
      semana: {
        value:  parseInt(pedidosSemana.rows[0].cantidad),
        change: calcularCambio(pedidosSemana.rows[0].cantidad, pedidosSemanaAnt.rows[0].cantidad),
      },
      mes: {
        value:  parseInt(pedidosMes.rows[0].cantidad),
        change: calcularCambio(pedidosMes.rows[0].cantidad, pedidosMesAnt.rows[0].cantidad),
      },
      año: {
        value:  parseInt(pedidosAno.rows[0].cantidad),
        change: calcularCambio(pedidosAno.rows[0].cantidad, pedidosAnoAnt.rows[0].cantidad),
      },
    };

    // ── Alertas de stock unificadas ──────────────────────────────────────
    const stockAlerts = [
      ...stockBajoProductos.rows.map((r) => ({ ...r, tipo: 'producto' })),
      ...stockBajoInsumos.rows.map((r)   => ({ ...r, tipo: 'insumo'  })),
    ].sort((a, b) => (a.stock - a.min) - (b.stock - b.min)); // más críticos primero

    // ── Pedidos recientes formateados ────────────────────────────────────
    const recentOrders = pedidosRecientes.rows.map((p) => ({
      id:     p.id,
      client: p.client,
      date:   p.date,
      status: p.status,
      total:  formatCOP(p.total),
    }));

    return res.status(200).json({
      ok: true,
      data: {
        salesData,
        purchasesData,
        ordersData,
        topProducts:  topProductos.rows,
        stockAlerts,
        recentOrders,
        resumen:      resumen.rows[0],
      },
    });

  } catch (error) {
    console.error('Error en dashboard:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar el dashboard.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/dashboard/resumen
// Solo contadores rápidos (para la barra superior)
// ─────────────────────────────────────────────
export const getResumen = async (req, res) => {
  try {
    const { rows } = await pool.query(DASHBOARD_QUERIES.RESUMEN);
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error en resumen:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar el resumen.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/dashboard/stock-alertas
// Solo alertas de stock (productos + insumos)
// ─────────────────────────────────────────────
export const getStockAlertas = async (req, res) => {
  try {
    const [productos, insumos] = await Promise.all([
      pool.query(DASHBOARD_QUERIES.STOCK_BAJO_PRODUCTOS),
      pool.query(DASHBOARD_QUERIES.STOCK_BAJO_INSUMOS),
    ]);

    const alertas = [
      ...productos.rows.map((r) => ({ ...r, tipo: 'producto' })),
      ...insumos.rows.map((r)   => ({ ...r, tipo: 'insumo'  })),
    ].sort((a, b) => (a.stock - a.min) - (b.stock - b.min));

    return res.status(200).json({
      ok: true,
      total: alertas.length,
      data: alertas,
    });
  } catch (error) {
    console.error('Error en stock alertas:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar alertas de stock.' });
  }
};