import Link from 'next/link';
import Navbar from '../components/Navbar.jsx';
import Notice from '../components/Notice.jsx';
import SortHeader from '../components/SortHeader.jsx';
import { getTabularReport, listUsuariosParaFiltro } from '../../src/data.js';
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
    id_usuario: value(params.id_usuario),
    orden: value(params.orden) || '',
    direccion: value(params.direccion) || 'asc',
  };

  const [rows, usuarios] = await Promise.all([
    getTabularReport(filters),
    listUsuariosParaFiltro(),
  ]);

  // Base de filtros para reconstruir URLs sin perder estado
  const baseQuery = {
    precio_desde: filters.precio_desde,
    precio_hasta: filters.precio_hasta,
    color: filters.color,
    estado: filters.estado,
    fecha_inicio: filters.fecha_inicio,
    fecha_final: filters.fecha_final,
    id_usuario: filters.id_usuario,
  };

  const exportQuery = new URLSearchParams(
    Object.entries(baseQuery).filter(([, v]) => v && v !== 'Todos')
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
                  <SortHeader column="id_compra" label="Id compra" current={filters} baseQuery={baseQuery} basePath="/informe-tabular" />
                  <SortHeader column="fecha"     label="Fecha"     current={filters} baseQuery={baseQuery} basePath="/informe-tabular" />
                  <SortHeader column="comprador" label="Comprador" current={filters} baseQuery={baseQuery} basePath="/informe-tabular" />
                  <SortHeader column="producto"  label="Producto"  current={filters} baseQuery={baseQuery} basePath="/informe-tabular" />
                  <SortHeader column="color"     label="Color"     current={filters} baseQuery={baseQuery} basePath="/informe-tabular" />
                  <SortHeader column="cantidad"  label="Cantidad"  current={filters} baseQuery={baseQuery} basePath="/informe-tabular" />
                  <SortHeader column="precio"    label="Precio compra" current={filters} baseQuery={baseQuery} basePath="/informe-tabular" />
                  <SortHeader column="estado"    label="Estado"    current={filters} baseQuery={baseQuery} basePath="/informe-tabular" />
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
            {/* Preservar el orden actual al aplicar filtros */}
            <input type="hidden" name="orden" value={filters.orden} />
            <input type="hidden" name="direccion" value={filters.direccion} />

            <label htmlFor="f-usuario">Usuario:</label>
            <select id="f-usuario" name="id_usuario" defaultValue={filters.id_usuario}>
              <option value="">Todos</option>
              {usuarios.map(u => (
                <option key={u.id_usuario} value={u.id_usuario}>
                  {u.nombre} ({u.usuario})
                </option>
              ))}
            </select>

            <label>Fecha inicio:</label>
            <input type="date" name="fecha_inicio" defaultValue={filters.fecha_inicio} />
            <label>Fecha final:</label>
            <input type="date" name="fecha_final" defaultValue={filters.fecha_final} />

            <label>Precio total por línea:</label>
            <div className="rango">
              <input type="number" min="0" step="0.01" name="precio_desde" placeholder="Desde" defaultValue={filters.precio_desde} />
              <input type="number" min="0" step="0.01" name="precio_hasta" placeholder="Hasta" defaultValue={filters.precio_hasta} />
            </div>

            <label htmlFor="f-color">Color:</label>
            <select id="f-color" name="color" defaultValue={filters.color}>
              {['Todos','Verde','Rojo','Azul','Metálico','Negro'].map(c => <option key={c}>{c}</option>)}
            </select>

            <label htmlFor="f-estado">Estado:</label>
            <select id="f-estado" name="estado" defaultValue={filters.estado}>
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