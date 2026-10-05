import { addToCart } from '../actions.js';
import Navbar from '../components/Navbar.jsx';
import Notice from '../components/Notice.jsx';
import { listProducts } from '../../src/data.js';
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
  const products = await listProducts(filters);
  return (
    <>
      <Navbar user={user} active="catalogo" />
      <main className="contenedor">
        <div className="titulo-box">CATÁLOGO</div>
        <Notice searchParams={params} />
        <div className="grid-principal sin-lateral-derecho">
          <form className="filtros" method="get">
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
          </form>
          <section>
            <form className="buscar-bar" method="get">
              <input type="hidden" name="orden" value={filters.orden} />
              <input type="hidden" name="color" value={filters.color} />
              <input type="hidden" name="precio_desde" value={filters.precio_desde} />
              <input type="hidden" name="precio_hasta" value={filters.precio_hasta} />
              <input name="buscar" defaultValue={filters.buscar} placeholder="Buscar producto..." />
              <button className="btn">BUSCAR</button>
            </form>
            {!products.length && <p className="mensaje-vacio">No se encontraron productos con esos filtros.</p>}
            <div className="productos-grid">
              {products.map(product => (
                <article className="producto-card" key={product.id_producto}>
                  {product.imagen_url ? (
                    <img
                      src={product.imagen_url}
                      alt={product.nombre}
                      className="producto-imagen"
                    />
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
          </section>
        </div>
      </main>
    </>
  );
}