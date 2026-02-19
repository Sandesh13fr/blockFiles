import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || 'postgres',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'root',
    });

export async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

export async function ensureSchema() {
  await query(
    `CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255),
      cid VARCHAR(255),
      size INT,
      upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  );

  // Keep one row per CID before adding uniqueness guarantees.
  await query(
    `DELETE FROM files a
     USING files b
     WHERE a.id > b.id
       AND a.cid = b.cid;`
  );

  await query(`DELETE FROM files WHERE cid IS NULL OR cid = '';`);

  await query(`ALTER TABLE files ALTER COLUMN cid SET NOT NULL;`);

  await query(
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1
         FROM pg_constraint
         WHERE conname = 'files_cid_unique'
       ) THEN
         ALTER TABLE files
         ADD CONSTRAINT files_cid_unique UNIQUE (cid);
       END IF;
     END
     $$;`
  );
} 
