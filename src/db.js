import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 3,                   // importante en serverless (Vercel)
  idleTimeoutMillis: 10_000,
});

export async function query(text, values = []) {
  return pool.query(text, values);
}

export async function connect() {
  return pool.connect();
}

export { pool };