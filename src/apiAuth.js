import { query } from './db.js';

/**
 * Verifica el header Authorization: Bearer <token> contra la tabla api_keys.
 *
 * Retorna `null` si el token es válido (para que el caller sepa que puede continuar),
 * o un objeto `Response` con status 401/403 si hay error (para que el caller lo
 * devuelva tal cual y corte la ejecución).
 *
 * Este patrón "return null = OK, return Response = error" evita lanzar excepciones
 * y mantiene los route handlers simples:
 *
 *   const authError = await checkApiKey(request);
 *   if (authError) return authError;
 *   // ... lógica normal
 */
export async function checkApiKey(request) {
  // 1. Leer el header. Ej: "Bearer sk_live_abc123"
  const authHeader = request.headers.get('authorization') || '';

  // 2. Validar el formato "Bearer <token>" y extraer solo el token.
  //    slice(7) quita exactamente "Bearer " (7 caracteres).
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  // 3. Sin token → 401 (no autenticado).
  if (!token) {
    return Response.json(
      { error: 'Falta header Authorization: Bearer <token>' },
      { status: 401 }
    );
  }

  // 4. Buscar el token en la BD. Debe existir Y estar activo.
  const { rows } = await query(
    'SELECT id_key, nombre FROM api_keys WHERE token = $1 AND activo = TRUE',
    [token]
  );

  // 5. Token no encontrado o inactivo → 403 (autenticado pero sin permiso).
  if (!rows[0]) {
    return Response.json(
      { error: 'Token inválido o inactivo' },
      { status: 403 }
    );
  }

  // 6. Todo OK: el caller continúa.
  return null;
}

/**
 * Parsea los query params `limit` y `offset` con topes de seguridad.
 *
 * - Si `limit` no es un entero positivo, usa `defaultLimit`.
 * - Si `limit` supera `maxLimit`, lo recorta a `maxLimit` (evita que alguien
 *   pida 1.000.000 de filas y tumbe el servidor).
 * - Si `offset` no es un entero >= 0, usa 0.
 *
 * Uso:
 *   const { limit, offset } = paginationFrom(request, 100, 1000);
 *   query('SELECT ... LIMIT $1 OFFSET $2', [limit, offset]);
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