import { query, connect } from '../../../../src/db.js';
import { checkApiKey, paginationFrom } from '../../../../src/apiAuth.js';
import {
  ok, created, badRequest, pgErrorToResponse, toInt,
} from '../../../../src/apiHelpers.js';

const ESTADOS = ['Solicitándose', 'En edición', 'Realizado', 'Cancelado'];

/* ---------------- GET (lista) ---------------- */
export async function GET(request) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const { limit, offset } = paginationFrom(request);

  try {
    const { rows } = await query(
      `SELECT id_compra, id_usuario, fecha, hora, estado, actualizado_en
       FROM compras
       ORDER BY id_compra
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return ok(rows, { tabla: 'compras', paginacion: { limit, offset } });
  } catch (error) {
    return pgErrorToResponse(error);
  }
}

/* ---------------- POST (crear pedido completo) ---------------- */
export async function POST(request) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  let body;
  try { body = await request.json(); }
  catch { return badRequest('JSON inválido'); }

  const idUsuario = toInt(body.id_usuario);
  const estado = body.estado && ESTADOS.includes(body.estado) ? body.estado : 'Realizado';
  const items = Array.isArray(body.items) ? body.items : [];

  if (!idUsuario) return badRequest('Campo "id_usuario" obligatorio.');
  if (!items.length) return badRequest('Debe incluir al menos un ítem en "items".');

  // Validar cada ítem
  for (const it of items) {
    if (!toInt(it.id_producto) || !toInt(it.cantidad) || it.cantidad < 1)
      return badRequest('Cada ítem requiere "id_producto" y "cantidad" (≥1).');
  }

  // Transacción: compra + detalle + inventario deben ser atómicos.
  const client = await connect();
  try {
    await client.query('BEGIN');

    // 1. Validar usuario
    const { rows: usr } = await client.query(
      'SELECT id_usuario FROM usuarios WHERE id_usuario = $1',
      [idUsuario]
    );
    if (!usr[0]) {
      await client.query('ROLLBACK');
      return badRequest('Usuario no existe.');
    }

    // 2. Crear compra (cabecera)
    const { rows: compraRows } = await client.query(
      `INSERT INTO compras (id_usuario, fecha, hora, estado)
       VALUES ($1, CURRENT_DATE, LOCALTIME, $2)
       RETURNING id_compra, id_usuario, fecha, hora, estado`,
      [idUsuario, estado]
    );
    const compra = compraRows[0];

    // 3. Para cada ítem: verificar stock, insertar detalle, mover inventario
    for (const it of items) {
      const { rows: prod } = await client.query(
        'SELECT precio_unitario, cantidad_disponible FROM productos WHERE id_producto = $1 FOR UPDATE',
        [it.id_producto]
      );
      if (!prod[0]) {
        await client.query('ROLLBACK');
        return badRequest(`Producto ${it.id_producto} no existe.`);
      }
      if (prod[0].cantidad_disponible < it.cantidad) {
        await client.query('ROLLBACK');
        return badRequest(`Stock insuficiente para producto ${it.id_producto}.`);
      }

      const precio = Number(prod[0].precio_unitario);

      // Insertar línea de detalle (precio congelado al momento de la compra)
      await client.query(
        `INSERT INTO compras_detalle (id_compra, id_producto, cantidad, precio_unitario)
         VALUES ($1,$2,$3,$4)`,
        [compra.id_compra, it.id_producto, it.cantidad, precio]
      );

      // Actualizar inventario según el estado inicial:
      //  - Realizado: descuenta disponible (venta consumada).
      //  - Solicitándose/En edición: mueve de disponible a apartada (reserva).
      if (estado === 'Realizado') {
        await client.query(
          'UPDATE productos SET cantidad_disponible = cantidad_disponible - $1 WHERE id_producto = $2',
          [it.cantidad, it.id_producto]
        );
      } else if (estado === 'Solicitándose' || estado === 'En edición') {
        await client.query(
          `UPDATE productos
           SET cantidad_disponible = cantidad_disponible - $1,
               cantidad_apartada    = cantidad_apartada + $1
           WHERE id_producto = $2`,
          [it.cantidad, it.id_producto]
        );
      }
    }

    await client.query('COMMIT');
    return created(compra, { tabla: 'compras' });
  } catch (error) {
    await client.query('ROLLBACK');
    return pgErrorToResponse(error);
  } finally {
    client.release();
  }
}