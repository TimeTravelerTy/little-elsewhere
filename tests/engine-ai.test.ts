import { describe, it, expect, vi } from 'vitest';
import { Store } from '../src/server/store.ts';
import { Intelligence } from '../src/server/ai.ts';
import { Engine } from '../src/server/engine.ts';
import type { AgentAction } from '../src/shared/types.ts';

function fixture() {
  const store = new Store(':memory:');
  const ai = new Intelligence(store, 'test-key');
  Object.defineProperty(ai, 'decisionReady', { get: () => true });
  const engine = new Engine(store, ai);
  engine.state.minute = 12 * 60;
  for (const r of engine.state.residents) r.nextDecision = 9999;
  const r = engine.state.residents[0]; r.nextDecision = 0;
  return { store, ai, engine, r };
}
describe('Hybrid simulation scheduling', () => {
  it('executes a decision when Jev is ready even if the language catalog is unavailable', async () => {
    const { store, ai, engine, r } = fixture();
    vi.spyOn(ai, 'decide').mockResolvedValue({ kind: 'farm', reason: 'Chosen action' });
    try { engine.tick(); expect(r.task).toBeNull(); await engine.work(); expect(r.task?.action.kind).toBe('farm'); expect(store.load()?.residents[0].task?.action.kind).toBe('farm'); } finally { store.close(); }
  });
  it('handles urgent food needs without requesting a model decision', () => {
    const { store, ai, engine, r } = fixture();
    const decide = vi.spyOn(ai, 'decide'); r.needs.hunger = 95;
    try { engine.tick(); expect(r.task?.action.kind).toBe('eat'); expect(decide).not.toHaveBeenCalled(); } finally { store.close(); }
  });
  it('revalidates delayed model actions against the current state', async () => {
    const { store, ai, engine, r } = fixture();
    let resolve!: (value: AgentAction) => void;
    vi.spyOn(ai, 'decide').mockImplementation(() => new Promise(done => { resolve = done; }));
    try {
      const work = engine.work(); expect(engine.pending.has(r.id)).toBe(true);
      r.inventory.food = 0; r.inventory.wood = 0;
      resolve({ kind: 'cook', reason: 'A stale proposal' }); await work;
      expect(r.task?.action.kind).not.toBe('cook'); expect(engine.pending.size).toBe(0);
    } finally { store.close(); }
  });
});
