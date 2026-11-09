import { requireUser } from '../../../src/session.js';
import { getMyOrders, getOrderDetails } from '../../../src/data.js';

/**
 * Escapa un valor para que sea seguro dentro de una celda CSV.
 *
 * - Envuelve el valor en comillas dobles.
 * - Duplica las comillas internas (regla del RFC 4180).
 * - Convierte null/undefined en string vacío.
 *
 * Ejemplo:
 *   csvCell('Hola "mundo"')  →  '"Hola ""mundo"""'
 *   csvCell(null)            →  '""'
 */
function csvCell(v) {
  return `"${String(v ?? '').replaceAll('"', '""')}"`;
}

/**
 * GET /mis-pedidos/exportar
 *
 * Genera un CSV con TODOS los pedidos del usuario autenticado,
 * respetando los filtros de la vista (estado, fechas, búsqueda).
 *
 * Formato del CSV: una fila por LÍNEA de compra (producto × pedido).
 * Si un pedido tiene 3 productos, aparece 3 veces (con los mismos
 * datos de cabecera: id_compra, fecha, estado).
 *
 * ¿Por qué una fila por línea y no una por pedido?
 *   Porque el detalle de productos es la información útil para
 *   contabilidad/inventario. Un pedido con una sola fila "resumen"
 *   perdería los productos comprados.
 */
export async function GET(request) {
  // 1. Verificar sesión. Si no hay usuario válido, redirigir al login.
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.redirect(new URL('/', request.url), 303);
  }

  // 2. Leer los filtros de la query string.
  //    Los valores vienen de la URL que el frontend arma con
  //    los filtros activos del usuario.
  const params = new URL(request.url).searchParams;
  const filters = {
    estado: params.get('estado') || '',
    fecha_inicio: params.get('fecha_inicio') || '',
    fecha_final: params.get('fecha_final') || '',
    buscar: params.get('buscar') || '',
  };

  // 3. Traer TODOS los pedidos del usuario (sin paginar).
  //    El límite de 10.000 es un tope de seguridad: si un usuario
  //    tuviera más pedidos, sería mejor paginar el CSV, pero para
  //    un cliente normal es suficiente.
  const { pedidos } = await getMyOrders(user.id_usuario, filters, {
    limit: 10_000,
    offset: 0,
  });

  // 4. Traer las líneas de detalle de todos los pedidos en una sola query.
  //    getOrderDetails devuelve un Map<id_compra, Array<linea>>,
  //    lo cual evita hacer N queries (una por pedido).
  const ids = pedidos.map(p => p.id_compra);
  const detalleMap = await getOrderDetails(user.id_usuario, ids);

  // 5. Definir el encabezado del CSV (nombres legibles para el usuario).
  const header = [
    'Pedido', 'Fecha', 'Hora', 'Estado',
    'Producto', 'Color', 'Cantidad',
    'Precio Unitario', 'Subtotal',
  ];

  // 6. Construir las filas.
  const filas = [];
  for (const p of pedidos) {
    const items = detalleMap.get(p.id_compra) || [];

    if (!items.length) {
      // Pedido sin líneas (raro, pero posible si se borró el detalle):
      // se emite una fila con la cabecera y columnas de producto vacías.
      filas.push([
        p.id_compra,
        String(p.fecha).slice(0, 10),   // "YYYY-MM-DD"
        String(p.hora).slice(0, 8),     // "HH:MM:SS"
        p.estado,
        '', '', '', '', '',             // 5 columnas vacías: producto, color, cantidad, precio, subtotal
      ]);
    } else {
      // Pedido con líneas: una fila por cada producto comprado.
      for (const it of items) {
        filas.push([
          p.id_compra,
          String(p.fecha).slice(0, 10),
          String(p.hora).slice(0, 8),
          p.estado,
          it.nombre,
          it.color,
          it.cantidad,
          it.precio_unitario,
          it.subtotal,
        ]);
      }
    }
  }

  // 7. Serializar a CSV.
  //    - '\uFEFF' (BOM UTF-8): hace que Excel abra el archivo con la
  //      codificación correcta y no muestre caracteres extraños (Ã¡, Ã±).
  //    - Cada fila se une con ',' tras escapar cada celda.
  //    - Las filas se unen con '\r\n' (CRLF) para máxima compatibilidad
  //      con Excel en Windows.
  const csv = '\uFEFF' + [header, ...filas]
    .map(row => row.map(csvCell).join(','))
    .join('\r\n');

  // 8. Devolver la respuesta con los headers correctos para que el
  //    navegador descargue el archivo en lugar de mostrarlo inline.
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mis_pedidos.csv"',
    },
  });
}