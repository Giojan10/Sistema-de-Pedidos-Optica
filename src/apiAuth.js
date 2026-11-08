import { query } from './db.js';

/**
 * Verifica el header Authorization: Bearer <token> contra la tabla api_keys.
 * Devuelve `null` si es válido, o un `Response` con error 401/403 si no.
 */
export async function checkApiKey(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return Response.json(
      { error: 'Falta header Authorization: Bearer <token>' },
      { status: 401 }
    );
  }

  const { rows } = await query(
    'SELECT id_key, nombre FROM api_keys WHERE token = $1 AND activo = TRUE',
    [token]
  );

  if (!rows[0]) {
    return Response.json(
      { error: 'Token inválido o inactivo' },
      { status: 403 }
    );
  }

  return null; // OK
}

/**
 * Parsea limit/offset con topes seguros.
 */
export function paginationFrom(request, defaultLimit = 100, maxLimit = 1000) {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get('limit'));
  const rawOffset = Number(url.searchParams.get('offset'));

  const limit = Number.isInteger(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, maxLimit)
    : defaultLimit;

  const offset = Number.isInteger(rawOffset) && rawOffset >= 0
    ? rawOffset
    : 0;

  return { limit, offset };
}