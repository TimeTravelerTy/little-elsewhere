import { describe, it, expect, vi } from 'vitest';
import { advance, createWorld, farmLeft, finishAction, legalActions, migrate, startAction, validAction, wouldBreach } from '../src/server/world.ts';
import { Intelligence, JEV_MODEL } from '../src/server/ai.ts';
import { Store } from '../src/server/store.ts';
import { extensionParts, placeCapabilities, type BlueprintKind, type PartKind } from '../src/shared/construction.ts';
import { CARRY } from '../src/server/economy.ts';
import { seasonal } from '../src/server/nature.ts';
import type { AgentAction, Resident, WorldState } from '../src/shared/types.ts';

function act(w: WorldState, r: Resident, a: AgentAction) { expect(startAction(w, r, a), validAction(w, r, a) || a.kind).toBe(true); r.position = { ...r.task!.destination }; return finishAction(w, r); }
const at = (w: WorldState, day: number, hour = 10) => { w.minute = (day - 1) * 1440 + hour * 60; w.lastDay = day; w.farm = { day, harvested: 0 }; };
const nextMorning = (w: WorldState) => advance(w, 1440 - w.minute % 1440 + 1);
function builtPlace(kind: BlueprintKind = 'commons') {
  const w = createWorld(); w.projects[0].complete = true; at(w, 2); const r = w.residents[0];
  act(w, r, { kind: 'design', target: kind, reason: 'A place.' });
  const p = w.projects.at(-1)!; r.inventory.wood = 30; r.inventory.stone = 30;
  for (let i = 0; !p.complete && i < 80; i++) { r.inventory.wood = Math.max(r.inventory.wood, 20); r.inventory.stone = Math.max(r.inventory.stone, 10); act(w, r, { kind: 'build', target: p.id, reason: 'Build.' }); }
  expect(p.complete).toBe(true); return { w, r, b: w.buildings.find(b => b.id === p.id)! };
}
function extend(w: WorldState, r: Resident, buildingId: string, part: PartKind) {
  act(w, r, { kind: 'extend', target: buildingId, part, reason: 'Add to it.' });
  const p = w.projects.at(-1)!;
  for (let i = 0; !p.complete && i < 40; i++) { r.inventory.wood = 20; r.inventory.stone = 10; act(w, r, { kind: 'build', target: p.id, reason: 'Build.' }); }
  expect(p.complete).toBe(true); return p;
}

describe('Places built from parts', () => {
  it('turns a meeting place into a home by adding walls, a hearth and beds, and counts the new room', () => {
    const { w, r, b } = builtPlace('commons'); expect(placeCapabilities(b)).toEqual(['club']);
    const capacity = w.capacity;
    extend(w, r, b.id, 'enclosure'); expect(placeCapabilities(b)).toEqual(['rest', 'club']);
    extend(w, r, b.id, 'hearth'); extend(w, r, b.id, 'beds');
    expect(placeCapabilities(b)).toEqual(['cook', 'rest', 'club', 'home']); expect(w.capacity).toBe(capacity + 2);
    // Three furnishings (seats, hearth, beds) fill the room; only structure could still be added, and it already has walls.
    expect(extensionParts(b)).toEqual([]);
  });
  it('offers only a few additions at a time and keeps one open addition per place', () => {
    const { w, r, b } = builtPlace('commons');
    const offers = legalActions(w, r).filter(a => a.kind === 'extend'); expect(offers.length).toBeGreaterThan(0); expect(offers.length).toBeLessThanOrEqual(3);
    act(w, r, { kind: 'extend', target: b.id, part: 'hearth', reason: 'A fire.' });
    expect(validAction(w, w.residents[1], { kind: 'extend', target: b.id, part: 'seats', reason: 'More.' })).toBeTruthy();
    // An unfinished addition does not change what the place can do.
    expect(placeCapabilities(w.buildings.find(x => x.id === b.id)!)).toEqual(['club']);
  });
  it('adds a garden to the day\'s harvest and lets residents tend it', () => {
    const { w, r, b } = builtPlace('garden'); expect(placeCapabilities(b)).toEqual(['garden']);
    expect(farmLeft(w)).toBe(seasonal.farmCapacity.spring + 2 * seasonal.gardenYield.spring);
    const food = r.inventory.food; act(w, r, { kind: 'farm', target: b.id, reason: 'Tend the garden.' }); expect(r.inventory.food).toBeGreaterThan(food);
    expect(validAction(w, r, { kind: 'cook', target: b.id, reason: 'No hearth.' })).toBeTruthy();
  });
  it('halves pantry spoilage with a roofed larder', () => {
    const plain = createWorld(); plain.stocks.food = 1000; at(plain, 1, 23); nextMorning(plain);
    const { w } = builtPlace('larder'); expect(placeCapabilities(w.buildings.at(-1)!)).toContain('larder');
    w.stocks.food = 1000; at(w, 2, 23); nextMorning(w);
    expect(1000 - w.stocks.food).toBeLessThanOrEqual(Math.ceil((1000 - plain.stocks.food) / 2) + 1);
  });
  it('doubles a preserving batch at a smokehouse and saves wood at a workbench', () => {
    const { w, r, b } = builtPlace('smokehouse'); r.inventory.food = 10; r.inventory.wood = 3; r.inventory.preserves = 0;
    act(w, r, { kind: 'preserve', target: b.id, reason: 'Smoke it.' }); expect(r.inventory.preserves).toBe(8);
    const yard = builtPlace('workyard'); yard.r.inventory.wood = 1; yard.r.inventory.stone = 1; const tools = yard.r.inventory.tools;
    expect(validAction(yard.w, yard.r, { kind: 'craft', reason: 'No bench.' })).toBeTruthy();
    act(yard.w, yard.r, { kind: 'craft', target: yard.b.id, reason: 'At the bench.' }); expect(yard.r.inventory.tools).toBe(tools + 1); expect(yard.r.inventory.wood).toBe(0);
  });
});

describe('Carrying, the pantry and gifts', () => {
  it('stops gathering once arms are full and caps the haul', () => {
    const w = createWorld(), r = w.residents[0], tree = w.nodes.find(n => n.stage === 'mature' && (n.kind === 'oak' || n.kind === 'pine') && !n.region)!;
    r.inventory.wood = CARRY - 1; r.inventory.stone = 0; r.position = { x: tree.x, y: tree.y + 1 };
    act(w, r, { kind: 'gather', target: tree.id, reason: 'Wood.' }); expect(r.inventory.wood).toBe(CARRY);
    expect(validAction(w, r, { kind: 'gather', target: tree.id, reason: 'More.' })).toMatch(/arms are full/);
  });
  it('does not credit goods that pass back through the pantry', () => {
    const w = createWorld(), r = w.residents[0], observer = w.residents[1]; observer.values.sharing = 1; observer.position = { ...w.buildings.find(b => b.id === 'store')!.door };
    r.inventory.food = 0; r.inventory.preserves = 0;
    act(w, r, { kind: 'withdraw', item: 'food', quantity: 5, reason: 'Hungry.' });
    // Too little to count as spare, so depositing is not even offered...
    expect(legalActions(w, r).some(a => a.kind === 'deposit' && a.item === 'food')).toBe(false);
    // ...and even a forced deposit of those goods earns no credit.
    const before = observer.relationships[r.id]?.warmth || 0;
    act(w, r, { kind: 'deposit', item: 'food', quantity: 5, reason: 'Put it back.' }); expect(observer.relationships[r.id]?.warmth || 0).toBe(before);
  });
  it('gives each gift less warmth as a friendship deepens, and not twice in a morning', () => {
    const w = createWorld(), giver = w.residents[0], friend = w.residents[1]; friend.position = { ...giver.position }; giver.inventory.food = 20; friend.inventory.food = 0; friend.inventory.preserves = 0;
    act(w, giver, { kind: 'gift', target: friend.id, item: 'food', quantity: 1, reason: 'Here.' }); expect(friend.relationships[giver.id].warmth).toBe(8);
    expect(validAction(w, giver, { kind: 'gift', target: friend.id, item: 'food', quantity: 1, reason: 'Again.' })).toMatch(/recently/);
    friend.relationships[giver.id].warmth = 90; w.minute += 800;
    act(w, giver, { kind: 'gift', target: friend.id, item: 'food', quantity: 1, reason: 'Again.' }); expect(friend.relationships[giver.id].warmth).toBeLessThanOrEqual(92);
  });
});

describe('Village rules', () => {
  const setup = () => { const w = createWorld(); at(w, 3); for (const r of w.residents) r.position = { x: 40, y: 42 }; return w; };
  it('needs something to have happened before a rule can be proposed', () => {
    const w = setup(), nell = w.residents.find(r => r.id === 'nell')!;
    expect(validAction(w, nell, { kind: 'propose', target: 'spare-elders', reason: 'Protect them.' })).toBeTruthy();
    w.signals['spare-elders'] = { day: 3, text: 'Moss cut into an elder oak.' };
    expect(legalActions(w, nell).some(a => a.kind === 'propose' && a.target === 'spare-elders')).toBe(true);
    // Someone whose values run the other way would not put it forward.
    const moss = w.residents.find(r => r.id === 'moss')!; moss.values.nature = -.5; expect(validAction(w, moss, { kind: 'propose', target: 'spare-elders', reason: 'No.' })).toBeTruthy();
  });
  it('adopts a rule by the voices at the oak and judges breaking it hardest among supporters', () => {
    const w = setup(); w.signals['spare-elders'] = { day: 3, text: 'An elder oak was cut.' };
    const [nell, moss, ...rest] = [w.residents.find(r => r.id === 'nell')!, w.residents.find(r => r.id === 'moss')!, ...w.residents.filter(r => !['nell', 'moss'].includes(r.id))];
    const events = act(w, nell, { kind: 'propose', target: 'spare-elders', reason: 'Protect them.' });
    expect(events[0].kind).toBe('civic'); const p = w.proposals[0]; expect(p.for).toEqual(['nell']);
    expect(w.residents.every(r => r.memories.some(m => m.eventIds.includes(p.id)))).toBe(true);
    for (const r of rest.slice(0, 5)) act(w, r, { kind: 'vote', target: String(p.id), stance: 'for', reason: 'Yes.' });
    act(w, moss, { kind: 'vote', target: String(p.id), stance: 'against', reason: 'No.' });
    expect(validAction(w, moss, { kind: 'vote', target: String(p.id), stance: 'for', reason: 'Again.' })).toBeTruthy();
    advance(w, 1441); expect(p.status).toBe('adopted'); expect(w.norms.map(n => n.id)).toEqual(['spare-elders']);
    // Breaking it is possible, flagged in advance, and judged.
    const elder = w.nodes.find(n => n.kind === 'elder' && n.stage === 'mature')!; const cutter = rest[8]; cutter.inventory.wood = 0; cutter.position = { x: elder.x, y: elder.y + 1 };
    for (const r of [rest[0], moss]) { r.position = { ...cutter.position }; r.relationships[cutter.id] = { warmth: 0, trust: 0, interactions: 0 }; r.values.nature = 0; }
    at(w, 5, 11);
    expect(wouldBreach(w, cutter, { kind: 'gather', target: elder.id, reason: 'Wood.' })).toBe('spare-elders');
    const out = act(w, cutter, { kind: 'gather', target: elder.id, reason: 'Wood.' });
    expect(out.some(e => e.kind === 'civic' && e.title.includes('broke a village rule'))).toBe(true); expect(w.norms[0].breaches).toBe(1);
    expect(rest[0].relationships[cutter.id].warmth).toBeLessThan(moss.relationships[cutter.id]?.warmth ?? 0);
  });
  it('turns down a rule with too few voices, and gates repeal on repeated breaches', () => {
    const w = setup(); w.signals['fair-prices'] = { day: 3, text: 'Ori overcharged.' };
    const proposer = w.residents.find(r => r.id === 'ada')!; proposer.values.sharing = 1;
    act(w, proposer, { kind: 'propose', target: 'fair-prices', reason: 'Fairness.' }); advance(w, 1441);
    expect(w.proposals[0].status).toBe('rejected'); expect(w.norms).toEqual([]);
    w.norms.push({ id: 'fair-prices', adoptedDay: 1, proposedBy: 'ada', supporters: ['ada'], opponents: ['ori'], breaches: 0, eventId: 1 }); at(w, 12);
    const ori = w.residents.find(r => r.id === 'ori')!; ori.values.sharing = -1; ori.lastProposed = -99999; w.proposals = [];
    expect(validAction(w, ori, { kind: 'propose', target: 'fair-prices', repeal: true, reason: 'Drop it.' })).toBeTruthy();
    w.norms[0].breaches = 3; expect(validAction(w, ori, { kind: 'propose', target: 'fair-prices', repeal: true, reason: 'Drop it.' })).toBeNull();
  });
  it('holds tree fellers to replanting, but not through a frozen winter', () => {
    const w = createWorld(); w.norms.push({ id: 'replant', adoptedDay: 1, proposedBy: 'nell', supporters: ['nell'], opponents: [], breaches: 0, eventId: 1 });
    const r = w.residents[0]; r.treeDebt = 1; r.treeDebtSince = 23; at(w, 27, 23); nextMorning(w); expect(w.norms[0].breaches).toBe(0);
    at(w, 30, 23); nextMorning(w); expect(w.norms[0].breaches).toBe(1); expect(r.treeDebt).toBe(0);
  });
  it('lets old saves load with neutral defaults', () => {
    const w = createWorld() as unknown as Record<string, unknown>; delete w.norms; delete w.proposals; delete w.signals;
    for (const r of (w as unknown as WorldState).residents) { delete (r as Partial<Resident>).pantryNet; delete (r as Partial<Resident>).lastGave; }
    const m = migrate(w as unknown as WorldState); expect(m.norms).toEqual([]); expect(m.residents[0].pantryNet).toBe(0); expect(m.capacity).toBe(12);
  });
  it('tells the decision model when an option breaks a rule', async () => {
    const store = new Store(':memory:'), w = createWorld(); w.norms.push({ id: 'spare-elders', adoptedDay: 1, proposedBy: 'nell', supporters: ['moss'], opponents: [], breaches: 0, eventId: 1 });
    const moss = w.residents[0], elder = w.nodes.find(n => n.kind === 'elder' && n.stage === 'mature')!; moss.position = { x: elder.x, y: elder.y + 1 }; moss.inventory.wood = 0;
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ model: JEV_MODEL, answers: { action: { type: 'choice', choice: 'a0', confidence: .5 } }, usage: { cost: .00001, input_tokens: 500 } })));
    const ai = new Intelligence(store, 'test', undefined, 20, transport);
    try { await ai.decide(w, moss); const criteria = Object.values(JSON.parse(transport.mock.calls[0][1].body).questions.action.criteria) as string[];
      expect(criteria.some(c => c.includes('elder oak') && c.includes('breaks the village rule') && c.includes('you voted for it'))).toBe(true); } finally { store.close(); }
  });
});
describe('Voicing civic actions', () => {
  it('voices a vote with no conversation partner and no pending reply', async () => {
    const store = new Store(':memory:'), w = createWorld(); at(w, 3); w.signals['spare-elders'] = { day: 3, text: 'An elder oak was cut.' };
    const nell = w.residents.find(r => r.id === 'nell')!; nell.position = { x: 40, y: 42 }; act(w, nell, { kind: 'propose', target: 'spare-elders', reason: 'Protect them.' });
    const voter = w.residents[0]; delete voter.reply;
    const transport = vi.fn().mockImplementation(async (url, init) => {
      const body = JSON.parse(init.body);
      if (String(url).includes('/alpha/decisions')) return new Response(JSON.stringify({ model: JEV_MODEL, answers: { action: { type: 'choice', choice: Object.entries(body.questions.action.criteria).find(([, t]) => String(t).startsWith('vote'))![0], confidence: .6 } }, usage: { cost: .00001, input_tokens: 500 } }));
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"speech":"The old oaks deserve better than firewood."}' } }], usage: { cost: .00001 } }));
    });
    const ai = new Intelligence(store, 'test', undefined, 20, transport); ai.catalog.set(ai.model, { id: ai.model, pricing: { prompt: '.0000001', completion: '.00000015' }, supported_parameters: [] });
    try { const action = await ai.decide(w, voter); expect(action?.kind).toBe('vote'); expect(action?.speech).toContain('oaks'); } finally { store.close(); }
  });
});
