/* ============================================================
   Helpers de respuesta y errores
   ------------------------------------------------------------
   Centralizan el formato JSON de la API para que todos los
   endpoints devuelvan exactamente la misma estructura:
     { ok: true, data: ... }
     { ok: false, error: '...' }
   ============================================================ */

/** Respuesta exitosa genérica con status 200. */
export function ok(data, extra = {}) {
  return Response.json({ ok: true, ...extra, data }, { status: 200 });
}

/** Respuesta exitosa al crear un recurso (status 201). */
export function created(data, extra = {}) {
  return Response.json({ ok: true, ...extra, data }, { status: 201 });
}

/** Respuesta sin cuerpo al borrar exitosamente (status 204). */
export function noContent() {
  return new Response(null, { status: 204 });
}

/** Error de validación (400). */
export function badRequest(message, detalle = null) {
  return Response.json({ ok: false, error: message, detalle }, { status: 400 });
}

/** Recurso no encontrado (404). */
export function notFound(message = 'Recurso no encontrado') {
  return Response.json({ ok: false, error: message }, { status: 404 });
}

/** Conflicto por violación de unicidad (409). */
export function conflict(message) {
  return Response.json({ ok: false, error: message }, { status: 409 });
}

/**
 * Traduce un error de PostgreSQL (código SQLSTATE) a una respuesta HTTP coherente.
 *
 * Códigos más comunes:
 *   23505 = UNIQUE violation       → 409 Conflict
 *   23503 = FOREIGN KEY violation  → 400 Bad Request
 *   23514 = CHECK violation        → 400 Bad Request
 *   23502 = NOT NULL violation     → 400 Bad Request
 *   22P02 = invalid text repr.     → 400 Bad Request
 *
 * Cualquier otro error → 500 (no se filtra el detalle interno al cliente).
 */
export function pgErrorToResponse(error) {
  console.error('PG error:', error);

  if (error.code === '23505') {
    return conflict(`Valor duplicado: ${error.detail || error.constraint || 'restricción única'}`);
  }
  if (error.code === '23503') {
    return badRequest(
      `Referencia inexistente: ${error.detail || 'una clave foránea no coincide'}`
    );
  }
  if (error.code === '23514') {
    return badRequest(`Restricción violada: ${error.constraint}`);
  }
  if (error.code === '23502') {
    return badRequest(`Campo obligatorio faltante: ${error.column}`);
  }
  if (error.code === '22P02') {
    return badRequest('Tipo de dato inválido en uno de los campos');
  }
  return Response.json({ ok: false, error: 'Error interno' }, { status: 500 });
}

/**
 * Convierte un valor en entero.
 * Devuelve `null` si no es un entero válido (para usarlo como validación).
 */
export function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

/**
 * Convierte un valor en número decimal.
 * Devuelve `null` si no es finito (NaN, Infinity, undefined).
 */
export function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}