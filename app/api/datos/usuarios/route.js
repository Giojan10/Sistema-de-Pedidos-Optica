import bcrypt from 'bcryptjs';
import { query } from '../../../../src/db.js';
import { checkApiKey, paginationFrom } from '../../../../src/apiAuth.js';
import {
  ok, created, badRequest, pgErrorToResponse, toInt,
} from '../../../../src/apiHelpers.js';

const ROLES = ['Cliente', 'Operario', 'Administrador'];

/* ---------------- GET (lista paginada) ---------------- */
export async function GET(request) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const { limit, offset } = paginationFrom(request);

  try {
    const { rows } = await query(
      `SELECT id_usuario, usuario, rol, nombre, email, telefono,
              fecha_nacimiento, activo, creado_en
       FROM usuarios
       ORDER BY id_usuario
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return ok(rows, { tabla: 'usuarios', paginacion: { limit, offset } });
  } catch (error) {
    return pgErrorToResponse(error);
  }
}

/* ---------------- POST (crear usuario) ---------------- */
export async function POST(request) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  let body;
  try { body = await request.json(); }
  catch { return badRequest('JSON inválido'); }

  const usuario = String(body.usuario || '').trim().toLowerCase();
  const clave = String(body.clave || '');
  const rol = String(body.rol || 'Cliente');
  const nombre = String(body.nombre || '').trim();
  const email = body.email ? String(body.email).trim() : null;
  const telefono = body.telefono ? String(body.telefono).trim() : null;
  const fechaNacimiento = body.fecha_nacimiento || null;

  if (!usuario || usuario.length < 3)
    return badRequest('Campo "usuario" obligatorio (mín. 3 caracteres).');
  if (!clave || clave.length < 6)
    return badRequest('Campo "clave" obligatorio (mín. 6 caracteres).');
  if (!nombre)
    return badRequest('Campo "nombre" obligatorio.');
  if (!ROLES.includes(rol))
    return badRequest(`Campo "rol" debe ser uno de: ${ROLES.join(', ')}`);

  const hash = await bcrypt.hash(clave, 10);

  try {
    const { rows } = await query(
      `INSERT INTO usuarios
         (usuario, clave_hash, rol, nombre, email, telefono, fecha_nacimiento)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id_usuario, usuario, rol, nombre, email, telefono,
                 fecha_nacimiento, activo, creado_en`,
      [usuario, hash, rol, nombre, email, telefono, fechaNacimiento]
    );
    return created(rows[0], { tabla: 'usuarios' });
  } catch (error) {
    return pgErrorToResponse(error);
  }
}