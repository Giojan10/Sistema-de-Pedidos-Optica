import { requireAdmin } from '../../../src/session.js';
import { getConsolidatedReport } from '../../../src/data.js';

/** Escapa una celda CSV (ver comentario en mis-pedidos/exportar). */
function csvCell(v) {
  return `"${String(v ?? '').replaceAll('"', '""')}"`;
}

/**
 * GET /informe-consolidado/exportar
 *
 * Genera un CSV con el informe consolidado por color
 * (solo pedidos en estado 'Realizado').
 *
 * Diferencia clave con el informe tabular:
 *   - Aquí cada fila es un COLOR (agregado).
 *   - En el tabular cada fila es una LÍNEA de compra (detalle).
 *
 * El filtro por orden (orden/direccion) SÍ se respeta:
 * el archivo refleja el mismo orden que el usuario ve en pantalla.
 *
 * Solo accesible para Administradores.
 */
export async function GET(request) {
  // 1. Solo Administradores. Si no, redirigir.
  try {
    await requireAdmin();
  } catch {
    return Response.redirect(new URL('/', request.url), 303);
  }

  // 2. Leer los filtros y el orden actual de la URL.
  const params = new URL(request.url).searchParams;
  const { rows } = await getConsolidatedReport({
    fecha_inicio: params.get('fecha_inicio') || '',
    fecha_final: params.get('fecha_final') || '',
    id_usuario: params.get('id_usuario') || '',
    orden: params.get('orden') || '',
    direccion: params.get('direccion') || 'asc',
  });

  // 3. Encabezado del CSV (los nombres son los que ve el usuario en pantalla).
  const header = [
    'Color',
    'Total Productos Vendidos',
    'Promedio Precio',
    'Ingresos Totales',
    'Productos en Inventario',
  ];

  // 4. Mapear cada fila del resultado a un array de columnas.
  const values = rows.map(r => [
    r.color,
    r.total_productos_vendidos,
    r.promedio_precio,
    r.ingresos_totales,
    r.productos_en_inventario,
  ]);

  // 5. Serializar con BOM UTF-8 (necesario para que Excel muestre bien
  //    los acentos en los nombres de color: "Metálico").
  const csv = '\uFEFF' + [header, ...values]
    .map(row => row.map(csvCell).join(','))
    .join('\r\n');

  // 6. Devolver como descarga.
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="informe_consolidado_ventas.csv"',
    },
  });
}