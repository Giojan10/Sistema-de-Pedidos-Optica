import { redirect } from 'next/navigation';
import { currentUser } from '../src/session.js';

export default async function Home() {
  const user = await currentUser();
  redirect(user ? '/catalogo' : '/login');
}