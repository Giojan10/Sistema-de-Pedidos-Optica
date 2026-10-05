import { currentCustomer } from '../../../src/session.js';
import { getConsolidatedReport } from '../../../src/data.js';

function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

export async function GET(request) {
  if (!(await currentCustomer())) return Response.redirect(new URL('/', request.url), 303);
  const params = new URL(request.url).searchParams;
  const { rows } = await getConsolidatedReport({ fecha_inicio: params.get('fecha_inicio') || '', fecha_final: params.get('fecha_final') || '', id_cliente: params.get('id_cliente') || '' });
  const header = ['Color','Total Productos Vendidos','Promedio Precio','Ingresos Totales','Unidades Canceladas','Valor Cancelado','Productos en Inventario'];
  const values = rows.map(row => [row.color,row.total_productos_vendidos,row.promedio_precio,row.ingresos_totales,row.unidades_canceladas,row.valor_cancelado,row.productos_en_inventario]);
  const csv = '\uFEFF' + [header, ...values].map(row => row.map(csvCell).join(',')).join('\r\n');
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="informe_consolidado_ventas.csv"' } });
}
