import Link from 'next/link';
import Navbar from '../components/Navbar.jsx';
import Notice from '../components/Notice.jsx';
import { requireCliente } from '../../src/session.js';
import { getMyOrders, getOrderDetails } from '../../src/data.js';

const ESTADOS = ['Solicitándose', 'En edición', 'Realizado', 'Cancelado'];

function value(param) {
  return Array.isArray(param) ? param[0] : param || '';
}

function estadoClase(estado) {
  return 'estado-' + String(estado)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

function formatFecha(f) {
  const s = String(f || '').slice(0, 10);
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function formatHora(h) {
  return String(h || '').slice(0, 5) || '—';
}

export default async function MyOrdersPage({ searchParams }) {
  const [user, params] = await Promise.all([requireCliente(), searchParams]);

  const filters = {
    estado: value(params.estado) || '',
    fecha_inicio: value(params.fecha_inicio),
    fecha_final: value(params.fecha_final),
    buscar: value(params.buscar),
  };

  const page = Math.max(1, Number(value(params.pagina)) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { pedidos, total, resumen } = await getMyOrders(
    user.id_usuario,
    filters,
    { limit, offset }
  );

  const ids = pedidos.map(p => p.id_compra);
  const detalleMap = await getOrderDetails(user.id_usuario, ids);

  const totalPaginas = Math.max(1, Math.ceil(total / limit));

  const queryParams = (extra = {}) => {
    const base = {
      ...(filters.estado && { estado: filters.estado }),
      ...(filters.fecha_inicio && { fecha_inicio: filters.fecha_inicio }),
      ...(filters.fecha_final && { fecha_final: filters.fecha_final }),
      ...(filters.buscar && { buscar: filters.buscar }),
      ...extra,
    };
    const s = new URLSearchParams(base).toString();
    return s ? `?${s}` : '';
  };

  return (
    <>
      <Navbar user={user} active="mis-pedidos" />
      <main className="contenedor">
        <div className="titulo-box">MIS PEDIDOS</div>
        <Notice searchParams={params} />

        {/* ---------- Resumen ---------- */}
        <div className="mis-pedidos-resumen">
          <div className="resumen-card">
            <span className="resumen-label">Pedidos</span>
            <span className="resumen-valor">{resumen.total_pedidos}</span>
          </div>
          <div className="resumen-card">
            <span className="resumen-label">Unidades</span>
            <span className="resumen-valor">{resumen.total_unidades}</span>
          </div>
          <div className="resumen-card">
            <span className="resumen-label">Total gastado</span>
            <span className="resumen-valor">
              ${Number(resumen.total_gastado).toFixed(2)}
            </span>
          </div>
        </div>

        {/* ---------- Filtros ---------- */}
        <form className="filtros filtros-linea mis-pedidos-filtros" method="get">
          <div className="grow">
            <label>Buscar producto</label>
            <input
              name="buscar"
              defaultValue={filters.buscar}
              placeholder="Ej. Aviador, Redondo..."
            />
          </div>
          <div>
            <label>Estado</label>
            <select name="estado" defaultValue={filters.estado}>
              <option value="">Todos</option>
              {ESTADOS.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Desde</label>
            <input type="date" name="fecha_inicio" defaultValue={filters.fecha_inicio} />
          </div>
          <div>
            <label>Hasta</label>
            <input type="date" name="fecha_final" defaultValue={filters.fecha_final} />
          </div>
          <button className="btn">Aplicar</button>
          <Link className="btn btn-secundario" href="/mis-pedidos/exportar">
            Exportar CSV
          </Link>
          {(filters.estado || filters.buscar || filters.fecha_inicio || filters.fecha_final) && (
            <Link className="btn btn-plano" href="/mis-pedidos">Limpiar</Link>
          )}
        </form>

        {/* ---------- Lista ---------- */}
        {!pedidos.length && (
          <p className="mensaje-vacio">
            No tienes pedidos que coincidan con los filtros.
          </p>
        )}

        <div className="mis-pedidos-lista">
          {pedidos.map(p => {
            const items = detalleMap.get(p.id_compra) || [];
            return (
              <article className="pedido-card" key={p.id_compra}>
                <header className="pedido-header">
                  <div className="pedido-id">
                    <strong>Pedido #{p.id_compra}</strong>
                    <span className="pedido-fecha">
                      {formatFecha(p.fecha)} · {formatHora(p.hora)}
                    </span>
                  </div>
                  <div className="pedido-meta">
                    <span className={`chip ${estadoClase(p.estado)}`}>{p.estado}</span>
                    <span className="pedido-total">
                      ${Number(p.total).toFixed(2)}
                    </span>
                  </div>
                </header>

                <div className="pedido-resumen-linea">
                  {p.unidades} unidad(es) · {items.length} producto(s)
                </div>

                {items.length > 0 && (
                  <details className="pedido-detalle">
                    <summary>Ver detalle</summary>
                    <table className="informe pedido-tabla">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Producto</th>
                          <th>Color</th>
                          <th>Cant.</th>
                          <th>Precio</th>
                          <th>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(it => (
                          <tr key={it.id_producto}>
                            <td>
                              {it.imagen_url
                                ? <img src={it.imagen_url} alt="" className="thumb-producto" />
                                : <div className="thumb-producto placeholder" />}
                            </td>
                            <td>{it.nombre}</td>
                            <td>{it.color}</td>
                            <td>{it.cantidad}</td>
                            <td>${Number(it.precio_unitario).toFixed(2)}</td>
                            <td>${Number(it.subtotal).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </article>
            );
          })}
        </div>

        {/* ---------- Paginación ---------- */}
        {totalPaginas > 1 && (
          <nav className="paginacion">
            {page > 1 && (
              <Link className="btn btn-plano" href={`/mis-pedidos${queryParams({ pagina: page - 1 })}`}>
                ← Anterior
              </Link>
            )}
            <span>Página {page} de {totalPaginas}</span>
            {page < totalPaginas && (
              <Link className="btn btn-plano" href={`/mis-pedidos${queryParams({ pagina: page + 1 })}`}>
                Siguiente →
              </Link>
            )}
          </nav>
        )}
      </main>
    </>
  );
}