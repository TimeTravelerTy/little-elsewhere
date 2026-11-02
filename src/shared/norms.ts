import type { Value } from './types';
// Rules residents can propose. Adopting one never blocks an action; it turns breaking the rule
// into a deed that neighbors judge, most harshly those who voted for it.
export type NormId = 'spare-elders' | 'replant' | 'pantry-need' | 'no-hoarding' | 'fair-prices' | 'rest-day' | 'give-each-season';
export type Norm = { id: NormId; adoptedDay: number; proposedBy: string; supporters: string[]; opponents: string[]; breaches: number; eventId: number };
export type Proposal = { id: number; norm: NormId; repeal: boolean; proposedBy: string; opened: number; closes: number; for: string[]; against: string[]; status: 'open' | 'adopted' | 'rejected' };
export const normBook: Record<NormId, { text: string; tags: Partial<Record<Value, number>>; breach: string }> = {
  'spare-elders': { text: 'Leave the elder oaks standing.', tags: { nature: 1 }, breach: 'cut an elder oak' },
  replant: { text: 'Whoever fells a tree plants one.', tags: { nature: .7, industry: .2 }, breach: 'felled a tree without planting one' },
  'pantry-need': { text: 'Draw food from the pantry only when you have little.', tags: { sharing: .8 }, breach: 'took pantry food while well stocked' },
  'no-hoarding': { text: 'No one keeps a full larder while a neighbor goes hungry.', tags: { sharing: 1 }, breach: 'kept a full larder while a neighbor went hungry' },
  'fair-prices': { text: 'Sell near the going rate, never far above it.', tags: { sharing: .6, industry: -.2 }, breach: 'sold far above the going rate' },
  'rest-day': { text: 'The last day of each season is a day of rest.', tags: { industry: -.8, sharing: .2 }, breach: 'worked through the rest day' },
  'give-each-season': { text: 'Everyone gives something to the pantry each season.', tags: { sharing: .7, industry: .3 }, breach: 'gave nothing to the pantry all season' },
};
export const normIds = Object.keys(normBook) as NormId[];
export const isNormId = (id: unknown): id is NormId => typeof id === 'string' && Object.hasOwn(normBook, id);
