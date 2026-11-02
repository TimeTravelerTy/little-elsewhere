import { mkdtempSync,rmSync,mkdirSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import assert from 'node:assert/strict';
import { Store } from '../src/server/store.ts';
import { MAP_W, MAP_H } from '../src/shared/map.ts';
import { Engine } from '../src/server/engine.ts';
import { Intelligence } from '../src/server/ai.ts';
const realtime=process.argv.includes('--realtime');
if(realtime){
  const base=process.env.SOAK_URL||'http://127.0.0.1:3000';const hours=Number(process.env.SOAK_HOURS||72);const start=Date.now(),samples=[];mkdirSync('data/reports',{recursive:true});
  while(Date.now()-start<hours*3600000){const [h,w]=await Promise.all([fetch(base+'/api/health').then(r=>{if(!r.ok)throw new Error('Health unavailable');return r.json();}),fetch(base+'/api/world').then(r=>r.json())]);assert.equal(h.status,'healthy');assert.ok(h.budget.monthSpent+h.budget.reserved<=h.budget.monthlyLimit+.000001);samples.push({time:new Date().toISOString(),minute:w.state.minute,events:w.state.sequence,spent:h.budget.monthSpent,residents:w.state.residents.length});writeFileSync('data/reports/realtime-soak.json',JSON.stringify({mode:'real-time',complete:false,samples},null,2));await new Promise(resolve=>setTimeout(resolve,60000));}
  writeFileSync('data/reports/realtime-soak.json',JSON.stringify({mode:'real-time',complete:true,hours,samples},null,2));console.log('Real-time soak completed.');
}else{
  const results=[];const dir=mkdtempSync(join(tmpdir(),'elsewhere-soak-'));const started=Date.now();
  try{for(const seed of [4217,9182,70031]){let db=new Store(join(dir,`${seed}.sqlite`));let e=new Engine(db,new Intelligence(db,undefined),seed);const start=e.state.minute;let lastSequence=e.state.sequence,stalls=0;const kinds:Record<string,number>={};
    for(let i=0;i<3456;i++){e.tick(5);await e.work();for(const r of e.state.residents){for(const value of Object.values(r.inventory))assert.ok(value>=0&&Number.isFinite(value));for(const value of Object.values(r.needs))assert.ok(value>=0&&value<=100);assert.ok(r.position.x>=0&&r.position.x<MAP_W&&r.position.y>=0&&r.position.y<MAP_H);}if(i%288===0){if(lastSequence===e.state.sequence)stalls++;lastSequence=e.state.sequence;console.log(`Seed ${seed}: world day ${Math.floor(e.state.minute/1440)+1}, ${e.state.sequence} events, ${e.state.projects.filter(p=>p.complete).length} projects`);}
      if(i===1727){const saved=structuredClone(e.state);db.close();db=new Store(join(dir,`${seed}.sqlite`));e=new Engine(db,new Intelligence(db,undefined));assert.deepEqual(e.state,saved);}
    }
    for(const row of db.db.prepare('SELECT kind,COUNT(*) AS n FROM events GROUP BY kind').all() as {kind:string;n:number}[])kinds[row.kind]=row.n;
    const papers=db.papers();for(const p of papers)for(const a of p.articles)for(const id of a.eventIds)assert.ok(db.event(id));
    assert.equal(e.state.minute-start,17280);assert.ok(e.state.projects.some(p=>p.complete));assert.ok((kinds.conversation||0)>10);assert.ok(e.state.residents.length<=24);assert.ok(stalls<=1);
    results.push({seed,simulatedDays:12,wallClockEquivalentHours:72,events:e.state.sequence,eventKinds:kinds,projectsCompleted:e.state.projects.filter(p=>p.complete).length,discoveries:e.state.regions.filter(r=>r.discovered).length,residents:e.state.residents.length,papers:papers.length,clubs:e.state.clubs.length,festivals:e.state.festivals.length,spent:db.budget(20).monthSpent,restartVerified:true});db.close();}
    mkdirSync('data/reports',{recursive:true});const report={mode:'accelerated-offline',notALive72HourRun:true,elapsedSeconds:(Date.now()-started)/1000,results};writeFileSync('data/reports/accelerated-soak.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{rmSync(dir,{recursive:true,force:true});}
}
