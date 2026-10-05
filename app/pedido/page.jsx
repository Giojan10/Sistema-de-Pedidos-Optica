import { cancelPurchase, confirmPurchase, addToCart, removeFromCart } from '../actions.js';
import Navbar from '../components/Navbar.jsx';
import Notice from '../components/Notice.jsx';
import { getCart } from '../../src/data.js';
import { requireCustomer } from '../../src/session.js';

export default async function CartPage({ searchParams }) {
  const [customer, params] = await Promise.all([requireCustomer(), searchParams]);
  const { items, total } = await getCart(customer.id_cliente);
  return (
    <>
      <Navbar customer={customer} active="carrito" />
      <main className="contenedor">
        <div className="titulo-box">CARRITO</div><Notice searchParams={params} />
        <div className="grid-principal carrito-layout">
          <section>
            {!items.length && <p className="mensaje-vacio">Tu carrito está vacío. Ve al catálogo para añadir productos.</p>}
            <div className="productos-grid">{items.map(item => <article className="producto-card" key={item.id_producto}>
              <div className="producto-imagen" /><div className="producto-precio">${(Number(item.precio_unitario) * item.cantidad).toFixed(2)}</div>
              <div className="producto-nombre">{item.nombre}</div><div className="producto-desc">{item.descripcion || ''} · Color: {item.color}</div>
              <div className="cantidad-control">
                <form action={removeFromCart}><input type="hidden" name="id_producto" value={item.id_producto} /><button aria-label="Quitar una unidad">−</button></form>
                <span>Cantidad: <strong>{item.cantidad}</strong></span>
                <form action={addToCart}><input type="hidden" name="id_producto" value={item.id_producto} /><input type="hidden" name="return_to" value="carrito" /><button aria-label="Agregar una unidad">+</button></form>
              </div>
            </article>)}</div>
          </section>
          <aside className="resumen-carrito"><h3>Precio total:</h3><div className="total">${total.toFixed(2)}</div>
            <form action={confirmPurchase}><button className="btn btn-block" disabled={!items.length}>Confirmar compra</button></form>
            <form action={cancelPurchase}><button className="btn btn-secundario btn-block" disabled={!items.length}>Cancelar compra</button></form>
          </aside>
        </div>
      </main>
    </>
  );
}
