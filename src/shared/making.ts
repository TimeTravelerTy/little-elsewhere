import type { Goods } from './types';
// Know-how is not given to anyone. Someone has to work it out by trying, and then it travels by
// being watched or shown, or not at all if the people who know keep it to themselves.
export type Technique = 'firing' | 'weaving' | 'daubing';
export const techniques: Record<Technique, { label: string; how: string; inputs: Goods[]; fail: string; success: string }> = {
  firing: { label: 'firing clay', how: 'how to fire clay', inputs: ['clay', 'wood'], fail: 'the clay cracked in the fire', success: 'pulled hard, ringing clay out of the fire' },
  weaving: { label: 'weaving reeds', how: 'how to weave reeds', inputs: ['reeds'], fail: 'the reeds sprang apart', success: 'wove reeds into something that held its shape' },
  daubing: { label: 'wattle and daub', how: 'how to build in wattle and daub', inputs: ['clay', 'reeds'], fail: 'the daub slumped off the wattle', success: 'packed clay and reed into a wall that stayed put' },
};
export const techniqueIds = Object.keys(techniques) as Technique[];
export type Craftable = 'tools' | 'brick' | 'pots' | 'baskets';
// What can be made, from what, and with which know-how. A kiln fires twice as much; a workbench saves wood on tools.
export const recipes: Record<Craftable, { inputs: Partial<Record<Goods, number>>; output: number; technique?: Technique; use: string }> = {
  tools: { inputs: { wood: 2, stone: 1 }, output: 1, use: 'gather and build faster' },
  brick: { inputs: { clay: 2, wood: 2 }, output: 2, technique: 'firing', use: 'build warm walls, roofs and hearths that barely weather' },
  pots: { inputs: { clay: 2, wood: 1 }, output: 1, technique: 'firing', use: 'each keeps five fresh food from spoiling' },
  baskets: { inputs: { reeds: 3 }, output: 1, technique: 'weaving', use: 'carry more home when picking, fishing or harvesting' },
};
export const craftables = Object.keys(recipes) as Craftable[];
export const isCraftable = (g?: string): g is Craftable => !!g && Object.hasOwn(recipes, g);
// One pot keeps this much fresh food from spoiling.
export const POT_KEEPS = 5;
export const knowsHow = (r: { knows?: Partial<Record<Technique, number>> }, t: Technique) => (r.knows?.[t] || 0) >= 1;
// What a batch actually takes. A workbench saves a wood on tools; a kiln fires twice the clay on the same wood.
export function batch(item: Craftable, workbench: boolean, kiln: boolean) {
  const inputs = { ...recipes[item].inputs };
  if (item === 'tools' && workbench) inputs.wood = 1;
  if (item !== 'tools' && kiln && inputs.clay) inputs.clay *= 2;
  return { inputs, output: recipes[item].output * (item !== 'tools' && kiln ? 2 : 1) };
}
