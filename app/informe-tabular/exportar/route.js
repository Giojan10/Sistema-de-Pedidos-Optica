import { requireAdmin } from '../../../src/session.js';
import { getTabularReport } from '../../../src/data.js';

/** Escapa una celda CSV (ver comentario en mis-pedidos/exportar). */
function csvCell(v) {
  return `"${String(v ?? '').replaceAll('"', '""')}"`;
}

/**
 * GET /informe-tabular/exportar
 *
 * Genera un CSV con TODAS las líneas de compra (producto × pedido),
 * aplicando los mismos filtros y orden que la vista tabular.
 *
 * A diferencia del consolidado, este NO agrega: una fila por línea.
 * Es el reporte "detallado" que se usa para auditoría o contabilidad.
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

  // 2. Leer TODOS los filtros de la URL (incluye orden/dirección).
  //    Los valores por defecto coinciden con los de la página.
  const params = new URL(request.url).searchParams;
  const rows = await getTabularReport({
    precio_desde: params.get('precio_desde') || '',
    precio_hasta: params.get('precio_hasta') || '',
    color: params.get('color') || 'Todos',
    estado: params.get('estado') || 'Todos',
    fecha_inicio: params.get('fecha_inicio') || '',
    fecha_final: params.get('fecha_final') || '',
    id_usuario: params.get('id_usuario') || '',
    orden: params.get('orden') || '',
    direccion: params.get('direccion') || 'asc',
  });

  // 3. Encabezado del CSV.
  const header = [
    'Id Compra', 'Fecha Compra', 'Comprador', 'Producto',
    'Color', 'Cantidad', 'Precio Compra', 'Estado',
  ];

  // 4. Mapear cada fila.
  //    - fecha_compra se recorta a YYYY-MM-DD (por si viene con zona horaria).
  //    - precio_compra se deja como viene (ya es numérico).
  const values = rows.map(r => [
    r.id_compra,
    String(r.fecha_compra).slice(0, 10),
    r.comprador_nombre,
    r.producto,
    r.color,
    r.cantidad,
    r.precio_compra,
    r.estado_compra,
  ]);

  // 5. Serializar a CSV con BOM.
  const csv = '\uFEFF' + [header, ...values]
    .map(row => row.map(csvCell).join(','))
    .join('\r\n');

  // 6. Devolver como descarga.
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="informe_tabular_ventas.csv"',
    },
  });
}