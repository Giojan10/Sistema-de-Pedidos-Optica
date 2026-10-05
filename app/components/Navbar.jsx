import Link from 'next/link';
import { logout } from '../actions.js';

export default function Navbar({ customer, active }) {
  return (
    <header className="navbar">
      <Link className="brand" href="/catalogo">Óptica · Pedidos</Link>
      <nav>
        <Link className={active === 'catalogo' ? 'active' : ''} href="/catalogo">Catálogo</Link>
        <Link className={active === 'carrito' ? 'active' : ''} href="/carrito">Carrito</Link>
        <Link className={active === 'tabular' ? 'active' : ''} href="/informe-tabular">Informe tabular</Link>
        <Link className={active === 'consolidado' ? 'active' : ''} href="/informe-consolidado">Informe consolidado</Link>
      </nav>
      <div className="cliente-info">
        {customer.nombre}
        <form className="inline-form" action={logout}><button className="link-button" type="submit">Cambiar cliente</button></form>
      </div>
    </header>
  );
}
