import type { ActionKind, AgentAction, Resident, Value, WorldEvent, WorldState } from '../shared/types.ts';
import { DAYS_PER_SEASON, dayOf, hourOf, seasonOf } from '../shared/types.ts';
import { clamp, relation, valuesFor } from './society.ts';
import { edibles } from './economy.ts';
import { emit, random, distance } from './world.ts';

// Lives move faster than the calendar: a year of age passes each season, so a child born
// in spring comes of age about three and a half in-game years later, and elders do not live forever.
export const SEASON_MINUTES = DAYS_PER_SEASON * 1440;
export const ADULT_AGE = 14, ELDER_AGE = 60;
export const ageOf = (r: Resident, minute: number) => (minute - r.born) / SEASON_MINUTES;
export type Stage = 'child' | 'adult' | 'elder';
export const stageOf = (r: Resident, minute: number): Stage => { const a = ageOf(r, minute); return a < ADULT_AGE ? 'child' : a >= ELDER_AGE ? 'elder' : 'adult'; };
export const isChild = (w: WorldState, r: Resident) => stageOf(r, w.minute) === 'child';
function hash(text: string) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; }
// Founders and newcomers arrive as adults of every age, from twenty to their mid-sixties.
export const arrivalAge = (id: string) => 20 + Math.floor(hash(`${id}:age`) * 45);

// How far apart two people's values are, from 0 (alike) to 6 (opposite on everything).
export const valueGap = (a: Resident, b: Resident) => (['nature', 'sharing', 'industry'] as Value[]).reduce((s, v) => s + Math.abs(a.values[v] - b.values[v]), 0);
export const sharpestDifference = (a: Resident, b: Resident): Value => (['nature', 'sharing', 'industry'] as Value[]).sort((x, y) => Math.abs(b.values[y] - a.values[y]) - Math.abs(b.values[x] - a.values[x]))[0];

// Children help with light work and play; everything else waits until they come of age.
const childKinds = new Set<ActionKind>(['rest', 'eat', 'play', 'socialize', 'share', 'club', 'farm', 'gather', 'plant', 'build']);
export function childMay(w: WorldState, a: AgentAction) {
  if (!childKinds.has(a.kind)) return false;
  if (a.kind === 'gather') { const n = w.nodes.find(n => n.id === a.target); return !!n && (n.kind === 'bush' || n.kind === 'fish'); }
  return true;
}
export const household = (w: WorldState, r: Resident) => w.residents.filter(o => o.id !== r.id && o.home === r.home && !isChild(w, o));
// A hungry child eats from whoever at home has the most.
export function feeder(w: WorldState, r: Resident) { return [...household(w, r)].sort((a, b) => edibles(b) - edibles(a)).find(o => edibles(o) > 0); }
export const relatives = (w: WorldState, a: Resident, b: Resident) => !!(a.parents?.includes(b.id) || b.parents?.includes(a.id) || (a.parents && b.parents && a.parents.some(p => b.parents!.includes(p))));

export function canCourt(w: WorldState, r: Resident, t?: Resident): string | null {
  if (!t || t.id === r.id || distance(t.position, r.position) > 12) return 'They are not nearby.';
  if (hourOf(w.minute) < 8 || hourOf(w.minute) >= 21) return 'Not at this hour.';
  if (ageOf(r, w.minute) < 18 || ageOf(t, w.minute) < 18 || r.partner || t.partner || relatives(w, r, t)) return 'Not a possible match.';
  if (w.minute - (r.lastCourted ?? -99999) < 2880) return 'Give it time.';
  const mine = r.relationships[t.id], theirs = t.relationships[r.id];
  return mine && theirs && mine.warmth >= 60 && theirs.warmth >= 45 && mine.interactions >= 8 ? null : 'The feeling is not there yet.';
}
export function court(w: WorldState, r: Resident, t: Resident): WorldEvent[] {
  r.lastCourted = w.minute;
  const theirs = t.relationships[r.id]?.warmth || 0, likeness = 1 - valueGap(r, t) / 6;
  const yes = random(w) < Math.max(.1, Math.min(.9, .2 + (theirs - 45) / 100 + likeness * .35));
  if (!yes) {
    const rel = relation(r, t.id); rel.warmth = clamp(rel.warmth - 8); rel.note = `Day ${dayOf(w.minute)}: ${t.name} turned me down`;
    return [emit(w, 'life', `${t.name} gently turned ${r.name} down`, `${r.name} asked ${t.name} to share a life together. ${t.name} was not ready for that.`, [r.id, t.id], r.position, [], 6)];
  }
  r.partner = t.id; t.partner = r.id;
  for (const [a, b] of [[r, t], [t, r]]) { const rel = relation(a, b.id); rel.warmth = clamp(rel.warmth + 10); rel.trust = clamp(rel.trust + 10); }
  // Someone who quietly hoped for this themselves may take it hard.
  for (const o of w.residents) for (const [loved, rival] of [[r, t], [t, r]]) {
    if (o.id === r.id || o.id === t.id || o.partner || (o.relationships[loved.id]?.warmth || 0) < 75) continue;
    const rel = relation(o, rival.id); rel.warmth = clamp(rel.warmth - 6); rel.note = `Day ${dayOf(w.minute)}: felt a pang when ${rival.name} and ${loved.name} paired up`;
  }
  const moved = moveIn(w, r, t);
  return [emit(w, 'life', `${r.name} and ${t.name} are partners now`, `${r.name} asked and ${t.name} said yes.${moved ? ` ${moved}` : ' For now they keep their own homes.'}`, [r.id, t.id], r.position, [], 9)];
}
export function moveIn(w: WorldState, a: Resident, b: Resident): string | null {
  if (a.home === b.home) return null;
  const room = (id: string) => { const home = w.buildings.find(x => x.id === id); return home ? (home.capacity || home.blocks?.filter(x => x.kind === 'bed').length || 3) - w.residents.filter(x => x.home === id && !isChild(w, x)).length : 0; };
  const [mover, host] = room(b.home) > 0 ? [a, b] : room(a.home) > 0 ? [b, a] : [null, null];
  if (!mover || !host) return null;
  mover.home = host.home; for (const c of w.residents.filter(c => c.parents?.includes(mover.id) && isChild(w, c) && room(host.home) > 0)) c.home = host.home;
  return `${mover.name} moved into ${w.buildings.find(x => x.id === host.home)?.name}.`;
}
const childNames = ['Wynn', 'Pim', 'Juniper', 'Oak', 'Linden', 'Merle', 'Tansy', 'Brook', 'Ember', 'Clover', 'Sorrel', 'Heath', 'Ren', 'Poppy', 'Moor', 'Aster', 'Quill', 'Fennel', 'Birch', 'Maple', 'Tam', 'Lark', 'Nettle', 'Wren', 'Isla', 'Arlo', 'Nia', 'Otto', 'Bram', 'Elm', 'Kestrel', 'Mira'];
const blend = (a: string, b: string) => '#' + [1, 3, 5].map(i => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, '0')).join('');
export function birth(w: WorldState, a: Resident, b: Resident): { child: Resident; event: WorldEvent } {
  const id = `child-${w.sequence + 1}`, taken = new Set([...w.residents.map(r => r.name), ...w.departed.map(d => d.name)]);
  const name = childNames.map((_, i) => childNames[(Math.floor(hash(id) * childNames.length) + i) % childNames.length]).find(n => !taken.has(n)) || `${a.name.slice(0, 2)}${b.name.slice(-2)}`;
  const pool = [...new Set([...a.traits, ...b.traits])], traits = [...new Set([pool[Math.floor(hash(`${id}:t1`) * pool.length)], pool[Math.floor(hash(`${id}:t2`) * pool.length)]])];
  // Values start between the parents'. Whom the child spends time with moves them from there.
  const values = valuesFor(id, [], ''); for (const v of ['nature', 'sharing', 'industry'] as Value[]) values[v] = Math.round(Math.max(-1, Math.min(1, (a.values[v] + b.values[v]) / 2 + values[v])) * 100) / 100;
  const child: Resident = {
    id, name, role: 'Child', bio: `Born on Day ${dayOf(w.minute)} to ${a.name} and ${b.name}.`, traits, ambition: 'Grow up and find my place in the village.', color: blend(a.color, b.color), values,
    position: { ...a.position }, home: a.home, inventory: { food: 0, preserves: 0, wood: 0, stone: 0, tools: 0, coins: 0, clay: 0, reeds: 0, brick: 0, pots: 0, baskets: 0 }, needs: { hunger: 10, energy: 90, social: 80 },
    skills: { farming: 1, crafting: 1, exploring: 1 }, relationships: { [a.id]: { warmth: 70, trust: 50, interactions: 1 }, [b.id]: { warmth: 70, trust: 50, interactions: 1 } }, memories: [], plan: 'Play and learn.', task: null,
    nextDecision: w.minute + 30, lastReason: 'Just born.', promises: [], lastPlanDay: dayOf(w.minute), lastReflectionDay: dayOf(w.minute), lastSocial: {}, lastAction: null, hungryDays: 0, arrived: w.minute, lastAsked: {},
    pantryNet: 0, lastGave: {}, treeDebt: 0, seasonGiven: 0, lastProposed: -99999, born: w.minute, parents: [a.id, b.id], practice: {}, knows: {}, tries: {},
  };
  for (const p of [a, b]) { const rel = relation(p, id); rel.warmth = 80; rel.trust = 50; }
  w.residents.push(child);
  return { child, event: emit(w, 'life', `${a.name} and ${b.name} had a child`, `${name} was born in ${w.buildings.find(x => x.id === a.home)?.name || 'the village'} on a ${seasonOf(w.minute)} day.`, [a.id, b.id, id], a.position, [], 9) };
}
// Whatever a child did most, and what they value, decides what they become.
const practiceRoles: [ActionKind, string][] = [['farm', 'Grower'], ['gather', 'Forager'], ['plant', 'Gardener'], ['share', 'Storykeeper'], ['build', 'Carpenter']];
export function comingOfAge(w: WorldState, r: Resident): WorldEvent {
  const p = r.practice || {}, parents = w.residents.filter(o => r.parents?.includes(o.id));
  const scores: Record<string, number> = { Naturalist: r.values.nature * 6, Trader: -r.values.sharing * 5, Stonemason: r.values.industry * 5, Wanderer: (p.play || 0) * .15, Cook: r.values.sharing * 3 };
  for (const [kind, role] of practiceRoles) scores[role] = (scores[role] || 0) + (p[kind] || 0);
  for (const parent of parents) scores[parent.role] = (scores[parent.role] || 0) + 2;
  const [role] = Object.entries(scores).sort((x, y) => y[1] - x[1])[0], top = practiceRoles.filter(([k]) => p[k]).sort((x, y) => (p[y[0]] || 0) - (p[x[0]] || 0))[0];
  r.role = role; r.ambition = `Make a life here as a ${role.toLowerCase()}.`; r.plan = r.ambition;
  r.skills = { farming: 1 + Math.min(3, (p.farm || 0) * .1), crafting: 1 + Math.min(2, (p.build || 0) * .1), exploring: 1 + Math.min(2, (p.play || 0) * .05) };
  r.inventory.coins += 4; r.bio = `${r.bio} Came of age on Day ${dayOf(w.minute)}.`;
  return emit(w, 'life', `${r.name} came of age`, `${r.name} is grown now${top ? `, after a childhood spent mostly ${({ farm: 'in the fields', gather: 'foraging', plant: 'planting trees', share: 'listening to and retelling stories', build: 'helping on building sites' } as Record<string, string>)[top[0]]}` : ''}, and takes up life as a ${role.toLowerCase()}.`, [r.id, ...(r.parents || [])], r.position, [], 8);
}
// Children take on the values of the people they spend time with.
export function influence(w: WorldState, a: Resident, b: Resident) {
  for (const [child, other] of [[a, b], [b, a]]) if (isChild(w, child)) for (const v of ['nature', 'sharing', 'industry'] as Value[]) child.values[v] = Math.round((child.values[v] + (other.values[v] - child.values[v]) * .04) * 1000) / 1000;
}
// The chance of dying on a given day rises gently after sixty, and sharply with hunger.
export const deathChance = (w: WorldState, r: Resident) => Math.max(0, (ageOf(r, w.minute) - 58) * .0015) + (stageOf(r, w.minute) === 'elder' ? r.hungryDays * .05 : 0);
