import Link from 'next/link';
import { registerSelf } from '../actions.js';
import Notice from '../components/Notice.jsx';

export default async function RegisterPage({ searchParams }) {
  const params = await searchParams;
  return (
    <main className="contenedor login">
      <section className="panel">
        <h2>Crear cuenta</h2>
        <Notice searchParams={params} />
        <form action={registerSelf}>
          <label>Usuario</label>
          <input name="usuario" required />
          <label>Contraseña (mín. 6)</label>
          <input name="clave" type="password" minLength="6" required />
          <label>Nombre completo</label>
          <input name="nombre" required />
          <label>Email (opcional)</label>
          <input name="email" type="email" />
          <button className="btn btn-block" type="submit">Registrarme</button>
        </form>
        <hr />
        <p>¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link></p>
      </section>
    </main>
  );
}