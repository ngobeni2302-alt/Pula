/**
 * pool.js
 * Single shared pg connection pool.
 * DATABASE_URL from environment; SSL required unless sslmode=disable.
 */

import pg from 'pg';

const { Pool } = pg;

let _pool = null;

export function getPool() {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is not set. ' +
        'Set USE_JSON_STORE=true to use the JSON file store instead.'
      );
    }
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=disable')
        ? false
        : { rejectUnauthorized: true },
      max:             10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    _pool.on('error', err => {
      console.error('[pool] Unexpected DB error:', err.message);
    });
  }
  return _pool;
}

export async function checkConnection() {
  try {
    const pool   = getPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}
