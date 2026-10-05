import { requireAdmin } from '../../src/session.js';
import { listUsuarios } from '../../src/data.js';
import {
  createUser, createProduct, deactivateUser, reactivateUser,
} from '../actions.js';
import Navbar from '../components/Navbar.jsx';
import Notice from '../components/Notice.jsx';

export default async function MaestroPage({ searchParams }) {
  const [user, params, usuarios] = await Promise.all([
    requireAdmin(),
    searchParams,
    listUsuarios({ incluirInactivos: true }),
  ]);

  return (
    <>
      <Navbar user={user} active="maestro" />
      <main className="contenedor">
        <div className="titulo-box">GESTIONAR MAESTRO</div>
        <Notice searchParams={params} />

        <div className="grid-principal report-grid">
          <section className="panel">
            <h3>Crear usuario</h3>
            <form action={createUser}>
              <label>Usuario</label><input name="usuario" required />
              <label>Contraseña (mín. 6)</label>
              <input name="clave" type="password" minLength="6" required />
              <label>Rol</label>
              <select name="rol" defaultValue="Operario">
                <option>Operario</option>
                <option>Administrador</option>
              </select>
              <label>Nombre completo</label><input name="nombre" required />
              <label>Email</label><input name="email" type="email" />
              <button className="btn btn-block">Crear usuario</button>
            </form>
          </section>

          <section className="panel">
            <h3>Crear producto</h3>
            <form action={createProduct}>
              <label>Nombre</label><input name="nombre" required />
              <label>Descripción</label><input name="descripcion" />
              <label>Color</label>
              <select name="color" defaultValue="Negro">
                {['Verde','Rojo','Azul','Metálico','Negro'].map(c => <option key={c}>{c}</option>)}
              </select>
              <label>Cantidad disponible</label>
              <input name="cantidad_disponible" type="number" min="0" defaultValue="0" />
              <label>Cantidad apartada</label>
              <input name="cantidad_apartada" type="number" min="0" defaultValue="0" />
              <label>Precio unitario</label>
              <input name="precio_unitario" type="number" step="0.01" min="0" required />
              <button className="btn btn-block">Crear producto</button>
            </form>
          </section>
        </div>

        <section style={{ marginTop: 24 }}>
          <h3>Usuarios registrados</h3>
          <div className="table-wrap">
            <table className="informe">
              <thead>
                <tr>
                  <th>Usuario</th><th>Nombre</th><th>Rol</th>
                  <th>Email</th><th>Estado</th><th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id_usuario} className={u.activo ? '' : 'usuario-inactivo'}>
                    <td>{u.usuario}</td>
                    <td>{u.nombre}</td>
                    <td>{u.rol}</td>
                    <td>{u.email || '—'}</td>
                    <td>{u.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                      {u.activo ? (
                        <form action={deactivateUser}>
                          <input type="hidden" name="id_usuario" value={u.id_usuario} />
                          <button className="link-button" type="submit">Desactivar</button>
                        </form>
                      ) : (
                        <form action={reactivateUser}>
                          <input type="hidden" name="id_usuario" value={u.id_usuario} />
                          <button className="link-button" type="submit">Reactivar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}