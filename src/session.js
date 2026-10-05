import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCustomer } from './data.js';

export async function currentCustomer() {
  const cookieStore = await cookies();
  const id = Number(cookieStore.get('clienteId')?.value);
  if (!Number.isInteger(id) || id < 1) return null;
  return getCustomer(id);
}

export async function requireCustomer() {
  const customer = await currentCustomer();
  if (!customer) redirect('/');
  return customer;
}
