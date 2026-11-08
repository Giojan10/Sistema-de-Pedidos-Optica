import { requireUser } from '../../../src/session.js';
import { getMyOrders, getOrderDetails } from '../../../src/data.js';

function csvCell(v) {
  return `"${String(v ?? '').replaceAll('"', '""')}"`;
}

export async function GET(request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.redirect(new URL('/', request.url), 303);
  }

  const params = new URL(request.url).searchParams;
  const filters = {
    estado: params.get('estado') || '',
    fecha_inicio: params.get('fecha_inicio') || '',
    fecha_final: params.get('fecha_final') || '',
    buscar: params.get('buscar') || '',
  };

  // Trae TODOS los pedidos del usuario (sin paginar) para exportar
  const { pedidos } = await getMyOrders(user.id_usuario, filters, {
    limit: 10_000,
    offset: 0,
  });

  const ids = pedidos.map(p => p.id_compra);
  const detalleMap = await getOrderDetails(user.id_usuario, ids);

  const header = [
    'Pedido', 'Fecha', 'Hora', 'Estado',
    'Producto', 'Color', 'Cantidad',
    'Precio Unitario', 'Subtotal',
  ];

  const filas = [];
  for (const p of pedidos) {
    const items = detalleMap.get(p.id_compra) || [];
    if (!items.length) {
      filas.push([
        p.id_compra,
        String(p.fecha).slice(0, 10),
        String(p.hora).slice(0, 8),
        p.estado,
        '', '', '', '', '',
      ]);
    } else {
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

  const csv = '\uFEFF' + [header, ...filas]
    .map(row => row.map(csvCell).join(','))
    .join('\r\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mis_pedidos.csv"',
    },
  });
}