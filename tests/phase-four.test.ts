import { describe, it, expect } from 'vitest';
import { advance, createWorld, emit, finishAction, legalActions, migrate, signature, startAction, validAction } from '../src/server/world.ts';
import { shareableMemories } from '../src/server/dialogue.ts';
import { SEASON_MINUTES } from '../src/server/life.ts';
import { placeCapabilities, warmth, type BlueprintKind, type Method } from '../src/shared/construction.ts';
import { POT_KEEPS, knowsHow } from '../src/shared/making.ts';
import type { AgentAction, Resident, WorldState } from '../src/shared/types.ts';

function act(w: WorldState, r: Resident, a: AgentAction) { expect(startAction(w, r, a), validAction(w, r, a) || a.kind).toBe(true); r.position = { ...r.task!.destination }; return finishAction(w, r); }
const at = (w: WorldState, day: number, hour = 10) => { w.minute = (day - 1) * 1440 + hour * 60; w.lastDay = day; w.farm = { day, harvested: 0 }; };
const nextMorning = (w: WorldState) => advance(w, 1440 - w.minute % 1440 + 1);
const stock = (r: Resident) => Object.assign(r.inventory, { wood: 20, stone: 6, clay: 10, reeds: 10, brick: 20 });
function built(kind: BlueprintKind, method: Method = 'timber') {
  const w = createWorld(); w.projects[0].complete = true; at(w, 2); const r = w.residents[0]; r.knows = { firing: 1, daubing: 1, weaving: 1 };
  act(w, r, { kind: 'design', target: kind, method, reason: 'A place.' });
  const p = w.projects.at(-1)!;
  for (let i = 0; !p.complete && i < 120; i++) { stock(r); act(w, r, { kind: 'build', target: p.id, reason: 'Build.' }); }
  expect(p.complete).toBe(true); return { w, r, b: w.buildings.find(b => b.id === p.id)! };
}

describe('Stories worth telling', () => {
  it('lets the familiar fade: the first of something is remembered, the fiftieth hardly at all', () => {
    const w = createWorld(); at(w, 2); const [a, b, witness] = w.residents; witness.position = { ...a.position };
    const first = emit(w, 'social', `${a.name} made a promise`, `${a.name} promised ${b.name} help.`, [a.id, b.id], a.position, [], 9);
    const remembered = (id: number) => witness.memories.find(m => m.eventIds[0] === id)!.importance;
    expect(remembered(first.id)).toBe(9);
    let last = first; for (let i = 0; i < 40; i++) last = emit(w, 'social', `${b.name} made a promise`, 'Again.', [b.id], a.position, [], 9);
    expect(remembered(last.id)).toBeLessThanOrEqual(4);
    // Names and numbers do not make it new.
    expect(signature(w, 'social', `${a.name} gave ${b.name} 3 wood`)).toBe(signature(w, 'social', `${b.name} gave ${a.name} 5 wood`));
    // Given time without it, it becomes news again.
    const sig = signature(w, 'social', `${a.name} made a promise`), before = w.familiar[sig];
    for (let d = 3; d < 40; d++) { at(w, d, 23); nextMorning(w); }
    expect(w.familiar[sig] || 0).toBeLessThan(before / 2);
  });
  it('tells a listener news they have not heard, and dwells on people the teller feels strongly about', () => {
    const w = createWorld(); at(w, 2); const [teller, listener, rival] = w.residents;
    const old = emit(w, 'social', 'An old story', 'Everyone knows it.', [rival.id], teller.position, [], 8);
    listener.memories.push({ ...teller.memories.find(m => m.eventIds[0] === old.id)!, id: 'heard' });
    const fresh = emit(w, 'social', 'A new story', 'Nobody has heard it.', [rival.id], { x: 90, y: 60 }, [], 3);
    teller.memories.push({ id: 'seen', minute: w.minute, text: 'A new story. Nobody has heard it.', importance: 7, eventIds: [fresh.id], kind: 'observation', event: 'social' });
    expect(shareableMemories(teller, w, listener).at(-1)!.eventIds[0]).toBe(fresh.id);
  });
});

describe('Know-how', () => {
  it('has to be worked out by trying, and the first to manage it makes news', () => {
    const w = createWorld(); at(w, 2); const kit = w.residents.find(r => r.id === 'kit')!;
    expect(legalActions(w, kit).some(a => a.kind === 'craft' && a.item === 'brick')).toBe(false);
    let tries = 0, events: ReturnType<typeof finishAction> = [];
    while (!knowsHow(kit, 'firing') && tries < 60) { kit.inventory.clay = 5; kit.inventory.wood = 5; kit.needs.energy = 90; events = act(w, kit, { kind: 'experiment', item: 'clay', reason: 'Try.' }); tries++; }
    expect(knowsHow(kit, 'firing')).toBe(true);
    const found = events.find(e => e.kind === 'discovery')!; expect(found.title).toContain('worked out firing clay'); expect(found.detail).toContain('No one in Little Elsewhere had done it before');
    expect(w.discoveries.firing?.by).toBe('kit');
    kit.inventory.clay = 4; kit.inventory.wood = 4; act(w, kit, { kind: 'craft', item: 'brick', reason: 'Fire some.' });
    expect(kit.inventory.brick).toBe(2); expect(kit.inventory.clay).toBe(2);
  });
  it('travels by teaching, takes more than one lesson, and earns the teacher thanks', () => {
    const w = createWorld(); at(w, 2); const [teacher, learner, witness] = w.residents; teacher.knows = { weaving: 1 };
    learner.position = { ...teacher.position }; witness.position = { ...teacher.position }; witness.values.sharing = 1;
    expect(validAction(w, learner, { kind: 'teach', target: teacher.id, technique: 'weaving', reason: 'x' })).toBeTruthy();
    teacher.inventory.reeds = 10; act(w, teacher, { kind: 'teach', target: learner.id, technique: 'weaving', reason: 'Show them.' }); expect(teacher.inventory.reeds).toBe(9);
    expect(knowsHow(learner, 'weaving')).toBe(false); expect(learner.knows!.weaving).toBeGreaterThan(0);
    expect(learner.relationships[teacher.id].warmth).toBeGreaterThan(0); expect(witness.relationships[teacher.id]?.warmth || 0).toBeGreaterThan(0);
    for (let i = 0; i < 6 && !knowsHow(learner, 'weaving'); i++) { at(w, 3 + i); learner.position = { ...teacher.position }; act(w, teacher, { kind: 'teach', target: learner.id, technique: 'weaving', reason: 'Again.' }); }
    expect(knowsHow(learner, 'weaving')).toBe(true);
    learner.inventory.reeds = 3; act(w, learner, { kind: 'craft', item: 'baskets', reason: 'Weave.' }); expect(learner.inventory.baskets).toBe(1);
  });
  it('rubs off on people who watch, and is lost when the last person who knew it dies', () => {
    const w = createWorld(); at(w, 2); const [maker, onlooker] = w.residents; maker.knows = { firing: 1 }; w.discoveries.firing = { by: maker.id, day: 1 };
    onlooker.position = { ...maker.position }; maker.inventory.clay = 2; maker.inventory.wood = 2;
    startAction(w, maker, { kind: 'craft', item: 'pots', reason: 'Fire a pot.' }); maker.position = { ...maker.task!.destination }; onlooker.position = { ...maker.position }; finishAction(w, maker);
    expect(onlooker.knows!.firing).toBeGreaterThan(0);
    maker.born = w.minute - 900 * SEASON_MINUTES; at(w, 2, 23); const events = nextMorning(w);
    expect(events.some(e => e.title === 'No one left knows how to fire clay')).toBe(true); expect(w.discoveries.firing?.lost).toBe(true);
  });
});

describe('Materials and building methods', () => {
  it('needs the know-how to plan a method, and builds from the materials it calls for', () => {
    const w = createWorld(); w.projects[0].complete = true; at(w, 2); const r = w.residents[0];
    expect(validAction(w, r, { kind: 'design', target: 'cottage', method: 'wattle', reason: 'x' })).toBeTruthy();
    const { b } = built('cottage', 'wattle');
    expect(b.blocks!.filter(x => x.kind === 'wall').every(x => x.material === 'daub')).toBe(true);
    expect(b.blocks!.filter(x => x.kind === 'roof').every(x => x.material === 'thatch')).toBe(true);
    expect(placeCapabilities(b)).toContain('home');
  });
  it('keeps a brick home warmer than a timber one, so it burns less firewood', () => {
    expect(warmth(built('cottage', 'brick').b)).toBeGreaterThan(warmth(built('cottage', 'timber').b));
    const burn = (method: Method) => {
      const { w, b } = built('cottage', method); const [a, c] = w.residents.slice(5, 7);
      let burned = 0; w.stocks.wood = 0; for (const p of [a, c]) p.home = b.id;
      for (let d = 22; d < 28; d++) { for (const p of [a, c]) p.inventory.wood = 10; at(w, d, 23); nextMorning(w); burned += 20 - a.inventory.wood - c.inventory.wood; }
      return burned;
    };
    expect(burn('brick')).toBeLessThan(burn('timber'));
  });
  it('weathers walls and roofs until they fail, and lets anyone patch or rebuild them', () => {
    const { w, r, b } = built('shelter', 'wattle'); expect(placeCapabilities(b)).toContain('rest');
    let leaked = false; for (let d = 3; d < 80 && !leaked; d++) { at(w, d, 23); leaked = nextMorning(w).some(e => /leak|crumbled/.test(e.title)); }
    expect(leaked).toBe(true); expect(placeCapabilities(b)).not.toContain('rest');
    at(w, w.lastDay, 10); r.inventory.reeds = 10; r.inventory.clay = 10; r.position = { ...b.door };
    const patch = legalActions(w, r).find(a => a.kind === 'repair' && !a.method)!; expect(patch).toBeTruthy();
    for (let i = 0; i < 6 && b.blocks!.some(x => (x.wear || 0) >= .5); i++) { r.inventory.reeds = 10; r.inventory.clay = 10; act(w, r, { kind: 'repair', target: b.id, reason: 'Patch it.' }); }
    expect(placeCapabilities(b)).toContain('rest');
    // Rebuilding in another method changes what the roof is made of.
    for (const x of b.blocks!.filter(x => x.kind === 'roof')) x.wear = .8;
    r.inventory.brick = 20; act(w, r, { kind: 'repair', target: b.id, method: 'brick', reason: 'Tile it.' });
    expect(b.blocks!.filter(x => x.kind === 'roof').some(x => x.material === 'brick')).toBe(true);
  });
  it('keeps food in pots from spoiling', () => {
    const w = createWorld(); at(w, 9, 23); const [a, b] = w.residents;
    for (const r of [a, b]) { r.inventory.food = 10; r.inventory.preserves = 0; } a.inventory.pots = 2; nextMorning(w);
    expect(a.inventory.food).toBeGreaterThanOrEqual(10 - Math.max(0, 10 - 2 * POT_KEEPS));
    expect(a.inventory.food).toBe(10);
  });
  it('credits a pantry gift only as far as the pantry needs it', () => {
    const w = createWorld(); at(w, 2); const [giver, witness] = w.residents; witness.position = { ...giver.position }; witness.values.sharing = 1;
    w.stocks.wood = 1000; giver.inventory.wood = 12; giver.pantryNet = 20;
    act(w, giver, { kind: 'deposit', item: 'wood', quantity: 10, reason: 'Spare wood.' });
    expect(witness.relationships[giver.id]?.warmth || 0).toBe(0);
  });
});

describe('Upgrading a saved world', () => {
  it('adds clay and reeds, new goods and know-how, and settles everyday memories', () => {
    const w = createWorld(); at(w, 10); const [a, b] = w.residents;
    for (let i = 0; i < 30; i++) emit(w, 'social', `${a.name} made a promise`, 'Again.', [a.id], a.position, [], 9);
    const old = JSON.parse(JSON.stringify(w));
    delete old.familiar; delete old.discoveries; old.nodes = old.nodes.filter((n: { kind: string }) => n.kind !== 'clay' && n.kind !== 'reeds');
    for (const r of old.residents) { delete r.knows; delete r.tries; for (const g of ['clay', 'reeds', 'brick', 'pots', 'baskets']) delete r.inventory[g]; for (const m of r.memories) m.importance = 9; }
    for (const g of ['clay', 'reeds', 'brick', 'pots', 'baskets']) delete old.market[g];
    const m = migrate(old as WorldState);
    expect(m.nodes.some(n => n.kind === 'clay')).toBe(true); expect(m.nodes.some(n => n.kind === 'reeds')).toBe(true);
    expect(m.residents[0].inventory.pots).toBe(0); expect(m.residents[0].knows).toEqual({}); expect(m.market.brick.price).toBeGreaterThan(0);
    expect(Math.max(...m.residents[0].memories.filter(x => x.text.includes('made a promise')).map(x => x.importance))).toBeLessThan(5);
    expect(legalActions(m, b).length).toBeGreaterThan(0);
  });
});
