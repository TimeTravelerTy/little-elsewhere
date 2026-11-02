import { describe, it, expect } from 'vitest';
import { advance, createWorld, emit, finishAction, legalActions, migrate, routine, startAction, validAction } from '../src/server/world.ts';
import { ADULT_AGE, SEASON_MINUTES, ageOf, birth, canCourt, comingOfAge, isChild, stageOf } from '../src/server/life.ts';
import { LEGEND_RETELLINGS, gathered, tendTraditions } from '../src/server/culture.ts';
import type { AgentAction, Resident, WorldState } from '../src/shared/types.ts';

function act(w: WorldState, r: Resident, a: AgentAction) { expect(startAction(w, r, a), validAction(w, r, a) || a.kind).toBe(true); r.position = { ...r.task!.destination }; return finishAction(w, r); }
const at = (w: WorldState, day: number, hour = 10) => { w.minute = (day - 1) * 1440 + hour * 60; w.lastDay = day; w.farm = { day, harvested: 0 }; };
const nextMorning = (w: WorldState) => advance(w, 1440 - w.minute % 1440 + 1);
const setAge = (w: WorldState, r: Resident, years: number) => { r.born = w.minute - years * SEASON_MINUTES; };
const close = (a: Resident, b: Resident, warmth = 80) => { for (const [x, y] of [[a, b], [b, a]]) x.relationships[y.id] = { warmth, trust: 30, interactions: 12 }; b.position = { ...a.position }; };

describe('Life stages', () => {
  it('ages one year per season and marks children, adults and elders', () => {
    const w = createWorld(), r = w.residents[0]; setAge(w, r, 13);
    expect(stageOf(r, w.minute)).toBe('child'); w.minute += SEASON_MINUTES; expect(stageOf(r, w.minute)).toBe('adult');
    setAge(w, r, 61); expect(stageOf(r, w.minute)).toBe('elder'); expect(Math.round(ageOf(r, w.minute))).toBe(61);
  });
  it('pairs two people who care for each other, and stings someone who hoped otherwise', () => {
    const w = createWorld(); at(w, 3); const [a, b, rival] = w.residents; for (const r of [a, b, rival]) setAge(w, r, 30);
    close(a, b, 95); rival.relationships[b.id] = { warmth: 90, trust: 10, interactions: 10 }; rival.relationships[a.id] = { warmth: 20, trust: 0, interactions: 3 };
    expect(canCourt(w, a, b)).toBeNull(); expect(canCourt(w, a, rival)).toBeTruthy();
    let tries = 0; while (!a.partner && tries++ < 20) { a.lastCourted = -99999; act(w, a, { kind: 'court', target: b.id, reason: 'Ask.' }); b.relationships[a.id].warmth = 95; }
    expect(a.partner).toBe(b.id); expect(b.partner).toBe(a.id); expect(rival.relationships[a.id].warmth).toBeLessThan(20);
    expect(canCourt(w, rival, b)).toBeTruthy();
  });
  it('has children who start between their parents\' values, eat from home and do only light work', () => {
    const w = createWorld(); at(w, 3); const [a, b] = w.residents; a.values.nature = 1; b.values.nature = -1; a.inventory.food = 10;
    const { child } = birth(w, a, b); expect(isChild(w, child)).toBe(true); expect(Math.abs(child.values.nature)).toBeLessThanOrEqual(.2);
    child.home = a.home; child.needs.hunger = 70; b.home = a.home;
    expect(validAction(w, child, { kind: 'eat', reason: 'Hungry.' })).toBeNull();
    act(w, child, { kind: 'eat', reason: 'Hungry.' }); expect(a.inventory.food).toBe(9);
    const kinds = new Set(legalActions(w, child).map(x => x.kind)); for (const k of ['trade', 'craft', 'propose', 'court', 'design', 'deposit']) expect(kinds.has(k as AgentAction['kind'])).toBe(false);
    expect(kinds.has('play')).toBe(true); expect(validAction(w, a, { kind: 'play', reason: 'No.' })).toBeTruthy();
    expect(() => routine(w, child)).not.toThrow();
  });
  it('lets a couple with room at home have a child in a mild season', () => {
    const w = createWorld(); at(w, 2); const [a, b] = w.residents; setAge(w, a, 28); setAge(w, b, 30); a.partner = b.id; b.partner = a.id; b.home = a.home; close(a, b, 90);
    a.inventory.food = 40; const born = () => w.residents.some(r => r.parents?.includes(a.id));
    // Everyone is fed so no one leaves or dies of hunger while we wait.
    for (let d = 0; d < 60 && !born(); d++) { a.inventory.food = 40; for (const r of w.residents) r.needs.hunger = 0; nextMorning(w); if (w.minute % (28 * 1440) > 20 * 1440) w.minute += 8 * 1440; for (const [x, y] of [[a, b], [b, a]]) x.relationships[y.id].warmth = 90; }
    const child = w.residents.find(r => r.parents?.includes(a.id)); expect(child).toBeTruthy(); expect(child!.home).toBe(a.home);
  });
  it('lets a child come of age into a role shaped by what they practised', () => {
    const w = createWorld(); at(w, 3); const [a, b] = w.residents; const { child } = birth(w, a, b);
    child.practice = { farm: 40, play: 10 }; setAge(w, child, ADULT_AGE); const e = comingOfAge(w, child);
    expect(child.role).toBe('Grower'); expect(e.title).toContain('came of age'); expect(isChild(w, child)).toBe(false);
  });
  it('mourns the dead and passes on what they owned', () => {
    const w = createWorld(); at(w, 3, 23); const [elder, partner, friend] = w.residents; elder.partner = partner.id; partner.partner = elder.id;
    friend.relationships[elder.id] = { warmth: 60, trust: 10, interactions: 5 }; elder.inventory.coins = 30; const coins = partner.inventory.coins;
    elder.born = w.minute - 900 * SEASON_MINUTES; nextMorning(w);
    expect(w.residents).not.toContain(elder); expect(w.departed.find(d => d.id === elder.id)?.died).toBe(true);
    expect(partner.inventory.coins).toBe(coins + 30); expect(partner.partner).toBeUndefined();
    expect(friend.memories.some(m => m.text.startsWith(`${elder.name} died`) && m.importance === 9)).toBe(true);
  });
});

describe('Friction and reciprocity', () => {
  it('lets like-minded people talk without clashing and opposites sometimes clash', () => {
    const clashes = (gap: number) => { let n = 0; for (let i = 0; i < 60; i++) { const w = createWorld(1000 + i); at(w, 2); const [a, b] = w.residents; a.values = { nature: gap, sharing: gap, industry: gap }; b.values = { nature: -gap, sharing: -gap, industry: -gap }; b.position = { ...a.position }; n += act(w, a, { kind: 'socialize', target: b.id, reason: 'Talk.' }).filter(e => e.title.includes('disagreed')).length; } return n; };
    expect(clashes(.1)).toBe(0); expect(clashes(.9)).toBeGreaterThan(5);
  });
  it('resents a refusal more from someone who has taken a lot', () => {
    const run = (given: number) => { for (let seed = 1; seed < 200; seed++) { const w = createWorld(seed); at(w, 2); const [asker, giver] = w.residents; giver.position = { ...asker.position }; asker.inventory.food = 0; asker.inventory.preserves = 0; giver.inventory.food = 20; giver.values.sharing = -1;
      asker.relationships[giver.id] = { warmth: 0, trust: 0, interactions: 0, balance: given }; giver.relationships[asker.id] = { warmth: -50, trust: 0, interactions: 0, balance: -given };
      const events = act(w, asker, { kind: 'ask', target: giver.id, item: 'food', reason: 'Please.' }); if (events.some(e => e.title.includes('turned'))) return asker.relationships[giver.id].warmth; } return 0; };
    expect(run(8)).toBeLessThan(run(0));
  });
});

describe('Legends and traditions', () => {
  it('turns a much-retold deed into a legend, but never routine work', () => {
    const w = createWorld(); at(w, 3); const tellers = w.residents.slice(0, 5), listeners = w.residents.slice(5, 12);
    for (const t of tellers) t.position = { x: 40, y: 32 };
    const deed = emit(w, 'social', 'Moss gave Ada 3 food', 'A gift, freely given.', [tellers[0].id], { x: 40, y: 32 }, [], 5, { actor: tellers[0].id, tags: { sharing: 1.5 }, summary: 'Moss gave food' });
    const chore = emit(w, 'work', 'Moss cut wood', '4 wood from an oak.', [tellers[0].id], { x: 40, y: 32 }, [], 5);
    let out: string[] = [];
    for (let i = 0; i < LEGEND_RETELLINGS + 2; i++) for (const id of [deed.id, chore.id]) {
      const t = tellers[i % 4], l = listeners[i % listeners.length]; l.position = { ...t.position }; t.lastSocial = {}; delete t.reply;
      const m = t.memories.find(m => m.eventIds.includes(id))!; out = out.concat(act(w, t, { kind: 'share', target: l.id, sharedMemoryId: m.id, reason: 'Tell it.' }).map(e => e.title)); at(w, 4 + i, 10);
    }
    expect(w.legends.map(l => l.eventId)).toEqual([deed.id]); expect(out).toContain('A story became a village legend');
  });
  it('starts a tradition when someone who was there gathers the village a year later, and lets it fade if neglected', () => {
    const w = createWorld(); at(w, 3, 12); const [host, guest] = w.residents;
    gathered(w, host, [host, guest], 1); at(w, 31, 12); expect(gathered(w, guest, [guest], 2).map(e => e.title)).toContain('A tradition has taken root');
    const t = w.traditions[0]; expect(t.season).toBe('spring'); expect(t.seasonDay).toBe(3);
    at(w, 60, 1); expect(tendTraditions(w)).toHaveLength(1); at(w, 88, 1); tendTraditions(w); expect(t.faded).toBe(true);
  });
  it('migrates older saves with ages and empty culture', () => {
    const w = createWorld() as unknown as Record<string, unknown>; for (const k of ['tales', 'legends', 'traditions', 'gatherings']) delete w[k];
    for (const r of (w as unknown as WorldState).residents) delete (r as Partial<Resident>).born;
    const m = migrate(w as unknown as WorldState); expect(m.legends).toEqual([]); expect(m.residents.every(r => ageOf(r, m.minute) >= 20)).toBe(true);
  });
});
