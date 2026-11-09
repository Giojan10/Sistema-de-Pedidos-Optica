import Link from 'next/link';
import Navbar from '../components/Navbar.jsx';
import Notice from '../components/Notice.jsx';
import SortHeader from '../components/SortHeader.jsx';
import {
  getTabularReport,
  listUsuariosParaFiltro,
  LIMITES_TABULAR,
} from '../../src/data.js';
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

  // Paginación
  const limit = LIMITES_TABULAR.includes(Number(params.limit))
    ? Number(params.limit)
    : 50;
  const page = Math.max(1, Number(value(params.pagina)) || 1);
  const offset = (page - 1) * limit;

  const [{ rows, total }, usuarios] = await Promise.all([
    getTabularReport(filters, { limit, offset }),
    listUsuariosParaFiltro(),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / limit));

  const baseQuery = {
    precio_desde: filters.precio_desde,
    precio_hasta: filters.precio_hasta,
    color: filters.color,
    estado: filters.estado,
    fecha_inicio: filters.fecha_inicio,
    fecha_final: filters.fecha_final,
    id_usuario: filters.id_usuario,
  };

  // Para exportar: sin paginar
  const exportQuery = new URLSearchParams(
    Object.entries(baseQuery).filter(([, v]) => v && v !== 'Todos')
  );

  // Reconstruye URL conservando filtros, orden y limit
  const queryParams = (extra = {}) => {
    const base = {
      ...Object.fromEntries(
        Object.entries(baseQuery).filter(([, v]) => v && v !== 'Todos')
      ),
      ...(filters.orden && { orden: filters.orden }),
      ...(filters.direccion && { direccion: filters.direccion }),
      ...(limit !== 50 && { limit }),   // solo incluye si es distinto al default
      ...extra,
    };
    const s = new URLSearchParams(base).toString();
    return s ? `?${s}` : '';
  };

  return (
    <>
      <Navbar user={user} active="tabular" />
      <main className="contenedor">
        <div className="titulo-box">INFORME TABULAR</div>
        <h2 className="center">Ventas</h2>
        <Notice searchParams={params} />

        <div className="grid-principal informe-layout">
          <section>
            <div className="tabla-toolbar">
              <p className="subtitulo">
                {total} línea(s) encontrada(s)
              </p>
              <form method="get" className="limit-selector">
                {/* Conservar filtros y orden al cambiar el tamaño */}
                {Object.entries(baseQuery).map(([k, v]) =>
                  v && v !== 'Todos'
                    ? <input key={k} type="hidden" name={k} value={v} />
                    : null
                )}
                {filters.orden && <input type="hidden" name="orden" value={filters.orden} />}
                {filters.direccion && <input type="hidden" name="direccion" value={filters.direccion} />}
                <label htmlFor="limit">Filas por página:</label>
                <select
                  id="limit"
                  name="limit"
                  defaultValue={limit}
                  onChange="this.form.submit()"
                >
                  {LIMITES_TABULAR.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <noscript>
                  <button className="btn btn-plano">Aplicar</button>
                </noscript>
              </form>
            </div>

            <div className="table-wrap">
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
            </div>

            {!rows.length && <p className="mensaje-vacio">No hay compras que coincidan con el filtro.</p>}

            {totalPaginas > 1 && (
              <nav className="paginacion">
                {page > 1 && (
                  <Link className="btn btn-plano" href={`/informe-tabular${queryParams({ pagina: 1 })}`}>
                    « Primera
                  </Link>
                )}
                {page > 1 && (
                  <Link className="btn btn-plano" href={`/informe-tabular${queryParams({ pagina: page - 1 })}`}>
                    ← Anterior
                  </Link>
                )}
                <span>Página {page} de {totalPaginas}</span>
                {page < totalPaginas && (
                  <Link className="btn btn-plano" href={`/informe-tabular${queryParams({ pagina: page + 1 })}`}>
                    Siguiente →
                  </Link>
                )}
                {page < totalPaginas && (
                  <Link className="btn btn-plano" href={`/informe-tabular${queryParams({ pagina: totalPaginas })}`}>
                    Última »
                  </Link>
                )}
              </nav>
            )}
          </section>

          <form className="filtros" method="get">
            <input type="hidden" name="orden" value={filters.orden} />
            <input type="hidden" name="direccion" value={filters.direccion} />
            <input type="hidden" name="limit" value={limit} />

            <label htmlFor="f-usuario">Usuario:</label>
            <select id="f-usuario" name="id_usuario" defaultValue={filters.id_usuario}>
              <option value="">Todos</option>
              {usuarios.map(u => (
                <option key={u.id_usuario} value={u.id_usuario}>{u.nombre} ({u.usuario})</option>
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