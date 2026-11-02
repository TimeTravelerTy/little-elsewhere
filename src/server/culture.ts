import type { AgentMemory, Resident, WorldEvent, WorldState } from '../shared/types.ts';
import { dayOf, seasonDay, seasonOf } from '../shared/types.ts';
import { clamp, relation } from './society.ts';
import { emit } from './world.ts';

// Nothing here decides what the village's culture is. A story becomes a legend because people
// kept retelling it; a gathering becomes a tradition because it kept happening on the same day.
export const LEGEND_RETELLINGS = 8, LEGEND_TELLERS = 4, LEGEND_IMPORTANCE = 5;
// A heard story is passed on in its original words, not as a chain of "who told whom".
export const storyText = (text: string) => text.replace(/^(?:[^:]{1,40} told me: )+/, '').replace(/^Posted at the oak: /, '');
const legendary = (m: AgentMemory) => !!m.deed || ['social', 'life', 'civic', 'discovery', 'nature'].includes(m.event || '');
export const rootEvent = (m: AgentMemory) => m.eventIds[m.eventIds.length - 1];
export function retell(w: WorldState, teller: Resident, m: AgentMemory): WorldEvent[] {
  const id = rootEvent(m); if (!id) return [];
  const tale = w.tales[id] ||= { eventId: id, text: storyText(m.text).slice(0, 240), tellers: [], retellings: 0, lastDay: dayOf(w.minute) };
  tale.retellings++; tale.lastDay = dayOf(w.minute); if (!tale.tellers.includes(teller.id)) tale.tellers.push(teller.id);
  // Legends are about people: what someone did, a life event, a quarrel or a discovery, and something that mattered at the time.
  if (!legendary(m) || m.importance < LEGEND_IMPORTANCE || tale.retellings < LEGEND_RETELLINGS || tale.tellers.length < LEGEND_TELLERS || w.legends.some(l => l.eventId === id || l.text === tale.text || l.title === tale.text.split(/\. /)[0])) return [];
  const title = tale.text.split(/\. /)[0].slice(0, 80);
  w.legends.push({ eventId: id, title, text: tale.text, day: dayOf(w.minute), tellers: [...tale.tellers], named: false, actors: m.deed ? [m.deed.actor] : [] });
  const names = tale.tellers.map(t => w.residents.find(r => r.id === t)?.name).filter(Boolean);
  return [emit(w, 'culture', 'A story became a village legend', `“${tale.text}” has now been told ${tale.retellings} times, by ${names.slice(0, 5).join(', ')}${names.length > 5 ? ' and others' : ''}.`, tale.tellers, teller.position, [id], 8)];
}
export function forgetTales(w: WorldState) {
  const legends = new Set(w.legends.map(l => l.eventId)), day = dayOf(w.minute);
  for (const [id, t] of Object.entries(w.tales)) if (!legends.has(t.eventId) && day - t.lastDay > 10) delete w.tales[id];
}
// A festival on the same day of the same season as one a year before starts a tradition.
export function gathered(w: WorldState, host: Resident, attendees: Resident[], eventId: number): WorldEvent[] {
  const day = dayOf(w.minute), sd = seasonDay(w.minute), season = seasonOf(w.minute), out: WorldEvent[] = [];
  w.gatherings.push({ day, seasonDay: sd, season, host: host.id, attendees: attendees.map(a => a.id), eventId }); if (w.gatherings.length > 120) w.gatherings.shift();
  const tradition = w.traditions.find(t => !t.faded && t.season === season && t.seasonDay === sd);
  if (tradition) {
    if (tradition.lastKept === day) return out;
    tradition.kept++; tradition.missed = 0; tradition.lastKept = day; tradition.eventIds.push(eventId); if (!tradition.hosts.includes(host.id)) tradition.hosts.push(host.id);
    // Keeping a tradition together binds the people who keep it.
    for (const a of attendees) for (const b of attendees) if (a.id !== b.id) { const rel = relation(a, b.id); rel.warmth = clamp(rel.warmth + 1); }
    out.push(emit(w, 'culture', `The village kept ${tradition.name}`, `${attendees.length} neighbors gathered, as the village has now ${tradition.kept} years running on day ${sd} of ${season}.`, attendees.map(a => a.id), host.position, [eventId], 7));
    return out;
  }
  // It only becomes a tradition if someone who was there a year ago brings people together again, once per season at most.
  const earlier = w.gatherings.find(g => g.season === season && g.seasonDay === sd && day - g.day >= 28 && (g.attendees.includes(host.id) || g.host === host.id));
  if (!earlier || w.traditions.some(t => !t.faded && t.season === season)) return out;
  const t = { id: `tradition-${season}-${sd}`, name: `The ${season} day-${sd} gathering`, season, seasonDay: sd, founded: day, hosts: [...new Set([earlier.host, host.id])], kept: 2, missed: 0, lastKept: day, named: false, eventIds: [earlier.eventId, eventId] };
  w.traditions.push(t);
  out.push(emit(w, 'culture', 'A tradition has taken root', `A year ago to the day, on day ${sd} of ${season}, the village gathered beneath the oak. Today it gathered again, and people have started to expect it.`, attendees.map(a => a.id), host.position, [earlier.eventId, eventId], 9));
  return out;
}
// Called each morning: a tradition's day that passed without a gathering counts against it.
export function tendTraditions(w: WorldState): WorldEvent[] {
  const yesterday = dayOf(w.minute) - 1, sd = seasonDay(w.minute - 1440), season = seasonOf(w.minute - 1440), out: WorldEvent[] = [];
  for (const t of w.traditions.filter(t => !t.faded && t.season === season && t.seasonDay === sd && t.lastKept !== yesterday && t.founded < yesterday)) {
    t.missed++;
    out.push(emit(w, 'culture', t.missed >= 2 ? `${t.name} has faded` : `${t.name} passed without a gathering`, t.missed >= 2 ? `Two years running its day went by unmarked. It was kept ${t.kept} times.` : 'Its day came and went. Some noticed.', t.hosts, { x: 40, y: 41 }, t.eventIds.slice(-1), t.missed >= 2 ? 7 : 5));
    if (t.missed >= 2) t.faded = true;
  }
  return out;
}
// A gathering a year ago today that has not yet become a tradition: the village may or may not remember it.
export const anniversary = (w: WorldState) => w.gatherings.find(g => g.season === seasonOf(w.minute) && g.seasonDay === seasonDay(w.minute) && dayOf(w.minute) - g.day >= 28 && dayOf(w.minute) - g.day < 56);
export const traditionToday = (w: WorldState) => w.traditions.find(t => !t.faded && t.season === seasonOf(w.minute) && t.seasonDay === seasonDay(w.minute));
