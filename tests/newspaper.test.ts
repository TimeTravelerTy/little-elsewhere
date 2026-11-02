import { it, expect, vi } from 'vitest';
import { writeNewspaper } from '../src/server/newspaper.ts';
import { Intelligence } from '../src/server/ai.ts';
import { Store } from '../src/server/store.ts';
import { createWorld, emit, startAction, advance, distance } from '../src/server/world.ts';
const draft = { headline: 'A bridge opens', dek: 'Neighbors finished their crossing.', articles: [{ title: 'Across the river', body: 'The bridge is complete.', eventIds: [1] }] };
it('publishes natural prose only with valid evidence IDs and a passed grounding check', async () => {
 const store=new Store(':memory:'),ai=new Intelligence(store,undefined),w=createWorld();
 const e=emit(w,'project','Bridge complete','The bridge is complete.',[],{x:58,y:26});
 const json=vi.spyOn(ai,'json').mockResolvedValueOnce(draft).mockResolvedValueOnce({supported:true});
 try { expect(await writeNewspaper(ai,[e])).toEqual(draft); expect(json).toHaveBeenCalledTimes(2); } finally {store.close();}
});
it('rejects invented citations before asking for another paid call', async () => {
 const store=new Store(':memory:'),ai=new Intelligence(store,undefined),w=createWorld();
 const e=emit(w,'project','Bridge complete','The bridge is complete.',[],{x:58,y:26});
 const json=vi.spyOn(ai,'json').mockResolvedValue({...draft,articles:[{...draft.articles[0],eventIds:[999]}]});
 try { expect(await writeNewspaper(ai,[e])).toBeNull();expect(json).toHaveBeenCalledTimes(1); } finally {store.close();}
});
it('falls back when prose fails review or review is unavailable', async () => {
 const store=new Store(':memory:'),ai=new Intelligence(store,undefined),w=createWorld();
 const e=emit(w,'project','Bridge complete','The bridge is complete.',[],{x:58,y:26});
 vi.spyOn(ai,'json').mockResolvedValueOnce(draft).mockResolvedValueOnce({supported:false}).mockResolvedValueOnce(null).mockResolvedValueOnce(draft).mockResolvedValueOnce(null);
 try { expect(await writeNewspaper(ai,[e])).toBeNull();expect(await writeNewspaper(ai,[e])).toBeNull(); } finally {store.close();}
});
it('walks three tiles per old five-second tick without shortening work durations', () => {
 const w=createWorld(),r=w.residents[0];r.position={x:12,y:31};
 expect(startAction(w,r,{kind:'withdraw',item:'wood',reason:'Wood.'})).toBe(true);r.task!.remaining=30;
 const before={...r.position};advance(w,1/3);expect(distance(before,r.position)).toBeCloseTo(3);expect(r.task!.remaining).toBe(30);
 r.task!.route=[];advance(w,1);expect(r.task!.remaining).toBe(29);
});
