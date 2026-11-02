import { describe, it, expect } from 'vitest';
import { advance, createWorld, finishAction, findRoute, legalActions, startAction, validAction, walkable } from '../src/server/world.ts';
import { growNature, isTree } from '../src/server/nature.ts';
import { MAP_W, constructionPlots, frontierDoor, frontierHomes, initialBuildings, plotDoor, reserved, tileIndex } from '../src/shared/map.ts';
import { seasonOf } from '../src/shared/types.ts';
import type { AgentAction, Resident, WorldState } from '../src/shared/types.ts';

const street = { x: 40, y: 31 };
function act(w: WorldState, r: Resident, a: AgentAction) { expect(startAction(w, r, a), validAction(w, r, a) || a.kind).toBe(true); r.position = { ...r.task!.destination }; return finishAction(w, r); }
const toDay = (w: WorldState, day: number) => { w.minute = (day - 1) * 1440 + 600; w.lastDay = day; w.farm = { day, harvested: 0 }; };
const nextMorning = (w: WorldState) => advance(w, 1440 - w.minute % 1440 + 1);

describe('The map', () => {
  it('opens every door onto ground connected to the village', () => {
    const w = createWorld(); w.projects[0].complete = true; w.regions.forEach(r => r.discovered = true);
    const doors = [...initialBuildings.map(b => b.door), ...constructionPlots.map(plotDoor), ...frontierHomes.map(frontierDoor)];
    for (const door of doors) { expect(walkable(w, door.x, door.y), JSON.stringify(door)).toBe(true); expect(findRoute(w, street, door), JSON.stringify(door)).not.toBeNull(); }
  });
  it('keeps scenery off roads, doorsteps, plots and building sites', () => {
    const w = createWorld(); for (const n of w.nodes.filter(n => !['fish', 'clay', 'reeds'].includes(n.kind))) expect(reserved(n.x, n.y, 0), n.id).toBe(false);
    // Clay and reeds belong at the water's edge, on open ground anyone can reach.
    for (const n of w.nodes.filter(n => n.kind === 'clay' || n.kind === 'reeds')) { expect(walkable(w, n.x, n.y), n.id).toBe(true); expect(findRoute(w, { x: 40, y: 32 }, n), n.id).not.toBeNull(); expect(w.nodes.filter(o => o.x === n.x && o.y === n.y)).toHaveLength(1); }
    const doors = new Set([...initialBuildings.map(b => b.door), ...constructionPlots.map(plotDoor)].map(d => tileIndex(d.x, d.y)));
    for (const n of w.nodes) expect(doors.has(tileIndex(n.x, n.y))).toBe(false);
    expect(w.nodes.filter(n => n.kind === 'elder').length).toBeGreaterThan(20); expect(w.nodes.filter(n => n.kind === 'rock').length).toBeGreaterThan(10);
  });
  it('can reach every mature village tree from the street', () => {
    const w = createWorld(); for (const n of w.nodes.filter(n => isTree(n) && n.stage === 'mature' && !n.region).slice(0, 60)) expect(findRoute(w, street, n), n.id).not.toBeNull();
  });
});
describe('Seasons, food and firewood', () => {
  it('turns the year through four seven-day seasons and freezes the fields in winter', () => {
    expect([1, 8, 15, 22, 29].map(d => seasonOf((d - 1) * 1440 + 480))).toEqual(['spring', 'summer', 'autumn', 'winter', 'spring']);
    const w = createWorld(); toDay(w, 22); expect(validAction(w, w.residents[0], { kind: 'farm', reason: 'Plant.' })).toContain('frozen');
  });
  it('limits how much the fields give each day', () => {
    const w = createWorld(), r = w.residents[1]; w.farm = { day: 1, harvested: 11 }; act(w, r, { kind: 'farm', reason: 'Harvest.' });
    expect(w.farm.harvested).toBe(12); expect(validAction(w, w.residents[2], { kind: 'farm', reason: 'More.' })).toContain('given all');
  });
  it('spoils fresh food overnight but barely touches preserves', () => {
    const w = createWorld(); toDay(w, 10); for (const r of w.residents) { r.inventory.food = 50; r.inventory.preserves = 50; }
    nextMorning(w); const food = w.residents.reduce((s, r) => s + r.inventory.food, 0), preserves = w.residents.reduce((s, r) => s + r.inventory.preserves, 0);
    expect(food).toBeLessThan(600 * .95); expect(preserves).toBeGreaterThan(600 * .97);
  });
  it('burns firewood in winter and leaves a home cold without it, which spoils rest', () => {
    const w = createWorld(); toDay(w, 22); w.stocks.wood = 0;
    for (const r of w.residents) r.inventory.wood = r.home === 'home-1' ? 0 : 5;
    nextMorning(w);
    expect(w.buildings.find(b => b.id === 'home-1')!.cold).toBe(true); expect(w.buildings.find(b => b.id === 'home-2')!.cold).toBe(false);
    const sleeper = w.residents.find(r => r.home === 'home-1')!; sleeper.needs.energy = 10; w.minute += 12 * 60;
    act(w, sleeper, { kind: 'rest', reason: 'Sleep.' }); expect(sleeper.needs.energy).toBe(45);
  });
  it('sends someone away only after days of real hunger', () => {
    const w = createWorld(); toDay(w, 22); const r = w.residents[1]; r.inventory.food = 0; r.inventory.preserves = 0;
    for (let d = 0; d < 3; d++) { r.needs.hunger = 100; nextMorning(w); } expect(w.residents).toContain(r);
    r.needs.hunger = 100; r.inventory.food = 0; nextMorning(w); expect(w.residents).not.toContain(r); expect(w.departed.map(d => d.id)).toContain(r.id);
  });
});
describe('Trees, stone and berries', () => {
  it('fells a tree to a stump, and a replanted stump grows back', () => {
    const w = createWorld(), r = w.residents[0], tree = w.nodes.find(n => n.kind === 'oak' && n.stage === 'mature' && !n.region)!; tree.amount = 3;
    act(w, r, { kind: 'gather', target: tree.id, reason: 'Timber.' }); expect(tree.stage).toBe('stump');
    act(w, r, { kind: 'plant', target: tree.id, reason: 'Replant.' }); expect(tree.stage).toBe('sapling'); r.position = { ...street };
    for (let i = 0; i < 12; i++) growNature(w, 'summer', () => .5); expect(tree.stage).toBe('mature'); expect(tree.amount).toBeGreaterThan(0);
  });
  it('makes a forest-loving neighbor think less of whoever fells an elder oak', () => {
    const w = createWorld(), moss = w.residents[0], nell = w.residents.find(r => r.id === 'nell')!, elder = w.nodes.find(n => n.kind === 'elder')!;
    elder.amount = 2; moss.position = { x: elder.x + 1, y: elder.y }; nell.position = { x: elder.x, y: elder.y + 1 };
    act(w, moss, { kind: 'gather', target: elder.id, reason: 'Timber.' });
    expect(nell.relationships.moss.warmth).toBeLessThan(0); expect(nell.relationships.moss.note).toContain('elder oak');
  });
  it('keeps frontier resources out of reach until the bridge and survey allow it', () => {
    const w = createWorld(), r = w.residents[0], far = w.nodes.find(n => n.region === 'outpost' && n.kind === 'rock')!;
    expect(validAction(w, r, { kind: 'gather', target: far.id, reason: 'Stone.' })).toBeTruthy();
    w.projects[0].complete = true; w.regions.find(g => g.id === 'outpost')!.discovered = true; expect(validAction(w, r, { kind: 'gather', target: far.id, reason: 'Stone.' })).toBeNull();
  });
  it('wears grass into a path where people walk, and lets it fade', () => {
    const w = createWorld(), r = w.residents[0]; r.position = { x: 45, y: 23 };
    r.task = { action: { kind: 'rest', reason: 'Walk.' }, destination: { x: 45, y: 29 }, route: findRoute(w, r.position, { x: 45, y: 29 })!, remaining: 5, started: w.minute };
    advance(w, 2); const worn = w.wear.reduce((a, b) => a + b, 0); expect(worn).toBeGreaterThan(0);
    nextMorning(w); expect(w.wear.reduce((a, b) => a + b, 0)).toBeLessThan(worn + 50); expect(w.wear.length).toBe(MAP_W * 64);
  });
});
describe('Sharing, asking and reputation', () => {
  it('warms the recipient of a gift and lets observers who value sharing notice', () => {
    const w = createWorld(), ada = w.residents.find(r => r.id === 'ada')!, bea = w.residents.find(r => r.id === 'bea')!, finch = w.residents.find(r => r.id === 'finch')!;
    ada.position = bea.position = finch.position = { ...street }; ada.inventory.food = 20; bea.inventory.food = 0;
    expect(legalActions(w, ada).some(a => a.kind === 'gift' && a.target === 'bea')).toBe(true);
    act(w, ada, { kind: 'gift', target: 'bea', item: 'food', quantity: 3, reason: 'She has nothing.' });
    expect(bea.inventory.food).toBe(3); expect(bea.relationships.ada.warmth).toBeGreaterThan(5); expect(finch.relationships.ada?.warmth || 0).toBeGreaterThan(0);
  });
  it('resents a refusal from someone with plenty, but not from someone with nothing', () => {
    const w = createWorld(), ori = w.residents.find(r => r.id === 'ori')!, bea = w.residents.find(r => r.id === 'bea')!, kit = w.residents.find(r => r.id === 'kit')!;
    ori.position = bea.position = kit.position = { ...street }; bea.inventory.food = 0; kit.inventory.food = 0; kit.inventory.preserves = 0;
    act(w, bea, { kind: 'ask', target: 'kit', item: 'food', reason: 'Hungry.' }); expect(bea.relationships.kit.warmth).toBe(0);
    ori.inventory.food = 30; ori.values.sharing = -1; w.minute += 400; w.rng = 7;
    let refused = false; for (let i = 0; i < 20 && !refused; i++) { bea.lastAsked = {}; const before = bea.inventory.food; act(w, bea, { kind: 'ask', target: 'ori', item: 'food', reason: 'Hungry.' }); refused = bea.inventory.food === before; bea.inventory.food = 0; }
    expect(refused).toBe(true); expect(bea.relationships.ori.warmth).toBeLessThan(0);
  });
  it('judges taking from the pantry while well supplied', () => {
    const w = createWorld(), ori = w.residents.find(r => r.id === 'ori')!, ada = w.residents.find(r => r.id === 'ada')!;
    const door = w.buildings.find(b => b.id === 'store')!.door; ada.position = { ...door }; ori.inventory.food = 20;
    act(w, ori, { kind: 'withdraw', item: 'food', quantity: 5, reason: 'Stock up.' });
    expect(ada.relationships.ori.warmth).toBeLessThan(0);
  });
  it('carries a reputation by word of mouth at reduced strength', () => {
    const w = createWorld(), moss = w.residents[0], nell = w.residents.find(r => r.id === 'nell')!, pippa = w.residents.find(r => r.id === 'pippa')!, elder = w.nodes.find(n => n.kind === 'elder')!;
    elder.amount = 2; moss.position = { x: elder.x + 1, y: elder.y }; nell.position = { x: elder.x, y: elder.y + 1 }; pippa.position = { x: 45, y: 45 };
    act(w, moss, { kind: 'gather', target: elder.id, reason: 'Timber.' });
    const memory = nell.memories.find(m => m.deed?.actor === 'moss')!; nell.position = { ...pippa.position };
    act(w, nell, { kind: 'share', target: 'pippa', sharedMemoryId: memory.id, reason: 'Tell her.' });
    expect(pippa.relationships.moss.warmth).toBeLessThan(0); expect(Math.abs(pippa.relationships.moss.warmth)).toBeLessThanOrEqual(Math.abs(nell.relationships.moss.warmth));
  });
  it('lets chatting alone warm a relationship only so far', () => {
    const w = createWorld(), a = w.residents[0], b = w.residents[4]; a.position = b.position = { ...street };
    for (let i = 0; i < 60; i++) { a.lastSocial = {}; b.lastSocial = {}; delete a.reply; delete b.reply; act(w, a, { kind: 'socialize', target: b.id, reason: 'Chat.' }); }
    expect(a.relationships[b.id].warmth).toBeLessThanOrEqual(70);
  });
});
