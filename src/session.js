import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-cambiar';

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

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect('/login');
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.rol !== 'Administrador') redirect('/catalogo?error=Acceso%20restringido');
  return u;
}