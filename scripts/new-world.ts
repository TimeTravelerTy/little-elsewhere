// Archives the current world and prepares an empty database for a new one.
// The inference spending ledger for the current month and verified price records carry over,
// so the monthly budget still counts what was already spent.
// Usage: stop the server, then `node --import tsx scripts/new-world.ts [archive-name]`.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { acquireWorldLock } from '../src/server/lock.ts';
import { Store } from '../src/server/store.ts';
try { process.loadEnvFile('.env'); } catch { /* Environment file is optional. */ }
const path = resolve(process.env.DATABASE_PATH || 'data/world.sqlite');
const name = process.argv[2] || `little-elsewhere-${new Date().toISOString().replaceAll(':', '-').slice(0, 19)}`;
const archive = resolve('data/archive', `${name}.sqlite`);
if (!existsSync(path)) throw new Error(`No world at ${path}; start the server to create one.`);
if (existsSync(archive)) throw new Error(`${archive} already exists. Choose another archive name.`);
const release = acquireWorldLock(path); // Refuses to run while the server has the world open.
try {
  mkdirSync(resolve('data/archive'), { recursive: true });
  const old = new DatabaseSync(path); old.exec('PRAGMA busy_timeout=10000'); old.prepare('VACUUM INTO ?').run(archive);
  const month = new Date().toISOString().slice(0, 7);
  const calls = old.prepare('SELECT * FROM calls WHERE created LIKE ?').all(`${month}%`) as Record<string, string | number | null>[];
  const meta = old.prepare("SELECT key, value FROM metadata WHERE key IN ('catalog', 'jev-price-blocked')").all() as { key: string; value: string }[];
  old.close();
  const check = new DatabaseSync(archive, { readOnly: true }); const saved = (check.prepare('SELECT COUNT(*) AS n FROM events').get() as { n: number }).n; check.close();
  for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
  const store = new Store(path);
  const insert = store.db.prepare('INSERT INTO calls(id,created,category,reserved,cost,status,model,detail) VALUES(?,?,?,?,?,?,?,?)');
  for (const c of calls) insert.run(c.id, c.created, c.category, c.reserved, c.cost, c.status, c.model, c.detail);
  for (const m of meta) store.meta(m.key, m.value);
  store.close();
  console.log(`Archived ${saved} events to ${archive}.`);
  console.log(`Carried ${calls.length} ledger entries for ${month}. The next server start creates a new world at ${path}.`);
} finally { release(); }
