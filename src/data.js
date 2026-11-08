import { query } from './db.js';

const ESTADOS_PEDIDO = ['Solicitándose', 'En edición', 'Realizado', 'Cancelado'];

function dateFilter(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
}

export async function getMyOrders(userId, filters = {}, { limit = 20, offset = 0 } = {}) {
  const params = [userId];
  const where = ['co.id_usuario = $1'];

  if (filters.estado && ESTADOS_PEDIDO.includes(filters.estado)) {
    params.push(filters.estado);
    where.push(`co.estado = $${params.length}`);
  }
  if (dateFilter(filters.fecha_inicio)) {
    params.push(filters.fecha_inicio);
    where.push(`co.fecha >= $${params.length}::date`);
  }
  if (dateFilter(filters.fecha_final)) {
    params.push(filters.fecha_final);
    where.push(`co.fecha <= $${params.length}::date`);
  }
  if (String(filters.buscar || '').trim()) {
    params.push(`%${String(filters.buscar).trim()}%`);
    where.push(`EXISTS (
      SELECT 1 FROM compras_detalle cd2
      JOIN productos p2 USING (id_producto)
      WHERE cd2.id_compra = co.id_compra AND p2.nombre ILIKE $${params.length}
    )`);
  }

  const whereSql = where.join(' AND ');

  const [{ rows: pedidos }, { rows: conteo }, { rows: resumen }] = await Promise.all([
    query(
      `SELECT co.id_compra, co.fecha, co.hora, co.estado, co.actualizado_en,
              COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) AS total,
              COALESCE(SUM(cd.cantidad), 0)::int AS unidades
       FROM compras co
       LEFT JOIN compras_detalle cd USING (id_compra)
       WHERE ${whereSql}
       GROUP BY co.id_compra
       ORDER BY co.fecha DESC, co.id_compra DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*)::int AS n FROM compras co WHERE ${whereSql}`, params),
    query(
      `SELECT
         COUNT(DISTINCT co.id_compra)::int AS total_pedidos,
         COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) AS total_gastado,
         COALESCE(SUM(cd.cantidad), 0)::int AS total_unidades
       FROM compras co
       LEFT JOIN compras_detalle cd USING (id_compra)
       WHERE ${whereSql}`,
      params
    ),
  ]);

  return {
    pedidos,
    total: conteo[0].n,
    resumen: resumen[0],
    limit,
    offset,
  };
}

/**
 * Devuelve las líneas de detalle de varios pedidos a la vez.
 * Recibe un array de id_compra. Filtra por id_usuario para seguridad.
 */
export async function getOrderDetails(userId, orderIds) {
  if (!orderIds.length) return new Map();

  const params = [userId, ...orderIds];
  const placeholders = orderIds.map((_, i) => `$${i + 2}`).join(',');

  const { rows } = await query(
    `SELECT cd.id_compra, cd.id_producto, p.nombre, p.descripcion,
            p.color, p.imagen_url, cd.cantidad, cd.precio_unitario,
            (cd.cantidad * cd.precio_unitario) AS subtotal
     FROM compras_detalle cd
     JOIN compras co USING (id_compra)
     JOIN productos p USING (id_producto)
     WHERE co.id_usuario = $1
       AND cd.id_compra IN (${placeholders})
     ORDER BY cd.id_compra, p.nombre`,
    params
  );

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.id_compra)) map.set(row.id_compra, []);
    map.get(row.id_compra).push(row);
  }
  return map;
}

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

export async function listProductsAdmin() {
  const { rows } = await query(
    `SELECT * FROM productos ORDER BY activo DESC, nombre`
  );
  return rows;
}

export async function listProducts(filters = {}, { incluirInactivos = false } = {}) {
  const params = [];
  const where = [];
  const add = (value, condition) => {
    params.push(value);
    where.push(condition.replace('?', `$${params.length}`));
  };

  if (!incluirInactivos) where.push('activo = TRUE');
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

const ORDEN_TABULAR = {
  id_compra: 'co.id_compra',
  fecha: 'co.fecha',
  comprador: 'u.nombre',
  producto: 'p.nombre',
  color: 'p.color',
  cantidad: 'cd.cantidad',
  precio: 'cd.cantidad * cd.precio_unitario',
  estado: 'co.estado',
};

const ORDEN_CONSOLIDADO = {
  color: 'v.color',
  unidades: 'v.total_productos_vendidos',
  promedio: 'v.promedio_precio',
  ingresos: 'v.ingresos_totales',
  inventario: 'v.productos_en_inventario',
};

/**
 * Devuelve una cláusula ORDER BY segura (nunca interpola input directo).
 */
function buildOrderBy(whitelist, orden, direccion, fallback) {
  const col = whitelist[orden];
  if (!col) return `ORDER BY ${fallback}`;
  const dir = String(direccion).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${col} ${dir}`;
}

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
    `SELECT p.id_producto, p.nombre, p.descripcion, p.color, p.imagen_url,
            p.precio_unitario, cd.cantidad
     FROM compras_detalle cd
     JOIN productos p USING (id_producto)
     WHERE cd.id_compra=$1
     ORDER BY p.nombre`,
    [order[0].id_compra]
  );

  const total = items.reduce(
    (s, i) => s + Number(i.precio_unitario) * i.cantidad, 0
  );
  return { order: order[0], items, total };
}

/* ---------------- Informes ---------------- */

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
  if (filters.id_usuario && Number.isInteger(Number(filters.id_usuario)))
    add(Number(filters.id_usuario), 'co.id_usuario = ?');       // ← NUEVO
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

  const orderBy = buildOrderBy(
    ORDEN_TABULAR,
    filters.orden,
    filters.direccion,
    'co.fecha DESC, co.id_compra DESC'   // fallback
  );

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
     ${orderBy}`,
    params
  );
  return rows;
}

export async function listUsuariosParaFiltro() {
  const { rows } = await query(
    `SELECT id_usuario, nombre, usuario
     FROM usuarios
     WHERE activo = TRUE
     ORDER BY nombre`
  );
  return rows;
}

export async function getConsolidatedReport(filters = {}) {
  const params = [];
  const where = [`co.estado = 'Realizado'`];

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

  // Clave: el ORDER BY va DENTRO del CTE final, no en el SELECT externo
  const ordenInterno = buildOrderBy(
    ORDEN_CONSOLIDADO,
    filters.orden,
    filters.direccion,
    'v.total_productos_vendidos DESC'
  ).replace(/^ORDER BY /, ''); // quitar el prefijo, se usa dentro del SELECT

  const [{ rows: report }, usuarios] = await Promise.all([
    query(
      `WITH ventas AS (
         SELECT p.color,
           COALESCE(SUM(cd.cantidad),0)::int AS total_productos_vendidos,
           COALESCE(ROUND(AVG(cd.precio_unitario),2),0) AS promedio_precio,
           COALESCE(ROUND(SUM(cd.cantidad*cd.precio_unitario),2),0) AS ingresos_totales
         FROM compras_detalle cd
         JOIN compras co USING (id_compra)
         JOIN productos p USING (id_producto)
         WHERE ${where.join(' AND ')}
         GROUP BY p.color
       ), inventario AS (
         SELECT color, SUM(cantidad_disponible)::int AS productos_en_inventario
         FROM productos GROUP BY color
       )
       SELECT v.color, v.total_productos_vendidos, v.promedio_precio,
              v.ingresos_totales,
              COALESCE(i.productos_en_inventario,0) AS productos_en_inventario
       FROM ventas v LEFT JOIN inventario i USING (color)
       ORDER BY ${ordenInterno}`,
      params
    ),
    listUsuarios(),
  ]);
  return { rows: report, usuarios };
}