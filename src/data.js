import { query } from './db.js';

/* ---------------- Usuarios ---------------- */

export async function listUsuarios({ incluirInactivos = false } = {}) {
  const { rows } = await query(
    `SELECT id_usuario, usuario, rol, nombre, email, activo, creado_en
     FROM usuarios
     ${incluirInactivos ? '' : 'WHERE activo'}
     ORDER BY activo DESC, nombre`
  );
  return rows;
}

export async function getUser(id) {
  const { rows } = await query(
    `SELECT id_usuario, usuario, rol, nombre, email, activo
     FROM usuarios WHERE id_usuario=$1`,
    [id]
  );
  return rows[0] || null;
}

/* ---------------- Productos ---------------- */

export async function listProducts(filters = {}) {
  const params = [];
  const where = [];
  const add = (value, condition) => {
    params.push(value);
    where.push(condition.replace('?', `$${params.length}`));
  };
  if (String(filters.buscar || '').trim())
    add(`%${String(filters.buscar).trim()}%`, 'nombre ILIKE ?');
  if (filters.color && filters.color !== 'Todos')
    add(filters.color, 'color = ?');
  if (filters.precio_desde !== '' && Number.isFinite(Number(filters.precio_desde)))
    add(Number(filters.precio_desde), 'precio_unitario >= ?');
  if (filters.precio_hasta !== '' && Number.isFinite(Number(filters.precio_hasta)))
    add(Number(filters.precio_hasta), 'precio_unitario <= ?');

  const ordering = {
    precio_asc: 'precio_unitario ASC',
    precio_desc: 'precio_unitario DESC',
    nombre_asc: 'nombre ASC',
  };
  const { rows } = await query(
    `SELECT * FROM productos
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${ordering[filters.orden] || ordering.precio_desc}`,
    params
  );
  return rows;
}

/* ---------------- Pedido abierto (reemplaza carrito_temp) ---------------- */

export async function getOpenOrder(userId) {
  const { rows: order } = await query(
    `SELECT id_compra, estado, fecha, hora
     FROM compras
     WHERE id_usuario=$1 AND estado IN ('Solicitándose','En edición')
     LIMIT 1`,
    [userId]
  );
  if (!order[0]) return { order: null, items: [], total: 0 };

  const { rows: items } = await query(
    `SELECT p.id_producto, p.nombre, p.descripcion, p.color,
            p.precio_unitario, cd.cantidad
     FROM compras_detalle cd
     JOIN productos p USING (id_producto)
     WHERE cd.id_compra=$1
     ORDER BY p.nombre`,
    [order[0].id_compra]
  );

  const total = items.reduce(
    (s, i) => s + Number(i.precio_unitario) * i.cantidad,
    0
  );
  return { order: order[0], items, total };
}

/* ---------------- Informes ---------------- */

function dateFilter(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
}

export async function getTabularReport(filters = {}) {
  const params = [];
  const where = [];
  const add = (value, condition) => {
    params.push(value);
    where.push(condition.replace('?', `$${params.length}`));
  };
  if (filters.color && filters.color !== 'Todos') add(filters.color, 'p.color = ?');
  if (['Solicitándose', 'En edición', 'Realizado', 'Cancelado'].includes(filters.estado))
    add(filters.estado, 'co.estado = ?');
  if (filters.precio_desde !== '' && Number.isFinite(Number(filters.precio_desde)))
    add(Number(filters.precio_desde), 'cd.cantidad * cd.precio_unitario >= ?');
  if (filters.precio_hasta !== '' && Number.isFinite(Number(filters.precio_hasta)))
    add(Number(filters.precio_hasta), 'cd.cantidad * cd.precio_unitario <= ?');
  if (dateFilter(filters.fecha_inicio)) {
    params.push(filters.fecha_inicio);
    where.push(`co.fecha >= $${params.length}::date`);
  }
  if (dateFilter(filters.fecha_final)) {
    params.push(filters.fecha_final);
    where.push(`co.fecha <= $${params.length}::date`);
  }

  const { rows } = await query(
    `SELECT co.id_compra, co.fecha AS fecha_compra,
            u.nombre AS comprador_nombre,
            p.nombre AS producto, p.color, cd.cantidad,
            cd.cantidad * cd.precio_unitario AS precio_compra,
            co.estado AS estado_compra
     FROM compras_detalle cd
     JOIN compras co USING (id_compra)
     JOIN usuarios u ON u.id_usuario = co.id_usuario
     JOIN productos p USING (id_producto)
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY co.fecha DESC, co.id_compra DESC`,
    params
  );
  return rows;
}

export async function getConsolidatedReport(filters = {}) {
  const params = [];
  const where = [];
  if (dateFilter(filters.fecha_inicio)) {
    params.push(filters.fecha_inicio);
    where.push(`co.fecha >= $${params.length}::date`);
  }
  if (dateFilter(filters.fecha_final)) {
    params.push(filters.fecha_final);
    where.push(`co.fecha <= $${params.length}::date`);
  }
  if (filters.id_usuario && Number.isInteger(Number(filters.id_usuario))) {
    params.push(Number(filters.id_usuario));
    where.push(`co.id_usuario = $${params.length}`);
  }

  const [{ rows: report }, usuarios] = await Promise.all([
    query(
      `WITH ventas AS (
         SELECT p.color,
           COALESCE(SUM(cd.cantidad) FILTER (WHERE co.estado <> 'Cancelado'),0)::int AS total_productos_vendidos,
           COALESCE(ROUND(AVG(cd.precio_unitario) FILTER (WHERE co.estado <> 'Cancelado'),2),0) AS promedio_precio,
           COALESCE(ROUND(SUM(cd.cantidad*cd.precio_unitario) FILTER (WHERE co.estado <> 'Cancelado'),2),0) AS ingresos_totales,
           COALESCE(SUM(cd.cantidad) FILTER (WHERE co.estado = 'Cancelado'),0)::int AS unidades_canceladas,
           COALESCE(ROUND(SUM(cd.cantidad*cd.precio_unitario) FILTER (WHERE co.estado = 'Cancelado'),2),0) AS valor_cancelado
         FROM compras_detalle cd
         JOIN compras co USING (id_compra)
         JOIN productos p USING (id_producto)
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         GROUP BY p.color
       ), inventario AS (
         SELECT color, SUM(cantidad_disponible)::int AS productos_en_inventario
         FROM productos GROUP BY color
       )
       SELECT v.color, v.total_productos_vendidos, v.promedio_precio,
              v.ingresos_totales, v.unidades_canceladas, v.valor_cancelado,
              COALESCE(i.productos_en_inventario,0) AS productos_en_inventario
       FROM ventas v LEFT JOIN inventario i USING (color)
       ORDER BY v.total_productos_vendidos DESC, v.unidades_canceladas DESC`,
      params
    ),
    listUsuarios(),
  ]);
  return { rows: report, usuarios };
}