import type { ActionKind, Building, Position } from './types';
import type { Technique } from './making';
// Places are assembled from parts. What a place can be used for follows from which parts are
// finished, so a meeting place that later gains walls, a roof, a hearth and beds becomes a home.
export type ElementKind = 'floor' | 'wall' | 'roof' | 'seat' | 'hearth' | 'bed' | 'shelf' | 'planter' | 'smoker' | 'bench' | 'kiln';
export type BlueprintKind = 'hearth' | 'shelter' | 'commons' | 'cottage' | 'larder' | 'garden' | 'smokehouse' | 'workyard' | 'kilnyard';
export type PartKind = 'enclosure' | 'hearth' | 'seats' | 'beds' | 'shelves' | 'planters' | 'smoker' | 'bench' | 'kiln';
export type Capability = 'cook' | 'rest' | 'club' | 'home' | 'larder' | 'garden' | 'smokehouse' | 'workbench' | 'kiln';
export type BuildGood = 'wood' | 'stone' | 'clay' | 'reeds' | 'brick';
export const buildGoods: BuildGood[] = ['wood', 'stone', 'clay', 'reeds', 'brick'];
export type Cost = { wood: number; stone: number } & Partial<Record<Exclude<BuildGood, 'wood' | 'stone'>, number>>;
// What a block is made of decides how warm it keeps a place and how fast it weathers.
export type Material = 'timber' | 'stone' | 'daub' | 'thatch' | 'brick';
export type Method = 'timber' | 'wattle' | 'brick';
export type ConstructionBlock = Position & { kind: ElementKind; placedBy?: string; placedAt?: number; material?: Material; wear?: number };
export const elementCosts: Record<ElementKind, Cost> = {
  floor: { wood: 1, stone: 0 }, wall: { wood: 1, stone: 1 }, roof: { wood: 1, stone: 0 }, seat: { wood: 2, stone: 0 }, hearth: { wood: 0, stone: 4 },
  bed: { wood: 3, stone: 0 }, shelf: { wood: 2, stone: 1 }, planter: { wood: 1, stone: 0 }, smoker: { wood: 1, stone: 3 }, bench: { wood: 3, stone: 1 }, kiln: { wood: 0, stone: 3, clay: 2 },
};
// Walls, roofs and hearths can be built in other materials; everything else is timber.
const variantCosts: Partial<Record<string, Cost>> = {
  'wall:daub': { wood: 1, stone: 0, clay: 2 }, 'roof:thatch': { wood: 0, stone: 0, reeds: 2 },
  'wall:brick': { wood: 0, stone: 0, brick: 2 }, 'roof:brick': { wood: 0, stone: 0, brick: 2 }, 'hearth:brick': { wood: 0, stone: 0, brick: 3 },
};
export const materialOf = (b: ConstructionBlock): Material => b.material || (['wall', 'hearth', 'smoker', 'kiln'].includes(b.kind) ? 'stone' : 'timber');
export const blockCost = (b: ConstructionBlock): Cost => (b.material && variantCosts[`${b.kind}:${b.material}`]) || elementCosts[b.kind];
export const methods: Record<Method, { label: string; description: string; technique?: Technique; materials: Partial<Record<ElementKind, Material>> }> = {
  timber: { label: 'timber and stone', description: 'Plank roofs and stone-and-timber walls: familiar, and slow to weather.', materials: {} },
  wattle: { label: 'wattle, daub and thatch', description: 'Clay daub over wattle under a thatched roof: little timber and warm, but it weathers fast and needs patching.', technique: 'daubing', materials: { wall: 'daub', roof: 'thatch' } },
  brick: { label: 'fired brick', description: 'Brick walls, a tiled roof and a brick hearth: the warmest and longest-lasting, but every brick costs clay and firewood.', technique: 'firing', materials: { wall: 'brick', roof: 'brick', hearth: 'brick' } },
};
export const methodIds = Object.keys(methods) as Method[];
// Warmth is the share of a night's firewood a material saves. Wear is per day, plus more on wet days.
export const materialTraits: Record<Material, { warmth: number; wear: number; wet: number; repair: BuildGood }> = {
  timber: { warmth: .1, wear: .01, wet: .006, repair: 'wood' },
  stone: { warmth: .15, wear: .002, wet: 0, repair: 'stone' },
  daub: { warmth: .3, wear: .012, wet: .02, repair: 'clay' },
  thatch: { warmth: .35, wear: .02, wet: .015, repair: 'reeds' },
  brick: { warmth: .4, wear: .0015, wet: 0, repair: 'brick' },
};
// Only the walls and roof stand in the weather.
export const weathers = (b: ConstructionBlock) => b.kind === 'wall' || b.kind === 'roof';
export const intact = (b: ConstructionBlock) => !!b.placedBy && (b.wear || 0) < 1;
// How well a place holds its warmth: the average of its walls and roof, and a failed one lets the cold in.
export function warmth(b: Building) {
  const envelope = (b.blocks || []).filter(x => weathers(x) && x.placedBy);
  return envelope.length ? envelope.reduce((sum, x) => sum + (intact(x) ? materialTraits[materialOf(x)].warmth : -.3), 0) / envelope.length : 0;
}
export const applyMethod = (blocks: ConstructionBlock[], method: Method) => blocks.map(b => methods[method].materials[b.kind] ? { ...b, material: methods[method].materials[b.kind] } : b);
// A method only matters for plans that have something it changes.
export const methodMatters = (blocks: ConstructionBlock[], method: Method) => method === 'timber' || blocks.some(b => methods[method].materials[b.kind]);
export const methodOf = (blocks: ConstructionBlock[]): Method => blocks.some(b => b.material === 'brick') ? 'brick' : blocks.some(b => b.material === 'daub' || b.material === 'thatch') ? 'wattle' : 'timber';
// Every part has its own cells in the 4x4 footprint, so any combination fits together.
//   row 0: wall  wall  wall   wall
//   row 1: shelf .     hearth shelf   (shelves hang on the side walls)
//   row 2: wall  bed   bed    wall
//   row 3: seat  bench smoker seat
const cells = (kind: ElementKind, list: [number, number][]): ConstructionBlock[] => list.map(([x, y]) => ({ kind, x, y }));
const floorBlocks = () => cells('floor', Array.from({ length: 16 }, (_, i) => [i % 4, Math.floor(i / 4)] as [number, number]));
const planterCells: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 2], [1, 2], [2, 2], [3, 2], [0, 1], [1, 1], [2, 1], [3, 1], [0, 3], [1, 3], [2, 3], [3, 3]];
export const partBlocks: Record<PartKind, () => ConstructionBlock[]> = {
  enclosure: () => [...cells('wall', [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [3, 1], [0, 2], [3, 2]]), ...cells('roof', [[0, 1], [1, 1], [2, 1], [3, 1]])],
  hearth: () => cells('hearth', [[2, 1]]),
  seats: () => cells('seat', [[0, 3], [3, 3]]),
  beds: () => cells('bed', [[1, 2], [2, 2]]),
  shelves: () => cells('shelf', [[0, 1], [3, 1]]),
  planters: () => cells('planter', planterCells.slice(0, 8)),
  smoker: () => cells('smoker', [[2, 3]]),
  bench: () => cells('bench', [[1, 3]]),
  kiln: () => cells('kiln', [[1, 1]]),
};
export const partLabels: Record<PartKind, { label: string; description: string }> = {
  enclosure: { label: 'walls and a roof', description: 'Enclose it: shelter to rest in, and a roof for storage.' },
  hearth: { label: 'a stone hearth', description: 'A fire to cook at.' },
  seats: { label: 'benches', description: 'Seating for clubs and meetings.' },
  beds: { label: 'two beds', description: 'With walls, a roof and a hearth, beds make it a home for two.' },
  shelves: { label: 'larder shelves', description: 'Under a roof, shelves slow spoilage of the pantry\'s fresh food.' },
  planters: { label: 'four more garden beds', description: 'More beds mean more food from the garden each day.' },
  smoker: { label: 'a smoking rack', description: 'Preserve twice as much food per batch.' },
  bench: { label: 'a workbench', description: 'Tools here cost one wood less.' },
  kiln: { label: 'a kiln', description: 'Fires twice as much clay at once, for whoever knows how to fire it.' },
};
// Some parts can only be planned by someone who knows how they are used.
export const partTechnique: Partial<Record<PartKind, Technique>> = { kiln: 'firing' };
export const blueprints: Record<BlueprintKind, { label: string; description: string; parts: PartKind[]; floor: boolean; technique?: Technique }> = {
  hearth: { label: 'A cooking place', description: 'A wooden platform, stone hearth and seating for cooking and club meetings.', parts: ['seats', 'hearth'], floor: true },
  shelter: { label: 'A quiet shelter', description: 'A floor, walls and roof with seating for rest and club meetings.', parts: ['enclosure', 'seats'], floor: true },
  commons: { label: 'An open meeting place', description: 'A wooden platform with seats for club meetings.', parts: ['seats'], floor: true },
  cottage: { label: 'A small cottage', description: 'Walls, roof, hearth and two beds: a home for two more neighbors.', parts: ['enclosure', 'hearth', 'beds'], floor: true },
  larder: { label: 'A roofed larder', description: 'Walls, roof and shelves that slow spoilage in the village pantry.', parts: ['enclosure', 'shelves'], floor: true },
  garden: { label: 'A kitchen garden', description: 'Eight raised beds that add to what the village can harvest each day outside winter.', parts: ['planters'], floor: false },
  smokehouse: { label: 'A smokehouse', description: 'A platform and smoking rack that preserves twice as much food per batch.', parts: ['smoker'], floor: true },
  workyard: { label: 'A work yard', description: 'A platform with a workbench and seats, where tools cost less wood.', parts: ['bench', 'seats'], floor: true },
  kilnyard: { label: 'A kiln yard', description: 'A platform with a kiln that fires twice as much clay at once, and a workbench.', parts: ['kiln', 'bench'], floor: true, technique: 'firing' },
};
export function blueprintBlocks(kind: BlueprintKind): ConstructionBlock[] {
  const plan = blueprints[kind];
  // The original three keep their historic block order so saved sites stay valid.
  const order: PartKind[] = kind === 'shelter' ? ['enclosure', 'seats'] : plan.parts;
  const blocks = [...(plan.floor ? floorBlocks() : []), ...order.flatMap(p => partBlocks[p]())];
  if (kind === 'shelter') return [...blocks.filter(b => b.kind === 'floor'), ...blocks.filter(b => b.kind === 'wall'), ...blocks.filter(b => b.kind === 'roof'), ...blocks.filter(b => b.kind === 'seat')];
  return blocks;
}
export function blocksCost(blocks: ConstructionBlock[]): Cost {
  const sum: Cost = { wood: 0, stone: 0 };
  for (const b of blocks) for (const [g, n] of Object.entries(blockCost(b)) as [BuildGood, number][]) if (n) sum[g] = (sum[g] || 0) + n;
  return sum;
}
export const costText = (cost: Partial<Record<BuildGood, number>>) => buildGoods.filter(g => cost[g]).map(g => `${cost[g]} ${g}`).join(', ') || 'nothing';
// A kind counts only once every block of that kind is in place and none has worn through.
const complete = (blocks: ConstructionBlock[], kind: ElementKind) => blocks.some(b => b.kind === kind) && blocks.filter(b => b.kind === kind).every(intact);
export function placeCapabilities(building: Building): Capability[] {
  const blocks = building.blocks || [];
  if (building.kind !== 'place' || !blocks.length) return [];
  const has = (kind: ElementKind) => complete(blocks, kind), floor = has('floor'), out: Capability[] = [];
  if (floor && has('hearth')) out.push('cook');
  if (has('wall') && has('roof')) out.push('rest');
  if (floor && has('seat')) out.push('club');
  if (has('wall') && has('roof') && has('hearth') && has('bed')) out.push('home');
  if (has('shelf') && has('roof')) out.push('larder');
  if (has('planter')) out.push('garden');
  if (floor && has('smoker')) out.push('smokehouse');
  if (floor && has('bench')) out.push('workbench');
  if (floor && has('kiln')) out.push('kiln');
  return out;
}
// Which resident actions a place supports. Preserving works at any hearth, and better at a smokehouse.
const capabilityActions: Record<Capability, ActionKind[]> = { cook: ['cook', 'preserve'], rest: ['rest'], club: ['club'], home: [], larder: [], garden: ['farm'], smokehouse: ['preserve'], workbench: ['craft'], kiln: ['craft'] };
export const placeActions = (b: Building): ActionKind[] => [...new Set(placeCapabilities(b).flatMap(c => capabilityActions[c]))];
export const homeCapacity = (b: Building) => placeCapabilities(b).includes('home') ? (b.blocks || []).filter(x => x.kind === 'bed').length : 0;
// A 4x4 place has room for three furnishings, so each place has to settle on what it is for.
export const FURNISHING_ROOM = 3;
const furnishings: ElementKind[] = ['hearth', 'seat', 'bed', 'shelf', 'smoker', 'bench', 'kiln'];
// Parts that can be added to a finished place, given what it already has.
export function extensionParts(b: Building): PartKind[] {
  const blocks = b.blocks || [], present = (kind: ElementKind) => blocks.some(x => x.kind === kind), floor = present('floor');
  if (!floor) return present('planter') && blocks.filter(x => x.kind === 'planter').length < 12 ? ['planters'] : [];
  const full = furnishings.filter(present).length >= FURNISHING_ROOM;
  return (['enclosure', 'hearth', 'seats', 'beds', 'shelves', 'smoker', 'bench', 'kiln'] as const).filter(p => !present(partBlocks[p]()[0].kind) && (p === 'enclosure' || !full));
}
// Garden beds may already cover some cells; new ones go where there is room.
export function extensionBlocks(b: Building, part: PartKind): ConstructionBlock[] {
  if (part !== 'planters') return partBlocks[part]();
  const used = new Set((b.blocks || []).filter(x => x.kind === 'planter').map(x => `${x.x},${x.y}`));
  return cells('planter', planterCells.filter(([x, y]) => !used.has(`${x},${y}`)).slice(0, 4));
}
export const capabilityLabels: Record<Capability, string> = { cook: 'Cook meals', rest: 'Rest', club: 'Meet with a club', home: 'Home', larder: 'Larder', garden: 'Garden', smokehouse: 'Smokehouse', workbench: 'Workbench', kiln: 'Kiln' };
