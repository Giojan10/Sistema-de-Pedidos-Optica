'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { connect, query } from '../src/db.js';
import { getCustomer } from '../src/data.js';

function message(path, type, text) {
  redirect(`${path}?${type}=${encodeURIComponent(text)}`);
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export async function chooseCustomer(formData) {
  const id = positiveInteger(formData.get('id_cliente'));
  const customer = id ? await getCustomer(id) : null;
  if (!customer) message('/', 'error', 'Selecciona un cliente válido.');
  const cookieStore = await cookies();
  cookieStore.set('clienteId', String(customer.id_cliente), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
  });
  redirect('/catalogo');
}

export async function registerCustomer(formData) {
  const name = String(formData.get('nombre') || '').trim();
  const email = String(formData.get('email') || '').trim() || null;
  if (!name) message('/', 'error', 'El nombre es obligatorio.');
  const { rows } = await query('INSERT INTO clientes (nombre,email) VALUES ($1,$2) RETURNING id_cliente,nombre', [name, email]);
  const cookieStore = await cookies();
  cookieStore.set('clienteId', String(rows[0].id_cliente), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
  });
  redirect('/catalogo');
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('clienteId');
  redirect('/');
}

export async function addToCart(formData) {
  const idCustomer = await selectedCustomerId();
  const idProduct = positiveInteger(formData.get('id_producto'));
  const returnToCart = formData.get('return_to') === 'carrito';
  if (!idProduct) message('/catalogo', 'error', 'Producto inválido.');
  const client = await connect();
  let outOfStock = false;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`UPDATE productos
      SET cantidad_disponible=cantidad_disponible-1,cantidad_apartada=cantidad_apartada+1
      WHERE id_producto=$1 AND cantidad_disponible>0 RETURNING id_producto`, [idProduct]);
    if (!rows[0]) {
      await client.query('ROLLBACK');
      outOfStock = true;
    } else {
      await client.query(`INSERT INTO carrito_temp (id_cliente,id_producto,cantidad) VALUES ($1,$2,1)
        ON CONFLICT (id_cliente,id_producto) DO UPDATE SET cantidad=carrito_temp.cantidad+1`, [idCustomer, idProduct]);
      await client.query('COMMIT');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  if (outOfStock) message(returnToCart ? '/carrito' : '/catalogo', 'error', 'No hay inventario disponible para ese producto.');
  revalidatePath('/carrito');
  revalidatePath('/catalogo');
  if (returnToCart) redirect('/carrito');
  message('/catalogo', 'mensaje', 'Producto agregado al carrito.');
}

export async function removeFromCart(formData) {
  const idCustomer = await selectedCustomerId();
  const idProduct = positiveInteger(formData.get('id_producto'));
  if (!idProduct) redirect('/carrito');
  const client = await connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT cantidad FROM carrito_temp WHERE id_cliente=$1 AND id_producto=$2 FOR UPDATE', [idCustomer, idProduct]);
    if (rows[0]) {
      await client.query('UPDATE productos SET cantidad_disponible=cantidad_disponible+1,cantidad_apartada=cantidad_apartada-1 WHERE id_producto=$1', [idProduct]);
      if (rows[0].cantidad <= 1) await client.query('DELETE FROM carrito_temp WHERE id_cliente=$1 AND id_producto=$2', [idCustomer, idProduct]);
      else await client.query('UPDATE carrito_temp SET cantidad=cantidad-1 WHERE id_cliente=$1 AND id_producto=$2', [idCustomer, idProduct]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  revalidatePath('/carrito');
  revalidatePath('/catalogo');
}

export async function confirmPurchase() {
  const idCustomer = await selectedCustomerId();
  const client = await connect();
  let purchaseId;
  let emptyCart = false;
  try {
    await client.query('BEGIN');
    const { rows: items } = await client.query('SELECT id_producto,cantidad FROM carrito_temp WHERE id_cliente=$1 FOR UPDATE', [idCustomer]);
    if (!items.length) {
      await client.query('ROLLBACK');
      emptyCart = true;
    } else {
      const { rows: purchases } = await client.query(`INSERT INTO compras (id_cliente,fecha,hora,estado)
        VALUES ($1,CURRENT_DATE,LOCALTIME,'Realizado') RETURNING id_compra`, [idCustomer]);
      purchaseId = purchases[0].id_compra;
      for (const item of items) {
        const { rows: products } = await client.query('SELECT precio_unitario FROM productos WHERE id_producto=$1 FOR UPDATE', [item.id_producto]);
        await client.query('INSERT INTO compras_detalle (id_compra,id_producto,cantidad,precio_unitario) VALUES ($1,$2,$3,$4)', [purchaseId,item.id_producto,item.cantidad,products[0].precio_unitario]);
        await client.query('UPDATE productos SET cantidad_apartada=cantidad_apartada-$1 WHERE id_producto=$2', [item.cantidad,item.id_producto]);
      }
      await client.query('DELETE FROM carrito_temp WHERE id_cliente=$1', [idCustomer]);
      await client.query('COMMIT');
    }
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  if (emptyCart) message('/carrito', 'error', 'El carrito está vacío.');
  revalidatePath('/carrito');
  revalidatePath('/informe-tabular');
  revalidatePath('/informe-consolidado');
  message('/carrito', 'mensaje', `¡Pedido #${purchaseId} generado con éxito!`);
}

export async function cancelPurchase() {
  const idCustomer = await selectedCustomerId();
  const client = await connect();
  try {
    await client.query('BEGIN');
    const { rows: items } = await client.query('SELECT id_producto,cantidad FROM carrito_temp WHERE id_cliente=$1 FOR UPDATE', [idCustomer]);
    for (const item of items) await client.query('UPDATE productos SET cantidad_disponible=cantidad_disponible+$1,cantidad_apartada=cantidad_apartada-$1 WHERE id_producto=$2', [item.cantidad,item.id_producto]);
    await client.query('DELETE FROM carrito_temp WHERE id_cliente=$1', [idCustomer]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  revalidatePath('/carrito');
  revalidatePath('/catalogo');
  message('/carrito', 'mensaje', 'Compra cancelada. Los productos volvieron al inventario.');
}

async function selectedCustomerId() {
  const cookieStore = await cookies();
  const id = positiveInteger(cookieStore.get('clienteId')?.value);
  if (!id || !(await getCustomer(id))) redirect('/');
  return id;
}
