import { cancelPurchase, confirmPurchase, addToCart, removeFromCart } from '../actions.js';
import Navbar from '../components/Navbar.jsx';
import Notice from '../components/Notice.jsx';
import { getOpenOrder } from '../../src/data.js';
import { requireUser } from '../../src/session.js';

export default async function OrderPage({ searchParams }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const { order, items, total } = await getOpenOrder(user.id_usuario);

  return (
    <>
      <Navbar user={user} active="pedido" />
      <main className="contenedor">
        <div className="titulo-box">MI PEDIDO</div>
        <Notice searchParams={params} />

        {order && (
          <p className="estado-pedido">
            Pedido #{order.id_compra} · Estado: <strong>{order.estado}</strong>
          </p>
        )}

        <div className="grid-principal carrito-layout">
          <section>
            {!items.length && (
              <p className="mensaje-vacio">
                Tu pedido está vacío. Ve al catálogo para añadir productos.
              </p>
            )}
            <div className="productos-grid">
              {items.map(item => (
                <article className="producto-card" key={item.id_producto}>
                  <div className="producto-imagen" />
                  <div className="producto-precio">
                    ${(Number(item.precio_unitario) * item.cantidad).toFixed(2)}
                  </div>
                  <div className="producto-nombre">{item.nombre}</div>
                  <div className="producto-desc">
                    {item.descripcion || ''} · Color: {item.color}
                  </div>
                  <div className="cantidad-control">
                    <form action={removeFromCart}>
                      <input type="hidden" name="id_producto" value={item.id_producto} />
                      <button aria-label="Quitar una unidad">−</button>
                    </form>
                    <span>Cantidad: <strong>{item.cantidad}</strong></span>
                    <form action={addToCart}>
                      <input type="hidden" name="id_producto" value={item.id_producto} />
                      <input type="hidden" name="return_to" value="pedido" />
                      <button aria-label="Agregar una unidad">+</button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <aside className="resumen-carrito">
            <h3>Precio total:</h3>
            <div className="total">${total.toFixed(2)}</div>
            <form action={confirmPurchase}>
              <button className="btn btn-block" disabled={!items.length}>Confirmar pedido</button>
            </form>
            <form action={cancelPurchase}>
              <button className="btn btn-secundario btn-block" disabled={!items.length}>Cancelar pedido</button>
            </form>
          </aside>
        </div>
      </main>
    </>
  );
}