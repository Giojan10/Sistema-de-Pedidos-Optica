import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-cambiar';

/**
 * Lee la cookie `sesion`, verifica el JWT y devuelve el usuario de la BD.
 * - Devuelve `null` si no hay cookie, el JWT expiró o el usuario está inactivo.
 * - No redirige: solo consulta. Cada guard decide qué hacer.
 */
export async function currentUser() {
  const store = await cookies();
  const token = store.get('sesion')?.value;
  if (!token) return null;
  try {
    const { id_usuario } = jwt.verify(token, SECRET);
    const { rows } = await query(
      `SELECT id_usuario, usuario, rol, nombre, email
       FROM usuarios WHERE id_usuario=$1 AND activo`,
      [id_usuario]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

/** Redirige a /login si no hay sesión válida. Devuelve el usuario si la hay. */
export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect('/login');
  return u;
}

/** Solo Administradores. Otros roles → redirige al catálogo con error. */
export async function requireAdmin() {
  const u = await requireUser();
  if (u.rol !== 'Administrador') redirect('/catalogo?error=Acceso%20restringido');
  return u;
}

/** Operarios y Administradores (bloquea a Clientes). Para informes. */
export async function requireStaff() {
  const u = await requireUser();
  if (u.rol === 'Cliente') {
    redirect('/mis-pedidos?error=Acceso%20restringido%20a%20informes');
  }
  return u;
}

/** Solo Clientes. Otros roles → redirige al catálogo con error. */
export async function requireCliente() {
  const u = await requireUser();
  if (u.rol !== 'Cliente') {
    redirect('/catalogo?error=Solo%20clientes%20pueden%20acceder%20a%20esta%20sección');
  }
  return u;
}