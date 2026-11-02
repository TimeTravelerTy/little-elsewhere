import { describe, it, expect } from 'vitest';
import { createWorld, emit, startAction, advance, finishAction, routine, validAction, findRoute, walkable, legalActions } from '../src/server/world.ts';
import { context } from '../src/server/ai.ts';
import { quote } from '../src/server/economy.ts';
import type { AgentAction, Resident, WorldState } from '../src/shared/types.ts';

const street = { x: 40, y: 31 };
function act(w: WorldState, r: Resident, a: AgentAction) { expect(startAction(w, r, a), validAction(w, r, a) || a.kind).toBe(true); r.position = { ...r.task!.destination }; return finishAction(w, r); }

describe('World rules and perception', () => {
  it('rejects impossible actions without mutating resources', () => { const w = createWorld(), r = w.residents[0]; r.needs.hunger = 60; r.inventory.food = 0; r.inventory.wood = 0; r.inventory.stone = 0; const before = structuredClone(r.inventory); for (const kind of ['eat', 'cook', 'craft', 'preserve'] as const) expect(startAction(w, r, { kind, reason: 'Try.' })).toBe(false); expect(r.inventory).toEqual(before); expect(validAction(w, r, { kind: 'explore', target: 'outpost', reason: 'Go.' })).toBeTruthy(); });
  it('does not execute an action twice or complete an unfunded project', () => { const w = createWorld(), r = w.residents[0]; r.position = { ...w.projects[0].location }; const wood = r.inventory.wood; expect(startAction(w, r, { kind: 'build', target: 'bridge', reason: 'Help.' })).toBe(true); expect(startAction(w, r, { kind: 'build', target: 'bridge', reason: 'Help.' })).toBe(false); advance(w, 60); expect(r.inventory.wood).toBeLessThan(wood); expect(w.projects[0].complete).toBe(false); const inventory = structuredClone(r.inventory); advance(w, 60); expect(r.inventory).toEqual(inventory); });
  it('revalidates resources when work completes', () => { const w = createWorld(), r = w.residents[0]; r.inventory.wood = 3; expect(startAction(w, r, { kind: 'craft', reason: 'A useful tool.' })).toBe(true); r.inventory.wood = 0; const tools = r.inventory.tools; finishAction(w, r); expect(r.inventory.tools).toBe(tools); expect(r.inventory.wood).toBe(0); });
  it('trades only at a price both sides accept, conserving goods and coins', () => {
    const w = createWorld(), buyer = w.residents[3], seller = w.residents[1]; buyer.position = seller.position = { ...street };
    buyer.inventory.food = 0; seller.inventory.food = 20;
    const q = quote(w, buyer, seller, 'food')!; expect(q.price).toBeGreaterThan(0);
    const coins = buyer.inventory.coins + seller.inventory.coins, food = buyer.inventory.food + seller.inventory.food;
    act(w, buyer, { kind: 'trade', target: seller.id, item: 'food', mode: 'buy', quantity: 3, reason: 'Buy dinner.' });
    expect(buyer.inventory.food).toBeGreaterThan(0); expect(buyer.inventory.coins + seller.inventory.coins).toBe(coins); expect(buyer.inventory.food + seller.inventory.food).toBe(food);
    expect(w.market.food.trades).toBe(1);
    seller.inventory.food = 2; expect(quote(w, buyer, seller, 'food')).toBeNull();
  });
  it('keeps private events out of another resident’s prompt', () => { const w = createWorld(), r = w.residents[0], far = w.residents[1]; r.position = { x: 5, y: 30 }; far.position = { x: 60, y: 45 }; const e = emit(w, 'conversation', 'A secret', 'The secret is moonflower.', [r.id], r.position); expect(r.memories.some(m => m.eventIds.includes(e.id))).toBe(true); expect(JSON.stringify(context(w, far))).not.toContain('moonflower'); });
  it('preserves important commitments while consolidating observation memory', () => { const w = createWorld(), r = w.residents[0]; r.memories.push({ id: 'promise', minute: 0, text: 'Help Ada with the bridge.', kind: 'commitment', importance: 10, eventIds: [42] }); for (let i = 0; i < 180; i++) emit(w, 'work', 'An ordinary event', String(i), [r.id], r.position); expect(r.memories.some(m => m.id === 'promise')).toBe(true); expect(r.memories.length).toBeLessThanOrEqual(80); });
  it('makes a promise and later records its fulfillment', () => { const w = createWorld(), r = w.residents[0], t = w.residents[1]; t.position = { ...r.position }; act(w, r, { kind: 'promise', target: t.id, reason: 'I want to help.' }); expect(r.promises).toHaveLength(1); r.inventory.wood = 5; const events = act(w, r, { kind: 'build', target: 'bridge', reason: 'Keep my word.' }); expect(r.promises[0].status).toBe('kept'); expect(events.some(e => e.causeIds.includes(r.promises[0].eventId))).toBe(true); });
  it('releases, rather than breaks, a promise when others finish the project first', () => {
    const w = createWorld(), r = w.residents[0], t = w.residents[1], builder = w.residents[2]; t.position = { ...r.position };
    act(w, r, { kind: 'promise', target: t.id, reason: 'I will help.' });
    const p = w.projects[0]; p.supplied = { ...p.requires }; p.labor = p.requiredLabor - 1; builder.inventory.wood = 1;
    act(w, builder, { kind: 'build', target: 'bridge', reason: 'Finish it.' }); expect(p.complete).toBe(true);
    expect(r.promises[0].status).toBe('released'); const trust = t.relationships[r.id]?.trust || 0;
    w.minute += 3000; advance(w, 1); expect(t.relationships[r.id]?.trust || 0).toBeGreaterThanOrEqual(trust - 1); expect(r.promises[0].status).toBe('released');
  });
  it('supports a bounded response instead of an endless conversation loop', () => { const w = createWorld(), r = w.residents[0], t = w.residents[1]; t.position = { ...r.position }; startAction(w, r, { kind: 'socialize', target: t.id, reason: 'Hello.' }); finishAction(w, r); expect(t.reply?.from).toBe(r.id); const response = routine(w, t); expect(response.kind).toBe('socialize'); startAction(w, t, response); const events = finishAction(w, t); expect(t.reply).toBeUndefined(); expect(r.reply).toBeUndefined(); expect(events[0].causeIds.length).toBe(1); });
  it('makes residents leave a conversation cluster before starting another chat', () => { const w = createWorld(), r = w.residents[0], t = w.residents[1], next = w.residents[2]; t.position = next.position = { ...r.position }; startAction(w, r, { kind: 'socialize', target: t.id, reason: 'Hello.' }); finishAction(w, r); expect(validAction(w, r, { kind: 'socialize', target: next.id, reason: 'Keep chatting.' })).toContain('time between'); const action = routine(w, r); expect(['socialize', 'share', 'promise']).not.toContain(action.kind); });
  it('paths avoid water, buildings and trees, and need a bridge across the river', () => {
    const w = createWorld(); expect(findRoute(w, street, { x: 78, y: 31 })).toBeNull(); w.projects[0].complete = true;
    const path = findRoute(w, street, { x: 78, y: 31 }); expect(path?.length).toBeGreaterThan(0); for (const p of path!) expect(walkable(w, p.x, p.y)).toBe(true);
  });
  it('moves someone to open ground when new walls surround them', () => { const w = createWorld(), r = w.residents[0]; r.position = { x: 35, y: 27 }; w.buildings.push({ id: 'new-place', name: 'New place', kind: 'place', x: 33, y: 25, w: 4, h: 4, roof: '#999999', door: { x: 35, y: 29 } }); advance(w, 1); expect(walkable(w, r.position.x, r.position.y)).toBe(true); });
  it('replans after an observed major discovery', () => { const w = createWorld(), r = w.residents[0]; r.inventory.wood = 0; const tree = legalActions(w, r).find(a => a.kind === 'gather')!; startAction(w, r, tree); expect(r.task).not.toBeNull(); emit(w, 'discovery', 'A new place', 'Something to explore.', [], r.position, [], 9); expect(r.task).toBeNull(); expect(r.nextDecision).toBe(w.minute); });
  it('is deterministic from saved state and random-generator position', () => { const a = createWorld(42), b = structuredClone(a); for (let i = 0; i < 400; i++) { for (const w of [a, b]) { for (const r of w.residents) if (!r.task && r.nextDecision <= w.minute) startAction(w, r, routine(w, r)); advance(w, 5); } } expect(a).toEqual(b); });
});
