import { Store } from '../src/server/store.ts';
import { Intelligence } from '../src/server/ai.ts';
import { writeNewspaper, applyDraft } from '../src/server/newspaper.ts';
try { process.loadEnvFile('.env'); } catch {}
const store = new Store(process.env.DATABASE_PATH || 'data/world.sqlite');
try {
  const paper = store.papers()[0]; if (!paper) throw new Error('No edition exists yet.');
  const ai = new Intelligence(store, process.env.OPENROUTER_API_KEY, process.env.RESIDENT_MODEL, Number(process.env.MONTHLY_BUDGET_USD || 20));
  if (process.env.NEWSPAPER_MODEL) ai.newspaperModel = process.env.NEWSPAPER_MODEL;
  await ai.refreshCatalog();
  const events = store.dayEvents(paper.day === 1 ? 0 : (paper.day - 2) * 1440 + 360, (paper.day - 1) * 1440 + (paper.day === 1 ? 1440 : 360));
  const draft = await writeNewspaper(ai, events);
  if (!draft) throw new Error(ai.lastError || 'Draft failed evidence review; original edition retained.');
  const revised = applyDraft(paper, draft);
  store.transaction(() => {
    store.meta(`paper-before-rewrite:${paper.id}`, JSON.stringify(paper));
    store.db.prepare('UPDATE papers SET json=? WHERE id=?').run(JSON.stringify(revised), paper.id);
  });
  console.log(JSON.stringify(revised, null, 2));
} finally { store.close(); }
