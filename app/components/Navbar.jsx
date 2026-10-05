import Link from 'next/link';
import { logout } from '../actions.js';

export default function Navbar({ user, active }) {
  return (
    <header className="navbar">
      <Link className="brand" href="/catalogo">Óptica · Pedidos</Link>
      <nav>
        <Link className={active === 'catalogo' ? 'active' : ''} href="/catalogo">Catálogo</Link>
        <Link className={active === 'pedido' ? 'active' : ''} href="/pedido">Pedido</Link>
        <Link className={active === 'tabular' ? 'active' : ''} href="/informe-tabular">Informe tabular</Link>
        <Link className={active === 'consolidado' ? 'active' : ''} href="/informe-consolidado">Informe consolidado</Link>
        {user.rol === 'Administrador' && (
          <Link className={active === 'maestro' ? 'active' : ''} href="/maestro">Maestro</Link>
        )}
      </nav>
      <div className="cliente-info">
        {user.nombre} · {user.rol}
        <form className="inline-form" action={logout}>
          <button className="link-button" type="submit">Salir</button>
        </form>
      </div>
    </header>
  );
}