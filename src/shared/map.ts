import type { Building, Position } from './types';

// Little Elsewhere II. The layout is hand-placed and validated by tests: every door opens onto a
// walkable tile connected to the village, and plots, homes and scenery never overlap.
export const MAP_W = 96, MAP_H = 64, TILE = 16;
export const Ground = { Grass: 0, Road: 1, Water: 2, Bank: 3, Plaza: 4, Field: 5, Quarry: 6, Meadow: 7, Bridge: 8 } as const;
export type Ground = typeof Ground[keyof typeof Ground];
export const tileIndex = (x: number, y: number) => y * MAP_W + x;
export const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

export const riverX = (y: number) => 70 + Math.round(Math.sin(y / 10 + .6) * 2.2);
export const bridgeRows = [31, 32];
export const bridgeSpan = { x0: 67, x1: 74 };

export type Rect = [x: number, y: number, w: number, h: number];
// Roads are rasterized rectangles; the worn paths residents create are tracked separately.
export const roads: Rect[] = [
  [3, 31, 64, 2],   // Main street, west woods to the bridge
  [10, 20, 57, 2],  // North lane (homes)
  [38, 22, 2, 9],   // Lane to main street
  [10, 12, 2, 31],  // West lane to the farm
  [29, 33, 2, 16],  // Farm lane
  [8, 47, 55, 2],   // South lane
  [62, 8, 2, 12],   // Quarry track
  [75, 31, 7, 2],   // Frontier road
  [80, 14, 2, 17],  // North frontier branch
  [80, 33, 2, 14],  // South frontier branch
];
export const plaza: Rect = [33, 33, 14, 10];
export const fields: Rect = [13, 35, 14, 10];
export const quarry: Rect = [54, 1, 13, 7];
export const meadow: Rect = [76, 4, 17, 13];
export const pond: Rect = [51, 36, 6, 5];
export const elderGrove: Rect = [2, 1, 22, 9];

export const initialBuildings: Building[] = [
  { id: 'home-1', name: 'Clover cottages', kind: 'home', x: 13, y: 13, w: 8, h: 6, roof: '#b76852', door: { x: 17, y: 19 }, capacity: 3 },
  { id: 'home-2', name: 'Willow house', kind: 'home', x: 24, y: 13, w: 8, h: 6, roof: '#c28a48', door: { x: 28, y: 19 }, capacity: 3 },
  { id: 'home-3', name: 'Orchard lodge', kind: 'home', x: 43, y: 13, w: 8, h: 6, roof: '#5f7f8c', door: { x: 47, y: 19 }, capacity: 3 },
  { id: 'home-4', name: 'Fern cottage', kind: 'home', x: 53, y: 13, w: 7, h: 6, roof: '#8d6d96', door: { x: 56, y: 19 }, capacity: 3 },
  { id: 'store', name: 'The long pantry', kind: 'store', x: 13, y: 24, w: 8, h: 6, roof: '#8a6a4a', door: { x: 17, y: 30 } },
  { id: 'market', name: 'Market square', kind: 'market', x: 24, y: 25, w: 8, h: 5, roof: '#d59a60', door: { x: 28, y: 30 } },
  { id: 'workshop', name: 'The woodshop', kind: 'workshop', x: 46, y: 24, w: 8, h: 6, roof: '#6f8094', door: { x: 50, y: 30 } },
  { id: 'farm', name: 'Sunpatch fields', kind: 'farm', x: 13, y: 35, w: 14, h: 10, roof: '#b88a50', door: { x: 20, y: 40 } },
  { id: 'hall', name: 'The gathering oak', kind: 'hall', x: 37, y: 35, w: 6, h: 5, roof: '#7d935b', door: { x: 40, y: 41 } },
];
// Reserved 4x4 clearings for resident-designed places. Their doors face a road.
export const constructionPlots: Position[] = [
  { x: 33, y: 25 }, { x: 57, y: 25 }, { x: 62, y: 25 }, { x: 33, y: 43 }, { x: 41, y: 43 }, { x: 49, y: 43 }, { x: 56, y: 43 }, { x: 5, y: 42 },
];
export const plotDoor = (plot: Position): Position => ({ x: plot.x + 2, y: plot.y + 4 });
// Frontier homes unlocked by discoveries and later growth, in build order.
export const frontierHomes: Rect[] = [[82, 9, 7, 5], [83, 41, 7, 5], [84, 20, 7, 5], [84, 34, 7, 5], [88, 26, 6, 4], [74, 36, 6, 5], [86, 50, 6, 4]];
export const frontierDoor = ([x, y, w, h]: Rect): Position => ({ x: x + Math.floor(w / 2), y: y + h });
export const regionSites = { meadow: { x: 86, y: 17, name: 'Bluebell meadow' }, outpost: { x: 91, y: 47, name: 'The old outpost' } } as const;
export const regionArea = (id: string, x: number, y: number) => id === 'meadow' ? x >= 74 && y < 27 : id === 'outpost' ? x >= 74 && y >= 36 : false;
export const frontierRegion = (x: number, y: number) => x < 74 ? undefined : y < 27 ? 'meadow' : y >= 36 ? 'outpost' : undefined;
export const gatherSpots = { wood: { x: 6, y: 24 }, stone: { x: 60, y: 9 } };

const inside = ([x, y, w, h]: Rect, px: number, py: number) => px >= x && px < x + w && py >= y && py < y + h;
export const inRect = inside;

function buildGround(): Uint8Array {
  const g = new Uint8Array(MAP_W * MAP_H);
  const fill = ([x, y, w, h]: Rect, kind: Ground) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (inBounds(i, j)) g[tileIndex(i, j)] = kind; };
  fill(meadow, Ground.Meadow); fill(quarry, Ground.Quarry); fill(fields, Ground.Field); fill(plaza, Ground.Plaza);
  for (const road of roads) fill(road, Ground.Road);
  fill(pond, Ground.Water);
  for (let y = 0; y < MAP_H; y++) {
    const rx = riverX(y);
    for (let x = rx - 1; x <= rx + 4; x++) if (inBounds(x, y)) g[tileIndex(x, y)] = x === rx - 1 || x === rx + 4 ? Ground.Bank : Ground.Water;
  }
  for (const y of bridgeRows) for (let x = bridgeSpan.x0; x <= bridgeSpan.x1; x++) g[tileIndex(x, y)] = Ground.Bridge;
  return g;
}
export const ground = buildGround();
export const groundAt = (x: number, y: number) => inBounds(x, y) ? ground[tileIndex(x, y)] as Ground : Ground.Water;

// Space that trees, rocks and bushes must leave clear: roads, buildings, plots, fields and water.
export function reserved(x: number, y: number, margin = 1): boolean {
  if (!inBounds(x, y)) return true;
  for (let j = -margin; j <= margin; j++) for (let i = -margin; i <= margin; i++) {
    const k: number = groundAt(x + i, y + j); if (k !== Ground.Grass && k !== Ground.Meadow && k !== Ground.Quarry) return true;
  }
  const near = (r: Rect, m: number) => x >= r[0] - m && x < r[0] + r[2] + m && y >= r[1] - m - 2 && y < r[1] + r[3] + m;
  return initialBuildings.some(b => near([b.x, b.y, b.w, b.h], 2)) || constructionPlots.some(p => near([p.x, p.y, 4, 4], 2)) || frontierHomes.some(h => near(h, 2))
    || (Object.values(regionSites).some(s => Math.abs(s.x - x) + Math.abs(s.y - y) < 4));
}
