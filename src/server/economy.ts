import type { AgentAction, Goods, Resident, Season, WorldState } from '../shared/types.ts';
import { seasonOf } from '../shared/types.ts';
import { buildGoods, type BuildGood } from '../shared/construction.ts';
import { knowsHow } from '../shared/making.ts';

// Prices are not set by the village. Each resident values goods by season, need and trade,
// and a deal happens only when a buyer's valuation meets a seller's asking price.
export const goods: Goods[] = ['food', 'preserves', 'wood', 'stone', 'tools', 'clay', 'reeds', 'brick', 'pots', 'baskets'];
export const basePrice: Record<Goods, number> = { food: 2, preserves: 3, wood: 2, stone: 3, tools: 9, clay: 1, reeds: 1, brick: 3, pots: 5, baskets: 5 };
const seasonalDemand: Record<Season, Partial<Record<Goods, number>>> = {
  spring: { food: 1.25, preserves: 1.2 }, summer: { food: .8 }, autumn: { food: .8, wood: 1.4, preserves: 1.1 }, winter: { food: 1.7, preserves: 1.5, wood: 1.9 },
};
const roleNeeds: Record<string, Partial<Record<Goods, number>>> = {
  Carpenter: { wood: 1.35 }, Stonemason: { stone: 1.4 }, Tinkerer: { wood: 1.2, stone: 1.2, tools: 1.2 }, Baker: { food: 1.2 }, Cook: { food: 1.2 }, Trader: { tools: 1.1 },
};
// What the village's unfinished projects still need of a building material.
export const projectDemand = (w: WorldState, g: BuildGood) => w.projects.filter(p => !p.complete).reduce((sum, p) => sum + Math.max(0, (p.requires[g] || 0) - (p.supplied[g] || 0)), 0);
// The amount a resident wants to keep on hand. Winter raises the bar for food and firewood.
// Clay, reeds and brick are wanted only by people who can use them: builders with work waiting, or makers who know how.
export function comfort(r: Resident, g: Goods, season: Season, w?: WorldState): number {
  if (g === 'clay') return Math.max(knowsHow(r, 'firing') ? 6 : 0, builds(r) && w ? Math.min(8, projectDemand(w, g)) : 0);
  if (g === 'reeds') return Math.max(knowsHow(r, 'weaving') ? 3 : 0, builds(r) && w ? Math.min(8, projectDemand(w, g)) : 0);
  if (g === 'brick') return builds(r) && w ? Math.min(10, projectDemand(w, g)) : 0;
  if (g === 'pots') return season === 'autumn' || season === 'winter' ? 3 : 2;
  if (g === 'food') return season === 'autumn' ? 14 : season === 'winter' ? 10 : 6;
  if (g === 'preserves') return season === 'autumn' ? 10 : season === 'winter' ? 6 : season === 'summer' ? 4 : 2;
  if (g === 'wood') return (season === 'winter' ? 8 : season === 'autumn' ? 6 : 3) + (['Carpenter', 'Tinkerer'].includes(r.role) ? 3 : 0);
  if (g === 'stone') return 2 + (['Stonemason', 'Tinkerer'].includes(r.role) ? 3 : 0);
  return 1;
}
export const builds = (r: Resident) => ['Carpenter', 'Stonemason'].includes(r.role) || r.values.industry > .3;
export const edibles = (r: Resident) => r.inventory.food + r.inventory.preserves;
// Wood and stone are heavy. Past this, a resident must put some down before gathering more.
export const CARRY = 30;
export const bulk = (r: Resident) => buildGoods.reduce((sum, g: BuildGood) => sum + r.inventory[g], 0);
export function valuation(r: Resident, g: Goods, season: Season, holding = r.inventory[g], w?: WorldState) {
  const need = Math.max(.35, Math.min(3, (comfort(r, g, season, w) + 2) / (holding + 2)));
  return basePrice[g] * (seasonalDemand[season][g] ?? 1) * need * (roleNeeds[r.role]?.[g] ?? 1);
}
export const margin = (r: Resident) => r.traits.some(t => ['shrewd', 'competitive'].includes(t)) ? .35 : r.traits.some(t => ['generous', 'warm'].includes(t)) ? .05 : .18;

export type Quote = { price: number; quantity: number; surplus: number };
// A per-unit price both sides accept. Quantity stops before the seller dips below their comfort.
export function quote(w: WorldState, buyer: Resident, seller: Resident, g: Goods, wanted = 3): Quote | null {
  const season = seasonOf(w.minute), spare = seller.inventory[g] - (g === 'tools' ? 1 : Math.ceil(comfort(seller, g, season, w) / 2));
  // People buy what they need; traders may also stock up to twice that to sell on.
  const room = Math.min(comfort(buyer, g, season, w) * (buyer.role === 'Trader' ? 2 : 1) - buyer.inventory[g], buildGoods.includes(g as BuildGood) ? CARRY - bulk(buyer) : Infinity);
  if (spare < 1 || room < 1) return null;
  const bid = valuation(buyer, g, season, buyer.inventory[g], w), ask = valuation(seller, g, season, seller.inventory[g] - 1, w) * (1 + margin(seller));
  if (bid < ask) return null;
  const price = Math.max(1, Math.round((bid + ask) / 2)), quantity = Math.min(wanted, spare, room, Math.floor(buyer.inventory.coins / price));
  return quantity >= 1 ? { price, quantity, surplus: bid - ask } : null;
}
export function bestDeal(w: WorldState, r: Resident, t: Resident): AgentAction | null {
  let best: { action: AgentAction; surplus: number } | null = null;
  for (const g of goods) for (const mode of ['buy', 'sell'] as const) {
    const q = mode === 'buy' ? quote(w, r, t, g) : quote(w, t, r, g);
    if (q && (!best || q.surplus > best.surplus)) best = { surplus: q.surplus, action: { kind: 'trade', target: t.id, item: g, quantity: q.quantity, mode, reason: `${mode === 'buy' ? 'Buy' : 'Sell'} ${g} at ${q.price} coins each.` } };
  }
  return best?.action || null;
}
export function recordPrice(w: WorldState, g: Goods, price: number, quantity: number) {
  const m = w.market[g]; m.price = Math.round((m.price * .75 + price * .25) * 100) / 100; m.trades++; m.volume += quantity;
}
// Gifts go from plenty to need; requests come from need. Neither is forced.
export function giftable(w: WorldState, r: Resident, t: Resident): Goods | null {
  const season = seasonOf(w.minute);
  return (['food', 'preserves', 'wood'] as const).find(g => r.inventory[g] > comfort(r, g, season) + 2 && (g === 'wood' ? t.inventory.wood : edibles(t)) < comfort(t, g === 'preserves' ? 'food' : g, season) / 2) || null;
}
export function wants(w: WorldState, r: Resident): Goods | null {
  const season = seasonOf(w.minute);
  if (edibles(r) < 3) return 'food';
  if (r.inventory.wood < comfort(r, 'wood', season) / 2 && (season === 'autumn' || season === 'winter')) return 'wood';
  return null;
}
export function willingness(giver: Resident, asker: Resident) {
  const rel = giver.relationships[asker.id];
  // Someone who owes the asker is more inclined to return the favor.
  return .25 + giver.values.sharing * .45 + (rel?.warmth || 0) / 200 + (rel?.trust || 0) / 300 + ((rel?.balance || 0) <= -4 ? .2 : 0);
}
export const wealth = (w: WorldState, r: Resident) => r.inventory.coins + goods.reduce((sum, g) => sum + r.inventory[g] * w.market[g].price, 0);
export const initialMarket = () => Object.fromEntries(goods.map(g => [g, { price: basePrice[g], trades: 0, volume: 0 }])) as WorldState['market'];
