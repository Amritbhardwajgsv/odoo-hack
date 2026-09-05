const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function checksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(`
    ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT
  `);
}

function listMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql') && !file.endsWith('.down.sql'))
    .sort();
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT name, checksum FROM schema_migrations');
  return new Map(rows.map((row) => [row.name, row.checksum]));
}

// Already-applied migrations are frozen: once a file has run against the
// database, editing its content afterward would silently do nothing (the
// tracker only checks the filename), so drift here means someone edited a
// migration that already ran instead of adding a new one.
async function checkForDriftedMigrations(client, applied) {
  for (const name of listMigrations()) {
    const storedChecksum = applied.get(name);
    if (storedChecksum === undefined) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
    const currentChecksum = checksum(sql);

    if (storedChecksum === null) {
      // Applied before checksum tracking existed - adopt current content as the baseline.
      await client.query('UPDATE schema_migrations SET checksum = $1 WHERE name = $2', [
        currentChecksum,
        name,
      ]);
      continue;
    }

    if (storedChecksum !== currentChecksum) {
      throw new Error(
        `Migration "${name}" was already applied but its file content has changed since then. ` +
          'Applied migrations are frozen - put your change in a new migration file instead of editing this one.'
      );
    }
  }
}

async function migrateUp() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    await checkForDriftedMigrations(client, applied);
    const pending = listMigrations().filter((name) => !applied.has(name));

    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    for (const name of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
          name,
          checksum(sql),
        ]);
        await client.query('COMMIT');
        console.log(`Applied ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

async function migrateDown() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const { rows } = await client.query(
      'SELECT name FROM schema_migrations ORDER BY applied_at DESC LIMIT 1'
    );
    const last = rows[0];

    if (!last) {
      console.log('No migrations to roll back.');
      return;
    }

    const downFile = last.name.replace(/\.sql$/, '.down.sql');
    const downPath = path.join(MIGRATIONS_DIR, downFile);

    if (!fs.existsSync(downPath)) {
      throw new Error(`Missing down migration: ${downFile}`);
    }

    const sql = fs.readFileSync(downPath, 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('DELETE FROM schema_migrations WHERE name = $1', [last.name]);
      await client.query('COMMIT');
      console.log(`Reverted ${last.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
  }
}

async function main() {
  const direction = process.argv[2] || 'up';

  if (direction === 'up') {
    await migrateUp();
  } else if (direction === 'down') {
    await migrateDown();
  } else {
    throw new Error(`Unknown direction "${direction}". Use "up" or "down".`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
