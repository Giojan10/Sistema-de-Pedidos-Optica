/* ============================================================
   Helpers de respuesta y errores
   ============================================================ */

export function ok(data, extra = {}) {
  return Response.json({ ok: true, ...extra, data }, { status: 200 });
}

export function created(data, extra = {}) {
  return Response.json({ ok: true, ...extra, data }, { status: 201 });
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export function badRequest(message, detalle = null) {
  return Response.json({ ok: false, error: message, detalle }, { status: 400 });
}

export function notFound(message = 'Recurso no encontrado') {
  return Response.json({ ok: false, error: message }, { status: 404 });
}

export function conflict(message) {
  return Response.json({ ok: false, error: message }, { status: 409 });
}

/**
 * Traduce errores de PostgreSQL a respuestas HTTP coherentes.
 */
export function pgErrorToResponse(error) {
  console.error('PG error:', error);

  // Violación de UNIQUE
  if (error.code === '23505') {
    return conflict(`Valor duplicado: ${error.detail || error.constraint || 'restricción única'}`);
  }
  // Violación de FK
  if (error.code === '23503') {
    return badRequest(
      `Referencia inexistente: ${error.detail || 'una clave foránea no coincide'}`
    );
  }
  // Violación de CHECK
  if (error.code === '23514') {
    return badRequest(`Restricción violada: ${error.constraint}`);
  }
  // NOT NULL
  if (error.code === '23502') {
    return badRequest(`Campo obligatorio faltante: ${error.column}`);
  }
  // Tipo inválido
  if (error.code === '22P02') {
    return badRequest('Tipo de dato inválido en uno de los campos');
  }
  return Response.json({ ok: false, error: 'Error interno' }, { status: 500 });
}

/**
 * Valida y normaliza enteros.
 */
export function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

/**
 * Valida y normaliza decimales (numéricos).
 */
export function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}