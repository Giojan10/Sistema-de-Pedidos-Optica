import { chooseCustomer, registerCustomer } from './actions.js';
import { listCustomers } from '../src/data.js';
import Notice from './components/Notice.jsx';

export default async function Home({ searchParams }) {
  const [customers, params] = await Promise.all([listCustomers(), searchParams]);
  return (
    <main className="contenedor login">
      <section className="panel">
        <h2>Bienvenido/a</h2>
        <p>Selecciona tu usuario o regístrate para continuar al catálogo.</p>
        <Notice searchParams={params} />
        <form action={chooseCustomer}>
          <label htmlFor="select-cliente">Cliente existente</label>
          <select id="select-cliente" name="id_cliente" defaultValue="" required>
            <option value="">-- Selecciona --</option>
            {customers.map(customer => <option key={customer.id_cliente} value={customer.id_cliente}>{customer.nombre} ({customer.email || 'sin correo'})</option>)}
          </select>
          <button className="btn btn-block" type="submit">Continuar</button>
        </form>
        <hr />
        <form action={registerCustomer}>
          <label htmlFor="nuevo-nombre">Registrarme como nuevo cliente</label>
          <input id="nuevo-nombre" name="nombre" placeholder="Nombre completo" maxLength="160" required />
          <input name="email" type="email" placeholder="Correo electrónico" />
          <button className="btn btn-secundario btn-block" type="submit">Registrarme y continuar</button>
        </form>
      </section>
    </main>
  );
}
