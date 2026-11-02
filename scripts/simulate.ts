// Fast routine-only run that prints the daily emergence signals. Useful for tuning balance.
// Usage: node --import tsx scripts/simulate.ts [days=56] [seed=4217]
import { advance, createWorld, routine, startAction } from '../src/server/world.ts';
import { dayOf } from '../src/shared/types.ts';
import { methodOf, placeCapabilities } from '../src/shared/construction.ts';
import { techniqueIds, knowsHow } from '../src/shared/making.ts';
const days = Number(process.argv[2] || 56), seed = Number(process.argv[3] || 4217), w = createWorld(seed);
const notable: string[] = []; const started = Date.now(); const kinds: Record<string, number> = {}; const actions: Record<number, Record<string, number>> = {};
while (dayOf(w.minute) <= days) {
  for (const r of w.residents) if (!r.task && r.nextDecision <= w.minute) startAction(w, r, routine(w, r));
  const day = dayOf(w.minute); actions[day] = { ...w.dayActions } as Record<string, number>;
  for (const e of advance(w, 2)) { kinds[e.kind] = (kinds[e.kind] || 0) + 1; if (e.kind === 'discovery' && !/explored|on the map/.test(e.title) || /taught|leak|crumbled|No one left|lost|re-roofed|rebuilt|repaired/.test(e.title)) notable.push(`d${dayOf(e.minute)} ${e.title}`); }
}
console.log('day season  pop pantry total trees stumps  food wood stone  gini warmth neg strong variety trades gifts cold hungry harvest spoiled | actions');
for (const h of w.history) console.log([h.day, h.season.padEnd(6), h.population, h.pantryFood, h.totalFood, h.trees, h.stumps, h.prices.food, h.prices.wood, h.prices.stone, h.wealthGini, h.meanWarmth, h.negativeTies, h.strongTies, h.actionVariety, h.trades, h.gifts, h.coldHomes, h.hungry, h.harvest, h.spoiled].map(v => String(v).padStart(5)).join(' ') + '  ' + JSON.stringify(actions[h.day] || {}));
console.log('events', kinds, 'departed', w.departed.map(d => d.name), 'projects', w.projects.map(p => p.name + (p.complete ? ' ✓' : '')).join(', '));
console.log('inventories', w.residents.map(r => `${r.name}:${r.inventory.food}f/${r.inventory.preserves}p/${r.inventory.wood}w/${r.inventory.coins}c`).join(' '));
console.log(`${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log('places', w.buildings.filter(b => b.kind === 'place').map(b => `${b.name} [${placeCapabilities(b).join('+')}; ${methodOf(b.blocks || [])}]`).join(' | '));
console.log('extensions', w.projects.filter(p => p.extension).map(p => `${p.name}${p.complete ? ' ✓' : ` ${p.labor}/${p.requiredLabor}`}`).join(' | ') || 'none', 'capacity', w.capacity);
console.log('rules', w.norms.map(n => `${n.id} (day ${n.adoptedDay}, ${n.supporters.length}-${n.opponents.length}, broken ${n.breaches})`).join(' | ') || 'none');
console.log('proposals', w.proposals.map(p => `${p.repeal ? 'drop ' : ''}${p.norm}:${p.status} ${p.for.length}-${p.against.length}`).join(' | '));
const alive = w.residents.map(r => `${r.name}(${Math.floor((w.minute - r.born) / (7 * 1440))}${r.role === 'Child' ? ' child' : ''}${r.partner ? ' ♥' + w.residents.find(o => o.id === r.partner)?.name : ''})`).join(' ');
console.log('residents', alive);
console.log('died', w.departed.filter(d => d.died).map(d => `${d.name} at ${d.age}`).join(', ') || 'none', '| left', w.departed.filter(d => !d.died).map(d => d.name).join(', ') || 'none');
console.log('legends', w.legends.map(l => l.title).join(' | ') || 'none');
console.log('traditions', w.traditions.map(t => `${t.name} (day ${t.seasonDay}, kept ${t.kept}${t.faded ? ', faded' : ''})`).join(' | ') || 'none');
console.log('know-how', techniqueIds.map(t => `${t}: ${w.residents.filter(r => knowsHow(r, t)).length} know${w.discoveries[t] ? ` (first day ${w.discoveries[t]!.day})` : ''}`).join(' | '));
console.log('made', ['brick', 'pots', 'baskets', 'clay', 'reeds'].map(g => `${g} ${w.residents.reduce((s, r) => s + r.inventory[g as 'brick'], 0)}`).join(', '), '| repairs', w.history.length && Object.entries(kinds).length ? notable.filter(n => /repaired|re-roofed|rebuilt/.test(n)).length + ' | worn through ' + notable.filter(n => /leak|crumbled/.test(n)).length : 0);
console.log('notable', notable.filter(n => !/taught| too$/.test(n)).slice(0, 40).join(' · '));
console.log('top tales', Object.values(w.tales).sort((a, b) => b.retellings - a.retellings).slice(0, 6).map(t => `${t.retellings}× ${t.text.slice(0, 70)}`).join(' | '));
