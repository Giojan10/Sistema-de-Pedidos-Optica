import Link from 'next/link';
import { login } from '../actions.js';
import Notice from '../components/Notice.jsx';

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  return (
    <main className="contenedor login">
      <section className="panel">
        <h2>Iniciar sesión</h2>
        <p>Sistema de pedidos · Óptica</p>
        <Notice searchParams={params} />
        <form action={login}>
          <label htmlFor="u">Usuario</label>
          <input id="u" name="usuario" autoComplete="username" required />
          <label htmlFor="c">Contraseña</label>
          <input id="c" name="clave" type="password" autoComplete="current-password" required />
          <button className="btn btn-block" type="submit">Entrar</button>
        </form>
        <hr />
        <p>¿No tienes cuenta? <Link href="/registro">Regístrate</Link></p>
      </section>
    </main>
  );
}