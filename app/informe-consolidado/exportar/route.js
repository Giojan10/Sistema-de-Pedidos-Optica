import { requireAdmin } from '../../../src/session.js';
import { getConsolidatedReport } from '../../../src/data.js';

function csvCell(v) {
  return `"${String(v ?? '').replaceAll('"', '""')}"`;
}

export async function GET(request) {
  try {
    await requireAdmin();
  } catch {
    return Response.redirect(new URL('/', request.url), 303);
  }
  const params = new URL(request.url).searchParams;
  const { rows } = await getConsolidatedReport({
    fecha_inicio: params.get('fecha_inicio') || '',
    fecha_final: params.get('fecha_final') || '',
    id_usuario: params.get('id_usuario') || '',
  });
  const header = ['Color', 'Total Productos Vendidos', 'Promedio Precio', 'Ingresos Totales', 'Productos en Inventario'];
  const values = rows.map(r => [
    r.color,
    r.total_productos_vendidos,
    r.promedio_precio,
    r.ingresos_totales,
    r.productos_en_inventario,
  ]);
  const csv = '\uFEFF' + [header, ...values].map(row => row.map(csvCell).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="informe_consolidado_ventas.csv"',
    },
  });
}