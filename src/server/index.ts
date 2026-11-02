import express from 'express';
import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { Store } from './store.ts';
import { Intelligence } from './ai.ts';
import { Engine } from './engine.ts';
import { acquireWorldLock } from './lock.ts';

try { process.loadEnvFile('.env'); } catch { /* Environment file is optional. */ }
const host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 3000);
const secret = process.env.OWNER_TOKEN;
if (host !== '127.0.0.1' && host !== 'localhost' && (!secret || secret.length < 32)) throw new Error('A public bind requires OWNER_TOKEN with at least 32 characters.');
const monthlyLimit = Number(process.env.MONTHLY_BUDGET_USD || 20);
if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0 || monthlyLimit > 30) throw new Error('MONTHLY_BUDGET_USD must be greater than zero and at most 30.');
const path = resolve(process.env.DATABASE_PATH || 'data/world.sqlite');
const releaseLock = acquireWorldLock(path);
const store = new Store(path, true); const ai = new Intelligence(store, process.env.OPENROUTER_API_KEY, process.env.RESIDENT_MODEL, monthlyLimit, fetch, process.env.DECISION_MODEL || 'typesafe/jev-1.13', process.env.NEWSPAPER_MODEL); const engine = new Engine(store, ai, Number(process.env.WORLD_SEED || 4217));
function allowedOrigin(origin: string | undefined, host: string | undefined) { if (!origin) return true; try { return new URL(origin).host === host; } catch { return false; } }
const app = express(); app.disable('x-powered-by'); app.use(express.json({ limit: '8kb' }));
const session = randomBytes(32).toString('hex');
const digest = (s: string) => createHash('sha256').update(s).digest();
const authenticated = (cookie?: string) => !secret || cookie?.split(';').some(c => { const [name, val] = c.trim().split('='); return name === 'elsewhere_session' && !!val && timingSafeEqual(digest(val), digest(session)); });
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('X-Frame-Options', 'DENY');
  if (req.path.startsWith('/api')) { res.setHeader('Cache-Control', 'no-store'); const origin = req.get('Origin'); if (!allowedOrigin(origin, req.get('Host'))) return res.status(403).json({ error: 'Origin not allowed.' }); }
  next();
});
const attempts = new Map<string, { count: number; until: number }>();
app.post('/api/login', (req, res) => {
  const ip = req.ip || 'unknown'; let slot = attempts.get(ip); if (!slot || Date.now() > slot.until) { slot = { count: 0, until: Date.now() + 60000 }; attempts.set(ip, slot); } if (++slot.count > 10) return res.status(429).json({ error: 'Please wait a minute before trying again.' });
  if (secret && (typeof req.body.token !== 'string' || !timingSafeEqual(digest(req.body.token), digest(secret)))) return res.status(401).json({ error: 'That access token is not correct.' });
  res.setHeader('Set-Cookie', `elsewhere_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`); res.json({ ok: true });
});
app.use('/api', (req, res, next) => authenticated(req.headers.cookie) ? next() : res.status(401).json({ error: 'Sign in to observe this world.' }));
app.get('/api/world', (_req, res) => res.json(engine.snapshot()));
app.get('/api/residents/:id', (req, res) => { const r = engine.state.residents.find(r => r.id === req.params.id); r ? res.json(r) : res.status(404).json({ error: 'Resident not found.' }); });
const int = (v: unknown) => typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : undefined;
app.get('/api/events', (req, res) => res.json(store.events({ after: int(req.query.after), before: int(req.query.before), limit: int(req.query.limit), kind: typeof req.query.kind === 'string' ? req.query.kind : undefined, search: typeof req.query.search === 'string' ? req.query.search.slice(0, 150) : undefined, resident: typeof req.query.resident === 'string' ? req.query.resident : undefined })));
app.get('/api/events/:id', (req, res) => { const e = store.event(int(req.params.id) || 0); e ? res.json(e) : res.status(404).json({ error: 'Event not found.' }); });
app.get('/api/newspapers', (_req, res) => res.json(store.papers()));
app.get('/api/health', (_req, res) => res.json({ status: Date.now() - new Date(engine.lastTick).getTime() < 15000 ? 'healthy' : 'delayed', uptime: Math.floor((Date.now() - engine.started) / 1000), mode: engine.snapshot().mode, model: ai.model, decisionModel: ai.decisionModel, newspaperModel: ai.newspaperModel, decisionReady: ai.decisionReady, lastTick: engine.lastTick, lastAIError: ai.lastError, databaseBytes: existsSync(path) ? statSync(path).size : 0, budget: store.budget(monthlyLimit), catalogUpdated: ai.catalogUpdated, pendingDecisions: engine.pending.size }));
const dist = resolve('dist'); if (existsSync(dist)) { app.use(express.static(dist)); app.get('/{*splat}', (_req, res) => res.sendFile(resolve(dist, 'index.html'))); }
const server = createServer(app); const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
server.on('upgrade', (req, socket, head) => {
  if (req.url?.split('?')[0] !== '/live' || !authenticated(req.headers.cookie) || !allowedOrigin(req.headers.origin, req.headers.host)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => { wss.emit('connection', ws, req); });
});
wss.on('connection', ws => { ws.send(JSON.stringify({ type: 'snapshot', sequence: engine.state.sequence, snapshot: engine.snapshot() })); });
engine.onChange = () => { if (!wss.clients.size) return; const message = JSON.stringify({ type: 'snapshot', sequence: engine.state.sequence, snapshot: engine.snapshot() }); for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) { if (ws.bufferedAmount > 2e6) ws.close(1013, 'Reconnect for a fresh snapshot'); else ws.send(message); } };
const tick = setInterval(() => { try { engine.tick(1 / 15); } catch (e) { console.error('Tick failed; stopping to protect persisted state.', e); shutdown(1); } }, 1000);
const work = setInterval(() => { void engine.work().catch(e => console.error('Background work failed:', e instanceof Error ? e.message : 'unknown error')); }, 2000);
const refresh = setInterval(() => { if (ai.key) void ai.refreshCatalog(); }, 86400000);
if (ai.key) void ai.refreshCatalog();
server.listen(port, host, () => console.log(`Little Elsewhere is running at http://${host}:${port} (${ai.key ? 'OpenRouter configured' : 'routine mode — no API key'}).`));
let stopping = false;
function shutdown(code = 0) { if (stopping) return; stopping = true; clearInterval(tick); clearInterval(work); clearInterval(refresh); for (const ws of wss.clients) ws.close(); server.close(); try { if (code === 0) store.save(engine.state); store.close(); } finally { releaseLock(); process.exit(code); } }
process.on('SIGTERM', () => shutdown()); process.on('SIGINT', () => shutdown());
