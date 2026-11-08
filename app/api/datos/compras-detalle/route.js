import { query } from '../../../../src/db.js';
import { checkApiKey, paginationFrom } from '../../../../src/apiAuth.js';
import { ok, pgErrorToResponse } from '../../../../src/apiHelpers.js';

export async function GET(request) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const { limit, offset } = paginationFrom(request);

  try {
    const { rows } = await query(
      `SELECT id_compra, id_producto, cantidad, precio_unitario
       FROM compras_detalle
       ORDER BY id_compra, id_producto
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return ok(rows, { tabla: 'compras_detalle', paginacion: { limit, offset } });
  } catch (error) {
    return pgErrorToResponse(error);
  }
}