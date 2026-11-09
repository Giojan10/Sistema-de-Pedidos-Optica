import Link from 'next/link';
import { addToCart } from '../actions.js';
import Navbar from '../components/Navbar.jsx';
import Notice from '../components/Notice.jsx';
import { listProducts, LIMITES_CATALOGO } from '../../src/data.js';
import { requireUser } from '../../src/session.js';

function value(param) {
  return Array.isArray(param) ? param[0] : param || '';
}

export default async function CatalogPage({ searchParams }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);

  const filters = {
    buscar: value(params.buscar),
    color: value(params.color) || 'Todos',
    precio_desde: value(params.precio_desde),
    precio_hasta: value(params.precio_hasta),
    orden: value(params.orden) || 'precio_desc',
  };

  // Paginación
  const limit = LIMITES_CATALOGO.includes(Number(params.limit))
    ? Number(params.limit)
    : 12;
  const page = Math.max(1, Number(value(params.pagina)) || 1);
  const offset = (page - 1) * limit;

  const { rows: products, total } = await listProducts(filters, { limit, offset });
  const totalPaginas = Math.max(1, Math.ceil(total / limit));

  const baseQuery = {
    ...(filters.buscar && { buscar: filters.buscar }),
    ...(filters.color && filters.color !== 'Todos' && { color: filters.color }),
    ...(filters.precio_desde && { precio_desde: filters.precio_desde }),
    ...(filters.precio_hasta && { precio_hasta: filters.precio_hasta }),
    ...(filters.orden && filters.orden !== 'precio_desc' && { orden: filters.orden }),
  };

  const queryParams = (extra = {}) => {
    const base = {
      ...baseQuery,
      ...(limit !== 12 && { limit }),
      ...extra,
    };
    const s = new URLSearchParams(base).toString();
    return s ? `?${s}` : '';
  };

  return (
    <>
      <Navbar user={user} active="catalogo" />
      <main className="contenedor">
        <div className="titulo-box">CATÁLOGO</div>
        <Notice searchParams={params} />
        <div className="grid-principal sin-lateral-derecho">
          <form className="filtros" method="get">
            <input type="hidden" name="limit" value={limit} />
            <label htmlFor="f-orden">Ordenar por:</label>
            <select id="f-orden" name="orden" defaultValue={filters.orden}>
              <option value="precio_desc">Precio (descendente)</option>
              <option value="precio_asc">Precio (ascendente)</option>
              <option value="nombre_asc">Nombre (A-Z)</option>
            </select>
            <label>Precio:</label>
            <div className="rango">
              <input type="number" min="0" step="0.01" name="precio_desde" placeholder="Desde" defaultValue={filters.precio_desde} />
              <input type="number" min="0" step="0.01" name="precio_hasta" placeholder="Hasta" defaultValue={filters.precio_hasta} />
            </div>
            <label htmlFor="f-color">Color:</label>
            <select id="f-color" name="color" defaultValue={filters.color}>
              {['Todos','Verde','Rojo','Azul','Metálico','Negro'].map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="hidden" name="buscar" value={filters.buscar} />
            <button className="btn btn-block">Aplicar filtros</button>
            <Link className="btn btn-plano btn-block" href="/catalogo">Limpiar filtros</Link>
          </form>

          <section>
            <form className="buscar-bar" method="get">
              <input type="hidden" name="orden" value={filters.orden} />
              <input type="hidden" name="color" value={filters.color} />
              <input type="hidden" name="precio_desde" value={filters.precio_desde} />
              <input type="hidden" name="precio_hasta" value={filters.precio_hasta} />
              <input type="hidden" name="limit" value={limit} />
              <input name="buscar" defaultValue={filters.buscar} placeholder="Buscar producto..." />
              <button className="btn">BUSCAR</button>
            </form>

            <div className="tabla-toolbar">
              <p className="subtitulo">{total} producto(s) encontrado(s)</p>
              <form method="get" className="limit-selector">
                {Object.entries(baseQuery).map(([k, v]) =>
                  <input key={k} type="hidden" name={k} value={v} />
                )}
                <label htmlFor="limit-cat">Por página:</label>
                <select
                  id="limit-cat"
                  name="limit"
                  defaultValue={limit}
                  onChange="this.form.submit()"
                >
                  {LIMITES_CATALOGO.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </form>
            </div>

            {!products.length && (
              <p className="mensaje-vacio">No se encontraron productos con esos filtros.</p>
            )}

            <div className="productos-grid">
              {products.map(product => (
                <article className="producto-card" key={product.id_producto}>
                  {product.imagen_url ? (
                    <img src={product.imagen_url} alt={product.nombre} className="producto-imagen" />
                  ) : (
                    <div className="producto-imagen" />
                  )}
                  <div className="producto-precio">${Number(product.precio_unitario).toFixed(2)}</div>
                  <div className="producto-nombre">{product.nombre}</div>
                  <div className="producto-desc">{product.descripcion || ''} · Color: {product.color}</div>
                  <div className="producto-desc">Disponibles: {product.cantidad_disponible}</div>
                  <form action={addToCart}>
                    <input type="hidden" name="id_producto" value={product.id_producto} />
                    <button className="btn btn-block" disabled={product.cantidad_disponible <= 0}>
                      {product.cantidad_disponible <= 0 ? 'Sin stock' : 'Agregar al pedido'}
                    </button>
                  </form>
                </article>
              ))}
            </div>

            {totalPaginas > 1 && (
              <nav className="paginacion">
                {page > 1 && (
                  <Link className="btn btn-plano" href={`/catalogo${queryParams({ pagina: 1 })}`}>« Primera</Link>
                )}
                {page > 1 && (
                  <Link className="btn btn-plano" href={`/catalogo${queryParams({ pagina: page - 1 })}`}>← Anterior</Link>
                )}
                <span>Página {page} de {totalPaginas}</span>
                {page < totalPaginas && (
                  <Link className="btn btn-plano" href={`/catalogo${queryParams({ pagina: page + 1 })}`}>Siguiente →</Link>
                )}
                {page < totalPaginas && (
                  <Link className="btn btn-plano" href={`/catalogo${queryParams({ pagina: totalPaginas })}`}>Última »</Link>
                )}
              </nav>
            )}
          </section>
        </div>
      </main>
    </>
  );
}