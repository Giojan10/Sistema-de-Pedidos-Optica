import { requireAdmin } from '../../src/session.js';
import { listUsuarios, listProductsAdmin } from '../../src/data.js';
import {
  createUser, createProduct,
  deactivateUser, reactivateUser,
  updateProduct, deleteProduct, toggleProductActive,
} from '../actions.js';
import Navbar from '../components/Navbar.jsx';
import Notice from '../components/Notice.jsx';

const COLORES = ['Verde', 'Rojo', 'Azul', 'Metálico', 'Negro'];

export default async function MaestroPage({ searchParams }) {
  const [user, params, usuarios, productos] = await Promise.all([
    requireAdmin(),
    searchParams,
    listUsuarios({ incluirInactivos: true }),
    listProductsAdmin(),
  ]);

  return (
    <>
      <Navbar user={user} active="maestro" />
      <main className="contenedor">
        <div className="titulo-box">GESTIONAR MAESTRO</div>
        <Notice searchParams={params} />

        {/* ---------- Alta de usuarios y productos ---------- */}
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
            <form action={createProduct} encType="multipart/form-data">
              <label>Nombre</label><input name="nombre" required />
              <label>Descripción</label><input name="descripcion" />
              <label>Color</label>
              <select name="color" defaultValue="Negro">
                {COLORES.map(c => <option key={c}>{c}</option>)}
              </select>
              <label>URL de imagen (opcional)</label>
              <input name="imagen_url" type="url" placeholder="https://..." />
              <label>…o subir archivo (máx 2 MB)</label>
              <input name="imagen" type="file" accept="image/*" />
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

        {/* ---------- Usuarios ---------- */}
        <section style={{ marginTop: 32 }}>
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
                          <button className="link-button">Desactivar</button>
                        </form>
                      ) : (
                        <form action={reactivateUser}>
                          <input type="hidden" name="id_usuario" value={u.id_usuario} />
                          <button className="link-button">Reactivar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- Productos ---------- */}
        <section style={{ marginTop: 32 }}>
          <h3>Productos</h3>
          <div className="table-wrap">
            <table className="informe">
              <thead>
                <tr>
                  <th></th><th>Nombre</th><th>Color</th>
                  <th>Precio</th><th>Disponible</th><th>Apartada</th>
                  <th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productos.map(p => (
                  <tr key={p.id_producto} className={p.activo ? '' : 'usuario-inactivo'}>
                    <td>
                      {p.imagen_url
                        ? <img src={p.imagen_url} alt="" className="thumb-producto" />
                        : <div className="thumb-producto placeholder" />}
                    </td>
                    <td>{p.nombre}</td>
                    <td>{p.color}</td>
                    <td>${Number(p.precio_unitario).toFixed(2)}</td>
                    <td>{p.cantidad_disponible}</td>
                    <td>{p.cantidad_apartada}</td>
                    <td>{p.activo ? 'Activo' : 'Inactivo'}</td>
                    <td className="acciones-producto">
                      <details>
                        <summary className="link-button">Editar</summary>
                        <form
                          action={updateProduct}
                          encType="multipart/form-data"
                          className="form-editar-producto"
                        >
                          <input type="hidden" name="id_producto" value={p.id_producto} />

                          <label>Nombre</label>
                          <input name="nombre" defaultValue={p.nombre} required />

                          <label>Descripción</label>
                          <input name="descripcion" defaultValue={p.descripcion || ''} />

                          <label>Color</label>
                          <select name="color" defaultValue={p.color}>
                            {COLORES.map(c => <option key={c}>{c}</option>)}
                          </select>

                          <label>Precio unitario</label>
                          <input
                            name="precio_unitario"
                            type="number" step="0.01" min="0"
                            defaultValue={Number(p.precio_unitario).toFixed(2)}
                            required
                          />

                          <label>Cantidad disponible</label>
                          <input
                            name="cantidad_disponible"
                            type="number" min="0"
                            defaultValue={p.cantidad_disponible}
                          />

                          <label>URL de imagen (actual: {p.imagen_url ? 'sí' : 'no'})</label>
                          <input
                            name="imagen_url"
                            type="url"
                            placeholder="https://..."
                            defaultValue={p.imagen_url && !p.imagen_url.includes('supabase') ? p.imagen_url : ''}
                          />

                          <label>…o reemplazar con archivo</label>
                          <input name="imagen" type="file" accept="image/*" />

                          {p.imagen_url && (
                            <label className="check-inline">
                              <input type="checkbox" name="quitar_imagen" /> Quitar imagen
                            </label>
                          )}

                          <button className="btn btn-block">Guardar cambios</button>
                        </form>
                      </details>

                      <form action={toggleProductActive} className="inline">
                        <input type="hidden" name="id_producto" value={p.id_producto} />
                        <button className="link-button">
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </form>

                      <form action={deleteProduct} className="inline">
                        <input type="hidden" name="id_producto" value={p.id_producto} />
                        <button className="link-button danger">Eliminar</button>
                      </form>
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