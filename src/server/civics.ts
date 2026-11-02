import { normBook, normIds, type NormId, type Proposal } from '../shared/norms.ts';
import type { AgentAction, Deed, Resident, Value, WorldEvent, WorldState } from '../shared/types.ts';
import { dayOf, hourOf, seasonDay } from '../shared/types.ts';
import { clamp, relation } from './society.ts';
import { emit } from './world.ts';

// Proposals are heard at the gathering oak. Anyone may speak for or against for one day;
// a rule passes with more voices for than against and enough people speaking for it.
export const hallDoor = (w: WorldState) => ({ ...(w.buildings.find(b => b.kind === 'hall')?.door || { x: 40, y: 41 }) });
export const adopted = (w: WorldState, id: NormId) => w.norms.find(n => n.id === id);
export const openProposals = (w: WorldState) => w.proposals.filter(p => p.status === 'open');
const scaled = (tags: Partial<Record<Value, number>>, k: number) => Object.fromEntries(Object.entries(tags).map(([v, n]) => [v, (n || 0) * k])) as Partial<Record<Value, number>>;
const names = (w: WorldState, ids: string[]) => ids.map(id => w.residents.find(r => r.id === id)?.name).filter(Boolean).join(', ') || 'no one';
// How strongly a resident's values favor a rule: positive means they would want it.
export function leaning(r: Resident, id: NormId) { return Object.entries(normBook[id].tags).reduce((sum, [k, v]) => sum + (v || 0) * r.values[k as Value], 0); }
export function signal(w: WorldState, id: NormId, text: string) { w.signals[id] = { day: dayOf(w.minute), text }; }
// Something recent that makes a rule feel necessary. Without it, only strong convictions propose.
export function evidence(w: WorldState, id: NormId): string | null {
  const s = w.signals[id]; if (s && dayOf(w.minute) - s.day <= 4) return s.text;
  const stumps = w.nodes.filter(n => n.stage === 'stump').length, pantry = w.stocks.food + w.stocks.preserves;
  if (id === 'replant' && stumps >= 6) return `${stumps} stumps stand where trees were felled.`;
  if (id === 'rest-day' && seasonDay(w.minute) >= 5) return 'The season is nearly over and the work has not let up.';
  if (id === 'give-each-season' && pantry < w.residents.length * 2) return `The pantry is down to ${pantry} food.`;
  return null;
}
export function canPropose(w: WorldState, r: Resident, id: NormId, repeal = false): string | null {
  if (hourOf(w.minute) < 8 || hourOf(w.minute) >= 19) return 'Proposals are heard at the oak during the day.';
  if (w.minute - (r.lastProposed ?? -99999) < 2880) return 'You put something to the village recently.';
  // One question at a time, with a breather between them, so each one gets the village's attention.
  if (w.proposals.some(p => p.status === 'open' || w.minute - p.opened < 2 * 1440)) return 'The village is still talking over the last proposal.';
  if (w.proposals.some(p => p.norm === id && p.repeal === repeal && p.status === 'rejected' && w.minute - p.closes < 5 * 1440)) return 'The village turned this down recently.';
  // A decision stands for a while: a rule just dropped cannot come straight back, nor a new rule be dropped at once.
  if (!repeal && w.proposals.some(p => p.norm === id && p.repeal && p.status === 'adopted' && w.minute - p.closes < 7 * 1440)) return 'The village dropped that rule recently.';
  const lean = leaning(r, id), rule = adopted(w, id);
  if (repeal) return rule && dayOf(w.minute) - rule.adoptedDay >= 7 && lean <= -.3 && rule.breaches >= 3 ? null : 'Only a rule that keeps being broken, and that you disagree with, can be put up for repeal.';
  if (rule) return 'That is already a village rule.';
  // Rules answer something that happened. Conviction alone is not enough.
  return lean > .15 && evidence(w, id) ? null : 'Nothing has made that rule matter yet.';
}
export function validVote(w: WorldState, r: Resident, a: AgentAction): string | null {
  const p = w.proposals.find(p => String(p.id) === a.target && p.status === 'open');
  if (!p || (a.stance !== 'for' && a.stance !== 'against')) return 'There is no such proposal under discussion.';
  if (p.for.includes(r.id) || p.against.includes(r.id)) return 'You have already spoken on this.';
  return hourOf(w.minute) < 7 || hourOf(w.minute) >= 21 ? 'The oak is quiet at night.' : null;
}
export function civicOptions(w: WorldState, r: Resident): AgentAction[] {
  const proposals = [...normIds.map(id => ({ id, repeal: false })), ...w.norms.map(n => ({ id: n.id, repeal: true }))]
    .filter(({ id, repeal }) => !canPropose(w, r, id, repeal)).sort((a, b) => Math.abs(leaning(r, b.id)) - Math.abs(leaning(r, a.id))).slice(0, 2)
    .map(({ id, repeal }) => ({ kind: 'propose' as const, target: id, ...(repeal ? { repeal } : {}), reason: repeal ? `Ask the village to drop “${normBook[id].text}”` : `Propose “${normBook[id].text}”` }));
  const votes = openProposals(w).flatMap(p => (['for', 'against'] as const).map(stance => ({ kind: 'vote' as const, target: String(p.id), stance, reason: `Speak ${stance} “${normBook[p.norm].text}”.` })));
  return [...proposals, ...votes].filter(a => a.kind === 'propose' || !validVote(w, r, a));
}
// Tell everyone: proposals and decisions are posted on the board beneath the oak.
function announce(w: WorldState, e: WorldEvent, importance: number) {
  for (const r of w.residents) if (!e.observers.includes(r.id)) r.memories.push({ id: `notice-${e.id}`, minute: w.minute, text: `Posted at the oak: ${e.title}. ${e.detail}`, importance, eventIds: [e.id], kind: 'observation' });
}
export function propose(w: WorldState, r: Resident, a: AgentAction, speech: string): WorldEvent[] {
  const id = a.target as NormId, book = normBook[id], repeal = !!a.repeal, why = repeal ? `It has been broken ${adopted(w, id)?.breaches || 0} times.` : evidence(w, id);
  r.lastProposed = w.minute;
  const e = emit(w, 'civic', `${r.name} proposed ${repeal ? 'dropping a village rule' : 'a village rule'}`, `${r.name}: “${speech}” The proposal: ${repeal ? 'drop ' : ''}“${book.text}”${why ? ` (${why.replace(/\.$/, '')})` : ''}. Anyone may speak for or against it at the gathering oak until this time tomorrow.`, [r.id], r.position, [], 8,
    { actor: r.id, tags: scaled(book.tags, repeal ? -.4 : .4), summary: `${r.name} proposed ${repeal ? 'dropping ' : ''}the rule “${book.text}”` });
  w.proposals.push({ id: e.id, norm: id, repeal, proposedBy: r.id, opened: w.minute, closes: w.minute + 1440, for: [r.id], against: [], status: 'open' });
  announce(w, e, 7); return [e];
}
export function vote(w: WorldState, r: Resident, a: AgentAction, speech: string): WorldEvent[] {
  const p = w.proposals.find(p => String(p.id) === a.target && p.status === 'open')!, book = normBook[p.norm], support = a.stance === 'for';
  (support ? p.for : p.against).push(r.id);
  // Speaking up is itself a deed: neighbors judge where you stand by what they value.
  const e = emit(w, 'civic', `${r.name} spoke ${a.stance} ${p.repeal ? 'dropping ' : ''}“${book.text}”`, `${r.name}: “${speech}” So far ${p.for.length} for, ${p.against.length} against.`, [r.id], r.position, [p.id], 4,
    { actor: r.id, tags: scaled(book.tags, (support ? .3 : -.3) * (p.repeal ? -1 : 1)), summary: `${r.name} spoke ${a.stance} ${p.repeal ? 'dropping ' : ''}“${book.text}”` });
  if (p.proposedBy !== r.id) for (const [x, y] of [[r.id, p.proposedBy], [p.proposedBy, r.id]]) { const from = w.residents.find(o => o.id === x); if (from) { const rel = relation(from, y); rel.warmth = clamp(rel.warmth + (support ? 2 : -1)); } }
  const out = [e]; if (p.for.length + p.against.length >= w.residents.length) out.push(resolve(w, p)); return out;
}
function resolve(w: WorldState, p: Proposal): WorldEvent {
  const book = normBook[p.norm], quorum = Math.max(3, Math.ceil(w.residents.length / 4)), passed = p.for.length > p.against.length && p.for.length >= quorum;
  p.status = passed ? 'adopted' : 'rejected';
  if (passed && !p.repeal) w.norms.push({ id: p.norm, adoptedDay: dayOf(w.minute), proposedBy: p.proposedBy, supporters: [...p.for], opponents: [...p.against], breaches: 0, eventId: p.id });
  if (passed && p.repeal) w.norms = w.norms.filter(n => n.id !== p.norm);
  // Losing a vote stings, mostly toward whoever raised it.
  if (passed) for (const id of p.against) { const o = w.residents.find(r => r.id === id); if (o && id !== p.proposedBy) { const rel = relation(o, p.proposedBy); rel.warmth = clamp(rel.warmth - 2); } }
  const tally = `${p.for.length} for (${names(w, p.for)}), ${p.against.length} against (${names(w, p.against)}).`;
  const title = passed ? (p.repeal ? 'The village dropped a rule' : 'The village adopted a rule') : `The village turned down ${p.repeal ? 'dropping a rule' : 'a proposed rule'}`;
  const e = emit(w, 'civic', title, `“${book.text}” ${tally}${!passed && p.for.length > p.against.length ? ` Too few spoke for it; ${quorum} were needed.` : ''}`, [p.proposedBy], hallDoor(w), [p.id], 9);
  announce(w, e, 8);
  const closed = w.proposals.filter(x => x.status !== 'open'); if (closed.length > 30) w.proposals = w.proposals.filter(x => x.status === 'open' || closed.indexOf(x) >= closed.length - 30);
  return e;
}
export function resolveProposals(w: WorldState): WorldEvent[] { return openProposals(w).filter(p => p.closes <= w.minute).map(p => resolve(w, p)); }
// Breaking an adopted rule is a judged deed, at most once per person, rule and day.
const lastBreach = new WeakMap<WorldState, Map<string, number>>();
export function breach(w: WorldState, r: Resident, id: NormId, detail: string): WorldEvent | null {
  const rule = adopted(w, id); if (!rule) return null;
  const seen = lastBreach.get(w) || new Map<string, number>(); lastBreach.set(w, seen);
  const key = `${r.id}:${id}`; if (seen.get(key) === dayOf(w.minute)) return null; seen.set(key, dayOf(w.minute));
  rule.breaches++;
  const book = normBook[id], deed: Deed = { actor: r.id, tags: scaled(book.tags, -.6), summary: `${r.name} ${book.breach}`, norm: id };
  return emit(w, 'civic', `${r.name} broke a village rule`, `${detail} The village agreed on Day ${rule.adoptedDay}: “${book.text}”`, [r.id], r.position, [rule.eventId], 7, deed);
}
