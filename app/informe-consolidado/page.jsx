import Link from 'next/link';
import Navbar from '../components/Navbar.jsx';
import { getConsolidatedReport } from '../../src/data.js';
import { requireCustomer } from '../../src/session.js';

function value(param) { return Array.isArray(param) ? param[0] : param || ''; }

export default async function ConsolidatedReportPage({ searchParams }) {
  const [customer, params] = await Promise.all([requireCustomer(), searchParams]);
  const filters = { fecha_inicio: value(params.fecha_inicio), fecha_final: value(params.fecha_final), id_cliente: value(params.id_cliente) };
  const { rows, customers } = await getConsolidatedReport(filters);
  const selectedCustomer = customers.find(item => String(item.id_cliente) === String(filters.id_cliente));
  const max = Math.max(1, ...rows.map(row => Number(row.total_productos_vendidos)));
  const exportQuery = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  return <>
    <Navbar customer={customer} active="consolidado" />
    <main className="contenedor">
      <div className="titulo-box">INFORME CONSOLIDADO Y GRÁFICO</div>
      <form className="filtros filtros-linea" method="get">
        <div><label>Fecha de inicio:</label><input type="date" name="fecha_inicio" defaultValue={filters.fecha_inicio} /></div>
        <div><label>Fecha final:</label><input type="date" name="fecha_final" defaultValue={filters.fecha_final} /></div>
        <div className="grow"><label>Cliente:</label><select name="id_cliente" defaultValue={filters.id_cliente}><option value="">Todos</option>{customers.map(item => <option key={item.id_cliente} value={item.id_cliente}>{item.nombre}</option>)}</select></div>
        <button className="btn">Aplicar</button><Link className="btn btn-secundario" href={`/informe-consolidado/exportar?${exportQuery}`}>Exportar CSV</Link>
      </form>
      <div className="grid-principal report-grid">
        <section><h3>Rendimiento de ventas por color</h3><div className="table-wrap"><table className="informe"><thead><tr><th>Color</th><th>Unidades vendidas</th><th>Precio promedio</th><th>Ingresos totales</th><th>Inventario disponible</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.color}><td>{row.color}</td><td>{row.total_productos_vendidos}</td><td>${Number(row.promedio_precio).toFixed(2)}</td><td>${Number(row.ingresos_totales).toFixed(2)}</td><td>{row.productos_en_inventario}</td></tr>)}</tbody>
        </table></div>{!rows.length && <p className="mensaje-vacio">No hay datos para el periodo seleccionado.</p>}<p><strong>Cliente:</strong> {selectedCustomer?.nombre || 'Todos'}</p></section>
        <section className="grafico-caja"><h3>Unidades vendidas por color</h3>{rows.map(row => <div className="bar-row" key={row.color}><span>{row.color}</span><div className="bar-track"><div className="bar" style={{ width: `${Math.max(3, Number(row.total_productos_vendidos) / max * 100)}%` }} /></div><strong>{row.total_productos_vendidos}</strong></div>)}{!rows.length && <p className="mensaje-vacio">Sin datos para graficar.</p>}</section>
      </div>
    </main>
  </>;
}
