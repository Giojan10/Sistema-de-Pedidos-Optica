import { query } from './db.js';

export async function listCustomers() {
  const { rows } = await query('SELECT id_cliente, nombre, email FROM clientes ORDER BY nombre');
  return rows;
}

export async function getCustomer(id) {
  const { rows } = await query('SELECT id_cliente, nombre FROM clientes WHERE id_cliente = $1', [id]);
  return rows[0] || null;
}

export async function listProducts(filters = {}) {
  const params = [];
  const where = [];
  const add = (value, condition) => { params.push(value); where.push(condition.replace('?', `$${params.length}`)); };
  if (String(filters.buscar || '').trim()) add(`%${String(filters.buscar).trim()}%`, 'nombre ILIKE ?');
  if (filters.color && filters.color !== 'Todos') add(filters.color, 'color = ?');
  if (filters.precio_desde !== '' && Number.isFinite(Number(filters.precio_desde))) add(Number(filters.precio_desde), 'precio_unitario >= ?');
  if (filters.precio_hasta !== '' && Number.isFinite(Number(filters.precio_hasta))) add(Number(filters.precio_hasta), 'precio_unitario <= ?');
  const ordering = { precio_asc: 'precio_unitario ASC', precio_desc: 'precio_unitario DESC', nombre_asc: 'nombre ASC' };
  const { rows } = await query(`SELECT * FROM productos ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${ordering[filters.orden] || ordering.precio_desc}`, params);
  return rows;
}

export async function getCart(customerId) {
  const { rows } = await query(`SELECT p.id_producto,p.nombre,p.descripcion,p.color,p.precio_unitario,c.cantidad
    FROM carrito_temp c JOIN productos p USING (id_producto)
    WHERE c.id_cliente=$1 ORDER BY p.nombre`, [customerId]);
  const total = rows.reduce((sum, item) => sum + Number(item.precio_unitario) * item.cantidad, 0);
  return { items: rows, total };
}

function dateFilter(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export async function getTabularReport(filters = {}) {
  const params = [];
  const where = [];
  const add = (value, condition) => { params.push(value); where.push(condition.replace('?', `$${params.length}`)); };
  if (filters.color && filters.color !== 'Todos') add(filters.color, 'p.color = ?');
  if (filters.precio_desde !== '' && Number.isFinite(Number(filters.precio_desde))) add(Number(filters.precio_desde), 'cd.cantidad * cd.precio_unitario >= ?');
  if (filters.precio_hasta !== '' && Number.isFinite(Number(filters.precio_hasta))) add(Number(filters.precio_hasta), 'cd.cantidad * cd.precio_unitario <= ?');
  const { rows } = await query(`SELECT co.id_compra,co.fecha AS fecha_compra,cl.nombre AS comprador_nombre,
      p.nombre AS producto,p.color,cd.cantidad,cd.cantidad*cd.precio_unitario AS precio_compra,
      co.estado AS estado_compra
    FROM compras_detalle cd JOIN compras co USING(id_compra)
    JOIN clientes cl USING(id_cliente) JOIN productos p USING(id_producto)
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY co.fecha DESC,co.id_compra DESC`, params);
  return rows;
}

export async function getConsolidatedReport(filters = {}) {
  const params = [];
  const where = [];
  if (dateFilter(filters.fecha_inicio)) { params.push(filters.fecha_inicio); where.push(`co.fecha >= $${params.length}::date`); }
  if (dateFilter(filters.fecha_final)) { params.push(filters.fecha_final); where.push(`co.fecha <= $${params.length}::date`); }
  if (filters.id_cliente && Number.isInteger(Number(filters.id_cliente))) { params.push(Number(filters.id_cliente)); where.push(`co.id_cliente = $${params.length}`); }
  const [{ rows: report }, customers] = await Promise.all([
    query(`WITH ventas AS (
        SELECT p.color,SUM(cd.cantidad)::integer AS total_productos_vendidos,
          ROUND(AVG(cd.precio_unitario),2) AS promedio_precio,
          ROUND(SUM(cd.cantidad*cd.precio_unitario),2) AS ingresos_totales
        FROM compras_detalle cd JOIN compras co USING(id_compra) JOIN productos p USING(id_producto)
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        GROUP BY p.color
      ), inventario AS (
        SELECT color,SUM(cantidad_disponible)::integer AS productos_en_inventario
        FROM productos GROUP BY color
      )
      SELECT ventas.color,ventas.total_productos_vendidos,ventas.promedio_precio,
        ventas.ingresos_totales,COALESCE(inventario.productos_en_inventario,0) AS productos_en_inventario
      FROM ventas LEFT JOIN inventario USING(color)
      ORDER BY ventas.total_productos_vendidos DESC`, params),
    listCustomers(),
  ]);
  return { rows: report, customers };
}
