import { Pool } from 'pg';

/**
 * Pool de conexiones a PostgreSQL.
 *
 * - `ssl`: en producción (Vercel) se requiere SSL. `rejectUnauthorized: false`
 *   acepta el certificado de Supabase aunque no esté en el trust store local.
 * - `max: 3`: en serverless (Vercel) cada instancia abre su propio pool.
 *   Mantenerlo bajo evita agotar las conexiones de Supabase.
 * - `idleTimeoutMillis`: cierra conexiones inactivas para liberar slots.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 3,
  idleTimeoutMillis: 10_000,
});

/** Ejecuta una query suelta (usa una conexión del pool automáticamente). */
export async function query(text, values = []) {
  return pool.query(text, values);
}

/** Reserva una conexión dedicada (usar cuando se necesitan transacciones). */
export async function connect() {
  return pool.connect();
}

export { pool };