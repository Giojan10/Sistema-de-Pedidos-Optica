require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('node:path');
const { pool, initializeDatabase } = require('./db');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.urlencoded({ extended: false }));
app.use('/static', express.static(path.join(__dirname, '..', 'static')));
app.use(session({ secret: process.env.SESSION_SECRET || 'local-dev-secret-change-me', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax' } }));
app.use((req, res, next) => {
  res.locals.cliente = req.session.cliente || null;
  res.locals.mensaje = req.query.mensaje || '';
  res.locals.error = req.query.error || '';
  res.locals.money = value => Number(value || 0).toFixed(2);
  next();
});

const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const requireClient = (req, res, next) => req.session.cliente ? next() : res.redirect('/');
const redirectMessage = (res, route, key, message) => res.redirect(`${route}?${key}=${encodeURIComponent(message)}`);

app.get('/', asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT id_cliente, nombre, email FROM clientes ORDER BY nombre');
  res.render('identificarse', { clientes: rows });
}));

app.post('/identificarse', asyncRoute(async (req, res) => {
  const id = Number(req.body.id_cliente);
  if (!Number.isInteger(id) || id < 1) return redirectMessage(res, '/', 'error', 'Selecciona un cliente.');
  const { rows } = await pool.query('SELECT id_cliente, nombre FROM clientes WHERE id_cliente = $1', [id]);
  if (!rows[0]) return redirectMessage(res, '/', 'error', 'No se encontró ese cliente.');
  req.session.cliente = rows[0];
  res.redirect('/catalogo');
}));

app.post('/clientes', asyncRoute(async (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  if (!nombre) return redirectMessage(res, '/', 'error', 'El nombre es obligatorio.');
  const { rows } = await pool.query('INSERT INTO clientes (nombre,email) VALUES ($1,$2) RETURNING id_cliente,nombre', [nombre, String(req.body.email || '').trim() || null]);
  req.session.cliente = rows[0];
  res.redirect('/catalogo');
}));

app.post('/salir', (req, res) => req.session.destroy(() => res.redirect('/')));

app.get('/catalogo', requireClient, asyncRoute(async (req, res) => {
  const { buscar = '', color = 'Todos', precio_desde = '', precio_hasta = '', orden = 'precio_desc' } = req.query;
  const allowed = { precio_asc: 'precio_unitario ASC', precio_desc: 'precio_unitario DESC', nombre_asc: 'nombre ASC' };
  const params = []; const where = [];
  if (String(buscar).trim()) { params.push(`%${String(buscar).trim()}%`); where.push(`nombre ILIKE $${params.length}`); }
  if (color && color !== 'Todos') { params.push(color); where.push(`color = $${params.length}`); }
  if (precio_desde !== '' && Number.isFinite(Number(precio_desde))) { params.push(Number(precio_desde)); where.push(`precio_unitario >= $${params.length}`); }
  if (precio_hasta !== '' && Number.isFinite(Number(precio_hasta))) { params.push(Number(precio_hasta)); where.push(`precio_unitario <= $${params.length}`); }
  const sql = `SELECT * FROM productos ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${allowed[orden] || allowed.precio_desc}`;
  const { rows } = await pool.query(sql, params);
  res.render('catalogo', { productos: rows, filtros: { buscar, color, precio_desde, precio_hasta, orden } });
}));

app.post('/carrito/agregar', requireClient, asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('UPDATE productos SET cantidad_disponible = cantidad_disponible - 1, cantidad_apartada = cantidad_apartada + 1 WHERE id_producto = $1 AND cantidad_disponible > 0 RETURNING id_producto', [Number(req.body.id_producto)]);
    if (!rows[0]) { await client.query('ROLLBACK'); return redirectMessage(res, '/catalogo', 'error', 'No hay inventario disponible para ese producto.'); }
    await client.query('INSERT INTO carrito_temp (id_cliente,id_producto,cantidad) VALUES ($1,$2,1) ON CONFLICT (id_cliente,id_producto) DO UPDATE SET cantidad = carrito_temp.cantidad + 1', [req.session.cliente.id_cliente, rows[0].id_producto]);
    await client.query('COMMIT');
    res.redirect(req.body.return_to === 'carrito' ? '/carrito' : '/catalogo?mensaje=Producto+agregado+al+carrito');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}));

app.get('/carrito', requireClient, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(`SELECT p.id_producto,p.nombre,p.descripcion,p.color,p.precio_unitario,c.cantidad FROM carrito_temp c JOIN productos p USING (id_producto) WHERE c.id_cliente=$1 ORDER BY p.nombre`, [req.session.cliente.id_cliente]);
  const total = rows.reduce((sum, item) => sum + Number(item.precio_unitario) * item.cantidad, 0);
  res.render('carrito', { items: rows, total });
}));

app.post('/carrito/quitar', requireClient, asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT cantidad FROM carrito_temp WHERE id_cliente=$1 AND id_producto=$2 FOR UPDATE', [req.session.cliente.id_cliente, Number(req.body.id_producto)]);
    if (rows[0]) {
      await client.query('UPDATE productos SET cantidad_disponible=cantidad_disponible+1, cantidad_apartada=cantidad_apartada-1 WHERE id_producto=$1', [Number(req.body.id_producto)]);
      if (rows[0].cantidad <= 1) await client.query('DELETE FROM carrito_temp WHERE id_cliente=$1 AND id_producto=$2', [req.session.cliente.id_cliente, Number(req.body.id_producto)]);
      else await client.query('UPDATE carrito_temp SET cantidad=cantidad-1 WHERE id_cliente=$1 AND id_producto=$2', [req.session.cliente.id_cliente, Number(req.body.id_producto)]);
    }
    await client.query('COMMIT'); res.redirect('/carrito');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}));

app.post('/carrito/confirmar', requireClient, asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: items } = await client.query('SELECT id_producto,cantidad FROM carrito_temp WHERE id_cliente=$1 FOR UPDATE', [req.session.cliente.id_cliente]);
    if (!items.length) { await client.query('ROLLBACK'); return redirectMessage(res, '/carrito', 'error', 'El carrito está vacío.'); }
    const { rows: compras } = await client.query("INSERT INTO compras (id_cliente,fecha,hora,estado) VALUES ($1,CURRENT_DATE,LOCALTIME,'Realizado') RETURNING id_compra", [req.session.cliente.id_cliente]);
    for (const item of items) {
      const { rows: productos } = await client.query('SELECT precio_unitario FROM productos WHERE id_producto=$1 FOR UPDATE', [item.id_producto]);
      await client.query('INSERT INTO compras_detalle (id_compra,id_producto,cantidad,precio_unitario) VALUES ($1,$2,$3,$4)', [compras[0].id_compra,item.id_producto,item.cantidad,productos[0].precio_unitario]);
      await client.query('UPDATE productos SET cantidad_apartada=cantidad_apartada-$1 WHERE id_producto=$2', [item.cantidad,item.id_producto]);
    }
    await client.query('DELETE FROM carrito_temp WHERE id_cliente=$1', [req.session.cliente.id_cliente]);
    await client.query('COMMIT'); redirectMessage(res, '/carrito', 'mensaje', `¡Pedido #${compras[0].id_compra} generado con éxito!`);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}));

app.post('/carrito/cancelar', requireClient, asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: items } = await client.query('SELECT id_producto,cantidad FROM carrito_temp WHERE id_cliente=$1 FOR UPDATE', [req.session.cliente.id_cliente]);
    for (const item of items) await client.query('UPDATE productos SET cantidad_disponible=cantidad_disponible+$1,cantidad_apartada=cantidad_apartada-$1 WHERE id_producto=$2', [item.cantidad,item.id_producto]);
    await client.query('DELETE FROM carrito_temp WHERE id_cliente=$1', [req.session.cliente.id_cliente]);
    await client.query('COMMIT'); redirectMessage(res, '/carrito', 'mensaje', 'Compra cancelada. Los productos volvieron al inventario.');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}));

app.get('/informe-tabular', requireClient, asyncRoute(async (req, res) => {
  const { precio_desde = '', precio_hasta = '', color = 'Todos' } = req.query;
  const params = []; const where = [];
  if (color && color !== 'Todos') { params.push(color); where.push(`p.color=$${params.length}`); }
  if (precio_desde !== '' && Number.isFinite(Number(precio_desde))) { params.push(Number(precio_desde)); where.push(`cd.cantidad*cd.precio_unitario >= $${params.length}`); }
  if (precio_hasta !== '' && Number.isFinite(Number(precio_hasta))) { params.push(Number(precio_hasta)); where.push(`cd.cantidad*cd.precio_unitario <= $${params.length}`); }
  const { rows } = await pool.query(`SELECT co.id_compra,co.fecha AS fecha_compra,cl.nombre AS comprador_nombre,p.nombre AS producto,p.color,cd.cantidad,cd.cantidad*cd.precio_unitario AS precio_compra,co.estado AS estado_compra FROM compras_detalle cd JOIN compras co USING(id_compra) JOIN clientes cl USING(id_cliente) JOIN productos p USING(id_producto) ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY co.fecha DESC,co.id_compra DESC`, params);
  if (req.query.exportar === 'csv') return sendCsv(res, 'informe_tabular_ventas.csv', ['Id Compra','Fecha Compra','Comprador','Producto','Color','Cantidad','Precio Compra','Estado'], rows.map(r => [r.id_compra,String(r.fecha_compra).slice(0,10),r.comprador_nombre,r.producto,r.color,r.cantidad,r.precio_compra,r.estado_compra]));
  res.render('informe_tabular', { filas: rows, filtros: { precio_desde, precio_hasta, color } });
}));

app.get('/informe-consolidado', requireClient, asyncRoute(async (req, res) => {
  const { fecha_inicio = '', fecha_final = '', id_cliente = '' } = req.query;
  const params = []; const where = [];
  if (fecha_inicio && /^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio)) { params.push(fecha_inicio); where.push(`co.fecha >= $${params.length}::date`); }
  if (fecha_final && /^\d{4}-\d{2}-\d{2}$/.test(fecha_final)) { params.push(fecha_final); where.push(`co.fecha <= $${params.length}::date`); }
  if (id_cliente && Number.isInteger(Number(id_cliente))) { params.push(Number(id_cliente)); where.push(`co.id_cliente = $${params.length}`); }
  const [result, clientes] = await Promise.all([
    pool.query(`WITH ventas AS (
      SELECT p.color,
             SUM(cd.cantidad)::integer AS total_productos_vendidos,
             ROUND(AVG(cd.precio_unitario), 2) AS promedio_precio,
             ROUND(SUM(cd.cantidad * cd.precio_unitario), 2) AS ingresos_totales
      FROM compras_detalle cd
      JOIN compras co ON co.id_compra = cd.id_compra
      JOIN productos p ON p.id_producto = cd.id_producto
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY p.color
    ), inventario AS (
      SELECT color, SUM(cantidad_disponible)::integer AS productos_en_inventario
      FROM productos GROUP BY color
    )
    SELECT ventas.color, ventas.total_productos_vendidos, ventas.promedio_precio,
           ventas.ingresos_totales, COALESCE(inventario.productos_en_inventario, 0) AS productos_en_inventario
    FROM ventas LEFT JOIN inventario USING (color)
    ORDER BY ventas.total_productos_vendidos DESC`, params),
    pool.query('SELECT id_cliente,nombre FROM clientes ORDER BY nombre')
  ]);
  if (req.query.exportar === 'csv') return sendCsv(res, 'informe_consolidado_ventas.csv', ['Color','Total Productos Vendidos','Promedio Precio','Ingresos Totales','Productos en Inventario'], result.rows.map(r => [r.color,r.total_productos_vendidos,r.promedio_precio,r.ingresos_totales,r.productos_en_inventario]));
  const clienteSeleccionado = clientes.rows.find(c => String(c.id_cliente) === String(id_cliente));
  res.render('informe_consolidado', { filas: result.rows, clientes: clientes.rows, clienteSeleccionado, filtros: { fecha_inicio, fecha_final, id_cliente } });
}));

function sendCsv(res, filename, headers, rows) {
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

app.use((req, res) => res.status(404).send('Página no encontrada'));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).send('Ocurrió un error interno. Revisa la configuración de PostgreSQL y los registros del servidor.');
});

const port = Number(process.env.PORT || 3000);
initializeDatabase().then(() => app.listen(port, () => console.log(`Óptica lista en http://localhost:${port}`))).catch(error => { console.error('No se pudo conectar o inicializar PostgreSQL:', error); process.exit(1); });
