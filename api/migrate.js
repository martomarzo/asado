import fs from 'node:fs';
import pg from 'pg';
import 'dotenv/config';

const sql = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  console.log('Schema applied.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
