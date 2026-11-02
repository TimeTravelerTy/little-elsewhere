import { applyMethod, blockCost, blocksCost, blueprintBlocks, blueprints, buildGoods, extensionBlocks, extensionParts, materialOf, materialTraits, methodMatters, methods, partLabels, partTechnique, placeCapabilities, weathers, type BlueprintKind, type BuildGood, type ConstructionBlock, type Cost, type Method, type PartKind } from '../shared/construction.ts';
import { knowsHow } from '../shared/making.ts';
import type { Building, Project, Resident, WorldState } from '../shared/types.ts';
import { dayOf, seasonOf } from '../shared/types.ts';
import { constructionPlots, plotDoor } from '../shared/map.ts';
export { constructionPlots };

// Reserved clearings sit beside roads, clear of the river, scenery and future frontier homes.
export function availablePlot(w: WorldState) {
  const occupied = [...w.buildings, ...w.projects.filter(p => !p.complete && p.building).map(p => p.building!)];
  return constructionPlots.find(plot => !occupied.some(b => plot.x < b.x + b.w && plot.x + 4 > b.x && plot.y < b.y + b.h && plot.y + 4 > b.y));
}
// Building a new way needs someone who knows how to plan it.
export const canUseMethod = (r: Resident, method?: string): method is Method => !!method && Object.hasOwn(methods, method) && (!methods[method as Method].technique || knowsHow(r, methods[method as Method].technique!));
export function canDesign(w: WorldState, r: Resident, kind?: string, method: string = 'timber') {
  return !!kind && Object.hasOwn(blueprints, kind) && canUseMethod(r, method) && methodMatters(blueprintBlocks(kind as BlueprintKind), method as Method)
    && (!blueprints[kind as BlueprintKind].technique || knowsHow(r, blueprints[kind as BlueprintKind].technique!)) && w.projects.some(p => p.id === 'bridge' && p.complete)
    && !w.projects.some(p => p.design && (!p.complete || p.design.proposedBy === r.id || p.unlockedDay === dayOf(w.minute))) && !!availablePlot(w);
}
const placeNoun: Record<BlueprintKind, string> = { hearth: 'hearth project', shelter: 'shelter project', commons: 'meeting place', cottage: 'cottage project', larder: 'larder project', garden: 'garden plot', smokehouse: 'smokehouse project', workyard: 'work yard', kilnyard: 'kiln yard' };
const methodNote = (method: Method) => method === 'timber' ? '' : ` Built of ${methods[method].label}.`;
export function createDesignedProject(w: WorldState, r: Resident, kind: BlueprintKind, method: Method = 'timber'): Project {
  const plot = availablePlot(w)!;
  const blocks = applyMethod(blueprintBlocks(kind), method), id = `place-${r.id}-${w.sequence + 1}`;
  return { id, name: `${r.name}'s ${placeNoun[kind]}`, description: blueprints[kind].description + methodNote(method),
    location: plotDoor(plot), requires: blocksCost(blocks), supplied: { wood: 0, stone: 0 }, labor: 0, requiredLabor: blocks.length, complete: false, contributors: [], unlockedDay: dayOf(w.minute),
    design: { blueprint: kind, proposedBy: r.id, eventId: w.sequence + 1 },
    building: { id, name: `${r.name}'s new place`, kind: 'place', ...plot, w: 4, h: 4, roof: '#9d7658', blocks, door: plotDoor(plot) },
  };
}
// Additions to a finished place: one at a time per place, two open across the village.
export function canExtend(w: WorldState, r: Resident, buildingId?: string, part?: string, method: string = 'timber'): boolean {
  const b = w.buildings.find(b => b.id === buildingId && b.kind === 'place'), open = w.projects.filter(p => p.extension && !p.complete);
  return !!b && !!part && extensionParts(b).includes(part as PartKind) && w.projects.some(p => p.id === 'bridge' && p.complete)
    && canUseMethod(r, method) && methodMatters(extensionBlocks(b, part as PartKind), method as Method) && (!partTechnique[part as PartKind] || knowsHow(r, partTechnique[part as PartKind]!))
    && open.length < 2 && !open.some(p => p.extension!.building === b.id || p.extension!.proposedBy === r.id);
}
export function createExtension(w: WorldState, r: Resident, b: Building, part: PartKind, method: Method = 'timber'): Project {
  const blocks = applyMethod(extensionBlocks(b, part), method);
  return { id: `ext-${b.id}-${w.sequence + 1}`, name: `${partLabels[part].label[0].toUpperCase()}${partLabels[part].label.slice(1)} for ${b.name}`, description: partLabels[part].description + methodNote(method),
    location: { ...b.door }, requires: blocksCost(blocks), supplied: { wood: 0, stone: 0 }, labor: 0, requiredLabor: blocks.length, complete: false, contributors: [], unlockedDay: dayOf(w.minute),
    extension: { building: b.id, part, blocks, proposedBy: r.id, eventId: w.sequence + 1 } };
}
// How much the village would gain from a part right now. Only the most useful few are offered.
export function partNeed(w: WorldState, part: PartKind): number {
  const pop = w.residents.length, season = seasonOf(w.minute), spoiled = w.history.at(-1)?.spoiled || 0;
  switch (part) {
    case 'beds': return pop >= w.capacity - 1 ? 3 : .8;
    case 'enclosure': return season === 'autumn' || season === 'winter' ? 2 : 1.2;
    case 'hearth': return 1.5;
    case 'shelves': return spoiled >= 6 ? 2.5 : 1;
    case 'planters': return w.stocks.food + w.stocks.preserves < pop * 4 ? 3 : 1.5;
    case 'smoker': return season === 'summer' || season === 'autumn' ? 2 : 1;
    case 'bench': return w.residents.reduce((s, r) => s + r.inventory.tools, 0) < pop ? 2 : .8;
    case 'seats': return 1;
    case 'kiln': return w.residents.some(r => knowsHow(r, 'firing')) ? 1.8 : .3;
  }
}
export const blocksOf = (p: Project): ConstructionBlock[] => p.building?.blocks || p.extension?.blocks || [];
export const partBuilt = (p: Project) => !!(p.design || p.extension);
const usedBy = (blocks: ConstructionBlock[]) => blocksCost(blocks.filter(b => b.placedBy));
// What a project still needs of each material, and whether it has everything.
export const stillNeeds = (p: Project, g: BuildGood) => Math.max(0, (p.requires[g] || 0) - (p.supplied[g] || 0));
export const fullySupplied = (p: Project) => buildGoods.every(g => !stillNeeds(p, g));
const covers = (supplied: Cost, used: Cost, cost: Cost) => buildGoods.every(g => (supplied[g] || 0) - (used[g] || 0) >= (cost[g] || 0));
export function canWorkOn(p: Project, r: Resident) {
  if (p.complete) return false;
  const delivery = buildGoods.some(material => r.inventory[material] > 0 && stillNeeds(p, material) > 0);
  if (!partBuilt(p)) return delivery || fullySupplied(p);
  const blocks = blocksOf(p), next = blocks.find(b => !b.placedBy);
  if (!next) return false;
  return delivery || covers(p.supplied, usedBy(blocks), blockCost(next));
}
export function assembleBlocks(p: Project, r: Resident, minute: number) {
  const blocks = blocksOf(p), used = usedBy(blocks), placed: ConstructionBlock[] = [];
  for (let i = 0; i < (r.inventory.tools ? 2 : 1); i++) {
    const next = blocks.find(b => !b.placedBy); if (!next) break;
    const cost = blockCost(next);
    if (!covers(p.supplied, used, cost)) break;
    next.placedBy = r.id; next.placedAt = minute; next.wear = 0; for (const g of buildGoods) if (cost[g]) used[g] = (used[g] || 0) + cost[g]!; placed.push(next);
  }
  p.labor = blocks.filter(b => b.placedBy).length;
  return placed;
}
export const usesOf = (b: Building) => placeCapabilities(b);
// Walls and roofs weather: thatch and daub fastest, wet days worse, brick and stone hardly at all.
export function weather(w: WorldState, wet: boolean): { building: Building; blocks: ConstructionBlock[] }[] {
  const failed: { building: Building; blocks: ConstructionBlock[] }[] = [];
  for (const b of w.buildings) {
    const broke: ConstructionBlock[] = [];
    for (const x of (b.blocks || []).filter(x => x.placedBy && weathers(x))) {
      const t = materialTraits[materialOf(x)], before = x.wear || 0;
      x.wear = Math.round((before + t.wear + (wet ? t.wet : 0)) * 1000) / 1000;
      if (before < 1 && x.wear >= 1) broke.push(x);
    }
    if (broke.length) failed.push({ building: b, blocks: broke });
  }
  return failed;
}
// What a worn wall or roof would become: patched in its own material, or rebuilt another way.
export const remade = (x: ConstructionBlock, method?: Method): ConstructionBlock => method ? { ...x, material: methods[method].materials[x.kind] } : x;
// What it takes: a patch needs one unit of the material; rebuilding costs a whole new block.
export const repairCost = (x: ConstructionBlock, method?: Method): Partial<Record<BuildGood, number>> => method ? blockCost(remade(x, method)) : { [materialTraits[materialOf(x)].repair]: 1 };
// The most worn walls and roof this resident has the materials for, patched or rebuilt in another method.
export function repairable(b: Building | undefined, r: Resident, method?: Method) {
  const have: Partial<Record<BuildGood, number>> = Object.fromEntries(buildGoods.map(g => [g, r.inventory[g]]));
  return (b?.blocks || []).filter(x => x.placedBy && weathers(x) && (x.wear || 0) >= .5 && (!method || materialOf(remade(x, method)) !== materialOf(x))).sort((p, q) => (q.wear || 0) - (p.wear || 0))
    .filter(x => { const cost = repairCost(x, method); if (buildGoods.some(g => (have[g] || 0) < (cost[g] || 0))) return false; for (const g of buildGoods) have[g] = (have[g] || 0) - (cost[g] || 0); return true; }).slice(0, 4);
}
export function validPlaceName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length >= 2 && name === name.trim() && name.length <= 48 && !/[\x00-\x1f\x7f<>]/.test(name);
}
