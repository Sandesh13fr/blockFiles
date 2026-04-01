import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

// Strip sslmode from DATABASE_URL so our explicit ssl config object takes full control
// (pg parses sslmode from the URL and can override the ssl:{rejectUnauthorized} option)
const _rawDatabaseUrl = process.env.DATABASE_URL;
const databaseUrl = _rawDatabaseUrl
  ? _rawDatabaseUrl.replace(/[?&]sslmode=[^&]*/g, (m, offset, str) =>
      m.startsWith('?') ? (str.includes('&') ? '?' : '') : ''
    ).replace(/\?$/, '')
  : _rawDatabaseUrl;

function envFlag(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function looksLikeSupabaseConnection(url) {
  if (!url) return false;
  return /supabase\.(co|com)/i.test(url);
}

function buildSslConfig() {
  const sslMode = (process.env.PGSSLMODE || '').toLowerCase();
  const enableSsl =
    envFlag('DB_ENABLE_SSL', false) ||
    sslMode === 'require' ||
    looksLikeSupabaseConnection(databaseUrl);

  if (!enableSsl) return false;

  // For Supabase pooler connections always disable cert verification
  // (pooler uses a self-signed cert chain that Node rejects by default)
  const rejectUnauthorized = envFlag(
    'DB_SSL_REJECT_UNAUTHORIZED',
    false  // default false for Supabase compatibility
  );

  return { rejectUnauthorized };
}

const ssl = buildSslConfig();

// When using a Supabase DATABASE_URL the connection string contains
// sslmode=require which pg parses, but we must also pass ssl:{rejectUnauthorized:false}
// explicitly to avoid "self-signed certificate in certificate chain" errors.
const poolOptions = databaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: looksLikeSupabaseConnection(databaseUrl)
        ? { rejectUnauthorized: false }
        : ssl,
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || 'postgres',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'root',
      ssl,
    };

const pool = new Pool(poolOptions);

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
