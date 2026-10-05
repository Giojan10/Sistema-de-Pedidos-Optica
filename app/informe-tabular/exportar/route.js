import { currentCustomer } from '../../../src/session.js';
import { getTabularReport } from '../../../src/data.js';

function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

export async function GET(request) {
  if (!(await currentCustomer())) return Response.redirect(new URL('/', request.url), 303);
  const params = new URL(request.url).searchParams;
  const rows = await getTabularReport({ precio_desde: params.get('precio_desde') || '', precio_hasta: params.get('precio_hasta') || '', color: params.get('color') || 'Todos' });
  const header = ['Id Compra','Fecha Compra','Comprador','Producto','Color','Cantidad','Precio Compra','Estado'];
  const values = rows.map(row => [row.id_compra,String(row.fecha_compra).slice(0,10),row.comprador_nombre,row.producto,row.color,row.cantidad,row.precio_compra,row.estado_compra]);
  const csv = '\uFEFF' + [header, ...values].map(row => row.map(csvCell).join(',')).join('\r\n');
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="informe_tabular_ventas.csv"' } });
}
