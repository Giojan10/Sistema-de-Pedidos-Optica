import { query, connect } from '../../../../../src/db.js';
import { checkApiKey } from '../../../../../src/apiAuth.js';
import {
  ok, noContent, notFound, badRequest, pgErrorToResponse, toInt, toNumber,
} from '../../../../../src/apiHelpers.js';

async function loadId(params) {
  const { id } = await params;
  const n = toInt(id);
  return n && n > 0 ? n : null;
}

/* ---------------- GET uno ---------------- */
export async function GET(request, { params }) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const id = await loadId(params);
  if (!id) return badRequest('ID inválido');

  const { rows } = await query('SELECT * FROM productos WHERE id_producto = $1', [id]);
  if (!rows[0]) return notFound('Producto no encontrado');
  return ok(rows[0]);
}

/* ---------------- PUT (actualizar) ---------------- */
export async function PUT(request, { params }) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const id = await loadId(params);
  if (!id) return badRequest('ID inválido');

  let body;
  try { body = await request.json(); }
  catch { return badRequest('JSON inválido'); }

  const { rows: actual } = await query(
    'SELECT * FROM productos WHERE id_producto = $1',
    [id]
  );
  if (!actual[0]) return notFound('Producto no encontrado');
  const p = actual[0];

  const nombre = body.nombre !== undefined ? String(body.nombre).trim() : p.nombre;
  const descripcion = body.descripcion !== undefined
    ? (body.descripcion ? String(body.descripcion).trim() : null)
    : p.descripcion;
  const color = body.color !== undefined ? String(body.color).trim() : p.color;
  const imagenUrl = body.imagen_url !== undefined
    ? (body.imagen_url ? String(body.imagen_url).trim() : null)
    : p.imagen_url;
  const disponible = body.cantidad_disponible !== undefined
    ? toInt(body.cantidad_disponible) : p.cantidad_disponible;
  const apartada = body.cantidad_apartada !== undefined
    ? toInt(body.cantidad_apartada) : p.cantidad_apartada;
  const precio = body.precio_unitario !== undefined
    ? toNumber(body.precio_unitario) : Number(p.precio_unitario);
  const activo = body.activo !== undefined ? Boolean(body.activo) : p.activo;

  if (!nombre) return badRequest('"nombre" no puede quedar vacío.');
  if (!color) return badRequest('"color" no puede quedar vacío.');
  if (precio === null || precio < 0)
    return badRequest('"precio_unitario" debe ser ≥ 0.');
  if (disponible === null || disponible < 0)
    return badRequest('"cantidad_disponible" debe ser ≥ 0.');
  if (apartada === null || apartada < 0)
    return badRequest('"cantidad_apartada" debe ser ≥ 0.');

  try {
    const { rows } = await query(
      `UPDATE productos
       SET nombre = $1, descripcion = $2, color = $3, imagen_url = $4,
           cantidad_disponible = $5, cantidad_apartada = $6,
           precio_unitario = $7, activo = $8
       WHERE id_producto = $9
       RETURNING *`,
      [nombre, descripcion, color, imagenUrl, disponible, apartada, precio, activo, id]
    );
    return ok(rows[0], { tabla: 'productos' });
  } catch (error) {
    return pgErrorToResponse(error);
  }
}

/* ---------------- DELETE (solo si no hay ventas) ---------------- */
export async function DELETE(request, { params }) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const id = await loadId(params);
  if (!id) return badRequest('ID inválido');

  const { rows: usos } = await query(
    'SELECT COUNT(*)::int AS n FROM compras_detalle WHERE id_producto = $1',
    [id]
  );
  if (usos[0].n > 0) {
    return badRequest(
      `No se puede borrar: el producto aparece en ${usos[0].n} línea(s) de compra. ` +
      `Usa PUT con activo=false.`
    );
  }

  const client = await connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM productos WHERE id_producto = $1', [id]);
    await client.query('COMMIT');
    return noContent();
  } catch (error) {
    await client.query('ROLLBACK');
    return pgErrorToResponse(error);
  } finally {
    client.release();
  }
}