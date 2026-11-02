import { describe, it, expect, vi } from 'vitest';
import { Intelligence, JEV_MODEL } from '../src/server/ai.ts';
import { Store } from '../src/server/store.ts';
import { createWorld } from '../src/server/world.ts';
const answer = (choice = 'a0', usage: unknown = { cost: .00002, input_tokens: 1000 }) => new Response(JSON.stringify({ model: JEV_MODEL, answers: { action: { type: 'choice', choice, confidence: .7, probabilities: { [choice]: .7 } } }, usage }));
describe('Jev decision boundary', () => {
  it('maps a typed option to a server-owned legal action and reconciles billing', async () => {
    const store = new Store(':memory:'), transport = vi.fn().mockResolvedValue(answer()), ai = new Intelligence(store, 'test', undefined, 20, transport), world = createWorld();
    try { const action = await ai.decide(world, world.residents[0]); expect(action?.kind).toBe('farm'); expect(transport.mock.calls[0][0]).toContain('/alpha/decisions'); const body = JSON.parse(transport.mock.calls[0][1].body); expect(body.questions.action.type).toBe('choice'); expect(store.budget(20).monthSpent).toBe(.00002); expect(store.getMeta('decision:moss')).toContain(JEV_MODEL); } finally { store.close(); }
  });
  it('rejects invented option IDs without paid repair cascades', async () => {
    const store = new Store(':memory:'), transport = vi.fn().mockResolvedValue(answer('invent-gold')), ai = new Intelligence(store, 'test', undefined, 20, transport), world = createWorld();
    try { expect(await ai.decide(world, world.residents[0])).toBeNull(); expect(await ai.decide(world, world.residents[1])).toBeNull(); expect(transport).toHaveBeenCalledTimes(1); expect(ai.decisionReady).toBe(false); } finally { store.close(); }
  });
  it('retains the reservation for uncertain billing after a timeout', async () => {
    const store = new Store(':memory:'), transport = vi.fn().mockRejectedValue(new Error('timeout')), ai = new Intelligence(store, 'test', undefined, 20, transport), world = createWorld();
    try { await ai.decide(world, world.residents[0]); expect(store.budget(20).monthSpent).toBeGreaterThan(0); expect(store.budget(20).reserved).toBe(0); expect(ai.decisionReady).toBe(false); } finally { store.close(); }
  });
  it('does not dispatch after the daily allowance has been consumed', async () => {
    const store = new Store(':memory:'), transport = vi.fn(), ai = new Intelligence(store, 'test', undefined, 20, transport), world = createWorld();
    try { const call = store.reserve('residents', store.budget(20).dailyLimit, JEV_MODEL, 20)!; store.settle(call, store.budget(20).dailyLimit, 'spent'); expect(ai.decisionReady).toBe(false); expect(await ai.decide(world, world.residents[0])).toBeNull(); expect(transport).not.toHaveBeenCalled(); } finally { store.close(); }
  });
  it('stops further requests on authorization failures', async () => {
    const store = new Store(':memory:'), transport = vi.fn().mockResolvedValue(new Response('{}', { status: 401 })), ai = new Intelligence(store, 'test', undefined, 20, transport), world = createWorld();
    try { await ai.decide(world, world.residents[0]); await ai.decide(world, world.residents[1]); expect(transport).toHaveBeenCalledTimes(1); expect(ai.cooldownUntil - Date.now()).toBeGreaterThan(290000); expect(store.budget(20).monthSpent).toBe(0); } finally { store.close(); }
  });
  it('uses the language model only to voice a chosen social action', async () => {
    const store = new Store(':memory:'), world = createWorld(); for (const r of world.residents.slice(2)) r.position = { x: 5, y: 60 }; world.residents[1].position = { ...world.residents[0].position };
    const transport = vi.fn().mockImplementation(async (url, init) => {
      const body = JSON.parse(init.body);
      if (String(url).includes('/alpha/decisions')) {
        const choice = Object.entries(body.questions.action.criteria).find(([, text]) => String(text).startsWith('socialize'))![0];
        return answer(choice);
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"speech":"Ada, shall we bring timber to the bridge tomorrow?"}' } }], usage: { cost: .00001 } }));
    });
    const ai = new Intelligence(store, 'test', undefined, 20, transport); ai.catalog.set(ai.model, { id: ai.model, pricing: { prompt: '.0000001', completion: '.00000015' }, supported_parameters: [] });
    try { const action = await ai.decide(world, world.residents[0]); expect(action?.kind).toBe('socialize'); expect(action?.speech).toContain('timber'); expect(transport).toHaveBeenCalledTimes(2); } finally { store.close(); }
  });
  it('drops invalid generated dialogue so execution uses a grounded fallback', async () => {
    const store = new Store(':memory:'), world = createWorld(); for (const r of world.residents.slice(2)) r.position = { x: 5, y: 60 }; world.residents[1].position = { ...world.residents[0].position };
    const transport = vi.fn().mockImplementation(async (url, init) => {
      const body = JSON.parse(init.body);
      if (String(url).includes('/alpha/decisions')) {
        const choice = Object.entries(body.questions.action.criteria).find(([, text]) => String(text).startsWith('socialize'))![0];
        return answer(choice);
      }
      const partner = world.residents.find(r => r.id === body.partner?.name)?.name || world.residents[1].name;
      return new Response(JSON.stringify({ choices: [{ message: { content: `{"speech":"${partner}, did you catch ${partner}'s question about wild fruit signs? Itpthoughts: yes"}` } }], usage: { cost: .00001 } }));
    });
    const ai = new Intelligence(store, 'test', undefined, 20, transport); ai.catalog.set(ai.model, { id: ai.model, pricing: { prompt: '.0000001', completion: '.00000015' }, supported_parameters: [] });
    try { const action = await ai.decide(world, world.residents[0]); expect(action?.kind).toBe('socialize'); expect(action?.speech).toBeUndefined(); } finally { store.close(); }
  });
});
