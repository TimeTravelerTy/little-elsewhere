import type { Deed, Relationship, Resident, Value, WorldState } from '../shared/types.ts';
import { dayOf } from '../shared/types.ts';

// Traits become values. Values decide how an observer feels about what someone else did.
const traitValues: Record<string, Partial<Record<Value, number>>> = {
  protective: { nature: .8 }, observant: { nature: .4 }, quiet: { nature: .25 }, careful: { nature: .3, sharing: .1 }, resourceful: { nature: .3 }, grounded: { nature: .3, industry: .2 },
  practical: { nature: -.35, industry: .4 }, shrewd: { sharing: -.45 }, competitive: { sharing: -.3, industry: .3 }, impatient: { nature: -.25, industry: .2 }, bold: { nature: -.15 },
  generous: { sharing: .8 }, warm: { sharing: .5 }, diplomatic: { sharing: .35 }, idealistic: { nature: .4, sharing: .4 }, sentimental: { sharing: .3, nature: .2 }, sociable: { sharing: .3 },
  determined: { industry: .6 }, steady: { industry: .5 }, patient: { industry: .3, nature: .1 }, stubborn: { industry: .3 }, loyal: { sharing: .3, industry: .2 },
  independent: { sharing: -.35 }, restless: { industry: -.3 }, easygoing: { industry: -.3, sharing: .2 }, playful: { industry: -.2 }, curious: { nature: .2 }, optimistic: { sharing: .2 },
  inventive: { industry: .2, nature: -.1 }, cheerful: { sharing: .2 }, sensitive: { nature: .15, sharing: .15 },
};
const roleValues: Record<string, Partial<Record<Value, number>>> = {
  Naturalist: { nature: .4 }, Forager: { nature: .3 }, Carpenter: { nature: -.2, industry: .2 }, Stonemason: { industry: .2 }, Grower: { sharing: .2, nature: .2 }, Trader: { sharing: -.1, industry: .1 }, Gardener: { nature: .2 },
};
function hash(text: string) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; }
export function valuesFor(id: string, traits: string[], role: string): Record<Value, number> {
  const out = { nature: 0, sharing: 0, industry: 0 } as Record<Value, number>;
  for (const source of [...traits.map(t => traitValues[t] || {}), roleValues[role] || {}]) for (const [k, v] of Object.entries(source)) out[k as Value] += v;
  for (const k of Object.keys(out) as Value[]) out[k] = Math.round(Math.max(-1, Math.min(1, out[k] + (hash(`${id}:${k}`) - .5) * .3)) * 100) / 100;
  return out;
}
export const relation = (a: Resident, b: string): Relationship => a.relationships[b] ||= { warmth: 0, trust: 0, interactions: 0 };
export const clamp = (n: number) => Math.max(-100, Math.min(100, Math.round(n))) || 0; // `|| 0` avoids -0, which JSON would not round-trip.
// An observer's reaction is the deed weighted by what they personally care about.
export function reaction(observer: Resident, deed: Deed) { return Object.entries(deed.tags).reduce((sum, [k, v]) => sum + (v || 0) * observer.values[k as Value], 0) * 3; }
export function judge(w: WorldState, deed: Deed, observers: Resident[], strength = 1) {
  const rule = deed.norm ? w.norms.find(n => n.id === deed.norm) : undefined;
  for (const o of observers) {
    if (o.id === deed.actor || o.id === deed.recipient) continue; // A recipient's feelings come from the act itself.
    let change = reaction(o, deed) * strength;
    // A broken village rule weighs on everyone, most of all on those who voted for it.
    if (rule) change += (rule.supporters.includes(o.id) ? -3 : rule.opponents.includes(o.id) ? -.5 : -1.5) * strength;
    // Admiration has diminishing returns; someone already held dear can only rise so far.
    const before = o.relationships[deed.actor]?.warmth || 0;
    if (change > 0 && before > 0) change *= Math.max(.2, 1 - before / 120);
    change = Math.round(change); if (!change) continue;
    const rel = relation(o, deed.actor); rel.warmth = clamp(rel.warmth + change);
    if (Math.abs(change) >= 2) rel.note = `Day ${dayOf(w.minute)}: ${change > 0 ? 'appreciated' : 'disliked'} that ${deed.summary}`;
  }
}
// Talking alone warms a relationship only so far; deeds carry it further.
export const conversationWarmth = (warmth: number) => warmth < 25 ? 3 : warmth < 50 ? 2 : warmth < 70 ? 1 : 0;
export function fadeRelationships(w: WorldState) {
  for (const r of w.residents) for (const rel of Object.values(r.relationships)) { rel.warmth = Math.trunc(rel.warmth * .975) || 0; rel.trust = Math.trunc(rel.trust * .99) || 0; }
}
export function reputation(w: WorldState, r: Resident) {
  const views = w.residents.filter(o => o.id !== r.id && o.relationships[r.id]).map(o => o.relationships[r.id].warmth);
  return views.length ? Math.round(views.reduce((a, b) => a + b, 0) / views.length) : 0;
}
