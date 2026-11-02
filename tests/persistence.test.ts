import { describe,it,expect } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store.ts';
import { createWorld,emit,startAction } from '../src/server/world.ts';
import { Intelligence } from '../src/server/ai.ts';
import { Engine } from '../src/server/engine.ts';

describe('Persistence and reporting',()=>{
  it('persists state, event sequence, accepted actions and RNG across restart',()=>{const dir=mkdtempSync(join(tmpdir(),'elsewhere-'));try{const path=join(dir,'world.sqlite');let db=new Store(path);const w=createWorld(10);const e=emit(w,'arrival','Welcome','A new world.',[],{x:5,y:5});startAction(w,w.residents[0],{kind:'farm',reason:'Food for tomorrow.'});db.save(w,[e]);db.close();db=new Store(path);expect(db.load()).toEqual(w);expect(db.events()[0]).toEqual(e);expect(db.db.prepare('SELECT COUNT(*) AS n FROM accepted_actions').get()?.n).toBe(1);db.close();}finally{rmSync(dir,{recursive:true,force:true});}});
  it('rolls back state together with invalid duplicate event inserts',()=>{const db=new Store(':memory:'),w=createWorld();const e=emit(w,'work','First','Only once.',[],{x:5,y:5});db.save(w,[e]);const prior=db.load();w.minute+=300;expect(()=>db.save(w,[e])).toThrow();expect(db.load()).toEqual(prior);db.close();});
  it('supports gap recovery, search, filters and single event lookup',()=>{const db=new Store(':memory:'),w=createWorld();const es=Array.from({length:5},(_,i)=>emit(w,i%2?'work':'project',`Event ${i}`,'bridge',['moss'],{x:2,y:2}));db.save(w,es);expect(db.events({after:2}).map(e=>e.id)).toEqual([3,4,5]);expect(db.events({search:'Event 2'})).toHaveLength(1);expect(db.events({kind:'project',resident:'moss'})).toHaveLength(3);expect(db.event(1)?.id).toBe(1);db.close();});
  it('only publishes evidence from actual events, and excludes fabricated selected IDs',()=>{const db=new Store(':memory:');const engine=new Engine(db,new Intelligence(db,undefined));engine.state.minute+=1440;const es=db.events();const paper=engine.publishPaper(es,[99999,es[0].id]);expect(paper.articles).toHaveLength(1);expect(paper.articles[0].body).toBe(es[0].detail);for(const a of paper.articles)for(const id of a.eventIds)expect(db.event(id)).not.toBeNull();db.close();});
  it('does not skip simulation time when restarted',()=>{const db=new Store(':memory:');const engine=new Engine(db,new Intelligence(db,undefined));engine.tick(10);const minute=engine.state.minute;const restarted=new Engine(db,new Intelligence(db,undefined));expect(restarted.state.minute).toBe(minute);db.close();});
});
