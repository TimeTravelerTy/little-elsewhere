import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { BudgetCategory, NewspaperEntry, WorldEvent, WorldState } from '../shared/types.ts';

export class Store {
  db: DatabaseSync;
  constructor(public path: string, recoverPending = false) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS world (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, minute REAL NOT NULL, kind TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS event_time ON events(minute);
      CREATE TABLE IF NOT EXISTS papers (id INTEGER PRIMARY KEY, day INTEGER UNIQUE NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, created TEXT NOT NULL, category TEXT NOT NULL, reserved REAL NOT NULL, cost REAL NOT NULL DEFAULT 0, status TEXT NOT NULL, model TEXT NOT NULL, detail TEXT);
      CREATE INDEX IF NOT EXISTS call_date ON calls(created);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS accepted_actions (id TEXT PRIMARY KEY, resident TEXT NOT NULL, minute REAL NOT NULL, json TEXT NOT NULL);
    `);
    // Unknown in-flight calls may have been billed. Keep their worst-case reservation as cost.
    if (recoverPending) this.db.exec("UPDATE calls SET cost=reserved,reserved=0,status='uncertain' WHERE status='pending'");
  }
  transaction<T>(fn: () => T): T { this.db.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  load(): WorldState | null { const row = this.db.prepare('SELECT json FROM world WHERE id=1').get() as { json: string } | undefined; return row ? JSON.parse(row.json) : null; }
  save(state: WorldState, events: WorldEvent[] = [], paper?: NewspaperEntry) {
    this.transaction(() => {
      this.db.prepare('INSERT INTO world(id,json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(JSON.stringify(state));
      const stmt = this.db.prepare('INSERT INTO events(id,minute,kind,json) VALUES(?,?,?,?)');
      for (const e of events) stmt.run(e.id, e.minute, e.kind, JSON.stringify(e));
      const action = this.db.prepare('INSERT OR IGNORE INTO accepted_actions(id,resident,minute,json) VALUES(?,?,?,?)');
      for (const r of state.residents) if (r.task) action.run(`${r.id}:${r.task.started}`, r.id, r.task.started, JSON.stringify(r.task.action));
      if (paper) this.db.prepare('INSERT INTO papers(id,day,json) VALUES(?,?,?) ON CONFLICT(day) DO NOTHING').run(paper.id, paper.day, JSON.stringify(paper));
    });
  }
  events(opts: { after?: number; before?: number; limit?: number; kind?: string; search?: string; resident?: string } = {}): WorldEvent[] {
    const clauses: string[] = []; const args: (number | string)[] = [];
    if (opts.after !== undefined) { clauses.push('id > ?'); args.push(opts.after); }
    if (opts.before !== undefined) { clauses.push('id < ?'); args.push(opts.before); }
    if (opts.kind) { clauses.push('kind = ?'); args.push(opts.kind); }
    if (opts.search) { clauses.push("(json_extract(json,'$.title') LIKE ? ESCAPE '\\' OR json_extract(json,'$.detail') LIKE ? ESCAPE '\\')"); const s = '%' + opts.search.replace(/[\\%_]/g, '\\$&') + '%'; args.push(s, s); }
    if (opts.resident) { clauses.push("EXISTS (SELECT 1 FROM json_each(events.json, '$.actors') WHERE value=?)"); args.push(opts.resident); }
    args.push(Math.min(500, Math.max(1, opts.limit || 100)));
    return (this.db.prepare(`SELECT json FROM events ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY id ${opts.after !== undefined ? 'ASC' : 'DESC'} LIMIT ?`).all(...args) as { json: string }[]).map(r => JSON.parse(r.json));
  }
  event(id: number): WorldEvent | null { const row = this.db.prepare('SELECT json FROM events WHERE id=?').get(id) as { json: string } | undefined; return row ? JSON.parse(row.json) : null; }
  dayEvents(start: number, end: number): WorldEvent[] { return (this.db.prepare('SELECT json FROM events WHERE minute>=? AND minute<? ORDER BY id').all(start, end) as { json: string }[]).map(r => JSON.parse(r.json)); }
  papers(): NewspaperEntry[] { return (this.db.prepare('SELECT json FROM papers ORDER BY day DESC LIMIT 100').all() as { json: string }[]).map(r => JSON.parse(r.json)); }
  getMeta(key: string) { return (this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key) as { value: string } | undefined)?.value; }
  meta(key: string, value: string) { this.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); }
  budget(monthlyLimit: number, now = new Date()) {
    const month = now.toISOString().slice(0, 7), day = now.toISOString().slice(0, 10);
    const rows = this.db.prepare('SELECT category,created,cost,reserved FROM calls WHERE created LIKE ?').all(month + '%') as { category: string; created: string; cost: number; reserved: number }[];
    const byCategory: Record<string, number> = { residents: 0, newspaper: 0, retries: 0 }; let monthSpent = 0, daySpent = 0, reserved = 0;
    for (const r of rows) { monthSpent += r.cost; reserved += r.reserved; byCategory[r.category] += r.cost + r.reserved; if (r.created.startsWith(day)) daySpent += r.cost + r.reserved; }
    // A one-off credit for a single UTC day (metadata `day-credit:YYYY-MM-DD`), e.g. to replace spend lost to a fault. The monthly cap still applies.
    const credit = Math.max(0, Math.min(monthlyLimit / 10, Number(this.getMeta(`day-credit:${day}`)) || 0));
    return { monthlyLimit, dailyLimit: monthlyLimit / new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate() + credit, monthSpent, daySpent, reserved, calls: rows.length, byCategory };
  }
  reserve(category: BudgetCategory, amount: number, model: string, monthlyLimit: number, now = new Date()): string | null {
    return this.transaction(() => { const b = this.budget(monthlyLimit, now); const allocation = { residents: .8, newspaper: .1, retries: .1 }[category];
      if (!Number.isFinite(amount) || amount <= 0 || b.monthSpent + b.reserved + amount > monthlyLimit || b.daySpent + amount > b.dailyLimit || b.byCategory[category] + amount > monthlyLimit * allocation) return null;
      const id = randomUUID(); this.db.prepare('INSERT INTO calls(id,created,category,reserved,status,model) VALUES(?,?,?,?,?,?)').run(id, now.toISOString(), category, amount, 'pending', model); return id; });
  }
  settle(id: string, cost: number | null, detail: string) { this.db.prepare('UPDATE calls SET cost=CASE WHEN ? IS NULL THEN reserved ELSE ? END,reserved=0,status=?,detail=? WHERE id=?').run(cost, cost, cost === null ? 'uncertain' : 'settled', detail.slice(0, 500), id); }
  close() { this.db.close(); }
}
