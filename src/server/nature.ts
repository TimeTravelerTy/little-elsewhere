import { Ground, MAP_H, MAP_W, bridgeRows, bridgeSpan, elderGrove, frontierRegion, ground, groundAt, inBounds, inRect, meadow, reserved, riverX, tileIndex } from '../shared/map.ts';
import type { ResourceNode, Season, Weather, WorldState } from '../shared/types.ts';

// Seasonal tuning in one place. Numbers are per village day unless noted.
export const seasonal = {
  treeGrowth: { spring: 1, summer: 1, autumn: .45, winter: 0 } as Record<Season, number>,
  berryRegrowth: { spring: 1, summer: 1, autumn: 1, winter: 0 } as Record<Season, number>,
  fishRegrowth: { spring: 2, summer: 2, autumn: 2, winter: 2 } as Record<Season, number>,
  reedRegrowth: { spring: 1, summer: 1, autumn: .5, winter: 0 } as Record<Season, number>,
  farmYield: { spring: 2, summer: 3, autumn: 4, winter: 0 } as Record<Season, number>,
  farmCapacity: { spring: 12, summer: 18, autumn: 26, winter: 0 } as Record<Season, number>,
  gardenYield: { spring: 2, summer: 2, autumn: 3, winter: 0 } as Record<Season, number>, // Per four garden beds per day.
  spoilage: { spring: .08, summer: .12, autumn: .08, winter: .03 } as Record<Season, number>,
  firewood: { spring: 0, summer: 0, autumn: .5, winter: 1 } as Record<Season, number>,
  weather: { spring: [['sunny', .35], ['cloudy', .3], ['rain', .35]], summer: [['sunny', .6], ['cloudy', .25], ['rain', .15]], autumn: [['sunny', .25], ['cloudy', .4], ['rain', .35]], winter: [['sunny', .2], ['cloudy', .35], ['snow', .45]] } as Record<Season, [Weather, number][]>,
};
export const PANTRY_SPOILAGE = .5; // The long pantry keeps food better than a kitchen shelf.
export const PRESERVE_LOSS = .01; // Jars crack and mice get in, slowly.
export const nodeYield: Record<ResourceNode['kind'], number> = { oak: 12, pine: 10, elder: 20, rock: 24, bush: 4, fish: 8, clay: 18, reeds: 6 };
// Reeds grow along the pond and the village bank; clay lies in a few pits in the bank that spring floods refill.
const reedSpots = [[50, 37], [50, 39], [57, 36], [57, 39], [52, 41], [55, 41], [53, 35]].map(([x, y]) => ({ x, y }))
  .concat([12, 19, 26, 37, 45, 50, 59].map(y => ({ x: riverX(y) - 1, y })));
const clayPits = [[6], [16], [48], [57]].map(([y]) => ({ x: riverX(y) - 1, y })).concat([{ x: 58, y: 40 }]);
export function wetlandNodes(): ResourceNode[] {
  return [...reedSpots.map(p => ({ id: `reeds-${p.x}-${p.y}`, kind: 'reeds' as const, ...p, stage: 'mature' as const, amount: nodeYield.reeds, growth: 0 })),
    ...clayPits.map(p => ({ id: `clay-${p.x}-${p.y}`, kind: 'clay' as const, ...p, stage: 'mature' as const, amount: nodeYield.clay, growth: 0 }))];
}
export const isWetland = (n: ResourceNode) => n.kind === 'clay' || n.kind === 'reeds';
// Fishing spots on the pond's edge and the village bank of the river. The only food that lasts through winter.
export const fishingSpots = [{ x: 51, y: 38 }, { x: 56, y: 38 }, ...[10, 22, 42, 54].map(y => ({ x: riverX(y) + 1, y }))];
const MAX_TREES = 900;

function seeded(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const isTree = (n: ResourceNode) => n.kind === 'oak' || n.kind === 'pine' || n.kind === 'elder';
export const blocks = (n: ResourceNode) => (isTree(n) && (n.stage === 'young' || n.stage === 'mature')) || (n.kind === 'rock' && n.stage !== 'spent');
export const nodeRegion = (x: number, y: number) => frontierRegion(x, y) ?? (x >= 74 ? 'crossing' : undefined);

// Where scenery grows, and how thickly. Rocks belong to the quarry and the outpost hills.
function habitat(x: number, y: number): { kind: ResourceNode['kind']; chance: number; pine: number } | null {
  const k: number = groundAt(x, y);
  if (k === Ground.Quarry) return { kind: 'rock', chance: .36, pine: 0 };
  if (x >= 75) {
    if (inRect(meadow, x, y)) return { kind: 'oak', chance: .06, pine: 0 };
    if (x >= 86 && y >= 38 && y < 58) return { kind: 'rock', chance: .16, pine: 0 };
    return { kind: 'pine', chance: .7, pine: .8 };
  }
  if (inRect(elderGrove, x, y)) return { kind: 'elder', chance: .95, pine: 0 };
  if (x < 9 || y > 50) return { kind: 'oak', chance: .92, pine: .35 };
  if (y < 11) return { kind: 'oak', chance: .55, pine: .3 };
  if (x > 60 && x < 68) return { kind: 'oak', chance: .35, pine: .2 };
  return { kind: 'oak', chance: .05, pine: .1 };
}
export function createNodes(seed: number): ResourceNode[] {
  const rand = seeded(seed * 7919 + 13), nodes: ResourceNode[] = [], taken = new Uint8Array(MAP_W * MAP_H);
  const free = (x: number, y: number) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (inBounds(x + i, y + j) && taken[tileIndex(x + i, y + j)]) return false; return true; };
  // Visit tiles in shuffled order so spacing rules do not leave row-by-row stripes.
  const order: number[] = []; for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) order.push(tileIndex(x, y));
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const index of order) {
    const x = index % MAP_W, y = Math.floor(index / MAP_W), h = habitat(x, y); if (!h || rand() > h.chance || reserved(x, y, h.kind === 'rock' ? 0 : 1) || !free(x, y)) continue;
    let kind = h.kind;
    if (kind === 'oak' && rand() < h.pine) kind = 'pine';
    if (kind === 'pine' && h.pine < .5 && rand() < .5) kind = 'oak';
    if (kind !== 'rock' && kind !== 'elder' && rand() < (x < 75 ? .13 : .05)) kind = 'bush';
    const roll = rand(), stage: ResourceNode['stage'] = kind === 'bush' || kind === 'rock' || kind === 'elder' || roll > .2 ? 'mature' : roll > .06 ? 'young' : 'sapling';
    const amount = stage !== 'mature' ? 0 : kind === 'rock' ? 16 + Math.floor(rand() * 14) : kind === 'bush' ? 3 + Math.floor(rand() * 3) : nodeYield[kind];
    taken[tileIndex(x, y)] = 1;
    nodes.push({ id: `${kind[0]}${x}-${y}`, kind, x, y, stage, amount, growth: stage === 'mature' ? 0 : rand() * .6, ...(nodeRegion(x, y) ? { region: nodeRegion(x, y) } : {}) });
  }
  for (const spot of fishingSpots) nodes.push({ id: `f${spot.x}-${spot.y}`, kind: 'fish', ...spot, stage: 'mature', amount: 6, growth: 0 });
  return nodes;
}
export function nodeAccessible(w: WorldState, n: ResourceNode) {
  if (!n.region) return true;
  if (!w.projects.some(p => p.id === 'bridge' && p.complete)) return false;
  return n.region === 'crossing' || !!w.regions.find(r => r.id === n.region)?.discovered;
}

// Walkability is cached per world and rebuilt only when scenery or buildings change.
const grids = new WeakMap<WorldState, { key: string; blocked: Uint8Array }>();
export function blockedGrid(w: WorldState): Uint8Array {
  const bridge = w.projects.some(p => p.id === 'bridge' && p.complete), key = `${w.nodeVersion}:${w.buildings.length}:${bridge}`;
  const cached = grids.get(w); if (cached?.key === key) return cached.blocked;
  const blocked = new Uint8Array(MAP_W * MAP_H);
  for (let i = 0; i < blocked.length; i++) { const k: number = ground[i]; if (k === Ground.Water || (k === Ground.Bridge && !bridge)) blocked[i] = 1; }
  for (const b of w.buildings) if (b.kind !== 'farm' && b.kind !== 'hall') for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (inBounds(x, y)) blocked[tileIndex(x, y)] = 1;
  for (const n of w.nodes) if (blocks(n)) blocked[tileIndex(n.x, n.y)] = 1;
  grids.set(w, { key, blocked }); return blocked;
}
export const walkable = (w: WorldState, x: number, y: number) => inBounds(x, y) && x >= 1 && y >= 1 && x < MAP_W - 1 && y < MAP_H - 1 && !blockedGrid(w)[tileIndex(x, y)];
export function stepCost(w: WorldState, x: number, y: number) {
  const k: number = groundAt(x, y);
  if (k === Ground.Road || k === Ground.Plaza || k === Ground.Bridge) return 1;
  if (k === Ground.Field) return 2.4;
  if (k === Ground.Bank) return 1.8;
  return 2 - Math.min(.8, (w.wear[tileIndex(x, y)] || 0) / 110); // Worn grass becomes an easier shortcut.
}
export const wearable = (x: number, y: number) => { const k: number = groundAt(x, y); return k === Ground.Grass || k === Ground.Meadow || k === Ground.Quarry || k === Ground.Bank; };

export function growNature(w: WorldState, season: Season, rand: () => number) {
  const rate = seasonal.treeGrowth[season]; let sprouted = 0, grown = 0, trees = w.nodes.filter(isTree).length;
  const occupied = new Set(w.nodes.map(n => tileIndex(n.x, n.y))), people = new Set(w.residents.map(r => tileIndex(Math.round(r.position.x), Math.round(r.position.y))));
  const clear = (x: number, y: number) => { if (reserved(x, y, 1) || !walkable(w, x, y) || people.has(tileIndex(x, y))) return false; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (occupied.has(tileIndex(x + i, y + j))) return false; return true; };
  const born: ResourceNode[] = [];
  for (const n of w.nodes) {
    if (n.kind === 'bush') { n.amount = Math.min(nodeYield.bush, n.amount + seasonal.berryRegrowth[season]); continue; }
    if (n.kind === 'fish') { n.amount = Math.min(nodeYield.fish, n.amount + seasonal.fishRegrowth[season]); continue; }
    if (n.kind === 'reeds') { n.amount = Math.min(nodeYield.reeds, n.amount + Math.floor(seasonal.reedRegrowth[season] + rand())); n.stage = n.amount ? 'mature' : 'spent'; continue; }
    if (n.kind === 'clay') { if (season === 'spring' || w.weather === 'rain') n.amount = Math.min(nodeYield.clay, n.amount + 2); n.stage = n.amount ? 'mature' : 'spent'; continue; }
    if (!isTree(n)) continue;
    if (n.stage === 'sapling' || n.stage === 'young') {
      n.growth += rate / (n.stage === 'sapling' ? 3 : 4);
      if (n.growth >= 1 && !people.has(tileIndex(n.x, n.y))) { n.growth = 0; grown++; w.nodeVersion++; if (n.stage === 'sapling') n.stage = 'young'; else { n.stage = 'mature'; n.amount = nodeYield[n.kind]; } }
    } else if (n.stage === 'stump' && season === 'spring' && rand() < .07) { n.stage = 'sapling'; n.growth = 0; n.kind = n.kind === 'elder' ? 'oak' : n.kind; sprouted++; }
    else if (n.stage === 'mature' && (season === 'spring' || season === 'summer') && trees + born.length < MAX_TREES && rand() < (season === 'spring' ? .04 : .02)) {
      const x = n.x + Math.round((rand() - .5) * 6), y = n.y + Math.round((rand() - .5) * 6);
      if (clear(x, y)) { const kind = n.kind === 'elder' ? 'oak' : n.kind; occupied.add(tileIndex(x, y)); born.push({ id: `${kind[0]}${x}-${y}-${w.minute}`, kind, x, y, stage: 'sapling', amount: 0, growth: 0, ...(nodeRegion(x, y) ? { region: nodeRegion(x, y) } : {}) }); }
    }
  }
  w.nodes.push(...born);
  return { sprouted: sprouted + born.length, grown };
}
// Probabilistic rounding keeps small stocks decaying without making every single unit vanish.
export function spoil(amount: number, rate: number, rand: () => number) { const exact = amount * rate; let n = Math.floor(exact); if (rand() < exact - n) n++; return Math.min(amount, n); }
export function pickWeather(season: Season, rand: () => number): Weather {
  let roll = rand(); for (const [kind, p] of seasonal.weather[season]) { if (roll < p) return kind; roll -= p; } return 'cloudy';
}
export const bridgeTiles = () => bridgeRows.flatMap(y => Array.from({ length: bridgeSpan.x1 - bridgeSpan.x0 + 1 }, (_, i) => ({ x: bridgeSpan.x0 + i, y })));
