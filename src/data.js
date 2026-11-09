import { query } from './db.js';

// Estados válidos de un pedido (deben coincidir con el CHECK de la tabla compras)
const ESTADOS_PEDIDO = ['Solicitándose', 'En edición', 'Realizado', 'Cancelado'];

/**
 * Valida que el string tenga formato YYYY-MM-DD.
 * Se usa para evitar inyección con strings arbitrarios en filtros de fecha.
 */
function dateFilter(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
}

/* ============================================================
   MIS PEDIDOS (vista del rol Cliente)
   ============================================================ */

/**
 * Lista los pedidos de UN usuario con filtros y paginación.
 *
 * Devuelve:
 *   { pedidos, total, resumen, limit, offset }
 *
 * - `pedidos`: filas con total y unidades agregadas por pedido.
 * - `total`: cantidad total de pedidos que coinciden con los filtros
 *            (para calcular páginas).
 * - `resumen`: totales agregados (pedidos, unidades, monto).
 *
 * Siempre filtra por `co.id_usuario = $1` para que un cliente nunca
 * pueda ver los pedidos de otro aunque manipule la URL.
 */
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
    // Búsqueda por nombre de producto dentro de los detalles del pedido.
    // Se usa EXISTS para no duplicar pedidos que tengan varios productos
    // coincidentes.
    params.push(`%${String(filters.buscar).trim()}%`);
    where.push(`EXISTS (
      SELECT 1 FROM compras_detalle cd2
      JOIN productos p2 USING (id_producto)
      WHERE cd2.id_compra = co.id_compra AND p2.nombre ILIKE $${params.length}
    )`);
  }

  const whereSql = where.join(' AND ');

  // Se ejecutan en paralelo: lista paginada + conteo total + agregados.
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

  return { pedidos, total: conteo[0].n, resumen: resumen[0], limit, offset };
}

/**
 * Devuelve las líneas de detalle de varios pedidos a la vez.
 * Se usa un Map para agrupar por id_compra y evitar N+1 queries.
 *
 * IMPORTANTE: filtra por `co.id_usuario = $1` para que un cliente no
 * pueda ver el detalle de pedidos ajenos aunque conozca los ids.
 */
export async function getOrderDetails(userId, orderIds) {
  if (!orderIds.length) return new Map();

  // Los placeholders empiezan en $2 porque $1 es el userId.
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

/* ============================================================
   USUARIOS
   ============================================================ */

/** Devuelve un usuario por id o null. */
export async function getUser(id) {
  const { rows } = await query(
    `SELECT id_usuario, usuario, rol, nombre, email, activo
     FROM usuarios WHERE id_usuario=$1`,
    [id]
  );
  return rows[0] || null;
}

/* ============================================================
   PRODUCTOS
   ============================================================ */

/**
 * Lista productos para el catálogo público.
 * Por defecto solo activos (`activo = TRUE`).
 */
export async function listProducts(filters = {}, { limit = 12, offset = 0, incluirInactivos = false } = {}) {
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

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const ordering = {
    precio_asc: 'precio_unitario ASC',
    precio_desc: 'precio_unitario DESC',
    nombre_asc: 'nombre ASC',
  };
  const orderBy = ordering[filters.orden] || ordering.precio_desc;

  // Una query para la página + otra para el total
  const [{ rows }, { rows: conteo }] = await Promise.all([
    query(
      `SELECT * FROM productos
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*)::int AS n FROM productos ${whereSql}`, params),
  ]);

  return { rows, total: conteo[0].n, limit, offset };
}

/**
 * Lista usuarios activos (sin paginar).
 * Se usa para el `<select>` de filtros de informes y para
 * obtener la lista completa cuando el volumen es pequeño.
 * Si se necesita paginar (ej. maestro), usar `listUsuariosPaginado`.
 */
export async function listUsuarios({ incluirInactivos = false } = {}) {
  const { rows } = await query(
    `SELECT id_usuario, usuario, rol, nombre, email, activo, creado_en
     FROM usuarios
     ${incluirInactivos ? '' : 'WHERE activo'}
     ORDER BY activo DESC, nombre`
  );
  return rows;
}

/**
 * Lista usuarios con paginación (para la tabla del maestro).
 */
export async function listUsuariosPaginado({ incluirInactivos = true } = {}, { limit = 10, offset = 0 } = {}) {
  const params = [];
  const where = [];
  if (!incluirInactivos) where.push('activo = TRUE');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [{ rows }, { rows: conteo }] = await Promise.all([
    query(
      `SELECT id_usuario, usuario, rol, nombre, email, activo, creado_en
       FROM usuarios
       ${whereSql}
       ORDER BY activo DESC, nombre
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    query(`SELECT COUNT(*)::int AS n FROM usuarios ${whereSql}`, params),
  ]);

  return { rows, total: conteo[0].n, limit, offset };
}

/**
 * Lista productos con paginación (para la tabla del maestro, incluye inactivos).
 */
export async function listProductsAdminPaginado({ limit = 10, offset = 0 } = {}) {
  const [{ rows }, { rows: conteo }] = await Promise.all([
    query(
      `SELECT * FROM productos
       ORDER BY activo DESC, nombre
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    query('SELECT COUNT(*)::int AS n FROM productos'),
  ]);

  return { rows, total: conteo[0].n, limit, offset };
}

/* ============================================================
   PEDIDO ABIERTO (carrito implícito)
   ------------------------------------------------------------
   Un usuario tiene a lo sumo UN pedido en estado
   'Solicitándose' o 'En edición' a la vez. Ese es su "carrito".
   ============================================================ */

/**
 * Whitelist de columnas ordenables para el informe tabular.
 * Las claves son las que usa el frontend en `?orden=...`.
 * Los valores son expresiones SQL seguras (nunca input directo).
 */
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

/**
 * Whitelist de columnas ordenables para el informe consolidado.
 * Ojo: `inventario` apunta a `i.productos_en_inventario` (del CTE
 * `inventario`), NO a `v.productos_en_inventario` (que no existe).
 */
const ORDEN_CONSOLIDADO = {
  color: 'v.color',
  unidades: 'v.total_productos_vendidos',
  promedio: 'v.promedio_precio',
  ingresos: 'v.ingresos_totales',
  inventario: 'i.productos_en_inventario',
};

/**
 * Construye una cláusula ORDER BY segura.
 *
 * - Solo acepta columnas de la whitelist (evita SQL injection).
 * - `direccion` se normaliza a ASC/DESC.
 * - Si la columna no existe en la whitelist, usa el fallback.
 */
function buildOrderBy(whitelist, orden, direccion, fallback) {
  const col = whitelist[orden];
  if (!col) return `ORDER BY ${fallback}`;
  const dir = String(direccion).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${col} ${dir}`;
}

/**
 * Devuelve el pedido abierto del usuario (estado Solicitándose o En edición)
 * con sus items y el total calculado.
 *
 * Si no hay pedido abierto, devuelve { order: null, items: [], total: 0 }.
 */
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

/* ============================================================
   PÁGINACION Y LÍMITES
   ============================================================ */

/**
 * Lee `limit` y `offset` de los searchParams.
 * - `limit` está restringido a valores de la whitelist (seguridad).
 * - `offset` se calcula a partir de `pagina` y `limit`.
 */
function readPagination(params, allowedLimits, defaultLimit) {
  const rawLimit = Number(params.limit);
  const limit = allowedLimits.includes(rawLimit) ? rawLimit : defaultLimit;
  const page = Math.max(1, Number(params.pagina) || 1);
  const offset = (page - 1) * limit;
  return { limit, offset, page };
}

/**
 * Cuenta cuántas páginas hay dado un total y un tamaño de página.
 */
function totalPages(total, limit) {
  return Math.max(1, Math.ceil(total / limit));
}

export const LIMITES_TABULAR = [10, 25, 50, 100];
export const LIMITES_CATALOGO = [8, 12, 24, 48];
export const LIMITES_MAESTRO = [10, 25, 50];

/* ============================================================
   INFORMES
   ============================================================ */


/**
 * Informe tabular: cada línea de compra (producto × pedido).
 * Soporta filtros por color, estado, usuario, precio, fecha
 * y ordenamiento por columna.
 */
export async function getTabularReport(filters = {}, { limit = 50, offset = 0 } = {}) {
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
    add(Number(filters.id_usuario), 'co.id_usuario = ?');
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

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderBy = buildOrderBy(
    ORDEN_TABULAR,
    filters.orden,
    filters.direccion,
    'co.fecha DESC, co.id_compra DESC'
  );

  const [{ rows }, { rows: conteo }] = await Promise.all([
    query(
      `SELECT co.id_compra, co.fecha AS fecha_compra,
              u.nombre AS comprador_nombre,
              p.nombre AS producto, p.color, cd.cantidad,
              cd.cantidad * cd.precio_unitario AS precio_compra,
              co.estado AS estado_compra
       FROM compras_detalle cd
       JOIN compras co USING (id_compra)
       JOIN usuarios u ON u.id_usuario = co.id_usuario
       JOIN productos p USING (id_producto)
       ${whereSql}
       ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS n
       FROM compras_detalle cd
       JOIN compras co USING (id_compra)
       JOIN usuarios u ON u.id_usuario = co.id_usuario
       JOIN productos p USING (id_producto)
       ${whereSql}`,
      params
    ),
  ]);

  return { rows, total: conteo[0].n, limit, offset };
}

/** Lista mínima de usuarios activos para poblar el <select> de filtros. */
export async function listUsuariosParaFiltro() {
  const { rows } = await query(
    `SELECT id_usuario, nombre, usuario
     FROM usuarios
     WHERE activo = TRUE
     ORDER BY nombre`
  );
  return rows;
}

/**
 * Informe consolidado por color.
 *
 * Solo cuenta pedidos en estado 'Realizado' (los cancelados no
 * representan ventas reales).
 *
 * Agrupa por color y suma:
 *   - total_productos_vendidos
 *   - promedio_precio
 *   - ingresos_totales
 *
 * Añade el inventario disponible actual (no depende del filtro).
 */
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

  // El ORDER BY va dentro del SELECT final. Se quita el prefijo "ORDER BY "
  // porque se interpola como parte del texto.
  const ordenInterno = buildOrderBy(
    ORDEN_CONSOLIDADO,
    filters.orden,
    filters.direccion,
    'v.total_productos_vendidos DESC'
  ).replace(/^ORDER BY /, '');

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