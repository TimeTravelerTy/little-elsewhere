import { assembleBlocks, availablePlot, blocksOf, canDesign, canExtend, canUseMethod, canWorkOn, createDesignedProject, createExtension, fullySupplied, partBuilt, partNeed, remade, repairCost, repairable, stillNeeds, validPlaceName, weather } from './construction.ts';
import { weathers, blueprints, buildGoods, capabilityLabels, costText, extensionParts, homeCapacity, materialOf, materialTraits, methodIds, methods, partLabels, placeActions, placeCapabilities, warmth, type BlueprintKind, type Method, type PartKind } from '../shared/construction.ts';
import { POT_KEEPS, batch, craftables, isCraftable, knowsHow, recipes, techniqueIds, techniques, type Craftable, type Technique } from '../shared/making.ts';
import { breach, civicOptions, canPropose, hallDoor, leaning, propose, resolveProposals, signal, validVote, vote } from './civics.ts';
import { normBook, type NormId } from '../shared/norms.ts';
import { ADULT_AGE, SEASON_MINUTES, ageOf, arrivalAge, birth, canCourt, childMay, comingOfAge, court, deathChance, feeder, household, influence, isChild, moveIn, sharpestDifference, stageOf, valueGap } from './life.ts';
import { anniversary, forgetTales, gathered, retell, storyText, tendTraditions, traditionToday } from './culture.ts';
import { isShareable, routineSpeech, shareableMemories } from './dialogue.ts';
import { MAP_H, MAP_W, fields, frontierDoor, frontierHomes, initialBuildings, plotDoor, regionSites, tileIndex } from '../shared/map.ts';
import { PANTRY_SPOILAGE, PRESERVE_LOSS, blockedGrid, createNodes, growNature, isTree, isWetland, nodeAccessible, nodeYield, pickWeather, seasonal, spoil, stepCost, walkable, wearable, wetlandNodes } from './nature.ts';
import { CARRY, basePrice, bestDeal, builds, bulk, comfort, edibles, giftable, goods, initialMarket, projectDemand, quote, recordPrice, wants, willingness } from './economy.ts';
import { clamp, conversationWarmth, fadeRelationships, judge, relation, valuesFor } from './society.ts';
import { dayStats } from './metrics.ts';
import type { AgentAction, Building, Deed, Goods, Project, Resident, ResourceNode, Season, WorldEvent, WorldState, Position } from '../shared/types.ts';
import { DAYS_PER_SEASON, actionLabels, dayOf, hourOf, seasonDay, seasonOf } from '../shared/types.ts';
export { walkable };

export const buildings = initialBuildings;
const cast = [
  ['moss', 'Moss', 'Carpenter', 'Patient hands, ambitious blueprints. Knows Ada from before the crossing.', ['patient', 'practical', 'stubborn'], 'Build a bridge that makes the village less isolated.', '#d28d53'],
  ['ada', 'Ada', 'Grower', 'The first to plant here. Thinks a good meal belongs to everyone.', ['generous', 'determined', 'grounded'], 'Create a community orchard and protect the forest.', '#dfba57'],
  ['jun', 'Jun', 'Wanderer', 'Keeps a notebook of paths that do not yet exist on any map.', ['curious', 'restless', 'optimistic'], 'Discover what lies beyond the old outpost.', '#779fbd'],
  ['bea', 'Bea', 'Baker', 'Saves the best loaf for whoever looks loneliest.', ['warm', 'inventive', 'sensitive'], 'Open a little bakery where strangers become friends.', '#d98895'],
  ['ori', 'Ori', 'Trader', 'Arrived with two boxes and a very precise idea of fair exchange.', ['shrewd', 'sociable', 'competitive'], 'Make the market a place worth traveling to.', '#bfa774'],
  ['nell', 'Nell', 'Naturalist', 'Names every tree and remembers which ones sheltered the first settlers.', ['observant', 'protective', 'quiet'], 'Keep the forest healthy as the town grows.', '#91af78'],
  ['kit', 'Kit', 'Tinkerer', 'Almost everything can be improved. Not everyone wants it improved.', ['inventive', 'impatient', 'playful'], 'Build better tools for everyone.', '#b89cc7'],
  ['sol', 'Sol', 'Storykeeper', 'Collects other people’s stories but occasionally mixes up the details.', ['chatty', 'sentimental', 'curious'], 'Start a storytelling circle beneath the oak.', '#dca46c'],
  ['wren', 'Wren', 'Forager', 'Finds dinner where most people only see weeds.', ['independent', 'resourceful', 'careful'], 'Teach the village to live with the seasons.', '#8eaa95'],
  ['elio', 'Elio', 'Stonemason', 'Has strong opinions about foundations and a soft spot for music.', ['steady', 'reserved', 'loyal'], 'Restore the outpost into a home for travelers.', '#a3abc5'],
  ['pippa', 'Pippa', 'Gardener', 'Plants flowers in places where there are supposed to be paths.', ['cheerful', 'idealistic', 'bold'], 'Turn the village into a garden worth celebrating.', '#d9a0b4'],
  ['finch', 'Finch', 'Cook', 'Believes a shared table can settle most arguments.', ['diplomatic', 'creative', 'easygoing'], 'Hold a harvest gathering for the whole village.', '#75afa8'],
] as const;
const newcomerAims = [
  'Help build welcoming homes for future arrivals.', 'Keep the pantry stocked while getting to know my neighbors.',
  'Get to know the frontier and share useful discoveries.', 'Make friends through meals and small acts of generosity.',
  'Become a dependable trading partner for the village.', 'Learn the woodland paths and help neighbors use resources carefully.',
  'Craft reliable tools and trade for the supplies to make more.', 'Collect my new neighbors’ stories and join their storytelling circle.',
  'Gather useful supplies for projects that need an extra pair of hands.', 'Put my stoneworking skills to work on the village’s unfinished homes.',
  'Tend the fields and help organize a village gathering.', 'Keep myself and the shared pantry ready for the next gathering.',
];
const extraNames = ['Briar', 'Coral', 'Dune', 'Faye', 'Gale', 'Idris', 'Jory', 'Kai', 'Lior', 'Marlo', 'Noor', 'Orla', 'Perrin', 'Quinn', 'Reed', 'Sable', 'Tove', 'Umber', 'Vale', 'Wilder', 'Yara', 'Zeph'];
const newcomerTraits = ['sociable', 'careful', 'observant', 'playful', 'patient', 'curious', 'generous', 'quiet', 'steady', 'inventive', 'resourceful', 'warm'];
const newcomerNames = ['Rue', 'Ash', 'Cleo', 'Sage', 'Ivy', 'Robin', 'Luca', 'Hazel', 'Alba', 'Theo', 'Fern', 'Rowan'];
const center = { x: 40, y: 32 };
export function random(w: WorldState) { let x = w.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; w.rng = x >>> 0; return w.rng / 4294967296; }
export const distance = (a: Position, b: Position) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function createResident(index: number, minute = 480): Resident {
  const c = cast[index % cast.length], newcomer = index >= 12, id = newcomer ? `settler-${index}` : c[0];
  const aim = newcomer ? newcomerAims[(index - 12) % newcomerAims.length] : c[5];
  const traits = newcomer ? [...new Set([newcomerTraits[(index - 12) % 12], ...c[4].slice(0, 2)])] : [...c[4]];
  const home = initialBuildings[index % 4];
  // Some newcomers bring know-how from wherever they came from.
  const brought = newcomer && index % 3 === 0 ? techniqueIds[Math.floor(index / 3) % techniqueIds.length] : undefined;
  return {
    id, name: newcomer ? newcomerNames[(index - 12) % newcomerNames.length] : c[1], role: c[2], bio: newcomer ? `A ${c[2].toLowerCase()} starting a new chapter here. ${aim}${brought ? ` Knows ${techniques[brought].how} from back home.` : ''}` : c[3], traits, ambition: aim, color: c[6],
    values: valuesFor(id, traits, c[2]), position: { x: home.door.x - 1 + index % 3, y: home.door.y + 1 }, home: home.id,
    inventory: { food: 6, preserves: 0, wood: 2, stone: 1, tools: index % 2, coins: newcomer ? 6 : 10, clay: 0, reeds: 0, brick: 0, pots: 0, baskets: 0 }, knows: brought ? { [brought]: 1 } : {}, tries: {}, needs: { hunger: 15 + index % 12 * 2, energy: 75 + index % 3 * 5, social: 70 },
    skills: { farming: c[2] === 'Grower' ? 3 : 1, crafting: ['Carpenter', 'Tinkerer'].includes(c[2]) ? 3 : 1, exploring: c[2] === 'Wanderer' ? 3 : 1 }, relationships: {}, memories: [], plan: aim, task: null,
    nextDecision: minute + index / 10, lastReason: 'Finding a place in the village.', promises: [], lastPlanDay: 0, lastReflectionDay: 0, lastSocial: {}, lastAction: null, hungryDays: 0, arrived: minute, lastAsked: {},
    pantryNet: 0, lastGave: {}, treeDebt: 0, seasonGiven: 0, lastProposed: -99999, born: minute - arrivalAge(id) * SEASON_MINUTES, practice: {},
  };
}
export function createWorld(seed = 4217): WorldState {
  const bridge: Project = { id: 'bridge', name: 'A bridge to somewhere', description: 'Span the river and open a path into the frontier.', location: { x: 66, y: 31 }, requires: { wood: 48, stone: 36 }, supplied: { wood: 0, stone: 0 }, labor: 0, requiredLabor: 26, complete: false, contributors: [], unlockedDay: 1 };
  return {
    version: 2, seed, rng: seed || 1, minute: 480, sequence: 0, weather: 'sunny', residents: Array.from({ length: 12 }, (_, i) => createResident(i)), buildings: structuredClone(initialBuildings), projects: [bridge],
    regions: [{ id: 'meadow', name: regionSites.meadow.name, description: 'A sheltered clearing with rich soil and wildflowers.', ...pos(regionSites.meadow), discovered: false, progress: 0, required: 8 }, { id: 'outpost', name: regionSites.outpost.name, description: 'Stone walls, an old well, and room for new beginnings.', ...pos(regionSites.outpost), discovered: false, progress: 0, required: 12 }],
    stocks: { food: 60, preserves: 12, wood: 30, stone: 12 }, capacity: 12, lastDay: 1, lastPaperDay: 0, lastVisitorDay: 0, clubs: [], festivals: [],
    nodes: [...createNodes(seed), ...wetlandNodes()], nodeVersion: 0, wear: new Array(MAP_W * MAP_H).fill(0), market: initialMarket(), farm: { day: 1, harvested: 0 }, dayActions: {}, history: [], departed: [], norms: [], proposals: [], signals: {}, tales: {}, legends: [], traditions: [], gatherings: [], familiar: {}, discoveries: {},
  };
}
const pos = (p: Position) => ({ x: p.x, y: p.y });
// What kind of thing happened, names and numbers aside.
export function signature(w: WorldState, kind: string, title: string) {
  const names = [...w.residents.map(r => r.name), ...w.departed.map(d => d.name)].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return `${kind}:${(names.length ? title.replace(new RegExp(`\\b(?:${names.join('|')})\\b`, 'g'), 'X') : title).replace(/\d+/g, '#')}`;
}
// The more often something like it has happened lately, the less it stays with people. The first of anything is remembered.
export const novelty = (w: WorldState, sig: string) => 1 / (1 + (w.familiar?.[sig] || 0) / 3);
export const felt = (importance: number, fresh: number, stake: number) => Math.max(1, Math.min(10, Math.round(importance * (.3 + .7 * fresh) + stake)));
// People also remember what happens to those they feel strongly about, for better or worse.
export const stakeIn = (r: Resident, actors: string[]) => actors.includes(r.id) ? 1 : Math.min(1.5, Math.max(0, ...actors.map(a => Math.abs(r.relationships[a]?.warmth || 0))) / 40);
export function emit(w: WorldState, kind: WorldEvent['kind'], title: string, detail: string, actors: string[], location: Position, causeIds: number[] = [], importance = 3, deed?: Deed): WorldEvent {
  const witnesses = w.residents.filter(r => actors.includes(r.id) || distance(r.position, location) <= 9), observers = witnesses.map(r => r.id);
  const event: WorldEvent = { id: ++w.sequence, minute: w.minute, kind, title, detail, actors, location: { ...location }, observers, causeIds };
  w.familiar ||= {}; const sig = signature(w, kind, title), fresh = novelty(w, sig); w.familiar[sig] = (w.familiar[sig] || 0) + 1;
  for (const r of witnesses) {
    r.memories.push({ id: `event-${event.id}`, minute: w.minute, text: `${title}. ${detail}`, importance: felt(importance, fresh, stakeIn(r, actors)), eventIds: [event.id], kind: 'observation', event: kind, ...(deed ? { deed } : {}) });
    if (r.memories.length > 80) { const removable = r.memories.findIndex(m => m.kind !== 'commitment' && m.importance < 8); if (removable >= 0) r.memories.splice(removable, 1); }
    if (importance >= 8 && ['project', 'discovery', 'arrival'].includes(kind) && r.task && !['rest', 'eat', 'cook'].includes(r.task.action.kind)) { r.task = null; r.nextDecision = w.minute; r.lastReason = 'Something important changed nearby. I should reconsider my next step.'; }
  }
  if (deed) judge(w, deed, witnesses);
  return event;
}
const nodeById = (w: WorldState, id?: string) => w.nodes.find(n => n.id === id);
const doorOf = (w: WorldState, id: string) => { const b = w.buildings.find(b => b.id === id); return b ? { ...b.door } : null; };
export function destination(w: WorldState, r: Resident, a: AgentAction): Position {
  const place = a.target ? w.buildings.find(b => b.id === a.target && b.kind === 'place') : undefined;
  if (place && ['cook', 'rest', 'club', 'preserve', 'farm', 'craft'].includes(a.kind)) return { ...place.door };
  switch (a.kind) {
    case 'repair': return doorOf(w, a.target!) || r.position;
    case 'teach': return w.residents.find(p => p.id === a.target)?.position || r.position;
    case 'experiment': return a.item === 'clay' ? doorOf(w, 'workshop')! : r.position;
    case 'design': { const plot = availablePlot(w); return plot ? plotDoor(plot) : r.position; }
    case 'name_place': case 'build': return w.projects.find(p => p.id === a.target)?.location || r.position;
    case 'extend': return doorOf(w, a.target!) || r.position;
    case 'propose': case 'vote': return hallDoor(w);
    case 'court': return w.residents.find(p => p.id === a.target)?.position || r.position;
    case 'play': { const friend = w.residents.find(p => p.id === a.target); return friend ? { ...friend.position } : hallDoor(w); }
    case 'rest': return doorOf(w, r.home) || r.position;
    case 'farm': { const i = Math.max(0, w.residents.indexOf(r)); return { x: fields[0] + 1 + i * 5 % (fields[2] - 2), y: fields[1] + 1 + i * 3 % (fields[3] - 2) }; }
    case 'gather': case 'plant': { const n = nodeById(w, a.target); return n ? { x: n.x, y: n.y } : r.position; }
    case 'craft': case 'cook': case 'preserve': return doorOf(w, 'workshop')!;
    case 'deposit': case 'withdraw': return doorOf(w, 'store')!;
    case 'explore': { const reg = w.regions.find(p => p.id === a.target); return reg ? { x: reg.x, y: reg.y } : r.position; }
    case 'club': case 'festival': return doorOf(w, 'hall')!;
    case 'socialize': case 'share': case 'promise': case 'trade': case 'gift': case 'ask': return w.residents.find(p => p.id === a.target)?.position || r.position;
    default: return r.position;
  }
}
const pantryGoods = ['food', 'preserves', 'wood', 'stone'] as const;
type PantryGood = typeof pantryGoods[number];
const isPantryGood = (g?: string): g is PantryGood => pantryGoods.includes(g as PantryGood);
const night = (w: WorldState) => hourOf(w.minute) < 6 || hourOf(w.minute) >= 22;
// A project is short when what it still needs exceeds what everyone is carrying plus what the pantry holds.
const projectShort = (w: WorldState, g: 'wood' | 'stone') => w.projects.filter(p => !p.complete).reduce((sum, p) => sum + p.requires[g] - p.supplied[g], 0) > w.residents.reduce((sum, r) => sum + r.inventory[g], 0) + w.stocks[g];
// Gardens built by residents add to what the village can harvest each day.
export const gardenCapacity = (w: WorldState) => w.buildings.reduce((sum, b) => sum + (placeCapabilities(b).includes('garden') ? Math.floor(b.blocks!.filter(x => x.kind === 'planter').length / 4) * seasonal.gardenYield[seasonOf(w.minute)] : 0), 0);
export const farmLeft = (w: WorldState) => seasonal.farmCapacity[seasonOf(w.minute)] + gardenCapacity(w) - (w.farm.day === dayOf(w.minute) ? w.farm.harvested : 0);
const isHome = (b: Building) => homeKinds.includes(b.kind) || homeCapacity(b) > 0;
export const larders = (w: WorldState) => w.buildings.filter(b => placeCapabilities(b).includes('larder')).length;
// Rules the resident would break by taking this action. Rules never block; they are judged.
export function wouldBreach(w: WorldState, r: Resident, a: AgentAction): NormId | null {
  const has = (id: NormId) => w.norms.some(n => n.id === id), n = a.kind === 'gather' ? nodeById(w, a.target) : undefined;
  if (has('spare-elders') && n?.kind === 'elder') return 'spare-elders';
  if (has('rest-day') && seasonDay(w.minute) === DAYS_PER_SEASON && ['gather', 'farm', 'build', 'craft'].includes(a.kind)) return 'rest-day';
  if (has('pantry-need') && a.kind === 'withdraw' && (a.item === 'food' || a.item === 'preserves') && edibles(r) >= comfort(r, 'food', seasonOf(w.minute))) return 'pantry-need';
  if (has('fair-prices') && a.kind === 'trade' && a.mode === 'sell') { const partner = w.residents.find(t => t.id === a.target), q = partner && quote(w, partner, r, a.item!, a.quantity || 3); if (q && q.price > w.market[a.item!].price * 1.3) return 'fair-prices'; }
  if (has('replant') && n && isTree(n) && n.amount <= 3 + (r.inventory.tools ? 1 : 0)) return 'replant';
  return null;
}
export function validAction(w: WorldState, r: Resident, a: AgentAction): string | null {
  if (!a.reason || a.reason.length > 240) return 'A short reason is required.';
  if ((a.speech?.length || 0) > 200) return 'Speech is too long.';
  if (['cook', 'rest', 'club', 'preserve', 'farm', 'craft'].includes(a.kind) && a.target && !w.buildings.some(b => b.id === a.target && placeActions(b).includes(a.kind))) return 'This place does not support that use.';
  if (isChild(w, r) ? !childMay(w, a) : a.kind === 'play') return isChild(w, r) ? 'That is grown-up work.' : 'Play is for children.';
  const season = seasonOf(w.minute), partner = w.residents.find(t => t.id === a.target);
  const near = partner && partner.id !== r.id && distance(partner.position, r.position) <= 12;
  switch (a.kind) {
    case 'eat': return edibles(r) < 1 && !(isChild(w, r) && feeder(w, r)) ? 'No food in inventory.' : r.needs.hunger < 20 ? 'Not hungry yet.' : null;
    case 'cook': return edibles(r) < 1 || r.inventory.wood < 1 ? 'Cooking needs food and one wood.' : r.needs.hunger < 30 ? 'Not hungry enough for a meal.' : null;
    case 'preserve': return r.inventory.food >= 3 && r.inventory.wood >= 1 ? null : 'Preserving needs three fresh food and one wood.';
    case 'craft': {
      const item = isCraftable(a.item) ? a.item : 'tools', place = w.buildings.find(b => b.id === a.target), uses = place ? placeCapabilities(place) : [];
      if (recipes[item].technique && !knowsHow(r, recipes[item].technique!)) return 'You do not know how to make that.';
      if (place && !uses.includes(item === 'tools' ? 'workbench' : 'kiln')) return 'That place is not set up for this work.';
      const { inputs } = batch(item, uses.includes('workbench'), uses.includes('kiln'));
      return Object.entries(inputs).every(([g, n]) => r.inventory[g as Goods] >= (n || 0)) ? null : `Making ${item} takes ${Object.entries(inputs).map(([g, n]) => `${n} ${g}`).join(' and ')}.`;
    }
    case 'experiment': return a.item && untried(r, a.item as Goods).length ? null : 'Nothing new to try with what you hold.';
    case 'teach': {
      if (!near || night(w)) return 'Teaching needs a neighbor nearby during the day.';
      if (!a.technique || !Object.hasOwn(techniques, a.technique) || !knowsHow(r, a.technique) || knowsHow(partner, a.technique)) return 'Nothing to teach them.';
      // A lesson is shown with real materials, used up in the showing.
      if (techniques[a.technique].inputs.some(g => r.inventory[g] < 1)) return `Showing ${techniques[a.technique].how} takes ${techniques[a.technique].inputs.join(' and ')} to work with.`;
      return w.minute - Math.max(-999, ...Object.values(r.lastSocial)) < 60 || w.minute - (r.lastSocial[partner.id] ?? -999) < 360 ? 'Give it time between lessons.' : null;
    }
    case 'repair': return a.method && !canUseMethod(r, a.method) ? 'You do not know how to build that way.' : a.target && w.buildings.some(b => b.id === a.target && b.kind === 'place') && repairable(w.buildings.find(b => b.id === a.target), r, a.method).length ? null : 'Nothing there you can patch with what you carry.';
    case 'gather': { const n = nodeById(w, a.target); if (!n || !nodeAccessible(w, n)) return 'Choose a reachable tree, rock or berry bush.'; if ((isTree(n) || n.kind === 'rock' || isWetland(n)) && bulk(r) >= CARRY) return 'Your arms are full. Put something heavy down first.'; return (isTree(n) ? n.stage === 'mature' : n.stage !== 'spent') && n.amount >= 1 ? null : 'Nothing is left to gather there.'; }
    case 'plant': { const n = nodeById(w, a.target); return n && isTree(n) && n.stage === 'stump' && nodeAccessible(w, n) && season !== 'winter' ? null : 'Saplings go where a stump remains, outside winter.'; }
    case 'farm': return farmLeft(w) > 0 ? null : season === 'winter' ? 'The fields are frozen until spring.' : 'The fields have given all they can today.';
    case 'deposit': return isPantryGood(a.item) && r.inventory[a.item] >= Math.max(1, a.quantity || 1) ? null : 'Nothing of that to put in the pantry.';
    case 'withdraw': return !isPantryGood(a.item) || w.stocks[a.item] < 1 ? 'The pantry has none of that.' : (a.item === 'wood' || a.item === 'stone') && bulk(r) >= CARRY ? 'Your arms are full.' : null;
    case 'trade': {
      if (!near || night(w)) return 'Trading needs a nearby partner during the day.';
      if (!a.item || !a.mode) return 'Name the goods and whether you are buying or selling.';
      return (a.mode === 'buy' ? quote(w, r, partner, a.item, a.quantity || 3) : quote(w, partner, r, a.item, a.quantity || 3)) ? null : 'No price suits both sides.';
    }
    case 'gift': return near && !night(w) && a.item && r.inventory[a.item] >= 1 ? w.minute - (r.lastGave[partner.id] ?? -99999) < 720 ? 'You gave them something recently.' : null : 'A gift needs something to give and a neighbor nearby.';
    case 'ask': {
      if (!near || night(w)) return 'Ask a nearby neighbor during the day.';
      if (w.minute - (r.lastAsked[partner.id] ?? -9999) < 360 || w.minute - Math.max(-9999, ...Object.values(r.lastAsked)) < 90) return 'You asked for help recently.';
      return a.item && wants(w, r) === a.item ? null : 'You are not short of that.';
    }
    case 'socialize': case 'share': case 'promise': {
      if (!near) return 'That resident is not nearby.'; if (night(w)) return 'Let them rest.';
      const replying = r.reply?.from === partner.id && r.reply.expires > w.minute, lastConversation = Math.max(-999, ...Object.values(r.lastSocial));
      if (w.minute - lastConversation < 60 && !replying) return 'Take time between conversations.';
      if (w.minute - (r.lastSocial[partner.id] ?? -999) < 90 && !replying) return 'Give this conversation time to breathe.';
      if (a.kind === 'share' && (a.sharedMemoryId ? !r.memories.some(m => m.id === a.sharedMemoryId && isShareable(m)) : !shareableMemories(r, w).length)) return 'No story is available to share.';
      if (a.kind === 'promise' && (!w.projects.some(p => !p.complete && (!a.projectId || p.id === a.projectId)) || r.promises.some(p => p.status === 'open'))) return 'No new commitment is available.';
      return null;
    }
    case 'design': return canDesign(w, r, a.target, a.method) ? null : 'Design needs an open clearing, a finished bridge, room for a new project, and know-how for the way it is built.';
    case 'name_place': { const p = w.projects.find(p => p.id === a.target); return p?.design && p.complete && !p.building?.namedBy && (p.design.proposedBy === r.id || p.contributors.includes(r.id)) && (a.placeName === undefined || validPlaceName(a.placeName)) ? null : 'Only a builder or proposer can name a finished, unnamed place.'; }
    case 'build': return w.projects.some(p => p.id === a.target && canWorkOn(p, r)) ? null : 'Project needs missing materials or funded work.';
    case 'extend': return canExtend(w, r, a.target, a.part, a.method) ? null : 'That addition is not possible here right now.';
    case 'propose': return Object.hasOwn(normBook, a.target || '') ? canPropose(w, r, a.target as NormId, !!a.repeal) : 'Unknown rule.';
    case 'vote': return validVote(w, r, a);
    case 'court': return canCourt(w, r, partner);
    case 'play': return night(w) ? 'Bedtime.' : r.needs.energy < 20 ? 'Too tired to play.' : null;
    case 'explore': return w.projects.some(p => p.id === 'bridge' && p.complete) && w.regions.some(p => p.id === a.target && !p.discovered) && r.needs.energy > 25 ? null : 'Exploration needs a bridge, an undiscovered destination, and enough energy.';
    case 'festival': return w.stocks.food + w.stocks.preserves >= 18 && hourOf(w.minute) >= 10 && hourOf(w.minute) < 20 && !w.festivals.some(f => f.day === dayOf(w.minute) || (dayOf(w.minute) - f.day < 5 && !traditionToday(w) && !anniversary(w))) ? null : 'Gatherings need eighteen pantry food and five days between them.';
    case 'club': return r.needs.social < 90 ? null : 'No need for another meeting yet.';
    case 'rest': return null;
    default: return 'Unknown action.';
  }
}
// Techniques this resident has not worked out that the material in hand might lead to.
export const untried = (r: Resident, item: Goods): Technique[] => r.inventory[item] >= 1 ? techniqueIds.filter(t => !knowsHow(r, t) && techniques[t].inputs.includes(item) && techniques[t].inputs.every(g => r.inventory[g] >= 1)) : [];
const tinkers = (r: Resident) => r.role === 'Tinkerer' || r.traits.some(t => ['curious', 'inventive', 'restless', 'playful'].includes(t));
// Watching someone at work teaches a little; children pick it up fastest.
function watch(w: WorldState, r: Resident, t: Technique, amount = .04) {
  for (const o of w.residents) if (o.id !== r.id && !knowsHow(o, t) && distance(o.position, r.position) <= 6) { o.knows ||= {}; o.knows[t] = Math.min(.95, Math.round(((o.knows[t] || 0) + amount * (isChild(w, o) ? 2 : 1)) * 100) / 100); }
}
const nodeLabel = (n: ResourceNode) => n.kind === 'clay' ? 'a clay pit in the riverbank' : n.kind === 'reeds' ? 'a reed bed' : n.kind === 'elder' ? 'an elder oak in the old grove' : n.kind === 'rock' ? 'a stone outcrop' : n.kind === 'bush' ? 'a berry bush' : n.kind === 'fish' ? 'a fishing spot' : `a ${n.kind}`;
export function legalActions(w: WorldState, r: Resident): AgentAction[] {
  const season = seasonOf(w.minute), out: AgentAction[] = ['farm', 'rest', 'eat', 'cook', 'preserve', 'club', 'festival'].map(kind => ({ kind: kind as AgentAction['kind'], reason: 'A useful next step.' }));
  const nearest = (test: (n: ResourceNode) => boolean, count: number) => w.nodes.filter(n => test(n) && nodeAccessible(w, n)).sort((a, b) => distance(a, r.position) - distance(b, r.position) || a.id.localeCompare(b.id)).slice(0, count);
  const trees = nearest(n => isTree(n) && n.stage === 'mature' && n.amount > 0, 2);
  const elder = nearest(n => n.kind === 'elder' && n.stage === 'mature', 1).find(n => !trees.includes(n) && distance(n, r.position) < 30);
  for (const n of [...trees, ...(elder ? [elder] : []), ...nearest(n => n.kind === 'rock' && n.amount > 0, 2), ...nearest(n => n.kind === 'bush' && n.amount > 0, 2), ...nearest(n => n.kind === 'fish' && n.amount > 0, 1), ...nearest(n => n.kind === 'clay' && n.amount > 0, 1), ...nearest(n => n.kind === 'reeds' && n.amount > 0, 1)]) out.push({ kind: 'gather', target: n.id, reason: `Gather from ${nodeLabel(n)}.` });
  for (const n of nearest(n => n.stage === 'stump', 1)) out.push({ kind: 'plant', target: n.id, reason: 'Plant a sapling where a tree was felled.' });
  // Food counts as spare only well above what the resident would draw back out, so nobody cycles it through the pantry.
  // A rule asking everyone to give each season makes even a small gift worth carrying over.
  if (r.seasonGiven === 0 && w.norms.some(n => n.id === 'give-each-season')) { const g = (['wood', 'food', 'stone', 'preserves'] as const).find(g => r.inventory[g] >= 3); if (g) out.push({ kind: 'deposit', item: g, quantity: 2, reason: `Give a little ${g} to the pantry this season.` }); }
  for (const g of pantryGoods) { const extra = g === 'food' || g === 'preserves' ? Math.min(r.inventory[g], edibles(r) - comfort(r, 'food', season) - 6) : r.inventory[g] - comfort(r, g, season); if (extra >= (g === 'wood' || g === 'stone' ? 6 : 3)) out.push({ kind: 'deposit', item: g, quantity: Math.min(10, extra), reason: `Put spare ${g} in the pantry.` }); }
  for (const g of ['food', 'preserves'] as const) if (w.stocks[g] > 0 && edibles(r) < comfort(r, 'food', season) + 2) out.push({ kind: 'withdraw', item: g, quantity: Math.min(5, w.stocks[g]), reason: `Take ${g} from the pantry.` });
  if (w.stocks.wood > 0 && r.inventory.wood < comfort(r, 'wood', season)) out.push({ kind: 'withdraw', item: 'wood', quantity: Math.min(5, w.stocks.wood), reason: 'Take firewood from the pantry.' });
  else if (w.stocks.wood > 0 && r.inventory.wood < 3 && projectShort(w, 'wood')) out.push({ kind: 'withdraw', item: 'wood', quantity: Math.min(5, w.stocks.wood), reason: 'Fetch pantry wood for a project.' });
  if (w.stocks.stone > 0 && r.inventory.stone < 3 && projectShort(w, 'stone')) out.push({ kind: 'withdraw', item: 'stone', quantity: Math.min(5, w.stocks.stone), reason: 'Fetch pantry stone for a project.' });
  for (const kind of Object.keys(blueprints)) for (const method of methodIds) if (canDesign(w, r, kind, method)) out.push({ kind: 'design', target: kind, method, reason: blueprints[kind as BlueprintKind].description });
  // Making things: whatever this resident knows how to make, here or at a place set up for it.
  const workshops = w.buildings.filter(b => b.kind === 'place' && placeCapabilities(b).some(c => c === 'workbench' || c === 'kiln'));
  for (const item of craftables) for (const target of [undefined, ...workshops.map(b => b.id)]) out.push({ kind: 'craft', item, ...(target ? { target } : {}), reason: `Make ${item}.` });
  for (const item of ['clay', 'reeds'] as const) if (untried(r, item).length) out.push({ kind: 'experiment', item, reason: `Try working the ${item} somehow.` });
  for (const b of w.buildings.filter(b => b.kind === 'place')) for (const method of [undefined, ...methodIds]) if ((!method || canUseMethod(r, method)) && repairable(b, r, method).length) out.push({ kind: 'repair', target: b.id, ...(method ? { method } : {}), reason: `${method ? 'Rebuild' : 'Patch'} the worn parts of ${b.name}.` });
  for (const p of w.projects.filter(p => p.design && p.complete && !p.building?.namedBy)) out.push({ kind: 'name_place', target: p.id, reason: 'Give our finished place a name.' });
  for (const b of w.buildings.filter(b => b.kind === 'place')) for (const kind of placeActions(b).filter(k => k !== 'craft')) out.push({ kind, target: b.id, reason: `Use ${b.name}.` });
  // Only the few additions the village most needs are on offer at any time.
  const additions = w.buildings.filter(b => b.kind === 'place').flatMap(b => extensionParts(b).filter(part => canExtend(w, r, b.id, part)).map(part => ({ b, part, need: partNeed(w, part) - distance(b.door, r.position) / 60 })));
  for (const { b, part } of additions.sort((x, y) => y.need - x.need).slice(0, 3)) for (const method of methodIds) if (canExtend(w, r, b.id, part, method)) out.push({ kind: 'extend', target: b.id, part, method, reason: `Add ${partLabels[part].label} to ${b.name}.` });
  out.push(...civicOptions(w, r));
  if (isChild(w, r)) { const friend = w.residents.filter(o => o.id !== r.id && isChild(w, o)).sort((a, b) => distance(a.position, r.position) - distance(b.position, r.position))[0]; out.push({ kind: 'play', ...(friend ? { target: friend.id } : {}), reason: friend ? `Play with ${friend.name}.` : 'Play by the oak.' }); }
  for (const p of w.projects.filter(p => !p.complete)) out.push({ kind: 'build', target: p.id, reason: `Help with ${p.name}.` });
  for (const p of w.regions.filter(p => !p.discovered)) out.push({ kind: 'explore', target: p.id, reason: `Investigate ${p.name}.` });
  const need = wants(w, r);
  const neighbors = w.residents.filter(o => o.id !== r.id && distance(o.position, r.position) < 12).sort((a, b) => Number(b.id === r.reply?.from) - Number(a.id === r.reply?.from) || distance(a.position, r.position) - distance(b.position, r.position) || (r.relationships[a.id]?.interactions || 0) - (r.relationships[b.id]?.interactions || 0)).slice(0, 4);
  for (const other of neighbors) {
    for (const kind of ['socialize', 'share', 'promise'] as const) out.push({ kind, target: other.id, reason: `Spend time with ${other.name}.` });
    if (!canCourt(w, r, other)) out.push({ kind: 'court', target: other.id, reason: `Ask ${other.name} to share a life together.` });
    const deal = bestDeal(w, r, other); if (deal) out.push(deal);
    const gift = giftable(w, r, other); if (gift) out.push({ kind: 'gift', target: other.id, item: gift, quantity: Math.min(3, r.inventory[gift] - comfort(r, gift, season)), reason: `Give ${other.name} some ${gift}.` });
    if (need) out.push({ kind: 'ask', target: other.id, item: need, reason: `Ask ${other.name} for ${need}.` });
    const lesson = techniqueIds.find(t => knowsHow(r, t) && !knowsHow(other, t)); if (lesson) out.push({ kind: 'teach', target: other.id, technique: lesson, reason: `Show ${other.name} ${techniques[lesson].how}.` });
  }
  return out.filter(a => !validAction(w, r, a));
}
export function routine(w: WorldState, r: Resident): AgentAction {
  const season = seasonOf(w.minute), food = edibles(r), foodComfort = comfort(r, 'food', season);
  if (r.needs.hunger > 65 && !validAction(w, r, { kind: 'eat', reason: 'Eat.' })) return { kind: 'eat', reason: 'I should eat before doing anything else.' };
  const child = isChild(w, r), parents = child ? w.residents.filter(o => r.parents?.includes(o.id)) : [];
  if (r.needs.energy < 25 || night(w)) return { kind: 'rest', reason: 'Time to recover some energy.' };
  if (r.reply && r.reply.expires > w.minute && !validAction(w, r, { kind: 'socialize', target: r.reply.from, reason: 'Reply to my neighbor.' })) return { kind: 'socialize', target: r.reply.from, reason: 'Reply to my neighbor.' };
  const builder = ['Carpenter', 'Stonemason'].includes(r.role) || r.promises.some(p => p.status === 'open') || r.values.industry > .4;
  const designs = (kind?: string) => w.projects.filter(p => p.design?.blueprint === kind).length;
  const scored = legalActions(w, r).map(a => {
    let score = random(w) * 20;
    const n = a.kind === 'gather' ? nodeById(w, a.target) : undefined;
    switch (a.kind) {
      case 'farm': score += food < 3 ? 70 : (['Grower', 'Gardener'].includes(r.role) ? 22 : 4) + (season === 'autumn' ? 22 : 0) + (food < foodComfort ? 15 : 0); break;
      case 'gather':
        if (!n) break; score -= distance(n, r.position) / 3;
        if (isWetland(n)) { const g = n.kind as 'clay' | 'reeds'; score += r.inventory[g] < comfort(r, g, season, w) ? 24 : r.inventory[g] < 3 && techniqueIds.some(t => !knowsHow(r, t) && techniques[t].inputs.includes(g)) ? (tinkers(r) ? 14 : -12) : -35; break; }
        if (n.kind === 'bush' || n.kind === 'fish') score += food < 3 ? 60 : (n.kind === 'bush' ? r.role === 'Forager' : r.traits.includes('patient') || r.traits.includes('quiet')) ? 25 : food < foodComfort ? 14 + (season === 'autumn' ? 10 : 0) : 0;
        else if (n.kind === 'rock') score += r.inventory.stone < comfort(r, 'stone', season) ? 22 : projectShort(w, 'stone') && r.inventory.stone < 12 ? (builder ? 24 : 8) : -30;
        else { score += r.inventory.wood < comfort(r, 'wood', season) ? 28 : projectShort(w, 'wood') && r.inventory.wood < 12 ? (builder ? 24 : 8) : -30; score -= n.kind === 'elder' ? 20 + r.values.nature * 40 : Math.max(0, r.values.nature) * 10; }
        break;
      case 'plant': score += r.values.nature * 40 + (['Naturalist', 'Forager', 'Gardener'].includes(r.role) ? 12 : -5) + (r.treeDebt > 0 && w.norms.some(n => n.id === 'replant') ? 45 : 0); break;
      case 'preserve': score += r.inventory.food < 6 ? -40 : (season === 'autumn' ? 30 : season === 'summer' ? 14 : -5) + (['Baker', 'Cook', 'Forager'].includes(r.role) ? 12 : 0) + (r.inventory.preserves < comfort(r, 'preserves', season) ? 10 : -15); break;
      case 'deposit': if (r.seasonGiven === 0 && w.norms.some(n => n.id === 'give-each-season') && seasonDay(w.minute) >= 3) { score += 40; break; }
        score += a.item === 'stone' || (a.item === 'wood' && season !== 'autumn' && season !== 'winter') ? (bulk(r) > CARRY ? 12 : -40) : a.item === 'wood' ? -2 + r.values.sharing * 25 : 6 + r.values.sharing * 30 + (season === 'autumn' ? 8 : 0); break;
      case 'withdraw': score += (a.item === 'stone' || (a.item === 'wood' && r.inventory.wood >= comfort(r, 'wood', season)) ? (builder ? 22 : -10) : a.item === 'wood' ? (r.inventory.wood < 2 && season === 'winter' ? 50 : -10) : food < 2 ? 55 : -30) - Math.max(0, r.values.sharing) * 8; break;
      case 'trade': score += (r.role === 'Trader' ? 30 : 6) + (a.mode === 'buy' && (a.item === 'food' || a.item === 'preserves') && food < 3 ? 40 : 0); break;
      case 'gift': score += 10 + r.values.sharing * 35 + (r.relationships[a.target!]?.warmth || 0) / 5; break;
      case 'ask': score += 22 + (food < 1 ? 25 : 0) - (r.traits.includes('independent') ? 15 : 0) + (r.relationships[a.target!]?.warmth || 0) / 6 - (w.residents.find(o => o.id === a.target) && edibles(w.residents.find(o => o.id === a.target)!) < 4 ? 30 : 0); break;
      case 'name_place': score += 50; break;
      case 'design': score += (a.method === 'wattle' ? r.values.nature * 15 : a.method === 'brick' ? r.values.industry * 10 + 4 : 0) + (a.target === 'kilnyard' ? 26 : 0) + ((a.target === 'hearth' && ['Baker', 'Cook'].includes(r.role)) || (a.target === 'shelter' && ['Carpenter', 'Stonemason'].includes(r.role)) || (a.target === 'commons' && ['Gardener', 'Storykeeper'].includes(r.role)) ? 28 : 4) - designs(a.target) * 12; break;
      case 'build': score += 18 + (['Carpenter', 'Stonemason'].includes(r.role) ? 18 : 0) + (r.promises.some(p => p.status === 'open') ? 30 : 0) + Math.max(0, r.values.industry) * 10; break;
      case 'explore': score += ['Wanderer', 'Naturalist', 'Forager'].includes(r.role) ? 40 : 10; break;
      case 'socialize': case 'club': score += (100 - r.needs.social) / 2; break;
      case 'cook': score += r.needs.hunger > 45 && r.inventory.wood > 2 ? 16 + (['Baker', 'Cook'].includes(r.role) ? 8 : 0) : -20; break;
      case 'craft': {
        const item = (a.item || 'tools') as Craftable, held = r.inventory[item];
        score += item === 'tools' ? (held === 0 ? 35 : r.role === 'Tinkerer' && held < 4 ? 10 : -15)
          : item === 'brick' ? (projectDemand(w, 'brick') > w.residents.reduce((s, o) => s + o.inventory.brick, 0) ? 30 : held < 4 && r.values.industry > .2 ? 2 : -30)
          : item === 'pots' ? (held < comfort(r, 'pots', season) ? 24 : held < 6 && w.residents.some(o => o.inventory.pots < 2) ? 6 : -30)
          : (held === 0 ? 22 : -25);
        if (a.target) score += 4; break;
      }
      case 'experiment': score += (tinkers(r) ? 22 : -6) + r.skills.crafting * 2 + ((r.tries?.[untried(r, a.item as Goods)[0]] || 0) > 0 && r.traits.some(t => ['determined', 'stubborn', 'patient'].includes(t)) ? 12 : 0) - 4; break;
      case 'teach': { const t = w.residents.find(o => o.id === a.target)!; score += -8 + r.values.sharing * 22 + (r.relationships[t.id]?.warmth || 0) / 8 + (t.parents?.includes(r.id) ? 20 : 0); break; }
      case 'repair': { const b = w.buildings.find(b => b.id === a.target)!; score += 14 + r.values.industry * 15 + (r.home === b.id ? 30 : r.values.sharing * 12) + (repairable(b, r, a.method).some(x => (x.wear || 0) >= 1) ? 15 : 0) + (a.method === 'wattle' ? r.values.nature * 12 : a.method === 'brick' ? 6 : 0); break; }
      case 'eat': score += r.needs.hunger - 70; break;
      case 'rest': score -= season === 'winter' && !w.buildings.find(b => b.id === r.home)?.cold ? 8 : 45; break;
      case 'festival': score += (['Cook', 'Gardener'].includes(r.role) ? 20 : -10) + (season === 'autumn' ? 10 : 0) + (traditionToday(w) ? 35 : anniversary(w)?.attendees.includes(r.id) ? 15 : 0); break;
      case 'share': score += r.role === 'Storykeeper' ? 18 : -5; break;
      case 'extend': score += partNeed(w, a.part!) * 8 + (builder ? 8 : -4) - 6; break;
      case 'propose': { const lean = leaning(r, a.target as NormId) * (a.repeal ? -1 : 1); score += lean * 25 - 10; break; }
      case 'play': score += 18 + (100 - r.needs.social) / 3; break;
      case 'court': { const t = w.residents.find(o => o.id === a.target)!; score += 12 + ((r.relationships[t.id]?.warmth || 0) - 60) / 2 + (1 - valueGap(r, t) / 6) * 10; break; }
      case 'vote': { const p = w.proposals.find(p => String(p.id) === a.target)!, lean = leaning(r, p.norm) * (p.repeal ? -1 : 1) + (r.relationships[p.proposedBy]?.warmth || 0) / 150, agree = (a.stance === 'for') === lean >= 0; score += agree ? 6 + Math.abs(lean) * 35 : -60; break; }
    }
    // Rules can be broken, but most people think twice, and those who value what the rule protects think hardest.
    const rule = wouldBreach(w, r, a);
    if (rule && !(food < 2 && ['withdraw', 'farm', 'gather'].includes(a.kind))) score -= 18 + Math.max(0, leaning(r, rule)) * 30 + (w.norms.find(n => n.id === rule)!.supporters.includes(r.id) ? 15 : 0);
    // Children help with whatever they see their parents do.
    if (child && ['farm', 'gather', 'plant', 'build'].includes(a.kind)) score = random(w) * 20 + 10 + (parents.some(p => parentWork[p.role] === a.kind) ? 12 : 0);
    if (a.target && ['cook', 'rest', 'club'].includes(a.kind)) score += 6;
    if (a.kind === r.lastAction) score -= 12;
    return { a, score };
  }).sort((a, b) => b.score - a.score);
  // With nothing worth doing, people take it easy instead of inventing busywork.
  if (!scored.length || scored[0].score < 0) {
    const company = scored.find(x => ['socialize', 'club', 'share'].includes(x.a.kind));
    return company && random(w) < .6 ? company.a : { kind: 'rest', reason: 'Nothing pressing. Taking it easy at home.' };
  }
  return scored[0].a;
}
const parentWork: Record<string, AgentAction['kind']> = { Grower: 'farm', Gardener: 'plant', Naturalist: 'plant', Forager: 'gather', Carpenter: 'build', Stonemason: 'build', Cook: 'farm', Baker: 'farm' };
export const durations: Record<AgentAction['kind'], number> = { experiment: 40, teach: 40, repair: 30, court: 10, play: 30, extend: 20, propose: 15, vote: 10, gather: 30, farm: 40, cook: 20, preserve: 30, craft: 35, trade: 10, gift: 8, ask: 8, deposit: 10, withdraw: 8, plant: 20, socialize: 10, rest: 90, eat: 5, explore: 60, build: 40, club: 25, festival: 30, promise: 10, share: 10, design: 25, name_place: 5 };
export function startAction(w: WorldState, r: Resident, a: AgentAction): boolean {
  if (r.task || validAction(w, r, a)) return false;
  a = { ...a };
  if (a.kind === 'promise') a.projectId ||= w.projects.find(p => !p.complete)?.id;
  if (a.kind === 'share') a.sharedMemoryId ||= shareableMemories(r, w, w.residents.find(o => o.id === a.target)).at(-1)?.id;
  const route = findRoute(w, r.position, destination(w, r, a));
  if (route === null) { r.nextDecision = w.minute + 10; return false; }
  r.task = { action: a, destination: route.at(-1) || { x: Math.round(r.position.x), y: Math.round(r.position.y) }, route, remaining: durations[a.kind], started: w.minute }; r.lastReason = a.reason;
  r.nextDecision = w.minute + 30; return true;
}
function nearestWalkable(w: WorldState, x: number, y: number, radius = 8): Position | null {
  for (let d = 0; d <= radius; d++) for (let dy = -d; dy <= d; dy++) for (const dx of [-(d - Math.abs(dy)), d - Math.abs(dy)]) if (walkable(w, x + dx, y + dy)) return { x: x + dx, y: y + dy };
  return null;
}
// A* over tile costs. Roads are cheapest and well-worn grass gets cheaper, so shortcuts become paths.
export function findRoute(w: WorldState, start: Position, end: Position): Position[] | null {
  const sx = Math.round(start.x), sy = Math.round(start.y), goal = nearestWalkable(w, Math.round(end.x), Math.round(end.y));
  if (!goal) return null;
  const from = tileIndex(sx, sy), to = tileIndex(goal.x, goal.y); if (from === to) return [];
  const blocked = blockedGrid(w), cost = new Float64Array(MAP_W * MAP_H).fill(Infinity), previous = new Int32Array(MAP_W * MAP_H).fill(-1);
  const heap: [number, number][] = []; const push = (f: number, id: number) => { heap.push([f, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  cost[from] = 0; previous[from] = from; push(0, from);
  while (heap.length) {
    const [, id] = pop(); if (id === to) break;
    const x = id % MAP_W, y = Math.floor(id / MAP_W);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 1 || ny < 1 || nx >= MAP_W - 1 || ny >= MAP_H - 1) continue;
      const next = tileIndex(nx, ny); if (blocked[next]) continue;
      const c = cost[id] + stepCost(w, nx, ny);
      if (c < cost[next]) { cost[next] = c; previous[next] = id; push(c + Math.abs(nx - goal.x) + Math.abs(ny - goal.y), next); }
    }
  }
  if (previous[to] === -1) return null;
  const path: Position[] = []; for (let at = to; at !== from; at = previous[at]) path.push({ x: at % MAP_W, y: Math.floor(at / MAP_W) });
  return path.reverse();
}
// Who has given what to whom, on balance.
function owe(giver: Resident, taker: Resident, k: number) { const g = relation(giver, taker.id), t = relation(taker, giver.id); g.balance = (g.balance || 0) + k; t.balance = (t.balance || 0) - k; }
function takeEdible(r: Resident, n: number) { for (let i = 0; i < n; i++) { if (r.inventory.food > 0) r.inventory.food--; else r.inventory.preserves--; } }
export function finishAction(w: WorldState, r: Resident): WorldEvent[] {
  const task = r.task!; const a = task.action; r.task = null; r.lastAction = a.kind; r.nextDecision = w.minute + 10;
  const plot = a.kind === 'design' ? availablePlot(w) : undefined;
  const movedPlot = a.kind === 'design' && (!plot || task.destination.x !== plotDoor(plot).x || task.destination.y !== plotDoor(plot).y);
  if (movedPlot || validAction(w, r, a)) { r.lastReason = 'Things changed while I was on my way. I will choose again.'; return []; }
  w.dayActions[a.kind] = (w.dayActions[a.kind] || 0) + 1;
  if (isChild(w, r)) { r.practice ||= {}; r.practice[a.kind] = (r.practice[a.kind] || 0) + 1; }
  const out: WorldEvent[] = [];
  const event = (kind: WorldEvent['kind'], title: string, detail: string, actors = [r.id], causes: number[] = [], importance = 3, deed?: Deed) => { const e = emit(w, kind, title, detail, actors, r.position, causes, importance, deed); out.push(e); return e; };
  const season = seasonOf(w.minute), partner = w.residents.find(t => t.id === a.target), reach = partner && distance(partner.position, r.position) <= 12;
  const building = (id?: string) => w.buildings.find(b => b.id === id);
  const broke = (id: NormId, detail: string) => { const e = breach(w, r, id, detail); if (e) out.push(e); };
  if (wouldBreach(w, r, a) === 'rest-day') broke('rest-day', `${r.name} was ${actionLabels[a.kind].toLowerCase()} on the last day of ${season}.`);
  switch (a.kind) {
    case 'eat': { const from = edibles(r) ? r : feeder(w, r)!; takeEdible(from, 1); r.needs.hunger = Math.max(0, r.needs.hunger - 50); break; }
    case 'rest': { const cold = building(r.home)?.cold && !a.target; r.needs.energy = Math.min(100, r.needs.energy + (cold ? 35 : 65)); if (a.target) event('work', `${r.name} rested at ${building(a.target)!.name}`, 'A completed shelter offered a place to recover energy.'); break; }
    case 'gather': {
      const n = nodeById(w, a.target)!, tools = r.inventory.tools > 0 ? 1 : 0;
      if (distance(n, r.position) > 2.5) { r.lastReason = 'I could not get close enough.'; break; }
      // Tools help with wood and stone; a basket brings more food home.
      const food = n.kind === 'bush' || n.kind === 'fish', basket = food && r.inventory.baskets > 0 ? 1 : 0;
      const k = Math.min(n.amount, (n.kind === 'fish' ? 2 : 3) + (food ? basket : tools) - (stageOf(r, w.minute) === 'adult' ? 0 : 1), isTree(n) || n.kind === 'rock' || isWetland(n) ? CARRY - bulk(r) : Infinity); n.amount -= k;
      if (basket && random(w) < .08) r.inventory.baskets--;
      if (n.kind === 'elder') { signal(w, 'spare-elders', `${r.name} cut into an elder oak in the old grove on Day ${dayOf(w.minute)}.`); broke('spare-elders', `${r.name} took ${k} wood from an elder oak in the old grove.`); }
      if (n.kind === 'bush') { r.inventory.food += k; event('work', `${r.name} picked berries`, `${k} food foraged from a berry bush${n.amount ? '' : ', now picked clean'}.`); }
      else if (n.kind === 'fish') { r.inventory.food += k; event('work', `${r.name} went fishing`, `${k} fish caught ${n.x < 60 ? 'at the pond' : 'from the riverbank'}${n.amount ? '' : '; the spot needs time to recover'}.`); }
      else if (n.kind === 'clay') { r.inventory.clay += k; if (!n.amount) { n.stage = 'spent'; w.nodeVersion++; } event('work', `${r.name} dug clay`, `${k} clay from the riverbank.${n.amount ? '' : ' The pit is dug out until the water rises again.'}`); }
      else if (n.kind === 'reeds') { r.inventory.reeds += k; if (!n.amount) { n.stage = 'spent'; w.nodeVersion++; } event('work', `${r.name} cut reeds`, `${k} reeds from ${n.x < 60 ? "the pond's edge" : 'the riverbank'}.`); }
      else if (n.kind === 'rock') { r.inventory.stone += k; if (!n.amount) { n.stage = 'spent'; w.nodeVersion++; } event('work', `${r.name} quarried stone`, `${k} stone from ${n.region ? 'the frontier hills' : 'the quarry'}.${n.amount ? '' : ' The outcrop is worked out.'}`); }
      else {
        r.inventory.wood += k;
        if (n.amount > 0) event('work', `${r.name} cut wood`, `${k} wood from ${nodeLabel(n)}.`);
        else {
          const elder = n.kind === 'elder'; n.stage = 'stump'; n.growth = 0; w.nodeVersion++; if (!r.treeDebt) r.treeDebtSince = dayOf(w.minute); r.treeDebt++;
          event('nature', elder ? `${r.name} felled an elder oak` : `${r.name} felled ${n.kind === 'oak' ? 'an' : 'a'} ${n.kind}`, elder ? `One of the old grove's elder oaks came down for firewood and timber. A wide stump remains.` : `The last ${k} wood came off, leaving a stump.`, [r.id], [], elder ? 6 : 3, { actor: r.id, tags: { nature: elder ? -2.5 : -.5 }, summary: elder ? `${r.name} felled an elder oak in the old grove` : `${r.name} felled ${n.kind === 'oak' ? 'an' : 'a'} ${n.kind}` });
        }
      }
      if (tools && !food && random(w) < .1) r.inventory.tools--;
      break;
    }
    case 'plant': {
      const n = nodeById(w, a.target)!; n.kind = n.kind === 'elder' ? 'oak' : n.kind; n.stage = 'sapling'; n.growth = 0; n.amount = 0; n.plantedBy = r.id; r.treeDebt = Math.max(0, r.treeDebt - 1);
      event('nature', `${r.name} planted a sapling`, `A young ${n.kind} now grows where a tree was felled.`, [r.id], [], 4, { actor: r.id, tags: { nature: 1.5 }, summary: `${r.name} replanted a felled tree` }); break;
    }
    case 'farm': {
      const basket = r.inventory.baskets > 0 ? 1 : 0, k = Math.max(1, Math.min(farmLeft(w), seasonal.farmYield[season] + Math.floor(r.skills.farming / 2) + (w.weather === 'rain' ? 1 : 0) + basket));
      if (basket && random(w) < .08) r.inventory.baskets--;
      if (w.farm.day !== dayOf(w.minute)) w.farm = { day: dayOf(w.minute), harvested: 0 };
      w.farm.harvested += k; r.inventory.food += k; r.skills.farming = Math.min(8, r.skills.farming + .04);
      event('work', `${r.name} tended ${building(a.target)?.name || 'Sunpatch fields'}`, `Harvested ${k} food.${farmLeft(w) <= 0 ? ' The fields and gardens have given all they can for today.' : ''}`); break;
    }
    case 'cook': takeEdible(r, 1); r.inventory.wood--; r.needs.hunger = Math.max(0, r.needs.hunger - 65); r.needs.energy = Math.min(100, r.needs.energy + 8); event('work', `${r.name} cooked a warm meal`, `One food and one wood made a hot meal that goes further than eating it cold${a.target ? `, at ${building(a.target)!.name}` : ''}.`); break;
    case 'preserve': { const k = Math.min(a.target && placeCapabilities(building(a.target)!).includes('smokehouse') ? 8 : 4, r.inventory.food); r.inventory.food -= k; r.inventory.wood--; r.inventory.preserves += k; event('work', `${r.name} put food by`, `${k} fresh food dried and salted over one wood's fire. Preserves will not spoil.`); break; }
    case 'craft': {
      const item = isCraftable(a.item) ? a.item : 'tools', place = building(a.target), uses = place ? placeCapabilities(place) : [], { inputs, output } = batch(item, uses.includes('workbench'), uses.includes('kiln'));
      for (const [g, n] of Object.entries(inputs)) r.inventory[g as Goods] -= n || 0;
      r.inventory[item] += output; r.skills.crafting = Math.min(8, r.skills.crafting + .06);
      const at = place ? ` at ${place.name}` : '', spent = Object.entries(inputs).map(([g, n]) => `${n} ${g}`).join(' and ');
      if (item === 'tools') event('work', `${r.name} made a new tool`, `${spent}${at} became a tool for gathering and construction.`);
      else if (item === 'baskets') event('work', `${r.name} wove a basket`, `${spent} became a basket${at}. ${recipes.baskets.use[0].toUpperCase()}${recipes.baskets.use.slice(1)}.`);
      else event('work', `${r.name} fired ${output} ${item === 'pots' ? (output === 1 ? 'pot' : 'pots') : 'brick'}`, `${spent} went into the fire${at}.`);
      if (recipes[item].technique) watch(w, r, recipes[item].technique!);
      break;
    }
    case 'experiment': {
      const t = untried(r, a.item as Goods).sort((x, y) => (r.knows?.[y] || 0) - (r.knows?.[x] || 0))[0], tech = techniques[t];
      for (const g of tech.inputs) r.inventory[g]--;
      r.knows ||= {}; r.tries ||= {}; const tries = r.tries[t] = (r.tries[t] || 0) + 1, before = r.knows[t] || 0;
      // Anyone can stumble on it; having watched it done, having failed before and a tinkering mind all help.
      if (random(w) < .02 + before * .45 + (tinkers(r) ? .04 : 0) + r.skills.crafting * .01) {
        r.knows[t] = 1; const record = w.discoveries[t], others = w.residents.filter(o => o.id !== r.id && knowsHow(o, t)), tried = `after ${tries} ${tries === 1 ? 'try' : 'tries'}`;
        if (!record) { w.discoveries[t] = { by: r.id, day: dayOf(w.minute) }; event('discovery', `${r.name} worked out ${tech.label}`, `${r.name} ${tech.success}, ${tried}. No one in Little Elsewhere had done it before.`, [r.id], [], 8, { actor: r.id, tags: { industry: .8 }, summary: `${r.name} worked out ${tech.label}` }); }
        else if (!others.length) { const first = w.residents.find(o => o.id === record.by)?.name || w.departed.find(d => d.id === record.by)?.name; record.lost = false; event('discovery', `${r.name} rediscovered ${tech.label}`, `${r.name} ${tech.success}, ${tried}. No one living remembered how${first ? `; ${first} first did it on Day ${record.day}` : ''}.`, [r.id], [], 8, { actor: r.id, tags: { industry: .6 }, summary: `${r.name} rediscovered ${tech.label}` }); }
        else event('discovery', `${r.name} worked out ${tech.label} too`, `${tried}, without being shown. ${others.length + 1} people here know how now.`, [r.id], [], 4);
      } else {
        r.knows[t] = Math.min(.95, Math.round((before + .05) * 100) / 100);
        event('work', `${r.name} tried ${tech.label}`, `${tech.fail[0].toUpperCase()}${tech.fail.slice(1)}. Attempt ${tries}.`, [r.id], [], 3);
      }
      break;
    }
    case 'teach': {
      if (!reach) break;
      const t = a.technique!, tech = techniques[t]; partner.knows ||= {}; for (const g of tech.inputs) r.inventory[g]--;
      const learned = (partner.knows[t] || 0) + .25 + (isChild(w, partner) ? .1 : 0) + partner.skills.crafting * .02; partner.knows[t] = learned >= .95 ? 1 : Math.round(learned * 100) / 100;
      for (const [x, y] of [[r, partner], [partner, r]]) { x.lastSocial[y.id] = w.minute; relation(x, y.id).interactions++; }
      const rel = relation(partner, r.id); rel.warmth = clamp(rel.warmth + Math.max(1, Math.round(6 * (1 - Math.max(0, rel.warmth) / 110)))); rel.trust = clamp(rel.trust + 3); rel.note = `Day ${dayOf(w.minute)}: ${r.name} showed me ${tech.how}`; owe(r, partner, 2);
      r.speech = { text: a.speech || routineSpeech(w, r, a), until: w.minute + 15 };
      const knowers = w.residents.filter(o => knowsHow(o, t)).length;
      event('social', partner.knows[t] >= 1 ? `${r.name} taught ${partner.name} ${tech.label}` : `${r.name} showed ${partner.name} some ${tech.label}`, partner.knows[t] >= 1 ? `${partner.name} can do it alone now. ${knowers} people here know ${tech.how}.` : 'It will take another lesson, or some trying, before it sticks.', [r.id, partner.id], [], 5, { actor: r.id, tags: { sharing: 1 }, summary: `${r.name} taught ${partner.name} ${tech.label}`, recipient: partner.id });
      break;
    }
    case 'repair': {
      const b = building(a.target)!, fix = repairable(b, r, a.method), used: Partial<Record<Goods, number>> = {}, was = [...new Set(fix.map(x => `${materialOf(x)} ${x.kind}`))].join(' and ');
      for (const x of fix) {
        for (const [g, n] of Object.entries(repairCost(x, a.method))) { r.inventory[g as Goods] -= n || 0; used[g as Goods] = (used[g as Goods] || 0) + (n || 0); }
        if (a.method) { const material = remade(x, a.method).material; if (material) x.material = material; else delete x.material; x.placedBy = r.id; x.placedAt = w.minute; }
        x.wear = 0; if (materialOf(x) === 'daub') watch(w, r, 'daubing', .03);
      }
      const own = r.home === b.id, roof = fix.some(x => x.kind === 'roof'), now = materialOf(fix[0]);
      event('project', a.method ? `${r.name} ${roof ? 're-roofed' : 'rebuilt the walls of'} ${b.name} in ${now}` : `${r.name} repaired ${b.name}`, a.method ? `${fix.length} worn section${fix.length > 1 ? 's' : ''} of ${was} rebuilt in ${now}, using ${costText(used)}.` : `Patched ${fix.length} worn section${fix.length > 1 ? 's' : ''} of ${was} with ${costText(used)}.`, [r.id], [], a.method ? 6 : 4, { actor: r.id, tags: own ? { industry: .4 } : { industry: .4, sharing: .8 }, summary: `${r.name} repaired ${b.name}` });
      recountCapacity(w); break;
    }
    case 'trade': {
      if (!reach) break;
      const buyer = a.mode === 'buy' ? r : partner, seller = a.mode === 'buy' ? partner : r, item = a.item!, q = quote(w, buyer, seller, item, a.quantity || 3);
      if (!q) { r.lastReason = 'The deal fell through.'; break; }
      const total = q.price * q.quantity, going = w.market[item].price;
      buyer.inventory.coins -= total; seller.inventory.coins += total; seller.inventory[item] -= q.quantity; buyer.inventory[item] += q.quantity; recordPrice(w, item, q.price, q.quantity);
      for (const [x, y] of [[r, partner], [partner, r]]) { const rel = relation(x, y.id); rel.trust = clamp(rel.trust + 1); rel.interactions++; }
      const e = event('trade', `${seller.name} sold ${q.quantity} ${item} to ${buyer.name}`, `${q.price} coin${q.price === 1 ? '' : 's'} each, ${total} in all${q.price > going * 1.3 ? ', well above the going rate' : q.price < going * .75 ? ', a bargain against the going rate' : ''}.`, [r.id, partner.id]);
      if (q.price > going * 1.3 && seller === r) { signal(w, 'fair-prices', `${seller.name} charged ${buyer.name} ${q.price} coins a unit for ${item} when the going rate was about ${Math.round(going * 10) / 10}.`); const b2 = breach(w, seller, 'fair-prices', `${seller.name} charged ${buyer.name} ${q.price} coins each for ${item}, well above the going rate.`); if (b2) { b2.causeIds.push(e.id); out.push(b2); } }
      break;
    }
    case 'gift': {
      if (!reach) break;
      const item = a.item!, k = Math.max(1, Math.min(a.quantity || 1, r.inventory[item])); r.inventory[item] -= k; partner.inventory[item] += k; r.speech = { text: a.speech || routineSpeech(w, r, a), until: w.minute + 15 };
      // A gift means most from someone not yet close; the tenth gift from a best friend adds little.
      const rel = relation(partner, r.id); rel.warmth = clamp(rel.warmth + Math.max(1, Math.round(8 * (1 - Math.max(0, rel.warmth) / 110)))); rel.trust = clamp(rel.trust + 3); rel.interactions++; rel.note = `Day ${dayOf(w.minute)}: ${r.name} gave me ${k} ${item}`; r.lastGave[partner.id] = w.minute; owe(r, partner, k);
      event('social', `${r.name} gave ${partner.name} ${k} ${item}`, `A gift, freely given${edibles(partner) <= k ? ' to a neighbor who had almost nothing' : ''}.`, [r.id, partner.id], [], 5, { actor: r.id, tags: { sharing: 1.5 }, summary: `${r.name} gave ${k} ${item} to ${partner.name}`, recipient: partner.id }); break;
    }
    case 'ask': {
      if (!reach) break;
      r.lastAsked[partner.id] = w.minute; relation(r, partner.id).interactions++; r.speech = { text: a.speech || routineSpeech(w, r, a), until: w.minute + 15 };
      const item: Goods | null = a.item === 'wood' ? (partner.inventory.wood - Math.ceil(comfort(partner, 'wood', season) / 2) >= 1 ? 'wood' : null) : partner.inventory.food - Math.ceil(comfort(partner, 'food', season) / 2) >= 1 ? 'food' : partner.inventory.preserves > 2 ? 'preserves' : null;
      if (!item) { event('social', `${partner.name} had nothing to spare for ${r.name}`, `${r.name} asked for ${a.item}, but ${partner.name} was short too.`, [r.id, partner.id]); break; }
      const spare = item === 'preserves' ? partner.inventory.preserves - 2 : partner.inventory[item] - Math.ceil(comfort(partner, item, season) / 2);
      if (random(w) < willingness(partner, r)) {
        const k = Math.min(3, spare); partner.inventory[item] -= k; r.inventory[item] += k; owe(partner, r, k);
        const rel = relation(r, partner.id); rel.warmth = clamp(rel.warmth + 6); rel.trust = clamp(rel.trust + 2); rel.note = `Day ${dayOf(w.minute)}: ${partner.name} helped me when I asked`;
        event('social', `${partner.name} helped ${r.name}`, `${r.name} asked for ${a.item}; ${partner.name} handed over ${k} ${item}.`, [partner.id, r.id], [], 5, { actor: partner.id, tags: { sharing: 1.2 }, summary: `${partner.name} gave ${k} ${item} to ${r.name} when asked`, recipient: r.id });
      } else {
        // Being refused stings more from someone you have given a lot to.
        const rel = relation(r, partner.id), ingrate = (rel.balance || 0) >= 4; rel.warmth = clamp(rel.warmth - (ingrate ? 11 : 5)); rel.note = `Day ${dayOf(w.minute)}: ${partner.name} refused to spare ${a.item} when I asked${ingrate ? ', after all I have given them' : ''}`;
        event('social', `${partner.name} turned ${r.name} away`, `${r.name} asked for ${a.item}. ${partner.name} had some to spare but kept it.`, [partner.id, r.id], [], 5, { actor: partner.id, tags: { sharing: -1 }, summary: `${partner.name} refused to spare ${a.item} for ${r.name}`, recipient: r.id });
      }
      break;
    }
    case 'deposit': {
      const item = a.item as PantryGood, k = Math.min(a.quantity || r.inventory[item], r.inventory[item]); r.inventory[item] -= k; w.stocks[item] += k; r.pantryNet += k; r.seasonGiven += k;
      // Neighbors credit what someone has given on balance, not goods passing back through, and only as far as the pantry needs it.
      const enough = w.residents.length * (item === 'stone' ? 2 : 6), credit = Math.min(k, r.pantryNet) * Math.min(1, enough / Math.max(1, w.stocks[item]));
      event('work', `${r.name} stocked the pantry`, `${k} ${item} added to the long pantry.`, [r.id], [], 3, credit >= 1 ? { actor: r.id, tags: { sharing: Math.min(2, .4 + credit / 6) }, summary: `${r.name} gave ${k} ${item} to the pantry` } : undefined); break;
    }
    case 'withdraw': {
      const item = a.item as PantryGood, plenty = item === 'food' || item === 'preserves' ? edibles(r) >= comfort(r, 'food', season) : r.inventory[item] >= comfort(r, item, season);
      const k = Math.min(a.quantity || 5, 5, w.stocks[item], item === 'wood' || item === 'stone' ? CARRY - bulk(r) : Infinity); w.stocks[item] -= k; r.inventory[item] += k; r.pantryNet -= k;
      const e = event('work', `${r.name} drew from the pantry`, `${k} ${item} taken from the long pantry.`, [r.id], [], plenty ? 5 : 3, plenty ? { actor: r.id, tags: { sharing: -2 }, summary: `${r.name} took ${k} ${item} from the pantry despite having plenty` } : undefined);
      if (plenty && (item === 'food' || item === 'preserves')) { signal(w, 'pantry-need', `${r.name} took ${k} ${item} from the pantry while already well stocked.`); const b2 = breach(w, r, 'pantry-need', `${r.name} took ${k} ${item} from the pantry while holding ${edibles(r) - k} food.`); if (b2) { b2.causeIds.push(e.id); out.push(b2); } }
      break;
    }
    case 'socialize': case 'promise': case 'share': {
      if (!reach) break; const t = partner;
      // People whose values differ sometimes clash; people who think alike bond a little faster.
      const gap = valueGap(r, t), tension = random(w) < Math.min(.35, Math.max(0, (gap - 1.1) * .15));
      influence(w, r, t);
      for (const [a1, a2] of [[r, t], [t, r]]) { const rel = relation(a1, a2.id); rel.warmth = clamp(rel.warmth + (tension ? -5 : conversationWarmth(rel.warmth) + (gap < .8 && rel.warmth < 70 ? 1 : 0))); rel.interactions++; a1.needs.social = Math.min(100, a1.needs.social + 25); a1.lastSocial[a2.id] = w.minute; }
      const speech = a.speech || routineSpeech(w, r, a);
      const reply = r.reply?.from === t.id && r.reply.expires > w.minute ? r.reply : null;
      const e = event('conversation', reply ? `${r.name} replied to ${t.name}` : `${r.name} and ${t.name} stopped to talk`, `${r.name}: “${speech}”`, [r.id, t.id], reply ? [reply.eventId] : []);
      if (tension) { const topic = ({ nature: 'how much of the forest to use', sharing: 'what neighbors owe each other', industry: 'how hard a person ought to work' } as const)[sharpestDifference(r, t)]; for (const [x, y] of [[r, t], [t, r]]) relation(x, y.id).note = `Day ${dayOf(w.minute)}: we disagreed about ${topic}`; event('social', `${r.name} and ${t.name} disagreed`, `They see ${topic} differently, and it showed. Warmth between them fell by five.`, [r.id, t.id], [e.id], 6); }
      if (reply) delete r.reply; else t.reply = { from: r.id, eventId: e.id, expires: w.minute + 120, speech, ...(a.dialogueTopic ? { topic: a.dialogueTopic } : {}) };
      r.speech = { text: speech, until: w.minute + 15 };
      if (a.kind === 'share') {
        const m = a.sharedMemoryId ? r.memories.find(m => m.id === a.sharedMemoryId) : r.memories.filter(m => m.eventIds.length && m.eventIds[0] !== e.id).slice(-8)[0];
        if (m) {
          const about = m.deed ? [m.deed.actor] : [], heard = Math.max(2, Math.min(9, Math.round(m.importance - 1 + (about.length ? stakeIn(t, about) : 0))));
          t.memories.push({ id: `belief-${e.id}`, minute: w.minute, text: `${r.name} told me: ${storyText(m.text)}`, importance: heard, eventIds: [e.id, m.eventIds[m.eventIds.length - 1]], kind: 'belief', source: r.id, ...(m.deed ? { deed: m.deed } : {}) });
          // Reputations travel by word of mouth, at half the strength of seeing it yourself.
          if (m.deed && m.deed.actor !== t.id) judge(w, m.deed, [t], .5);
          event('social', `${r.name} passed a story to ${t.name}`, `Reported account, not direct observation: ${storyText(m.text)}`, [r.id, t.id], [e.id, m.eventIds[m.eventIds.length - 1]]);
          out.push(...retell(w, r, m));
        }
      }
      if (a.kind === 'promise') { const p = w.projects.find(p => !p.complete && (!a.projectId || p.id === a.projectId))!; const pe = event('social', `${r.name} made a promise`, `${r.name} promised ${t.name} to help with ${p.name} within two days.`, [r.id, t.id], [e.id], 9); r.promises.push({ to: t.id, project: p.id, due: w.minute + 2880, status: 'open', eventId: pe.id }); r.memories.push({ id: `promise-${pe.id}`, minute: w.minute, text: `I promised ${t.name} to help ${p.name}.`, importance: 10, eventIds: [pe.id], kind: 'commitment' }); }
      break;
    }
    case 'court': if (reach) out.push(...court(w, r, partner)); break;
    case 'play': {
      r.needs.social = Math.min(100, r.needs.social + 30); r.needs.energy = Math.max(0, r.needs.energy - 5);
      const friends = w.residents.filter(o => o.id !== r.id && distance(o.position, r.position) <= 4);
      for (const o of friends) { influence(w, r, o); for (const [x, y] of [[r, o], [o, r]]) { const rel = relation(x, y.id); rel.warmth = clamp(rel.warmth + 2); rel.interactions++; } }
      if (friends.length && random(w) < .25) event('life', `${r.name} played with ${friends.map(f => f.name).slice(0, 3).join(' and ')}`, 'Games by the oak.', [r.id, ...friends.map(f => f.id)], [], 2);
      break;
    }
    case 'extend': {
      const b = building(a.target)!, p = createExtension(w, r, b, a.part as PartKind, a.method); w.projects.push(p);
      event('project', `${r.name} proposed adding ${partLabels[a.part as PartKind].label} to ${b.name}`, `${p.description} ${p.requiredLabor} elements; ${costText(p.requires)} required.`, [r.id], [], 6); break;
    }
    case 'propose': case 'vote': {
      const speech = a.speech || routineSpeech(w, r, a); r.speech = { text: speech, until: w.minute + 15 };
      out.push(...(a.kind === 'propose' ? propose(w, r, a, speech) : vote(w, r, a, speech))); break;
    }
    case 'design': { const p = createDesignedProject(w, r, a.target as BlueprintKind, a.method); w.projects.push(p); event('project', `${r.name} proposed ${p.name}`, `${p.description} Blueprint: ${p.requiredLabor} elements; ${costText(p.requires)} required.`, [r.id], [], 7); break; }
    case 'name_place': {
      const p = w.projects.find(p => p.id === a.target)!, b = w.buildings.find(b => b.id === p.building!.id)!;
      const name = a.placeName || `${r.name}'s ${{ hearth: 'Hearth', shelter: 'Quiet Corner', commons: 'Gathering Place', cottage: 'Cottage', larder: 'Larder', garden: 'Garden', smokehouse: 'Smokehouse', workyard: 'Yard', kilnyard: 'Kiln' }[p.design!.blueprint]}`;
      const old = p.name; b.name = name; b.namedBy = r.id; b.namedAt = w.minute; p.building = b; p.name = name;
      event('project', `${r.name} named ${name}`, `${old} is now called ${name}. Its uses come from its completed materials and furnishings.`, [r.id], [p.design!.eventId], 7); break;
    }
    case 'build': {
      const p = w.projects.find(p => p.id === a.target)!;
      for (const material of buildGoods) { const n = Math.min(6, r.inventory[material], stillNeeds(p, material)); if (n) { r.inventory[material] -= n; p.supplied[material] = (p.supplied[material] || 0) + n; } }
      const placed = partBuilt(p) ? assembleBlocks(p, r, w.minute) : [];
      // Building in wattle and daub teaches the hands that do it, and a little to those watching.
      if (placed.some(b => b.material === 'daub')) { r.knows ||= {}; if (!knowsHow(r, 'daubing')) r.knows.daubing = Math.min(.95, (r.knows.daubing || 0) + .1); watch(w, r, 'daubing', .03); }
      if (!partBuilt(p) && fullySupplied(p)) p.labor = Math.min(p.requiredLabor, p.labor + 1 + (r.inventory.tools > 0 ? 1 : 0));
      if (!p.contributors.includes(r.id)) p.contributors.push(r.id);
      // Working side by side builds warmth between people who show up for the same project.
      for (const other of w.residents.filter(o => o.id !== r.id && o.task?.action.kind === 'build' && o.task.action.target === p.id && distance(o.position, r.position) <= 6)) for (const [x, y] of [[r, other], [other, r]]) { const rel = relation(x, y.id); rel.warmth = clamp(rel.warmth + 1); }
      const e = event('project', `${r.name} helped with ${p.name}`, `Supplies: ${buildGoods.filter(g => p.requires[g]).map(g => `${p.supplied[g] || 0}/${p.requires[g]} ${g}`).join(', ')}. Work: ${p.labor}/${p.requiredLabor}.${placed.length ? ` Placed: ${placed.map(b => b.material && b.material !== 'timber' && b.material !== 'stone' ? `${b.material} ${b.kind}` : b.kind).join(', ')}.` : ''}`, [r.id], p.design ? [p.design.eventId] : p.extension ? [p.extension.eventId] : [], 3, { actor: r.id, tags: { industry: .6 }, summary: `${r.name} worked on ${p.name}` });
      for (const promise of r.promises.filter(x => x.status === 'open' && x.project === p.id)) { promise.status = 'kept'; const recipient = w.residents.find(t => t.id === promise.to); if (recipient) { const rel = relation(recipient, r.id); rel.trust = clamp(rel.trust + 12); } event('social', `${r.name} kept a promise`, `The commitment to help ${p.name} has been fulfilled.`, [r.id, promise.to], [promise.eventId, e.id], 9); }
      if (p.labor >= p.requiredLabor && fullySupplied(p)) {
        p.complete = true; event('project', `${p.name} is complete`, `Built together by ${p.contributors.map(id => w.residents.find(r => r.id === id)?.name || id).join(', ')}.`, p.contributors, [e.id], 9);
        if (p.building) w.buildings.push(p.building);
        const target = p.extension && w.buildings.find(b => b.id === p.extension!.building);
        if (target) {
          const before = placeCapabilities(target); target.blocks = [...(target.blocks || []), ...p.extension!.blocks];
          const gained = placeCapabilities(target).filter(c => !before.includes(c));
          event('project', `${target.name} now has ${partLabels[p.extension!.part].label}`, `${gained.length ? `New uses: ${gained.map(c => capabilityLabels[c].toLowerCase()).join(', ')}.` : 'It adds to what was already there.'}${gained.includes('home') ? ' Two more neighbors could live here.' : ''}`, p.contributors, [p.extension!.eventId], gained.length ? 8 : 5);
        }
        recountCapacity(w);
        // Work finished by others releases a promise rather than breaking it.
        for (const other of w.residents) for (const promise of other.promises.filter(x => x.status === 'open' && x.project === p.id)) { promise.status = 'released'; other.memories.push({ id: `released-${promise.eventId}`, minute: w.minute, text: `${p.name} was finished before I could keep my promise to help.`, importance: 6, eventIds: [promise.eventId], kind: 'observation' }); }
      }
      if (r.inventory.tools > 0 && random(w) < .12) r.inventory.tools--;
      break;
    }
    case 'explore': { const reg = w.regions.find(reg => reg.id === a.target)!; reg.progress = Math.min(reg.required, reg.progress + Math.ceil(r.skills.exploring)); r.skills.exploring = Math.min(5, r.skills.exploring + .08); event('discovery', `${r.name} explored ${reg.name}`, `Survey progress: ${reg.progress}/${reg.required}.`); if (reg.progress >= reg.required) { reg.discovered = true; event('discovery', `${reg.name} is on the map`, reg.description, [r.id], [], 9); } break; }
    case 'club': { const name = r.role === 'Storykeeper' ? 'The evening stories' : r.traits.includes('inventive') ? 'Makers under the oak' : 'The growing circle'; let club = w.clubs.find(c => c.name === name); if (!club) { club = { name, members: [], founded: w.minute }; w.clubs.push(club); } if (!club.members.includes(r.id)) { club.members.push(r.id); event('social', `${r.name} joined ${name}`, 'A new place to share ideas and make friends.', [r.id], [], 7); } r.needs.social = Math.min(100, r.needs.social + 35); if (a.target) event('social', `${r.name} visited ${building(a.target)!.name}`, `Spent time with ${name} at the resident-built meeting place.`); break; }
    case 'festival': {
      const fromFood = Math.min(18, w.stocks.food); w.stocks.food -= fromFood; w.stocks.preserves -= 18 - fromFood;
      const attendees = w.residents.filter(t => distance(t.position, r.position) <= 20); for (const t of attendees) { t.needs.social = Math.min(100, t.needs.social + 30); t.needs.hunger = Math.max(0, t.needs.hunger - 25); }
      const e = event('social', `${r.name} brought the village together`, `A ${season} gathering beneath the oak, with ${attendees.length} neighbors and eighteen food from the pantry.`, attendees.map(t => t.id), [], 8, { actor: r.id, tags: { sharing: 2 }, summary: `${r.name} hosted a gathering for everyone` });
      w.festivals.push({ day: dayOf(w.minute), host: r.id, eventId: e.id }); out.push(...gathered(w, r, attendees, e.id)); break;
    }
  }
  return out;
}
const homeKinds = ['home', 'outpost'];
function frontierProject(w: WorldState, slot: number, id: string, name: string, description: string, requires: { wood: number; stone: number }, requiredLabor: number, kind: Building['kind'] = 'home'): Project {
  const [x, y, bw, bh] = frontierHomes[slot], door = frontierDoor(frontierHomes[slot]);
  return { id, name, description, location: door, requires, supplied: { wood: 0, stone: 0 }, labor: 0, requiredLabor, complete: false, contributors: [], unlockedDay: dayOf(w.minute), building: { id: `home-${id}`, name, kind, x, y, w: bw, h: bh, roof: ['#ac8157', '#8c6a5a', '#a27060', '#7f8a6a', '#9a7a8e', '#8a7a58', '#6f7f8c'][slot], door, capacity: 3 } };
}
function unlockProjects(w: WorldState) {
  const add = (p: Project) => { if (!w.projects.some(x => x.id === p.id)) w.projects.push(p); };
  if (w.regions.find(r => r.id === 'meadow')?.discovered) add(frontierProject(w, 0, 'restore-meadow', 'Bluebell guest cottage', 'Make space for travelers who might become neighbors.', { wood: 42, stone: 30 }, 24));
  if (w.regions.find(r => r.id === 'outpost')?.discovered) add(frontierProject(w, 1, 'restore-outpost', 'A new life for the outpost', 'Restore the old stone walls into a home for newcomers.', { wood: 38, stone: 36 }, 24, 'outpost'));
  const slots = w.projects.filter(p => p.building && !p.design).length;
  if (w.projects.filter(p => p.building && homeKinds.includes(p.building.kind) && p.complete).length >= 2 && w.capacity < 24 && !w.projects.some(p => !p.complete && !p.design) && slots < frontierHomes.length) add(frontierProject(w, slots, `cottage-${slots}`, `Frontier cottage ${slots - 1}`, 'A new home along the frontier road.', { wood: 50, stone: 35 }, 28));
}
export function refreshAims(w: WorldState): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (const r of w.residents) {
    let aim: string | undefined;
    if (r.ambition === cast[0][5] && w.projects.some(p => p.id === 'bridge' && p.complete)) aim = 'Help build welcoming homes beyond the bridge.';
    if (!aim && r.ambition === cast[9][5] && w.projects.some(p => p.id === 'restore-outpost' && p.complete)) aim = 'Help the next arrivals settle in and finish the remaining homes.';
    if (!aim && r.ambition === cast[7][5] && w.clubs.some(c => c.name === 'The evening stories' && c.members.includes(r.id))) aim = 'Keep the storytelling circle alive and welcome new voices.';
    if (!aim && r.ambition === cast[11][5] && w.festivals.some(f => f.host === r.id)) aim = 'Keep the pantry ready and bring neighbors together for another gathering.';
    if (!aim) continue;
    const old = r.ambition; r.ambition = aim; r.plan = aim;
    events.push(emit(w, 'social', `${r.name} has a new aim`, `${r.name}'s aim changed from “${old}” to “${aim}”`, [r.id], r.position, [], 6));
  }
  return events;
}
const seasonNews: Record<Season, [string, string]> = {
  spring: ['Spring returns to Little Elsewhere', 'The fields thaw and can be worked again. Stumps may sprout and mature trees scatter seed.'],
  summer: ['Summer settles over the village', 'Long days and full berry bushes, but fresh food spoils quickly in the heat.'],
  autumn: ['Autumn: the harvest season', 'The fields yield the most they will all year. Winter is seven days away; homes will need firewood and stored food.'],
  winter: ['Winter arrives', 'The fields are frozen and bushes are bare. Every home burns firewood each night, and only stored food remains.'],
};
function occupants(w: WorldState, b: Building) { return w.residents.filter(r => r.home === b.id); }
// Beds are for adults; up to three children share their parents' rooms.
const adultsIn = (w: WorldState, b: Building) => occupants(w, b).filter(r => !isChild(w, r)).length;
const childrenIn = (w: WorldState, b: Building) => occupants(w, b).filter(r => isChild(w, r)).length;
function removeResident(w: WorldState, r: Resident, reason: string, died = false) {
  w.residents = w.residents.filter(x => x.id !== r.id); w.departed.push({ id: r.id, name: r.name, role: r.role, color: r.color, minute: w.minute, reason, ...(died ? { died, age: Math.floor(ageOf(r, w.minute)) } : {}) });
  for (const other of w.residents) { if (other.reply?.from === r.id) delete other.reply; if (other.partner === r.id) delete other.partner; for (const p of other.promises) if (p.to === r.id && p.status === 'open') p.status = 'released'; }
  for (const club of w.clubs) club.members = club.members.filter(id => id !== r.id);
}
function depart(w: WorldState, r: Resident, reason: string): WorldEvent {
  const e = emit(w, 'social', `${r.name} left Little Elsewhere`, `After days without enough to eat, ${r.name} ${reason}. Their story here remains in the record.`, [r.id], r.position, [], 9);
  removeResident(w, r, reason); return e;
}
// A death is mourned by those who cared, and what they owned passes to family or a close friend.
function die(w: WorldState, r: Resident): WorldEvent {
  const age = Math.floor(ageOf(r, w.minute)), partner = w.residents.find(o => o.id === r.partner), kids = w.residents.filter(c => c.parents?.includes(r.id));
  const friend = Object.entries(r.relationships).filter(([id, rel]) => rel.warmth >= 30 && w.residents.some(o => o.id === id)).sort((a, b) => b[1].warmth - a[1].warmth)[0];
  const heirs = partner ? [partner] : kids.length ? kids : friend ? [w.residents.find(o => o.id === friend[0])!] : [];
  for (const g of ['food', 'preserves', 'wood', 'stone', 'tools', 'coins'] as const) {
    const total = r.inventory[g]; if (!total) continue;
    if (heirs.length) heirs.forEach((h, i) => { h.inventory[g] += Math.floor(total / heirs.length) + (i === 0 ? total % heirs.length : 0); });
    else if (g !== 'tools' && g !== 'coins') w.stocks[g] += total;
  }
  const will = heirs.length ? ` What ${r.name} owned passed to ${heirs.map(h => h.name).join(' and ')}${!partner && !kids.length ? ', a close friend' : ''}.` : ' What they owned went to the pantry.';
  const e = emit(w, 'life', `${r.name} died`, `${r.name} died ${r.hungryDays ? 'weakened by hunger' : 'in their sleep'} at ${age}, after ${Math.max(1, dayOf(w.minute) - dayOf(r.arrived))} days in Little Elsewhere.${will}`, [r.id, ...heirs.map(h => h.id)], r.position, [], 10);
  for (const o of w.residents) { const rel = o.relationships[r.id]; if (o.id !== r.id && rel && rel.warmth >= 30) { o.memories.push({ id: `grief-${e.id}`, minute: w.minute, text: `${r.name} died. ${rel.note ? `I remember: ${rel.note.replace(/^Day \d+: /, '')}.` : 'I will miss them.'}`, importance: 9, eventIds: [e.id], kind: 'reflection' }); o.needs.social = Math.max(0, o.needs.social - 25); } }
  removeResident(w, r, `died at ${age}`, true); return e;
}
const homeRoom = (b: Building) => b.kind === 'place' ? homeCapacity(b) : b.capacity || 3;
function newDay(w: WorldState): WorldEvent[] {
  const events: WorldEvent[] = [];
  w.history.push(dayStats(w)); if (w.history.length > 400) w.history.shift();
  w.dayActions = {}; w.lastDay = dayOf(w.minute); w.farm = { day: w.lastDay, harvested: 0 };
  const season = seasonOf(w.minute), rand = () => random(w);
  w.weather = pickWeather(season, rand);
  if (seasonOf(w.minute - 1440) !== season) events.push(emit(w, 'weather', seasonNews[season][0], seasonNews[season][1], [], center, [], 8));
  events.push(emit(w, 'weather', `A ${w.weather} ${season} day`, `Day ${seasonDay(w.minute)} of ${season}.`, [], center));
  const growth = growNature(w, season, rand);
  for (const n of w.nodes) if (n.kind === 'rock' && (season === 'spring' || season === 'winter') && n.amount < nodeYield.rock && random(w) < .25) { n.amount++; if (n.stage === 'spent') { n.stage = 'mature'; w.nodeVersion++; } }
  if (growth.sprouted >= 3) events.push(emit(w, 'nature', 'New saplings in the woods', `${growth.sprouted} young trees took root overnight.`, [], { x: 12, y: 8 }));
  // Fresh food spoils; the pantry slows it down and preserves never spoil.
  const rate = seasonal.spoilage[season]; let lost = 0;
  // Food kept in pots does not spoil; pots themselves sometimes crack.
  for (const r of w.residents) { const k = spoil(Math.max(0, r.inventory.food - r.inventory.pots * POT_KEEPS), rate, rand); r.inventory.food -= k; lost += k; r.inventory.pots -= spoil(r.inventory.pots, .01, rand); }
  for (const r of w.residents) { const k = spoil(r.inventory.preserves, PRESERVE_LOSS, rand); r.inventory.preserves -= k; lost += k; }
  // A roofed larder halves what the pantry loses; a second halves it again, and more add nothing.
  const pantryFood = spoil(w.stocks.food, rate * PANTRY_SPOILAGE * .5 ** Math.min(2, larders(w)), rand), pantryPreserves = spoil(w.stocks.preserves, PRESERVE_LOSS, rand), pantryLost = pantryFood + pantryPreserves;
  w.stocks.food -= pantryFood; w.stocks.preserves -= pantryPreserves;
  w.history.at(-1)!.spoiled = lost + pantryLost;
  if (lost + pantryLost >= 5) events.push(emit(w, 'nature', `${lost + pantryLost} food spoiled overnight`, `${lost} in people's kitchens and ${pantryLost} in the long pantry.${season === 'summer' ? ' Summer heat is hard on fresh food.' : ''} Preserves keep far better.`, [], w.buildings.find(b => b.id === 'store')!.door));
  // Walls and roofs weather. When one wears through, the place loses what it gave until someone patches it.
  const usesBefore = new Map(w.buildings.filter(b => b.blocks).map(b => [b.id, placeCapabilities(b)]));
  for (const { building: b, blocks } of weather(w, w.weather === 'rain' || w.weather === 'snow')) {
    const lostUses = (usesBefore.get(b.id) || []).filter(c => !placeCapabilities(b).includes(c)), material = materialOf(blocks[0]), what = blocks[0].kind === 'roof' ? `The ${material} roof of ${b.name}` : `A ${material} wall of ${b.name}`;
    events.push(emit(w, 'nature', blocks[0].kind === 'roof' ? `${what} has started to leak` : `${what} has crumbled`, `It wore through ${dayOf(w.minute) - dayOf(blocks[0].placedAt || 0)} days after it was built.${lostUses.length ? ` Until it is patched with ${materialTraits[material].repair}, it can no longer be used to ${lostUses.map(c => capabilityLabels[c].toLowerCase()).join(' or ')}.` : ` It needs patching with ${materialTraits[material].repair}.`}`, [...new Set([...occupants(w, b).map(o => o.id), ...(b.namedBy && w.residents.some(o => o.id === b.namedBy) ? [b.namedBy] : [])])], b.door, [], lostUses.length ? 7 : 5));
  }
  recountCapacity(w);
  // Homes burn firewood in the cold months. Whoever has the most wood feeds the fire first; well-built walls and roofs hold the heat.
  const perPerson = seasonal.firewood[season], cold: string[] = []; let burned = 0;
  for (const b of w.buildings.filter(b => isHome(b) || (b.kind === 'place' && occupants(w, b).length))) {
    const people = occupants(w, b); b.cold = false; if (!perPerson || !people.length) continue;
    if (b.kind === 'place' && !placeCapabilities(b).includes('rest')) { b.cold = true; cold.push(b.name); continue; } // No fire warms a house with a hole in it.
    const exact = people.length * perPerson * (1 - (b.kind === 'place' ? warmth(b) : 0)); let needed = Math.floor(exact) + (rand() < exact % 1 ? 1 : 0); const given = new Map<string, number>();
    while (needed > 0) { const donor = [...people].sort((a, c) => c.inventory.wood - a.inventory.wood)[0]; if (!donor || donor.inventory.wood <= 0) break; donor.inventory.wood--; needed--; burned++; given.set(donor.id, (given.get(donor.id) || 0) + 1); }
    const fromPantry = Math.min(needed, w.stocks.wood); w.stocks.wood -= fromPantry; needed -= fromPantry; burned += fromPantry;
    if (needed > 0) { b.cold = true; cold.push(b.name); }
    for (const [id, n] of given) if (n >= 2) for (const mate of people.filter(p => !given.has(p.id))) { const rel = relation(mate, id); rel.warmth = clamp(rel.warmth + 1); }
  }
  if (burned || cold.length) events.push(emit(w, 'nature', cold.length ? `${cold.join(', ')} went cold overnight` : `Hearths burned ${burned} wood overnight`, `${burned} firewood burned across the village.${cold.length ? ` Without enough wood, ${cold.join(' and ')} stayed cold; rest there will be poor until the fire is fed.` : ''}`, [], center, [], cold.length ? 7 : 3));
  for (const r of w.residents) for (const p of r.promises.filter(p => p.status === 'open' && p.due <= w.minute)) {
    p.status = 'missed'; const recipient = w.residents.find(t => t.id === p.to); if (recipient) { const rel = relation(recipient, r.id); rel.trust = clamp(rel.trust - 10); }
    events.push(emit(w, 'social', `${r.name} missed a commitment`, 'A promise went unfulfilled. There is still time to repair the relationship.', [r.id, p.to], r.position, [p.eventId], 8));
  }
  // Hunger has consequences: resentment toward nearby full larders, and eventually leaving.
  for (const r of [...w.residents]) {
    r.hungryDays = r.needs.hunger >= 95 && edibles(r) === 0 ? r.hungryDays + 1 : 0;
    if (r.hungryDays >= 4 && stageOf(r, w.minute) === 'adult') { events.push(depart(w, r, 'went looking for a village with food to spare')); continue; }
    if (r.needs.hunger >= 80 && edibles(r) === 0) {
      const hoarder = w.residents.filter(o => o.id !== r.id && (o.home === r.home || distance(o.position, r.position) <= 12) && edibles(o) >= 25).sort((a, b) => edibles(b) - edibles(a))[0];
      if (hoarder) {
        judge(w, { actor: hoarder.id, tags: { sharing: -1.5 }, summary: `${hoarder.name} kept a full larder while ${r.name} went hungry` }, [r]);
        signal(w, 'no-hoarding', `${r.name} went hungry while ${hoarder.name} held ${edibles(hoarder)} food nearby.`);
        const e = breach(w, hoarder, 'no-hoarding', `${hoarder.name} held ${edibles(hoarder)} food while ${r.name} went hungry nearby.`); if (e) events.push(e);
      }
    }
  }
  for (const r of w.residents) {
    r.pantryNet = Math.trunc(r.pantryNet * .9) || 0;
    // Nobody can plant in frozen ground, so winter felling is forgiven until spring has had a day.
    if (r.treeDebt > 0 && seasonOf(w.minute - 1440) !== 'winter' && dayOf(w.minute) - (r.treeDebtSince ?? 0) >= 2) { const e = breach(w, r, 'replant', `${r.name} felled ${r.treeDebt} tree${r.treeDebt > 1 ? 's' : ''} and planted none in return.`); if (e) { events.push(e); r.treeDebt = 0; } }
  }
  // At the turn of a season, anyone here all season who gave the pantry nothing has broken that rule, if it is one.
  if (seasonOf(w.minute - 1440) !== season) {
    for (const r of w.residents) { if (r.seasonGiven === 0 && r.arrived < w.minute - DAYS_PER_SEASON * 1440) { const e = breach(w, r, 'give-each-season', `${r.name} gave nothing to the pantry all ${seasonOf(w.minute - 1440)}.`); if (e) events.push(e); } r.seasonGiven = 0; }
  }
  // Life: coming of age, old age, partnerships that wear thin, and new children where there is room.
  for (const r of [...w.residents]) {
    if (r.role === 'Child' && ageOf(r, w.minute) >= ADULT_AGE) events.push(comingOfAge(w, r));
    if (random(w) < deathChance(w, r)) events.push(die(w, r));
  }
  for (const r of w.residents) {
    const p = r.partner ? w.residents.find(o => o.id === r.partner) : undefined; if (!p || r.id > p.id) continue;
    if (((r.relationships[p.id]?.warmth || 0) + (p.relationships[r.id]?.warmth || 0)) / 2 < 15) { delete r.partner; delete p.partner; events.push(emit(w, 'life', `${r.name} and ${p.name} parted ways`, 'What was between them had worn thin.', [r.id, p.id], r.position, [], 8)); continue; }
    if (r.home !== p.home) { const moved = moveIn(w, r, p); if (moved) events.push(emit(w, 'life', `${r.name} and ${p.name} moved in together`, moved, [r.id, p.id], r.position, [], 7)); }
    // A child needs room in one of their homes, food in the house, and parents young enough.
    const nest = [r.home, p.home].map(id => w.buildings.find(b => b.id === id)).find(b => b && childrenIn(w, b) < 3), food = [r, p, ...household(w, r)].reduce((s, x) => s + edibles(x), 0);
    const youngest = Math.max(-Infinity, ...w.residents.filter(c => c.parents?.includes(r.id) || c.parents?.includes(p.id)).map(c => c.born));
    if (season !== 'winter' && nest && w.minute - youngest > 2 * SEASON_MINUTES && w.residents.length < POPULATION_CAP + 8 && ageOf(r, w.minute) < 50 && ageOf(p, w.minute) < 50 && food >= 15 && random(w) < .06) { const { child, event } = birth(w, r, p); child.home = nest.id; events.push(event); }
  }
  // Generosity that is never returned turns into resentment for those who do not value giving for its own sake.
  for (const r of w.residents) for (const [id, rel] of Object.entries(r.relationships)) {
    if (!rel.balance) continue;
    if (rel.balance >= 8 && r.values.sharing < .5 && random(w) < .3 && w.residents.some(o => o.id === id)) { rel.warmth = clamp(rel.warmth - 3); rel.note = `Day ${dayOf(w.minute)}: has taken a lot from me and given little back`; }
    rel.balance = Math.trunc(rel.balance * .95) || 0;
  }
  for (const c of w.residents.filter(c => isChild(w, c) && c.needs.hunger >= 90)) { const carer = household(w, c).sort((a, b) => edibles(b) - edibles(a))[0]; if (carer && edibles(carer) > 0) judge(w, { actor: carer.id, tags: { sharing: -1.5 }, summary: `${carer.name} let ${c.name} go hungry` }, w.residents.filter(o => o.home === c.home && o.id !== c.id)); }
  forgetTales(w); events.push(...tendTraditions(w));
  // The familiar slowly becomes new again.
  for (const [k, v] of Object.entries(w.familiar)) { const next = Math.round(v * .97 * 100) / 100; if (next < .2) delete w.familiar[k]; else w.familiar[k] = next; }
  // Know-how lives only in people. When the last who knew is gone, it is gone.
  for (const [t, record] of Object.entries(w.discoveries) as [Technique, NonNullable<WorldState['discoveries'][Technique]>][]) {
    const living = w.residents.some(o => knowsHow(o, t));
    if (!living && !record.lost) { record.lost = true; events.push(emit(w, 'culture', `No one left knows ${techniques[t].how}`, `Whoever knew ${techniques[t].label} has died or gone, and no one else learned it. Someone would have to work it out again.`, [], center, [], 8)); }
    else if (living) record.lost = false;
  }
  fadeRelationships(w);
  for (let i = 0; i < w.wear.length; i++) if (w.wear[i]) w.wear[i] = Math.floor(w.wear[i] * .85);
  const homes = w.buildings.filter(isHome), open = homes.find(b => adultsIn(w, b) < homeRoom(b));
  if (season !== 'winter' && open && w.residents.filter(x => !isChild(w, x)).length < Math.min(POPULATION_CAP, w.capacity) && w.stocks.food + w.stocks.preserves >= 20 + w.residents.length * 2 && w.lastDay - w.lastVisitorDay >= 3) {
    const r = createResident(12 + w.departed.filter(d => d.id.startsWith('settler-')).length + w.residents.filter(x => x.id.startsWith('settler-')).length, w.minute);
    // Names cycle, so a newcomer never shares a name with anyone living or remembered.
    const taken = new Set([...w.residents.map(x => x.name), ...w.departed.map(x => x.name)]);
    if (taken.has(r.name)) r.name = [...newcomerNames, ...extraNames].find(n => !taken.has(n)) || `${r.name} ${r.role[0]}.`;
    r.home = open.id; r.position = { x: open.door.x, y: open.door.y }; w.residents.push(r);
    const fromFood = Math.min(10, w.stocks.food); w.stocks.food -= fromFood; w.stocks.preserves -= 10 - fromFood; w.lastVisitorDay = w.lastDay;
    events.push(emit(w, 'arrival', `${r.name} has found a home`, `A new ${r.role.toLowerCase()} settled in ${open.name}. Ten pantry food helped them get started.`, [r.id], r.position, [], 9));
  }
  unlockProjects(w);
  return events;
}
export function advance(w: WorldState, minutes: number): WorldEvent[] {
  const events: WorldEvent[] = []; w.minute += minutes;
  if (dayOf(w.minute) > w.lastDay) events.push(...newDay(w));
  for (const r of w.residents) {
    // New walls or a tree growing underfoot can cover someone. Step them to open ground.
    if (!walkable(w, Math.round(r.position.x), Math.round(r.position.y))) { const spot = nearestWalkable(w, Math.round(r.position.x), Math.round(r.position.y)); if (spot) { r.position = spot; if (r.task) r.task.route = findRoute(w, r.position, r.task.destination) || []; } }
    r.needs.hunger = Math.min(100, r.needs.hunger + minutes * .075); r.needs.energy = Math.max(0, r.needs.energy - minutes * (r.needs.hunger >= 100 ? .086 : .043) * (r.born < w.minute - 60 * SEASON_MINUTES ? 1.2 : 1)); r.needs.social = Math.max(0, r.needs.social - minutes * .025);
    if (r.speech && r.speech.until < w.minute) delete r.speech;
    if (r.reply && r.reply.expires < w.minute) delete r.reply;
    if (!r.task) continue;
    r.task.route ||= findRoute(w, r.position, r.task.destination) || [];
    if (r.task.route.some(p => !walkable(w, p.x, p.y))) { const route = findRoute(w, r.position, r.task.destination); if (!route) { r.task = null; r.nextDecision = w.minute + 10; continue; } r.task.route = route; }
    const walkingSpeed = 9; let travel = minutes * walkingSpeed;
    while (travel > 0 && r.task.route.length) {
      const next = r.task.route[0], dist = distance(r.position, next);
      if (dist <= travel) { r.position = { ...next }; r.task.route.shift(); travel -= dist; if (wearable(next.x, next.y)) { const i = tileIndex(next.x, next.y); w.wear[i] = Math.min(100, w.wear[i] + 1); } }
      else { const dx = next.x - r.position.x, mx = Math.sign(dx) * Math.min(Math.abs(dx), travel); r.position.x += mx; r.position.y += Math.sign(next.y - r.position.y) * (travel - Math.abs(mx)); travel = 0; }
    }
    if (!r.task.route.length) { r.task.remaining -= travel / walkingSpeed; if (r.task.remaining <= 0) events.push(...finishAction(w, r)); }
  }
  events.push(...resolveProposals(w));
  events.push(...refreshAims(w));
  return events;
}
export const POPULATION_CAP = 24;
// Room for residents: three per original or frontier home, plus beds in resident-built homes.
export function recountCapacity(w: WorldState) {
  w.capacity = Math.min(POPULATION_CAP, w.buildings.reduce((sum, b) => sum + (b.kind === 'place' ? homeCapacity(b) : homeKinds.includes(b.kind) ? b.capacity || 3 : 0), 0));
}
// Older saves predate parts, rules and pantry accounting. Fill in neutral defaults.
export function migrate(w: WorldState): WorldState {
  w.norms ||= []; w.proposals ||= []; w.signals ||= {}; w.tales ||= {}; w.legends ||= []; w.traditions ||= []; w.gatherings ||= []; w.discoveries ||= {};
  for (const r of w.residents) { r.pantryNet ??= 0; r.lastGave ||= {}; r.treeDebt ??= 0; r.seasonGiven ??= 0; r.lastProposed ??= -99999; r.born ??= r.arrived - arrivalAge(r.id) * SEASON_MINUTES; r.practice ||= {}; r.knows ||= {}; r.tries ||= {}; for (const g of goods) r.inventory[g] ??= 0; }
  for (const g of goods) w.market[g] ||= { price: basePrice[g], trades: 0, volume: 0 };
  if (!w.nodes.some(isWetland)) { w.nodes.push(...wetlandNodes()); w.nodeVersion++; }
  if (!w.familiar) rememberFamiliar(w);
  // Walls and roofs built before weathering existed have been out in the weather all along.
  for (const b of w.buildings) for (const x of b.blocks || []) if (x.placedBy && weathers(x) && x.wear === undefined) { const t = materialTraits[materialOf(x)]; x.wear = Math.min(.9, Math.round((w.minute - (x.placedAt ?? w.minute)) / 1440 * (t.wear + t.wet * .35) * 1000) / 1000); }
  recountCapacity(w); return w;
}
// An older world has no record of what was familiar. Rebuild it from what residents remember, and let
// memories of everyday things settle to the weight they would have had.
function rememberFamiliar(w: WorldState) {
  w.familiar = {}; const seen = new Map<number, { kind?: string; title: string }>(), byTitle: Record<string, number> = {};
  const title = (text: string) => signature(w, '', storyText(text).split('. ')[0]).slice(1);
  for (const r of w.residents) for (const m of r.memories) if (m.kind === 'observation' && m.eventIds[0] && !seen.has(m.eventIds[0])) seen.set(m.eventIds[0], { kind: m.event, title: title(m.text) });
  for (const { kind, title: t } of seen.values()) { byTitle[t] = (byTitle[t] || 0) + 1; if (kind) w.familiar[`${kind}:${t}`] = (w.familiar[`${kind}:${t}`] || 0) + 1; }
  // Older memories do not record what kind of event they were, so they are matched by what happened.
  for (const r of w.residents) for (const m of r.memories) if (m.kind === 'observation' || m.kind === 'belief') m.importance = felt(m.importance, 1 / (1 + Math.max(0, (byTitle[title(m.text)] || 1) - 1) / 3), 0);
}
