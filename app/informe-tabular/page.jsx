import Link from 'next/link';
import Navbar from '../components/Navbar.jsx';
import Notice from '../components/Notice.jsx';
import { getTabularReport } from '../../src/data.js';
import { requireUser } from '../../src/session.js';

function value(param) {
  return Array.isArray(param) ? param[0] : param || '';
}

function estadoClase(estado) {
  return 'estado-' + String(estado)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

export default async function TabularReportPage({ searchParams }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const filters = {
    precio_desde: value(params.precio_desde),
    precio_hasta: value(params.precio_hasta),
    color: value(params.color) || 'Todos',
    estado: value(params.estado) || 'Todos',
    fecha_inicio: value(params.fecha_inicio),
    fecha_final: value(params.fecha_final),
  };
  const rows = await getTabularReport(filters);
  const exportQuery = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v && v !== 'Todos')
  );

  return (
    <>
      <Navbar user={user} active="tabular" />
      <main className="contenedor">
        <div className="titulo-box">INFORME TABULAR</div>
        <h2 className="center">Ventas</h2>
        <Notice searchParams={params} />
        <div className="grid-principal informe-layout">
          <section className="table-wrap">
            <table className="informe">
              <thead>
                <tr>
                  <th>Id compra</th><th>Fecha</th><th>Comprador</th>
                  <th>Producto</th><th>Color</th><th>Cantidad</th>
                  <th>Precio compra</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.id_compra}-${row.producto}-${i}`}>
                    <td>{row.id_compra}</td>
                    <td>{String(row.fecha_compra).slice(0, 10)}</td>
                    <td>{row.comprador_nombre}</td>
                    <td>{row.producto}</td>
                    <td>{row.color}</td>
                    <td>{row.cantidad}</td>
                    <td>${Number(row.precio_compra).toFixed(2)}</td>
                    <td className={estadoClase(row.estado_compra)}>{row.estado_compra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="mensaje-vacio">No hay compras que coincidan con el filtro.</p>}
          </section>
          <form className="filtros" method="get">
            <label>Fecha inicio:</label>
            <input type="date" name="fecha_inicio" defaultValue={filters.fecha_inicio} />
            <label>Fecha final:</label>
            <input type="date" name="fecha_final" defaultValue={filters.fecha_final} />
            <label>Precio total por línea:</label>
            <div className="rango">
              <input type="number" min="0" step="0.01" name="precio_desde" placeholder="Desde" defaultValue={filters.precio_desde} />
              <input type="number" min="0" step="0.01" name="precio_hasta" placeholder="Hasta" defaultValue={filters.precio_hasta} />
            </div>
            <label htmlFor="color">Color:</label>
            <select id="color" name="color" defaultValue={filters.color}>
              {['Todos','Verde','Rojo','Azul','Metálico','Negro'].map(c => <option key={c}>{c}</option>)}
            </select>
            <label htmlFor="estado">Estado:</label>
            <select id="estado" name="estado" defaultValue={filters.estado}>
              {['Todos','Solicitándose','En edición','Realizado','Cancelado'].map(e => <option key={e}>{e}</option>)}
            </select>
            <button className="btn btn-block">Aplicar filtro</button>
            <Link className="btn btn-secundario btn-block" href={`/informe-tabular/exportar?${exportQuery}`}>
              Exportar CSV
            </Link>
          </form>
        </div>
      </main>
    </>
  );
}