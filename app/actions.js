'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connect, query } from '../src/db.js';
import { supabaseAdmin } from '../src/supabase.js';
import { requireUser, requireAdmin } from '../src/session.js';

// Secreto para firmar los JWT. En producción DEBE venir de process.env.
const SECRET = process.env.SESSION_SECRET || 'dev-secret-cambiar';

/**
 * Helper para redirigir con un mensaje de éxito o error en la URL.
 * El componente <Notice /> lee `?error=` o `?mensaje=` y lo muestra en pantalla.
 */
function message(path, type, text) {
  redirect(`${path}?${type}=${encodeURIComponent(text)}`);
}

/**
 * Valida y normaliza un entero positivo.
 * Devuelve `null` si no es un entero válido (para usarlo como validación).
 */
function positiveInteger(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ============================================================
   AUTENTICACIÓN
   ============================================================ */

/**
 * Inicia sesión.
 * 1. Valida credenciales (usuario + clave contra el hash bcrypt).
 * 2. Firma un JWT con el id y rol del usuario.
 * 3. Guarda el JWT en una cookie HttpOnly.
 */
export async function login(formData) {
  const usuario = String(formData.get('usuario') || '').trim().toLowerCase();
  const clave = String(formData.get('clave') || '');
  
  if (!usuario || !clave) message('/login', 'error', 'Usuario y contraseña obligatorios.');

  // Buscar usuario activo
  const { rows } = await query(
    'SELECT id_usuario, clave_hash, rol FROM usuarios WHERE usuario=$1 AND activo',
    [usuario]
  );
  const u = rows[0];
  
  // Si no existe o la clave no coincide con el hash, error genérico
  // (no distinguimos entre "usuario no existe" y "clave incorrecta" por seguridad)
  if (!u || !(await bcrypt.compare(clave, u.clave_hash)))
    message('/login', 'error', 'Credenciales inválidas.');

  // Firmar JWT con expiración de 8 horas
  const token = jwt.sign(
    { id_usuario: u.id_usuario, rol: u.rol },
    SECRET,
    { expiresIn: '8h' }
  );
  
  // Guardar en cookie HttpOnly (no accesible desde JavaScript del cliente)
  const store = await cookies();
  store.set('sesion', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 horas en segundos
    secure: process.env.NODE_ENV === 'production',
  });
  
  redirect('/catalogo');
}

/**
 * Auto-registro público.
 * Crea un usuario con rol 'Cliente' (los Operarios y Admins
 * solo los puede crear un Administrador desde /maestro).
 */
export async function registerSelf(formData) {
  const usuario = String(formData.get('usuario') || '').trim().toLowerCase();
  const clave = String(formData.get('clave') || '');
  const nombre = String(formData.get('nombre') || '').trim();
  const email = String(formData.get('email') || '').trim() || null;
  
  if (!usuario || clave.length < 6 || !nombre)
    message('/registro', 'error', 'Datos inválidos (clave mínimo 6).');

  // Hashear la clave antes de guardar
  const hash = await bcrypt.hash(clave, 10);
  let id;
  
  try {
    const { rows } = await query(
      `INSERT INTO usuarios (usuario, clave_hash, rol, nombre, email)
       VALUES ($1,$2,'Cliente',$3,$4) RETURNING id_usuario`,
      [usuario, hash, nombre, email]
    );
    id = rows[0].id_usuario;
  } catch {
    // Error típico: usuario duplicado (constraint UNIQUE)
    message('/registro', 'error', 'Ese usuario ya existe.');
  }

  // Auto-login después del registro
  const token = jwt.sign({ id_usuario: id, rol: 'Cliente' }, SECRET, { expiresIn: '8h' });
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

/** Cierra la sesión eliminando la cookie. */
export async function logout() {
  (await cookies()).delete('sesion');
  redirect('/login');
}

/* ============================================================
   MAESTRO (solo Administrador)
   ============================================================ */

/**
 * Crea un usuario nuevo (Operario o Administrador).
 * Solo accesible para Administradores.
 */
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

/**
 * Crea un producto nuevo.
 * Soporta subir imagen a Supabase Storage o usar una URL externa.
 */
export async function createProduct(formData) {
  await requireAdmin();
  
  const nombre = String(formData.get('nombre') || '').trim();
  const descripcion = String(formData.get('descripcion') || '').trim() || null;
  const color = String(formData.get('color') || '').trim();
  const disponible = positiveInteger(formData.get('cantidad_disponible')) ?? 0;
  const apartada = positiveInteger(formData.get('cantidad_apartada')) ?? 0;
  const precio = Number(formData.get('precio_unitario'));
  const archivo = formData.get('imagen'); // Objeto File del <input type="file">

  if (!nombre || !color || !Number.isFinite(precio) || precio < 0)
    message('/maestro', 'error', 'Datos del producto inválidos.');

  let imagen_url = null;

  // Si el admin subió un archivo, subirlo a Supabase Storage
  if (archivo && typeof archivo !== 'string' && archivo.size > 0) {
    if (archivo.size > 2 * 1024 * 1024)
      message('/maestro', 'error', 'La imagen no puede superar 2 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type))
      message('/maestro', 'error', 'Formato no permitido (jpg, png, webp).');

    // Generar nombre único para evitar colisiones
    const ext = archivo.name.split('.').pop().toLowerCase();
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await archivo.arrayBuffer());

    const { error } = await supabaseAdmin.storage
      .from('productos')
      .upload(path, buffer, { contentType: archivo.type, upsert: false });

    if (error) message('/maestro', 'error', 'No se pudo subir la imagen.');

    // Obtener URL pública del archivo subido
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

/** Desactiva un usuario (soft delete, no lo borra). */
export async function deactivateUser(formData) {
  const admin = await requireAdmin();
  const id = positiveInteger(formData.get('id_usuario'));
  
  if (!id) message('/maestro', 'error', 'Usuario inválido.');
  
  // Evitar que el admin se desactive a sí mismo (perdería acceso)
  if (id === admin.id_usuario)
    message('/maestro', 'error', 'No puedes desactivar tu propia cuenta.');

  await query('UPDATE usuarios SET activo=false WHERE id_usuario=$1', [id]);
  revalidatePath('/maestro');
  message('/maestro', 'mensaje', 'Usuario desactivado.');
}

/** Reactiva un usuario previamente desactivado. */
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
   ------------------------------------------------------------
   Un usuario tiene a lo sumo UN pedido abierto a la vez
   (estado 'Solicitándose' o 'En edición'). Ese es su "carrito".
   ============================================================ */

/**
 * Busca el pedido abierto del usuario o crea uno nuevo.
 * Se usa `FOR UPDATE` para bloquear la fila y evitar condiciones de carrera
 * (dos peticiones simultáneas del mismo usuario).
 */
async function getOrCreateOpenOrder(client, idUsuario) {
  const { rows } = await client.query(
    `SELECT id_compra FROM compras
     WHERE id_usuario=$1 AND estado IN ('Solicitándose','En edición')
     FOR UPDATE`,
    [idUsuario]
  );
  if (rows[0]) return rows[0].id_compra;

  // Si no existe, crear el pedido vacío
  const { rows: created } = await client.query(
    `INSERT INTO compras (id_usuario, estado) VALUES ($1,'Solicitándose')
     RETURNING id_compra`,
    [idUsuario]
  );
  return created[0].id_compra;
}

/**
 * Agrega un producto al pedido abierto del usuario.
 * 
 * Flujo atómico:
 *   1. Reserva 1 unidad (disponible → apartada)
 *   2. Crea u obtiene el pedido abierto
 *   3. Inserta/incrementa la línea del detalle
 */
export async function addToCart(formData) {
  const user = await requireUser();
  const idProducto = positiveInteger(formData.get('id_producto'));
  const returnToOrder = formData.get('return_to') === 'pedido';
  
  if (!idProducto) message('/catalogo', 'error', 'Producto inválido.');

  const client = await connect();
  let sinStock = false;
  
  try {
    await client.query('BEGIN');

    // 1. Reservar inventario (atómico: solo si hay stock)
    const { rows } = await client.query(
      `UPDATE productos
       SET cantidad_disponible = cantidad_disponible - 1,
           cantidad_apartada    = cantidad_apartada + 1
       WHERE id_producto=$1 AND cantidad_disponible > 0
       RETURNING precio_unitario`,
      [idProducto]
    );
    
    if (!rows[0]) {
      // No hay stock: rollback y marcar flag
      await client.query('ROLLBACK');
      sinStock = true;
    } else {
      const precio = rows[0].precio_unitario;
      
      // 2. Obtener/crear pedido abierto
      const idCompra = await getOrCreateOpenOrder(client, user.id_usuario);

      // 3. Insertar o incrementar línea
      //    ON CONFLICT: si el producto ya está, suma cantidad
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

/**
 * Quita 1 unidad de un producto del pedido abierto.
 * 
 * Flujo:
 *   1. Devuelve 1 unidad al inventario (apartada → disponible)
 *   2. Decrementa o elimina la línea del detalle
 *   3. Si el pedido estaba en 'Solicitándose' y ya tiene productos,
 *      cambia a 'En edición' (refleja que el usuario modificó el pedido).
 */
export async function removeFromCart(formData) {
  const user = await requireUser();
  const idProducto = positiveInteger(formData.get('id_producto'));
  if (!idProducto) redirect('/pedido');

  const client = await connect();
  
  try {
    await client.query('BEGIN');

    // 1. Localizar pedido abierto
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

    // 2. Ver la línea actual
    const { rows: det } = await client.query(
      `SELECT cantidad FROM compras_detalle
       WHERE id_compra=$1 AND id_producto=$2 FOR UPDATE`,
      [idCompra, idProducto]
    );
    if (!det[0]) {
      await client.query('ROLLBACK');
      return;
    }

    // 3. Devolver 1 unidad al inventario
    await client.query(
      `UPDATE productos
       SET cantidad_disponible = cantidad_disponible + 1,
           cantidad_apartada    = cantidad_apartada - 1
       WHERE id_producto=$1`,
      [idProducto]
    );

    // 4. Decrementar o eliminar la línea
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

    // 5. Transición de estado: si el pedido aún tiene productos y
    //    estaba en 'Solicitándose', pasa a 'En edición'.
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

/**
 * Confirma el pedido abierto.
 * 
 * Flujo:
 *   1. Buscar el pedido abierto
 *   2. Mover la reserva (apartada) a venta definitiva
 *   3. Cambiar estado a 'Realizado'
 */
export async function confirmPurchase() {
  const user = await requireUser();
  const client = await connect();
  let idCompra;

  try {
    await client.query('BEGIN');

    // 1. Localizar el pedido
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

    // 2. Validar que tenga productos
    const { rows: det } = await client.query(
      'SELECT id_producto, cantidad FROM compras_detalle WHERE id_compra=$1 FOR UPDATE',
      [idCompra]
    );
    if (!det.length) {
      await client.query('ROLLBACK');
      message('/pedido', 'error', 'El pedido está vacío.');
    }

    // 3. Descontar de "apartada" (ya no es reserva, es venta)
    for (const it of det) {
      await client.query(
        `UPDATE productos SET cantidad_apartada = cantidad_apartada - $1
         WHERE id_producto=$2`,
        [it.cantidad, it.id_producto]
      );
    }

    // 4. Cambiar estado
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

/**
 * Cancela el pedido abierto.
 * 
 * Flujo:
 *   1. Buscar el pedido abierto
 *   2. Devolver TODO el inventario (apartada → disponible)
 *   3. Cambiar estado a 'Cancelado'
 */
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

    // Devolver TODO el inventario reservado
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

// Constantes para validación de imágenes
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TAMANO_MAX = 2 * 1024 * 1024; // 2 MB

/**
 * Sube una imagen a Supabase Storage y devuelve su URL pública.
 * Valida tamaño y tipo antes de subir.
 */
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

/**
 * Actualiza un producto existente.
 * 
 * Prioridad para la imagen:
 *   1. Si sube archivo → gana sobre todo.
 *   2. Si pega URL → se usa esa.
 *   3. Si marca "Quitar imagen" → se borra.
 *   4. Si no hace nada → conserva la imagen actual.
 */
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

  // Leer el producto actual para conservar la imagen si no se cambia
  const { rows: actual } = await query(
    'SELECT imagen_url FROM productos WHERE id_producto=$1',
    [id]
  );
  if (!actual[0]) message('/maestro', 'error', 'Producto no encontrado.');

  // Lógica de precedencia para la imagen
  let imagen_url = actual[0].imagen_url;

  if (archivo && typeof archivo !== 'string' && archivo.size > 0) {
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

/**
 * Elimina un producto (solo si no tiene ventas ni pedidos abiertos).
 * Si tiene ventas, se debe desactivar en su lugar.
 */
export async function deleteProduct(formData) {
  await requireAdmin();
  const id = positiveInteger(formData.get('id_producto'));
  if (!id) message('/maestro', 'error', 'Producto inválido.');

  // Verificar que no tenga ventas
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

  // Verificar que no esté en pedidos abiertos
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

/**
 * Activa o desactiva un producto (toggle).
 * Los inactivos no aparecen en el catálogo pero sí en el maestro.
 */
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