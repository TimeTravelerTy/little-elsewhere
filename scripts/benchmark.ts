import { z } from 'zod';
import { mkdirSync,writeFileSync } from 'node:fs';
import { Store } from '../src/server/store.ts';
import { Intelligence,candidates,context,decisionSchema } from '../src/server/ai.ts';
import { createWorld,validAction } from '../src/server/world.ts';
try { process.loadEnvFile('.env'); } catch {}
if(!process.env.OPENROUTER_API_KEY)throw new Error('Set OPENROUTER_API_KEY in .env before running paid model comparisons.');
const store=new Store(process.env.DATABASE_PATH||'data/world.sqlite');const ai=new Intelligence(store,process.env.OPENROUTER_API_KEY,undefined,Number(process.env.MONTHLY_BUDGET_USD||20));
await ai.refreshCatalog();if(!ai.catalog.size)throw new Error('Could not retrieve current catalog prices.');
const quick=process.argv.includes('--quick'); const repeats=quick?1:4; const results=[];
for(const model of ['hybrid-jev', ...(quick?candidates.slice(0,1):candidates)]){if(model === 'hybrid-jev' ? !ai.decisionReady : !ai.catalog.has(model)){results.push({model,available:false});continue;}const cases=[];const costBefore=store.budget(ai.monthlyLimit).monthSpent;
  for(let scenario=0;scenario<6;scenario++)for(let repeat=0;repeat<repeats;repeat++){
    const w=createWorld(4217+repeat),r=w.residents[[0,1,2,4,7,10][scenario]];let expected:string[]=[];let test='';
    if(scenario===0){r.needs.hunger=95;r.inventory.food=4;expected=['eat','cook'];test='Immediate hunger';}
    if(scenario===1){r.needs.energy=5;expected=['rest'];test='Exhaustion';}
    if(scenario===2){r.promises.push({to:'ada',project:'bridge',due:w.minute+60,status:'open',eventId:1});r.memories.push({id:'promise',minute:400,text:'I promised Ada to work on the bridge today.',importance:10,eventIds:[1],kind:'commitment'});expected=['build'];test='Remember a commitment';}
    if(scenario===3){r.inventory.food=0;r.inventory.wood=0;r.inventory.stone=0;expected=['farm','gather','withdraw','ask','trade'];test='No imaginary supplies';}
    if(scenario===4){r.needs.social=5;r.needs.hunger=5;r.needs.energy=100;expected=['socialize','club','share'];test='Seek company';}
    if(scenario===5){w.projects[0].complete=true;r.role='Wanderer';r.ambition='Explore the old outpost today.';r.plan=r.ambition;r.needs.energy=100;r.needs.hunger=0;expected=['explore'];test='Follow a distinctive ambition';}
    const started=performance.now();const answer=model === 'hybrid-jev' ? await ai.decide(w,r) : await ai.json('You are this resident. Select one supplied legal action that addresses your needs, commitments and personality. Return JSON {"kind":string,"target"?:string,"reason":string,"speech"?:string}. Reason <=240 characters, speech <=200 characters. You only know supplied observations.',context(w,r),decisionSchema,'residents',280,model);
    const valid=!!answer&&!validAction(w,r,answer);cases.push({test,repeat,valid,aligned:valid&&expected.includes(answer!.kind),latencyMs:Math.round(performance.now()-started),answer,error:answer?null:ai.lastError});
    if(!answer&&ai.lastError?.includes('allowance'))break;
  }
  const valid=cases.filter(c=>c.valid).length/cases.length,aligned=cases.filter(c=>c.aligned).length/cases.length;const uniqueReasons=new Set(cases.map(c=>c.answer?.reason).filter(Boolean)).size;
  results.push({model,available:true,validRate:valid,scenarioAlignment:aligned,uniqueReasons,score:Math.round((valid*.6+aligned*.4)*100),cost:store.budget(ai.monthlyLimit).monthSpent-costBefore,meanLatencyMs:Math.round(cases.reduce((n,c)=>n+c.latencyMs,0)/cases.length),cases});
}
mkdirSync('data/reports',{recursive:true});writeFileSync('data/reports/model-comparison.json',JSON.stringify({date:new Date().toISOString(),catalogUpdated:ai.catalogUpdated,method:`Jev hybrid and LLM-only on identical resident scenarios; ${repeats} repetitions. Hybrid timing/cost includes any generated social speech. Scores are behavioral checks, not a complete measure of personality or creativity. Review transcripts before changing models.`,results},null,2));
console.log(JSON.stringify(results.map(({cases,...summary})=>summary),null,2));console.log('Detailed responses: data/reports/model-comparison.json. Model setting is not changed automatically.');store.close();
