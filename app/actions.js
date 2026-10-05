'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connect, query } from '../src/db.js';
import { supabaseAdmin } from '../src/supabase.js';
import { requireUser, requireAdmin } from '../src/session.js';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-cambiar';

function message(path, type, text) {
  redirect(`${path}?${type}=${encodeURIComponent(text)}`);
}

function positiveInteger(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ============================================================
   AUTENTICACIÓN
   ============================================================ */

export async function login(formData) {
  const usuario = String(formData.get('usuario') || '').trim().toLowerCase();
  const clave = String(formData.get('clave') || '');
  if (!usuario || !clave) message('/login', 'error', 'Usuario y contraseña obligatorios.');

  const { rows } = await query(
    'SELECT id_usuario, clave_hash, rol FROM usuarios WHERE usuario=$1 AND activo',
    [usuario]
  );
  const u = rows[0];
  if (!u || !(await bcrypt.compare(clave, u.clave_hash)))
    message('/login', 'error', 'Credenciales inválidas.');

  const token = jwt.sign(
    { id_usuario: u.id_usuario, rol: u.rol },
    SECRET,
    { expiresIn: '8h' }
  );
  const store = await cookies();
  store.set('sesion', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === 'production',
  });
  redirect('/catalogo');
}

export async function registerSelf(formData) {
  const usuario = String(formData.get('usuario') || '').trim().toLowerCase();
  const clave = String(formData.get('clave') || '');
  const nombre = String(formData.get('nombre') || '').trim();
  const email = String(formData.get('email') || '').trim() || null;
  if (!usuario || clave.length < 6 || !nombre)
    message('/registro', 'error', 'Datos inválidos (clave mínimo 6).');

  const hash = await bcrypt.hash(clave, 10);
  let id;
  try {
    const { rows } = await query(
      `INSERT INTO usuarios (usuario, clave_hash, rol, nombre, email)
       VALUES ($1,$2,'Operario',$3,$4) RETURNING id_usuario`,
      [usuario, hash, nombre, email]
    );
    id = rows[0].id_usuario;
  } catch {
    message('/registro', 'error', 'Ese usuario ya existe.');
  }

  const token = jwt.sign({ id_usuario: id, rol: 'Operario' }, SECRET, { expiresIn: '8h' });
  const store = await cookies();
  store.set('sesion', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === 'production',
  });
  redirect('/catalogo');
}

export async function logout() {
  (await cookies()).delete('sesion');
  redirect('/login');
}

/* ============================================================
   MAESTRO (solo Administrador)
   ============================================================ */

export async function createUser(formData) {
  await requireAdmin();
  const usuario = String(formData.get('usuario') || '').trim().toLowerCase();
  const clave = String(formData.get('clave') || '');
  const rol = String(formData.get('rol') || 'Operario');
  const nombre = String(formData.get('nombre') || '').trim();
  const email = String(formData.get('email') || '').trim() || null;
  if (!usuario || clave.length < 6 || !nombre || !['Operario', 'Administrador'].includes(rol))
    message('/maestro', 'error', 'Datos inválidos.');

  const hash = await bcrypt.hash(clave, 10);
  try {
    await query(
      `INSERT INTO usuarios (usuario, clave_hash, rol, nombre, email)
       VALUES ($1,$2,$3,$4,$5)`,
      [usuario, hash, rol, nombre, email]
    );
  } catch {
    message('/maestro', 'error', 'Usuario duplicado.');
  }
  revalidatePath('/maestro');
  message('/maestro', 'mensaje', 'Usuario creado.');
}

export async function createProduct(formData) {
  await requireAdmin();
  const nombre = String(formData.get('nombre') || '').trim();
  const descripcion = String(formData.get('descripcion') || '').trim() || null;
  const color = String(formData.get('color') || '').trim();
  const disponible = positiveInteger(formData.get('cantidad_disponible')) ?? 0;
  const apartada = positiveInteger(formData.get('cantidad_apartada')) ?? 0;
  const precio = Number(formData.get('precio_unitario'));
  const archivo = formData.get('imagen'); // File

  if (!nombre || !color || !Number.isFinite(precio) || precio < 0)
    message('/maestro', 'error', 'Datos del producto inválidos.');

  let imagen_url = null;

  if (archivo && typeof archivo !== 'string' && archivo.size > 0) {
    // Validaciones
    if (archivo.size > 2 * 1024 * 1024)
      message('/maestro', 'error', 'La imagen no puede superar 2 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type))
      message('/maestro', 'error', 'Formato no permitido (jpg, png, webp).');

    const ext = archivo.name.split('.').pop().toLowerCase();
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await archivo.arrayBuffer());

    const { error } = await supabaseAdmin.storage
      .from('productos')
      .upload(path, buffer, { contentType: archivo.type, upsert: false });

    if (error) message('/maestro', 'error', 'No se pudo subir la imagen.');

    const { data } = supabaseAdmin.storage.from('productos').getPublicUrl(path);
    imagen_url = data.publicUrl;
  }

  await query(
    `INSERT INTO productos
       (nombre, descripcion, color, imagen_url, cantidad_disponible, cantidad_apartada, precio_unitario)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [nombre, descripcion, color, imagen_url, disponible, apartada, precio]
  );
  revalidatePath('/catalogo');
  revalidatePath('/maestro');
  message('/maestro', 'mensaje', 'Producto creado.');
}

export async function deactivateUser(formData) {
  const admin = await requireAdmin();
  const id = positiveInteger(formData.get('id_usuario'));
  if (!id) message('/maestro', 'error', 'Usuario inválido.');
  if (id === admin.id_usuario)
    message('/maestro', 'error', 'No puedes desactivar tu propia cuenta.');

  await query('UPDATE usuarios SET activo=false WHERE id_usuario=$1', [id]);
  revalidatePath('/maestro');
  message('/maestro', 'mensaje', 'Usuario desactivado.');
}

export async function reactivateUser(formData) {
  await requireAdmin();
  const id = positiveInteger(formData.get('id_usuario'));
  if (!id) message('/maestro', 'error', 'Usuario inválido.');
  await query('UPDATE usuarios SET activo=true WHERE id_usuario=$1', [id]);
  revalidatePath('/maestro');
  message('/maestro', 'mensaje', 'Usuario reactivado.');
}

/* ============================================================
   PEDIDO (reemplaza al antiguo carrito_temp)
   ============================================================ */

async function getOrCreateOpenOrder(client, idUsuario) {
  const { rows } = await client.query(
    `SELECT id_compra FROM compras
     WHERE id_usuario=$1 AND estado IN ('Solicitándose','En edición')
     FOR UPDATE`,
    [idUsuario]
  );
  if (rows[0]) return rows[0].id_compra;

  const { rows: created } = await client.query(
    `INSERT INTO compras (id_usuario, estado) VALUES ($1,'Solicitándose')
     RETURNING id_compra`,
    [idUsuario]
  );
  return created[0].id_compra;
}

export async function addToCart(formData) {
  const user = await requireUser();
  const idProducto = positiveInteger(formData.get('id_producto'));
  const returnToOrder = formData.get('return_to') === 'pedido';
  if (!idProducto) message('/catalogo', 'error', 'Producto inválido.');

  const client = await connect();
  let sinStock = false;
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE productos
       SET cantidad_disponible = cantidad_disponible - 1,
           cantidad_apartada    = cantidad_apartada + 1
       WHERE id_producto=$1 AND cantidad_disponible > 0
       RETURNING precio_unitario`,
      [idProducto]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      sinStock = true;
    } else {
      const precio = rows[0].precio_unitario;
      const idCompra = await getOrCreateOpenOrder(client, user.id_usuario);

      await client.query(
        `INSERT INTO compras_detalle (id_compra, id_producto, cantidad, precio_unitario)
         VALUES ($1,$2,1,$3)
         ON CONFLICT (id_compra, id_producto)
         DO UPDATE SET cantidad = compras_detalle.cantidad + 1`,
        [idCompra, idProducto, precio]
      );

      await client.query(
        `UPDATE compras SET actualizado_en=NOW() WHERE id_compra=$1`,
        [idCompra]
      );

      await client.query('COMMIT');
    }
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  if (sinStock) message(returnToOrder ? '/pedido' : '/catalogo', 'error', 'No hay inventario disponible.');
  revalidatePath('/pedido');
  revalidatePath('/catalogo');
  if (returnToOrder) redirect('/pedido');
  message('/catalogo', 'mensaje', 'Producto agregado al pedido.');
}

export async function removeFromCart(formData) {
  const user = await requireUser();
  const idProducto = positiveInteger(formData.get('id_producto'));
  if (!idProducto) redirect('/pedido');

  const client = await connect();
  try {
    await client.query('BEGIN');

    const { rows: order } = await client.query(
      `SELECT id_compra, estado FROM compras
       WHERE id_usuario=$1 AND estado IN ('Solicitándose','En edición')
       FOR UPDATE`,
      [user.id_usuario]
    );
    if (!order[0]) {
      await client.query('ROLLBACK');
      return;
    }
    const { id_compra: idCompra, estado } = order[0];

    const { rows: det } = await client.query(
      `SELECT cantidad FROM compras_detalle
       WHERE id_compra=$1 AND id_producto=$2 FOR UPDATE`,
      [idCompra, idProducto]
    );
    if (!det[0]) {
      await client.query('ROLLBACK');
      return;
    }

    await client.query(
      `UPDATE productos
       SET cantidad_disponible = cantidad_disponible + 1,
           cantidad_apartada    = cantidad_apartada - 1
       WHERE id_producto=$1`,
      [idProducto]
    );

    if (det[0].cantidad <= 1) {
      await client.query(
        'DELETE FROM compras_detalle WHERE id_compra=$1 AND id_producto=$2',
        [idCompra, idProducto]
      );
    } else {
      await client.query(
        `UPDATE compras_detalle SET cantidad=cantidad-1
         WHERE id_compra=$1 AND id_producto=$2`,
        [idCompra, idProducto]
      );
    }

    const { rows: restantes } = await client.query(
      'SELECT COUNT(*)::int AS n FROM compras_detalle WHERE id_compra=$1',
      [idCompra]
    );
    if (restantes[0].n > 0 && estado === 'Solicitándose') {
      await client.query(
        `UPDATE compras SET estado='En edición', actualizado_en=NOW()
         WHERE id_compra=$1`,
        [idCompra]
      );
    } else {
      await client.query(
        'UPDATE compras SET actualizado_en=NOW() WHERE id_compra=$1',
        [idCompra]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  revalidatePath('/pedido');
  revalidatePath('/catalogo');
}

export async function confirmPurchase() {
  const user = await requireUser();
  const client = await connect();
  let idCompra;

  try {
    await client.query('BEGIN');

    const { rows: order } = await client.query(
      `SELECT id_compra FROM compras
       WHERE id_usuario=$1 AND estado IN ('Solicitándose','En edición')
       FOR UPDATE`,
      [user.id_usuario]
    );
    if (!order[0]) {
      await client.query('ROLLBACK');
      message('/pedido', 'error', 'No tienes un pedido abierto.');
    }
    idCompra = order[0].id_compra;

    const { rows: det } = await client.query(
      'SELECT id_producto, cantidad FROM compras_detalle WHERE id_compra=$1 FOR UPDATE',
      [idCompra]
    );
    if (!det.length) {
      await client.query('ROLLBACK');
      message('/pedido', 'error', 'El pedido está vacío.');
    }

    for (const it of det) {
      await client.query(
        `UPDATE productos SET cantidad_apartada = cantidad_apartada - $1
         WHERE id_producto=$2`,
        [it.cantidad, it.id_producto]
      );
    }

    await client.query(
      `UPDATE compras SET estado='Realizado', actualizado_en=NOW()
       WHERE id_compra=$1`,
      [idCompra]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  revalidatePath('/pedido');
  revalidatePath('/catalogo');
  revalidatePath('/informe-tabular');
  revalidatePath('/informe-consolidado');
  message('/pedido', 'mensaje', `¡Pedido #${idCompra} confirmado!`);
}

export async function cancelPurchase() {
  const user = await requireUser();
  const client = await connect();
  let idCompra;

  try {
    await client.query('BEGIN');

    const { rows: order } = await client.query(
      `SELECT id_compra FROM compras
       WHERE id_usuario=$1 AND estado IN ('Solicitándose','En edición')
       FOR UPDATE`,
      [user.id_usuario]
    );
    if (!order[0]) {
      await client.query('ROLLBACK');
      message('/pedido', 'error', 'No tienes un pedido abierto.');
    }
    idCompra = order[0].id_compra;

    const { rows: det } = await client.query(
      'SELECT id_producto, cantidad FROM compras_detalle WHERE id_compra=$1 FOR UPDATE',
      [idCompra]
    );

    for (const it of det) {
      await client.query(
        `UPDATE productos
         SET cantidad_disponible = cantidad_disponible + $1,
             cantidad_apartada    = cantidad_apartada - $1
         WHERE id_producto=$2`,
        [it.cantidad, it.id_producto]
      );
    }

    await client.query(
      `UPDATE compras SET estado='Cancelado', actualizado_en=NOW()
       WHERE id_compra=$1`,
      [idCompra]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  revalidatePath('/pedido');
  revalidatePath('/catalogo');
  revalidatePath('/informe-tabular');
  revalidatePath('/informe-consolidado');
  message('/pedido', 'mensaje', `Pedido #${idCompra} cancelado. Inventario devuelto.`);
}

/* ============================================================
   PRODUCTOS · editar / eliminar / activar
   ============================================================ */

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TAMANO_MAX = 2 * 1024 * 1024;

async function subirImagen(archivo) {
  if (archivo.size > TAMANO_MAX)
    message('/maestro', 'error', 'La imagen no puede superar 2 MB.');
  if (!TIPOS_PERMITIDOS.includes(archivo.type))
    message('/maestro', 'error', 'Formato no permitido (jpg, png, webp, gif).');

  const ext = archivo.name.split('.').pop().toLowerCase();
  const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await archivo.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from('productos')
    .upload(path, buffer, { contentType: archivo.type, upsert: false });

  if (error)
    message('/maestro', 'error', `No se pudo subir la imagen: ${error.message}`);

  const { data } = supabaseAdmin.storage.from('productos').getPublicUrl(path);
  return data.publicUrl;
}

export async function updateProduct(formData) {
  await requireAdmin();

  const id = positiveInteger(formData.get('id_producto'));
  if (!id) message('/maestro', 'error', 'Producto inválido.');

  const nombre      = String(formData.get('nombre') || '').trim();
  const descripcion = String(formData.get('descripcion') || '').trim() || null;
  const color       = String(formData.get('color') || '').trim();
  const precio      = Number(formData.get('precio_unitario'));
  const disponible  = positiveInteger(formData.get('cantidad_disponible')) ?? 0;
  const imagen_url_input = String(formData.get('imagen_url') || '').trim();
  const archivo     = formData.get('imagen');
  const quitarImagen = formData.get('quitar_imagen') === 'on';

  if (!nombre || !color || !Number.isFinite(precio) || precio < 0)
    message('/maestro', 'error', 'Datos del producto inválidos.');

  // Lee el producto actual
  const { rows: actual } = await query(
    'SELECT imagen_url FROM productos WHERE id_producto=$1',
    [id]
  );
  if (!actual[0]) message('/maestro', 'error', 'Producto no encontrado.');

  // Decide la nueva imagen_url
  let imagen_url = actual[0].imagen_url;

  if (archivo && typeof archivo !== 'string' && archivo.size > 0) {
    // Sube archivo nuevo → gana sobre todo lo demás
    imagen_url = await subirImagen(archivo);
  } else if (imagen_url_input) {
    if (!/^https?:\/\//i.test(imagen_url_input))
      message('/maestro', 'error', 'La URL debe empezar por http:// o https://');
    imagen_url = imagen_url_input;
  } else if (quitarImagen) {
    imagen_url = null;
  }

  await query(
    `UPDATE productos
     SET nombre=$1, descripcion=$2, color=$3, precio_unitario=$4,
         cantidad_disponible=$5, imagen_url=$6
     WHERE id_producto=$7`,
    [nombre, descripcion, color, precio, disponible, imagen_url, id]
  );

  revalidatePath('/catalogo');
  revalidatePath('/maestro');
  message('/maestro', 'mensaje', 'Producto actualizado.');
}

export async function deleteProduct(formData) {
  await requireAdmin();
  const id = positiveInteger(formData.get('id_producto'));
  if (!id) message('/maestro', 'error', 'Producto inválido.');

  // Verifica ventas asociadas
  const { rows: usos } = await query(
    'SELECT COUNT(*)::int AS n FROM compras_detalle WHERE id_producto=$1',
    [id]
  );
  if (usos[0].n > 0)
    message(
      '/maestro',
      'error',
      `No se puede eliminar: el producto aparece en ${usos[0].n} venta(s). Desactívalo en su lugar.`
    );

  // También verifica carritos/pedidos abiertos
  const { rows: abiertos } = await query(
    `SELECT COUNT(*)::int AS n
     FROM compras_detalle cd
     JOIN compras c USING (id_compra)
     WHERE cd.id_producto=$1 AND c.estado IN ('Solicitándose','En edición')`,
    [id]
  );
  if (abiertos[0].n > 0)
    message('/maestro', 'error', 'El producto está en pedidos abiertos. No se puede eliminar.');

  await query('DELETE FROM productos WHERE id_producto=$1', [id]);

  revalidatePath('/catalogo');
  revalidatePath('/maestro');
  message('/maestro', 'mensaje', 'Producto eliminado.');
}

export async function toggleProductActive(formData) {
  await requireAdmin();
  const id = positiveInteger(formData.get('id_producto'));
  if (!id) message('/maestro', 'error', 'Producto inválido.');

  await query(
    'UPDATE productos SET activo = NOT activo WHERE id_producto=$1',
    [id]
  );
  revalidatePath('/catalogo');
  revalidatePath('/maestro');
  message('/maestro', 'mensaje', 'Estado del producto actualizado.');
}