import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 1,
});

export const query = (text, values = []) => pool.query(text, values);
export const connect = () => pool.connect();
export { pool };