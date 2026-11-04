/**
 * migrate.js
 * Runs all SQL migration files in order.
 * Tracks applied migrations in a _migrations table.
 * Safe to run repeatedly — skips already-applied files.
 *
 * Usage:
 *   node src/db/migrate.js
 *   npm run db:migrate
 */

import pg   from 'pg';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, '../../migrations');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Set it in .env or the environment.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('sslmode=disable')
      ? false
      : { rejectUnauthorized: true },
  });

  const client = await pool.connect();
  try {
    // Create the tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Load applied migrations
    const { rows: applied } = await client.query(
      'SELECT filename FROM _migrations'
    );
    const appliedSet = new Set(applied.map(r => r.filename));

    // Read migration files in order
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`  apply ${file}`);
      await client.query(sql);
      await client.query(
        'INSERT INTO _migrations (filename) VALUES ($1)',
        [file]
      );
    }

    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
