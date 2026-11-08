// app/mis-pedidos/page.jsx
import Navbar from '../components/Navbar.jsx';
import Notice from '../components/Notice.jsx';
import { requireUser } from '../../src/session.js';
import { query } from '../../src/db.js';

export default async function MyOrdersPage({ searchParams }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  
  // Consulta directa: solo los pedidos de este usuario
  const { rows: pedidos } = await query(
    `SELECT id_compra, fecha, hora, estado 
     FROM compras 
     WHERE id_usuario = $1 
     ORDER BY fecha DESC, id_compra DESC`,
    [user.id_usuario]
  );

  return (
    <>
      <Navbar user={user} active="mis-pedidos" />
      <main className="contenedor">
        <div className="titulo-box">MIS PEDIDOS</div>
        <Notice searchParams={params} />
        
        <div className="table-wrap">
          <table className="informe">
            <thead>
              <tr>
                <th>Pedido #</th><th>Fecha</th><th>Hora</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map(p => (
                <tr key={p.id_compra}>
                  <td>{p.id_compra}</td>
                  <td>{String(p.fecha).slice(0, 10)}</td>
                  <td>{String(p.hora).slice(0, 5)}</td>
                  <td className={`estado-${String(p.estado).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}>
                    {p.estado}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pedidos.length && <p className="mensaje-vacio">No tienes pedidos registrados.</p>}
        </div>
      </main>
    </>
  );
}