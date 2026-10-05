import { requireAdmin } from '../../../src/session.js';
import { getTabularReport } from '../../../src/data.js';

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
  const rows = await getTabularReport({
    precio_desde: params.get('precio_desde') || '',
    precio_hasta: params.get('precio_hasta') || '',
    color: params.get('color') || 'Todos',
    estado: params.get('estado') || 'Todos',
    fecha_inicio: params.get('fecha_inicio') || '',
    fecha_final: params.get('fecha_final') || '',
  });
  const header = ['Id Compra','Fecha Compra','Comprador','Producto','Color','Cantidad','Precio Compra','Estado'];
  const values = rows.map(r => [
    r.id_compra, String(r.fecha_compra).slice(0, 10), r.comprador_nombre,
    r.producto, r.color, r.cantidad, r.precio_compra, r.estado_compra,
  ]);
  const csv = '\uFEFF' + [header, ...values].map(row => row.map(csvCell).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="informe_tabular_ventas.csv"',
    },
  });
}