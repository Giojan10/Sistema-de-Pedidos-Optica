import { query, connect } from '../../../../../src/db.js';
import { checkApiKey } from '../../../../../src/apiAuth.js';
import {
  ok, noContent, notFound, badRequest, pgErrorToResponse, toInt,
} from '../../../../../src/apiHelpers.js';

const ESTADOS = ['Solicitándose', 'En edición', 'Realizado', 'Cancelado'];

/**
 * Máquina de estados: define qué transiciones son válidas.
 * - Realizado y Cancelado son estados terminales.
 */
const TRANSICIONES = {
  'Solicitándose': ['En edición', 'Realizado', 'Cancelado'],
  'En edición':    ['Realizado', 'Cancelado'],
  'Realizado':     [],
  'Cancelado':     [],
};

async function loadId(params) {
  const { id } = await params;
  const n = toInt(id);
  return n && n > 0 ? n : null;
}

/* ---------------- GET uno (con detalle) ---------------- */
export async function GET(request, { params }) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const id = await loadId(params);
  if (!id) return badRequest('ID inválido');

  const { rows: compra } = await query(
    'SELECT * FROM compras WHERE id_compra = $1',
    [id]
  );
  if (!compra[0]) return notFound('Compra no encontrada');

  // Incluir las líneas en la respuesta
  const { rows: detalle } = await query(
    `SELECT cd.id_producto, p.nombre, cd.cantidad, cd.precio_unitario
     FROM compras_detalle cd
     JOIN productos p USING (id_producto)
     WHERE cd.id_compra = $1
     ORDER BY p.nombre`,
    [id]
  );

  return ok({ ...compra[0], detalle });
}

/* ---------------- PUT (solo cambiar estado) ---------------- */
export async function PUT(request, { params }) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const id = await loadId(params);
  if (!id) return badRequest('ID inválido');

  let body;
  try { body = await request.json(); }
  catch { return badRequest('JSON inválido'); }

  const nuevoEstado = body.estado;
  if (!ESTADOS.includes(nuevoEstado))
    return badRequest(`"estado" debe ser uno de: ${ESTADOS.join(', ')}`);

  const client = await connect();
  try {
    await client.query('BEGIN');

    // Bloquear la fila para evitar cambios concurrentes
    const { rows: cur } = await client.query(
      'SELECT * FROM compras WHERE id_compra = $1 FOR UPDATE',
      [id]
    );
    if (!cur[0]) {
      await client.query('ROLLBACK');
      return notFound('Compra no encontrada');
    }

    const actual = cur[0];
    if (actual.estado === nuevoEstado) {
      await client.query('ROLLBACK');
      return ok(actual, { mensaje: 'Sin cambios: el estado ya era ese.' });
    }

    // Validar transición
    if (!TRANSICIONES[actual.estado]?.includes(nuevoEstado)) {
      await client.query('ROLLBACK');
      return badRequest(
        `Transición no permitida: ${actual.estado} → ${nuevoEstado}`
      );
    }

    const { rows: detalle } = await client.query(
      'SELECT id_producto, cantidad FROM compras_detalle WHERE id_compra = $1',
      [id]
    );

    // Efectos en inventario según el caso:
    //  - → Realizado: la reserva se consume (apartada -= cantidad).
    //  - → Cancelado: devuelve todo (disponible += cantidad, apartada -= cantidad).
    if (
      (actual.estado === 'Solicitándose' || actual.estado === 'En edición') &&
      nuevoEstado === 'Realizado'
    ) {
      for (const it of detalle) {
        await client.query(
          `UPDATE productos SET cantidad_apartada = cantidad_apartada - $1
           WHERE id_producto = $2`,
          [it.cantidad, it.id_producto]
        );
      }
    }

    if (nuevoEstado === 'Cancelado') {
      for (const it of detalle) {
        await client.query(
          `UPDATE productos
           SET cantidad_disponible = cantidad_disponible + $1,
               cantidad_apartada    = cantidad_apartada - $1
           WHERE id_producto = $2`,
          [it.cantidad, it.id_producto]
        );
      }
    }

    const { rows: updated } = await client.query(
      `UPDATE compras SET estado = $1, actualizado_en = NOW()
       WHERE id_compra = $2 RETURNING *`,
      [nuevoEstado, id]
    );

    await client.query('COMMIT');
    return ok(updated[0], { tabla: 'compras' });
  } catch (error) {
    await client.query('ROLLBACK');
    return pgErrorToResponse(error);
  } finally {
    client.release();
  }
}

/* ---------------- DELETE (solo pedidos no confirmados) ---------------- */
export async function DELETE(request, { params }) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const id = await loadId(params);
  if (!id) return badRequest('ID inválido');

  const client = await connect();
  try {
    await client.query('BEGIN');

    const { rows: cur } = await client.query(
      'SELECT estado FROM compras WHERE id_compra = $1 FOR UPDATE',
      [id]
    );
    if (!cur[0]) {
      await client.query('ROLLBACK');
      return notFound('Compra no encontrada');
    }

    // Regla: Realizado no se borra, se cancela primero con PUT.
    if (cur[0].estado === 'Realizado') {
      await client.query('ROLLBACK');
      return badRequest(
        'No se puede borrar una compra Realizada. Usa PUT para cancelarla.'
      );
    }

    // Si estaba reservando inventario, devolverlo antes de borrar.
    if (cur[0].estado === 'Solicitándose' || cur[0].estado === 'En edición') {
      const { rows: detalle } = await client.query(
        'SELECT id_producto, cantidad FROM compras_detalle WHERE id_compra = $1',
        [id]
      );
      for (const it of detalle) {
        await client.query(
          `UPDATE productos
           SET cantidad_disponible = cantidad_disponible + $1,
               cantidad_apartada    = cantidad_apartada - $1
           WHERE id_producto = $2`,
          [it.cantidad, it.id_producto]
        );
      }
    }

    // El borrado de compras_detalle ocurre por CASCADE (si está configurado).
    await client.query('DELETE FROM compras WHERE id_compra = $1', [id]);
    await client.query('COMMIT');
    return noContent();
  } catch (error) {
    await client.query('ROLLBACK');
    return pgErrorToResponse(error);
  } finally {
    client.release();
  }
}