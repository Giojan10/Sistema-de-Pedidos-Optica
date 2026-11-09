import { query } from '../../../../../../src/db.js';
import { checkApiKey } from '../../../../../../src/apiAuth.js';
import {
  ok, badRequest, notFound, pgErrorToResponse, toInt,
} from '../../../../../../src/apiHelpers.js';

/**
 * Líneas de UNA compra específica.
 * Se valida primero que la compra exista (evita devolver [] sin contexto).
 */
export async function GET(request, { params }) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const { id } = await params;
  const idCompra = toInt(id);
  if (!idCompra || idCompra < 1) return badRequest('ID inválido');

  try {
    const { rows: compra } = await query(
      'SELECT id_compra FROM compras WHERE id_compra = $1',
      [idCompra]
    );
    if (!compra[0]) return notFound('Compra no encontrada');

    const { rows } = await query(
      `SELECT cd.id_producto, p.nombre, cd.cantidad, cd.precio_unitario
       FROM compras_detalle cd
       JOIN productos p USING (id_producto)
       WHERE cd.id_compra = $1
       ORDER BY p.nombre`,
      [idCompra]
    );
    return ok(rows, { tabla: 'compras_detalle' });
  } catch (error) {
    return pgErrorToResponse(error);
  }
}