import { z } from 'zod';
import { Intelligence } from '../src/server/ai.ts';
import { Store } from '../src/server/store.ts';
import { createWorld, validAction } from '../src/server/world.ts';
try { process.loadEnvFile('.env'); } catch {}
if (!process.env.OPENROUTER_API_KEY) throw new Error('Save OPENROUTER_API_KEY in .env first. Never paste the key into chat.');
const store = new Store(process.env.DATABASE_PATH || 'data/world.sqlite');
try {
  const ai = new Intelligence(store, process.env.OPENROUTER_API_KEY, process.env.RESIDENT_MODEL, Number(process.env.MONTHLY_BUDGET_USD || 20), fetch, process.env.DECISION_MODEL || 'typesafe/jev-1.13');
  await ai.refreshCatalog();
  const before = store.budget(ai.monthlyLimit).monthSpent;
  // Isolated scenario: this check never changes the saved residents or town clock.
  const world = createWorld(4217), resident = world.residents[0];
  resident.needs.hunger = 90;
  const decision = await ai.decide(world, resident);
  if (!decision || validAction(world, resident, decision)) throw new Error(ai.lastError || 'No legal decision returned.');
  const line = await ai.json('Write one short greeting as a patient village gardener. Return JSON {"text":string}, at most 120 characters.', { name: resident.name }, z.object({ text: z.string().min(1).max(120) }), 'residents', 100);
  if (!line) throw new Error(ai.lastError || 'Dialogue check failed.');
  console.log(JSON.stringify({ decisionModel: ai.decisionModel, languageModel: ai.model, legalAction: decision.kind, dialogue: line.text, costUsd: store.budget(ai.monthlyLimit).monthSpent - before, savedTownChanged: false }, null, 2));
} finally { store.close(); }
