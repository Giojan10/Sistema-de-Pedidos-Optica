import { query } from '../../../../src/db.js';
import { checkApiKey, paginationFrom } from '../../../../src/apiAuth.js';
import {
  ok, created, badRequest, pgErrorToResponse, toInt, toNumber,
} from '../../../../src/apiHelpers.js';

/* ---------------- GET (lista) ---------------- */
export async function GET(request) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const { limit, offset } = paginationFrom(request);

  try {
    const { rows } = await query(
      `SELECT id_producto, nombre, descripcion, color, imagen_url,
              cantidad_disponible, cantidad_apartada, precio_unitario, activo
       FROM productos
       ORDER BY id_producto
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return ok(rows, { tabla: 'productos', paginacion: { limit, offset } });
  } catch (error) {
    return pgErrorToResponse(error);
  }
}

/* ---------------- POST (crear producto) ---------------- */
export async function POST(request) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  let body;
  try { body = await request.json(); }
  catch { return badRequest('JSON inválido'); }

  // Normalización
  const nombre = String(body.nombre || '').trim();
  const descripcion = body.descripcion ? String(body.descripcion).trim() : null;
  const color = String(body.color || '').trim();
  const imagenUrl = body.imagen_url ? String(body.imagen_url).trim() : null;
  const disponible = toInt(body.cantidad_disponible) ?? 0;
  const apartada = toInt(body.cantidad_apartada) ?? 0;
  const precio = toNumber(body.precio_unitario);
  const activo = body.activo !== undefined ? Boolean(body.activo) : true;

  // Validaciones
  if (!nombre) return badRequest('Campo "nombre" obligatorio.');
  if (!color) return badRequest('Campo "color" obligatorio.');
  if (precio === null || precio < 0)
    return badRequest('Campo "precio_unitario" debe ser ≥ 0.');
  if (disponible < 0 || apartada < 0)
    return badRequest('Cantidades no pueden ser negativas.');

  try {
    const { rows } = await query(
      `INSERT INTO productos
         (nombre, descripcion, color, imagen_url, cantidad_disponible,
          cantidad_apartada, precio_unitario, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [nombre, descripcion, color, imagenUrl, disponible, apartada, precio, activo]
    );
    return created(rows[0], { tabla: 'productos' });
  } catch (error) {
    return pgErrorToResponse(error);
  }
}