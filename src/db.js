import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let initialization;

export async function ensureDatabase() {
  if (!initialization) {
    initialization = fs.promises.readFile(path.join(process.cwd(), 'database', 'schema.sql'), 'utf8')
      .then(schema => pool.query(schema))
      .catch(error => {
        initialization = undefined;
        throw error;
      });
  }
  return initialization;
}

export async function query(text, values = []) {
  await ensureDatabase();
  return pool.query(text, values);
}

export async function connect() {
  await ensureDatabase();
  return pool.connect();
}

export { pool };
