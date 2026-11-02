import { describe, expect, it } from 'vitest';
import { createWorld, startAction, finishAction, legalActions, validAction, findRoute, walkable } from '../src/server/world.ts';
import { constructionPlots } from '../src/server/construction.ts';
import { plotDoor } from '../src/shared/map.ts';
import { placeCapabilities, elementCosts } from '../src/shared/construction.ts';
import { Store } from '../src/server/store.ts';
import type { AgentAction, WorldState } from '../src/shared/types.ts';

function act(w: WorldState, a: AgentAction, index = 0) {
  const r = w.residents[index]; expect(startAction(w, r, a)).toBe(true);
  r.position = { ...r.task!.destination }; return finishAction(w, r);
}
function design(kind = 'hearth') {
  const w = createWorld(); w.projects[0].complete = true;
  act(w, { kind: 'design', target: kind, reason: 'Build somewhere useful.' }); return w;
}
function complete(w: WorldState) {
  const p = w.projects.at(-1)!, r = w.residents[0]; r.inventory.wood = 200; r.inventory.stone = 200;
  for (let i = 0; !p.complete && i < 80; i++) act(w, { kind: 'build', target: p.id, reason: 'Keep building.' });
  expect(p.complete).toBe(true); return p;
}
describe('Resident-built places', () => {
  it('gates proposals, reserves the clearing, and rejects stale concurrent proposals', () => {
    const w = createWorld(), a: AgentAction = { kind: 'design', target: 'hearth', reason: 'Try.' };
    expect(startAction(w, w.residents[0], a)).toBe(false); w.projects[0].complete = true;
    expect(startAction(w, w.residents[0], a)).toBe(true); expect(startAction(w, w.residents[1], a)).toBe(true);
    finishAction(w, w.residents[0]); finishAction(w, w.residents[1]); expect(w.projects.filter(p => p.design)).toHaveLength(1);
    expect(validAction(w, w.residents[2], { ...a, target: 'magic' })).toBeTruthy();
  });
  it('places funded blocks incrementally, attributes labor and conserves delivered materials', () => {
    const w = design(), p = w.projects.at(-1)!, r = w.residents[0];
    act(w, { kind: 'build', target: p.id, reason: 'Place the first pieces.' });
    expect(p.labor).toBeGreaterThan(0); expect(p.complete).toBe(false);
    expect(p.building!.blocks!.filter(b => b.placedBy).every(b => b.placedBy === r.id)).toBe(true);
    expect(placeCapabilities(p.building!)).toEqual([]);
    r.inventory.wood = 100; r.inventory.stone = 100; const before = { ...r.inventory }, supplied = { ...p.supplied };
    while (!p.complete) act(w, { kind: 'build', target: p.id, reason: 'Build.' });
    expect(before.wood - r.inventory.wood).toBe(p.requires.wood - supplied.wood);
    expect(before.stone - r.inventory.stone).toBe(p.requires.stone - supplied.stone);
    expect(p.building!.blocks!.every(b => !!b.placedBy)).toBe(true);
    const cost = p.building!.blocks!.reduce((sum, b) => sum + elementCosts[b.kind].wood, 0); expect(cost).toBe(p.requires.wood);
    expect(startAction(w, r, { kind: 'build', target: p.id, reason: 'Duplicate.' })).toBe(false);
  });
  it('cannot place an unfunded element and rejects work carrying only unneeded material', () => {
    const w = design(), p = w.projects.at(-1)!, r = w.residents[0]; r.inventory.wood = 0; r.inventory.stone = 0;
    expect(startAction(w, r, { kind: 'build', target: p.id, reason: 'Free work.' })).toBe(false);
    p.supplied.stone = p.requires.stone; r.inventory.stone = 5;
    expect(validAction(w, r, { kind: 'build', target: p.id, reason: 'Unneeded stone.' })).toBeTruthy(); expect(p.labor).toBe(0);
  });
  it('restores partial construction and pending work, then names and uses the finished hearth', () => {
    let w = design(); const p = w.projects.at(-1)!;
    startAction(w, w.residents[0], { kind: 'build', target: p.id, reason: 'Work.' });
    const db = new Store(':memory:'); try {
      db.save(w); w = db.load()!; finishAction(w, w.residents[0]); db.save(w); w = db.load()!;
      const built = complete(w); const capacity = w.capacity;
      const events = act(w, { kind: 'name_place', target: built.id, placeName: 'The Copper Crumb', reason: 'Name our place.' });
      expect(events[0].causeIds).toContain(built.design!.eventId);
      db.save(w); w = db.load()!; const b = w.buildings.find(b => b.id === built.id)!;
      expect(b.name).toBe('The Copper Crumb'); expect(b.namedBy).toBe('moss'); expect(placeCapabilities(b)).toEqual(['cook', 'club']); expect(w.capacity).toBe(capacity);
      w.residents[0].needs.hunger = 70; expect(legalActions(w, w.residents[0]).some(a => a.kind === 'cook' && a.target === b.id)).toBe(true);
      act(w, { kind: 'cook', target: b.id, reason: 'Use the hearth.' }); expect(w.residents[0].needs.hunger).toBe(5);
      expect(startAction(w, w.residents[0], { kind: 'rest', target: b.id, reason: 'No roof.' })).toBe(false);
    } finally { db.close(); }
  });
  it('derives shelter uses from construction, not a name, and protects naming authority', () => {
    const w = design('shelter'), p = complete(w);
    expect(placeCapabilities(p.building!)).toEqual(['rest', 'club']);
    expect(startAction(w, w.residents[1], { kind: 'name_place', target: p.id, placeName: 'Mine', reason: 'Name it.' })).toBe(false);
    expect(startAction(w, w.residents[0], { kind: 'name_place', target: p.id, placeName: '<bad>', reason: 'Name it.' })).toBe(false);
    act(w, { kind: 'name_place', target: p.id, placeName: 'Bakery of Unlimited Gold', reason: 'Name it.' });
    expect(placeCapabilities(p.building!)).not.toContain('cook');
    w.residents[0].needs.energy = 10; act(w, { kind: 'rest', target: p.id, reason: 'Rest here.' }); expect(w.residents[0].needs.energy).toBe(75);
  });
  it('keeps essential destinations reachable when every clearing is occupied', () => {
    const w = createWorld();
    for (const [i, plot] of constructionPlots.entries()) w.buildings.push({ id: `test-${i}`, name: 'Test', kind: 'place', ...plot, w: 4, h: 4, roof: '#999999', door: plotDoor(plot) });
    for (const b of w.buildings) { expect(walkable(w, b.door.x, b.door.y)).toBe(true); expect(findRoute(w, { x: 40, y: 31 }, b.door)).not.toBeNull(); }
    w.projects[0].complete = true; expect(legalActions(w, w.residents[0]).some(a => a.kind === 'design')).toBe(false);
  });
});
