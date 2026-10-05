import Link from 'next/link';
import Navbar from '../components/Navbar.jsx';
import Notice from '../components/Notice.jsx';
import { getConsolidatedReport } from '../../src/data.js';
import { requireUser } from '../../src/session.js';

function value(param) {
  return Array.isArray(param) ? param[0] : param || '';
}

export default async function ConsolidatedReportPage({ searchParams }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const filters = {
    fecha_inicio: value(params.fecha_inicio),
    fecha_final: value(params.fecha_final),
    id_usuario: value(params.id_usuario),
  };
  const { rows, usuarios } = await getConsolidatedReport(filters);
  const seleccionado = usuarios.find(u => String(u.id_usuario) === String(filters.id_usuario));
  const max = Math.max(1, ...rows.map(r => Number(r.total_productos_vendidos)));
  const exportQuery = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v)
  );

  return (
    <>
      <Navbar user={user} active="consolidado" />
      <main className="contenedor">
        <div className="titulo-box">INFORME CONSOLIDADO Y GRÁFICO</div>
        <Notice searchParams={params} />

        <form className="filtros filtros-linea" method="get">
          <div>
            <label>Fecha de inicio:</label>
            <input type="date" name="fecha_inicio" defaultValue={filters.fecha_inicio} />
          </div>
          <div>
            <label>Fecha final:</label>
            <input type="date" name="fecha_final" defaultValue={filters.fecha_final} />
          </div>
          <div className="grow">
            <label>Usuario:</label>
            <select name="id_usuario" defaultValue={filters.id_usuario}>
              <option value="">Todos</option>
              {usuarios.map(u => (
                <option key={u.id_usuario} value={u.id_usuario}>
                  {u.nombre} ({u.usuario})
                </option>
              ))}
            </select>
          </div>
          <button className="btn">Aplicar</button>
          <Link className="btn btn-secundario" href={`/informe-consolidado/exportar?${exportQuery}`}>
            Exportar CSV
          </Link>
        </form>

        <div className="grid-principal report-grid">
          <section>
            <h3>Rendimiento de ventas por color</h3>
            <p className="subtitulo">Solo se contabilizan pedidos en estado <strong>Realizado</strong>.</p>
            <div className="table-wrap">
              <table className="informe">
                <thead>
                  <tr>
                    <th>Color</th>
                    <th>Unidades vendidas</th>
                    <th>Precio promedio</th>
                    <th>Ingresos totales</th>
                    <th>Inventario disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.color}>
                      <td>{r.color}</td>
                      <td>{r.total_productos_vendidos}</td>
                      <td>${Number(r.promedio_precio).toFixed(2)}</td>
                      <td>${Number(r.ingresos_totales).toFixed(2)}</td>
                      <td>{r.productos_en_inventario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && <p className="mensaje-vacio">No hay pedidos realizados para el periodo seleccionado.</p>}
            <p><strong>Usuario:</strong> {seleccionado?.nombre || 'Todos'}</p>
          </section>

          <section className="grafico-caja">
            <h3>Unidades vendidas por color</h3>
            {rows.map(r => (
              <div className="bar-row" key={r.color}>
                <span>{r.color}</span>
                <div className="bar-track">
                  <div className="bar" style={{ width: `${Math.max(3, Number(r.total_productos_vendidos) / max * 100)}%` }} />
                </div>
                <strong>{r.total_productos_vendidos}</strong>
              </div>
            ))}
            {!rows.length && <p className="mensaje-vacio">Sin datos para graficar.</p>}
          </section>
        </div>
      </main>
    </>
  );
}