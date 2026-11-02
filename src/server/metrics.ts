import type { DayStats, Goods, WorldState } from '../shared/types.ts';
import { dayOf, seasonOf } from '../shared/types.ts';
import { edibles, goods, wealth } from './economy.ts';
import { isTree } from './nature.ts';
import { knowsHow, techniqueIds } from '../shared/making.ts';
import { weathers } from '../shared/construction.ts';

// Simple, inspectable signals that tell an observer whether the town is getting more varied
// or settling into a rut. They describe the village; they never steer residents.
export function gini(values: number[]) {
  const xs = values.filter(v => v >= 0).sort((a, b) => a - b), n = xs.length, total = xs.reduce((a, b) => a + b, 0);
  if (n < 2 || total <= 0) return 0;
  return Math.round(xs.reduce((sum, x, i) => sum + (2 * (i + 1) - n - 1) * x, 0) / (n * total) * 100) / 100;
}
export function variety(counts: Partial<Record<string, number>>) {
  const values = Object.values(counts).filter((n): n is number => !!n), total = values.reduce((a, b) => a + b, 0);
  if (values.length < 2) return 0;
  const entropy = -values.reduce((sum, n) => sum + n / total * Math.log(n / total), 0);
  return Math.round(entropy / Math.log(22) * 100) / 100;
}
export function dayStats(w: WorldState): DayStats {
  const ties = w.residents.flatMap(r => Object.entries(r.relationships).filter(([id]) => w.residents.some(o => o.id === id)).map(([, rel]) => rel.warmth));
  return {
    day: dayOf(w.minute - 1), season: seasonOf(w.minute - 1), population: w.residents.length, pantryFood: w.stocks.food + w.stocks.preserves,
    totalFood: w.stocks.food + w.stocks.preserves + w.residents.reduce((sum, r) => sum + edibles(r), 0),
    trees: w.nodes.filter(n => isTree(n) && n.stage === 'mature').length, stumps: w.nodes.filter(n => n.stage === 'stump').length,
    prices: Object.fromEntries(goods.map(g => [g, w.market[g].price])) as Partial<Record<Goods, number>>,
    wealthGini: gini(w.residents.map(r => wealth(w, r))), meanWarmth: ties.length ? Math.round(ties.reduce((a, b) => a + b, 0) / ties.length) : 0,
    negativeTies: ties.filter(v => v < 0).length, strongTies: ties.filter(v => v >= 60).length, actionVariety: variety(w.dayActions),
    trades: w.dayActions.trade || 0, gifts: (w.dayActions.gift || 0), coldHomes: w.buildings.filter(b => b.cold).length, hungry: w.residents.filter(r => r.needs.hunger >= 80).length, harvest: w.farm.harvested, spoiled: 0, rules: w.norms.length, births: w.residents.filter(r => r.born > w.minute - 1441 && r.parents).length, deaths: w.departed.filter(d => d.died && d.minute > w.minute - 1441).length,
    knowhow: w.residents.reduce((sum, r) => sum + techniqueIds.filter(t => knowsHow(r, t)).length, 0), worn: w.buildings.reduce((sum, b) => sum + (b.blocks || []).filter(x => weathers(x) && (x.wear || 0) >= 1).length, 0), legends: w.legends.length,
  };
}
