import bcrypt from 'bcryptjs';
import { query } from '../../../../../src/db.js';
import { checkApiKey } from '../../../../../src/apiAuth.js';
import {
  ok, noContent, notFound, badRequest, pgErrorToResponse, toInt,
} from '../../../../../src/apiHelpers.js';

const ROLES = ['Cliente', 'Operario', 'Administrador'];

async function loadId(params) {
  const { id } = await params;
  const n = toInt(id);
  return n && n > 0 ? n : null;
}

/* ---------------- GET uno ---------------- */
export async function GET(request, { params }) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const id = await loadId(params);
  if (!id) return badRequest('ID inválido');

  const { rows } = await query(
    `SELECT id_usuario, usuario, rol, nombre, email, telefono,
            fecha_nacimiento, activo, creado_en
     FROM usuarios WHERE id_usuario = $1`,
    [id]
  );
  if (!rows[0]) return notFound('Usuario no encontrado');
  return ok(rows[0]);
}

/* ---------------- PUT (actualizar) ---------------- */
export async function PUT(request, { params }) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const id = await loadId(params);
  if (!id) return badRequest('ID inválido');

  let body;
  try { body = await request.json(); }
  catch { return badRequest('JSON inválido'); }

  // Cargar el actual para validar existencia y conservar campos no enviados
  const { rows: actual } = await query(
    'SELECT * FROM usuarios WHERE id_usuario = $1',
    [id]
  );
  if (!actual[0]) return notFound('Usuario no encontrado');

  const u = actual[0];

  const nombre = body.nombre !== undefined ? String(body.nombre).trim() : u.nombre;
  const email = body.email !== undefined ? (body.email ? String(body.email).trim() : null) : u.email;
  const telefono = body.telefono !== undefined ? (body.telefono ? String(body.telefono).trim() : null) : u.telefono;
  const rol = body.rol !== undefined ? String(body.rol) : u.rol;
  const activo = body.activo !== undefined ? Boolean(body.activo) : u.activo;

  if (!nombre) return badRequest('Campo "nombre" no puede quedar vacío.');
  if (!ROLES.includes(rol))
    return badRequest(`Campo "rol" debe ser uno de: ${ROLES.join(', ')}`);

  // Si envían clave, se re-hashea
  let hash = u.clave_hash;
  if (body.clave !== undefined) {
    if (String(body.clave).length < 6)
      return badRequest('Campo "clave" debe tener al menos 6 caracteres.');
    hash = await bcrypt.hash(String(body.clave), 10);
  }

  try {
    const { rows } = await query(
      `UPDATE usuarios
       SET nombre = $1, email = $2, telefono = $3, rol = $4,
           activo = $5, clave_hash = $6
       WHERE id_usuario = $7
       RETURNING id_usuario, usuario, rol, nombre, email, telefono,
                 fecha_nacimiento, activo, creado_en`,
      [nombre, email, telefono, rol, activo, hash, id]
    );
    return ok(rows[0], { tabla: 'usuarios' });
  } catch (error) {
    return pgErrorToResponse(error);
  }
}

/* ---------------- DELETE (con reglas) ---------------- */
export async function DELETE(request, { params }) {
  const authError = await checkApiKey(request);
  if (authError) return authError;

  const id = await loadId(params);
  if (!id) return badRequest('ID inválido');

  // Rechazar si tiene compras
  const { rows: compras } = await query(
    'SELECT COUNT(*)::int AS n FROM compras WHERE id_usuario = $1',
    [id]
  );
  if (compras[0].n > 0) {
    return badRequest(
      `No se puede borrar: el usuario tiene ${compras[0].n} pedido(s). ` +
      `Usa PUT para desactivarlo (activo=false).`
    );
  }

  try {
    const { rowCount } = await query(
      'DELETE FROM usuarios WHERE id_usuario = $1',
      [id]
    );
    if (!rowCount) return notFound('Usuario no encontrado');
    return noContent();
  } catch (error) {
    return pgErrorToResponse(error);
  }
}