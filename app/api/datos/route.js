import { query } from '../../../src/db.js';
import { checkApiKey, paginationFrom } from '../../../src/apiAuth.js';

/**
 * GET /api/datos
 * Devuelve un snapshot completo de las tablas principales.
 * Requiere: Authorization: Bearer <token>
 * Query params opcionales: ?limit=100&offset=0
 *
 * Útil para que un sistema externo haga una sincronización inicial
 * sin tener que llamar 4 endpoints distintos.
 */
export async function GET(request) {
  // 1. Autenticación
  const authError = await checkApiKey(request);
  if (authError) return authError;

  // 2. Paginación (misma para las 4 tablas)
  const { limit, offset } = paginationFrom(request);

  try {
    // 3. Ejecutar las 4 consultas en paralelo
    const [
      { rows: usuarios },
      { rows: productos },
      { rows: compras },
      { rows: comprasDetalle },
    ] = await Promise.all([
      query(
        `SELECT id_usuario, usuario, rol, nombre, email, telefono,
                fecha_nacimiento, activo, creado_en
         FROM usuarios
         ORDER BY id_usuario
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      query(
        `SELECT id_producto, nombre, descripcion, color, imagen_url,
                cantidad_disponible, cantidad_apartada, precio_unitario, activo
         FROM productos
         ORDER BY id_producto
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      query(
        `SELECT id_compra, id_usuario, fecha, hora, estado, actualizado_en
         FROM compras
         ORDER BY id_compra
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      query(
        `SELECT id_compra, id_producto, cantidad, precio_unitario
         FROM compras_detalle
         ORDER BY id_compra, id_producto
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    // 4. Devolver todo junto con metadatos
    return Response.json({
      ok: true,
      generado_en: new Date().toISOString(),
      paginacion: { limit, offset },
      tablas: {
        usuarios: { filas: usuarios.length, data: usuarios },
        productos: { filas: productos.length, data: productos },
        compras: { filas: compras.length, data: compras },
        compras_detalle: { filas: comprasDetalle.length, data: comprasDetalle },
      },
    });
  } catch (error) {
    console.error('API /datos error:', error);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}